import { AiTask, SystemSettings } from '../types';

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
     * Main Entry Point (Client Side Wrapper)
     */
    public async execute(
        task: AiTask,
        messages: any[],
        settings: SystemSettings, // Kept for signature compatibility, but unused for routing now
        usageType: 'PILOT' | 'STUDENT' = 'STUDENT',
        onStream?: (text: string) => void
    ): Promise<string> {

        // 1. Call Server Proxy
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task,
                messages,
                stream: !!onStream
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`AI Gateway Error: ${response.status} - ${error}`);
        }

        // 2. Handle Streaming
        if (onStream) {
            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let accumulated = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.trim().startsWith('data: ')) {
                        const jsonStr = line.trim().substring(6);
                        if (jsonStr === '[DONE]') return accumulated;
                        try {
                            const json = JSON.parse(jsonStr);
                            const content = json.choices?.[0]?.delta?.content || "";
                            if (content) {
                                accumulated += content;
                                onStream(accumulated);
                            }
                        } catch (e) {}
                    }
                }
            }
            return accumulated;
        }

        // 3. Handle One-Shot
        const data = await response.json();
        return data.content;
    }
}

export const aiManager = AiManager.getInstance();
