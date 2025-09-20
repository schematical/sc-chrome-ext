export interface ServerSkillSummary {
  id: string;
  name?: string;
  description?: string;
  inputModes?: string[];
  outputModes?: string[];
}

export interface ServerAgentSummary {
  agentId: string;
  name: string;
  description?: string;
  host?: string;
  origin?: string;
  descriptorUrl?: string;
  sourceId?: string;
  skills?: ServerSkillSummary[];
}

export interface AgentToolIssue {
  agentId: string;
  reason: string;
}

export interface AgentToolExecution {
  toolName: string;
  agentId?: string;
  skillId?: string;
  taskId?: string;
  status?: string;
  raw?: unknown;
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
  toolCount?: number;
  availableToolCount?: number;
  toolErrors?: AgentToolIssue[];
  toolExecutions?: AgentToolExecution[];
  error?: string;
}
