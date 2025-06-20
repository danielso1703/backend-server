# Backend OpenAI Proxy Server

This is a simple Express server that securely proxies requests to the OpenAI API, keeping your API key safe from the frontend.

## Setup

1. **Clone this repo and navigate to the backend-server directory.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Create a `.env` file in this directory:**
   ```env
   OPENAI_API_KEY=sk-REPLACE_WITH_YOUR_KEY
   PORT=3001
   ```
   Replace `sk-REPLACE_WITH_YOUR_KEY` with your actual OpenAI API key.

4. **Start the server:**
   ```bash
   npm start
   ```

## Usage

Send a POST request to `http://localhost:3001/api/openai` with a JSON body:

```
{
  "endpoint": "chat/completions", // or any OpenAI endpoint after /v1/
  ...other OpenAI API parameters
}
```

**Example:**
```
{
  "endpoint": "chat/completions",
  "model": "gpt-3.5-turbo",
  "messages": [{"role": "user", "content": "Hello!"}]
}
```

The server will forward your request to OpenAI and return the response.

## Why use this?
- Your API key is never exposed to the frontend or browser.
- You can add logging, rate limiting, or other security features here. 