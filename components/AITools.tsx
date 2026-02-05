import React, { useState } from 'react';
import { User, SystemSettings } from '../types';
import { BrainCircuit, Sparkles, MessageCircle, FileText, CheckSquare, Languages, HelpCircle, PenTool, History } from 'lucide-react';
import { generateCustomNotes } from '../services/groq';
import { saveAiInteraction } from '../firebase';
import { StudentAiAssistant } from './StudentAiAssistant';
import { CustomAlert } from './CustomDialogs';

interface Props {
    user: User;
    settings?: SystemSettings;
    onBack?: () => void;
}

export const AITools: React.FC<Props> = ({ user, settings, onBack }) => {
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const [aiTopic, setAiTopic] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiResult, setAiResult] = useState<string | null>(null);
    const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, type: 'SUCCESS'|'ERROR'|'INFO', message: string}>({isOpen: false, type: 'INFO', message: ''});

    // Tools Configuration
    const tools = [
        { id: 'NOTES', title: 'Notes Generator', icon: <FileText size={24} />, color: 'bg-blue-500', desc: 'Create study notes on any topic' },
        { id: 'MCQ', title: 'MCQ Generator', icon: <CheckSquare size={24} />, color: 'bg-purple-500', desc: 'Generate practice quizzes' },
        { id: 'TUTOR', title: 'Ask Tutor', icon: <MessageCircle size={24} />, color: 'bg-indigo-500', desc: 'Chat with AI Personal Tutor' },
        { id: 'EXPLAIN', title: 'Explain Like I\'m 5', icon: <HelpCircle size={24} />, color: 'bg-green-500', desc: 'Simplify complex topics' },
        { id: 'TRANSLATE', title: 'Translator', icon: <Languages size={24} />, color: 'bg-orange-500', desc: 'Translate content to Hindi/English' },
        { id: 'CUSTOM', title: 'Custom Prompt', icon: <PenTool size={24} />, color: 'bg-pink-500', desc: 'Ask AI anything freely' }
    ];

    const showAlert = (msg: string, type: 'SUCCESS'|'ERROR'|'INFO' = 'INFO') => {
        setAlertConfig({ isOpen: true, type, message: msg });
    };

    const handleAiGeneration = async (mode: string) => {
        if (!aiTopic.trim()) {
            showAlert("Please enter a topic!", "ERROR");
            return;
        }

        // Usage Limit Check (Simplified for AITools)
        const today = new Date().toDateString();
        const usageKey = `nst_ai_usage_${user.id}_${today}`;
        const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
        let limit = settings?.aiLimits?.free || 0;
        if (user.isPremium) limit = user.subscriptionLevel === 'ULTRA' ? (settings?.aiLimits?.ultra || 100) : (settings?.aiLimits?.basic || 20);

        if (currentUsage >= limit) {
            showAlert("Daily AI limit reached! Upgrade to Ultra for more.", "ERROR");
            return;
        }

        setAiGenerating(true);
        try {
            let prompt = "";
            let systemPrompt = "";

            if (mode === 'NOTES') {
                systemPrompt = settings?.aiNotesPrompt || "You are an expert teacher. Create detailed, easy-to-understand study notes.";
                prompt = `Create detailed notes for: ${aiTopic}`;
            } else if (mode === 'MCQ') {
                systemPrompt = settings?.aiPromptMCQ || "Generate 5 multiple choice questions with answers and explanations.";
                prompt = `Create 5 MCQs on: ${aiTopic}`;
            } else if (mode === 'EXPLAIN') {
                systemPrompt = "You are a friendly tutor. Explain complex concepts in very simple terms (ELI5 style).";
                prompt = `Explain this to a 5 year old: ${aiTopic}`;
            } else if (mode === 'TRANSLATE') {
                systemPrompt = "Translate the following text to Hindi (or English if already in Hindi). Keep the meaning precise.";
                prompt = `Translate: ${aiTopic}`;
            } else {
                systemPrompt = "You are a helpful AI assistant.";
                prompt = aiTopic;
            }

            const result = await generateCustomNotes(prompt, systemPrompt);
            setAiResult(result);

            // Increment Usage
            localStorage.setItem(usageKey, (currentUsage + 1).toString());
            saveAiInteraction({
                id: `ai-tool-${Date.now()}`,
                userId: user.id,
                userName: user.name,
                type: mode as any,
                query: aiTopic,
                response: result,
                timestamp: new Date().toISOString()
            });

        } catch (e: any) {
            console.error(e);
            showAlert("Generation Failed. Please try again.", "ERROR");
        } finally {
            setAiGenerating(false);
        }
    };

    // If Tutor is selected, render the full Assistant component
    if (activeTool === 'TUTOR') {
        return <StudentAiAssistant user={user} settings={settings} isOpen={true} onClose={() => setActiveTool(null)} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-white p-4 border-b border-slate-200 sticky top-0 z-10 shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <BrainCircuit className="text-indigo-600" /> AI Tools
                    </h1>
                    <p className="text-xs text-slate-500">Powered by Gemini & Llama</p>
                </div>
                {onBack && (
                     <button onClick={onBack} className="text-sm font-bold text-slate-500">Back</button>
                )}
            </div>

            <div className="p-4 space-y-6">
                {/* Hero / Active Tool View */}
                {activeTool ? (
                    <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-100 animate-in slide-in-from-bottom-5">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                {tools.find(t => t.id === activeTool)?.icon}
                                {tools.find(t => t.id === activeTool)?.title}
                            </h2>
                            <button onClick={() => { setActiveTool(null); setAiResult(null); setAiTopic(''); }} className="text-sm text-red-500 font-bold">Close</button>
                        </div>

                        {!aiResult ? (
                            <div className="space-y-4">
                                <textarea
                                    className="w-full p-4 bg-slate-50 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none h-40 resize-none transition-all"
                                    placeholder={activeTool === 'TRANSLATE' ? "Enter text to translate..." : "Enter topic or question..."}
                                    value={aiTopic}
                                    onChange={e => setAiTopic(e.target.value)}
                                />
                                <button
                                    onClick={() => handleAiGeneration(activeTool)}
                                    disabled={aiGenerating}
                                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {aiGenerating ? <Sparkles className="animate-spin" /> : <Sparkles />}
                                    {aiGenerating ? "AI is working..." : "Generate"}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-[60vh] overflow-y-auto whitespace-pre-wrap prose prose-sm">
                                    {aiResult}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setAiResult(null); }} className="flex-1 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl">New Query</button>
                                    <button onClick={() => { navigator.clipboard.writeText(aiResult); showAlert("Copied!", "SUCCESS"); }} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl">Copy Result</button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Tools Grid */
                    <div className="grid grid-cols-2 gap-4">
                        {tools.map(tool => (
                            <button
                                key={tool.id}
                                onClick={() => setActiveTool(tool.id)}
                                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3 hover:shadow-md transition-all active:scale-95"
                            >
                                <div className={`p-4 rounded-full text-white shadow-lg ${tool.color}`}>
                                    {tool.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{tool.title}</h3>
                                    <p className="text-[10px] text-slate-500 leading-tight mt-1">{tool.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-center">
                    <p className="text-xs text-indigo-800 font-medium">
                        💡 Tip: AI Tools use 1 Credit per generation (Free Plan). Upgrade for unlimited access.
                    </p>
                </div>
            </div>

            <CustomAlert isOpen={alertConfig.isOpen} type={alertConfig.type} message={alertConfig.message} onClose={() => setAlertConfig({...alertConfig, isOpen: false})} />
        </div>
    );
};
