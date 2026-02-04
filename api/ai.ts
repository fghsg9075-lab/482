export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const body = await req.json();
        const { provider, apiKey, model, messages } = body;

        if (!provider || !apiKey || !messages) {
            return new Response(JSON.stringify({ error: "Missing required fields (provider, apiKey, messages)" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        let url = '';
        let headers: any = { 'Content-Type': 'application/json' };
        let payload: any = {};

        if (provider === 'groq') {
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            payload = {
                model: model || 'llama-3.1-8b-instant',
                messages,
                temperature: 0.7
            };
        } else if (provider === 'openai') {
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            payload = {
                model: model || 'gpt-3.5-turbo',
                messages
            };
        } else if (provider === 'deepseek') {
             url = 'https://api.deepseek.com/chat/completions';
             headers['Authorization'] = `Bearer ${apiKey}`;
             payload = {
                model: model || 'deepseek-chat',
                messages
            };
        } else if (provider === 'gemini') {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
            // Gemini expects "contents": [{ "parts": [{"text": "..."}] }]
            // We need to convert standard messages to Gemini format
            const contents = messages.map((m: any) => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }));
            payload = { contents };
        } else {
             return new Response(JSON.stringify({ error: `Unknown Provider: ${provider}` }), {
                 status: 400,
                 headers: { "Content-Type": "application/json" }
             });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
