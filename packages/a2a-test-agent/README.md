# A2A Test Agent

Local Agent2Agent endpoint for exercising the LangChain integration. It exposes a minimal agent card with a single `test_task` skill and returns a canned task plus artifact response.

## Usage

```bash
npm run dev --workspace a2a-test-agent
```

The server listens on `http://localhost:8002/` and serves its agent card at `/.well-known/agent-card.json` via the SDK's express helper.
