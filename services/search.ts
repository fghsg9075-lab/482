export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
}

export const searchWeb = async (query: string, apiKey: string, cx: string): Promise<string> => {
    if (!apiKey || !cx) {
        console.warn("Search skipped: Missing API Key or CX");
        return "";
    }

    try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("Google Search Error:", data.error);
            return "";
        }

        if (!data.items || data.items.length === 0) {
            return "No web results found.";
        }

        // Format results for AI Context
        const snippets = data.items.slice(0, 5).map((item: any) =>
            `- [${item.title}](${item.link}): ${item.snippet}`
        ).join("\n");

        return `WEB SEARCH RESULTS (Use these for current examples & facts):\n${snippets}`;

    } catch (error) {
        console.error("Search Fetch Failed:", error);
        return "";
    }
};
