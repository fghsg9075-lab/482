import { db, rtdb, sanitizeForFirestore } from '../../firebase';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, increment } from 'firebase/firestore';
import { ref, set, get, update, onValue, runTransaction } from 'firebase/database';
import { AIProviderConfig, AIModelConfig, AIKey, AICanonicalMapping, AILog, SearchLog, AnyLog, AIProviderType, CanonicalModel } from './types';

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

export const toggleAIProvider = async (providerId: string, isEnabled: boolean) => {
    try {
        await updateDoc(doc(db, "ai_config", "providers", "list", providerId), { isEnabled });
    } catch (e) { console.error("Error toggling provider:", e); }
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

export const toggleAIModel = async (modelId: string, isEnabled: boolean) => {
    try {
        await updateDoc(doc(db, "ai_config", "models", "list", modelId), { isEnabled });
    } catch (e) { console.error("Error toggling model:", e); }
};

// --- KEYS (Stored Securely in Firestore, Usage in RTDB for speed) ---
export const saveAIKey = async (key: AIKey): Promise<boolean> => {
    try {
        console.log("Saving AI Key:", key);
        // Changed from ai_secure to ai_config to ensure visibility/permissions match other config
        await setDoc(doc(db, "ai_config", "keys", "list", key.id), sanitizeForFirestore(key));
        return true;
    } catch (e) {
        console.error("Error saving key:", e);
        return false;
    }
};

export const getAIKeys = async (providerId?: AIProviderType): Promise<AIKey[]> => {
    try {
        let q = collection(db, "ai_config", "keys", "list");
        const snap = await getDocs(q);
        let list = snap.docs.map(d => d.data() as AIKey);
        if (providerId) {
             list = list.filter(k => k.providerId === providerId);
        }
        return list;
    } catch (e) { console.error(e); return []; }
};

// --- REAL-TIME USAGE & HEALTH ---

// 1. Increment Usage (RTDB for speed + Firestore for persistence)
export const incrementKeyUsage = async (keyId: string, modelId: string, providerId: string) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // RTDB: High-frequency counters
        const usageRef = ref(rtdb, `ai_usage/${today}/${providerId}/${keyId}/usage`);
        runTransaction(usageRef, (currentValue) => {
            return (currentValue || 0) + 1;
        });

        // Firestore: Reliable stats (Updates the Key document itself)
        const keyRef = doc(db, "ai_config", "keys", "list", keyId);
        await updateDoc(keyRef, {
            usageCount: increment(1),
            dailyUsageCount: increment(1),
            lastUsed: new Date().toISOString()
        });

    } catch (e) { console.error("Usage Tracking Error:", e); }
};

// 2. Health Auto-Disable
export const recordModelFailure = async (modelId: string) => {
    try {
        // Using Firestore for Model State
        const modelRef = doc(db, "ai_config", "models", "list", modelId);

        // We need to read current error count or atomic increment it
        // Adding a 'transientErrorCount' field to AIModelConfig logic (even if not in interface yet, Firestore supports dynamic fields)

        await updateDoc(modelRef, {
            errorCount: increment(1)
        });

        // Check if limit exceeded (We need to read it to know)
        // Optimization: In a real system, a Cloud Function triggers on change.
        // Here, we fetch after update or just fetch first.
        const snap = await getDoc(modelRef);
        if (snap.exists()) {
            const data = snap.data();
            if ((data.errorCount || 0) > 3 && data.isEnabled) {
                console.warn(`DISABLE MODEL ${modelId}: Too many errors.`);
                await updateDoc(modelRef, { isEnabled: false, errorCount: 0 });
            }
        }
    } catch (e) { console.error("Health Check Error:", e); }
};

export const resetModelFailure = async (modelId: string) => {
    try {
        const modelRef = doc(db, "ai_config", "models", "list", modelId);
        await updateDoc(modelRef, { errorCount: 0 });
    } catch (e) {
        // Ignore if doc doesn't exist or other minor errors
    }
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
        await set(ref(rtdb, `ai_logs/${log.id}`), sanitizeForFirestore(log));
    } catch (e) { console.error("Error logging AI:", e); }
};

export const logSearchRequest = async (log: SearchLog) => {
    try {
        await set(ref(rtdb, `ai_logs/${log.id}`), sanitizeForFirestore(log));
    } catch (e) { console.error("Error logging Search:", e); }
};

export const subscribeToAILogs = (callback: (logs: AnyLog[]) => void) => {
    const logsRef = ref(rtdb, 'ai_logs');
    return onValue(logsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const logs = Object.values(data) as AnyLog[];
            // Sort by timestamp (Handling both string ISO and number epoch)
            logs.sort((a, b) => {
                // Normalize to Milliseconds
                // SearchLog: 'time' (Seconds) -> * 1000
                // AILog: 'timestamp' (ISO String) -> Date.parse()
                const getMs = (log: any) => {
                    if (log.time) return log.time * 1000;
                    if (log.timestamp) return new Date(log.timestamp).getTime();
                    return 0;
                };

                const tA = getMs(a);
                const tB = getMs(b);
                return tB - tA;
            });
            callback(logs.slice(0, 50));
        } else {
            callback([]);
        }
    });
};
