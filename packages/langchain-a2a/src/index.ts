import { A2AClient } from '@a2a-js/sdk/client';
import type {
  AgentCard,
  AgentSkill,
  Message,
  MessageSendConfiguration,
  MessageSendParams,
  Part,
  PushNotificationConfig,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
  SendMessageResponse,
  SendMessageSuccessResponse,
} from '@a2a-js/sdk';
import { DynamicStructuredTool } from 'langchain/tools';
import { z } from 'zod';

export interface A2ALogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface A2A2LangChainOptions {
  /** Optional URL to the agent card; when provided we initialise the client via A2AClient.fromCardUrl. */
  cardUrl?: string;
  /** Custom fetch implementation for environments without global fetch. */
  fetch?: typeof fetch;
  logger?: A2ALogger;
  /** Default metadata merged into every message send. */
  defaultMetadata?: Record<string, unknown>;
  /** Hint for the agent to include prior history when supported. */
  historyLength?: number;
  /** Push notification preferences forwarded to the agent. */
  pushNotificationConfig?: PushNotificationConfig;
  /** Optional override for message configuration details. */
  configuration?: Partial<MessageSendConfiguration>;
  /** Custom message identifier factory. */
  createMessageId?: () => string;
}

export type A2AStreamEvent = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

export interface A2AToolResult {
  mode: 'single' | 'stream';
  result: Message | Task;
  events?: A2AStreamEvent[];
  metadata?: Record<string, unknown>;
}

const messagePartSchema = z
  .object({
    kind: z.string().default('text'),
    text: z.string().optional(),
    data: z.unknown().optional(),
    uri: z.string().optional(),
    name: z.string().optional(),
    mimeType: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const structuredContentSchema = z
  .object({
    role: z.enum(['user', 'agent']).optional(),
    parts: z.array(messagePartSchema).nonempty().optional(),
    text: z.string().optional(),
    contextId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
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
      skills: agent.skills ?? [],
    };

    super({
      name: deriveToolName(agent),
      description: deriveToolDescription(agent),
      schema: toolInputSchema,
      func: async (input) => {
        const result = await executeTask(context, input as ToolInput);
        return JSON.stringify(result);
      },
    });

    this.client = client;
    this.agent = agent;
    this.skills = agent.skills ?? [];
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

export async function a2a2langchain(
  agentCard: AgentCard | null,
  options: A2A2LangChainOptions = {}
): Promise<A2ALangChainWrapper> {
  const { client, resolvedAgent } = await initialiseClient(agentCard, options);
  validateAgentCard(resolvedAgent);
  const tool = new A2ALangChainTool(resolvedAgent, client, options);

  return {
    client,
    tool,
    agent: resolvedAgent,
    skills: resolvedAgent.skills ?? [],
  };
}

async function executeTask(context: ExecutionContext, input: ToolInput): Promise<A2AToolResult> {
  const { agent, client, options, supportsStreaming, logger, skills } = context;
  const skill = skills.find((item) => item.id === input.skillId);
  if (!skill) {
    const error = new Error(`Unknown skillId '${input.skillId}'. Known skills: ${skills.map((s) => s.id).join(', ')}`);
    logger?.error('a2a.skill_not_found', { skillId: input.skillId });
    throw error;
  }

  const sendParams = buildSendMessageParams({ agent, skill, options, input });
  const streamingRequested = Boolean(input.streaming);
  const executeInStreamingMode = streamingRequested && supportsStreaming;

    logger?.debug('a2a.message.dispatch', {
    skillId: skill.id,
    streaming: executeInStreamingMode,
  });

  try {
    if (executeInStreamingMode) {
      const events: A2AStreamEvent[] = [];
      let finalResult: Message | Task | null = null;

      const iterator = client.sendMessageStream(sendParams);
      for await (const event of iterator) {
        events.push(event);
        logger?.debug('a2a.stream.event', {
          skillId: skill.id,
          kind: (event as { kind?: string }).kind,
        });
        if (!finalResult && isResultEvent(event)) {
          finalResult = event;
        }
      }

      if (!finalResult) {
        finalResult = inferResultFromEvents(events);
      }

      if (!finalResult) {
        throw new Error('Streaming completed without a result payload.');
      }

      logger?.info('a2a.message.completed', {
        skillId: skill.id,
        mode: 'stream',
      });

      return {
        mode: 'stream',
        result: finalResult,
        events,
        metadata: sendParams.metadata,
      };
    }

    logger?.debug('a2a.message.request', {
      skillId: skill.id,
      message: JSON.stringify(sendParams.message),
      metadata: sendParams.metadata,
      configuration: sendParams.configuration,
    });

    const response = await client.sendMessage(sendParams);

    if (isErrorResponse(response)) {
      const errorMessage = response.error?.message ?? 'Agent returned an error response.';
      logger?.error('a2a.message.error', {
        skillId: skill.id,
        error: response.error,
      });
      throw new Error(errorMessage);
    }

    const success = response as SendMessageSuccessResponse;
    const result = success.result;

    logger?.info('a2a.message.completed', {
      skillId: skill.id,
      mode: 'single',
    });

    return {
      mode: 'single',
      result,
      metadata: sendParams.metadata,
    };
  } catch (error) {
    logger?.error('a2a.message.unhandled_error', {
      skillId: skill.id,
      error: normaliseError(error),
    });
    throw error;
  }
}

function buildSendMessageParams({
  agent,
  skill,
  options,
  input,
}: {
  agent: AgentCard;
  skill: AgentSkill;
  options: A2A2LangChainOptions;
  input: ToolInput;
}): MessageSendParams {
  const messageId = options.createMessageId?.() ?? generateMessageId();
  const message = normaliseMessage(input.content, messageId, skill, agent);

  const metadata: Record<string, unknown> = {
    skillId: skill.id,
    agentName: agent.name,
    ...options.defaultMetadata,
    ...input.metadata,
  };

  const configuration: MessageSendConfiguration = {
    ...options.configuration,
  };

  if (typeof options.historyLength === 'number') {
    configuration.historyLength = options.historyLength;
  }

  if (options.pushNotificationConfig) {
    configuration.pushNotificationConfig = options.pushNotificationConfig;
  }

  const streaming = Boolean(input.streaming);
  if (typeof configuration.blocking === 'undefined') {
    configuration.blocking = !streaming;
  }

  const params: MessageSendParams = {
    message,
  };

  if (Object.keys(metadata).length > 0) {
    params.metadata = metadata;
  }

  if (Object.keys(configuration).length > 0) {
    params.configuration = configuration;
  }

  return params;
}

function normaliseMessage(
  content: ToolInput['content'],
  messageId: string,
  _skill: AgentSkill,
  _agent: AgentCard
): Message {
  if (typeof content === 'string') {
    return {
      kind: 'message',
      messageId,
      role: 'user',
      parts: [createTextPart(content)],
    } satisfies Message;
  }

  const { role, parts, text, contextId, metadata } = content;
  const resolvedParts = Array.isArray(parts) && parts.length > 0
    ? parts.map(normalisePart)
    : text
    ? [createTextPart(text)]
    : [];

  if (!resolvedParts.length) {
    throw new Error('Structured content must include either parts or text.');
  }

  const message: Message = {
    kind: 'message',
    messageId,
    role: role === 'agent' ? 'agent' : 'user',
    parts: resolvedParts,
  };

  if (contextId) {
    message.contextId = contextId;
  }
  if (metadata && Object.keys(metadata).length > 0) {
    message.metadata = metadata;
  }

  return message;
}

function normalisePart(part: z.infer<typeof messagePartSchema>): Part {
  if (part.kind === 'text' || !part.kind) {
    return {
      kind: 'text',
      text: part.text ?? '',
      metadata: part.metadata,
    };
  }

  if (part.kind === 'file') {
    const file = buildFileDescriptor(part);
    return {
      kind: 'file',
      file,
      metadata: part.metadata,
    } as Part;
  }

  if (part.kind === 'data') {
    const data = buildDataPayload(part.data);
    return {
      kind: 'data',
      data,
      metadata: part.metadata,
    } as Part;
  }

  return {
    kind: part.kind,
    text: part.text ?? '',
    metadata: part.metadata,
  } as Part;
}

function buildFileDescriptor(
  part: z.infer<typeof messagePartSchema>
): { uri: string; mimeType?: string; name?: string } | { bytes: string; mimeType?: string; name?: string } {
  if (typeof part.data === 'string') {
    return {
      bytes: part.data,
      mimeType: part.mimeType,
      name: part.name,
    };
  }

  if (typeof part.uri === 'string' && part.uri.trim()) {
    return {
      uri: part.uri,
      mimeType: part.mimeType,
      name: part.name,
    };
  }

  throw new Error('File parts must include either a base64 "data" payload or a "uri".');
}

function buildDataPayload(source: unknown): Record<string, unknown> {
  if (!source) {
    return {};
  }
  if (typeof source === 'object') {
    return source as Record<string, unknown>;
  }
  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      // fall through to default
    }
  }
  throw new Error('Data parts require an object payload.');
}

function createTextPart(text: string): Part {
  return {
    kind: 'text',
    text,
  };
}

function isErrorResponse(response: SendMessageResponse): response is Extract<SendMessageResponse, { error: unknown }> {
  return 'error' in response && response.error !== undefined;
}

function isResultEvent(event: A2AStreamEvent): event is Message | Task {
  return (event as Message).kind === 'message' || (event as Task).kind === 'task';
}

function inferResultFromEvents(events: A2AStreamEvent[]): Message | Task | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (isResultEvent(event)) {
      return event;
    }
  }
  return null;
}

function generateMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function deriveToolName(agent: AgentCard): string {
  return agent.name ? `${agent.name.replace(/\s+/g, '_').toLowerCase()}_tool` : 'a2a_agent_tool';
}

function deriveToolDescription(agent: AgentCard): string {
  const skills = agent.skills?.map((skill) => `${skill.id}: ${skill.description ?? ''}`.trim()).join('; ');
  return [agent.description, skills ? `Skills => ${skills}` : undefined].filter(Boolean).join(' ');
}

async function initialiseClient(
  agentCard: AgentCard | null,
  options: A2A2LangChainOptions
): Promise<{ client: A2AClient; resolvedAgent: AgentCard }> {
  const fetchImpl = options.fetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);

  if (options.cardUrl) {
    const client = await A2AClient.fromCardUrl(options.cardUrl, {
      fetchImpl,
    });
    const resolvedAgent = agentCard ?? (await client.getAgentCard());
    return { client, resolvedAgent };
  }

  if (agentCard) {
    const client = new A2AClient(agentCard, {
      fetchImpl,
    });
    return { client, resolvedAgent: agentCard };
  }

  throw new Error('Agent card or cardUrl must be provided to initialise the A2A client.');
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
