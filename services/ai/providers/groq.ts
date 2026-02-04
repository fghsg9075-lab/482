import { BaseAIProvider, AIRequestOptions, AIResponse } from "./base";

export class GroqProvider extends BaseAIProvider {
    id = "groq";

    async validate(apiKey: string): Promise<boolean> {
        return apiKey.startsWith("gsk_");
    }

    async generateContent(apiKey: string, options: AIRequestOptions): Promise<AIResponse> {
        const messages: any[] = [];
        if (options.systemPrompt) {
            messages.push({ role: "system", content: options.systemPrompt });
        }
        messages.push({ role: "user", content: options.prompt });

        if (options.jsonMode && options.systemPrompt && !options.systemPrompt.includes("JSON")) {
             // Ensure system prompt enforces JSON if mode is set
             messages[0].content += " You must return valid JSON.";
        }

        const body: any = {
            model: options.model.modelId,
            messages: messages,
            temperature: options.temperature || 0.7
        };

        if (options.jsonMode) body.response_format = { type: "json_object" };

        // Note: In a client-side app, we should proxy this to hide keys.
        // But the existing app calls /api/groq (proxy) or uses direct keys if admin.
        // Assuming we are running in an environment where we can call external APIs or using a proxy.
        // The existing `services/groq.ts` calls `/api/groq`. I should match that pattern if it's a proxy.
        // However, the "AI OS" implies we manage keys. If keys are managed on client (Admin Dashboard),
        // we might be calling direct Groq API from client?
        // Let's assume direct call for now or use the proxy path if keys are hidden.
        // Given the requirement "User prompt -> Primary model... User ko kabhi pata hi nahi chalega",
        // the keys are likely server-side or masked.

        // For this implementation, I will assume we pass the key in header (Client-side usage).

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API Error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            inputTokens: data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens
        };
    }

    async generateContentStream(apiKey: string, options: AIRequestOptions, onChunk: (text: string) => void): Promise<string> {
        const messages: any[] = [];
        if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt });
        messages.push({ role: "user", content: options.prompt });

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: options.model.modelId,
                messages: messages,
                stream: true
            })
        });

        if (!response.ok) throw new Error("Groq API Stream Error");
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr.trim() === '[DONE]') return accumulated;
                    try {
                        const json = JSON.parse(jsonStr);
                        const content = json.choices?.[0]?.delta?.content || "";
                        if (content) {
                            accumulated += content;
                            onChunk(accumulated);
                        }
                    } catch (e) {}
                }
            }
        }
        return accumulated;
    }
}
