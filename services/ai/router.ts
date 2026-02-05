import { aiRegistry } from "./registry";
import { logAIRequest, incrementKeyUsage, recordModelFailure, resetModelFailure } from "./db"; // Keep logging logic
import { CanonicalModel, AIKey, AIModelConfig, AILog, AIProviderType, AIProviderConfig } from "./types";
import { AIRequestOptions, AIResponse } from "./providers/base";
import { MASTER_AI_PROVIDERS, DEFAULT_AI_MAPPINGS } from "../../constants";
import { SystemSettings, AIProvider } from "../../types";

// In-memory cache
let settingsCache: SystemSettings | null = null;
let keyIndexMap: Record<string, number> = {}; // For Round Robin

const REFRESH_INTERVAL = 1000; // 1 Second (since localStorage is fast)
let lastRefresh = 0;

const ensureConfigLoaded = async () => {
    if (Date.now() - lastRefresh < REFRESH_INTERVAL && settingsCache) {
        return;
    }

    try {
        const stored = localStorage.getItem('nst_system_settings');
        if (stored) {
            settingsCache = JSON.parse(stored);
        } else {
            // Fallback mock settings if empty
            settingsCache = {
                appName: 'IIC',
                aiProviderConfig: MASTER_AI_PROVIDERS,
                aiCanonicalMap: DEFAULT_AI_MAPPINGS
            } as any;
        }
    } catch (e) {
        console.error("Failed to load AI Settings:", e);
    }

    lastRefresh = Date.now();
};

const getProviderConfig = (providerId: string): AIProvider | undefined => {
    const config = settingsCache?.aiProviderConfig || MASTER_AI_PROVIDERS;
    return config.find(p => p.id === providerId);
};

const getKeysForProvider = (providerId: string): { key: string, id: string }[] => {
    const provider = getProviderConfig(providerId);
    if (!provider || !provider.isEnabled) return [];

    // Filter active keys
    // In new SystemSettings, keys are strings or objects?
    // Types.ts says: apiKeys: { key: string, ... }[]
    return provider.apiKeys
        .filter(k => !k.isExhausted)
        .map((k, idx) => ({ key: k.key, id: `${providerId}-key-${idx}` }));
};

const getNextKey = (providerId: string): { key: string, id: string } | null => {
    const keys = getKeysForProvider(providerId);
    if (keys.length === 0) return null;

    // Round Robin
    const currentIndex = keyIndexMap[providerId] || 0;
    const key = keys[currentIndex % keys.length];

    // Update index for next time
    keyIndexMap[providerId] = (currentIndex + 1) % keys.length;

    return key;
};

export interface RouterExecuteOptions {
    canonicalModel: string; // "NOTES_ENGINE" etc
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

    const canonicalMap = settingsCache?.aiCanonicalMap || DEFAULT_AI_MAPPINGS;
    const mapping = canonicalMap[options.canonicalModel]; // { providerId, modelId }

    if (!mapping) {
        throw new Error(`No mapping found for engine: ${options.canonicalModel}`);
    }

    const primaryProviderId = mapping.providerId;
    const primaryModelId = mapping.modelId;

    // Define Fallback Chain (Hardcoded strategy for robustness if primary fails)
    // In a future update, this could be configurable in SystemSettings.
    const fallbackCandidates = [
        { providerId: primaryProviderId, modelId: primaryModelId }, // 1. Primary
        { providerId: 'gemini', modelId: 'gemini-1.5-flash' },      // 2. Fast/Free Tier
        { providerId: 'groq', modelId: 'llama-3.1-8b-instant' },    // 3. Ultra Fast
        { providerId: 'openai', modelId: 'gpt-4o-mini' }            // 4. Reliable Backup
    ];

    // Deduplicate and filter out the primary if it's already in the list (it is, but we want unique attempts)
    // We only want to add fallbacks that are NOT the primary
    const uniqueCandidates = [
        { providerId: primaryProviderId, modelId: primaryModelId },
        ...fallbackCandidates.filter(c => c.providerId !== primaryProviderId)
    ];

    const attempts: { providerId: string, reason: string }[] = [];
    let lastError: any = null;

    for (const candidate of uniqueCandidates) {
        const { providerId, modelId } = candidate;

        // 1. Get Provider Config
        const providerConfig = getProviderConfig(providerId);

        // Skip if provider doesn't exist or is disabled
        if (!providerConfig || !providerConfig.isEnabled) {
            attempts.push({ providerId, reason: "Disabled or Not Configured" });
            continue;
        }

        // 2. Resolve Model Config
        const modelConfig: AIModelConfig = {
            id: modelId,
            providerId: providerId as any,
            modelId: modelId,
            name: modelId,
            contextWindow: 128000,
            isEnabled: true
        };

        // 3. Try Keys (Rotation)
        const keysToTry = 2;
        let success = false;
        let response: AIResponse | null = null;
        let keyFound = false;

        for (let k = 0; k < keysToTry; k++) {
            const keyObj = getNextKey(providerId);

            if (!keyObj) {
                // No keys active for this provider, try next provider
                break;
            }
            keyFound = true;

            const startTime = Date.now();
            try {
                const provider = aiRegistry.getProvider(providerId);

                const requestOptions: AIRequestOptions = {
                    model: modelConfig,
                    prompt: options.prompt,
                    systemPrompt: options.systemPrompt,
                    temperature: options.temperature,
                    jsonMode: options.jsonMode,
                    tools: options.tools,
                    baseUrl: providerConfig.baseUrl
                };

                if (options.onStream && provider.generateContentStream) {
                    const text = await provider.generateContentStream(keyObj.key, requestOptions, options.onStream);
                    response = { content: text };
                } else {
                     response = await provider.generateContent(keyObj.key, requestOptions);
                }

                // Log Success
                logAIRequest({
                    id: `${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    canonicalModel: options.canonicalModel as any,
                    providerId: providerId as any,
                    modelId: modelId,
                    status: 'SUCCESS',
                    latencyMs: Date.now() - startTime,
                    userId: options.userId
                }).catch(console.error);

                success = true;
                break; // Exit Key Loop

            } catch (error: any) {
                lastError = error;
                console.warn(`AI Error (${providerId} - ${modelId}):`, error.message);

                logAIRequest({
                    id: `${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    canonicalModel: options.canonicalModel as any,
                    providerId: providerId as any,
                    modelId: modelId,
                    status: 'FAILURE',
                    errorMessage: error.message,
                    latencyMs: Date.now() - startTime,
                    userId: options.userId
                }).catch(console.error);

                // Continue to next key
            }
        }

        if (success && response) {
            return response;
        } else if (!keyFound) {
            attempts.push({ providerId, reason: "No Active Keys Found" });
        } else {
            attempts.push({ providerId, reason: lastError?.message || "Execution Failed" });
        }

        // If we get here, this provider failed (all keys).
        // Loop continues to next candidate.
    }

    // Construct a more helpful error message
    const attemptSummary = attempts.map(a => `${a.providerId}: ${a.reason}`).join(' | ');
    throw new Error(`AI Generation Failed. Providers tried: [${attemptSummary}]. Please check Admin Dashboard > AI Control Tower.`);
};

// Helper for simple text response
export const executeCanonical = async (options: RouterExecuteOptions): Promise<string> => {
    const res = await executeCanonicalRaw(options);
    return res.content;
};
