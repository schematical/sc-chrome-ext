import type { ProviderModuleConfig } from './config.js';

interface ModelOptions {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  moduleConfig: ProviderModuleConfig;
}

export async function createChatModel(options: ModelOptions): Promise<any> {
  const { moduleConfig, apiKey, model, temperature, provider } = options;
  let importedModule: Record<string, any> | undefined;
  let importPath = moduleConfig.modulePath;
  const attemptedPaths = [moduleConfig.modulePath];

  try {
    importedModule = await import(importPath);
  } catch (error) {
    if (provider === 'openai' && moduleConfig.modulePath !== 'langchain/chat_models/openai') {
      importPath = 'langchain/chat_models/openai';
      attemptedPaths.push(importPath);
      try {
        importedModule = await import(importPath);
      } catch (innerError) {
        throw new Error(
          `Failed to import module for provider "${provider}". Tried: ${attemptedPaths.join(', ')}. Install the appropriate LangChain integration package.`
        );
      }
    } else {
      throw new Error(
        `Failed to import module "${moduleConfig.modulePath}" for provider "${provider}". Ensure the dependency is installed.`
      );
    }
  }

  if (!importedModule) {
    throw new Error(
      `Failed to import module for provider "${provider}". Tried: ${attemptedPaths.join(', ')}.`
    );
  }

  const moduleExports = importedModule as Record<string, any>;
  const ModelClass = moduleExports[moduleConfig.exportName];
  if (!ModelClass) {
    throw new Error(
      `Export "${moduleConfig.exportName}" not found in module "${importPath}" for provider "${provider}".`
    );
  }

  const constructorOptions: Record<string, unknown> = {
    temperature
  };

  if (apiKey) {
    const keyOption = moduleConfig.apiKeyOption ?? 'apiKey';
    constructorOptions[keyOption] = apiKey;
  }

  if (model) {
    const modelOption = moduleConfig.modelOption ?? 'model';
    constructorOptions[modelOption] = model;
  }

  return new ModelClass(constructorOptions);
}
