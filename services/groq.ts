import {
    fetchChapters,
    fetchLessonContent,
    generateCustomNotes,
    generateUltraAnalysis,
    translateToHindi
} from './contentGenerator';
import { executeCanonical } from './ai/router';

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
