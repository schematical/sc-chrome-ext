// src/settings.ts

import { ConfigService } from './services/configService';

class SettingsPage {
    private apiBaseUrlInput!: HTMLInputElement;
    private openaiApiKeyInput!: HTMLInputElement;
    private openaiModelSelect!: HTMLSelectElement;
    private statusDiv!: HTMLDivElement;
    private form!: HTMLFormElement;
    private resetBtn!: HTMLButtonElement;
    private testBtn!: HTMLButtonElement;

    constructor() {
        this.init();
    }

    private init(): void {
        this.apiBaseUrlInput = document.getElementById('apiBaseUrl') as HTMLInputElement;
        this.openaiApiKeyInput = document.getElementById('openaiApiKey') as HTMLInputElement;
        this.openaiModelSelect = document.getElementById('openaiModel') as HTMLSelectElement;
        this.statusDiv = document.getElementById('status') as HTMLDivElement;
        this.form = document.getElementById('settingsForm') as HTMLFormElement;
        this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
        this.testBtn = document.getElementById('testBtn') as HTMLButtonElement;

        this.setupEventListeners();
        this.loadCurrentSettings();
    }

    private setupEventListeners(): void {
        this.form.addEventListener('submit', (e) => this.handleSave(e));
        this.resetBtn.addEventListener('click', () => this.handleReset());
        this.testBtn.addEventListener('click', () => this.handleTestConnection());
    }

    private async loadCurrentSettings(): Promise<void> {
        try {
            const config = await ConfigService.getConfig();
            this.apiBaseUrlInput.value = config.apiBaseUrl;
            this.openaiApiKeyInput.value = config.openaiApiKey || '';
            this.openaiModelSelect.value = config.openaiModel || 'gpt-4o-mini';
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.showStatus('Failed to load current settings', 'error');
        }
    }

    private async handleSave(e: Event): Promise<void> {
        e.preventDefault();
        
        const apiBaseUrl = this.apiBaseUrlInput.value.trim();
        const openaiApiKey = this.openaiApiKeyInput.value.trim();
        const openaiModel = this.openaiModelSelect.value.trim();
        
        if (!apiBaseUrl) {
            this.showStatus('API Base URL is required', 'error');
            return;
        }

        try {
            await ConfigService.updateConfig({ apiBaseUrl, openaiApiKey, openaiModel });
            this.showStatus('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showStatus('Failed to save settings', 'error');
        }
    }

    private async handleReset(): Promise<void> {
        try {
            await ConfigService.resetToDefaults();
            await this.loadCurrentSettings();
            this.showStatus('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showStatus('Failed to reset settings', 'error');
        }
    }

    private async handleTestConnection(): Promise<void> {
        const apiBaseUrl = this.apiBaseUrlInput.value.trim();
        
        if (!apiBaseUrl) {
            this.showStatus('Please enter an API Base URL first', 'error');
            return;
        }

        this.testBtn.disabled = true;
        this.testBtn.textContent = '🧪 Testing...';

        try {
            // Test the health endpoint
            const response = await fetch(`${apiBaseUrl}/health`, {
                method: 'GET',
                timeout: 5000
            } as any);

            if (response.ok) {
                this.showStatus('✅ Connection successful! API is responding.', 'success');
            } else {
                this.showStatus(`⚠️ API responded with status ${response.status}`, 'error');
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            this.showStatus('❌ Connection failed. Check the URL and make sure the API is running.', 'error');
        } finally {
            this.testBtn.disabled = false;
            this.testBtn.textContent = '🧪 Test Connection';
        }
    }

    private showStatus(message: string, type: 'success' | 'error'): void {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
        this.statusDiv.style.display = 'block';

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.statusDiv.style.display = 'none';
            }, 5000);
        }
    }
}

// Initialize the settings page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsPage();
});
