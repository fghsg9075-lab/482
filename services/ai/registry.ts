import { BaseAIProvider } from "./providers/base";
import { GeminiProvider } from "./providers/gemini";
import { GroqProvider } from "./providers/groq";
import { AIProviderType } from "./types";

class AIRegistry {
    private providers: Record<string, BaseAIProvider> = {};

    constructor() {
        this.register(new GeminiProvider());
        this.register(new GroqProvider());
        // Add others here
    }

    register(provider: BaseAIProvider) {
        this.providers[provider.id] = provider;
    }

    getProvider(id: AIProviderType): BaseAIProvider {
        const provider = this.providers[id];
        if (!provider) {
            throw new Error(`Provider ${id} not found in registry.`);
        }
        return provider;
    }
}

export const aiRegistry = new AIRegistry();
