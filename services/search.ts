import { SystemSettings } from "../types";

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
}

export const performWebSearch = async (query: string, settings?: SystemSettings): Promise<string> => {
    // 1. Check if keys exist
    if (!settings?.googleSearchApiKey || !settings?.googleSearchCxId) {
        console.warn("[Search] Missing Google Search API Key or CX ID. RAG Skipped.");
        return "";
    }

    try {
        const apiKey = settings.googleSearchApiKey;
        const cxId = settings.googleSearchCxId;
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}&num=3`;

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Search] API Error: ${response.statusText}`);
            return "";
        }

        const data = await response.json();
        const items = data.items || [];

        if (items.length === 0) return "";

        // Format for AI Injection
        const context = items.map((item: any, idx: number) => {
            return `[${idx+1}] ${item.title}: ${item.snippet}`;
        }).join('\n');

        return `\n[WEB CONTEXT START]\n${context}\n[WEB CONTEXT END]\n`;

    } catch (error) {
        console.error("[Search] Failed:", error);
        return "";
    }
};
