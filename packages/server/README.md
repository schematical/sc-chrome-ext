# Schematical Agent Server

Node/Express service that fronts LangChain for the Chrome extension. It exposes a `/chat` endpoint used by the extension's background script and can also be deployed as an AWS Lambda function via `@codegenie/serverless-express`.

## Development

```bash
# Install workspace dependencies from the repo root
npm install

# Start the server locally on http://localhost:4000
npm run dev --workspace sc-agent-server
```

Configure credentials in `.env`/`.env.local` (both are loaded, with `.env.local` taking precedence). Examples:

```
# Provider selection
LLM_PROVIDER=openai

# Provider-specific keys/models (examples)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=...
LLM_MODEL=claude-3-opus

# Custom provider module (when not using OpenAI)
LLM_PROVIDER_MODULE=langchain/chat_models/anthropic
LLM_PROVIDER_EXPORT=ChatAnthropic
LLM_PROVIDER_API_KEY_OPTION=apiKey
LLM_PROVIDER_MODEL_OPTION=model
```

## Deployment

- **Express:** Build with `npm run build --workspace sc-agent-server` and run `node dist/server.js`.
- **Lambda:** Use the exported `handler` from `dist/handler.js` (Serverless Framework/SAM compatible).

## API

`POST /chat`

Body:
```json
{
  "message": "string",
  "agents": [
    { "agentId": "", "name": "", "host": "", "origin": "" }
  ],
  "apiKey": "optional api key override",
  "model": "optional model override"
}
```

Response:
```json
{
  "ok": true,
  "reply": "string",
  "agentCount": 2,
  "model": "gpt-4o-mini"
}
```
