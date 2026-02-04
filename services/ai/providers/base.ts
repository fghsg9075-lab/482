import { AIModelConfig } from "../types";

export interface AIRequestOptions {
    model: AIModelConfig;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    tools?: any[]; // Tool definitions
    baseUrl?: string; // For generic providers (OpenRouter, DeepSeek, etc.)
}

export interface AIResponse {
    content: string;
    toolCalls?: any[];
    inputTokens?: number;
    outputTokens?: number;
    raw?: any;
}

export abstract class BaseAIProvider {
    abstract id: string;

    // Validate if the provider can handle this request (e.g. key exists)
    abstract validate(apiKey: string): Promise<boolean>;

    abstract generateContent(apiKey: string, options: AIRequestOptions): Promise<AIResponse>;

    // Optional stream support
    async generateContentStream(apiKey: string, options: AIRequestOptions, onChunk: (text: string) => void): Promise<string> {
        throw new Error("Streaming not supported by this provider");
    }
}
