import { BaseAIProvider, AIRequestOptions, AIResponse } from "./base";

export class GenericOpenAIProvider extends BaseAIProvider {
    id = 'generic-openai'; // This will be overridden or ignored by registry map

    // We assume the registry maps many IDs (openai, openrouter, deepseek) to this class instance
    // or separate instances.

    async validate(apiKey: string): Promise<boolean> {
        return apiKey.length > 0;
    }

    async generateContent(apiKey: string, options: AIRequestOptions): Promise<AIResponse> {
        const baseUrl = options.baseUrl || 'https://api.openai.com/v1';
        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

        const headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        // Special handling for OpenRouter (requires site url/name)
        if (baseUrl.includes("openrouter.ai")) {
            headers['HTTP-Referer'] = 'https://student-app.com';
            headers['X-Title'] = 'Student AI App';
        }

        const body: any = {
            model: options.model.modelId,
            messages: [
                { role: 'system', content: options.systemPrompt || 'You are a helpful AI assistant.' },
                { role: 'user', content: options.prompt }
            ],
            temperature: options.temperature || 0.7,
            stream: false
        };

        if (options.jsonMode) {
            body.response_format = { type: "json_object" };
        }

        if (options.maxTokens) {
            body.max_tokens = options.maxTokens;
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`API Error ${res.status}: ${errText}`);
            }

            const data = await res.json();
            const content = data.choices?.[0]?.message?.content || "";

            return {
                content,
                raw: data,
                inputTokens: data.usage?.prompt_tokens,
                outputTokens: data.usage?.completion_tokens
            };

        } catch (e: any) {
            throw new Error(`Generic OpenAI Provider Error: ${e.message}`);
        }
    }

    // Basic Stream Support
    async generateContentStream(apiKey: string, options: AIRequestOptions, onChunk: (text: string) => void): Promise<string> {
        const baseUrl = options.baseUrl || 'https://api.openai.com/v1';
        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

        const headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        if (baseUrl.includes("openrouter.ai")) {
            headers['HTTP-Referer'] = 'https://student-app.com';
            headers['X-Title'] = 'Student AI App';
        }

        const body: any = {
            model: options.model.modelId,
            messages: [
                { role: 'system', content: options.systemPrompt || 'You are a helpful AI assistant.' },
                { role: 'user', content: options.prompt }
            ],
            temperature: options.temperature || 0.7,
            stream: true
        };

        if (options.jsonMode) {
            body.response_format = { type: "json_object" };
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`API Error ${res.status}: ${errText}`);
            }

            if (!res.body) throw new Error("No response body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            const content = json.choices?.[0]?.delta?.content || "";
                            if (content) {
                                fullText += content;
                                onChunk(fullText);
                            }
                        } catch (e) {}
                    }
                }
            }
            return fullText;

        } catch (e: any) {
            throw new Error(`Stream Error: ${e.message}`);
        }
    }
}
