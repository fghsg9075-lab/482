import { AIProviderConfig, AIModelConfig, AICanonicalMapping } from "./types";

export const DEFAULT_PROVIDERS: AIProviderConfig[] = [
    // --- TIER A (Must Have) ---
    { id: 'groq', name: 'Groq', isEnabled: true, icon: 'https://groq.com/wp-content/uploads/2024/03/PBG-mark1-color.svg' },
];

export const DEFAULT_MODELS: AIModelConfig[] = [
    // --- GROQ ---
    { id: 'llama-3.1-70b', providerId: 'groq', modelId: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Groq)', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'llama-3.2-90b-vision', providerId: 'groq', modelId: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'llama-3.1-8b', providerId: 'groq', modelId: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', contextWindow: 8192, isEnabled: true, priority: 2 },
    { id: 'mixtral-8x7b', providerId: 'groq', modelId: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', contextWindow: 32768, isEnabled: true, priority: 2 },
];

export const DEFAULT_MAPPINGS_FULL: AICanonicalMapping[] = [
    { canonicalModel: 'NOTES_ENGINE', primaryModelId: 'llama-3.1-70b', fallbackModelIds: ['llama-3.1-8b'] },
    { canonicalModel: 'MCQ_ENGINE', primaryModelId: 'llama-3.1-70b', fallbackModelIds: ['llama-3.1-8b'] },
    { canonicalModel: 'CHAT_ENGINE', primaryModelId: 'llama-3.1-70b', fallbackModelIds: ['llama-3.1-8b'] },
    { canonicalModel: 'ANALYSIS_ENGINE', primaryModelId: 'llama-3.1-70b', fallbackModelIds: ['llama-3.1-8b'] },
    { canonicalModel: 'VISION_ENGINE', primaryModelId: 'llama-3.2-90b-vision', fallbackModelIds: ['llama-3.1-70b'] },
    { canonicalModel: 'TRANSLATION_ENGINE', primaryModelId: 'llama-3.1-70b', fallbackModelIds: ['llama-3.1-8b'] },
    { canonicalModel: 'ADMIN_ENGINE', primaryModelId: 'llama-3.1-70b', fallbackModelIds: ['llama-3.1-8b'] }
];
