import { BaseAIProvider } from "./providers/base";
import { GeminiProvider } from "./providers/gemini";
import { GroqProvider } from "./providers/groq";
import { LocalProvider } from "./providers/local";
import { AIProviderType } from "./types";

class AIRegistry {
    private providers: Record<string, BaseAIProvider> = {};

    constructor() {
        this.register(new GeminiProvider());
        this.register(new GroqProvider());
        this.register(new LocalProvider());
        // Add others here
    }

    register(provider: BaseAIProvider) {
        this.providers[provider.id] = provider;
    }

    getProvider(id: string): BaseAIProvider {
        // Map types to implementation IDs if needed, or assume ID match
        // 'ollama' -> LocalProvider
        if (id === 'ollama') return this.providers['ollama'];
        if (id === 'openai') return this.providers['openai']; // Future

        const provider = this.providers[id];
        if (!provider) {
            // Fallback for types that might map to same provider class
            if (id === 'deepseek') return this.providers['ollama']; // Example: DeepSeek via Ollama
            throw new Error(`Provider ${id} not found in registry.`);
        }
        return provider;
    }
}

export const aiRegistry = new AIRegistry();
