

export interface AgentToolIssue {
  cardUrl: string;
  reason: string;
  agentId?: string;
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
  agentCardUrls?: string[];
}

export interface ChatResponseBody {
  ok: boolean;
  reply?: string;
  agentCount?: number;
  model?: string;
  provider?: string;
  toolCount?: number;
  availableToolCount?: number;
  toolExecutions?: AgentToolExecution[];
  toolErrors?: AgentToolIssue[];
  error?: string;
}
