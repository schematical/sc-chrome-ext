export {};

interface AgentDescriptorMessage {
    id: string;
    label: string;
    url: string;
    preview: string;
    data?: {
        rawText?: string;
        json?: unknown;
    };
}

interface BackgroundAgent {
    agentId: string;
    name: string;
    description?: string;
    sourceId: string;
    descriptorUrl: string;
    payload: unknown;
}

type AgentToggleState = Record<string, boolean>;

type AgentToggleStore = Record<string, AgentToggleState>;

interface HostRegistryEntry {
    origin: string;
    descriptors: AgentDescriptorMessage[];
    agents: BackgroundAgent[];
    toggles: AgentToggleState;
}

interface EnabledAgentSummary {
    host: string;
    origin: string;
    agentId: string;
    name: string;
    description?: string;
    sourceId: string;
    descriptorUrl: string;
    payload: unknown;
}

type HostRegistry = Record<string, HostRegistryEntry>;

type ChatMessageRole = 'user' | 'assistant' | 'system';

interface ChatMessageEntry {
    id: string;
    role: ChatMessageRole;
    content: string;
    timestamp: number;
    debug?: Record<string, unknown>;
}

interface ChatSettings {
    serverUrl?: string;
}

interface SettingsPayload {
    ok: boolean;
    settings: ChatSettings;
}

interface SettingsUpdatePayload {
    ok: boolean;
    settings: ChatSettings;
    error?: string;
}

interface ChatResponsePayload {
    ok: boolean;
    history: ChatMessageEntry[];
    reply?: ChatMessageEntry;
    debug: LangChainDebugSnapshot;
    enabledAgents: EnabledAgentSummary[];
    error?: string;
}

interface ChatStatePayload {
    ok: boolean;
    history: ChatMessageEntry[];
    enabledAgents: EnabledAgentSummary[];
    debug: LangChainDebugSnapshot;
}

interface LangChainToolDebug {
    id: string;
    name: string;
    host: string;
    origin: string;
}

interface LangChainDebugSnapshot {
    enabledAgentCount: number;
    hosts: string[];
    toolIds: string[];
    tools: LangChainToolDebug[];
    lastUpdated: number;
}

class LangChainManager {
    private enabledAgents: EnabledAgentSummary[] = [];
    private lastUpdated = Date.now();

    updateEnabledAgents(agents: EnabledAgentSummary[]): void {
        this.enabledAgents = agents.slice();
        this.lastUpdated = Date.now();
    }

    getEnabledAgents(host?: string): EnabledAgentSummary[] {
        if (host) {
            return this.enabledAgents.filter((agent) => agent.host === host);
        }
        return this.enabledAgents.slice();
    }

    getDebugSnapshot(): LangChainDebugSnapshot {
        const toolsDebug: LangChainToolDebug[] = this.enabledAgents.map((agent) => ({
            id: agent.agentId,
            name: agent.name,
            host: agent.host,
            origin: agent.origin
        }));
        return {
            enabledAgentCount: this.enabledAgents.length,
            hosts: Array.from(new Set(this.enabledAgents.map((agent) => agent.host))).sort(),
            toolIds: toolsDebug.map((tool) => tool.id),
            tools: toolsDebug,
            lastUpdated: this.lastUpdated
        };
    }

    async handleUserMessage(message: string, settings: ChatSettings): Promise<string> {
        try {
            const reply = await callAgentServer(message, this.enabledAgents, settings);
            return reply;
        } catch (error) {
            console.debug('[Schematical] agent server error', error);
            throw error;
        }
    }
}

const registry: HostRegistry = {};
const langChainManager = new LangChainManager();
const chatHistory: ChatMessageEntry[] = [];
const CHAT_HISTORY_LIMIT = 100;
const SETTINGS_STORAGE_KEY = 'schematicalAgentSettings';
const REGISTRY_STORAGE_KEY = 'schematicalAgentRegistry';
const CHAT_HISTORY_STORAGE_KEY = 'schematicalAgentChatHistory';
let chatSettings: ChatSettings = {
    serverUrl: 'http://localhost:4000'
};

void bootstrapSettings();
void bootstrapRegistry();
void bootstrapChatHistory();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRecord(message) || typeof message.type !== 'string') {
        return;
    }

    const { type, payload } = message as { type: string; payload?: unknown };

    switch (type) {
        case 'AGENT_DISCOVERY_UPDATE':
            handleDiscoveryUpdate(payload);
            break;
        case 'AGENT_TOGGLE_UPDATE':
            handleToggleUpdate(payload);
            break;
        case 'GET_ENABLED_AGENTS': {
            const host = isRecord(payload) && typeof payload.host === 'string' ? payload.host : undefined;
            sendResponse?.({ ok: true, agents: langChainManager.getEnabledAgents(host) });
            break;
        }
        case 'GET_CHAT_STATE':
            sendResponse?.(getChatStatePayload());
            break;
        case 'CLEAR_CHAT_HISTORY':
            clearChatHistory();
            sendResponse?.(getChatStatePayload());
            break;
        case 'CHAT_MESSAGE':
            handleChatMessage(payload)
                .then((response) => sendResponse?.(response))
                .catch((error) => {
                    const messageText = error instanceof Error ? error.message : 'Unknown agent error';
                    sendResponse?.({
                        ok: false,
                        history: cloneChatHistory(),
                        debug: langChainManager.getDebugSnapshot(),
                        enabledAgents: langChainManager.getEnabledAgents(),
                        error: messageText
                    } satisfies ChatResponsePayload);
                });
            return true; // Keep the message channel open for async reply.
        case 'GET_SETTINGS':
            sendResponse?.({ ok: true, settings: chatSettings } satisfies SettingsPayload);
            break;
        case 'UPDATE_SETTINGS':
            handleSettingsUpdate(payload)
                .then((result) => sendResponse?.(result))
                .catch((error) => {
                    const messageText = error instanceof Error ? error.message : 'Unknown settings error';
                    sendResponse?.({ ok: false, settings: chatSettings, error: messageText } satisfies SettingsUpdatePayload);
                });
            return true;
        default:
            break;
    }

    return undefined;
});

function handleDiscoveryUpdate(payload: unknown): void {
    if (!isRecord(payload)) {
        return;
    }

    const host = typeof payload.host === 'string' ? payload.host : null;
    if (!host) {
        return;
    }

    const origin = typeof payload.origin === 'string' ? payload.origin : '';
    const descriptors = sanitizeDescriptors(payload.descriptors);
    const agents = sanitizeAgents(payload.agents);
    const toggles = normalizeToggleState(payload.toggles);

    registry[host] = {
        origin,
        descriptors,
        agents,
        toggles
    };

    refreshLangChainState();
}

function handleToggleUpdate(payload: unknown): void {
    if (!isRecord(payload)) {
        return;
    }

    const host = typeof payload.host === 'string' ? payload.host : null;
    if (!host) {
        return;
    }

    const entry = registry[host];
    if (!entry) {
        const origin = typeof payload.origin === 'string' ? payload.origin : '';
        const agent = sanitizeAgent(payload.agent);
        registry[host] = {
            origin,
            descriptors: [],
            agents: agent ? [agent] : [],
            toggles: normalizeToggleState(payload.toggles)
        };
        refreshLangChainState();
        return;
    }

    const agent = sanitizeAgent(payload.agent);
    if (agent) {
        const existingIndex = entry.agents.findIndex((item) => item.agentId === agent.agentId);
        if (existingIndex >= 0) {
            entry.agents[existingIndex] = agent;
        } else {
            entry.agents.push(agent);
        }
    }

    entry.toggles = normalizeToggleState(payload.toggles, entry.toggles);
    refreshLangChainState();
}

function refreshLangChainState(): void {
    const enabledAgents = getEnabledAgentsFromRegistry(null);
    langChainManager.updateEnabledAgents(enabledAgents);
    void persistRegistry();
}

function handleChatMessage(payload: unknown): Promise<ChatResponsePayload> {
    const text = extractChatText(payload);
    if (!text) {
        return Promise.resolve({
            ok: false,
            history: cloneChatHistory(),
            enabledAgents: langChainManager.getEnabledAgents(),
            debug: langChainManager.getDebugSnapshot(),
            error: 'Message text is required.'
        });
    }

    if (!chatSettings.serverUrl) {
        const systemEntry = addChatMessage('system', 'Configure the agent server URL in settings before chatting.');
        return Promise.resolve({
            ok: false,
            history: cloneChatHistory(),
            reply: systemEntry,
            enabledAgents: langChainManager.getEnabledAgents(),
            debug: langChainManager.getDebugSnapshot(),
            error: 'Missing agent server URL.'
        });
    }

    addChatMessage('user', text);

    return langChainManager
        .handleUserMessage(text, chatSettings)
        .then((replyText) => {
            const assistantEntry = addChatMessage('assistant', replyText);

            return {
                ok: true,
                history: cloneChatHistory(),
                reply: assistantEntry,
                enabledAgents: langChainManager.getEnabledAgents(),
                debug: langChainManager.getDebugSnapshot()
            } satisfies ChatResponsePayload;
        })
        .catch((error) => {
            const messageText = error instanceof Error ? error.message : 'Unknown agent error';
            const systemEntry = addChatMessage('system', `Agent error: ${messageText}`);

            return {
                ok: false,
                history: cloneChatHistory(),
                reply: systemEntry,
                enabledAgents: langChainManager.getEnabledAgents(),
                debug: langChainManager.getDebugSnapshot(),
                error: messageText
            } satisfies ChatResponsePayload;
        });
}

function getChatStatePayload(): ChatStatePayload {
    return {
        ok: true,
        history: cloneChatHistory(),
        enabledAgents: langChainManager.getEnabledAgents(),
        debug: langChainManager.getDebugSnapshot()
    };
}

async function bootstrapSettings(): Promise<void> {
    try {
        const storage = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
        const stored = storage[SETTINGS_STORAGE_KEY] as ChatSettings | undefined;
        if (stored) {
            chatSettings = {
                serverUrl:
                    typeof stored.serverUrl === 'string' && stored.serverUrl.trim()
                        ? stored.serverUrl.trim()
                        : chatSettings.serverUrl
            };
        }
    } catch (error) {
        console.debug('[Schematical] failed to bootstrap settings', error);
    }
}

async function bootstrapRegistry(): Promise<void> {
    try {
        const storage = await chrome.storage.local.get(REGISTRY_STORAGE_KEY);
        const stored = storage[REGISTRY_STORAGE_KEY] as HostRegistry | undefined;
        if (stored && typeof stored === 'object') {
            Object.keys(registry).forEach((key) => delete registry[key]);
            Object.entries(stored).forEach(([host, entry]) => {
                if (entry && typeof entry === 'object') {
                    registry[host] = {
                        origin: entry.origin ?? '',
                        descriptors: Array.isArray(entry.descriptors) ? entry.descriptors : [],
                        agents: Array.isArray(entry.agents) ? entry.agents : [],
                        toggles: normalizeToggleState(entry.toggles)
                    };
                }
            });
            refreshLangChainState();
        }
    } catch (error) {
        console.debug('[Schematical] failed to bootstrap registry', error);
    }
}

async function persistRegistry(): Promise<void> {
    try {
        await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: registry });
    } catch (error) {
        console.debug('[Schematical] failed to persist registry', error);
    }
}

async function bootstrapChatHistory(): Promise<void> {
    try {
        const storage = await chrome.storage.local.get(CHAT_HISTORY_STORAGE_KEY);
        const stored = storage[CHAT_HISTORY_STORAGE_KEY];
        if (Array.isArray(stored)) {
            chatHistory.length = 0;
            stored.forEach((entry) => {
                const sanitized = sanitizeChatEntry(entry);
                if (sanitized) {
                    chatHistory.push(sanitized);
                }
            });
            if (chatHistory.length > CHAT_HISTORY_LIMIT) {
                chatHistory.splice(0, chatHistory.length - CHAT_HISTORY_LIMIT);
            }
        }
    } catch (error) {
        console.debug('[Schematical] failed to bootstrap chat history', error);
    }
}

async function persistChatHistory(): Promise<void> {
    try {
        await chrome.storage.local.set({ [CHAT_HISTORY_STORAGE_KEY]: chatHistory });
    } catch (error) {
        console.debug('[Schematical] failed to persist chat history', error);
    }
}

async function handleSettingsUpdate(payload: unknown): Promise<SettingsUpdatePayload> {
    if (!isRecord(payload) || !isRecord(payload.settings)) {
        throw new Error('Invalid settings payload.');
    }

    const incoming = payload.settings as Record<string, unknown>;
    const updated: ChatSettings = {
        serverUrl:
            typeof incoming.serverUrl === 'string' && incoming.serverUrl.trim()
                ? incoming.serverUrl.trim()
                : chatSettings.serverUrl
    };

    if (!updated.serverUrl) {
        throw new Error('Agent server URL is required.');
    }

    try {
        // Validate URL format
        new URL(updated.serverUrl);
    } catch (error) {
        throw new Error('Invalid agent server URL.');
    }

    chatSettings = updated;
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: chatSettings });

    return { ok: true, settings: chatSettings } satisfies SettingsUpdatePayload;
}

function clearChatHistory(): void {
    chatHistory.length = 0;
    void persistChatHistory();
}

async function callAgentServer(
    message: string,
    agents: EnabledAgentSummary[],
    settings: ChatSettings
): Promise<string> {
    if (!settings.serverUrl) {
        throw new Error('Agent server URL is not configured.');
    }

    let endpoint: URL;
    try {
        endpoint = new URL(settings.serverUrl);
        if (endpoint.pathname === '/' || endpoint.pathname === '') {
            endpoint.pathname = '/chat';
        }
    } catch (error) {
        throw new Error('Invalid agent server URL.');
    }

    const response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            agents
        })
    });

    if (!response.ok) {
        const errorBody = await safeReadError(response);
        throw new Error(`Agent server request failed (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as AgentServerResponse;
    if (!payload.ok || typeof payload.reply !== 'string') {
        throw new Error(payload.error ?? 'Agent server returned an invalid response.');
    }

    return payload.reply;
}

function getEnabledAgentsFromRegistry(filter: unknown): EnabledAgentSummary[] {
    const hostFilter = isRecord(filter) && typeof filter.host === 'string' ? filter.host : null;
    const entries = hostFilter ? { [hostFilter]: registry[hostFilter] } : registry;

    const enabledAgents: EnabledAgentSummary[] = [];

    Object.entries(entries).forEach(([host, entry]) => {
        if (!entry) {
            return;
        }

        const hostEnabled = entry.agents.filter((agent) => entry.toggles[agent.agentId]);
        hostEnabled.forEach((agent) => {
            enabledAgents.push({
                host,
                origin: entry.origin,
                agentId: agent.agentId,
                name: agent.name,
                description: agent.description,
                sourceId: agent.sourceId,
                descriptorUrl: agent.descriptorUrl,
                payload: agent.payload
            });
        });
    });

    return enabledAgents;
}

function sanitizeDescriptors(value: unknown): AgentDescriptorMessage[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const descriptors: AgentDescriptorMessage[] = [];

    value.forEach((item) => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.url !== 'string') {
            return;
        }

        let data: AgentDescriptorMessage['data'];
        if (isRecord(item.data)) {
            const rawText = typeof item.data.rawText === 'string' ? item.data.rawText : undefined;
            const json = Object.prototype.hasOwnProperty.call(item.data, 'json')
                ? (item.data as Record<string, unknown>).json
                : undefined;

            if (rawText !== undefined || json !== undefined) {
                data = { rawText, json };
            }
        }

        descriptors.push({
            id: item.id,
            label: typeof item.label === 'string' ? item.label : item.id,
            url: item.url,
            preview: typeof item.preview === 'string' ? item.preview : '',
            data
        });
    });

    return descriptors;
}

function sanitizeAgents(value: unknown): BackgroundAgent[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const agents: BackgroundAgent[] = [];
    value.forEach((item) => {
        const agent = sanitizeAgent(item);
        if (agent) {
            agents.push(agent);
        }
    });

    return agents;
}

function sanitizeAgent(value: unknown): BackgroundAgent | null {
    if (!isRecord(value) || typeof value.agentId !== 'string') {
        return null;
    }

    return {
        agentId: value.agentId,
        name: typeof value.name === 'string' ? value.name : value.agentId,
        description: typeof value.description === 'string' ? value.description : undefined,
        sourceId: typeof value.sourceId === 'string' ? value.sourceId : 'unknown',
        descriptorUrl: typeof value.descriptorUrl === 'string' ? value.descriptorUrl : '',
        payload: 'payload' in value ? value.payload : null
    };
}

function normalizeToggleState(value: unknown, fallback: AgentToggleState = {}): AgentToggleState {
    if (!isRecord(value)) {
        return { ...fallback };
    }

    const toggles: AgentToggleState = {};
    Object.entries(value).forEach(([key, toggleValue]) => {
        toggles[key] = toggleValue === true;
    });

    return toggles;
}

function addChatMessage(role: ChatMessageRole, content: string, debug?: Record<string, unknown>): ChatMessageEntry {
    const entry: ChatMessageEntry = {
        id: createMessageId(),
        role,
        content,
        timestamp: Date.now(),
        debug
    };

    chatHistory.push(entry);
    if (chatHistory.length > CHAT_HISTORY_LIMIT) {
        chatHistory.splice(0, chatHistory.length - CHAT_HISTORY_LIMIT);
    }

    void persistChatHistory();

    return entry;
}

function cloneChatHistory(): ChatMessageEntry[] {
    return chatHistory.map((entry) => ({
        id: entry.id,
        role: entry.role,
        content: entry.content,
        timestamp: entry.timestamp,
        debug: entry.debug ? JSON.parse(JSON.stringify(entry.debug)) : undefined
    }));
}

function sanitizeChatEntry(entry: unknown): ChatMessageEntry | null {
    if (!isRecord(entry)) {
        return null;
    }

    const role = entry.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return null;
    }

    if (typeof entry.content !== 'string') {
        return null;
    }

    const sanitized: ChatMessageEntry = {
        id: typeof entry.id === 'string' ? entry.id : createMessageId(),
        role,
        content: entry.content,
        timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now()
    };

    if (isRecord(entry.debug)) {
        sanitized.debug = JSON.parse(JSON.stringify(entry.debug));
    }

    return sanitized;
}

function extractChatText(payload: unknown): string {
    if (!isRecord(payload)) {
        return '';
    }

    const raw = typeof payload.text === 'string' ? payload.text : '';
    return raw.trim();
}

function createMessageId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatPayloadPreview(payload: unknown): string {
    if (payload === null || payload === undefined) {
        return 'null';
    }

    if (typeof payload === 'string') {
        return payload.slice(0, 280);
    }

    try {
        const serialised = JSON.stringify(payload, null, 2);
        return serialised.length > 280 ? `${serialised.slice(0, 277)}...` : serialised;
    } catch (error) {
        return '[unserializable payload]';
    }
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
}

async function safeReadError(response: Response): Promise<string> {
    try {
        const text = await response.text();
        return text.slice(0, 240);
    } catch (error) {
        return '[unable to read error body]';
    }
}

interface AgentServerResponse {
    ok: boolean;
    reply?: string;
    error?: string;
    [key: string]: unknown;
}
