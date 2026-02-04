export {
    fetchChapters,
    fetchLessonContent,
    generateCustomNotes,
    generateUltraAnalysis,
    translateToHindi
} from './contentGenerator';

// Legacy shim for direct calls
export const callGroqApi = async (messages: any[], model: string = "llama-3.1-8b-instant") => {
    const { executeCanonical } = require('./ai/router');
    const prompt = messages[messages.length - 1].content;
    const system = messages.find((m: any) => m.role === 'system')?.content;
    
    return await executeCanonical({
        canonicalModel: 'NOTES_ENGINE', // Default
        prompt,
        systemPrompt: system
    });
};
