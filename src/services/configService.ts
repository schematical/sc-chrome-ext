// src/services/configService.ts

export interface ExtensionConfig {
    apiBaseUrl: string;
    openaiApiKey?: string;
    openaiModel?: string;
}

export class ConfigService {
    private static readonly STORAGE_KEY = 'extensionConfig';
    private static readonly DEFAULT_CONFIG: ExtensionConfig = {
        apiBaseUrl: 'https://dev.schematical.com',
        openaiApiKey: '',
        openaiModel: 'gpt-4o-mini'
    };

    /**
     * Get the current configuration
     */
    static async getConfig(): Promise<ExtensionConfig> {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(this.STORAGE_KEY);
                return result[this.STORAGE_KEY] || { ...this.DEFAULT_CONFIG };
            } else {
                // Fallback to localStorage
                const stored = localStorage.getItem(this.STORAGE_KEY);
                return stored ? JSON.parse(stored) : { ...this.DEFAULT_CONFIG };
            }
        } catch (error) {
            console.warn('Failed to load config from storage, using defaults:', error);
            return { ...this.DEFAULT_CONFIG };
        }
    }

    /**
     * Update the configuration
     */
    static async updateConfig(updates: Partial<ExtensionConfig>): Promise<void> {
        try {
            const currentConfig = await this.getConfig();
            const newConfig = { ...currentConfig, ...updates };

            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ [this.STORAGE_KEY]: newConfig });
            } else {
                // Fallback to localStorage
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
            }
        } catch (error) {
            console.error('Failed to save config:', error);
            throw error;
        }
    }

    /**
     * Get the API base URL
     */
    static async getApiBaseUrl(): Promise<string> {
        const config = await this.getConfig();
        return config.apiBaseUrl;
    }

    static async getOpenAI(): Promise<{ apiKey: string; model: string } | null> {
        const config = await this.getConfig();
        const apiKey = (config.openaiApiKey || '').trim();
        const model = (config.openaiModel || 'gpt-4o-mini').trim();
        if (!apiKey) return null;
        return { apiKey, model };
    }

    /**
     * Reset configuration to defaults
     */
    static async resetToDefaults(): Promise<void> {
        await this.updateConfig(this.DEFAULT_CONFIG);
    }
}
