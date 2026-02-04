import { BaseAIProvider, AIRequestOptions, AIResponse } from "./base";

export class LocalProvider extends BaseAIProvider {
    id = "ollama"; // Or 'local'

    async validate(apiKey: string): Promise<boolean> {
        // Local provider typically doesn't need a key, or uses a dummy one.
        // We validate connection by a quick ping if possible, but here just return true.
        return true;
    }

    async generateContent(apiKey: string, options: AIRequestOptions): Promise<AIResponse> {
        // Default Ollama endpoint
        const endpoint = options.model.providerId === 'deepseek' ? 'http://localhost:11434/api/chat' : 'http://localhost:11434/v1/chat/completions';

        // Standard OpenAI Format (Ollama supports this)
        const body = {
            model: options.model.modelId, // e.g. "llama3"
            messages: [
                { role: "system", content: options.systemPrompt || "You are a helpful assistant." },
                { role: "user", content: options.prompt }
            ],
            temperature: options.temperature || 0.7,
            stream: false
        };

        if (options.jsonMode) {
            // @ts-ignore
            body.format = "json"; // Ollama specific
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`Local AI Error: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle different response formats (Ollama API vs OpenAI Compat)
            let content = "";
            if (data.choices && data.choices[0]?.message?.content) {
                content = data.choices[0].message.content; // OpenAI format
            } else if (data.message?.content) {
                content = data.message.content; // Ollama format
            }

            return {
                content: content,
                inputTokens: data.prompt_eval_count || 0,
                outputTokens: data.eval_count || 0
            };

        } catch (e: any) {
            throw new Error(`Local AI Unreachable: ${e.message}. Is Ollama running?`);
        }
    }
}
