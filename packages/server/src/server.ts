import { loadEnv } from './lib/env.js';
import { createApp } from './app.js';

loadEnv();

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`[AgentServer] listening on port ${port}`);
});
