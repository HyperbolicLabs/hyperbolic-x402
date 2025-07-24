# Hyperbolic x Coinbase x402 Inference API

## What is x402?

x402 is an open payment standard that enables services to charge for access to their APIs and content directly over HTTP using the `402 Payment Required` status code. It allows clients to programmatically pay for resources without accounts, sessions, or credential management, using crypto-native payments for speed, privacy, and efficiency.

For more detailed information about x402, visit the [official documentation](https://x402.gitbook.io/x402).

## Implementation Overview

This integration demonstrates how to interact with the Hyperbolic API using x402 payments. The implementation uses the `x402-fetch` library to handle payment flows transparently, allowing you to access any model available on the [Hyperbolic Models](https://app.hyperbolic.ai/models) page.

## API Endpoint

The integration targets the Hyperbolic x402 chat completions endpoint:

```
POST https://hyperbolic-x402.vercel.app/v1/chat/completions
```

## Request Parameters

### Headers

| Header         | Required | Description                              |
| -------------- | -------- | ---------------------------------------- |
| `Content-Type` | Yes      | Must be `application/json`               |
| `Accept`       | Yes      | Must be `application/json`               |
| `X-Request-ID` | Yes      | Unique identifier for the request (UUID) |

### Request Body

The request body follows the OpenAI-compatible chat completions format:

| Parameter     | Type    | Required | Description                                                   |
| ------------- | ------- | -------- | ------------------------------------------------------------- |
| `model`       | string  | Yes      | The model to use (e.g., `"meta-llama/Llama-3.2-3B-Instruct"`) |
| `messages`    | array   | Yes      | Array of message objects with `role` and `content`            |
| `max_tokens`  | number  | No       | Maximum number of tokens to generate (default: 512)           |
| `temperature` | number  | No       | Controls randomness (0.0 to 2.0, default: 0.1)                |
| `top_p`       | number  | No       | Nuclear sampling parameter (default: 0.9)                     |
| `stream`      | boolean | No       | Whether to stream responses (default: false)                  |

### Example Request Body

```json
{
  "model": "meta-llama/Llama-3.2-3B-Instruct",
  "messages": [
    { "role": "user", "content": "What is 1+1?" }
  ],
  "max_tokens": 512,
  "temperature": 0.1,
  "top_p": 0.9,
  "stream": false
}
```

## Environment Setup

Before running the client, you'll need to set up your environment:

1. Create a `.env` file with your Ethereum private key:
   ```Text .env
   PRIVATE_KEY=0x...
   ```

2. Install dependencies:
   ```javascript TypeScript
   pnpm install
   ```

## Payment Flow

The x402 payment flow works as follows:

1. Client makes a request to the API endpoint
2. If payment is required, the server responds with `402 Payment Required` and payment instructions
3. The `x402-fetch` wrapper automatically handles the payment using your private key
4. Upon successful payment verification, the server processes your request and returns the model response
5. Transaction details are logged for confirmation

## Example Implementation

You can see a complete working example in the [`client.ts`](https://github.com/HyperbolicLabs/hyperbolic-x402/blob/main/client.ts) file in our official repository. The example demonstrates:

- Setting up the x402-enabled fetch wrapper
- Making a chat completion request
- Handling payment responses
- Logging transaction confirmations

To run the example:

```node TypeScript
pnpm run client
```

## Response Format

Successful responses follow the OpenAI-compatible format and include:

- The model's completion response
- Usage statistics (token counts)
- Payment confirmation details in the `x-payment-response` header