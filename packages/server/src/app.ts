import cors from 'cors';
import express, { Request, Response } from 'express';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

import {
  buildAgentSummary,
  resolveApiKey,
  resolveModelName,
  resolveModuleConfig,
  resolveProvider
} from './lib/config.js';
import { createChatModel } from './lib/modelFactory.js';
import type { ChatRequestBody, ChatResponseBody, ServerAgentSummary } from './lib/types.js';

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - started;
      console.log(
        `[AgentServer] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
      );
    });
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, status: 'healthy', timestamp: Date.now() });
  });

  app.post('/chat', async (req: Request<unknown, ChatResponseBody, ChatRequestBody>, res: Response<ChatResponseBody>) => {
    try {
      const { message, agents = [], apiKey, model } = req.body ?? {};

      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ ok: false, error: 'A non-empty "message" is required.' });
        return;
      }

      const provider = resolveProvider();
      const moduleConfig = resolveModuleConfig(provider);

      const effectiveApiKey = resolveApiKey(provider, apiKey);
      if (!effectiveApiKey) {
        res.status(400).json({ ok: false, error: `API key missing for provider "${provider}".` });
        return;
      }
      const effectiveModel = resolveModelName(provider, model);
      const cleanedAgents = normaliseAgents(agents);
      const agentsSummary = buildAgentSummary(cleanedAgents);

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          'You are the Schematical Agent orchestrator. You can route requests to the enabled A2A agents listed below.\n' +
            'Use them when appropriate, explain your reasoning, and clarify missing information before acting.\n' +
            'Enabled agents:\n{agentsSummary}'
        ],
        ['human', '{userMessage}']
      ]);

      const llm = await createChatModel({
        provider,
        apiKey: effectiveApiKey,
        model: effectiveModel,
        temperature: 0.2,
        moduleConfig
      });

      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      const reply = await chain.invoke({
        agentsSummary: agentsSummary || 'None available.',
        userMessage: message.trim()
      });

      res.json({
        ok: true,
        reply,
        agentCount: cleanedAgents.length,
        model: effectiveModel || undefined,
        provider
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected server error.';
      console.error('[AgentServer] chat error', error);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  return app;
}

function normaliseAgents(raw: unknown): ServerAgentSummary[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const agentId = typeof record.agentId === 'string' ? record.agentId : undefined;
      const name = typeof record.name === 'string' ? record.name : agentId;

      if (!agentId || !name) {
        return null;
      }

      const agent: ServerAgentSummary = {
        agentId,
        name,
        host: typeof record.host === 'string' ? record.host : undefined,
        origin: typeof record.origin === 'string' ? record.origin : undefined,
        description: typeof record.description === 'string' ? record.description : undefined
      };

      return agent;
    })
    .filter((agent): agent is ServerAgentSummary => Boolean(agent));
}
