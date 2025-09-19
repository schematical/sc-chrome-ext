export interface ServerAgentSummary {
  agentId: string;
  name: string;
  description?: string;
  host?: string;
  origin?: string;
}

export interface ChatRequestBody {
  message: string;
  agents?: unknown;
  apiKey?: string;
  model?: string;
}

export interface ChatResponseBody {
  ok: boolean;
  reply?: string;
  agentCount?: number;
  model?: string;
  provider?: string;
  error?: string;
}
