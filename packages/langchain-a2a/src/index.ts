import { A2AClient, type AgentCard, type AgentSkill, type SendTaskMessage, type SendTaskParams, type TaskResult, type TaskStreamEvent } from 'a2a-js';
import { DynamicStructuredTool } from 'langchain/tools';
import { z } from 'zod';

export interface A2ALogger {
  debug?: (message: string, context?: Record<string, unknown>) => void;
  info?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface A2A2LangChainOptions {
  fetch?: typeof fetch;
  authToken?: string;
  headers?: Record<string, string>;
  logger?: A2ALogger;
  /** Default metadata merged into every task. */
  defaultMetadata?: Record<string, unknown>;
  /** Hint for agent to include prior interactions. */
  historyLength?: number;
  /** Push notification preferences forwarded to the agent. */
  pushNotificationConfig?: Record<string, unknown>;
  /** Custom ID generator for tasks. */
  createTaskId?: () => string;
}

export interface A2AToolResult {
  mode: 'single' | 'stream';
  task: TaskResult;
  events?: TaskStreamEvent[];
}

const messagePartSchema = z
  .object({
    type: z.string().optional(),
    mimeType: z.string().optional(),
    text: z.string().optional(),
    data: z.unknown().optional(),
  })
  .strict();

const structuredContentSchema = z
  .object({
    role: z.string().optional(),
    parts: z.array(messagePartSchema).nonempty().optional(),
    text: z.string().optional(),
  })
  .strict();

const toolInputSchema = z.object({
  skillId: z
    .string()
    .min(1, 'skillId is required')
    .describe('One of the skill IDs from the agent card'),
  content: z
    .union([
      z.string().describe('Plain text payload forwarded as a single text part'),
      structuredContentSchema.describe('Structured message definition allowing explicit parts'),
    ])
    .default(''),
  metadata: z.record(z.string(), z.unknown()).optional(),
  streaming: z.boolean().optional(),
});

export type ToolInput = z.infer<typeof toolInputSchema>;

interface ExecutionContext {
  agent: AgentCard;
  client: A2AClient;
  options: A2A2LangChainOptions;
  supportsStreaming: boolean;
  logger?: A2ALogger;
  skills: AgentSkill[];
}

export class A2ALangChainTool extends DynamicStructuredTool {
  public readonly client: A2AClient;
  public readonly agent: AgentCard;
  public readonly skills: AgentSkill[];
  public readonly options: A2A2LangChainOptions;
  public readonly supportsStreaming: boolean;

  constructor(agent: AgentCard, client: A2AClient, options: A2A2LangChainOptions = {}) {
    const context: ExecutionContext = {
      agent,
      client,
      options,
      supportsStreaming: Boolean(agent.capabilities?.streaming),
      logger: options.logger,
      skills: agent.skills,
    };

    super({
      name: deriveToolName(agent),
      description: deriveToolDescription(agent),
      schema: toolInputSchema,
      func: async (input) => executeTask(context, input as ToolInput),
    });

    this.client = client;
    this.agent = agent;
    this.skills = agent.skills;
    this.options = options;
    this.supportsStreaming = context.supportsStreaming;
  }
}

export interface A2ALangChainWrapper {
  client: A2AClient;
  tool: A2ALangChainTool;
  agent: AgentCard;
  skills: AgentSkill[];
}

export function a2a2langchain(agentJson: AgentCard, options: A2A2LangChainOptions = {}): A2ALangChainWrapper {
  validateAgentCard(agentJson);

  const client = new A2AClient(agentJson.url, {
    fetch: options.fetch,
    authToken: options.authToken,
    headers: options.headers,
    logger: options.logger,
  });

  const tool = new A2ALangChainTool(agentJson, client, options);

  return {
    client,
    tool,
    agent: agentJson,
    skills: agentJson.skills,
  };
}

async function executeTask(context: ExecutionContext, input: ToolInput): Promise<A2AToolResult> {
  const { agent, client, options, supportsStreaming, logger, skills } = context;
  const skill = skills.find((item) => item.id === input.skillId);
  if (!skill) {
    const error = new Error(`Unknown skillId '${input.skillId}'. Known skills: ${skills.map((s) => s.id).join(', ')}`);
    logger?.error?.('a2a.skill_not_found', { skillId: input.skillId });
    throw error;
  }

  const params = buildSendTaskParams({ agent, skill, options, input });
  const streamingRequested = Boolean(input.streaming);
  const executeInStreamingMode =
    streamingRequested && supportsStreaming && typeof (client as { sendTaskSubscribe?: unknown }).sendTaskSubscribe === 'function';

  logger?.debug?.('a2a.task.dispatch', {
    skillId: skill.id,
    streaming: executeInStreamingMode,
    url: agent.url,
  });

  try {
    if (executeInStreamingMode) {
      const sendTaskSubscribe = (client as unknown as {
        sendTaskSubscribe?: (params: SendTaskParams) => AsyncIterable<TaskStreamEvent>;
      }).sendTaskSubscribe;

      if (!sendTaskSubscribe) {
        throw new Error('Client does not implement sendTaskSubscribe but streaming was requested.');
      }

      const events: TaskStreamEvent[] = [];
      for await (const event of sendTaskSubscribe(params)) {
        events.push(event);
        logger?.debug?.('a2a.task.stream_event', {
          skillId: skill.id,
          type: event.type,
          status: event.task?.status,
        });
        if (isTerminalStatus(event.task?.status)) {
          break;
        }
      }

      const finalEvent = events[events.length - 1];
      if (!finalEvent) {
        throw new Error('No events returned from sendTaskSubscribe.');
      }

      logger?.info?.('a2a.task.completed', {
        skillId: skill.id,
        status: finalEvent.task?.status,
      });

      return {
        mode: 'stream',
        task: finalEvent.task,
        events,
      };
    }

    const result = await client.sendTask(params);
    logger?.info?.('a2a.task.completed', {
      skillId: skill.id,
      status: result.status,
    });

    return {
      mode: 'single',
      task: result,
    };
  } catch (error) {
    logger?.error?.('a2a.task.error', {
      skillId: skill.id,
      error: normaliseError(error),
    });
    throw error;
  }
}

function buildSendTaskParams({
  agent,
  skill,
  options,
  input,
}: {
  agent: AgentCard;
  skill: AgentSkill;
  options: A2A2LangChainOptions;
  input: ToolInput;
}): SendTaskParams {
  const taskId = options.createTaskId?.() ?? generateTaskId();
  const message = normaliseMessage(input.content, skill, agent);

  const metadata: Record<string, unknown> = {
    skillId: skill.id,
    ...options.defaultMetadata,
    ...input.metadata,
  };

  const params: SendTaskParams = {
    id: taskId,
    message,
  };

  if (Object.keys(metadata).length > 0) {
    params.metadata = metadata;
  }

  if (typeof options.historyLength === 'number') {
    params.historyLength = options.historyLength;
  }

  if (options.pushNotificationConfig) {
    params.pushNotificationConfig = options.pushNotificationConfig;
  }

  return params;
}

function normaliseMessage(content: ToolInput['content'], skill: AgentSkill, agent: AgentCard): SendTaskMessage {
  if (typeof content === 'string') {
    return {
      role: 'user',
      parts: [createTextPart(content, skill, agent)],
    };
  }

  const { role, parts, text } = content;
  const resolvedParts = Array.isArray(parts) && parts.length > 0
    ? parts.map((part) => ({
        type: part.type,
        mimeType: part.mimeType ?? guessMimeType(part, skill, agent),
        text: part.text,
        data: part.data,
      }))
    : text
    ? [createTextPart(text, skill, agent)]
    : [];

  if (resolvedParts.length === 0) {
    throw new Error('Structured content must include either parts or text.');
  }

  return {
    role: role ?? 'user',
    parts: resolvedParts,
  };
}

function createTextPart(text: string, skill: AgentSkill, agent: AgentCard) {
  const mimeType = chooseMimeType(skill.inputModes, agent.defaultInputModes);
  return {
    type: 'text',
    text,
    mimeType,
  };
}

function guessMimeType(part: { mimeType?: string }, skill: AgentSkill, agent: AgentCard): string | undefined {
  return part.mimeType ?? chooseMimeType(skill.inputModes, agent.defaultInputModes);
}

function chooseMimeType(skillModes?: string[], defaultModes?: string[]): string | undefined {
  const candidates = skillModes && skillModes.length > 0 ? skillModes : defaultModes;
  return candidates && candidates.length > 0 ? candidates[0] : undefined;
}

function generateTaskId(): string {
  const globalCrypto = (globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function deriveToolName(agent: AgentCard): string {
  return agent.name ? `${agent.name.replace(/\s+/g, '_').toLowerCase()}_tool` : 'a2a_agent_tool';
}

function deriveToolDescription(agent: AgentCard): string {
  const skills = agent.skills?.map((skill) => `${skill.id}: ${skill.description}`).join('; ');
  return [agent.description, skills ? `Skills => ${skills}` : undefined].filter(Boolean).join(' ');
}

function validateAgentCard(agent: AgentCard): void {
  if (!agent) {
    throw new Error('Agent card is required.');
  }
  if (!agent.url) {
    throw new Error('Agent card must include a url field.');
  }
  if (!agent.skills || agent.skills.length === 0) {
    throw new Error('Agent card must declare at least one skill.');
  }
}

function isTerminalStatus(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  return ['completed', 'failed', 'canceled'].includes(status);
}

function normaliseError(error: unknown): Record<string, unknown> {
  if (!error) {
    return {};
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === 'object') {
    return error as Record<string, unknown>;
  }
  return { message: String(error) };
}
