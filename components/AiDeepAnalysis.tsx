import React, { useState, useEffect } from 'react';
import { User, SystemSettings, MCQResult, MCQItem } from '../types';
import { BrainCircuit, Play, Pause, ChevronDown, ChevronUp, Star, Lock, AlertCircle, CheckCircle, XCircle, ArrowRight, TrendingUp, Award, BarChart3, ArrowLeft } from 'lucide-react';
import { saveUserToLive, saveAiInteraction } from '../firebase';
import { speakText, stopSpeech } from '../utils/textToSpeech';
import { generateUltraAnalysis, fetchLessonContent } from '../services/contentGenerator';

interface Props {
    user: User;
    settings?: SystemSettings;
    onUpdateUser: (user: User) => void;
    onBack: () => void;
}

interface AnalysisReport {
    chart: {
        weakPercent: number;
        averagePercent: number;
        strongPercent: number;
    };
    topics: {
        name: string;
        status: 'WEAK' | 'AVERAGE' | 'STRONG';
        correctCount: number;
        totalCount: number;
        advice: string;
    }[];
    mistakeAnalysis: {
        questionIndex: number;
        topic: string;
        cause: string;
        aiInsight: string;
    }[];
    improvementPlan: {
        weak: string;
        average: string;
    };
    motivation: string;
}

export const AiDeepAnalysis: React.FC<Props> = ({ user, settings, onUpdateUser, onBack }) => {
    const [activeView, setActiveView] = useState<'LIST' | 'REPORT'>('LIST');
    const [selectedResult, setSelectedResult] = useState<MCQResult | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Initializing...");
    const [mcqFullData, setMcqFullData] = useState<MCQItem[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

    // --- HELPER: GET FULL QUESTION DATA ---
    const getFullMcqData = async (result: MCQResult): Promise<MCQItem[]> => {
        // 1. Try Local Storage History (Best Source)
        try {
            const historyStr = localStorage.getItem('nst_user_history');
            if (historyStr) {
                const history = JSON.parse(historyStr);
                // Try to find by ID match or loose match
                const match = history.find((h: any) => h.analytics && h.analytics.id === result.id);
                if (match && match.mcqData) {
                    console.log("Found data in Local History");
                    return match.mcqData;
                }
            }
        } catch (e) { console.warn("Local History Fetch Failed", e); }

        // 2. Fallback: Fetch Fresh Content (Might mismatch if content changed, but best effort)
        setLoadingMessage("Fetching Chapter Content...");
        try {
            // Reconstruct minimal Subject/Chapter objects
            const dummySubject = { id: result.subjectId, name: result.subjectName, icon: 'book', color: '#000' };
            const dummyChapter = { id: result.chapterId, title: result.chapterTitle };

            const content = await fetchLessonContent(
                user.board || 'CBSE',
                user.classLevel || '10',
                user.stream || 'Science',
                dummySubject as any,
                dummyChapter as any,
                'English',
                'MCQ_SIMPLE',
                0,
                false, // isPremium
                15, // target
                "",
                true // allow AI generation if missing
            );

            if (content && content.mcqData) {
                console.log("Fetched Fresh Content");
                return content.mcqData;
            }
        } catch (e) { console.error("Content Fetch Failed", e); }

        return [];
    };

    const handleAnalyze = async (result: MCQResult) => {
        setSelectedResult(result);
        setLoading(true);
        setActiveView('REPORT');
        setAnalysis(null);

        try {
            // 1. Get Questions
            setLoadingMessage("Retrieving Question Data...");
            let questions = await getFullMcqData(result);

            if (questions.length === 0) {
                // Should not happen easily, but handle it
                // Maybe use wrongQuestions from result as a fallback (partial analysis)
                if (result.wrongQuestions) {
                     questions = result.wrongQuestions.map((wq, i) => ({
                         question: wq.question,
                         options: ["Data Missing"],
                         correctAnswer: 0,
                         explanation: "Content not available for deep analysis."
                     }));
                } else {
                    alert("Unable to retrieve detailed question data for this test. Please try a newer test.");
                    setActiveView('LIST');
                    setLoading(false);
                    return;
                }
            }
            setMcqFullData(questions);

            // 2. Prepare Payload for AI
            setLoadingMessage("AI Analyst is thinking...");

            // Map User Answers (from OMR) to Text
            const userAnswersMap = result.omrData?.reduce((acc: any, curr) => {
                acc[curr.qIndex] = curr.selected;
                return acc;
            }, {}) || {};

            const analysisPayload = questions.map((q, idx) => ({
                question: q.question,
                options: q.options,
                userSelected: userAnswersMap[idx] !== undefined && userAnswersMap[idx] !== -1 ? q.options[userAnswersMap[idx]] : "Skipped",
                correctAnswer: q.options[q.correctAnswer],
                explanation: q.explanation,
                isCorrect: userAnswersMap[idx] === q.correctAnswer
            }));

            // 3. Call AI Service
            const aiResponseJson = await generateUltraAnalysis(analysisPayload, settings);
            const aiData = JSON.parse(aiResponseJson);

            setAnalysis(aiData);

            // 4. Save Interaction
            saveAiInteraction({
                id: `analysis-2-${Date.now()}`,
                userId: user.id,
                userName: user.name,
                type: 'ULTRA_ANALYSIS_2.0',
                query: `Analyzed ${result.chapterTitle}`,
                response: aiResponseJson,
                timestamp: new Date().toISOString()
            });

        } catch (e) {
            console.error("Analysis Error", e);
            alert("AI Analysis Failed. Please try again.");
            setActiveView('LIST');
        } finally {
            setLoading(false);
        }
    };

    const handlePlayAudio = (text: string) => {
        if (isPlaying) {
            stopSpeech();
            setIsPlaying(false);
        } else {
            speakText(text);
            setIsPlaying(true);
        }
    };

    // --- RENDER LIST VIEW ---
    if (activeView === 'LIST') {
        const history = user.mcqHistory || [];

        return (
            <div className="pb-24 animate-in slide-in-from-right-4">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={onBack} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200">
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <BrainCircuit className="text-violet-600" /> AI Analyst 2.0
                        </h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select a test to analyze</p>
                    </div>
                </div>

                {history.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <Award size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="font-bold text-slate-600">No Tests Found</h3>
                        <p className="text-sm text-slate-400">Take a test first to unlock AI insights.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map((test, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                                <div>
                                    <h3 className="font-bold text-slate-800 line-clamp-1">{test.chapterTitle}</h3>
                                    <p className="text-xs text-slate-500 mb-2">{new Date(test.date).toLocaleDateString()} • {test.subjectName}</p>
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                            (test.score / test.totalQuestions) >= 0.8 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            Score: {test.score}/{test.totalQuestions}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAnalyze(test)}
                                    className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-200 hover:scale-105 transition-transform flex items-center gap-2"
                                >
                                    <BrainCircuit size={14} /> Analyze
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // --- RENDER REPORT VIEW ---
    return (
        <div className="pb-24 animate-in slide-in-from-bottom-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 sticky top-0 bg-slate-50/90 backdrop-blur-sm z-20 py-2">
                <button onClick={() => setActiveView('LIST')} className="bg-white p-2 rounded-full border border-slate-200 shadow-sm">
                    <ArrowLeft size={20} className="text-slate-600" />
                </button>
                <div>
                    <h2 className="text-xl font-black text-slate-800 leading-tight">Analysis Report</h2>
                    <p className="text-xs font-medium text-slate-500">{selectedResult?.chapterTitle}</p>
                </div>
            </div>

            {loading || !analysis ? (
                <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-violet-600 rounded-full border-t-transparent animate-spin"></div>
                        <BrainCircuit className="absolute inset-0 m-auto text-violet-600 animate-pulse" size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">{loadingMessage}</h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto">
                        Our AI is diving deep into every question, option, and explanation to find your weak points.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">

                    {/* 1. VISUAL CHART (Visual Chat) */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                            <BarChart3 className="text-violet-600" size={20} /> Performance Chart
                        </h3>

                        {/* Bars */}
                        <div className="flex h-4 rounded-full overflow-hidden mb-2">
                            <div style={{ width: `${analysis.chart.weakPercent}%` }} className="bg-red-500 h-full transition-all duration-1000"></div>
                            <div style={{ width: `${analysis.chart.averagePercent}%` }} className="bg-yellow-400 h-full transition-all duration-1000"></div>
                            <div style={{ width: `${analysis.chart.strongPercent}%` }} className="bg-green-500 h-full transition-all duration-1000"></div>
                        </div>

                        {/* Legend */}
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Weak ({analysis.chart.weakPercent}%)</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> Avg ({analysis.chart.averagePercent}%)</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Strong ({analysis.chart.strongPercent}%)</div>
                        </div>

                        {/* Motivation */}
                        <div className="mt-4 p-3 bg-violet-50 rounded-xl border border-violet-100 flex gap-3 items-start">
                            <button onClick={() => handlePlayAudio(analysis.motivation)} className="p-2 bg-violet-600 text-white rounded-full flex-shrink-0 mt-0.5">
                                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                            <p className="text-xs font-medium text-violet-900 italic">"{analysis.motivation}"</p>
                        </div>
                    </div>

                    {/* 2. TOPIC BREAKDOWN */}
                    <div className="space-y-3">
                        <h3 className="font-black text-slate-800 px-1">Topic Breakdown</h3>
                        {analysis.topics.map((topic, i) => (
                            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                                    topic.status === 'WEAK' ? 'bg-red-500' :
                                    topic.status === 'AVERAGE' ? 'bg-yellow-400' :
                                    'bg-green-500'
                                }`}></div>

                                <div className="pl-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="font-bold text-slate-800">{topic.name}</h4>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${
                                            topic.status === 'WEAK' ? 'bg-red-500' :
                                            topic.status === 'AVERAGE' ? 'bg-yellow-500' :
                                            'bg-green-500'
                                        }`}>{topic.status}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <p className="text-xs text-slate-500">{topic.correctCount}/{topic.totalCount} Correct</p>
                                        <p className="text-[10px] text-slate-400 font-medium italic max-w-[70%] text-right">"{topic.advice}"</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 3. MISTAKE ANALYSIS (Deep Dive) */}
                    <div className="space-y-4">
                         <div className="flex items-center justify-between px-1">
                            <h3 className="font-black text-slate-800">Mistake Analysis</h3>
                            <span className="text-xs font-bold text-slate-400">{analysis.mistakeAnalysis.length} Issues Found</span>
                         </div>

                         {analysis.mistakeAnalysis.map((mistake, idx) => {
                             const questionData = mcqFullData[mistake.questionIndex];
                             if (!questionData) return null;

                             const userAnsIdx = selectedResult?.omrData?.find(o => o.qIndex === mistake.questionIndex)?.selected ?? -1;
                             const userAnsText = userAnsIdx !== -1 ? questionData.options[userAnsIdx] : "Skipped";
                             const correctAnsText = questionData.options[questionData.correctAnswer];
                             const isExpanded = expandedQuestion === idx;

                             return (
                                 <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                     <div
                                        onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                                        className="p-4 flex gap-3 cursor-pointer hover:bg-slate-50"
                                     >
                                         <div className="mt-1">
                                             <XCircle size={20} className="text-red-500" />
                                         </div>
                                         <div className="flex-1">
                                             <p className="text-sm font-bold text-slate-800 mb-2 leading-snug">{questionData.question}</p>
                                             <div className="flex items-center gap-2 mb-2">
                                                 <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">{mistake.cause.replace('_', ' ')}</span>
                                                 <span className="text-[10px] font-bold text-violet-600">Tap to see why</span>
                                             </div>
                                         </div>
                                         <div className="self-center">
                                             {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                         </div>
                                     </div>

                                     {isExpanded && (
                                         <div className="bg-slate-50 p-4 border-t border-slate-100 text-sm space-y-3 animate-in slide-in-from-top-2">
                                             {/* User vs Correct */}
                                             <div className="grid grid-cols-2 gap-2">
                                                 <div className="bg-red-100 p-2 rounded-lg border border-red-200">
                                                     <p className="text-[10px] font-bold text-red-600 uppercase mb-1">You Chose</p>
                                                     <p className="text-xs font-bold text-red-800">{userAnsText}</p>
                                                 </div>
                                                 <div className="bg-green-100 p-2 rounded-lg border border-green-200">
                                                     <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Correct Answer</p>
                                                     <p className="text-xs font-bold text-green-800">{correctAnsText}</p>
                                                 </div>
                                             </div>

                                             {/* AI Insight */}
                                             <div className="bg-violet-100 p-3 rounded-xl border border-violet-200 relative overflow-hidden">
                                                 <div className="absolute top-0 right-0 p-2 opacity-10">
                                                     <BrainCircuit size={40} />
                                                 </div>
                                                 <p className="text-[10px] font-black text-violet-600 uppercase mb-1 flex items-center gap-1">
                                                     <BrainCircuit size={12} /> AI Insight
                                                 </p>
                                                 <p className="text-xs text-violet-900 leading-relaxed font-medium">
                                                     "{mistake.aiInsight}"
                                                 </p>
                                             </div>

                                             {/* Explanation */}
                                             <div className="bg-white p-3 rounded-xl border border-slate-200">
                                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Official Explanation</p>
                                                  <p className="text-xs text-slate-600">{questionData.explanation}</p>
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             );
                         })}
                    </div>

                    {/* 4. IMPROVEMENT PLAN */}
                    <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/30 rounded-full blur-3xl"></div>
                        <h3 className="font-black text-white mb-4 relative z-10 flex items-center gap-2">
                            <TrendingUp size={20} className="text-yellow-400" /> Action Plan
                        </h3>

                        <div className="space-y-4 relative z-10">
                            <div>
                                <p className="text-[10px] font-bold text-red-300 uppercase mb-1">Fix Weak Areas</p>
                                <p className="text-sm font-medium text-slate-200">{analysis.improvementPlan.weak}</p>
                            </div>
                            <div className="h-px bg-slate-700"></div>
                            <div>
                                <p className="text-[10px] font-bold text-yellow-300 uppercase mb-1">Boost Average Topics</p>
                                <p className="text-sm font-medium text-slate-200">{analysis.improvementPlan.average}</p>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
