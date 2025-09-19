export {};

interface ChatSettings {
    provider: 'openai';
    openaiApiKey?: string;
    openaiModel?: string;
    serverUrl?: string;
}

interface SettingsPayload {
    ok: boolean;
    settings: ChatSettings;
    error?: string;
}

type SettingsUpdatePayload = SettingsPayload;

document.addEventListener('DOMContentLoaded', () => {
    const settingsApp = new SettingsApp();
    void settingsApp.init();
});

class SettingsApp {
    private formEl: HTMLFormElement;
    private keyInput: HTMLInputElement;
    private modelInput: HTMLInputElement;
    private serverUrlInput: HTMLInputElement;
    private statusEl: HTMLElement;
    private clearButton: HTMLButtonElement;
    private saveButton: HTMLButtonElement;

    constructor() {
        const formNode = document.getElementById('settings-form');
        const keyNode = document.getElementById('openai-key');
        const modelNode = document.getElementById('openai-model');
        const statusNode = document.getElementById('settings-status');
        const clearNode = document.getElementById('settings-clear');
        const saveNode = document.getElementById('settings-save');
        const serverUrlNode = document.getElementById('agent-server-url');

        if (
            !(formNode instanceof HTMLFormElement) ||
            !(keyNode instanceof HTMLInputElement) ||
            !(modelNode instanceof HTMLInputElement) ||
            !(statusNode instanceof HTMLElement) ||
            !(clearNode instanceof HTMLButtonElement) ||
            !(saveNode instanceof HTMLButtonElement) ||
            !(serverUrlNode instanceof HTMLInputElement)
        ) {
            throw new Error('Settings UI failed to initialise. Missing elements.');
        }

        this.formEl = formNode;
        this.keyInput = keyNode;
        this.modelInput = modelNode;
        this.statusEl = statusNode;
        this.serverUrlInput = serverUrlNode;
        this.clearButton = clearNode;
        this.saveButton = saveNode;
    }

    async init(): Promise<void> {
        this.bindEvents();
        await this.loadSettings();
    }

    private bindEvents(): void {
        this.formEl.addEventListener('submit', (event) => {
            event.preventDefault();
            void this.saveSettings();
        });

        this.clearButton.addEventListener('click', () => {
            this.keyInput.value = '';
            void this.saveSettings();
        });
    }

    private async loadSettings(): Promise<void> {
        this.updateStatus('Loading settings…');
        try {
            const response = await sendMessage<SettingsPayload>('GET_SETTINGS');
            if (!response.ok) {
                this.updateStatus(response.error ?? 'Failed to load settings.');
                return;
            }

            const { settings } = response;
            this.keyInput.value = settings.openaiApiKey ?? '';
            this.modelInput.value = settings.openaiModel ?? 'gpt-4o-mini';
            this.serverUrlInput.value = settings.serverUrl ?? 'http://localhost:4000';
            this.updateStatus('Settings loaded.');
        } catch (error) {
            console.error('Failed to load settings', error);
            this.updateStatus('Failed to load settings.');
        }
    }

    private async saveSettings(): Promise<void> {
        this.updateStatus('Saving…');
        this.setFormEnabled(false);

        try {
            const payload: ChatSettings = {
                provider: 'openai',
                openaiApiKey: this.keyInput.value.trim() || undefined,
                openaiModel: this.modelInput.value.trim() || 'gpt-4o-mini',
                serverUrl: this.serverUrlInput.value.trim() || undefined
            };

            const response = await sendMessage<SettingsPayload>('UPDATE_SETTINGS', { settings: payload });
            if (!response.ok) {
                this.updateStatus(response.error ?? 'Failed to save settings.');
                return;
            }

            this.updateStatus('Settings saved.');
        } catch (error) {
            console.error('Failed to save settings', error);
            this.updateStatus('Failed to save settings.');
        } finally {
            this.setFormEnabled(true);
        }
    }

    private updateStatus(text: string): void {
        this.statusEl.textContent = text;
    }

    private setFormEnabled(enabled: boolean): void {
        this.keyInput.disabled = !enabled;
        this.modelInput.disabled = !enabled;
        this.serverUrlInput.disabled = !enabled;
        this.saveButton.disabled = !enabled;
        this.clearButton.disabled = !enabled;
    }
}

function sendMessage<T>(type: string, payload?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error(error.message));
                return;
            }
            resolve(response as T);
        });
    });
}
