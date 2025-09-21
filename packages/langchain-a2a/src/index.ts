import { A2AClient } from '@a2a-js/sdk/client';
import type {
  AgentCard,
  AgentSkill,
  MessageSendConfiguration,
  MessageSendParams,
  Part,
  SendMessageResponse,
  SendMessageSuccessResponse,
} from '@a2a-js/sdk';
import { BaseMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from 'langchain/tools';
import { z, ZodTypeAny, type ZodObject } from 'zod';
import { v4 as uuidv4 } from 'uuid';

interface A2A2LangChainOptions {
  cardUrl: string;
  blocking?: boolean;
  metadata?: Record<string, unknown>;
}

type ReservedInputFields = '__metadata' | '__configuration' | '__contextId' | '__taskId';

const RESERVED_FIELDS: ReservedInputFields[] = [
  '__metadata',
  '__configuration',
  '__contextId',
  '__taskId',
];

const FALLBACK_TOOL_SCHEMA = z.object({}).catchall(z.any());

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normaliseToolName(skill: AgentSkill): string {
  const candidate = skill.id || skill.name;
  return candidate.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function withDescription<T extends ZodTypeAny>(schema: T, description?: string): T {
  return description ? schema.describe(description) : schema;
}

function jsonSchemaToZod(schema: unknown): ZodTypeAny {
  if (!isPlainRecord(schema)) {
    return FALLBACK_TOOL_SCHEMA;
  }

  const description = typeof schema.description === 'string' ? schema.description : undefined;
  const typeDefinition = schema.type;
  const types = Array.isArray(typeDefinition) ? typeDefinition : typeDefinition ? [typeDefinition] : [];
  const allowsNull = types.includes('null');
  const primaryType = types.find((value) => value !== 'null');

  const handleNullable = (zodType: ZodTypeAny): ZodTypeAny => {
    const described = withDescription(zodType, description);
    if (allowsNull) {
      return described.nullable().optional();
    }
    return described;
  };

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const enumValues = schema.enum;
    if (enumValues.every((value) => typeof value === 'string')) {
      const uniqueValues = Array.from(new Set(enumValues));
      if (uniqueValues.length === 1) {
        return handleNullable(z.literal(uniqueValues[0]));
      }
      return handleNullable(z.enum(uniqueValues as [string, ...string[]]));
    }
  }

  switch (primaryType) {
    case 'string': {
      let zodType: ZodTypeAny = z.string();
      if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        const enumValues = schema.enum.filter((value): value is string => typeof value === 'string');
        if (enumValues.length) {
          const uniqueValues = Array.from(new Set(enumValues));
          zodType = uniqueValues.length === 1
            ? z.literal(uniqueValues[0])
            : z.enum(uniqueValues as [string, ...string[]]);
        }
      }
      return handleNullable(zodType);
    }
    case 'number':
    case 'integer': {
      let zodType: ZodTypeAny = z.number();
      if (primaryType === 'integer') {
        zodType = zodType.refine(Number.isInteger, { message: 'Expected integer' });
      }
      return handleNullable(zodType);
    }
    case 'boolean': {
      return handleNullable(z.boolean());
    }
    case 'array': {
      const itemSchema = jsonSchemaToZod(schema.items);
      let arraySchema = z.array(itemSchema);
      if (typeof schema.minItems === 'number') {
        arraySchema = arraySchema.min(schema.minItems);
      }
      if (typeof schema.maxItems === 'number') {
        arraySchema = arraySchema.max(schema.maxItems);
      }
      return handleNullable(arraySchema);
    }
    case 'object': {
      const properties = isPlainRecord(schema.properties) ? schema.properties : {};
      const required = Array.isArray(schema.required) ? new Set(schema.required as string[]) : new Set<string>();
      const shape: Record<string, ZodTypeAny> = {};

      for (const [key, value] of Object.entries(properties)) {
        const propertySchema = jsonSchemaToZod(value);
        shape[key] = required.has(key) ? propertySchema : propertySchema.optional();
      }

      let objectSchema = z.object(shape);

      if (schema.additionalProperties) {
        const additionalSchema = schema.additionalProperties === true
          ? z.any()
          : jsonSchemaToZod(schema.additionalProperties);
        objectSchema = objectSchema.catchall(additionalSchema);
      }

      if (Object.keys(shape).length === 0) {
        objectSchema = objectSchema.catchall(z.any());
      }

      return handleNullable(objectSchema);
    }
    default: {
      return handleNullable(z.any());
    }
  }
}

function buildToolSchema(skill: AgentSkill): ZodObject<any, any, any, any, any> {
  const parameters = (skill as AgentSkill & { parameters?: unknown }).parameters;
  if (!parameters) {
    return FALLBACK_TOOL_SCHEMA;
  }

  const schema = jsonSchemaToZod(parameters);
  return schema instanceof z.ZodObject ? schema : FALLBACK_TOOL_SCHEMA;
}

function buildMessageParts(payload: Record<string, unknown>): Part[] {
  const parts: Part[] = [];
  const payloadCopy: Record<string, unknown> = { ...payload };

  const content = typeof payloadCopy.content === 'string' ? payloadCopy.content : undefined;
  if (content !== undefined) {
    parts.push({ kind: 'text', text: content });
    delete payloadCopy.content;
  }

  if (Object.keys(payloadCopy).length > 0) {
    parts.push({ kind: 'data', data: payloadCopy });
  }

  if (parts.length === 0) {
    parts.push({ kind: 'text', text: '' });
  }

  return parts;
}

function deriveMetadata(options: A2A2LangChainOptions, agent: AgentCard, skill: AgentSkill, metadataOverride?: Record<string, unknown>): Record<string, unknown> {
  const mergedMetadata: Record<string, unknown> = {
    cardUrl: options.cardUrl,
    agentName: agent.name,
    ...(options.metadata ?? {}),
    ...(metadataOverride ?? {}),
    skillId: skill.id,
  };

  if (!('agentDescription' in mergedMetadata) && agent.description) {
    mergedMetadata.agentDescription = agent.description;
  }

  try {
    const parsed = new URL(options.cardUrl);
    if (!('origin' in mergedMetadata)) {
      mergedMetadata.origin = `${parsed.protocol}//${parsed.host}`;
    }
    if (!('host' in mergedMetadata)) {
      mergedMetadata.host = parsed.hostname;
    }
  } catch (error) {
    console.debug('[a2a2langchain] failed to parse card URL', { error });
  }

  return mergedMetadata;
}

function createMessageParams(
  configuration: MessageSendConfiguration | undefined,
  metadata: Record<string, unknown>,
  payload: Record<string, unknown>,
  overrides: {
    contextId?: unknown;
    taskId?: unknown;
  },
): MessageSendParams {
  const parts = buildMessageParts(payload);

  const message: MessageSendParams['message'] = {
    kind: 'message',
    messageId: uuidv4(),
    role: 'user',
    parts,
  };

  if (typeof overrides.contextId === 'string' && overrides.contextId.trim().length > 0) {
    message.contextId = overrides.contextId;
  }

  if (typeof overrides.taskId === 'string' && overrides.taskId.trim().length > 0) {
    message.taskId = overrides.taskId;
  }

  return {
    configuration,
    message,
    metadata,
  };
}

function sanitizeConfiguration(
  base: MessageSendConfiguration | undefined,
  override: unknown,
  blockingFallback: boolean,
): MessageSendConfiguration | undefined {
  const merged: MessageSendConfiguration = {
    blocking: blockingFallback,
    ...(base ?? {}),
  };

  if (isPlainRecord(override)) {
    Object.assign(merged, override);
  }

  if (merged.blocking === undefined) {
    merged.blocking = blockingFallback;
  }

  return merged;
}

function ensureSuccess(response: SendMessageResponse, skillId: string): SendMessageSuccessResponse {
  if ('error' in response) {
    const { code, message } = response.error;
    throw new Error(`A2A agent call failed for skill ${skillId}: ${message} (code: ${code})`);
  }
  return response as SendMessageSuccessResponse;
}

function formatToolResult(result: unknown): string {
  if (isPlainRecord(result) && typeof result.kind === 'string') {
    if (result.kind === 'message' && Array.isArray(result.parts)) {
      const rendered = result.parts
        .map((part: unknown) => {
          if (!isPlainRecord(part) || typeof part.kind !== 'string') {
            return JSON.stringify(part);
          }
          if (part.kind === 'text' && typeof part.text === 'string') {
            return part.text;
          }
          return JSON.stringify(part);
        })
        .filter((value) => value !== undefined && value !== null)
        .join('\n')
        .trim();

      if (rendered.length > 0) {
        return rendered;
      }
    }

    return JSON.stringify(result);
  }

  if (typeof result === 'string') {
    return result;
  }

  return JSON.stringify(result);
}

export async function a2a2langchain(options: A2A2LangChainOptions): Promise<DynamicStructuredTool[]> {
  if (!options?.cardUrl) {
    throw new Error('Agent card or cardUrl must be provided to initialise the A2A client.');
  }

  const client = await A2AClient.fromCardUrl(options.cardUrl);
  const agentCard = await client.getAgentCard();

  if (!Array.isArray(agentCard.skills) || agentCard.skills.length === 0) {
    console.warn('[a2a2langchain] Agent card declared no skills', { cardUrl: options.cardUrl });
    return [];
  }

  return agentCard.skills.map((skill: AgentSkill) => {
    const toolSchema = buildToolSchema(skill);

    return new DynamicStructuredTool({
      name: normaliseToolName(skill),
      description: skill.description ?? skill.name ?? `A2A skill ${skill.id}`,
      schema: toolSchema,
      func: async (input) => {
        const inputRecord: Record<string, unknown> = isPlainRecord(input) ? { ...input } : {};

        const reserved: Partial<Record<ReservedInputFields, unknown>> = {};
        for (const field of RESERVED_FIELDS) {
          if (field in inputRecord) {
            reserved[field] = inputRecord[field];
            delete inputRecord[field];
          }
        }

        const metadataOverride = isPlainRecord(reserved.__metadata) ? reserved.__metadata : undefined;
        const configurationOverride = reserved.__configuration;

        const configuration = sanitizeConfiguration(undefined, configurationOverride, options.blocking ?? true);
        const metadata = deriveMetadata(options, agentCard, skill, metadataOverride);

        const params = createMessageParams(
          configuration,
          metadata,
          inputRecord,
          {
            contextId: reserved.__contextId,
            taskId: reserved.__taskId,
          },
        );

        console.debug('[a2a2langchain] sending message', {
          cardUrl: options.cardUrl,
          skillId: skill.id,
          metadata,
          configuration,
        });

        const response = await client.sendMessage(params);
        console.debug('[a2a2langchain] received message', response);
        const success = ensureSuccess(response, skill.id);

        return formatToolResult(success.result);
      },
    });
  });
}
// Align with newer LangGraph expectation by polyfilling BaseMessage#getType when absent.
const baseMessageProto = BaseMessage.prototype as BaseMessage & {
  getType?: () => ReturnType<BaseMessage['_getType']>;
};

if (typeof baseMessageProto.getType !== 'function') {
  baseMessageProto.getType = function getTypePolyfill(this: BaseMessage) {
    return this._getType();
  };
}
