# langchain-a2a

Utility helpers that wrap an A2A agent definition (`agent.json`) into a LangChain-compatible tool.

## Installation

```bash
npm install langchain-a2a a2a-js langchain zod
```

## Usage

```ts
import { a2a2langchain } from 'langchain-a2a';
import agentCard from './agent.json';

const logger = {
  info: console.log,
  error: console.error,
};

const { tool, client } = await a2a2langchain(agentCard, {
  logger,
});

// Register with LangChain
const tools = [tool];
```

Each invocation of the tool requires a `skillId` plus the input payload. The wrapper converts string input into the agent's preferred MIME type and attaches skill metadata automatically.

```ts
const response = await tool.invoke({
  skillId: 'hello_world',
  content: 'Say hello',
});

if (response.mode === 'single') {
  console.log(response.task.result);
}
```

To request streaming output (only when the agent advertises `capabilities.streaming`):

```ts
const response = await tool.invoke({
  skillId: 'chat',
  content: 'Stream responses please',
  streaming: true,
});

if (response.mode === 'stream') {
  for (const event of response.events ?? []) {
    console.log(event);
  }
}
```

## Options

- `cardUrl`: when provided, the wrapper initialises the client with `A2AClient.fromCardUrl`.
- `fetch`: custom fetch implementation for environments without global `fetch`.
- `logger`: optional logging interface (debug/info/warn/error).
- `defaultMetadata`: merged into each message's metadata alongside the `skillId`.
- `historyLength`: include conversation history hints when supported.
- `pushNotificationConfig`: forwarded untouched to the agent.
- `configuration`: additional overrides for the A2A `MessageSendConfiguration`.
- `createMessageId`: override the default `crypto.randomUUID`-based message ID generator.

## Error Handling

Errors from the client are surfaced unchanged after being logged. Streaming and non-streaming executions both throw if the agent returns a terminal failure or no events are received.

## Manual Testing

1. Install dependencies: `npm install` at the repo root.
2. Build the package: `npm run build --workspace langchain-a2a`.
3. Run a sample script pointing at a locally running A2A agent and confirm the tool returns expected task results.
