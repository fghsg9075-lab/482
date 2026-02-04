export {
    fetchChapters,
    fetchLessonContent,
    generateCustomNotes,
    generateUltraAnalysis,
    translateToHindi
} from './contentGenerator';

import { executeCanonicalRaw } from './ai/router';

// Refactored to use AI OS Router
export const callGeminiApiWithTools = async (messages: any[], tools: any[], modelName: string = "gemini-1.5-flash") => {
    // Construct prompt from messages (simple concatenation for now, or last message)
    // A robust chat engine handles history, but for this admin tool helper, last message + system is common pattern.
    
    const lastMsg = messages[messages.length - 1].content;
    const systemMsg = messages.find((m: any) => m.role === 'system')?.content;
    
    try {
        const response = await executeCanonicalRaw({
            canonicalModel: 'ADMIN_ENGINE', // Configured in AI Control Tower
            prompt: lastMsg,
            systemPrompt: systemMsg,
            tools: tools,
            userId: 'ADMIN'
        });

        // Map AIResponse back to the expected legacy format for AdminAiAssistant
        return {
            content: response.content,
            tool_calls: response.toolCalls ? response.toolCalls.map((tc: any) => ({
                function: {
                    name: tc.name || tc.function.name, // Handle different provider formats if needed
                    arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || tc.function.arguments)
                }
            })) : []
        };
    } catch (e: any) {
        console.error("Admin AI Error via OS:", e);
        return {
            content: `System Error: ${e.message}`,
            tool_calls: []
        };
    }
};

export const executeWithRotation = async <T>(operation: any, usageType: any): Promise<T> => {
    // Deprecated shim - functions calling this should be using contentGenerator.ts
    // If anything still calls this, we return a mock object to prevent crash,
    // but log a warning.
    console.warn("Legacy executeWithRotation called. Please migrate to executeCanonical.");
    return await operation({
        getGenerativeModel: () => ({
            generateContent: async () => ({ response: { text: () => "Legacy Call - Functionality Moved to AI OS." } })
        })
    });
};
