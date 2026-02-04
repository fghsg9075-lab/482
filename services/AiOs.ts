
import { AiOsConfig, AiTask, SystemSettings, AiProviderConfig, AiMapping } from '../types';
import { incrementApiUsage } from '../firebase';

export class AiManager {

    private static instance: AiManager;

    private constructor() {}

    public static getInstance(): AiManager {
        if (!AiManager.instance) {
            AiManager.instance = new AiManager();
        }
        return AiManager.instance;
    }

    /**
     * Main Entry Point
     */
    public async execute(
        task: AiTask,
        messages: any[],
        settings: SystemSettings,
        usageType: 'PILOT' | 'STUDENT' = 'STUDENT',
        onStream?: (text: string) => void
    ): Promise<string> {

        // 1. Global Kill Switch Check
        if (settings.aiOsConfig?.safetyLock) {
            throw new Error("AI System is currently locked by Admin.");
        }

        // If not enabled or config missing, fallback to legacy Groq immediately
        if (!settings.aiOsConfig || settings.aiOsConfig.globalEnabled === false) {
             console.log("[AI OS] Disabled or Not Configured. Using Legacy Groq.");
             return await this.callGroqDriver(messages, "llama-3.1-8b-instant", ""); // Empty key will trigger env fallback in api/groq
        }

        // 2. Get Routing Chain
        const mapping = this.getMapping(task, settings);
        if (!mapping) {
            console.warn(`[AI OS] No mapping for ${task}. Using Legacy Groq.`);
            return await this.callGroqDriver(messages, "llama-3.1-8b-instant", "");
        }

        // 3. Try Primary -> Secondary -> Tertiary
        const chain = [
            { providerId: mapping.primaryProviderId, modelId: mapping.primaryModelId },
            { providerId: mapping.secondaryProviderId, modelId: mapping.secondaryModelId },
            { providerId: mapping.tertiaryProviderId, modelId: mapping.tertiaryModelId }
        ].filter(c => c.providerId && c.modelId);

        let lastError: any;

        for (const link of chain) {
            try {
                if (!link.providerId || !link.modelId) continue;

                const provider = settings.aiOsConfig?.providers.find(p => p.id === link.providerId);
                if (!provider || !provider.enabled) continue;

                // 4. Select Key (Round Robin / Active)
                const key = this.rotateKey(provider);
                if (!key) {
                    // console.warn(`No active keys for ${provider.name}`);
                    continue; // Skip to next provider if no keys
                }

                console.log(`[AI OS] Executing ${task} via ${provider.name} (${link.modelId})`);

                // 5. Call Driver
                const result = await this.callDriver(provider, link.modelId, key.key, messages, onStream);

                // 6. Track Usage
                incrementApiUsage(key.id, usageType);

                return result;

            } catch (error: any) {
                console.warn(`[AI OS] Failed on ${link.providerId}:`, error);
                lastError = error;
                // Continue to next link in chain
            }
        }

        throw lastError || new Error("All AI providers failed.");
    }

    private getMapping(task: AiTask, settings: SystemSettings): AiMapping | undefined {
        return settings.aiOsConfig?.mappings.find(m => m.task === task);
    }

    private rotateKey(provider: AiProviderConfig): { id: string, key: string } | null {
        if (!provider.keys || provider.keys.length === 0) return null;

        const activeKeys = provider.keys.filter(k => k.status === 'ACTIVE');
        if (activeKeys.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * activeKeys.length);
        return activeKeys[randomIndex];
    }

    private async callDriver(
        provider: AiProviderConfig,
        modelId: string,
        apiKey: string,
        messages: any[],
        onStream?: (text: string) => void
    ): Promise<string> {

        switch (provider.type) {
            case 'GROQ':
                if (onStream) return await this.callGroqStreamDriver(messages, modelId, apiKey, onStream);
                return await this.callGroqDriver(messages, modelId, apiKey);

            case 'OPENAI':
                return await this.callOpenAiCompatible(provider.baseUrl || "https://api.openai.com/v1/chat/completions", apiKey, modelId, messages);

            case 'DEEPSEEK':
                return await this.callOpenAiCompatible("https://api.deepseek.com/chat/completions", apiKey, modelId, messages);

            case 'MISTRAL':
                return await this.callOpenAiCompatible("https://api.mistral.ai/v1/chat/completions", apiKey, modelId, messages);

            case 'GEMINI':
                return await this.callGeminiDriver(apiKey, modelId, messages);

            default:
                // Try Generic OpenAI Compatible for Custom
                if (provider.baseUrl) {
                    return await this.callOpenAiCompatible(provider.baseUrl, apiKey, modelId, messages);
                }
                throw new Error(`Provider type ${provider.type} not supported.`);
        }
    }

    private async callGroqDriver(messages: any[], model: string, key: string): Promise<string> {
        const response = await fetch("/api/groq", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model,
                messages: messages,
                key: key
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq Error: ${response.status} - ${err}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    }

    private async callGroqStreamDriver(messages: any[], model: string, key: string, onChunk: (text: string) => void): Promise<string> {
        const response = await fetch("/api/groq", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model,
                messages: messages,
                key: key,
                stream: true
            })
        });

        if (!response.ok) throw new Error("Groq API Stream Error");
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

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

    private async callOpenAiCompatible(url: string, key: string, model: string, messages: any[]): Promise<string> {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error: ${response.status} - ${err}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    }

    private async callGeminiDriver(key: string, model: string, messages: any[]): Promise<string> {
        // Convert OpenAI messages to Gemini contents
        const contents = messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini Error: ${response.status} - ${err}`);
        }
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
}

export const aiManager = AiManager.getInstance();
