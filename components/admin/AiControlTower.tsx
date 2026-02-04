import React, { useState, useEffect } from 'react';
import {
    getAIKeys, getAIModels, getAIProviders, getCanonicalMappings,
    saveAIKey, saveAIModel, saveCanonicalMapping, saveAIProvider, subscribeToAILogs,
    toggleAIModel, toggleAIProvider
} from '../../services/ai/db';
import {
    AIKey, AIModelConfig, AIProviderConfig, AICanonicalMapping,
    AILog, CanonicalModel, AIProviderType
} from '../../services/ai/types';
import { DEFAULT_PROVIDERS, DEFAULT_MODELS, DEFAULT_MAPPINGS_FULL } from '../../services/ai/defaults';
import { RefreshCw, Plus, Trash2, CheckCircle, XCircle, Activity, Server, Key, Brain, RotateCcw, Save, AlertTriangle, Play, Pause, Rocket } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// --- SUB COMPONENTS ---

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

const TableHeader = ({ children }: { children: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-black/20 border-b border-white/5 first:rounded-tl-lg last:rounded-tr-lg">
        {children}
    </th>
);

const TableRow = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <tr className={cn("hover:bg-white/5 transition-colors border-b border-white/5 last:border-0", className)}>
        {children}
    </tr>
);

const TableCell = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <td className={cn("px-4 py-3 text-sm whitespace-nowrap", className)}>
        {children}
    </td>
);

export const AiControlTower: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'STATUS' | 'PROVIDERS' | 'MODELS' | 'MAPPING' | 'KEYS' | 'LOGS'>('STATUS');

    // Data State
    const [providers, setProviders] = useState<AIProviderConfig[]>([]);
    const [models, setModels] = useState<AIModelConfig[]>([]);
    const [keys, setKeys] = useState<AIKey[]>([]);
    const [mappings, setMappings] = useState<Record<string, AICanonicalMapping>>({});
    const [logs, setLogs] = useState<AILog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUsingDefaults, setIsUsingDefaults] = useState(false);

    // Form State
    const [newKey, setNewKey] = useState({ key: '', provider: 'openai', name: '' });

    const refreshData = async () => {
        setLoading(true);
        try {
            let [p, m, k, map] = await Promise.all([
                getAIProviders(),
                getAIModels(),
                getAIKeys(),
                getCanonicalMappings()
            ]);

            // Auto-Seed View with Defaults if DB is empty
            if (p.length === 0) {
                console.log("AI System: No config found in DB, loading defaults for display.");
                p = DEFAULT_PROVIDERS;
                m = DEFAULT_MODELS;
                // Convert list to map
                const mapObj: Record<string, AICanonicalMapping> = {};
                DEFAULT_MAPPINGS_FULL.forEach(mapping => {
                    mapObj[mapping.canonicalModel] = mapping;
                });
                map = mapObj;
                setIsUsingDefaults(true);
            } else {
                setIsUsingDefaults(false);
            }

            setProviders(p);
            setModels(m);
            setKeys(k);
            setMappings(map);
        } catch (error) {
            console.error("Failed to load AI data:", error);
        }
        setLoading(false);
    };

    const handleInitializeDatabase = async () => {
        if (!confirm("Initialize AI Database with Factory Defaults? This will save all currently visible providers and models to the database.")) return;
        setLoading(true);
        try {
            // Providers
            for (const p of DEFAULT_PROVIDERS) await saveAIProvider(p);
            // Models
            for (const m of DEFAULT_MODELS) await saveAIModel(m);
            // Mappings
            for (const map of DEFAULT_MAPPINGS_FULL) await saveCanonicalMapping(map);

            await refreshData();
            alert("AI Brain Successfully Initialized!");
        } catch(e) {
            console.error(e);
            alert("Error initializing defaults.");
        }
        setLoading(false);
    };

    const handleToggleProvider = async (id: AIProviderType, current: boolean) => {
        if (isUsingDefaults) {
             alert("Please initialize the database first.");
             return;
        }
        await toggleAIProvider(id, !current);
        refreshData();
    };

    useEffect(() => {
        refreshData();
        const unsubscribe = subscribeToAILogs((newLogs) => setLogs(newLogs));
        return () => unsubscribe();
    }, []);

    // --- TAB CONTENT ---

    const renderStatus = () => {
        const totalCalls = logs.length;
        const failedCalls = logs.filter(l => l.status === 'FAILURE').length;
        const successRate = totalCalls > 0 ? ((totalCalls - failedCalls) / totalCalls) * 100 : 100;
        const activeKeyCount = keys.filter(k => k.status === 'ACTIVE').length;

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                {isUsingDefaults && (
                    <div className="bg-red-500/10 border-2 border-red-500/50 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-500/20 rounded-full text-red-500">
                                <AlertTriangle size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-red-500 uppercase tracking-wide">⚠️ System in Dummy Mode</h3>
                                <p className="text-sm text-red-200 mt-1 max-w-xl">
                                    The AI Operating System is currently reading from hardcoded defaults.
                                    Real-time routing, key rotation, and usage tracking are <strong>DISABLED</strong>.
                                </p>
                                <div className="mt-3 flex gap-4 text-xs font-mono text-red-300">
                                    <span className="flex items-center gap-1">❌ No Database Connection</span>
                                    <span className="flex items-center gap-1">❌ No Live Keys</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleInitializeDatabase}
                            className="w-full md:w-auto px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-lg shadow-lg shadow-red-500/20 flex items-center justify-center gap-3 transition-transform hover:scale-105"
                        >
                            <Rocket size={24} />
                            GO LIVE (Initialize DB)
                        </button>
                    </div>
                )}

                {!isUsingDefaults && activeKeyCount === 0 && (
                     <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Key className="text-orange-500" />
                            <div>
                                <h3 className="font-bold text-orange-500">No Active API Keys</h3>
                                <p className="text-sm opacity-70">System is initialized but needs keys to function. Add keys in the "API Keys" tab.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveTab('KEYS')}
                            className="bg-orange-500 hover:bg-orange-400 text-black px-4 py-2 rounded-lg font-bold text-sm"
                        >
                            + Add Keys
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatusCard title="AI Providers" value={providers.length} sub={`${providers.filter(p => p.isEnabled).length} Active`} color="text-blue-400" icon={Server} />
                    <StatusCard title="Model Registry" value={models.length} sub="Across all tiers" color="text-purple-400" icon={Brain} />
                    <StatusCard title="API Keys" value={keys.length} sub={`${activeKeyCount} Operational`} color="text-green-400" icon={Key} />
                    <StatusCard title="Health Score" value={`${Math.round(successRate)}%`} sub={`${logs.length} Transactions`} color={successRate > 90 ? "text-green-400" : "text-red-400"} icon={Activity} />
                </div>

                <div className="bg-gray-900/50 rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2">
                            <Activity size={18} className="text-blue-400"/> System Pulse
                        </h3>
                        <span className="text-xs opacity-50 font-mono">Realtime</span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-[#0F172A] z-10">
                                <tr>
                                    <TableHeader>Time</TableHeader>
                                    <TableHeader>Canonical Route</TableHeader>
                                    <TableHeader>Resolved Model</TableHeader>
                                    <TableHeader>Latency</TableHeader>
                                    <TableHeader>Status</TableHeader>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center opacity-30">No activity recorded yet</td>
                                    </tr>
                                ) : logs.slice(0, 20).map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell><span className="opacity-50 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span></TableCell>
                                        <TableCell><span className="font-bold text-yellow-400">{log.canonicalModel}</span></TableCell>
                                        <TableCell><span className="text-blue-300 font-mono text-xs">{log.modelId}</span></TableCell>
                                        <TableCell>{log.latencyMs}ms</TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-[10px] font-bold",
                                                log.status === 'SUCCESS' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            )}>
                                                {log.status}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderProviders = () => (
        <div className="space-y-4">
             <div className="bg-gray-900/50 rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <TableHeader>Provider</TableHeader>
                            <TableHeader>Base URL</TableHeader>
                            <TableHeader>Configured Keys</TableHeader>
                            <TableHeader>Status</TableHeader>
                            <TableHeader>Actions</TableHeader>
                        </tr>
                    </thead>
                    <tbody>
                        {providers.map(p => {
                            const keyCount = keys.filter(k => k.providerId === p.id).length;
                            return (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {p.icon && <img src={p.icon} className="w-6 h-6 rounded bg-white/10 p-0.5" alt="" />}
                                            <span className="font-medium">{p.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell><span className="font-mono text-xs opacity-50">{p.baseUrl || 'Default'}</span></TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Key size={12} className={keyCount > 0 ? "text-green-400" : "text-gray-600"} />
                                            <span>{keyCount}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={cn("px-2 py-1 rounded text-xs font-bold", p.isEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                                            {p.isEnabled ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <button
                                            onClick={() => handleToggleProvider(p.id, p.isEnabled)}
                                            disabled={isUsingDefaults}
                                            className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", isUsingDefaults && "opacity-30 cursor-not-allowed")}
                                        >
                                            {p.isEnabled ? <Pause size={16} /> : <Play size={16} />}
                                        </button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderModels = () => (
        <div className="space-y-4">
            <div className="bg-gray-900/50 rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <TableHeader>Model ID</TableHeader>
                            <TableHeader>Provider</TableHeader>
                            <TableHeader>Context Window</TableHeader>
                            <TableHeader>Priority</TableHeader>
                            <TableHeader>Status</TableHeader>
                        </tr>
                    </thead>
                    <tbody>
                        {models.map(m => (
                            <TableRow key={m.id}>
                                <TableCell><span className="font-bold">{m.name}</span> <div className="text-xs opacity-50 font-mono">{m.modelId}</div></TableCell>
                                <TableCell>
                                    <span className="px-2 py-1 rounded bg-white/5 text-xs uppercase tracking-wide opacity-70">
                                        {m.providerId}
                                    </span>
                                </TableCell>
                                <TableCell>{(m.contextWindow / 1000).toFixed(0)}k tokens</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs opacity-50">Tier</span>
                                        <span className="font-bold text-blue-400">{m.priority || 1}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                     <span className={cn("px-2 py-1 rounded text-xs font-bold", m.isEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                                            {m.isEnabled ? 'Active' : 'Disabled'}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderMappings = () => {
        const engines: CanonicalModel[] = ['NOTES_ENGINE', 'MCQ_ENGINE', 'CHAT_ENGINE', 'ANALYSIS_ENGINE', 'VISION_ENGINE'];

        const updateMapping = (engine: CanonicalModel, primary: string, fallbacks: string[]) => {
            if (isUsingDefaults) return alert("Initialize database to edit mappings.");
            const newMapping: AICanonicalMapping = { canonicalModel: engine, primaryModelId: primary, fallbackModelIds: fallbacks };
            setMappings(prev => ({...prev, [engine]: newMapping}));
            saveCanonicalMapping(newMapping);
        };

        return (
            <div className="space-y-4">
                <div className="p-4 bg-blue-900/20 border border-blue-500/20 rounded-lg text-sm text-blue-200 flex items-center gap-3">
                    <Server size={20} />
                    <div>
                        <div className="font-bold">Canonical Routing Table</div>
                        <div className="opacity-70">Maps abstract engine requests to concrete provider models with fallback chains.</div>
                    </div>
                </div>

                <div className="grid gap-4">
                    {engines.map(engine => {
                        const current = mappings[engine] || { canonicalModel: engine, primaryModelId: '', fallbackModelIds: [] };
                        return (
                            <div key={engine} className="bg-gray-900/50 p-4 rounded-xl border border-white/10 group hover:border-blue-500/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="font-bold text-lg text-yellow-400 flex items-center gap-2">
                                        <Brain size={18} /> {engine}
                                    </h4>
                                    <span className="text-xs px-2 py-1 bg-white/10 rounded font-mono">ROUTER_V1</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Primary Model</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                            value={current.primaryModelId}
                                            onChange={(e) => updateMapping(engine, e.target.value, current.fallbackModelIds)}
                                            disabled={isUsingDefaults}
                                        >
                                            <option value="">Select Model...</option>
                                            {models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name} ({m.providerId})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Fallback Chain</label>
                                        <div className="flex flex-wrap gap-2">
                                            {current.fallbackModelIds.map((fid, idx) => (
                                                <div key={idx} className="bg-white/5 px-2 py-1 rounded text-xs flex items-center gap-2 border border-white/5">
                                                    <span className="text-orange-300">{idx + 1}.</span>
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
                                                disabled={isUsingDefaults}
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
            // if (isUsingDefaults) return alert("Initialize database first."); // Removed restriction
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
            const success = await saveAIKey(keyObj);
            if (success) {
                alert("API Key Saved Successfully!");
                setNewKey({ key: '', provider: 'openai', name: '' });
                refreshData();
            } else {
                alert("Failed to save API Key. Check console for details.");
            }
        };

        return (
            <div className="space-y-6">
                {/* ADD KEY */}
                <div className="bg-gray-900/50 p-6 rounded-xl border border-white/10">
                    <h4 className="font-bold mb-4 flex items-center gap-2"><Plus size={18} className="text-green-400"/> Add New API Key</h4>
                    <div className="flex gap-4 flex-wrap items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs text-gray-400 mb-1 block">Provider</label>
                            <select
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm"
                                value={newKey.provider}
                                onChange={e => setNewKey({...newKey, provider: e.target.value})}
                            >
                                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs text-gray-400 mb-1 block">Key Label</label>
                            <input
                                type="text"
                                placeholder="e.g. Production Key 1"
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm"
                                value={newKey.name}
                                onChange={e => setNewKey({...newKey, name: e.target.value})}
                            />
                        </div>
                        <div className="flex-[2] min-w-[300px]">
                             <label className="text-xs text-gray-400 mb-1 block">Secret Key</label>
                            <input
                                type="text"
                                placeholder="sk-..."
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm"
                                value={newKey.key}
                                onChange={e => setNewKey({...newKey, key: e.target.value})}
                            />
                        </div>
                        <button
                            onClick={addKey}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold"
                        >
                            <Save size={16} /> Save Key
                        </button>
                    </div>
                </div>

                {/* KEY LIST */}
                <div className="grid gap-4">
                    {providers.filter(p => keys.some(k => k.providerId === p.id)).map(provider => (
                        <div key={provider.id} className="bg-gray-800/30 p-4 rounded-xl border border-white/5">
                            <h4 className="font-bold mb-3 flex items-center gap-2">
                                <span className="capitalize">{provider.name}</span>
                                <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full">{keys.filter(k => k.providerId === provider.id).length} Keys</span>
                            </h4>
                            <div className="grid gap-2">
                                {keys.filter(k => k.providerId === provider.id).map(key => (
                                    <div key={key.id} className="flex justify-between items-center bg-black/20 p-3 rounded border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-2 h-2 rounded-full", key.status === 'ACTIVE' ? "bg-green-500" : "bg-red-500")} />
                                            <div className="flex flex-col">
                                                <span className="font-mono text-sm font-bold text-gray-300">{key.name || 'Key'}</span>
                                                <span className="text-xs opacity-50 font-mono">...{key.key.slice(-6)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                            <div className="flex flex-col items-end">
                                                <span className="opacity-50">Usage</span>
                                                <span className="font-bold">{key.usageCount} calls</span>
                                            </div>
                                            <button className="text-red-400 hover:text-red-300 p-2 hover:bg-white/5 rounded transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {keys.length === 0 && (
                         <div className="p-8 text-center opacity-30 border border-dashed border-white/10 rounded-xl">
                            No API Keys Configured
                         </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#0F172A] text-white p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />

            {/* HEADER */}
            <div className="flex justify-between items-start mb-8 z-10">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        <Brain className="text-blue-500" /> AI Control Tower
                    </h2>
                    <p className="text-sm opacity-50 mt-1 font-mono">System Status: {isUsingDefaults ? 'VIEW MODE (DEFAULTS)' : 'LIVE (DATABASE CONNECTED)'}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={refreshData}
                        className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={cn(loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto">
                <TabButton id="STATUS" label="Overview" icon={Activity} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="PROVIDERS" label="Providers" icon={Server} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="MODELS" label="Models" icon={Brain} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="MAPPING" label="Routing" icon={RotateCcw} activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton id="KEYS" label="API Keys" icon={Key} activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar z-10">
                {activeTab === 'STATUS' && renderStatus()}
                {activeTab === 'PROVIDERS' && renderProviders()}
                {activeTab === 'MODELS' && renderModels()}
                {activeTab === 'MAPPING' && renderMappings()}
                {activeTab === 'KEYS' && renderKeys()}
            </div>
        </div>
    );
};
