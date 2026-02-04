
export interface AiKey {
    key: string;
    addedAt: string; // ISO Date
    status: 'ACTIVE' | 'EXHAUSTED' | 'RATE_LIMITED' | 'REVOKED';
    usageCount: number;
    lastUsed?: string;
    errorCount?: number;
}

export interface AiModel {
    id: string;
    name: string;
    contextWindow?: number;
    costPerMillion?: number; // Optional cost tracking
}

export interface AiProviderConfig {
    id: string; // openai, groq, gemini
    name: string;
    enabled: boolean;
    baseUrl?: string; // Optional override
    keys: AiKey[];
    models: AiModel[];
}

export interface AiRoute {
    id: string; // NOTES_ENGINE, CHAT_ENGINE
    primaryProvider: string; // Provider ID
    primaryModel: string; // Model ID
    fallbackProvider?: string; // Provider ID
    fallbackModel?: string; // Model ID
    tertiaryProvider?: string;
    tertiaryModel?: string;
    systemPrompt?: string; // Optional specific prompt override
}

export interface AiSystemConfig {
    providers: Record<string, AiProviderConfig>;
    routes: Record<string, AiRoute>;
    settings: {
        globalRateLimit: number;
        studentUsageLimitPercent: number; // e.g. 80%
        adminUsageLimitPercent: number; // e.g. 20%
        loggingEnabled: boolean;
    };
}

export const DEFAULT_AI_CONFIG: AiSystemConfig = {
    providers: {
        groq: {
            id: 'groq',
            name: 'Groq Cloud',
            enabled: true,
            keys: [],
            models: [
                { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)' },
                { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Smart)' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
            ]
        },
        openai: {
            id: 'openai',
            name: 'OpenAI',
            enabled: false,
            keys: [],
            models: [
                { id: 'gpt-4o', name: 'GPT-4 Omni' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ]
        },
        gemini: {
            id: 'gemini',
            name: 'Google Gemini',
            enabled: false,
            keys: [],
            models: [
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
            ]
        }
    },
    routes: {
        NOTES_ENGINE: {
            id: 'NOTES_ENGINE',
            primaryProvider: 'groq',
            primaryModel: 'llama-3.1-8b-instant',
            fallbackProvider: 'gemini',
            fallbackModel: 'gemini-1.5-flash'
        },
        CHAT_ENGINE: {
            id: 'CHAT_ENGINE',
            primaryProvider: 'groq',
            primaryModel: 'llama-3.1-8b-instant',
            fallbackProvider: 'openai',
            fallbackModel: 'gpt-3.5-turbo'
        }
    },
    settings: {
        globalRateLimit: 5000,
        studentUsageLimitPercent: 80,
        adminUsageLimitPercent: 20,
        loggingEnabled: true
    }
};
