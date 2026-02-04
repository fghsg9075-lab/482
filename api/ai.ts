import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDatabase, ref, get, child, update } from 'firebase/database';
import { AiProviderConfig, AiMapping } from '../types';
import { increment } from 'firebase/firestore';

// Re-use config from firebase.ts (Conceptually)
// NOTE: In production, ensure these ENV variables are set for the Server Runtime
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDNAarkY9MquMpJzKuXt4BayK6AHGImyr0",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "dec2025-96ecd.firebaseapp.com",
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://dec2025-96ecd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "dec2025-96ecd",
};

// Initialize Firebase (Server-side instance)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const rtdb = getDatabase(app);

export const config = {
    runtime: 'nodejs', // streaming support
};

// Helper for usage tracking
async function incrementUsage(keyId: string, type: 'STREAM' | 'ONESHOT') {
    try {
        const date = new Date().toISOString().split('T')[0];
        const docRef = doc(db, "admin_stats", `api_usage_${date}`);
        const safeKey = String(keyId).replace(/[.#$/\[\]]/g, '_');

        const updates: any = {
            [`key_${safeKey}`]: increment(1),
            total: increment(1)
        };
        await updateDoc(docRef, updates).catch(async () => {
            // Create if missing
            const { setDoc } = await import('firebase/firestore');
            await setDoc(docRef, updates);
        });
    } catch(e) {
        console.error("Usage Tracking Failed:", e);
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { task, messages, stream } = req.body;

        // 1. Fetch Config from Secure Path
        let aiConfig = await getAiConfig();

        if (!aiConfig || !aiConfig.globalEnabled) {
            // Fallback to legacy env vars if no config
            // For now, fail if not configured, or fallback to a default if keys exist in env
            console.log("AI Config missing or disabled. Checking Env...");
        }

        // 2. Resolve Provider/Model for Task
        const mapping = aiConfig?.mappings?.find((m: any) => m.task === task);

        // Chain of providers to try
        const chain = mapping ? [
            { pId: mapping.primaryProviderId, mId: mapping.primaryModelId },
            { pId: mapping.secondaryProviderId, mId: mapping.secondaryModelId },
            { pId: mapping.tertiaryProviderId, mId: mapping.tertiaryModelId }
        ] : [];

        // Add a default fallback if chain is empty (e.g. env var fallback)
        if (chain.length === 0) {
             // Basic Fallback Logic
             chain.push({ pId: 'groq', mId: 'llama-3.1-8b-instant' });
        }

        let lastError = null;

        for (const link of chain) {
            if (!link.pId || !link.mId) continue;

            const provider = aiConfig?.providers?.find((p: any) => p.id === link.pId) || getFallbackProvider(link.pId);
            if (!provider || !provider.enabled) continue;

            // 3. Key Rotation
            const keyObj = rotateKey(provider);
            if (!keyObj) {
                console.warn(`No active keys for ${provider.name}`);
                continue;
            }

            try {
                // 4. Call Real AI
                if (stream) {
                    // Set headers for SSE
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    });

                    await streamResponse(provider, link.mId, keyObj.key, messages, res);
                    incrementUsage(keyObj.id, 'STREAM'); // Async tracking
                    return; // End response handled in streamResponse
                } else {
                    const result = await callProvider(provider, link.mId, keyObj.key, messages);
                    incrementUsage(keyObj.id, 'ONESHOT');
                    return res.status(200).json({ content: result });
                }

            } catch (err: any) {
                console.error(`Failed on ${provider.name}:`, err.message);
                lastError = err;
                // Try next in chain
            }
        }

        return res.status(500).json({ error: "All AI Providers Failed", details: lastError?.message });

    } catch (error: any) {
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}

// --- HELPERS ---

async function getAiConfig() {
    try {
        const docRef = doc(db, 'admin_secure', 'ai_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) return snap.data();
    } catch (e) {
        console.error("Config Fetch Error:", e);
    }
    return null;
}

function getFallbackProvider(id: string): any {
    // Fallback if DB config is missing but Env vars exist
    if (id === 'groq' && process.env.GROQ_API_KEYS) {
        return {
            type: 'GROQ',
            name: 'Groq (Env)',
            keys: process.env.GROQ_API_KEYS.split(',').map((k, i) => ({ id: `env-groq-${i}`, key: k.trim(), status: 'ACTIVE' })),
            enabled: true
        };
    }
    if (id === 'openai' && process.env.OPENAI_API_KEY) {
        return {
            type: 'OPENAI',
            name: 'OpenAI (Env)',
            keys: [{ id: 'env-openai', key: process.env.OPENAI_API_KEY, status: 'ACTIVE' }],
            enabled: true
        };
    }
    return null;
}

function rotateKey(provider: any) {
    if (!provider.keys || provider.keys.length === 0) return null;
    const active = provider.keys.filter((k: any) => k.status === 'ACTIVE');
    if (active.length === 0) return null;
    return active[Math.floor(Math.random() * active.length)];
}

async function callProvider(provider: any, model: string, key: string, messages: any[]) {
    let url = "";
    let headers: any = { "Content-Type": "application/json" };
    let body: any = {};

    switch (provider.type) {
        case 'GROQ':
            url = "https://api.groq.com/openai/v1/chat/completions";
            headers["Authorization"] = `Bearer ${key}`;
            body = { model, messages, temperature: 0.7 };
            break;
        case 'OPENAI':
            url = "https://api.openai.com/v1/chat/completions";
            headers["Authorization"] = `Bearer ${key}`;
            body = { model, messages, temperature: 0.7 };
            break;
        case 'GEMINI':
            url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            const contents = messages.map((m: any) => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }));
            body = { contents };
            break;
        // Add others...
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(await resp.text());

    const data = await resp.json();

    if (provider.type === 'GEMINI') return data.candidates[0].content.parts[0].text;
    return data.choices[0].message.content;
}

async function streamResponse(provider: any, model: string, key: string, messages: any[], res: any) {
    let url = "";
    let headers: any = { "Content-Type": "application/json" };
    let body: any = {};

    // Standard OpenAI Compatible Streaming
    if (['GROQ', 'OPENAI', 'DEEPSEEK', 'MISTRAL'].includes(provider.type)) {
        if (provider.type === 'GROQ') url = "https://api.groq.com/openai/v1/chat/completions";
        if (provider.type === 'OPENAI') url = "https://api.openai.com/v1/chat/completions";

        headers["Authorization"] = `Bearer ${key}`;
        body = { model, messages, stream: true, temperature: 0.7 };

        const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        if (!resp.ok) throw new Error(await resp.text());
        if (!resp.body) throw new Error("No body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                    const jsonStr = line.trim().substring(6);
                    if (jsonStr === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        continue;
                    }
                    try {
                        const json = JSON.parse(jsonStr);
                        // Forward chunks to client
                        res.write(`data: ${JSON.stringify(json)}\n\n`);
                    } catch (e) {}
                }
            }
        }
        res.end();
    } else {
        // Fallback for non-streaming (Gemini simple wrap)
        const text = await callProvider(provider, model, key, messages);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    }
}
