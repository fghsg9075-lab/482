import { BaseAIProvider } from "./providers/base";
import { GeminiProvider } from "./providers/gemini";
import { GroqProvider } from "./providers/groq";
import { LocalProvider } from "./providers/local";
import { GenericOpenAIProvider } from "./providers/genericOpenAi";
import { AIProviderType } from "./types";

class AIRegistry {
    private providers: Record<string, BaseAIProvider> = {};
    private genericProvider: GenericOpenAIProvider;

    constructor() {
        this.register(new GeminiProvider());
        this.register(new GroqProvider());
        this.register(new LocalProvider());

        // Register Generic Provider for OpenAI-compatible APIs
        this.genericProvider = new GenericOpenAIProvider();
        this.providers['generic-openai'] = this.genericProvider;
    }

    register(provider: BaseAIProvider) {
        this.providers[provider.id] = provider;
    }

    getProvider(id: string): BaseAIProvider {
        // Explicit Mappings
        if (id === 'ollama') return this.providers['local']; // 'local' is the id of LocalProvider class usually

        // If exact match exists (e.g. 'gemini', 'groq')
        if (this.providers[id]) return this.providers[id];

        // Fallback to Generic OpenAI Provider for known compatible types
        const genericTypes: string[] = [
            'openai', 'openrouter', 'deepseek', 'mistral', 'together',
            'fireworks', 'cohere', 'perplexity', 'huggingface',
            'replicate', 'vllm', 'lmstudio', 'localai'
        ];

        if (genericTypes.includes(id)) {
            return this.genericProvider;
        }

        throw new Error(`Provider ${id} not found in registry.`);
    }
}

export const aiRegistry = new AIRegistry();
