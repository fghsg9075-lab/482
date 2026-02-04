export type AIProviderType =
    | 'openai' | 'gemini' | 'groq' | 'anthropic'
    | 'openrouter' | 'deepseek' | 'mistral' | 'together' | 'fireworks' | 'cohere' | 'perplexity'
    | 'huggingface' | 'replicate' | 'ollama' | 'local'
    | 'yi' | 'baichuan' | 'zhipu' | 'modal' | 'anyscale'
    | 'vllm' | 'gpt4all' | 'localai';

export type CanonicalModel = 'NOTES_ENGINE' | 'MCQ_ENGINE' | 'CHAT_ENGINE' | 'ANALYSIS_ENGINE' | 'VISION_ENGINE' | 'TRANSLATION_ENGINE' | 'ADMIN_ENGINE';

export interface AIProviderConfig {
    id: AIProviderType;
    name: string;
    baseUrl?: string; // Optional custom base URL
    isEnabled: boolean;
    icon?: string;
}

export interface AIModelConfig {
    id: string; // Unique ID (e.g., 'gemini-1.5-flash-001')
    providerId: AIProviderType;
    modelId: string; // The actual model string used in API (e.g., 'gemini-1.5-flash')
    name: string; // Display name
    contextWindow: number;
    costPer1kInput?: number; // In cents/dollars
    costPer1kOutput?: number;
    isEnabled: boolean;
    priority?: number; // 1 = High, 10 = Low
}

export interface AICanonicalMapping {
    canonicalModel: CanonicalModel;
    primaryModelId: string;
    fallbackModelIds: string[]; // Ordered list of fallbacks
}

export interface AIKey {
    id: string;
    key: string;
    providerId: AIProviderType;
    name?: string; // "Admin Key 1"
    usageCount: number; // Total calls
    dailyUsageCount: number;
    limit: number; // Daily limit (e.g., 1000)
    isExhausted: boolean;
    lastUsed: string; // ISO Date
    status: 'ACTIVE' | 'REVOKED' | 'RATE_LIMITED';
}

export interface AILog {
    id: string;
    timestamp: string;
    canonicalModel: CanonicalModel;
    providerId: AIProviderType;
    modelId: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs: number;
    status: 'SUCCESS' | 'FAILURE';
    errorMessage?: string;
    cost?: number;
    userId?: string;
}

export interface AIUsageStats {
    totalCalls: number;
    totalCost: number;
    failures: number;
    providerStats: Record<string, { calls: number, failures: number, cost: number }>;
}
