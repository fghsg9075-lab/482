
import React, { useEffect, useState } from 'react';
import { AiOs } from '../services/ai-os';
import { AiSystemConfig, DEFAULT_AI_CONFIG, AiProviderConfig, AiKey } from '../types/ai-os';
import {
    Cpu, Activity, Shield, Key, Plus, Trash2, Save, RefreshCw,
    Zap, Server, AlertTriangle, CheckCircle, BarChart3, Settings,
    Layers, Power, RotateCcw, Lock
} from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';

export const AiControlTower: React.FC = () => {
    const [config, setConfig] = useState<AiSystemConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'PROVIDERS' | 'ROUTES' | 'STATS'>('PROVIDERS');
    const [stats, setStats] = useState<any>({});
    const [newKeyInput, setNewKeyInput] = useState<Record<string, string>>({});

    useEffect(() => {
        loadConfig();

        // Subscribe to Stats
        const unsub = onValue(ref(rtdb, 'ai_os_stats'), (snap) => {
            if (snap.exists()) setStats(snap.val());
        });
        return () => unsub();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        const cfg = await AiOs.getConfig();
        setConfig(cfg || DEFAULT_AI_CONFIG);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!config) return;
        await AiOs.saveConfig(config);
        alert("AI Operating System Configuration Saved!");
    };

    const toggleProvider = (id: string) => {
        if (!config) return;
        const updated = { ...config };
        if (updated.providers[id]) {
            updated.providers[id].enabled = !updated.providers[id].enabled;
            setConfig(updated);
        }
    };

    const addKey = (providerId: string) => {
        if (!config || !newKeyInput[providerId]) return;
        const updated = { ...config };
        const keyVal = newKeyInput[providerId].trim();
        if (!keyVal) return;

        updated.providers[providerId].keys.push({
            key: keyVal,
            addedAt: new Date().toISOString(),
            status: 'ACTIVE',
            usageCount: 0
        });

        setConfig(updated);
        setNewKeyInput({ ...newKeyInput, [providerId]: '' });
    };

    const removeKey = (providerId: string, keyVal: string) => {
        if (!config) return;
        if (!confirm("Delete this API Key?")) return;
        const updated = { ...config };
        updated.providers[providerId].keys = updated.providers[providerId].keys.filter(k => k.key !== keyVal);
        setConfig(updated);
    };

    const updateRoute = (routeId: string, field: string, value: string) => {
        if (!config) return;
        const updated = { ...config };
        // @ts-ignore
        updated.routes[routeId][field] = value;
        setConfig(updated);
    };

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Initializing AI OS...</div>;
    if (!config) return <div className="p-8 text-center text-red-500">Failed to load configuration.</div>;

    const renderProviderCard = (p: AiProviderConfig) => {
        const pStats = stats[p.id] || {};

        return (
            <div key={p.id} className={`border-2 rounded-2xl p-6 transition-all ${p.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${p.enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                            <Server size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800">{p.name}</h3>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                    {p.enabled ? 'Online' : 'Disabled'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">{p.keys.length} Keys</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => toggleProvider(p.id)}
                        className={`w-12 h-7 rounded-full transition-all relative ${p.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${p.enabled ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>

                {/* KEY MANAGEMENT */}
                {p.enabled && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Key size={14} className="absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={`Add new ${p.name} API Key...`}
                                    value={newKeyInput[p.id] || ''}
                                    onChange={e => setNewKeyInput({...newKeyInput, [p.id]: e.target.value})}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            </div>
                            <button
                                onClick={() => addKey(p.id)}
                                className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {p.keys.map((k, idx) => {
                                // Live Stats Check
                                // Since we don't have exact key mapping in stats easily without hashing,
                                // we fallback to local usageCount or just Mock visualization for now
                                // if real stats aren't perfectly aligned yet.
                                // But `logUsage` in `ai-os` tries to use `key_{index}`.
                                // Let's try to read that if available.
                                const keyStat = pStats[`key_${idx}`] || {};
                                const usage = keyStat.usage || 0;
                                const errors = keyStat.errors || 0;
                                const total = usage + errors;
                                const limit = config.settings.globalRateLimit || 1500;
                                const percent = Math.min((total / limit) * 100, 100);

                                return (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:border-indigo-200 transition-colors">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                    {k.key.substring(0, 8)}...{k.key.substring(k.key.length - 4)}
                                                </span>
                                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                    k.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                                    k.status === 'RATE_LIMITED' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {k.status}
                                                </span>
                                            </div>
                                            {/* USAGE BAR */}
                                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                                                <div className={`h-full ${percent > 90 ? 'bg-red-500' : percent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${percent}%` }}></div>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[9px] text-slate-400">{total} Calls</span>
                                                <span className="text-[9px] text-slate-400">{Math.round(percent)}% Load</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeKey(p.id, k.key)}
                                            className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200 text-white">
                        <Cpu size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">AI Control Tower</h2>
                        <p className="text-slate-500 font-medium">Centralized AI Operating System Management</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={loadConfig} className="p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm"><RefreshCw size={20} /></button>
                    <button onClick={handleSave} className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-2">
                        <Save size={20} /> Save Changes
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-4 border-b border-slate-200 pb-1">
                <button onClick={() => setActiveTab('PROVIDERS')} className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'PROVIDERS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    <Server size={18} /> Providers & Keys
                </button>
                <button onClick={() => setActiveTab('ROUTES')} className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ROUTES' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    <Layers size={18} /> Canonical Layer (Routes)
                </button>
                <button onClick={() => setActiveTab('STATS')} className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'STATS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    <Activity size={18} /> Health & Stats
                </button>
            </div>

            {/* PROVIDERS TAB */}
            {activeTab === 'PROVIDERS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.values(config.providers).map(renderProviderCard)}
                </div>
            )}

            {/* ROUTES TAB */}
            {activeTab === 'ROUTES' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {Object.values(config.routes).map(route => (
                        <div key={route.id} className="bg-white border-2 border-slate-100 rounded-3xl p-8 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Layers size={120} />
                            </div>

                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{route.id}</span>
                            </h3>

                            <div className="space-y-6 relative z-10">
                                {/* PRIMARY */}
                                <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                                    <div className="flex items-center gap-2 mb-3 text-green-800 font-bold text-xs uppercase tracking-widest">
                                        <CheckCircle size={14} /> Primary Path
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Provider</label>
                                            <select
                                                value={route.primaryProvider}
                                                onChange={e => updateRoute(route.id, 'primaryProvider', e.target.value)}
                                                className="w-full p-2 rounded-xl border border-green-200 bg-white text-sm font-bold text-slate-700"
                                            >
                                                {Object.values(config.providers).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Model</label>
                                            <select
                                                value={route.primaryModel}
                                                onChange={e => updateRoute(route.id, 'primaryModel', e.target.value)}
                                                className="w-full p-2 rounded-xl border border-green-200 bg-white text-sm font-bold text-slate-700"
                                            >
                                                {config.providers[route.primaryProvider]?.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* FALLBACK */}
                                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                    <div className="flex items-center gap-2 mb-3 text-orange-800 font-bold text-xs uppercase tracking-widest">
                                        <Shield size={14} /> Fallback Path
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Provider</label>
                                            <select
                                                value={route.fallbackProvider || ''}
                                                onChange={e => updateRoute(route.id, 'fallbackProvider', e.target.value)}
                                                className="w-full p-2 rounded-xl border border-orange-200 bg-white text-sm font-bold text-slate-700"
                                            >
                                                <option value="">None (Fail)</option>
                                                {Object.values(config.providers).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Model</label>
                                            <select
                                                value={route.fallbackModel || ''}
                                                onChange={e => updateRoute(route.id, 'fallbackModel', e.target.value)}
                                                className="w-full p-2 rounded-xl border border-orange-200 bg-white text-sm font-bold text-slate-700"
                                                disabled={!route.fallbackProvider}
                                            >
                                                {route.fallbackProvider && config.providers[route.fallbackProvider]?.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* STATS TAB */}
            {activeTab === 'STATS' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         {Object.keys(stats).map(providerId => {
                             const pStats = stats[providerId];
                             const totalCalls = Object.values(pStats).reduce((acc: number, k: any) => acc + (k.total || 0), 0);
                             const totalErrors = Object.values(pStats).reduce((acc: number, k: any) => acc + (k.errors || 0), 0);

                             return (
                                 <div key={providerId} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                     <h3 className="text-xl font-black text-slate-800 uppercase mb-4">{providerId}</h3>
                                     <div className="flex items-end gap-2 mb-2">
                                         <span className="text-4xl font-black text-indigo-600">{totalCalls}</span>
                                         <span className="text-sm font-bold text-slate-400 mb-2">calls</span>
                                     </div>
                                     <div className="flex gap-4 text-xs font-bold">
                                         <span className="text-green-600">{totalCalls - totalErrors} Success</span>
                                         <span className="text-red-600">{totalErrors} Failed</span>
                                     </div>
                                 </div>
                             );
                         })}
                         {Object.keys(stats).length === 0 && (
                             <div className="col-span-3 text-center py-12 text-slate-400">
                                 No usage stats available yet. Make some AI calls!
                             </div>
                         )}
                    </div>
                </div>
            )}
        </div>
    );
};
