import { AIProviderConfig, AIModelConfig, AICanonicalMapping } from "./types";

export const DEFAULT_PROVIDERS: AIProviderConfig[] = [
    // --- TIER A (Must Have) ---
    { id: 'openai', name: 'OpenAI', isEnabled: true, baseUrl: 'https://api.openai.com/v1', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg' },
    { id: 'gemini', name: 'Google Gemini', isEnabled: true, icon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg' },
    { id: 'groq', name: 'Groq', isEnabled: true, icon: 'https://groq.com/wp-content/uploads/2024/03/PBG-mark1-color.svg' },
    { id: 'anthropic', name: 'Anthropic', isEnabled: true, baseUrl: 'https://api.anthropic.com/v1', icon: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg' },
    { id: 'openrouter', name: 'OpenRouter', isEnabled: true, baseUrl: 'https://openrouter.ai/api/v1', icon: 'https://openrouter.ai/icon.png' },

    // --- TIER B (High Performance) ---
    { id: 'deepseek', name: 'DeepSeek', isEnabled: true, baseUrl: 'https://api.deepseek.com', icon: 'https://avatars.githubusercontent.com/u/148330874?s=200&v=4' },
    { id: 'mistral', name: 'Mistral AI', isEnabled: true, baseUrl: 'https://api.mistral.ai/v1', icon: 'https://docs.mistral.ai/img/logo.svg' },
    { id: 'together', name: 'Together AI', isEnabled: true, baseUrl: 'https://api.together.xyz/v1', icon: 'https://assets-global.website-files.com/650462006731aa277259207e/650462006731aa2772592080_favicon.png' },
    { id: 'fireworks', name: 'Fireworks AI', isEnabled: true, baseUrl: 'https://api.fireworks.ai/inference/v1', icon: 'https://fireworks.ai/images/logo.png' },
    { id: 'cohere', name: 'Cohere', isEnabled: true, baseUrl: 'https://api.cohere.ai/v1', icon: 'https://cohere.com/favicon.ico' },
    { id: 'perplexity', name: 'Perplexity', isEnabled: true, baseUrl: 'https://api.perplexity.ai', icon: 'https://www.perplexity.ai/favicon.ico' },

    // --- TIER C (Aggregation/Cloud) ---
    { id: 'huggingface', name: 'HuggingFace', isEnabled: true, baseUrl: 'https://api-inference.huggingface.co/models', icon: 'https://huggingface.co/front/assets/huggingface_logo-noborder.svg' },
    { id: 'replicate', name: 'Replicate', isEnabled: true, baseUrl: 'https://api.replicate.com/v1', icon: 'https://replicate.com/static/favicon.ico' },

    // --- TIER D (Local) ---
    { id: 'ollama', name: 'Ollama (Local)', isEnabled: true, baseUrl: 'http://localhost:11434/v1', icon: 'https://ollama.com/public/ollama.png' },
    { id: 'local', name: 'Local AI / LM Studio', isEnabled: true, baseUrl: 'http://localhost:1234/v1', icon: 'https://lmstudio.ai/favicon.ico' }
];

export const DEFAULT_MODELS: AIModelConfig[] = [
    // --- OPENAI ---
    { id: 'openai-gpt-4o', providerId: 'openai', modelId: 'gpt-4o', name: 'GPT-4o (Omni)', contextWindow: 128000, isEnabled: true, priority: 1 },
    { id: 'openai-gpt-4o-mini', providerId: 'openai', modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, isEnabled: true, priority: 2 },

    // --- GEMINI ---
    { id: 'gemini-1.5-flash', providerId: 'gemini', modelId: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, isEnabled: true, priority: 1 },
    { id: 'gemini-1.5-pro', providerId: 'gemini', modelId: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, isEnabled: true, priority: 2 },

    // --- GROQ ---
    { id: 'groq-llama-3.1-70b', providerId: 'groq', modelId: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Fast)', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'groq-llama-3.1-8b', providerId: 'groq', modelId: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant)', contextWindow: 8192, isEnabled: true, priority: 2 },
    { id: 'groq-mixtral-8x7b', providerId: 'groq', modelId: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, isEnabled: true, priority: 3 },

    // --- ANTHROPIC ---
    { id: 'claude-3-5-sonnet', providerId: 'anthropic', modelId: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', contextWindow: 200000, isEnabled: true, priority: 1 },
    { id: 'claude-3-haiku', providerId: 'anthropic', modelId: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextWindow: 200000, isEnabled: true, priority: 2 },

    // --- DEEPSEEK ---
    { id: 'deepseek-chat', providerId: 'deepseek', modelId: 'deepseek-chat', name: 'DeepSeek V2.5', contextWindow: 128000, isEnabled: true, priority: 1 },
    { id: 'deepseek-coder', providerId: 'deepseek', modelId: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 128000, isEnabled: true, priority: 2 },

    // --- MISTRAL ---
    { id: 'mistral-large', providerId: 'mistral', modelId: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 32000, isEnabled: true, priority: 1 },
    { id: 'mistral-small', providerId: 'mistral', modelId: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 32000, isEnabled: true, priority: 2 },

    // --- TOGETHER ---
    { id: 'together-llama-3-70b', providerId: 'together', modelId: 'meta-llama/Llama-3-70b-chat-hf', name: 'Llama 3 70B (Together)', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'together-qwen', providerId: 'together', modelId: 'Qwen/Qwen2-72B-Instruct', name: 'Qwen 2 72B', contextWindow: 32000, isEnabled: true, priority: 2 },

    // --- PERPLEXITY ---
    { id: 'pplx-llama-3-sonar', providerId: 'perplexity', modelId: 'llama-3-sonar-large-32k-online', name: 'Sonar Large Online', contextWindow: 32000, isEnabled: true, priority: 1 },

    // --- OPENROUTER (Aggregation) ---
    { id: 'or-llama-3.1-405b', providerId: 'openrouter', modelId: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', contextWindow: 128000, isEnabled: true, priority: 1 },
    { id: 'or-nous-hermes', providerId: 'openrouter', modelId: 'nousresearch/hermes-3-llama-3.1-405b', name: 'Hermes 3', contextWindow: 128000, isEnabled: true, priority: 2 },

    // --- LOCAL ---
    { id: 'local-llama3', providerId: 'ollama', modelId: 'llama3', name: 'Llama 3 (Local)', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'local-mistral', providerId: 'ollama', modelId: 'mistral', name: 'Mistral (Local)', contextWindow: 8192, isEnabled: true, priority: 2 },
];

export const DEFAULT_MAPPINGS_FULL: AICanonicalMapping[] = [
    { canonicalModel: 'NOTES_ENGINE', primaryModelId: 'groq-llama-3.1-70b', fallbackModelIds: ['openai-gpt-4o-mini', 'gemini-1.5-flash', 'mistral-small'] },
    { canonicalModel: 'MCQ_ENGINE', primaryModelId: 'openai-gpt-4o-mini', fallbackModelIds: ['gemini-1.5-flash', 'groq-llama-3.1-70b'] },
    { canonicalModel: 'CHAT_ENGINE', primaryModelId: 'gemini-1.5-flash', fallbackModelIds: ['groq-llama-3.1-8b', 'openai-gpt-4o-mini'] },
    { canonicalModel: 'ANALYSIS_ENGINE', primaryModelId: 'gemini-1.5-pro', fallbackModelIds: ['openai-gpt-4o', 'claude-3-5-sonnet'] },
    { canonicalModel: 'VISION_ENGINE', primaryModelId: 'openai-gpt-4o', fallbackModelIds: ['gemini-1.5-flash', 'claude-3-5-sonnet'] },
    { canonicalModel: 'TRANSLATION_ENGINE', primaryModelId: 'gemini-1.5-flash', fallbackModelIds: ['openai-gpt-4o-mini'] },
    { canonicalModel: 'ADMIN_ENGINE', primaryModelId: 'gemini-1.5-pro', fallbackModelIds: ['openai-gpt-4o'] }
];
