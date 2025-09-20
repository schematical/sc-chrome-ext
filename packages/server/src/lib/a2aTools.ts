import type { AgentCard } from '@a2a-js/sdk';
import nodeFetch from 'node-fetch';
import { a2a2langchain, type A2ALangChainWrapper, type A2ALogger } from 'langchain-a2a';

import type { AgentToolIssue, ServerAgentSummary, ServerSkillSummary } from './types.js';

export interface ServerLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface AgentPayloadCarrier {
  summary: ServerAgentSummary;
  payload?: unknown;
}

export interface AgentToolset {
  summaries: ServerAgentSummary[];
  wrappers: A2ALangChainWrapper[];
  cards: AgentCard[];
  issues: AgentToolIssue[];
}

export async function buildAgentToolset(
  carriers: AgentPayloadCarrier[],
  logger: ServerLogger
): Promise<AgentToolset> {
  const wrappers: A2ALangChainWrapper[] = [];
  const cards: AgentCard[] = [];
  const summaries: ServerAgentSummary[] = [];
  const issues: AgentToolIssue[] = [];

  const globalFetch = (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
  // Fallback to node-fetch for environments without a native fetch implementation.
  const fetchImpl = (globalFetch ?? (nodeFetch as unknown as typeof fetch)).bind(globalThis);

  for (const carrier of carriers) {
    const baseContext = {
      agentId: carrier.summary.agentId,
      host: carrier.summary.host,
      origin: carrier.summary.origin,
    } satisfies Record<string, unknown>;

    const cardFromPayload = typeof carrier.payload !== 'undefined' ? extractAgentCard(carrier.payload) : null;
    const cardUrl = carrier.summary.descriptorUrl;

    if (!cardUrl && !cardFromPayload) {
      issues.push({
        agentId: carrier.summary.agentId,
        reason: 'Agent payload did not include an agent card and no descriptorUrl was supplied.',
      });
      logger.warn('agent.card.unresolved', baseContext);
      summaries.push(carrier.summary);
      continue;
    }

    try {
      const wrapper = await a2a2langchain(cardFromPayload, {
        cardUrl,
        fetch: fetchImpl,
        logger: createAgentLogger(logger, carrier.summary),
        defaultMetadata: {
          agentId: carrier.summary.agentId,
          agentName: carrier.summary.name,
          host: carrier.summary.host,
          origin: carrier.summary.origin,
        },
      });

      wrappers.push(wrapper);
      cards.push(wrapper.agent);
      summaries.push(enrichSummaryWithSkills(carrier.summary, wrapper.agent.skills));
      logger.info('agent.tool.ready', baseContext);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error initialising agent tool.';
      issues.push({ agentId: carrier.summary.agentId, reason });
      logger.error('agent.tool.error', { ...baseContext, error: serialiseError(error) });
      summaries.push(carrier.summary);
    }
  }

  return {
    summaries,
    wrappers,
    cards,
    issues,
  };
}

function createAgentLogger(logger: ServerLogger, summary: ServerAgentSummary): A2ALogger {
  const context = {
    agentId: summary.agentId,
    host: summary.host,
    origin: summary.origin,
  } satisfies Record<string, unknown>;

  return {
    debug: (message, details) => logger.debug(message, mergeContext(context, details)),
    info: (message, details) => logger.info(message, mergeContext(context, details)),
    warn: (message, details) => logger.warn(message, mergeContext(context, details)),
    error: (message, details) => logger.error(message, mergeContext(context, details)),
  };
}

function mergeContext(
  base: Record<string, unknown>,
  details?: Record<string, unknown>
): Record<string, unknown> {
  return details ? { ...base, ...details } : base;
}

function enrichSummaryWithSkills(
  summary: ServerAgentSummary,
  skills: AgentCard['skills'] | undefined
): ServerAgentSummary {
  if (!skills || skills.length === 0) {
    return summary;
  }

  const normalisedSkills: ServerSkillSummary[] = skills.map((skill) => ({
    id: skill.id,
    name: skill.name ?? undefined,
    description: skill.description ?? undefined,
    inputModes: skill.inputModes ?? undefined,
    outputModes: skill.outputModes ?? undefined,
  }));

  return {
    ...summary,
    skills: normalisedSkills,
  };
}

function extractAgentCard(candidate: unknown): AgentCard | null {
  if (!candidate) {
    return null;
  }

  if (typeof candidate === 'string') {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return extractAgentCard(parsed);
    } catch (error) {
      return null;
    }
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const card = extractAgentCard(item);
      if (card) {
        return card;
      }
    }
    return null;
  }

  if (!isRecord(candidate)) {
    return null;
  }

  if (looksLikeAgentCard(candidate)) {
    return candidate as AgentCard;
  }

  const nestedKeys = ['agent', 'agentCard', 'card', 'payload'];
  for (const key of nestedKeys) {
    if (key in candidate) {
      const nested = candidate[key as keyof typeof candidate];
      const card = extractAgentCard(nested);
      if (card) {
        return card;
      }
    }
  }

  return null;
}

function looksLikeAgentCard(candidate: unknown): candidate is AgentCard {
  if (!isRecord(candidate)) {
    return false;
  }

  if (typeof candidate.url !== 'string' || !candidate.url.trim()) {
    return false;
  }

  if (!Array.isArray(candidate.skills) || candidate.skills.length === 0) {
    return false;
  }

  if (!Array.isArray(candidate.defaultInputModes) || !Array.isArray(candidate.defaultOutputModes)) {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function serialiseError(error: unknown): Record<string, unknown> {
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
