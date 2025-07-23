import { config } from "dotenv";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decodeXPaymentResponse, wrapFetchWithPayment } from "x402-fetch";
import { randomUUID } from "crypto";

config();

const privateKey = process.env.PRIVATE_KEY as Hex;
const baseURL = 'https://hyperbolic-x402.vercel.app';

if (!privateKey) {
  console.error("Missing PRIVATE_KEY environment variable");
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
const url = `${baseURL}/v1/chat/completions`;

// Generate request UUID for tracking
const requestId = randomUUID();

// Use regular fetch instead of debug fetch
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

console.log('About to make request to:', url);
console.log('Using account:', account.address);
console.log('Request ID:', requestId);

const requestOptions: RequestInit = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  body: JSON.stringify({
    model: "meta-llama/Llama-3.2-3B-Instruct",
    messages: [
      { role: "user", content: "What is 1+1?" }
    ],
    max_tokens: 512,
    temperature: 0.1,
    top_p: 0.9,
    stream: false
  })
};

fetchWithPayment(url, requestOptions)
  .then(async response => {
    const body = await response.json();
    console.log(body);
    
    const messageContent = body.choices?.[0]?.message?.content;
    console.log("\nResponse:", messageContent);

    const paymentHeader = response.headers.get("x-payment-response");
    if (paymentHeader) {
      const paymentResponse = decodeXPaymentResponse(paymentHeader);
      console.log("Payment processed:", paymentResponse);
    } else {
      console.log("No payment processed (request failed)");
    }
  })
  .catch(error => {
    console.error("Error:", error.message || error);
    if (error.code === 'ECONNREFUSED') {
      console.error("Is the server running on localhost:3000?");
    }
  }); 