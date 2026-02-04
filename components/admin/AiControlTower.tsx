import React, { useState, useEffect } from 'react';
import {
    getAIKeys, getAIModels, getAIProviders, getCanonicalMappings,
    saveAIKey, saveAIModel, saveCanonicalMapping, saveAIProvider, subscribeToAILogs
} from '../../services/ai/db';
import {
    AIKey, AIModelConfig, AIProviderConfig, AICanonicalMapping,
    AILog, CanonicalModel, AIProviderType
} from '../../services/ai/types';
import { DEFAULT_PROVIDERS, DEFAULT_MODELS, DEFAULT_MAPPINGS_FULL } from '../../services/ai/defaults';
import { RefreshCw, Plus, Trash2, CheckCircle, XCircle, Activity, Server, Key, Brain, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// --- SUB COMPONENTS (Moved Outside) ---

const StatusCard = ({ title, value, sub, color }: any) => (
    <div className={cn("p-4 rounded-xl border border-white/10 bg-white/5", color)}>
        <div className="text-sm opacity-70">{title}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs mt-1 opacity-50">{sub}</div>}
    </div>
);

const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }: any) => (
    <button
        onClick={() => setActiveTab(id)}
        className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
            activeTab === id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 hover:bg-white/10 text-gray-300"
        )}
    >
        <Icon size={16} />
        {label}
    </button>
);

export const AiControlTower: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'STATUS' | 'MAPPING' | 'KEYS' | 'LOGS'>('STATUS');

    // Data State
    const [providers, setProviders] = useState<AIProviderConfig[]>([]);
    const [models, setModels] = useState<AIModelConfig[]>([]);
    const [keys, setKeys] = useState<AIKey[]>([]);
    const [mappings, setMappings] = useState<Record<string, AICanonicalMapping>>({});
    const [logs, setLogs] = useState<AILog[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State (Moved up to avoid Hook violation in renderKeys)
    const [newKey, setNewKey] = useState({ key: '', provider: 'gemini', name: '' });

    const refreshData = async () => {
        setLoading(true);
        const [p, m, k, map] = await Promise.all([
            getAIProviders(),
            getAIModels(),
            getAIKeys(),
            getCanonicalMappings()
        ]);
        setProviders(p);
        setModels(m);
        setKeys(k);
        setMappings(map);
        setLoading(false);
    };

    const handleResetDefaults = async () => {
        if (!confirm("Reset AI Brain? This will overwrite providers and models (keys will be safe).")) return;
        setLoading(true);
        try {
            // Providers
            for (const p of DEFAULT_PROVIDERS) await saveAIProvider(p);
            // Models
            for (const m of DEFAULT_MODELS) await saveAIModel(m);
            // Mappings
            for (const map of DEFAULT_MAPPINGS_FULL) await saveCanonicalMapping(map);

            await refreshData();
            alert("AI Brain Initialized with Factory Defaults!");
        } catch(e) {
            console.error(e);
            alert("Error initializing defaults.");
        }
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
        const unsubscribe = subscribeToAILogs((newLogs) => setLogs(newLogs));
        return () => unsubscribe();
    }, []);

    // --- TAB CONTENT ---

    const renderStatus = () => {
        const totalCalls = logs.length; // Just recent logs for now
        const failedCalls = logs.filter(l => l.status === 'FAILURE').length;
        const successRate = totalCalls > 0 ? Math.round(((totalCalls - failedCalls) / totalCalls) * 100) : 100;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatusCard title="Active Providers" value={providers.filter(p => p.isEnabled).length} sub={`${providers.length} configured`} color="text-blue-400" />
                    <StatusCard title="Total Keys" value={keys.length} sub={`${keys.filter(k => k.status === 'ACTIVE').length} active`} color="text-green-400" />
                    <StatusCard title="Success Rate" value={`${successRate}%`} sub="Last 50 calls" color={successRate > 90 ? "text-green-400" : "text-red-400"} />
                    <StatusCard title="Total Models" value={models.length} sub={`${models.filter(m => m.isEnabled).length} enabled`} color="text-purple-400" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="bg-gray-900/50 p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Activity size={20} className="text-blue-400"/> Live Activity
                        </h3>
                        <div className="space-y-3">
                            {logs.slice(0, 5).map(log => (
                                <div key={log.id} className="flex justify-between items-center text-sm p-2 bg-white/5 rounded">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs opacity-50">{log.timestamp.split('T')[1].split('.')[0]}</span>
                                        <span className={cn("font-bold", log.status === 'SUCCESS' ? "text-green-400" : "text-red-400")}>
                                            {log.canonicalModel}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs">{log.modelId}</div>
                                        <div className="text-xs opacity-50">{log.latencyMs}ms</div>
                                    </div>
                                </div>
                            ))}
                            {logs.length === 0 && <div className="text-center opacity-50 py-4">No recent activity</div>}
                        </div>
                     </div>

                     <div className="bg-gray-900/50 p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Server size={20} className="text-purple-400"/> Provider Health
                        </h3>
                        <div className="space-y-3">
                            {providers.map(p => {
                                const pKeys = keys.filter(k => k.providerId === p.id);
                                const activeKeys = pKeys.filter(k => k.status === 'ACTIVE').length;
                                return (
                                    <div key={p.id} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-2 h-2 rounded-full", p.isEnabled ? "bg-green-500" : "bg-red-500")} />
                                            <span className="font-medium">{p.name}</span>
                                        </div>
                                        <div className="flex gap-4 text-xs opacity-70">
                                            <span>{pKeys.length} Keys ({activeKeys} Active)</span>
                                            <span>{p.isEnabled ? 'ON' : 'OFF'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                             {providers.length === 0 && (
                                 <button
                                    onClick={async () => {
                                        await saveAIProvider({id: 'gemini', name: 'Google Gemini', isEnabled: true});
                                        await saveAIProvider({id: 'groq', name: 'Groq', isEnabled: true});

                                        // Default Models
                                        await saveAIModel({id: 'gemini-1.5-flash', providerId: 'gemini', name: 'Gemini 1.5 Flash', isEnabled: true, costPer1k: 0.0001, contextWindow: 1000000});
                                        await saveAIModel({id: 'llama-3.1-8b-instant', providerId: 'groq', name: 'Llama 3.1 8B (Groq)', isEnabled: true, costPer1k: 0.00005, contextWindow: 8192});
                                        await saveAIModel({id: 'llama-3.2-90b-vision-preview', providerId: 'groq', name: 'Llama 3.2 90B Vision', isEnabled: true, costPer1k: 0.0001, contextWindow: 128000});

                                        refreshData();
                                    }}
                                    className="w-full py-2 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 text-sm"
                                 >
                                    Initialize Defaults
                                 </button>
                             )}
                        </div>
                     </div>
                </div>
            </div>
        );
    };

    const renderMappings = () => {
        const engines: CanonicalModel[] = ['NOTES_ENGINE', 'MCQ_ENGINE', 'CHAT_ENGINE', 'ANALYSIS_ENGINE', 'VISION_ENGINE'];

        const updateMapping = (engine: CanonicalModel, primary: string, fallbacks: string[]) => {
            const newMapping: AICanonicalMapping = { canonicalModel: engine, primaryModelId: primary, fallbackModelIds: fallbacks };
            setMappings(prev => ({...prev, [engine]: newMapping}));
            saveCanonicalMapping(newMapping);
        };

        return (
            <div className="space-y-4">
                <div className="p-4 bg-blue-900/20 border border-blue-500/20 rounded-lg text-sm text-blue-200">
                    Map your code's <code>NOTES_ENGINE</code> calls to real models here. The system will automatically fallback if the primary fails.
                </div>

                <div className="grid gap-4">
                    {engines.map(engine => {
                        const current = mappings[engine] || { canonicalModel: engine, primaryModelId: '', fallbackModelIds: [] };
                        return (
                            <div key={engine} className="bg-gray-900/50 p-4 rounded-xl border border-white/10">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="font-bold text-lg text-yellow-400">{engine}</h4>
                                    <span className="text-xs px-2 py-1 bg-white/10 rounded">Canonical</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Primary Model</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm"
                                            value={current.primaryModelId}
                                            onChange={(e) => updateMapping(engine, e.target.value, current.fallbackModelIds)}
                                        >
                                            <option value="">Select Model...</option>
                                            {models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name} ({m.providerId})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Fallback Chain</label>
                                        <div className="flex gap-2">
                                            {current.fallbackModelIds.map((fid, idx) => (
                                                <div key={idx} className="bg-white/5 px-2 py-1 rounded text-xs flex items-center gap-2">
                                                    {models.find(m => m.id === fid)?.name || fid}
                                                    <button
                                                        onClick={() => updateMapping(engine, current.primaryModelId, current.fallbackModelIds.filter((_, i) => i !== idx))}
                                                        className="hover:text-red-400"
                                                    >×</button>
                                                </div>
                                            ))}
                                            <select
                                                className="bg-black/40 border border-white/10 rounded p-1 text-xs w-24"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        updateMapping(engine, current.primaryModelId, [...current.fallbackModelIds, e.target.value]);
                                                    }
                                                }}
                                                value=""
                                            >
                                                <option value="">+ Add</option>
                                                {models.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderKeys = () => {
        const addKey = async () => {
            if (!newKey.key) return;
            const keyObj: AIKey = {
                id: `k-${Date.now()}`,
                key: newKey.key,
                providerId: newKey.provider as AIProviderType,
                name: newKey.name || 'Admin Key',
                usageCount: 0,
                dailyUsageCount: 0,
                limit: 1000,
                isExhausted: false,
                lastUsed: new Date().toISOString(),
                status: 'ACTIVE'
            };
            await saveAIKey(keyObj);
            setNewKey({ key: '', provider: 'gemini', name: '' });
            refreshData();
        };

        return (
            <div className="space-y-6">
                {/* ADD KEY */}
                <div className="bg-gray-900/50 p-4 rounded-xl border border-white/10">
                    <h4 className="font-bold mb-3">Add New API Key</h4>
                    <div className="flex gap-2 flex-wrap">
                        <select
                            className="bg-black/40 border border-white/10 rounded p-2 text-sm"
                            value={newKey.provider}
                            onChange={e => setNewKey({...newKey, provider: e.target.value})}
                        >
                            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input
                            type="text"
                            placeholder="Key Name (Optional)"
                            className="bg-black/40 border border-white/10 rounded p-2 text-sm"
                            value={newKey.name}
                            onChange={e => setNewKey({...newKey, name: e.target.value})}
                        />
                        <input
                            type="text"
                            placeholder="sk-..."
                            className="bg-black/40 border border-white/10 rounded p-2 text-sm flex-1 min-w-[200px]"
                            value={newKey.key}
                            onChange={e => setNewKey({...newKey, key: e.target.value})}
                        />
                        <button
                            onClick={addKey}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        >
                            <Plus size={16} /> Add
                        </button>
                    </div>
                </div>

                {/* KEY LIST */}
                <div className="space-y-4">
                    {providers.map(provider => (
                        <div key={provider.id} className="bg-gray-800/30 p-4 rounded-xl">
                            <h4 className="font-bold mb-3 flex items-center gap-2">
                                <span className="capitalize">{provider.name}</span> Keys
                                <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full">{keys.filter(k => k.providerId === provider.id).length}</span>
                            </h4>
                            <div className="grid gap-2">
                                {keys.filter(k => k.providerId === provider.id).map(key => (
                                    <div key={key.id} className="flex justify-between items-center bg-black/20 p-3 rounded border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-2 h-2 rounded-full", key.status === 'ACTIVE' ? "bg-green-500" : "bg-red-500")} />
                                            <div className="flex flex-col">
                                                <span className="font-mono text-sm">{key.name || 'Key'} (...{key.key.slice(-4)})</span>
                                                <span className="text-xs opacity-50">Used: {key.usageCount} times</span>
                                            </div>
                                        </div>
                                        <button className="text-red-400 hover:text-red-300 p-1 opacity-50 hover:opacity-100">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {keys.filter(k => k.providerId === provider.id).length === 0 && (
                                    <div className="text-center text-xs opacity-30 py-2">No keys found</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderLogs = () => (
        <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between text-gray-500 px-2 pb-2 border-b border-white/10">
                <span>Time</span>
                <span>Engine</span>
                <span>Model</span>
                <span>Status</span>
            </div>
            {logs.map(log => (
                <div key={log.id} className="flex justify-between items-center p-2 bg-white/5 rounded hover:bg-white/10 transition-colors">
                    <span className="opacity-50">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="font-bold text-yellow-500">{log.canonicalModel}</span>
                    <span className="text-blue-300">{log.modelId}</span>
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px]",
                        log.status === 'SUCCESS' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    )}>
                        {log.status}
                    </span>
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#0F172A] text-white p-6 rounded-2xl border border-white/10 shadow-2xl">
            {/* HEADER */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Brain className="text-blue-500" /> AI Control Tower
                    </h2>
                    <p className="text-sm opacity-50 mt-1">Managed AI Operating System (Zone C)</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleResetDefaults}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider border border-red-500/20"
                        title="Reset / Initialize Defaults"
                    >
                        <RotateCcw size={16} /> Load Defaults
                    </button>
                    <button
                        onClick={refreshData}
                        className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={cn(loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
                <TabButton id="STATUS" label="Overview" icon={Activity} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="MAPPING" label="Canonical Routes" icon={Server} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="KEYS" label="Providers & Keys" icon={Key} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="LOGS" label="Live Logs" icon={Activity} activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {activeTab === 'STATUS' && renderStatus()}
                {activeTab === 'MAPPING' && renderMappings()}
                {activeTab === 'KEYS' && renderKeys()}
                {activeTab === 'LOGS' && renderLogs()}
            </div>
        </div>
    );
};
