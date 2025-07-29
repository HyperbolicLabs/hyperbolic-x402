import { config } from "dotenv";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decodeXPaymentResponse, wrapFetchWithPayment } from "x402-fetch";
import { randomUUID } from "crypto";

config();

const privateKey = process.env.MAINNET_PRIVATE_KEY as Hex;
const baseURL = 'https://hyperbolic-x402.vercel.app';
// const baseURL = 'http://localhost:3000';

if (!privateKey) {
  console.error("Missing PRIVATE_KEY environment variable");
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
const url = `${baseURL}/v1/chat/completions`;
const requestId = randomUUID();

const fetchWithPayment = wrapFetchWithPayment(fetch, account);

console.log('Request Details:');
console.log(JSON.stringify({
  requestId,
  url,
  account: account.address
}, null, 2));

const requestOptions: RequestInit = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Request-ID": requestId,
  },
  body: JSON.stringify({
    model: "meta-llama/Meta-Llama-3.1-405B-Instruct",
    messages: [
      { role: "user", content: "Tell me the theory of the universe" }
    ],
    max_tokens: 4000,
    temperature: 0.1,
    top_p: 0.9,
    stream: false
  })
};

fetchWithPayment(url, requestOptions)
  .then(async response => {
    const body = await response.json();
    
    console.log('\nModel Response:');
    console.log(JSON.stringify(body, null, 2));
    
    const paymentHeader = response.headers.get("x-payment-response");
    if (paymentHeader) {
      const paymentResponse = decodeXPaymentResponse(paymentHeader);
      
      const confirmationOptions: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
          "X-Transaction-Hash": paymentResponse.transaction,
          "X-Payment-Network": paymentResponse.network,
          "X-Payer-Address": paymentResponse.payer,
        },
        body: JSON.stringify({
          requestId,
          transactionHash: paymentResponse.transaction,
          network: paymentResponse.network,
          payer: paymentResponse.payer,
          model: body.model,
          tokens: body.usage?.total_tokens
        })
      };
      
      try {
        const confirmResponse = await fetch(`${baseURL}/v1/transaction-log`, confirmationOptions);
        if (confirmResponse.ok) {
          console.log('Transaction Hash:', paymentResponse.transaction);
        } else {
          console.log('Failed to send transaction confirmation:', confirmResponse.status);
        }
      } catch (error) {
        console.log('Error sending transaction confirmation:', error.message);
      }
    } else {
      console.log('No payment header found');
    }
    
  })
  .catch(error => {
    console.error("Request failed:", error.message || error);
    if (error.code === 'ECONNREFUSED') {
      console.error("Is the server running on localhost:3000?");
    }
  }); 