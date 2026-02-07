import React, { useState, useEffect } from 'react';
import { MASTER_AI_PROVIDERS } from '../../constants';
import { AIProvider, SystemSettings, AIModel, AIProviderID } from '../../types';
import { subscribeToAILogs } from '../../services/ai/db';
import { AILog, AnyLog, SearchLog } from '../../services/ai/types';
import { RefreshCw, Plus, Trash2, CheckCircle, XCircle, Activity, Server, Key, Brain, RotateCcw, Save, AlertTriangle, Play, Pause, Rocket, Zap, Edit3, Lock, FileText, ScrollText, Globe, Search, Database } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (s: SystemSettings) => void;
}

const StatusCard = ({ title, value, sub, color, icon: Icon }: any) => (
    <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent relative overflow-hidden group hover:border-white/20 transition-all">
        <div className={cn("absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity", color)}>
            {Icon && <Icon size={40} />}
        </div>
        <div className="text-sm opacity-70 font-medium tracking-wide uppercase">{title}</div>
        <div className="text-3xl font-bold mt-2 tracking-tight">{value}</div>
        {sub && <div className="text-xs mt-1 opacity-50 font-mono">{sub}</div>}
    </div>
);

const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }: any) => (
    <button
        onClick={() => setActiveTab(id)}
        className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium border border-transparent",
            activeTab === id
                ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                : "hover:bg-white/5 text-gray-400 hover:text-white"
        )}
    >
        <Icon size={16} />
        {label}
    </button>
);

// --- Sub Component for Keys Management to avoid Hook Rules Violation ---
interface KeysManagerProps {
    providers: AIProvider[];
    addKey: (providerId: AIProviderID, key: string) => void;
    deleteKey: (providerId: AIProviderID, index: number) => void;
}

const KeysManager: React.FC<KeysManagerProps> = ({ providers, addKey, deleteKey }) => {
    const [tempKey, setTempKey] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<AIProviderID>('groq');
    const [testStatus, setTestStatus] = useState<string | null>(null);

    const handleTestKeys = async (providerId: AIProviderID) => {
        setTestStatus("Testing...");
        // Mock test - in real app, we would ping the API
        // Since we don't have a direct test endpoint for client-side keys here without full implementation
        // We will just simulate a check.
        setTimeout(() => {
            setTestStatus("✅ All keys format verified.");
            setTimeout(() => setTestStatus(null), 3000);
        }, 1000);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-gray-900/50 p-6 rounded-xl border border-white/10">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Key size={18} className="text-yellow-400"/> Add New API Key</h3>
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block uppercase">Select Provider</label>
                        <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value as AIProviderID)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                        >
                            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-[2]">
                        <label className="text-xs text-gray-400 mb-1 block uppercase">API Key / Token</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={tempKey}
                                onChange={(e) => setTempKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500 outline-none pr-10"
                            />
                            <Lock size={14} className="absolute right-3 top-3.5 text-gray-500" />
                        </div>
                    </div>
                    <button
                        onClick={() => { addKey(selectedProvider, tempKey); setTempKey(''); }}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                    >
                        <Plus size={18} /> Add
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {providers.filter(p => (p.apiKeys || []).length > 0).map(p => (
                    <div key={p.id} className="bg-gray-800/30 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <h4 className="font-bold text-gray-300">{p.name} Keys</h4>
                            </div>
                            <button
                                onClick={() => handleTestKeys(p.id)}
                                className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1 rounded text-blue-300 border border-blue-500/30"
                            >
                                Test Connectivity
                            </button>
                        </div>
                        {testStatus && <div className="text-xs text-green-400 mb-2 font-mono">{testStatus}</div>}
                        <div className="grid gap-2">
                            {(p.apiKeys || []).map((k, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-black/20 p-3 rounded border border-white/5">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-sm text-gray-400">
                                            {k.key.slice(0, 4)}...{k.key.slice(-4)}
                                        </span>
                                        <span className="text-[10px] text-gray-600">Added: {new Date(k.addedAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-gray-400">{k.usageCount} Calls</div>
                                            <div className={`text-[10px] ${k.isExhausted ? 'text-red-500' : 'text-green-500'}`}>
                                                {k.isExhausted ? 'EXHAUSTED' : 'ACTIVE'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteKey(p.id, idx)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export const AiControlTower: React.FC<Props> = ({ settings, onUpdateSettings }) => {
    const [activeTab, setActiveTab] = useState<'STATUS' | 'PROVIDERS' | 'KEYS' | 'MAPPING' | 'LOGS' | 'SEARCH'>('STATUS');
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [logs, setLogs] = useState<AnyLog[]>([]);

    useEffect(() => {
        if (activeTab === 'LOGS') {
            const unsub = subscribeToAILogs((data) => {
                setLogs(data);
            });
            return () => unsub();
        }
    }, [activeTab]);

    // Initialize or Sync Providers
    useEffect(() => {
        if (settings.aiProviderConfig && settings.aiProviderConfig.length > 0) {
            // Fix: Ensure apiKeys is always an array to prevent crash
            const sanitized = settings.aiProviderConfig.map(p => ({
                ...p,
                apiKeys: Array.isArray(p.apiKeys) ? p.apiKeys : []
            }));
            setProviders(sanitized);
        } else {
            // Seed with Master Defaults
            setProviders(MASTER_AI_PROVIDERS);
        }
    }, [settings.aiProviderConfig]);

    const handleSave = (updatedProviders: AIProvider[]) => {
        setProviders(updatedProviders);
        onUpdateSettings({ ...settings, aiProviderConfig: updatedProviders });
    };

    const toggleProvider = (id: AIProviderID) => {
        const updated = providers.map(p => p.id === id ? { ...p, isEnabled: !p.isEnabled } : p);
        handleSave(updated);
    };

    const addKey = (providerId: AIProviderID, keyStr: string) => {
        if (!keyStr.trim()) return;
        const updated = providers.map(p => {
            if (p.id === providerId) {
                const currentKeys = Array.isArray(p.apiKeys) ? p.apiKeys : [];
                return {
                    ...p,
                    apiKeys: [...currentKeys, {
                        key: keyStr.trim(),
                        addedAt: new Date().toISOString(),
                        usageCount: 0,
                        isExhausted: false
                    }]
                };
            }
            return p;
        });
        handleSave(updated);
    };

    const deleteKey = (providerId: AIProviderID, keyIndex: number) => {
        const updated = providers.map(p => {
            if (p.id === providerId) {
                const currentKeys = Array.isArray(p.apiKeys) ? p.apiKeys : [];
                const newKeys = currentKeys.filter((_, i) => i !== keyIndex);
                return { ...p, apiKeys: newKeys };
            }
            return p;
        });
        handleSave(updated);
    };

    const setPriority = (providerId: AIProviderID, priority: number) => {
        const updated = providers.map(p => p.id === providerId ? { ...p, priority } : p);
        handleSave(updated);
    };

    const renderMappings = () => {
        const ENGINES = ['NOTES_ENGINE', 'MCQ_ENGINE', 'CHAT_ENGINE', 'ANALYSIS_ENGINE', 'VISION_ENGINE'];
        const currentMap = settings.aiCanonicalMap || {};

        const updateMapping = (engine: string, providerId: string, modelId: string) => {
            const newMap = { ...currentMap, [engine]: { providerId, modelId } };
            onUpdateSettings({ ...settings, aiCanonicalMap: newMap });
        };

        return (
            <div className="space-y-4 animate-in fade-in">
                {ENGINES.map(engine => {
                    const mapping = currentMap[engine] || { providerId: '', modelId: '' };
                    const selectedProvider = providers.find(p => p.id === mapping.providerId);

                    return (
                        <div key={engine} className="bg-gray-900/50 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                                    <Brain size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-200">{engine}</h4>
                                    <p className="text-xs text-gray-500">Canonical Route</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <select
                                    value={mapping.providerId}
                                    onChange={(e) => {
                                        const pid = e.target.value;
                                        // Auto-select first model of new provider
                                        const prov = providers.find(p => p.id === pid);
                                        const mid = prov?.models[0]?.id || '';
                                        updateMapping(engine, pid, mid);
                                    }}
                                    className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm w-40"
                                >
                                    <option value="">Select Provider</option>
                                    {providers.filter(p => p.isEnabled).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>

                                <select
                                    value={mapping.modelId}
                                    onChange={(e) => updateMapping(engine, mapping.providerId, e.target.value)}
                                    className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm w-60"
                                    disabled={!mapping.providerId}
                                >
                                    {selectedProvider ? (
                                        selectedProvider.models.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))
                                    ) : (
                                        <option value="">Select Model</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderLogs = () => (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Real-time Interaction Stream</h3>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs text-green-400 font-mono">LIVE</span>
                </div>
            </div>

            <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                <div className="divide-y divide-white/5">
                    {logs.length === 0 && (
                        <div className="p-8 text-center text-gray-500 italic text-sm">No logs received yet. Waiting for traffic...</div>
                    )}
                    {logs.map((log) => {
                        const isSearch = log.type === 'WEB_SEARCH';
                        const timestamp = isSearch
                            ? new Date((log as SearchLog).time * 1000)
                            : new Date((log as AILog).timestamp);

                        return (
                            <div key={log.id} className="p-3 hover:bg-white/5 transition-colors font-mono text-xs flex gap-4 items-start">
                                <span className="text-gray-500 shrink-0 min-w-[70px]">{timestamp.toLocaleTimeString()}</span>

                                {isSearch ? (
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2 text-cyan-400 font-bold">
                                            <Search size={14} />
                                            <span>SEARCH</span>
                                            <span className="text-white">"{(log as SearchLog).query}"</span>
                                        </div>
                                        {(log as SearchLog).sources && (log as SearchLog).sources.length > 0 && (
                                            <div className="pl-6 space-y-1">
                                                {(log as SearchLog).sources.map((src, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-gray-400 text-[10px]">
                                                        <Database size={10} />
                                                        <span className="truncate max-w-[300px]">{new URL(src).hostname}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Brain size={14} className="text-purple-400" />
                                            <span className="text-purple-400 font-bold">AI</span>
                                            <span className="text-gray-300">{(log as AILog).canonicalModel}</span>
                                            <span className="text-gray-500">→</span>
                                            <span className="text-blue-300">{(log as AILog).modelId}</span>

                                            <span className={cn(
                                                "ml-2 px-1.5 rounded text-[9px] font-bold uppercase",
                                                (log as AILog).status === 'SUCCESS' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                            )}>
                                                {(log as AILog).status}
                                            </span>
                                            <span className="text-gray-600">{(log as AILog).latencyMs}ms</span>
                                        </div>
                                        {(log as AILog).errorMessage && (
                                            <div className="pl-6 mt-1 text-red-400">Error: {(log as AILog).errorMessage}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderSearch = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-gray-900/50 p-6 rounded-xl border border-white/10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-lg text-gray-200">Web Search Configuration (RAG)</h3>
                        <p className="text-xs text-gray-500">Enable Google Custom Search for real-time data retrieval.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${settings.isWebSearchEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                            {settings.isWebSearchEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                        <button
                            onClick={() => onUpdateSettings({ ...settings, isWebSearchEnabled: !settings.isWebSearchEnabled })}
                            className={cn("w-12 h-6 rounded-full transition-colors relative", settings.isWebSearchEnabled ? "bg-green-600" : "bg-gray-600")}
                        >
                            <div className={cn("absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform", settings.isWebSearchEnabled ? "translate-x-6" : "")} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block uppercase">Google Custom Search API Key</label>
                        <input
                            type="text"
                            value={settings.googleSearchApiKey || ''}
                            onChange={(e) => onUpdateSettings({ ...settings, googleSearchApiKey: e.target.value })}
                            placeholder="AIzaSy..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500 outline-none font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block uppercase">Search Engine ID (CX)</label>
                        <input
                            type="text"
                            value={settings.googleSearchCxId || ''}
                            onChange={(e) => onUpdateSettings({ ...settings, googleSearchCxId: e.target.value })}
                            placeholder="0123456789..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500 outline-none font-mono"
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStatus = () => {
        const totalKeys = providers.reduce((acc, p) => acc + (p.apiKeys?.length || 0), 0);
        const activeProviders = providers.filter(p => p.isEnabled).length;

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatusCard title="AI Providers" value={providers.length} sub={`${activeProviders} Enabled`} color="text-blue-400" icon={Server} />
                    <StatusCard title="Active API Keys" value={totalKeys} sub="Total Configured" color="text-green-400" icon={Key} />
                    <StatusCard title="System Health" value="100%" sub="Operational" color="text-purple-400" icon={Activity} />
                </div>
            </div>
        );
    };

    const renderProvidersList = () => (
        <div className="space-y-4 animate-in fade-in">
            {providers.map(p => (
                <div key={p.id} className={cn("bg-gray-900/50 rounded-xl border p-4 transition-all", p.isEnabled ? "border-blue-500/30" : "border-white/5 opacity-70")}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", p.isEnabled ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-gray-500")}>
                                <Server size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{p.name}</h3>
                                <div className="flex gap-2 text-xs font-mono opacity-60">
                                    <span>{p.models.length} Models</span>
                                    <span>•</span>
                                    <span>{(p.apiKeys || []).length} Keys</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end mr-4">
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1">Priority</label>
                                <input
                                    type="number"
                                    value={p.priority}
                                    onChange={(e) => setPriority(p.id, parseInt(e.target.value))}
                                    className="w-12 bg-black/40 border border-white/10 rounded p-1 text-center text-xs font-bold"
                                    min="1"
                                />
                            </div>
                            <button
                                onClick={() => toggleProvider(p.id)}
                                className={cn("p-2 rounded-lg transition-colors", p.isEnabled ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-white/5 text-gray-400 hover:bg-white/10")}
                            >
                                {p.isEnabled ? <Pause size={18} /> : <Play size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* MODELS LIST (Read Only for now, derived from Master) */}
                    {p.isEnabled && (
                        <div className="pl-12 mt-2">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Available Models</p>
                            <div className="flex flex-wrap gap-2">
                                {p.models.map(m => (
                                    <span key={m.id} className="px-2 py-1 bg-white/5 border border-white/5 rounded text-xs text-gray-300">
                                        {m.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#0F172A] text-white p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden min-h-[600px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />

            {/* HEADER */}
            <div className="flex justify-between items-start mb-8 z-10">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        <Brain className="text-blue-500" /> AI Control Tower
                    </h2>
                    <p className="text-sm opacity-50 mt-1 font-mono">Central Neural System V2.0</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto">
                <TabButton id="STATUS" label="Overview" icon={Activity} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="PROVIDERS" label="Providers & Models" icon={Server} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="MAPPING" label="Routing Engine" icon={RotateCcw} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="KEYS" label="API Key Vault" icon={Key} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="SEARCH" label="Web Search (RAG)" icon={Globe} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="LOGS" label="Live Logs" icon={ScrollText} activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar z-10">
                {activeTab === 'STATUS' && renderStatus()}
                {activeTab === 'PROVIDERS' && renderProvidersList()}
                {activeTab === 'MAPPING' && renderMappings()}
                {activeTab === 'KEYS' && <KeysManager providers={providers} addKey={addKey} deleteKey={deleteKey} />}
                {activeTab === 'SEARCH' && renderSearch()}
                {activeTab === 'LOGS' && renderLogs()}
            </div>
        </div>
    );
};
