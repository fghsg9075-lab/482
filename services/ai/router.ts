import { aiRegistry } from "./registry";
import { getAIKeys, getCanonicalMappings, getAIModels, logAIRequest, incrementKeyUsage, recordModelFailure, resetModelFailure } from "./db";
import { CanonicalModel, AIKey, AIModelConfig, AILog, AIProviderType } from "./types";
import { AIRequestOptions, AIResponse } from "./providers/base";

// Simple in-memory cache to avoid hitting Firestore on every request
// In a real app, use a robust caching layer (Redis or LocalStorage with expiration)
let mappingCache: Record<string, any> | null = null;
let modelCache: AIModelConfig[] | null = null;
let keyCache: Record<string, AIKey[]> = {};
let keyIndexMap: Record<string, number> = {}; // For Round Robin

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 Minutes
let lastRefresh = 0;

const ensureConfigLoaded = async () => {
    if (Date.now() - lastRefresh < REFRESH_INTERVAL && mappingCache && modelCache) {
        return;
    }

    // Parallel Fetch
    const [mappings, models, allKeys] = await Promise.all([
        getCanonicalMappings(),
        getAIModels(),
        getAIKeys() // Fetch all keys securely
    ]);

    mappingCache = mappings;
    modelCache = models;

    // Group keys by provider
    keyCache = {};
    allKeys.forEach(k => {
        if (!keyCache[k.providerId]) keyCache[k.providerId] = [];
        keyCache[k.providerId].push(k);
    });

    lastRefresh = Date.now();
};

const getKeysForProvider = (providerId: string): AIKey[] => {
    // If local/ollama, return a dummy key if none exist
    if (providerId === 'ollama' || providerId === 'local') {
        return [{ id: 'local-key', key: 'local', providerId: 'ollama', usageCount: 0, dailyUsageCount: 0, limit: 99999, isExhausted: false, lastUsed: '', status: 'ACTIVE' }];
    }
    return (keyCache[providerId] || []).filter(k => k.status === 'ACTIVE' && !k.isExhausted);
};

const getNextKey = (providerId: string): AIKey | null => {
    const keys = getKeysForProvider(providerId);
    if (keys.length === 0) return null;

    // Round Robin
    const currentIndex = keyIndexMap[providerId] || 0;
    const key = keys[currentIndex % keys.length];

    // Update index for next time
    keyIndexMap[providerId] = (currentIndex + 1) % keys.length;

    return key;
};

// DEFAULTS if DB is empty (Bootstrap)
const DEFAULT_MAPPINGS: Record<CanonicalModel, string[]> = {
    'NOTES_ENGINE': ['groq-llama-3.1-8b', 'gemini-1.5-flash'],
    'MCQ_ENGINE': ['groq-llama-3.1-8b', 'gemini-1.5-flash'],
    'CHAT_ENGINE': ['gemini-1.5-flash', 'groq-llama-3.1-8b'],
    'ANALYSIS_ENGINE': ['gemini-1.5-flash', 'groq-mixtral-8x7b'],
    'VISION_ENGINE': ['gemini-1.5-flash'],
    'TRANSLATION_ENGINE': ['gemini-1.5-flash'],
    'ADMIN_ENGINE': ['gemini-1.5-flash']
};

const DEFAULT_MODELS: Record<string, AIModelConfig> = {
    'groq-llama-3.1-8b': { id: 'groq-llama-3.1-8b', providerId: 'groq', modelId: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextWindow: 8192, isEnabled: true },
    'groq-mixtral-8x7b': { id: 'groq-mixtral-8x7b', providerId: 'groq', modelId: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, isEnabled: true },
    'gemini-1.5-flash': { id: 'gemini-1.5-flash', providerId: 'gemini', modelId: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, isEnabled: true },
};

export interface RouterExecuteOptions {
    canonicalModel: CanonicalModel;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    jsonMode?: boolean;
    userId?: string;
    onStream?: (text: string) => void;
    tools?: any[];
}

// Low-level execute that returns full AIResponse
export const executeCanonicalRaw = async (options: RouterExecuteOptions): Promise<AIResponse> => {
    await ensureConfigLoaded();

    // 1. Resolve Chain of Models
    let modelChain: string[] = [];
    const mapping = mappingCache?.[options.canonicalModel];

    if (mapping) {
        modelChain = [mapping.primaryModelId, ...mapping.fallbackModelIds];
    } else {
        modelChain = DEFAULT_MAPPINGS[options.canonicalModel] || [];
    }

    if (modelChain.length === 0) {
        throw new Error(`No models mapped for ${options.canonicalModel}`);
    }

    // 2. Try Each Model in Chain
    let lastError: any = null;

    for (const modelConfigId of modelChain) {
        // Resolve Model Config
        const modelConfig = modelCache?.find(m => m.id === modelConfigId) || DEFAULT_MODELS[modelConfigId];

        if (!modelConfig || !modelConfig.isEnabled) {
            console.warn(`Model ${modelConfigId} not found or disabled. Skipping.`);
            continue;
        }

        const providerId = modelConfig.providerId;

        // 3. Key Rotation Loop (Try up to 2 keys for the same model if one fails with 429)
        const keysToTry = 2;
        for (let k = 0; k < keysToTry; k++) {
            const key = getNextKey(providerId);

            if (!key) {
                console.warn(`No active keys for provider ${providerId}. Skipping.`);
                break; // Skip to next model
            }

            const startTime = Date.now();
            try {
                const provider = aiRegistry.getProvider(providerId);

                // EXECUTE
                let response: AIResponse;

                if (options.onStream && provider.generateContentStream) {
                    const text = await provider.generateContentStream(key.key, {
                        model: modelConfig,
                        prompt: options.prompt,
                        systemPrompt: options.systemPrompt,
                        temperature: options.temperature,
                        jsonMode: options.jsonMode,
                        tools: options.tools
                    }, options.onStream);
                    response = { content: text };
                } else {
                     response = await provider.generateContent(key.key, {
                        model: modelConfig,
                        prompt: options.prompt,
                        systemPrompt: options.systemPrompt,
                        temperature: options.temperature,
                        jsonMode: options.jsonMode,
                        tools: options.tools
                    });
                }

                // SUCCESS HANDLERS (MUST HAVE)
                // 1. Log Success
                await logAIRequest({
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    timestamp: new Date().toISOString(),
                    canonicalModel: options.canonicalModel,
                    providerId: providerId as AIProviderType,
                    modelId: modelConfig.modelId,
                    status: 'SUCCESS',
                    latencyMs: Date.now() - startTime,
                    userId: options.userId
                });

                // 2. Increment Usage (Real Tracking)
                incrementKeyUsage(key.id, modelConfigId, providerId);

                // 3. Reset Failure Count (Self-Healing)
                resetModelFailure(modelConfigId);

                return response;

            } catch (error: any) {
                lastError = error;
                const errMsg = error.message || "";

                // LOG FAILURE
                await logAIRequest({
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    timestamp: new Date().toISOString(),
                    canonicalModel: options.canonicalModel,
                    providerId: providerId as AIProviderType,
                    modelId: modelConfig.modelId,
                    status: 'FAILURE',
                    errorMessage: errMsg,
                    latencyMs: Date.now() - startTime,
                    userId: options.userId
                });

                // Handle Specific Errors
                if (errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("Rate limit")) {
                    console.warn(`Key ${key.id} rate limited. Rotating...`);
                    // Rate limits are KEY issues, not MODEL issues usually (unless service down)
                    // So we DON'T disable the model, we just try next key.
                } else {
                    console.error(`Error with ${modelConfigId}: ${errMsg}. Switching Model.`);
                    // FAILURE HANDLER (MUST HAVE)
                    // If not a rate limit, it's likely a model/provider issue.
                    recordModelFailure(modelConfigId);
                    break; // Break key loop, try next model
                }
            }
        }
    }

    throw new Error(`AI Engine Failed: All models exhausted. Last Error: ${lastError?.message}`);
};

// Helper for simple text response
export const executeCanonical = async (options: RouterExecuteOptions): Promise<string> => {
    const res = await executeCanonicalRaw(options);
    return res.content;
};
