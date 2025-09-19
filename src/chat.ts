export {};

interface ChatMessageEntry {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    debug?: Record<string, unknown>;
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

interface ToolInvocationRecord {
    agentId: string;
    agentName: string;
    host: string;
    origin: string;
    notes: string;
    payloadPreview: string;
    timestamp: number;
}

interface LangChainDebugSnapshot {
    enabledAgentCount: number;
    hosts: string[];
    toolIds: string[];
    tools: Array<{ id: string; name: string; host: string; origin: string }>;
    lastUpdated: number;
}

interface ChatResponsePayload {
    ok: boolean;
    history: ChatMessageEntry[];
    reply?: ChatMessageEntry;
    invocations?: ToolInvocationRecord[];
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

document.addEventListener('DOMContentLoaded', () => {
    const app = new ChatApp();
    void app.init();
});

class ChatApp {
    private historyEl: HTMLElement;
    private agentListEl: HTMLElement;
    private debugEl: HTMLElement;
    private formEl: HTMLFormElement;
    private inputEl: HTMLTextAreaElement;
    private statusEl: HTMLElement;
    private refreshButton: HTMLButtonElement;
    private clearButton: HTMLButtonElement;
    private settingsButton: HTMLButtonElement;
    private submitButton: HTMLButtonElement;
    private isSending = false;

    constructor() {
        const historyNode = document.getElementById('chat-history');
        const agentListNode = document.getElementById('agent-list');
        const debugNode = document.getElementById('agent-debug');
        const formNode = document.getElementById('chat-form');
        const inputNode = document.getElementById('chat-input');
        const statusNode = document.getElementById('chat-status');
        const refreshButton = document.getElementById('refresh-state');
        const clearButton = document.getElementById('clear-chat');
        const submitButton = document.getElementById('chat-submit');
        const settingsButton = document.getElementById('open-settings');

        if (
            !historyNode ||
            !agentListNode ||
            !debugNode ||
            !(formNode instanceof HTMLFormElement) ||
            !(inputNode instanceof HTMLTextAreaElement) ||
            !statusNode ||
            !(refreshButton instanceof HTMLButtonElement) ||
            !(clearButton instanceof HTMLButtonElement) ||
            !(submitButton instanceof HTMLButtonElement) ||
            !(settingsButton instanceof HTMLButtonElement)
        ) {
            throw new Error('Chat UI failed to initialise. Required elements missing.');
        }

        this.historyEl = historyNode;
        this.agentListEl = agentListNode;
        this.debugEl = debugNode;
        this.formEl = formNode;
        this.inputEl = inputNode;
        this.statusEl = statusNode;
        this.refreshButton = refreshButton;
        this.clearButton = clearButton;
        this.settingsButton = settingsButton;
        this.submitButton = submitButton;
    }

    async init(): Promise<void> {
        this.bindEvents();
        await this.loadState();
    }

    private bindEvents(): void {
        this.formEl.addEventListener('submit', (event) => {
            event.preventDefault();
            void this.handleSubmit();
        });

        this.refreshButton.addEventListener('click', () => {
            void this.loadState();
        });

        this.clearButton.addEventListener('click', () => {
            void this.clearChat();
        });

        this.settingsButton.addEventListener('click', () => {
            const url = chrome.runtime.getURL('settings.html');
            chrome.tabs.create({ url });
        });
    }

    private async handleSubmit(): Promise<void> {
        const text = this.inputEl.value.trim();
        if (!text || this.isSending) {
            return;
        }

        this.isSending = true;
        this.updateStatus('Sending…');
        this.setFormEnabled(false);

        try {
            const response = await sendMessage<ChatResponsePayload>('CHAT_MESSAGE', { text });
            this.renderState(response);
            this.inputEl.value = '';
            this.inputEl.focus();
        } catch (error) {
            console.error('Failed to send chat message', error);
            this.updateStatus('Failed to send message');
        } finally {
            this.isSending = false;
            this.setFormEnabled(true);
        }
    }

    private async loadState(): Promise<void> {
        this.updateStatus('Loading…');
        try {
            const state = await sendMessage<ChatStatePayload>('GET_CHAT_STATE');
            this.renderState(state);
        } catch (error) {
            console.error('Failed to load chat state', error);
            this.updateStatus('Failed to load chat state');
        }
    }

    private async clearChat(): Promise<void> {
        this.updateStatus('Clearing chat…');
        try {
            const state = await sendMessage<ChatStatePayload>('CLEAR_CHAT_HISTORY');
            this.renderState(state);
        } catch (error) {
            console.error('Failed to clear chat history', error);
            this.updateStatus('Failed to clear chat history');
        }
    }

    private renderState(state: ChatStatePayload | ChatResponsePayload): void {
        if ('error' in state && state.error && !state.ok) {
            this.updateStatus(`Agent error: ${state.error}`);
        } else {
            const enabled = Array.isArray(state.enabledAgents) ? state.enabledAgents.length : state.debug.enabledAgentCount;
            this.updateStatus(`Ready – agents enabled: ${enabled}`);
        }

        if (state.history) {
            this.renderHistory(state.history);
        }

        if (state.enabledAgents) {
            this.renderAgents(state.enabledAgents);
        }

        this.renderDebug(state.debug);
    }

    private renderHistory(history: ChatMessageEntry[]): void {
        this.historyEl.innerHTML = '';

        if (!history.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No chat messages yet. Enable an agent and send your first prompt.';
            empty.className = 'chat-history__empty';
            this.historyEl.append(empty);
            return;
        }

        history.forEach((entry) => {
            const wrapper = document.createElement('article');
            wrapper.className = `chat-message chat-message--${entry.role}`;

            const meta = document.createElement('div');
            meta.className = 'chat-message__meta';
            const roleLabel = entry.role === 'assistant' ? 'Assistant' : entry.role === 'user' ? 'You' : 'System';
            meta.innerHTML = `<span>${roleLabel}</span><span>${new Date(entry.timestamp).toLocaleTimeString()}</span>`;

            const body = document.createElement('p');
            body.className = 'chat-message__content';
            body.textContent = entry.content;

            wrapper.append(meta, body);

            if (entry.debug) {
                const debug = document.createElement('pre');
                debug.className = 'chat-message__debug';
                debug.textContent = formatJSON(entry.debug);
                wrapper.append(debug);
            }

            this.historyEl.append(wrapper);
        });

        this.historyEl.scrollTop = this.historyEl.scrollHeight;
    }

    private renderAgents(agents: EnabledAgentSummary[]): void {
        this.agentListEl.innerHTML = '';

        if (!agents.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No agents enabled yet.';
            this.agentListEl.append(empty);
            return;
        }

        agents.forEach((agent) => {
            const card = document.createElement('div');
            card.className = 'agent-list__item';

            const title = document.createElement('h3');
            title.textContent = agent.name;

            const meta = document.createElement('p');
            meta.textContent = `ID: ${agent.agentId} • Host: ${agent.host} • Source: ${agent.sourceId}`;

            const descriptorLink = document.createElement('p');
            descriptorLink.innerHTML = `<a href="${agent.descriptorUrl}" target="_blank" rel="noopener">Descriptor</a>`;

            card.append(title, meta, descriptorLink);

            if (agent.description) {
                const description = document.createElement('p');
                description.textContent = agent.description;
                card.append(description);
            }

            this.agentListEl.append(card);
        });
    }

    private renderDebug(debug: LangChainDebugSnapshot): void {
        this.debugEl.textContent = formatJSON(debug);
    }

    private updateStatus(text: string): void {
        this.statusEl.textContent = text;
    }

    private setFormEnabled(enabled: boolean): void {
        this.inputEl.disabled = !enabled;
        this.submitButton.disabled = !enabled;
    }
}

function sendMessage<TResponse>(type: string, payload?: unknown): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error(error.message));
                return;
            }
            resolve(response as TResponse);
        });
    });
}

function formatJSON(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return '[unserializable]';
    }
}
