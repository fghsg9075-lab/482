import React, { useState, useEffect } from 'react';
import { SystemSettings, AiProviderConfig, AiKey, AiModelConfig, AiTask, AiMapping, AiProviderType } from '../../types';
import { Save, Plus, Trash2, Key, Activity, Server, Shuffle, Play, CheckCircle, AlertTriangle, X, Edit3, Lock, Unlock } from 'lucide-react';
import { aiManager } from '../../services/AiOs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (s: SystemSettings) => void;
}

const DEFAULT_PROVIDERS: AiProviderConfig[] = [
    {
        id: 'groq', name: 'Groq', type: 'GROQ', enabled: true, keys: [],
        models: [
            { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', enabled: true },
            { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', enabled: true },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', enabled: true }
        ]
    },
    {
        id: 'openai', name: 'OpenAI', type: 'OPENAI', enabled: true, keys: [],
        models: [
            { id: 'gpt-4o', name: 'GPT-4o', enabled: true },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', enabled: true },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', enabled: true }
        ]
    },
    {
        id: 'gemini', name: 'Gemini', type: 'GEMINI', enabled: true, keys: [],
        models: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', enabled: true },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', enabled: true }
        ]
    }
];

const TASKS: AiTask[] = ['NOTES_ENGINE', 'MCQ_ENGINE', 'CHAT_ENGINE', 'PILOT_ENGINE', 'ANALYSIS_ENGINE'];

export const AiControlTower: React.FC<Props> = ({ settings, onUpdateSettings }) => {

    const [config, setConfig] = useState<any>({ providers: DEFAULT_PROVIDERS, mappings: [], globalEnabled: true, safetyLock: false });
    const [loadingConfig, setLoadingConfig] = useState(true);

    // Fetch Config from Secure Firestore Path (Not SystemSettings)
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, 'admin_secure', 'ai_config');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setConfig(snap.data());
                } else {
                    // Initialize if missing
                    const initialConfig = {
                        globalEnabled: true,
                        safetyLock: false,
                        providers: DEFAULT_PROVIDERS,
                        mappings: TASKS.map(t => ({
                            task: t,
                            primaryProviderId: 'groq',
                            primaryModelId: 'llama-3.1-8b-instant'
                        }))
                    };
                    setConfig(initialConfig);
                    await setDoc(docRef, initialConfig);
                }
            } catch (e) {
                console.error("Failed to load AI Config", e);
            } finally {
                setLoadingConfig(false);
            }
        };
        fetchConfig();
    }, []);

    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROVIDERS' | 'ROUTING' | 'TEST_LAB'>('OVERVIEW');
    const [editingProvider, setEditingProvider] = useState<AiProviderConfig | null>(null);
    const [testPrompt, setTestPrompt] = useState('Explain gravity in one sentence.');
    const [testResult, setTestResult] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testTask, setTestTask] = useState<AiTask>('NOTES_ENGINE');

    const updateConfig = async (newParts: any) => {
        const newConfig = { ...config, ...newParts };
        setConfig(newConfig);
        try {
            await setDoc(doc(db, 'admin_secure', 'ai_config'), newConfig);
        } catch (e) {
            console.error("Failed to save config", e);
            alert("Failed to save changes to secure storage.");
        }
    };

    const handleAddKey = (providerId: string, keyValue: string) => {
        if (!keyValue.trim()) return;
        const updatedProviders = config.providers.map(p => {
            if (p.id === providerId) {
                return {
                    ...p,
                    keys: [...p.keys, {
                        id: `key-${Date.now()}`,
                        key: keyValue.trim(),
                        usage: 0,
                        limit: 10000,
                        status: 'ACTIVE',
                        lastUsed: new Date().toISOString()
                    } as AiKey]
                };
            }
            return p;
        });
        updateConfig({ providers: updatedProviders });
    };

    const runTest = async () => {
        setIsTesting(true);
        setTestResult('Connecting to Neural Core...');
        try {
            // We pass the LOCAL config to the manager for immediate testing feedback
            // But ideally, the server should read the DB.
            // Since we just saved to DB, the server *should* see it.
            const res = await aiManager.execute(testTask, [{ role: 'user', content: testPrompt }], settings); // settings is unused now in execute
            setTestResult(res);
        } catch (e: any) {
            setTestResult(`ERROR: ${e.message}`);
        } finally {
            setIsTesting(false);
        }
    };

    if (loadingConfig) return <div className="p-10 text-center">Loading Secure Config...</div>;

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            {/* HEADER */}
            <div className="bg-slate-900 text-white p-6 rounded-b-[3rem] shadow-2xl mb-8">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/50">
                            <Activity size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">AI Control Tower</h1>
                            <p className="text-blue-200 font-medium text-sm">Neural Orchestration Layer • v1.0</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {/* KILL SWITCH */}
                        <button
                            onClick={() => updateConfig({ safetyLock: !config.safetyLock })}
                            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 border-2 transition-all ${config.safetyLock ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                        >
                            {config.safetyLock ? <Lock size={18} /> : <Unlock size={18} />}
                            {config.safetyLock ? 'SYSTEM LOCKED' : 'SYSTEM ACTIVE'}
                        </button>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex justify-center gap-2 mt-8">
                    {['OVERVIEW', 'PROVIDERS', 'ROUTING', 'TEST_LAB'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-2 rounded-full font-bold text-xs tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                            {tab.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6">

                {/* OVERVIEW */}
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase">Active Providers</p>
                            <p className="text-4xl font-black text-slate-800 mt-2">{config.providers.filter(p => p.enabled).length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase">Total Keys</p>
                            <p className="text-4xl font-black text-blue-600 mt-2">{config.providers.reduce((acc, p) => acc + p.keys.length, 0)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase">System Health</p>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                                <p className="text-xl font-bold text-green-600">Operational</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* PROVIDERS */}
                {activeTab === 'PROVIDERS' && (
                    <div className="space-y-6">
                        {config.providers.map(provider => (
                            <div key={provider.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg ${provider.enabled ? 'bg-slate-900' : 'bg-slate-300'}`}>
                                            {provider.name[0]}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">{provider.name}</h3>
                                            <p className="text-xs text-slate-500 font-mono">{provider.type} • {provider.models.length} Models</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const updated = config.providers.map(p => p.id === provider.id ? { ...p, enabled: !p.enabled } : p);
                                                updateConfig({ providers: updated });
                                            }}
                                            className={`px-4 py-2 rounded-lg font-bold text-xs ${provider.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                                        >
                                            {provider.enabled ? 'ENABLED' : 'DISABLED'}
                                        </button>
                                    </div>
                                </div>

                                {/* KEYS SECTION */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4">
                                    <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2"><Key size={16}/> API Keys</h4>
                                    <div className="space-y-2">
                                        {provider.keys.map(key => (
                                            <div key={key.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${key.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                    <code className="text-xs font-bold text-slate-600">{key.key.slice(0, 8)}...{key.key.slice(-4)}</code>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-bold text-slate-400">{key.usage} calls</span>
                                                    <button
                                                        onClick={() => {
                                                            const updated = config.providers.map(p => {
                                                                if (p.id === provider.id) {
                                                                    return { ...p, keys: p.keys.filter(k => k.id !== key.id) };
                                                                }
                                                                return p;
                                                            });
                                                            updateConfig({ providers: updated });
                                                        }}
                                                        className="text-red-400 hover:text-red-600"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Paste new API Key..."
                                            className="flex-1 p-2 rounded-lg border border-slate-200 text-sm"
                                            id={`new-key-${provider.id}`}
                                        />
                                        <button
                                            onClick={() => {
                                                const input = document.getElementById(`new-key-${provider.id}`) as HTMLInputElement;
                                                handleAddKey(provider.id, input.value);
                                                input.value = '';
                                            }}
                                            className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs"
                                        >
                                            Add Key
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ROUTING */}
                {activeTab === 'ROUTING' && (
                    <div className="space-y-6">
                        {config.mappings.map((mapping, idx) => (
                            <div key={mapping.task} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                        <Shuffle size={20} />
                                    </div>
                                    <h3 className="font-bold text-slate-800">{mapping.task}</h3>
                                </div>

                                <div className="space-y-4">
                                    {/* PRIMARY */}
                                    <div className="flex items-center gap-4">
                                        <span className="w-24 text-xs font-bold text-green-600 uppercase">Primary</span>
                                        <select
                                            value={mapping.primaryProviderId}
                                            onChange={(e) => {
                                                const newMappings = [...config.mappings];
                                                newMappings[idx].primaryProviderId = e.target.value;
                                                // Reset model
                                                const p = config.providers.find(x => x.id === e.target.value);
                                                if (p) newMappings[idx].primaryModelId = p.models[0]?.id || '';
                                                updateConfig({ mappings: newMappings });
                                            }}
                                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                                        >
                                            {config.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <select
                                            value={mapping.primaryModelId}
                                            onChange={(e) => {
                                                const newMappings = [...config.mappings];
                                                newMappings[idx].primaryModelId = e.target.value;
                                                updateConfig({ mappings: newMappings });
                                            }}
                                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        >
                                            {config.providers.find(p => p.id === mapping.primaryProviderId)?.models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* SECONDARY */}
                                    <div className="flex items-center gap-4 opacity-75">
                                        <span className="w-24 text-xs font-bold text-yellow-600 uppercase">Fallback 1</span>
                                        <select
                                            value={mapping.secondaryProviderId || ''}
                                            onChange={(e) => {
                                                const newMappings = [...config.mappings];
                                                newMappings[idx].secondaryProviderId = e.target.value;
                                                const p = config.providers.find(x => x.id === e.target.value);
                                                if (p) newMappings[idx].secondaryModelId = p.models[0]?.id || '';
                                                updateConfig({ mappings: newMappings });
                                            }}
                                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                                        >
                                            <option value="">None</option>
                                            {config.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <select
                                            value={mapping.secondaryModelId || ''}
                                            onChange={(e) => {
                                                const newMappings = [...config.mappings];
                                                newMappings[idx].secondaryModelId = e.target.value;
                                                updateConfig({ mappings: newMappings });
                                            }}
                                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                            disabled={!mapping.secondaryProviderId}
                                        >
                                            {config.providers.find(p => p.id === mapping.secondaryProviderId)?.models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* TEST LAB */}
                {activeTab === 'TEST_LAB' && (
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-[600px] flex flex-col">
                        <div className="flex gap-4 mb-4">
                            <select
                                value={testTask}
                                onChange={(e) => setTestTask(e.target.value as AiTask)}
                                className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                            >
                                {TASKS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input
                                type="text"
                                value={testPrompt}
                                onChange={(e) => setTestPrompt(e.target.value)}
                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                            />
                            <button
                                onClick={runTest}
                                disabled={isTesting}
                                className="px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2"
                            >
                                {isTesting ? <Activity className="animate-spin" /> : <Play size={20} />}
                                TEST
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-900 rounded-2xl p-4 overflow-y-auto font-mono text-xs text-green-400 border border-slate-800">
                            {testResult || <span className="text-slate-600">// Output will appear here...</span>}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
