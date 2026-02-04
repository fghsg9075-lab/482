import { executeCanonical } from './ai/router';
export * from './contentGenerator';

// Legacy shim for direct calls
export const callGroqApi = async (messages: any[], model: string = "llama-3.1-8b-instant") => {
    const prompt = messages[messages.length - 1].content;
    const system = messages.find((m: any) => m.role === 'system')?.content;
    
    return await executeCanonical({
        canonicalModel: 'NOTES_ENGINE', // Default
        prompt,
        systemPrompt: system
    });
};

export const generateDevCode = async (userPrompt: string): Promise<string> => {
    return await executeCanonical({
        canonicalModel: 'NOTES_ENGINE', // Use the strongest model available
        prompt: `You are an expert React/TypeScript developer.
        TASK: ${userPrompt}

        OUTPUT RULES:
        1. Return ONLY the code (or explanation if requested).
        2. If writing a component, use Tailwind CSS.
        3. Be concise and professional.`,
    });
};
