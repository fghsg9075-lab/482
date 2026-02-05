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
    { id: 'modal', name: 'Modal', isEnabled: true, baseUrl: 'https://api.modal.com/v1', icon: 'https://modal.com/favicon.ico' },
    { id: 'anyscale', name: 'Anyscale', isEnabled: true, baseUrl: 'https://api.endpoints.anyscale.com/v1', icon: 'https://docs.anyscale.com/img/favicon.ico' },

    // --- TIER D (Asian Models) ---
    { id: 'yi', name: 'Yi (01.AI)', isEnabled: true, baseUrl: 'https://api.01.ai/v1', icon: 'https://01.ai/favicon.ico' },
    { id: 'baichuan', name: 'Baichuan', isEnabled: true, baseUrl: 'https://api.baichuan-ai.com/v1', icon: 'https://www.baichuan-ai.com/favicon.ico' },
    { id: 'zhipu', name: 'Zhipu (ChatGLM)', isEnabled: true, baseUrl: 'https://open.bigmodel.cn/api/paas/v4', icon: 'https://zhipuai.cn/favicon.ico' },

    // --- TIER E (Local) ---
    { id: 'ollama', name: 'Ollama (Local)', isEnabled: true, baseUrl: 'http://localhost:11434/v1', icon: 'https://ollama.com/public/ollama.png' },
    { id: 'local', name: 'Local AI / LM Studio', isEnabled: true, baseUrl: 'http://localhost:1234/v1', icon: 'https://lmstudio.ai/favicon.ico' },
    { id: 'vllm', name: 'vLLM', isEnabled: true, baseUrl: 'http://localhost:8000/v1', icon: 'https://docs.vllm.ai/en/latest/_static/vllm-logo.png' },
    { id: 'gpt4all', name: 'GPT4All', isEnabled: true, baseUrl: 'http://localhost:4891/v1', icon: 'https://gpt4all.io/favicon.ico' },
    { id: 'localai', name: 'LocalAI', isEnabled: true, baseUrl: 'http://localhost:8080/v1', icon: 'https://localai.io/favicon.ico' }
];

export const DEFAULT_MODELS: AIModelConfig[] = [
    // --- OPENAI ---
    { id: 'openai-gpt-4o', providerId: 'openai', modelId: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, isEnabled: true, priority: 1 },
    { id: 'openai-gpt-4o-mini', providerId: 'openai', modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, isEnabled: true, priority: 2 },

    // --- GEMINI ---
    { id: 'gemini-1.5-pro', providerId: 'gemini', modelId: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, isEnabled: true, priority: 1 },
    { id: 'gemini-1.5-flash', providerId: 'gemini', modelId: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, isEnabled: true, priority: 2 },

    // --- ANTHROPIC ---
    { id: 'claude-3-5-sonnet', providerId: 'anthropic', modelId: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', contextWindow: 200000, isEnabled: true, priority: 1 },

    // --- OPEN SOURCE (META) ---
    { id: 'llama-3.1-405b', providerId: 'huggingface', modelId: 'meta-llama/Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B', contextWindow: 128000, isEnabled: true, priority: 1 },
    { id: 'llama-3.1-70b', providerId: 'groq', modelId: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Groq)', contextWindow: 8192, isEnabled: true, priority: 1 },

    // --- MISTRAL ---
    { id: 'mistral-large', providerId: 'mistral', modelId: 'mistral-large-2407', name: 'Mistral Large 2', contextWindow: 32000, isEnabled: true, priority: 1 },

    // --- QWEN (ALIBABA) ---
    { id: 'qwen-2.5-72b', providerId: 'together', modelId: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', contextWindow: 32000, isEnabled: true, priority: 1 },

    // --- DEEPSEEK ---
    { id: 'deepseek-v3', providerId: 'deepseek', modelId: 'deepseek-chat', name: 'DeepSeek V3', contextWindow: 128000, isEnabled: true, priority: 1 },

    // --- YI (01.AI) ---
    { id: 'yi-1.5-34b', providerId: 'yi', modelId: 'yi-1.5-34b-chat', name: 'Yi 1.5 34B', contextWindow: 4096, isEnabled: true, priority: 1 },

    // --- BAICHUAN ---
    { id: 'baichuan-2-13b', providerId: 'baichuan', modelId: 'baichuan-2-13b-chat', name: 'Baichuan 2 13B', contextWindow: 4096, isEnabled: true, priority: 1 },

    // --- ZHIPU ---
    { id: 'glm-4', providerId: 'zhipu', modelId: 'glm-4', name: 'GLM-4', contextWindow: 128000, isEnabled: true, priority: 1 },

    // --- PERPLEXITY ---
    { id: 'sonar-pro', providerId: 'perplexity', modelId: 'sonar-pro', name: 'Sonar Pro', contextWindow: 32000, isEnabled: true, priority: 1 },

    // --- OPENROUTER ---
    { id: 'openrouter-auto', providerId: 'openrouter', modelId: 'auto', name: 'OpenRouter Auto', contextWindow: 128000, isEnabled: true, priority: 1 },

    // --- HOSTED SERVICES (Together, Fireworks, Anyscale) ---
    { id: 'together-llama-70b', providerId: 'together', modelId: 'togethercomputer/llama-3.1-70b', name: 'Together Llama 3.1 70B', contextWindow: 8192, isEnabled: true, priority: 2 },
    { id: 'fireworks-llama-405b', providerId: 'fireworks', modelId: 'accounts/fireworks/models/llama-v3p1-405b-instruct', name: 'Fireworks Llama 3.1 405B', contextWindow: 128000, isEnabled: true, priority: 1 },
    { id: 'anyscale-llama-70b', providerId: 'anyscale', modelId: 'meta-llama/Llama-3.1-70b-Instruct-Turbo', name: 'Anyscale Llama 3.1 70B', contextWindow: 8192, isEnabled: true, priority: 1 },

    // --- LOCAL (Ollama, LM Studio, etc) ---
    { id: 'ollama-llama-3.1', providerId: 'ollama', modelId: 'llama3.1', name: 'Ollama Llama 3.1', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'local-server', providerId: 'local', modelId: 'local-model', name: 'LM Studio / Local Server', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'vllm-model', providerId: 'vllm', modelId: 'vllm-model', name: 'vLLM Engine', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'gpt4all-model', providerId: 'gpt4all', modelId: 'gpt4all-model', name: 'GPT4All', contextWindow: 8192, isEnabled: true, priority: 1 },
    { id: 'localai-model', providerId: 'localai', modelId: 'gpt-4', name: 'LocalAI', contextWindow: 8192, isEnabled: true, priority: 1 },
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
