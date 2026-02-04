import { db, rtdb, sanitizeForFirestore } from '../../firebase';
import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, updateDoc } from 'firebase/firestore';
import { ref, set, get, update, onValue } from 'firebase/database';
import { AIProviderConfig, AIModelConfig, AIKey, AICanonicalMapping, AILog, AIProviderType, CanonicalModel } from './types';

// --- PROVIDERS ---
export const saveAIProvider = async (provider: AIProviderConfig) => {
    try {
        await setDoc(doc(db, "ai_config", "providers", "list", provider.id), provider);
    } catch (e) { console.error("Error saving provider:", e); }
};

export const getAIProviders = async (): Promise<AIProviderConfig[]> => {
    try {
        const snap = await getDocs(collection(db, "ai_config", "providers", "list"));
        return snap.docs.map(d => d.data() as AIProviderConfig);
    } catch (e) { console.error(e); return []; }
};

// --- MODELS ---
export const saveAIModel = async (model: AIModelConfig) => {
    try {
        await setDoc(doc(db, "ai_config", "models", "list", model.id), model);
    } catch (e) { console.error("Error saving model:", e); }
};

export const getAIModels = async (): Promise<AIModelConfig[]> => {
    try {
        const snap = await getDocs(collection(db, "ai_config", "models", "list"));
        return snap.docs.map(d => d.data() as AIModelConfig);
    } catch (e) { console.error(e); return []; }
};

// --- KEYS (Stored Securely in Firestore, Usage in RTDB for speed) ---
export const saveAIKey = async (key: AIKey) => {
    try {
        // Save sensitive key data to Firestore (Secure)
        await setDoc(doc(db, "ai_secure", "keys", "list", key.id), key);
    } catch (e) { console.error("Error saving key:", e); }
};

export const getAIKeys = async (providerId?: AIProviderType): Promise<AIKey[]> => {
    try {
        let q = collection(db, "ai_secure", "keys", "list");
        if (providerId) {
             // Basic filtering
             // In a real app, we'd use a Firestore Query, but for admin fetching all is fine usually
             const snap = await getDocs(q);
             return snap.docs.map(d => d.data() as AIKey).filter(k => k.providerId === providerId);
        }
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as AIKey);
    } catch (e) { console.error(e); return []; }
};

export const updateKeyUsage = async (keyId: string, success: boolean) => {
    // We use RTDB for high-frequency counters to avoid Firestore writes ($$)
    try {
        const today = new Date().toISOString().split('T')[0];
        const path = `ai_usage/${today}/${keyId}`;
        // Note: This needs atomic increment, using simplified logic for now
        // In a real high-scale system, use Cloud Functions or atomic increments
    } catch (e) {}
};

// --- CANONICAL MAPPINGS ---
export const saveCanonicalMapping = async (mapping: AICanonicalMapping) => {
    try {
        await setDoc(doc(db, "ai_config", "mappings", "list", mapping.canonicalModel), mapping);
    } catch (e) { console.error("Error saving mapping:", e); }
};

export const getCanonicalMappings = async (): Promise<Record<CanonicalModel, AICanonicalMapping>> => {
    try {
        const snap = await getDocs(collection(db, "ai_config", "mappings", "list"));
        const mappings: any = {};
        snap.docs.forEach(d => {
            const data = d.data() as AICanonicalMapping;
            mappings[data.canonicalModel] = data;
        });
        return mappings;
    } catch (e) { console.error(e); return {} as any; }
};

// --- LOGGING ---
export const logAIRequest = async (log: AILog) => {
    try {
        // RTDB for realtime logs (tailing)
        await set(ref(rtdb, `ai_logs/${log.id}`), sanitizeForFirestore(log));
        // Firestore for long-term stats (optional)
        // await setDoc(doc(db, "ai_logs", log.id), log);
    } catch (e) { console.error("Error logging AI:", e); }
};

export const subscribeToAILogs = (callback: (logs: AILog[]) => void) => {
    const logsRef = ref(rtdb, 'ai_logs');
    // Limit to last 50 for performance
    // Note: RTDB sorting/limiting requires proper indexes, here we just fetch recent
    return onValue(logsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const logs = Object.values(data) as AILog[];
            logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            callback(logs.slice(0, 50));
        } else {
            callback([]);
        }
    });
};
