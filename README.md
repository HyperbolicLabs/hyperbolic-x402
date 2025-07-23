# x402 Chat Completions API on Vercel

This is an Express.js application that provides OpenAI-compatible chat completions using Hyperbolic AI, with x402 payment processing integration.

## Features

- OpenAI-compatible `/v1/chat/completions` endpoint
- Hyperbolic AI integration for LLM inference
- x402 payment processing (Base Sepolia network)
- Comprehensive logging with Winston
- Request validation with Zod
- Security middleware with Helmet
- Health and readiness checks
- Graceful shutdown handling

## API Endpoints

### Chat Completions
- `POST /v1/chat/completions` - OpenAI-compatible chat completions endpoint
  - Requires payment via x402 ($0.001 per request)
  - Supports standard OpenAI parameters: model, messages, max_tokens, temperature, top_p, stream

### Health Checks
- `GET /health` - Basic health check
- `GET /ready` - Readiness check (validates external dependencies)

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create a `.env` file with the required environment variables:
```bash
# Hyperbolic AI API Key
HYPERBOLIC_API_KEY=your_hyperbolic_api_key_here

# Payment Configuration
ADDRESS=0x1234567890123456789012345678901234567890
FACILITATOR_URL=https://your-facilitator-url.com

# For testing with the client
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234

# Optional Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
LOG_LEVEL=info
NODE_ENV=development
PORT=3000
```

3. Start the development server:
```bash
pnpm run dev
```

## Testing with the Client

A test client is included to demonstrate x402 payment functionality:

```bash
pnpm run client
```

The client will:
1. Create an account from your private key
2. Make a chat completion request with payment
3. Display the AI response and payment details

## Usage Example

```bash
curl -X POST https://your-vercel-app.vercel.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3.2-3B-Instruct",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "max_tokens": 100
  }'
```

## Deployment

### One-Click Deploy

Deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/x402-hyperbolic-vercel)

### Manual Deploy

```bash
pnpm run deploy
```

## Environment Variables for Production

Make sure to set these in your Vercel dashboard:
- `HYPERBOLIC_API_KEY`
- `ADDRESS` 
- `FACILITATOR_URL`
- `ALLOWED_ORIGINS` (optional)
- `LOG_LEVEL` (optional)