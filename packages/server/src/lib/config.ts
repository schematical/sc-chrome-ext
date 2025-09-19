import type { ServerAgentSummary } from './types.js';

const DEFAULT_PROVIDER = 'openai';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export interface ProviderModuleConfig {
  modulePath: string;
  exportName: string;
  apiKeyOption?: string;
  modelOption?: string;
}

export function resolveProvider(incoming?: string): string {
  if (incoming && incoming.trim()) {
    return incoming.trim().toLowerCase();
  }

  if (process.env.LLM_PROVIDER && process.env.LLM_PROVIDER.trim()) {
    return process.env.LLM_PROVIDER.trim().toLowerCase();
  }

  return DEFAULT_PROVIDER;
}

export function resolveApiKey(provider: string, incoming?: string): string | undefined {
  if (incoming && incoming.trim()) {
    return incoming.trim();
  }

  const providerKey = providerEnvKey(provider);
  const providerSpecific = process.env[`${providerKey}_API_KEY`];
  if (providerSpecific && providerSpecific.trim()) {
    return providerSpecific.trim();
  }

  if (process.env.LLM_API_KEY && process.env.LLM_API_KEY.trim()) {
    return process.env.LLM_API_KEY.trim();
  }

  if (provider === 'openai' && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }

  return undefined;
}

export function resolveModelName(provider: string, incoming?: string): string {
  if (incoming && incoming.trim()) {
    return incoming.trim();
  }

  const providerKey = providerEnvKey(provider);
  const providerSpecific = process.env[`${providerKey}_MODEL`];
  if (providerSpecific && providerSpecific.trim()) {
    return providerSpecific.trim();
  }

  if (process.env.LLM_MODEL && process.env.LLM_MODEL.trim()) {
    return process.env.LLM_MODEL.trim();
  }

  if (provider === 'openai' && process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim()) {
    return process.env.OPENAI_MODEL.trim();
  }

  return provider === 'openai' ? DEFAULT_OPENAI_MODEL : ''; // allow empty so provider defaults apply
}

export function resolveModuleConfig(provider: string): ProviderModuleConfig {
  if (provider === 'openai') {
    return {
      modulePath: '@langchain/openai',
      exportName: 'ChatOpenAI',
      apiKeyOption: 'openAIApiKey',
      modelOption: 'modelName'
    };
  }

  const providerKey = providerEnvKey(provider);
  const modulePath =
    process.env.LLM_PROVIDER_MODULE ?? process.env[`${providerKey}_MODULE`];
  const exportName =
    process.env.LLM_PROVIDER_EXPORT ?? process.env[`${providerKey}_EXPORT`];
  const apiKeyOption =
    process.env.LLM_PROVIDER_API_KEY_OPTION ?? process.env[`${providerKey}_API_KEY_OPTION`];
  const modelOption =
    process.env.LLM_PROVIDER_MODEL_OPTION ?? process.env[`${providerKey}_MODEL_OPTION`];

  if (!modulePath || !exportName) {
    throw new Error(
      `Unsupported provider "${provider}". Set environment variables LLM_PROVIDER_MODULE and LLM_PROVIDER_EXPORT (or ${providerKey}_MODULE/${providerKey}_EXPORT).`
    );
  }

  return {
    modulePath,
    exportName,
    apiKeyOption,
    modelOption
  };
}

export function buildAgentSummary(agents: ServerAgentSummary[]): string {
  if (!agents.length) {
    return 'None available.';
  }

  return agents
    .map((agent) => {
      const parts = [`${agent.name} (id: ${agent.agentId})`];
      if (agent.host) {
        parts.push(`host: ${agent.host}`);
      }
      if (agent.origin) {
        parts.push(`origin: ${agent.origin}`);
      }
      if (agent.description) {
        parts.push(`summary: ${agent.description}`);
      }
      return `• ${parts.join(' | ')}`;
    })
    .join('\n');
}

function providerEnvKey(provider: string): string {
  return provider
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');
}
