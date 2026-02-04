import { rtdb, db, sanitizeForFirestore } from '../firebase';
import { ref, get, set, update } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AiSystemConfig, DEFAULT_AI_CONFIG, AiKey } from '../types/ai-os';
import { GoogleGenerativeAI } from "@google/generative-ai";

class AiOsService {
    private config: AiSystemConfig | null = null;
    private configLoaded = false;

    // --- CONFIGURATION ---
    async getConfig(): Promise<AiSystemConfig> {
        if (this.config) return this.config;

        try {
            // Try RTDB for speed
            const snap = await get(ref(rtdb, 'ai_os_config'));
            if (snap.exists()) {
                this.config = snap.val();
                this.configLoaded = true;
                return this.config!;
            }

            // Fallback to Firestore
            const docSnap = await getDoc(doc(db, 'config', 'ai_os'));
            if (docSnap.exists()) {
                this.config = docSnap.data() as AiSystemConfig;
                this.configLoaded = true;
                return this.config!;
            }
        } catch (e) {
            console.error("Failed to load AI Config", e);
        }

        // Return Default if not found
        this.config = DEFAULT_AI_CONFIG;
        return this.config!;
    }

    async saveConfig(newConfig: AiSystemConfig) {
        this.config = newConfig;
        const sanitized = sanitizeForFirestore(newConfig);
        try {
            await set(ref(rtdb, 'ai_os_config'), sanitized);
            await setDoc(doc(db, 'config', 'ai_os'), sanitized);
        } catch (e) {
            console.error("Failed to save AI Config", e);
            throw e;
        }
    }

    // --- EXECUTION ENGINE ---
    async execute(
        taskType: string,
        messages: any[],
        usageType: 'PILOT' | 'STUDENT' = 'STUDENT',
        onStream?: (text: string) => void
    ): Promise<string> {
        const config = await this.getConfig();
        const route = config.routes[taskType] || config.routes['NOTES_ENGINE']; // Default Route

        // 1. Try Primary
        try {
            return await this.executeProvider(route.primaryProvider, route.primaryModel, messages, onStream);
        } catch (e) {
            console.warn(`Primary Provider (${route.primaryProvider}) Failed:`, e);

            // 2. Try Fallback
            if (route.fallbackProvider) {
                console.log(`Switching to Fallback: ${route.fallbackProvider}`);
                try {
                    return await this.executeProvider(route.fallbackProvider, route.fallbackModel, messages, onStream);
                } catch (e2) {
                    console.error(`Fallback Provider (${route.fallbackProvider}) Failed:`, e2);
                }
            }

            // 3. Try Tertiary
            if (route.tertiaryProvider) {
                console.log(`Switching to Tertiary: ${route.tertiaryProvider}`);
                try {
                    return await this.executeProvider(route.tertiaryProvider, route.tertiaryModel, messages, onStream);
                } catch (e3) {
                    console.error(`Tertiary Provider (${route.tertiaryProvider}) Failed:`, e3);
                }
            }

            throw new Error("All AI Providers Failed. System Overload.");
        }
    }

    private async executeProvider(
        providerId: string,
        modelId: string | undefined,
        messages: any[],
        onStream?: (text: string) => void
    ): Promise<string> {
        const config = await this.getConfig();
        const provider = config.providers[providerId];

        if (!provider || !provider.enabled) {
            throw new Error(`Provider ${providerId} is disabled or missing.`);
        }

        // KEY ROTATION
        const validKeys = provider.keys.filter(k => k.status === 'ACTIVE');
        if (validKeys.length === 0) {
            throw new Error(`No active keys for ${providerId}`);
        }

        const key = validKeys[Math.floor(Math.random() * validKeys.length)];

        try {
            const result = await this.callProviderDirect(providerId, key.key, modelId || provider.models[0].id, messages, onStream);

            // Log Success (Async)
            this.logUsage(providerId, key.key, true);

            return result;
        } catch (e: any) {
            // Log Failure
            this.logUsage(providerId, key.key, false, e.message);

            // If 401 (Auth) or 429 (Rate Limit), mark key status
            if (e.message.includes('401') || e.message.includes('429')) {
                await this.updateKeyStatus(providerId, key.key, e.message.includes('401') ? 'REVOKED' : 'RATE_LIMITED');

                // Retry with another key if available
                const otherKeys = validKeys.filter(k => k.key !== key.key);
                if (otherKeys.length > 0) {
                     console.log(`Retrying ${providerId} with different key...`);
                     return this.executeProvider(providerId, modelId, messages, onStream); // Recursive retry
                }
            }
            throw e;
        }
    }

    private async callProviderDirect(
        provider: string,
        apiKey: string,
        model: string,
        messages: any[],
        onStream?: (text: string) => void
    ): Promise<string> {

        // --- OPENAI COMPATIBLE (Groq, OpenAI, DeepSeek, Mistral) ---
        if (['groq', 'openai', 'deepseek', 'mistral', 'openrouter'].includes(provider)) {
            let baseUrl = "";
            switch(provider) {
                case 'groq': baseUrl = "https://api.groq.com/openai/v1/chat/completions"; break;
                case 'openai': baseUrl = "https://api.openai.com/v1/chat/completions"; break;
                case 'deepseek': baseUrl = "https://api.deepseek.com/chat/completions"; break;
                case 'mistral': baseUrl = "https://api.mistral.ai/v1/chat/completions"; break;
                case 'openrouter': baseUrl = "https://openrouter.ai/api/v1/chat/completions"; break;
            }

            const response = await fetch(baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: !!onStream
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`${provider.toUpperCase()} API Error: ${response.status} - ${err}`);
            }

            if (onStream) {
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let fullText = "";

                if (!reader) throw new Error("Response body is null");

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                            try {
                                const json = JSON.parse(line.substring(6));
                                const content = json.choices[0]?.delta?.content || "";
                                if (content) {
                                    fullText += content;
                                    onStream(fullText);
                                }
                            } catch (e) {
                                // Partial JSON, ignore
                            }
                        }
                    }
                }
                return fullText;
            } else {
                const data = await response.json();
                return data.choices[0].message.content;
            }
        }

        // --- GEMINI (Google) ---
        if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(apiKey);
            const genModel = genAI.getGenerativeModel({ model: model });

            // Convert messages to Gemini format
            const history = messages.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
            const lastMessage = messages[messages.length - 1].content;

            if (onStream) {
                const result = await genModel.generateContentStream({
                    contents: [...history, { role: 'user', parts: [{ text: lastMessage }] }]
                });

                let fullText = "";
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    fullText += chunkText;
                    onStream(fullText);
                }
                return fullText;
            } else {
                const result = await genModel.generateContent({
                    contents: [...history, { role: 'user', parts: [{ text: lastMessage }] }]
                });
                return result.response.text();
            }
        }

        throw new Error(`Provider ${provider} not implemented yet.`);
    }

    // --- USAGE TRACKING ---
    private async logUsage(providerId: string, key: string, success: boolean, error?: string) {
        try {
             const config = await this.getConfig();
             const pConfig = config.providers[providerId];
             const keyIndex = pConfig.keys.findIndex(k => k.key === key);

             if (keyIndex >= 0) {
                 update(ref(rtdb, `ai_os_stats/${providerId}/key_${keyIndex}`), {
                     usage: { '.sv': { 'increment': 1 } },
                     errors: success ? 0 : { '.sv': { 'increment': 1 } }
                 });
             }
        } catch(e) {
            console.error("Stats Log Error", e);
        }
    }

    private async updateKeyStatus(providerId: string, keyVal: string, status: AiKey['status']) {
        const config = await this.getConfig();
        const p = config.providers[providerId];
        const kIdx = p.keys.findIndex(k => k.key === keyVal);
        if (kIdx >= 0) {
            p.keys[kIdx].status = status;
            await this.saveConfig(config);
        }
    }
}

export const AiOs = new AiOsService();
