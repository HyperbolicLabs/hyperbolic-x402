import 'dotenv/config';
import express from 'express';
import { paymentMiddleware } from 'x402-express';
import helmet from 'helmet';
import { z } from 'zod';
import winston from 'winston';
import cors from 'cors';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

const app = express();
const PORT = process.env.PORT || 3000;

const facilitatorUrl = process.env.FACILITATOR_URL;
const payTo = process.env.ADDRESS;
const hyperbolicApiKey = process.env.HYPERBOLIC_API_KEY;

function validateEnvironmentVariables() {
  const missing = [];
  if (!facilitatorUrl) missing.push('FACILITATOR_URL');
  if (!payTo) missing.push('ADDRESS');
  if (!hyperbolicApiKey) missing.push('HYPERBOLIC_API_KEY');
  return missing;
}

const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1)
  })).min(1),
  max_tokens: z.number().int().min(1).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional()
});

type ChatCompletionMessage = {
  role: 'assistant' | 'user' | 'system';
  content: string;
};

type ChatCompletionChoice = {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: string | null;
  logprobs: any | null;
};

type ChatCompletionUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
};

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;
  
  res.on('finish', () => {
    if (res.statusCode >= 400 || req.url.includes('/v1/chat/completions')) {
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      const duration = Date.now() - startTime;
      
      if (res.statusCode >= 400) {
        logger[level](`${req.method} ${req.url} ${res.statusCode}`, {
          statusCode: res.statusCode,
          duration,
          requestId: requestId || 'missing'
        });
      }
    }
  });
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

function createPaymentMiddleware() {
  if (!payTo) {
    throw new Error('ADDRESS environment variable not configured');
  }
  return paymentMiddleware(
    payTo,
    {
      "POST /v1/chat/completions": {
        price: "$0.001",
        network: "base-sepolia",
      },
    }
  );
}

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.get('/favicon.png', (req, res) => {
  res.status(204).end();
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/ready', async (req, res) => {
  try {
    const missingEnvVars = validateEnvironmentVariables();
    if (missingEnvVars.length > 0) {
      return res.status(503).json({ 
        status: 'not ready',
        error: `Missing environment variables: ${missingEnvVars.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    const testResponse = await fetch('https://api.hyperbolic.xyz/v1/models', {
      headers: { Authorization: `Bearer ${hyperbolicApiKey}` }
    });
    
    if (!testResponse.ok) {
      throw new Error(`Hyperbolic API check failed: ${testResponse.status}`);
    }
    
    res.json({ 
      status: 'ready',
      timestamp: new Date().toISOString(),
      services: {
        hyperbolic: 'healthy'
      }
    });
  } catch (error) {
    logger.error(`Readiness check failed: ${error.message}`);
    res.status(503).json({ 
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/', (req, res) => {
  res.send('Welcome to the Hyperbolic x402 API');
});

app.post("/v1/transaction-log", async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  
  if (!requestId) {
    logger.error('Missing request ID for transaction log', { 
      url: req.url,
      method: req.method
    });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'X-Request-ID header is required for request correlation',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const transactionHash = req.headers['x-transaction-hash'] as string;
    const paymentNetwork = req.headers['x-payment-network'] as string;
    const payerAddress = req.headers['x-payer-address'] as string;
    
    logger.info('Transaction confirmed', {
      requestId,
      transaction: transactionHash,
      network: paymentNetwork,
      payer: payerAddress,
      model: req.body?.model,
      tokens: req.body?.tokens
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Transaction confirmation logged',
      requestId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Transaction log error: ${error.message}`, { 
      requestId,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to log transaction confirmation',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

app.post("/v1/chat/completions", async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  
  if (!requestId) {
    logger.error('Missing request ID', { 
      url: req.url,
      method: req.method
    });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'X-Request-ID header is required for request correlation',
      timestamp: new Date().toISOString()
    });
  }
  
  logger.info('Chat completion request', { 
    requestId,
    model: req.body?.model
  });
  
  try {
    const missingEnvVars = validateEnvironmentVariables();
    if (missingEnvVars.length > 0) {
      logger.error('Configuration error', { 
        requestId, 
        missingEnvVars
      });
      return res.status(500).json({
        error: 'Configuration Error',
        message: `Server misconfigured. Missing environment variables: ${missingEnvVars.join(', ')}`,
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    const validatedBody = chatCompletionSchema.parse(req.body);
    
    const response = await fetch('https://api.hyperbolic.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hyperbolicApiKey}`,
      },
      body: JSON.stringify(validatedBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Hyperbolic API error ${response.status}`, { 
        requestId,
        model: validatedBody.model
      });
      
      let userMessage = 'The AI service is currently unavailable';
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          if (errorData.message.includes('allowed now')) {
            const match = errorData.message.match(/Only (.+?) allowed now/);
            if (match) {
              const validModels = match[1]
                .split(' && ')
                .map(model => model.trim())
                .filter(model => model.length > 0)
                .sort();
              
              userMessage = `Invalid model: "${validatedBody.model}". Valid models are: ${validModels.join(', ')}`;
            } else {
              userMessage = `Invalid model: ${validatedBody.model}. Please check the model name.`;
            }
          } else {
            userMessage = errorData.message;
          }
        }
      } catch {
        // Keep generic message if we can't parse the error response  
      }
      
      return res.status(response.status).json({
        error: 'External API Error',
        message: userMessage,
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    const json = await response.json() as ChatCompletionResponse;
    
    if (!json.choices || !Array.isArray(json.choices)) {
      throw new Error('Invalid response format from Hyperbolic API');
    }
        const chatCompletionPayment = createPaymentMiddleware();
    
    await new Promise<void>((resolve, reject) => {
      chatCompletionPayment(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.status(200).json(json);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error', { 
        requestId,
        errors: error.errors
      });
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request format',
        details: error.errors,
        requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    logger.error(`Chat completion error: ${error.message}`, { 
      requestId,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

app.use((err, req, res, next) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.error(`Unhandled error: ${err.message}`, { 
    url: req.url,
    method: req.method,
    requestId: requestId || 'missing',
    error: err.message
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    requestId: requestId || undefined,
    timestamp: new Date().toISOString()
  });
});

app.use('*', (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    requestId: requestId || undefined,
    timestamp: new Date().toISOString()
  });
});

// Local development server (only runs when not in Vercel)
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    logger.info(`Server started`, { port: PORT, env: process.env.NODE_ENV });
  });
  
  // Graceful shutdown handlers for local development
  function gracefulShutdown(signal) {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown', { error: err.message });
        process.exit(1);
      }
      logger.info('Server closed successfully');
      process.exit(0);
    });
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    process.exit(1);
  });
}

export default app;
