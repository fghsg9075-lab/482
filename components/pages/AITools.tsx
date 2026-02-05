import React, { useState } from 'react';
import { Sparkles, FileText, BarChart3, History, PenTool, MessageCircle, X, Copy } from 'lucide-react';
import { User, SystemSettings } from '../../types';
import { StudentAiAssistant } from '../StudentAiAssistant';
import { AiDeepAnalysis } from '../AiDeepAnalysis';
import { AiHistoryPage } from '../AiHistoryPage';
import { CustomBloggerPage } from '../CustomBloggerPage';
import { StudentBottomNav } from '../navigation/StudentBottomNav';
import { generateCustomNotes } from '../../services/groq';
import { saveAiInteraction } from '../../firebase';

interface Props {
    user: User;
    settings?: SystemSettings;
    onUpdateUser: (user: User) => void;
}

export const AITools: React.FC<Props> = ({ user, settings, onUpdateUser }) => {
    const [activeTool, setActiveTool] = useState<string | null>(null);

    // AI Notes State
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiResult, setAiResult] = useState<string | null>(null);

    // AI Assistant State
    const [showAiChat, setShowAiChat] = useState(false);

    const handleAiNotesGeneration = async () => {
         if (!aiTopic.trim()) return;
         setAiGenerating(true);
         try {
             const notes = await generateCustomNotes(aiTopic, settings?.aiNotesPrompt || '');
             setAiResult(notes);
             saveAiInteraction({
                  id: `ai-note-${Date.now()}`,
                  userId: user.id,
                  userName: user.name,
                  type: 'AI_NOTES',
                  query: aiTopic,
                  response: notes,
                  timestamp: new Date().toISOString()
             });
         } catch(e) { console.error(e); }
         setAiGenerating(false);
    };

    if (activeTool === 'DEEP_ANALYSIS') return <AiDeepAnalysis user={user} settings={settings} onUpdateUser={onUpdateUser} onBack={() => setActiveTool(null)} />;
    if (activeTool === 'AI_HISTORY') return <AiHistoryPage user={user} onBack={() => setActiveTool(null)} />;
    if (activeTool === 'CUSTOM_PROMPT') return <CustomBloggerPage onBack={() => setActiveTool(null)} />;

    return (
        <div className="min-h-screen bg-slate-50 pb-24 px-4 pt-6">
            <h1 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <Sparkles className="text-purple-600" /> AI Smart Tools
            </h1>

            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowAiChat(true)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <MessageCircle size={24} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">Ask Tutor</span>
                </button>

                <button onClick={() => setShowAiModal(true)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                        <FileText size={24} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">Notes Gen</span>
                </button>

                <button onClick={() => setActiveTool('DEEP_ANALYSIS')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                        <BarChart3 size={24} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">Deep Analysis</span>
                </button>

                <button onClick={() => setActiveTool('CUSTOM_PROMPT')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
                        <PenTool size={24} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">Custom Prompt</span>
                </button>

                <button onClick={() => setActiveTool('AI_HISTORY')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                        <History size={24} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">History</span>
                </button>
            </div>

            {/* AI Notes Modal */}
            {showAiModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-lg text-slate-800">AI Notes Generator</h3>
                             <button onClick={() => setShowAiModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                        </div>
                        {!aiResult ? (
                            <div className="space-y-4">
                                <textarea
                                    value={aiTopic}
                                    onChange={e => setAiTopic(e.target.value)}
                                    placeholder="Enter topic..."
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-slate-800 focus:ring-2 focus:ring-indigo-100 h-32 resize-none"
                                />
                                <button
                                    onClick={handleAiNotesGeneration}
                                    disabled={aiGenerating}
                                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {aiGenerating ? <Sparkles className="animate-spin" /> : <Sparkles />}
                                    {aiGenerating ? 'Generating...' : 'Generate Notes'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden flex flex-col">
                                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 prose prose-sm max-w-none">
                                    <div className="whitespace-pre-wrap">{aiResult}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setAiResult(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl">New Topic</button>
                                    <button onClick={() => navigator.clipboard.writeText(aiResult)} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><Copy size={18} /> Copy</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <StudentBottomNav />

            {/* AI Assistant Overlay */}
            <StudentAiAssistant
                user={user}
                settings={settings}
                isOpen={showAiChat}
                onClose={() => setShowAiChat(false)}
            />
        </div>
    );
};
