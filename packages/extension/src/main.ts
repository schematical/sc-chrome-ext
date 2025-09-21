import $ from 'jquery';

interface AgentEndpoint {
    id: string;
    path: string;
    label: string;
    expectsJson: boolean;
}

interface AgentDiscoveryResult {
    id: string;
    label: string;
    url: string;
    preview: string;
    data: AgentDescriptorData;
}

interface AgentDescriptorData {
    rawText?: string;
    json?: unknown;
}

interface DiscoveredAgent {
    agentId: string;
    name: string;
    description?: string;
    sourceId: string;
    descriptorUrl: string;
    payload: unknown;
}

interface AgentDiscoveryCacheEntry {
    checkedAt: number;
    descriptors: AgentDiscoveryResult[];
    agents: DiscoveredAgent[];
}

type AgentDiscoveryCache = Record<string, AgentDiscoveryCacheEntry>;

type AgentToggleState = Record<string, boolean>;
type AgentToggleStore = Record<string, AgentToggleState>;

class AgentDiscovery {
    private readonly endpoints: AgentEndpoint[] = [
        { id: 'llms', path: '/llms.txt', label: 'llms.txt', expectsJson: false },
        { id: 'agentJson', path: '/.well-known/agent.json', label: 'agent.json', expectsJson: true },
        { id: 'agentCard', path: '/.well-known/agent-card.json', label: 'agent-card.json', expectsJson: true },
        { id: 'a2aAgents', path: '/.well-known/a2a-agents', label: 'a2a-agents', expectsJson: true },
        { id: 'utcp', path: '/utcp', label: 'utcp', expectsJson: true }
    ];

    private readonly cacheKey = 'schematicalAgentCache';
    private readonly toggleStorageKey = 'schematicalAgentToggles';
    private readonly ttlMs = 24 * 60 * 60 * 1000;
    private hasRendered = false;

    private isScanning = false;
    private forceOpenOnNextRender = false;
    private currentHostKey: string | null = null;
    private currentOrigin: string | null = null;
    private currentAgents: DiscoveredAgent[] = [];
    private currentToggleState: AgentToggleState = {};

    public async run(options: { force?: boolean } = {}): Promise<void> {
        const { force = false } = options;

        if (this.hasRendered && !force) {
            return;
        }

        const hostKey = window.location.hostname;
        if (!hostKey) {
            return;
        }

        this.currentHostKey = hostKey;

        const origin = window.location.origin;
        if (!origin || origin === 'null') {
            return;
        }

        this.currentOrigin = origin;

        const cachedResults = force ? null : await this.loadCachedResults(hostKey);
        if (cachedResults !== null) {
            this.hasRendered = true;
            this.injectStyles();
            const cachedAgents = cachedResults.agents ?? [];
            this.currentAgents = cachedAgents;
            await this.syncToggleState(hostKey, cachedAgents);
            this.renderFooter(cachedResults.descriptors ?? [], cachedAgents);
            void this.notifyBackground(hostKey, origin, cachedResults.descriptors ?? [], cachedAgents, this.currentToggleState);
            return;
        }

        const results = (await Promise.all(this.endpoints.map((endpoint) => this.fetchEndpoint(origin, endpoint)))).filter(
            (value): value is AgentDiscoveryResult => Boolean(value)
        );

        const agents = this.deriveAgents(results);
        this.currentAgents = agents;

        await this.syncToggleState(hostKey, agents);
        await this.saveResults(hostKey, results, agents);

        this.hasRendered = true;
        this.injectStyles();
        this.renderFooter(results, agents);
        void this.notifyBackground(hostKey, origin, results, agents, this.currentToggleState);
    }

    private async loadCachedResults(hostKey: string): Promise<AgentDiscoveryCacheEntry | null> {
        try {
            const storage = await chrome.storage.local.get(this.cacheKey);
            const cache: AgentDiscoveryCache = storage[this.cacheKey] ?? {};
            const entry = cache[hostKey];

            if (!entry) {
                return null;
            }

            const isExpired = Date.now() - entry.checkedAt > this.ttlMs;
            if (isExpired) {
                delete cache[hostKey];
                await chrome.storage.local.set({ [this.cacheKey]: cache });
                return null;
            }

            return entry;
        } catch (error) {
            console.debug('[Schematical] unable to read agent cache', error);
            return null;
        }
    }

    private async saveResults(hostKey: string, descriptors: AgentDiscoveryResult[], agents: DiscoveredAgent[]): Promise<void> {
        try {
            const storage = await chrome.storage.local.get(this.cacheKey);
            const cache: AgentDiscoveryCache = storage[this.cacheKey] ?? {};

            cache[hostKey] = {
                checkedAt: Date.now(),
                descriptors,
                agents
            };

            await chrome.storage.local.set({ [this.cacheKey]: cache });
        } catch (error) {
            console.debug('[Schematical] unable to write agent cache', error);
        }
    }

    private async fetchEndpoint(origin: string, endpoint: AgentEndpoint): Promise<AgentDiscoveryResult | null> {
        const url = `${origin}${endpoint.path}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': endpoint.expectsJson ? 'application/json, text/plain;q=0.9, */*;q=0.8' : 'text/plain, */*;q=0.5'
                },
                credentials: 'omit'
            });

            if (!response.ok) {
                return null;
            }

            const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
            if (contentType.includes('text/html')) {
                return null;
            }

            let preview: string;
            const data: AgentDescriptorData = {};
            if (endpoint.expectsJson) {
                try {
                    const json = await response.json();
                    preview = this.formatJsonPreview(json);
                    data.json = json;
                    data.rawText = JSON.stringify(json);
                } catch (jsonError) {
                    const text = await response.text();
                    if (this.looksLikeHtml(text)) {
                        return null;
                    }
                    preview = this.buildPreview(text);
                    data.rawText = text;
                }
            } else {
                const text = await response.text();
                if (this.looksLikeHtml(text)) {
                    return null;
                }
                preview = this.buildPreview(text);
                data.rawText = text;
            }

            return {
                id: endpoint.id,
                label: endpoint.label,
                url,
                preview,
                data
            };
        } catch (error) {
            console.debug('[Schematical] Unable to read agent descriptor', { endpoint: endpoint.path, error });
            return null;
        }
    }

    private deriveAgents(descriptors: AgentDiscoveryResult[]): DiscoveredAgent[] {
        const agents: DiscoveredAgent[] = [];

        descriptors.forEach((descriptor) => {
            const sourceId = descriptor.id;
            const payload = descriptor.data.json;

            if (!payload || typeof payload !== 'object') {
                return;
            }

            const container = payload as Record<string, unknown>;

            const agentCollection = Array.isArray(container.agents)
                ? (container.agents as Array<unknown>)
                : undefined;
            if (agentCollection) {
               agentCollection.forEach((entry, index) => {
                    if (!entry || typeof entry !== 'object') {
                        return;
                    }

                    const agentRecord = entry as Record<string, unknown>;
                    const agentId = this.normaliseAgentId(agentRecord['id'], `${sourceId}-${index}`);
                    const descriptorUrl = typeof agentRecord['url'] === 'string' ? (agentRecord['url'] as string) : descriptor.url;
                    agents.push({
                        agentId,
                        name: this.resolveAgentName(agentRecord, agentId),
                        description: this.resolveAgentDescription(agentRecord),
                        sourceId,
                        descriptorUrl,
                        payload: agentRecord
                    });
                });
                return;
            }

            const skillCollection = Array.isArray(container.skills)
                ? (container.skills as Array<unknown>)
                : undefined;
            if (skillCollection) {
                skillCollection.forEach((entry, index) => {
                    if (!entry || typeof entry !== 'object') {
                        return;
                    }

                    const skillRecord = entry as Record<string, unknown>;
                    const agentId = this.normaliseAgentId(skillRecord['id'], `${sourceId}-skill-${index}`);
                    agents.push({
                        agentId,
                        name: this.resolveAgentName(skillRecord, agentId),
                        description: this.resolveAgentDescription(skillRecord),
                        sourceId,
                        descriptorUrl: descriptor.url,
                        payload: skillRecord
                    });
                });
                return;
            }

            const singleAgentCandidate = payload as Record<string, unknown>;
            if (singleAgentCandidate && (typeof singleAgentCandidate.id === 'string' || typeof singleAgentCandidate.name === 'string')) {
                const agentId = this.normaliseAgentId(singleAgentCandidate['id'], `${sourceId}-primary`);
                const descriptorUrl = typeof singleAgentCandidate.url === 'string' ? (singleAgentCandidate.url as string) : descriptor.url;

                agents.push({
                    agentId,
                    name: this.resolveAgentName(singleAgentCandidate, agentId),
                    description: this.resolveAgentDescription(singleAgentCandidate),
                    sourceId,
                    descriptorUrl,
                    payload: singleAgentCandidate
                });
            }
        });

        return agents;
    }

    private normaliseAgentId(candidate: unknown, fallback: string): string {
        return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : fallback;
    }

    private resolveAgentName(agent: Record<string, unknown>, fallback: string): string {
        const name = agent['name'];
        if (typeof name === 'string' && name.trim()) {
            return name.trim();
        }
        const title = agent['title'];
        if (typeof title === 'string' && title.trim()) {
            return title.trim();
        }
        return fallback;
    }

    private resolveAgentDescription(agent: Record<string, unknown>): string | undefined {
        const description = agent['description'];
        if (typeof description === 'string' && description.trim()) {
            return description.trim();
        }
        const summary = agent['summary'];
        if (typeof summary === 'string' && summary.trim()) {
            return summary.trim();
        }
        return undefined;
    }

    private async notifyBackground(
        hostKey: string,
        origin: string,
        descriptors: AgentDiscoveryResult[],
        agents: DiscoveredAgent[],
        toggles: AgentToggleState
    ): Promise<void> {
        try {
            await chrome.runtime.sendMessage({
                type: 'AGENT_DISCOVERY_UPDATE',
                payload: {
                    host: hostKey,
                    origin,
                    descriptors,
                    agents,
                    toggles
                }
            });
        } catch (error) {
            // Service worker might be sleeping; log softly.
            console.debug('[Schematical] background update failed', error);
        }
    }

    private buildPreview(raw: string): string {
        const trimmed = raw.trim();
        if (!trimmed) {
            return '[empty file]';
        }

        const lines = trimmed.split(/\r?\n/).slice(0, 8);
        const preview = lines.join('\n');
        return lines.length >= 8 ? `${preview}\n…` : preview;
    }

    private formatJsonPreview(payload: unknown): string {
        try {
            const jsonString = JSON.stringify(payload, null, 2);
            return this.buildPreview(jsonString);
        } catch (error) {
            return '[invalid JSON payload]';
        }
    }

    private looksLikeHtml(raw: string): boolean {
        const trimmed = raw.trim();
        if (!trimmed) {
            return false;
        }

        return (
            /<\s*html/i.test(trimmed) ||
            /<head[\s>]/i.test(trimmed) ||
            /<body[\s>]/i.test(trimmed)
        );
    }

    private injectStyles(): void {
        if (document.getElementById('schematical-agent-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'schematical-agent-style';
        style.textContent = `
            .schematical-agent-footer {
                position: fixed;
                bottom: 16px;
                right: 16px;
                z-index: 2147483647;
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #0f172a;
                background: rgba(255, 255, 255, 0.95);
                border: 1px solid rgba(15, 23, 42, 0.15);
                border-radius: 8px;
                box-shadow: 0 6px 16px rgba(15, 23, 42, 0.15);
                min-width: 240px;
                max-width: 360px;
                overflow: hidden;
            }
            .schematical-agent-footer__toggle {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 10px 14px;
                background: rgba(15, 23, 42, 0.05);
                border: none;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
            }
            .schematical-agent-footer__toggle:hover {
                background: rgba(15, 23, 42, 0.1);
            }
            .schematical-agent-footer__arrow {
                transition: transform 120ms ease;
            }
            .schematical-agent-footer--open .schematical-agent-footer__arrow {
                transform: rotate(180deg);
            }
            .schematical-agent-footer__body {
                display: none;
                max-height: 320px;
                overflow-y: auto;
                padding: 12px 14px 14px;
                background: #ffffff;
            }
            .schematical-agent-footer--open .schematical-agent-footer__body {
                display: block;
            }
            .schematical-agent-footer__actions {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 12px;
            }
            .schematical-agent-footer__scanBtn {
                background: #2563eb;
                border: none;
                border-radius: 999px;
                color: #ffffff;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                padding: 6px 12px;
                transition: background 120ms ease;
            }
            .schematical-agent-footer__scanBtn[disabled] {
                opacity: 0.6;
                cursor: default;
            }
            .schematical-agent-footer__scanBtn:not([disabled]):hover {
                background: #1d4ed8;
            }
            .schematical-agent-footer__agents {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
            }
            .schematical-agent-footer__agentItem {
                border: 1px solid rgba(15, 23, 42, 0.08);
                border-radius: 8px;
                padding: 10px 12px;
                background: rgba(241, 245, 249, 0.65);
            }
            .schematical-agent-footer__agentHeader {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 6px;
            }
            .schematical-agent-footer__agentName {
                font-size: 13px;
                font-weight: 600;
                color: #0f172a;
            }
            .schematical-agent-footer__agentToggle {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: #0f172a;
                cursor: pointer;
            }
            .schematical-agent-footer__agentToggle input {
                accent-color: #2563eb;
                cursor: pointer;
            }
            .schematical-agent-footer__agentToggleLabel {
                font-weight: 500;
            }
            .schematical-agent-footer__agentDescription {
                font-size: 12px;
                margin: 0 0 4px;
                color: #1f2937;
            }
            .schematical-agent-footer__agentMeta {
                font-size: 11px;
                color: #64748b;
                margin: 0;
            }
            .schematical-agent-footer__item + .schematical-agent-footer__item {
                margin-top: 12px;
            }
            .schematical-agent-footer__descriptors {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .schematical-agent-footer__empty {
                font-size: 12px;
                line-height: 1.4;
                color: #475569;
                margin: 0;
            }
            .schematical-agent-footer__itemTitle {
                font-size: 13px;
                font-weight: 600;
                margin: 0 0 4px;
            }
            .schematical-agent-footer__itemUrl {
                font-size: 12px;
                color: #2563eb;
                word-break: break-all;
                margin-bottom: 6px;
            }
            .schematical-agent-footer__preview {
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                font-size: 12px;
                line-height: 1.4;
                background: rgba(15, 23, 42, 0.05);
                border-radius: 6px;
                padding: 8px;
                white-space: pre-wrap;
                word-break: break-word;
            }
        `;

        document.head.append(style);
    }

    private renderFooter(descriptorsInput: AgentDiscoveryResult[] | undefined, agentsInput: DiscoveredAgent[] | undefined): void {
        const descriptors = Array.isArray(descriptorsInput) ? descriptorsInput : [];
        const agents = Array.isArray(agentsInput) ? agentsInput : [];

        let footer = document.querySelector<HTMLDivElement>('.schematical-agent-footer');
        const wasOpen = footer?.classList.contains('schematical-agent-footer--open') ?? false;
        let toggle: HTMLButtonElement;
        let body: HTMLDivElement;

        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'schematical-agent-footer';

            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'schematical-agent-footer__toggle';

            body = document.createElement('div');
            body.className = 'schematical-agent-footer__body';

            toggle.addEventListener('click', () => {
                footer!.classList.toggle('schematical-agent-footer--open');
            });

            footer.append(toggle, body);
            document.body.append(footer);
        } else {
            const existingToggle = footer.querySelector<HTMLButtonElement>('.schematical-agent-footer__toggle');
            if (existingToggle) {
                toggle = existingToggle;
            } else {
                toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'schematical-agent-footer__toggle';
                toggle.addEventListener('click', () => {
                    footer!.classList.toggle('schematical-agent-footer--open');
                });
                footer.prepend(toggle);
            }

            const existingBody = footer.querySelector<HTMLDivElement>('.schematical-agent-footer__body');
            if (existingBody) {
                body = existingBody;
            } else {
                body = document.createElement('div');
                body.className = 'schematical-agent-footer__body';
                footer.append(body);
            }
        }

        const agentCount = agents.length;
        const descriptorCount = descriptors.length;
        let label: string;
        if (agentCount) {
            label = `Agents detected (${agentCount})`;
        } else if (descriptorCount) {
            label = `Descriptors found (${descriptorCount})`;
        } else {
            label = 'Agent discovery ran – no descriptors found';
        }
        toggle.innerHTML = `${label} <span class="schematical-agent-footer__arrow">▾</span>`;

        body.innerHTML = '';

        const actions = document.createElement('div');
        actions.className = 'schematical-agent-footer__actions';

        const scanButton = document.createElement('button');
        scanButton.type = 'button';
        scanButton.className = 'schematical-agent-footer__scanBtn';
        scanButton.textContent = this.isScanning ? 'Scanning…' : 'Scan again';
        scanButton.disabled = this.isScanning;
        scanButton.addEventListener('click', () => {
            void this.handleManualScan(scanButton);
        });

        actions.append(scanButton);
        body.append(actions);

        const agentSection = document.createElement('div');
        agentSection.className = 'schematical-agent-footer__agents';

        if (agents.length) {
            agents.forEach((agent) => {
                const agentItem = document.createElement('div');
                agentItem.className = 'schematical-agent-footer__agentItem';

                const header = document.createElement('div');
                header.className = 'schematical-agent-footer__agentHeader';

                const name = document.createElement('span');
                name.className = 'schematical-agent-footer__agentName';
                name.textContent = agent.name;

                const toggleWrapper = document.createElement('label');
                toggleWrapper.className = 'schematical-agent-footer__agentToggle';

                const toggleInput = document.createElement('input');
                toggleInput.type = 'checkbox';
                const toggleKey = this.getToggleKey(agent);
                const enabled = this.currentToggleState[toggleKey] === true;
                toggleInput.checked = enabled;

                const toggleLabel = document.createElement('span');
                toggleLabel.className = 'schematical-agent-footer__agentToggleLabel';
                toggleLabel.textContent = enabled ? 'Enabled' : 'Disabled';

                toggleInput.addEventListener('change', () => {
                    const isEnabled = toggleInput.checked;
                    toggleLabel.textContent = isEnabled ? 'Enabled' : 'Disabled';
                    void this.handleAgentToggle(agent, isEnabled);
                });

                toggleWrapper.append(toggleInput, toggleLabel);
                header.append(name, toggleWrapper);

                agentItem.append(header);

                if (agent.description) {
                    const description = document.createElement('p');
                    description.className = 'schematical-agent-footer__agentDescription';
                    description.textContent = agent.description;
                    agentItem.append(description);
                }

                const meta = document.createElement('p');
                meta.className = 'schematical-agent-footer__agentMeta';
                meta.textContent = `Source: ${agent.sourceId}`;
                agentItem.append(meta);

                agentSection.append(agentItem);
            });
        } else {
            const emptyAgents = document.createElement('p');
            emptyAgents.className = 'schematical-agent-footer__empty';
            emptyAgents.textContent = 'No agents discovered on this domain in the last 24 hours.';
            agentSection.append(emptyAgents);
        }

        body.append(agentSection);

        if (descriptors.length) {
            const descriptorSection = document.createElement('div');
            descriptorSection.className = 'schematical-agent-footer__descriptors';

            descriptors.forEach((descriptor) => {
                const item = document.createElement('div');
                item.className = 'schematical-agent-footer__item';

                const heading = document.createElement('p');
                heading.className = 'schematical-agent-footer__itemTitle';
                heading.textContent = descriptor.label;

                const urlLink = document.createElement('a');
                urlLink.className = 'schematical-agent-footer__itemUrl';
                urlLink.href = descriptor.url;
                urlLink.textContent = descriptor.url;
                urlLink.target = '_blank';
                urlLink.rel = 'noopener noreferrer';

                const preview = document.createElement('pre');
                preview.className = 'schematical-agent-footer__preview';
                preview.textContent = descriptor.preview;

                item.append(heading, urlLink, preview);
                descriptorSection.append(item);
            });

            body.append(descriptorSection);
        }

        const shouldBeOpen = this.forceOpenOnNextRender || agents.length === 0 || wasOpen;
        footer!.classList.toggle('schematical-agent-footer--open', shouldBeOpen);
        this.forceOpenOnNextRender = false;
    }

    private async handleManualScan(button: HTMLButtonElement): Promise<void> {
        if (this.isScanning) {
            return;
        }

        this.forceOpenOnNextRender = true;
        this.isScanning = true;
        const originalLabel = button.textContent ?? 'Scan again';
        button.textContent = 'Scanning…';
        button.disabled = true;

        try {
            await this.run({ force: true });
        } finally {
            if (button.isConnected) {
                button.textContent = originalLabel;
                button.disabled = false;
            }
            this.isScanning = false;
            this.refreshScanButtonState();
        }
    }

    private refreshScanButtonState(): void {
        const scanButton = document.querySelector<HTMLButtonElement>('.schematical-agent-footer__scanBtn');
        if (!scanButton) {
            return;
        }

        scanButton.textContent = 'Scan again';
        scanButton.disabled = false;
    }

    private async syncToggleState(hostKey: string, agents: DiscoveredAgent[] | undefined | null): Promise<void> {
        const safeAgents = Array.isArray(agents) ? agents : [];

        if (!safeAgents.length) {
            this.currentToggleState = {};
            await this.removeAgentToggles(hostKey);
            return;
        }

        const stored = await this.loadAgentToggles(hostKey);
        const next: AgentToggleState = {};
        let requiresSave = false;

        safeAgents.forEach((agent) => {
            const key = this.getToggleKey(agent);
            const storedValue = stored[key];
            if (storedValue === undefined) {
                requiresSave = true;
            }
            next[key] = storedValue === true;
        });

        const storedKeys = Object.keys(stored);
        if (storedKeys.some((key) => !(key in next))) {
            requiresSave = true;
        }

        this.currentToggleState = next;

        if (requiresSave) {
            await this.saveAgentToggles(hostKey, next);
        }
    }

    private async handleAgentToggle(agent: DiscoveredAgent, enabled: boolean): Promise<void> {
        if (!this.currentHostKey) {
            return;
        }

        const key = this.getToggleKey(agent);
        this.currentToggleState[key] = enabled;
        await this.saveAgentToggles(this.currentHostKey, this.currentToggleState);

        if (this.currentOrigin) {
            void this.notifyToggleChange(this.currentHostKey, this.currentOrigin, agent, enabled, this.currentToggleState);
        }
    }

    private getToggleKey(agent: DiscoveredAgent): string {
        return agent.descriptorUrl || agent.agentId;
    }

    private async notifyToggleChange(
        hostKey: string,
        origin: string,
        agent: DiscoveredAgent,
        enabled: boolean,
        toggles: AgentToggleState
    ): Promise<void> {
        try {
            await chrome.runtime.sendMessage({
                type: 'AGENT_TOGGLE_UPDATE',
                payload: {
                    host: hostKey,
                    origin,
                    agent,
                    enabled,
                    toggles
                }
            });
        } catch (error) {
            console.debug('[Schematical] toggle update failed', error);
        }
    }

    private async loadAgentToggles(hostKey: string): Promise<AgentToggleState> {
        try {
            const storage = await chrome.storage.local.get(this.toggleStorageKey);
            const store: AgentToggleStore = storage[this.toggleStorageKey] ?? {};
            return store[hostKey] ?? {};
        } catch (error) {
            console.debug('[Schematical] unable to read toggle state', error);
            return {};
        }
    }

    private async saveAgentToggles(hostKey: string, toggles: AgentToggleState): Promise<void> {
        try {
            const storage = await chrome.storage.local.get(this.toggleStorageKey);
            const store: AgentToggleStore = storage[this.toggleStorageKey] ?? {};

            if (!Object.keys(toggles).length) {
                delete store[hostKey];
            } else {
                store[hostKey] = toggles;
            }

            await chrome.storage.local.set({ [this.toggleStorageKey]: store });
        } catch (error) {
            console.debug('[Schematical] unable to persist toggle state', error);
        }
    }

    private async removeAgentToggles(hostKey: string): Promise<void> {
        try {
            const storage = await chrome.storage.local.get(this.toggleStorageKey);
            const store: AgentToggleStore = storage[this.toggleStorageKey] ?? {};
            if (store[hostKey]) {
                delete store[hostKey];
                await chrome.storage.local.set({ [this.toggleStorageKey]: store });
            }
        } catch (error) {
            console.debug('[Schematical] unable to clear toggle state', error);
        }
    }
}

class Main {
    private keywordIntervalId: number | null = null;
    private readonly agentDiscovery = new AgentDiscovery();

    constructor() {
        this.init();
    }

    private init(): void {
        $(document).ready(() => {
            this.startKeywordMask();
            void this.agentDiscovery.run();
        });
    }

    private startKeywordMask(): void {
        if (this.keywordIntervalId !== null) {
            return;
        }

        this.keywordIntervalId = window.setInterval(() => {
            void this.replaceKeyWords();
        }, 2000);
    }

    private async replaceKeyWords(): Promise<void> {
        try {
            const { replace_text: rawList } = await chrome.storage.local.get(['replace_text']);
            if (!rawList || typeof rawList !== 'string') {
                return;
            }

            const searchStrings = rawList
                .split('\n')
                .map((str) => str.trim())
                .filter(Boolean);

            if (!searchStrings.length) {
                return;
            }

            const textNodes = $('*')
                .contents()
                .filter(function filterTextNodes(this: Node) {
                    return this.nodeType === Node.TEXT_NODE;
                });

            textNodes.each((_index, node) => {
                if (!node.nodeValue) {
                    return;
                }

                let text = node.nodeValue;
                searchStrings.forEach((searchString) => {
                    if (!searchString) {
                        return;
                    }

                    if (text.indexOf(searchString) === -1) {
                        return;
                    }

                    const mask = 'X'.repeat(searchString.length);
                    const regex = new RegExp(searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    text = text.replace(regex, mask);
                });

                node.nodeValue = text;
            });
        } catch (error) {
            console.debug('[Schematical] keyword masking failed', error);
        }
    }

    // Legacy helpers retained for menu interactions.
    private hideErrorMessage(): void {
        if ($('#olive-extension__error-msg')[0]) {
            $('#olive-extension__error-msg')
                .removeClass('olive-extension-showing')
                .addClass('olive-extension-hidding')
                .html('');
        }
    }

    private showErrorMessage(text: string): void {
        if ($('#olive-extension__error-msg')[0]) {
            $('#olive-extension__error-msg')
                .removeClass('olive-extension-hidding')
                .addClass('olive-extension-showing')
                .html(text);
        }
    }

    private resetEmailTable(): void {
        if ($('#olive-extension__email-table')[0]) {
            $('#olive-extension__email-table').empty();
        }
    }

    private validateEmail(email: string): RegExpMatchArray | null {
        if (email && email !== '') {
            return email.match(
                /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
        }

        return null;
    }
}

new Main();
