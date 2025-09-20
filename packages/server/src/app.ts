import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import type { AgentStep } from '@langchain/core/agents';

import {
  buildAgentSummary,
  resolveApiKey,
  resolveModelName,
  resolveModuleConfig,
  resolveProvider
} from './lib/config.js';
import { createChatModel } from './lib/modelFactory.js';
import { buildAgentToolset, type AgentPayloadCarrier, type ServerLogger } from './lib/a2aTools.js';
import type { AgentToolExecution, AgentToolIssue, ChatRequestBody, ChatResponseBody, ServerAgentSummary } from './lib/types.js';

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

      const requestId = createRequestId();
      const requestLogger = createRequestLogger(requestId);

      const provider = resolveProvider();
      const moduleConfig = resolveModuleConfig(provider);

      const effectiveApiKey = resolveApiKey(provider, apiKey);
      if (!effectiveApiKey) {
        res.status(400).json({ ok: false, error: `API key missing for provider "${provider}".` });
        return;
      }
      const effectiveModel = resolveModelName(provider, model);
      const normalisedAgents = normaliseAgents(agents);
      const toolset = await buildAgentToolset(normalisedAgents, requestLogger);
      const agentSummaries = buildAgentSummary(toolset.summaries);

      if (toolset.issues.length) {
        requestLogger.warn('chat.agent.validation', {
          issues: toolset.issues.map((issue) => issue.agentId),
        });
      }

      const llm = await createChatModel({
        provider,
        apiKey: effectiveApiKey,
        model: effectiveModel,
        temperature: 0.2,
        moduleConfig
      });

      const availableToolCount = toolset.wrappers.length;
      const toolErrors = toResponseIssues(toolset.issues);
      const usingTools = shouldUseOpenAITools(provider, availableToolCount);

      let reply: string;
      let toolExecutions: AgentToolExecution[] = [];

      if (usingTools) {
        const toolAgentResult = await invokeOpenAIToolsAgent({
          llm,
          tools: toolset.wrappers.map((wrapper) => wrapper.tool),
          input: message.trim(),
          agentsSummary: agentSummaries,
        });
        reply = toolAgentResult.reply;
        toolExecutions = toolAgentResult.executions;
      } else {
        const prompt = ChatPromptTemplate.fromMessages([
          [
            'system',
            'You are the Schematical Agent orchestrator. You can route requests to the enabled A2A agents listed below.\n' +
              'Use them when appropriate, explain your reasoning, and clarify missing information before acting.\n' +
              'Enabled agents:\n{agentsSummary}'
          ],
          ['human', '{userMessage}']
        ]);

        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        reply = await chain.invoke({
          agentsSummary: agentSummaries || 'None available.',
          userMessage: message.trim()
        });
      }

      res.json({
        ok: true,
        reply,
        agentCount: toolset.summaries.length,
        model: effectiveModel || undefined,
        provider,
        availableToolCount,
        toolCount: toolExecutions.length,
        toolErrors,
        toolExecutions: toolExecutions.length ? toolExecutions : undefined
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected server error.';
      console.error('[AgentServer] chat error', error);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  return app;
}

function normaliseAgents(raw: unknown): AgentPayloadCarrier[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const carriers: AgentPayloadCarrier[] = [];

  raw.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const agentId = typeof record.agentId === 'string' ? record.agentId : undefined;
    const name = typeof record.name === 'string' ? record.name : agentId;

    if (!agentId || !name) {
      return;
    }

    const summary: ServerAgentSummary = {
      agentId,
      name,
      host: typeof record.host === 'string' ? record.host : undefined,
      origin: typeof record.origin === 'string' ? record.origin : undefined,
      description: typeof record.description === 'string' ? record.description : undefined,
      descriptorUrl: typeof record.descriptorUrl === 'string' ? record.descriptorUrl : undefined,
      sourceId: typeof record.sourceId === 'string' ? record.sourceId : undefined
    };

    carriers.push({
      summary,
      payload: Object.prototype.hasOwnProperty.call(record, 'payload') ? record.payload : undefined
    });
  });

  return carriers;
}

function createRequestId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function createRequestLogger(requestId: string): ServerLogger {
  const prefix = `[AgentServer][${requestId}]`;
  return {
    debug: (message, context) => logWithContext('debug', prefix, message, context),
    info: (message, context) => logWithContext('info', prefix, message, context),
    warn: (message, context) => logWithContext('warn', prefix, message, context),
    error: (message, context) => logWithContext('error', prefix, message, context)
  } satisfies ServerLogger;
}

function toResponseIssues(issues: AgentToolIssue[]): AgentToolIssue[] | undefined {
  return issues.length ? issues : undefined;
}

function logWithContext(
  level: 'debug' | 'info' | 'warn' | 'error',
  prefix: string,
  message: string,
  context?: Record<string, unknown>
): void {
  const consoleAny = console as unknown as Record<string, (...args: unknown[]) => void>;
  const logger = typeof consoleAny[level] === 'function' ? consoleAny[level].bind(console) : console.log.bind(console);
  const payload = context && Object.keys(context).length > 0 ? context : undefined;
  if (payload) {
    logger(`${prefix} ${message}`, payload);
  } else {
    logger(`${prefix} ${message}`);
  }
}

function shouldUseOpenAITools(provider: string, availableToolCount: number): boolean {
  return provider.trim().toLowerCase() === 'openai' && availableToolCount > 0;
}

interface InvokeOpenAIToolsParams {
  llm: any;
  tools: any[];
  input: string;
  agentsSummary: string;
}

interface InvokeOpenAIToolsResult {
  reply: string;
  executions: AgentToolExecution[];
}

async function invokeOpenAIToolsAgent(params: InvokeOpenAIToolsParams): Promise<InvokeOpenAIToolsResult> {
  const { llm, tools, input, agentsSummary } = params;

  if (!tools.length) {
    return { reply: input, executions: [] };
  }

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      'You are the Schematical Agent orchestrator. Delegate work to the available A2A tools when it helps the user.\n' +
        'If you call a tool, explain what you did afterwards.\n' +
        'Enabled agents:\n{agentsSummary}'
    ),
    new MessagesPlaceholder('chat_history'),
    HumanMessagePromptTemplate.fromTemplate('{input}'),
    new MessagesPlaceholder('agent_scratchpad')
  ]);

  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  });

  const executor = new AgentExecutor({
    agent,
    tools,
    returnIntermediateSteps: true,
  });

  const result = await executor.invoke({
    input,
    agentsSummary: agentsSummary || 'None available.',
    chat_history: [],
  });

  const reply = typeof result.output === 'string' ? result.output : String(result.output ?? '');
  const intermediateSteps = Array.isArray(result.intermediateSteps)
    ? (result.intermediateSteps as AgentStep[])
    : [];
  const executions = extractToolExecutions(intermediateSteps);

  return { reply, executions };
}

function extractToolExecutions(steps: AgentStep[] | undefined): AgentToolExecution[] {
  if (!steps || !steps.length) {
    return [];
  }

  return steps.map((step) => {
    const parsedObservation = parseObservation(step.observation);
    const execution: AgentToolExecution = {
      toolName: step.action.tool,
      raw: parsedObservation,
    };

    if (parsedObservation && typeof parsedObservation === 'object') {
      const record = parsedObservation as Record<string, unknown>;
      const result = record.result as Record<string, unknown> | undefined;
      const combinedMetadata =
        (record.metadata as Record<string, unknown> | undefined) ||
        (result && typeof result === 'object' ? (result.metadata as Record<string, unknown> | undefined) : undefined);

      if (combinedMetadata) {
        if (typeof combinedMetadata.agentId === 'string') {
          execution.agentId = combinedMetadata.agentId;
        }
        if (typeof combinedMetadata.skillId === 'string') {
          execution.skillId = combinedMetadata.skillId;
        }
      }

      if (result && typeof result === 'object') {
        if (typeof result.kind === 'string' && result.kind === 'task') {
          if (typeof result.id === 'string') {
            execution.taskId = result.id;
          }
          const status = (result.status as Record<string, unknown> | undefined)?.state;
          if (typeof status === 'string') {
            execution.status = status;
          }
        }
      }
    }

    return execution;
  });
}

function parseObservation(observation: unknown): unknown {
  if (typeof observation !== 'string') {
    return observation;
  }

  const trimmed = observation.trim();
  if (!trimmed) {
    return observation;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return observation;
  }
}
