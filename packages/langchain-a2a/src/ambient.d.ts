declare module 'a2a-js' {
  export interface AgentCapabilityExtensions {
    [key: string]: unknown;
  }

  export interface AgentCapabilities {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
    extensions?: AgentCapabilityExtensions[];
  }

  export interface AgentProvider {
    organization?: string;
    url?: string;
    [key: string]: unknown;
  }

  export interface AgentSkill {
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples?: string[];
    inputModes?: string[];
    outputModes?: string[];
    security?: AgentSecurityRequirement[];
    [key: string]: unknown;
  }

  export interface AgentSecurityRequirement {
    [scheme: string]: string[];
  }

  export interface AgentCard {
    protocolVersion?: string;
    name: string;
    description: string;
    url: string;
    preferredTransport?: string;
    additionalInterfaces?: AgentInterface[];
    iconUrl?: string;
    provider?: AgentProvider;
    version: string;
    documentationUrl?: string;
    capabilities: AgentCapabilities;
    securitySchemes?: Record<string, unknown>;
    security?: AgentSecurityRequirement[];
    defaultInputModes: string[];
    defaultOutputModes: string[];
    skills: AgentSkill[];
    supportsAuthenticatedExtendedCard?: boolean;
    signatures?: AgentCardSignature[];
    [key: string]: unknown;
  }

  export interface AgentInterface {
    url: string;
    transport: string;
    [key: string]: unknown;
  }

  export interface AgentCardSignature {
    [key: string]: unknown;
  }

  export interface SendTaskMessagePart {
    type?: string;
    mimeType?: string;
    text?: string;
    data?: unknown;
    [key: string]: unknown;
  }

  export interface SendTaskMessage {
    role: string;
    parts: SendTaskMessagePart[];
    [key: string]: unknown;
  }

  export interface SendTaskParams {
    id: string;
    message: SendTaskMessage;
    metadata?: Record<string, unknown>;
    historyLength?: number;
    pushNotificationConfig?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface TaskArtifactPart {
    type?: string;
    mimeType?: string;
    text?: string;
    data?: unknown;
    [key: string]: unknown;
  }

  export interface TaskArtifact {
    id: string;
    role: string;
    parts: TaskArtifactPart[];
    [key: string]: unknown;
  }

  export type TaskStatus =
    | 'submitted'
    | 'working'
    | 'input_required'
    | 'completed'
    | 'canceled'
    | 'failed';

  export interface TaskResult {
    id: string;
    status: TaskStatus;
    result?: TaskArtifact;
    error?: unknown;
    [key: string]: unknown;
  }

  export interface TaskStreamEvent {
    type: string;
    task: TaskResult;
    [key: string]: unknown;
  }

  export interface A2AClientOptions {
    fetch?: typeof fetch;
    authToken?: string;
    headers?: Record<string, string>;
    logger?: {
      debug?: (message: string, context?: Record<string, unknown>) => void;
      info?: (message: string, context?: Record<string, unknown>) => void;
      warn?: (message: string, context?: Record<string, unknown>) => void;
      error?: (message: string, context?: Record<string, unknown>) => void;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }

  export class A2AClient {
    constructor(baseUrl: string, options?: A2AClientOptions);
    sendTask(params: SendTaskParams): Promise<TaskResult>;
    sendTaskSubscribe?(params: SendTaskParams): AsyncIterable<TaskStreamEvent>;
  }
}
