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
}

interface AgentDiscoveryCacheEntry {
    checkedAt: number;
    results: AgentDiscoveryResult[];
}

type AgentDiscoveryCache = Record<string, AgentDiscoveryCacheEntry>;

class AgentDiscovery {
    private readonly endpoints: AgentEndpoint[] = [
        { id: 'llms', path: '/llms.txt', label: 'llms.txt', expectsJson: false },
        { id: 'agentJson', path: '/.well-known/agent.json', label: 'agent.json', expectsJson: true },
        { id: 'agentCard', path: '/.well-known/agent-card.json', label: 'agent-card.json', expectsJson: true },
        { id: 'a2aAgents', path: '/.well-known/a2a-agents', label: 'a2a-agents', expectsJson: true },
        { id: 'utcp', path: '/utcp', label: 'utcp', expectsJson: true }
    ];

    private readonly cacheKey = 'schematicalAgentCache';
    private readonly ttlMs = 24 * 60 * 60 * 1000;
    private hasRendered = false;

    private isScanning = false;
    private forceOpenOnNextRender = false;

    public async run(options: { force?: boolean } = {}): Promise<void> {
        const { force = false } = options;

        if (this.hasRendered && !force) {
            return;
        }

        const hostKey = window.location.hostname;
        if (!hostKey) {
            return;
        }

        const origin = window.location.origin;
        if (!origin || origin === 'null') {
            return;
        }

        const cachedResults = force ? null : await this.loadCachedResults(hostKey);
        if (cachedResults !== null) {
            this.hasRendered = true;
            this.injectStyles();
            this.renderFooter(cachedResults);
            return;
        }

        const results = (await Promise.all(this.endpoints.map((endpoint) => this.fetchEndpoint(origin, endpoint)))).filter(
            (value): value is AgentDiscoveryResult => Boolean(value)
        );

        await this.saveResults(hostKey, results);

        this.hasRendered = true;
        this.injectStyles();
        this.renderFooter(results);
    }

    private async loadCachedResults(hostKey: string): Promise<AgentDiscoveryResult[] | null> {
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

            return entry.results;
        } catch (error) {
            console.debug('[Schematical] unable to read agent cache', error);
            return null;
        }
    }

    private async saveResults(hostKey: string, results: AgentDiscoveryResult[]): Promise<void> {
        try {
            const storage = await chrome.storage.local.get(this.cacheKey);
            const cache: AgentDiscoveryCache = storage[this.cacheKey] ?? {};

            cache[hostKey] = {
                checkedAt: Date.now(),
                results
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

            let preview: string;
            if (endpoint.expectsJson) {
                try {
                    const json = await response.json();
                    preview = this.formatJsonPreview(json);
                } catch (jsonError) {
                    const text = await response.text();
                    preview = this.buildPreview(text);
                }
            } else {
                const text = await response.text();
                preview = this.buildPreview(text);
            }

            return {
                id: endpoint.id,
                label: endpoint.label,
                url,
                preview
            };
        } catch (error) {
            console.debug('[Schematical] Unable to read agent descriptor', { endpoint: endpoint.path, error });
            return null;
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
            .schematical-agent-footer__item + .schematical-agent-footer__item {
                margin-top: 12px;
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

    private renderFooter(results: AgentDiscoveryResult[]): void {
        if (document.querySelector('.schematical-agent-footer')) {
            return;
        }

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

        const label = results.length ? `Agents detected (${results.length})` : 'Agent discovery ran – no descriptors found';
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

        if (!results.length) {
            const emptyState = document.createElement('p');
            emptyState.className = 'schematical-agent-footer__empty';
            emptyState.textContent = 'No agent descriptors found on this domain in the last 24 hours.';
            body.append(emptyState);
        } else {
            results.forEach((result) => {
                const item = document.createElement('div');
                item.className = 'schematical-agent-footer__item';

                const heading = document.createElement('p');
                heading.className = 'schematical-agent-footer__itemTitle';
                heading.textContent = result.label;

                const urlLink = document.createElement('a');
                urlLink.className = 'schematical-agent-footer__itemUrl';
                urlLink.href = result.url;
                urlLink.textContent = result.url;
                urlLink.target = '_blank';
                urlLink.rel = 'noopener noreferrer';

                const preview = document.createElement('pre');
                preview.className = 'schematical-agent-footer__preview';
                preview.textContent = result.preview;

                item.append(heading, urlLink, preview);
                body.append(item);
            });
        }

        const shouldBeOpen = this.forceOpenOnNextRender || results.length === 0 || wasOpen;
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
