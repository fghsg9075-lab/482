import { BaseAIProvider } from "./providers/base";
import { GroqProvider } from "./providers/groq";
import { AIProviderType } from "./types";

class AIRegistry {
    private providers: Record<string, BaseAIProvider> = {};

    constructor() {
        // Only Register Groq as requested
        this.register(new GroqProvider());
    }

    register(provider: BaseAIProvider) {
        this.providers[provider.id] = provider;
    }

    getProvider(id: string): BaseAIProvider {
        // Explicit Mappings
        if (this.providers[id]) return this.providers[id];

        // Fallback for everything to Groq if possible, or throw
        if (this.providers['groq']) return this.providers['groq'];

        throw new Error(`Provider ${id} not found in registry and no fallback available.`);
    }
}

export const aiRegistry = new AIRegistry();
