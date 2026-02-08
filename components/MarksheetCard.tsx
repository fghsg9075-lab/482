import React, { useState, useEffect } from 'react';
import { MCQResult, User, SystemSettings } from '../types';
import { X, Share2, ChevronLeft, ChevronRight, Download, FileSearch, Grid, CheckCircle, XCircle, Clock, Award, BrainCircuit, Play, StopCircle, BookOpen, Target, Zap, BarChart3, ListChecks, FileText, LayoutTemplate, TrendingUp, AlertTriangle, RefreshCw, Sparkles, Headphones, Lock, Crown } from 'lucide-react';
import html2canvas from 'html2canvas';
import { generateUniversalAnalysis } from '../services/groq';
import { saveUniversalAnalysis, saveUserToLive, saveAiInteraction, getChapterData } from '../firebase';
import ReactMarkdown from 'react-markdown';
import { speakText, stopSpeech, getCategorizedVoices } from '../utils/textToSpeech';
import { CustomConfirm } from './CustomDialogs'; // Import CustomConfirm
import { getRecommendedContent, RecommendedItem } from '../services/recommendationEngine'; // Import Recommendation Engine

interface Props {
  result: MCQResult;
  user: User;
  settings?: SystemSettings;
  onClose: () => void;
  onViewAnalysis?: (cost: number) => void;
  onPublish?: () => void;
  questions?: any[]; 
  onUpdateUser?: (user: User) => void;
  initialView?: 'ANALYSIS';
}

export const MarksheetCard: React.FC<Props> = ({ result, user, settings, onClose, onViewAnalysis, onPublish, questions, onUpdateUser, initialView }) => {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'OMR' | 'MISTAKES' | 'STATS' | 'TOPIC_ANALYSIS' | 'RECOMMENDED' | 'MARKSHEET_1' | 'MARKSHEET_2'>('OMR');
  
  // TOPIC ANALYSIS STATE
  const [topicBreakdown, setTopicBreakdown] = useState<any[]>([]);

  // RECOMMENDATION STATE
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [isRecommendationsUnlocked, setIsRecommendationsUnlocked] = useState(false);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // UNIVERSAL ANALYSIS STATE (PER QUESTION)
  const [analyzingQuestionId, setAnalyzingQuestionId] = useState<string | null>(null);
  const [universalAnalysisResults, setUniversalAnalysisResults] = useState<Record<string, any>>({});

  // DOWNLOAD & SHARE
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  
  // Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  const ITEMS_PER_PAGE = 50;

  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  
  const omrData = result.omrData || [];
  const hasOMR = omrData.length > 0;
  const totalPages = Math.ceil(omrData.length / ITEMS_PER_PAGE);
  const currentData = omrData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const devName = 'Nadim Anwar'; // Strict Branding

  useEffect(() => {
      // CALCULATE TOPIC BREAKDOWN
      if (questions && questions.length > 0 && result.omrData) {
          const breakdown: Record<string, { total: number, correct: number, wrong: number, wrongQuestions: any[] }> = {};

          result.omrData.forEach(entry => {
              const q = questions[entry.qIndex];
              if (!q || !q.topic) return;

              const topic = q.topic;
              if (!breakdown[topic]) breakdown[topic] = { total: 0, correct: 0, wrong: 0, wrongQuestions: [] };

              breakdown[topic].total++;
              if (entry.selected === entry.correct) {
                  breakdown[topic].correct++;
              } else if (entry.selected !== -1) {
                  breakdown[topic].wrong++;
                  breakdown[topic].wrongQuestions.push(q);
              }
          });

          // Convert to Array & Classify
          const breakdownArray = Object.keys(breakdown).map(topic => {
              const data = breakdown[topic];
              const accuracy = (data.correct / data.total) * 100;
              let status = 'WEAK';
              if (accuracy >= 80) status = 'STRONG';
              else if (accuracy >= 50) status = 'AVERAGE';

              return { topic, ...data, accuracy, status };
          });

          setTopicBreakdown(breakdownArray);
      }
  }, [questions, result]);

  const handleDownload = async () => {
      let elementId = 'marksheet-content'; 
      if (activeTab === 'MARKSHEET_1') elementId = 'marksheet-style-1';
      if (activeTab === 'MARKSHEET_2') elementId = 'marksheet-style-2';
      
      const element = document.getElementById(elementId);
      if (!element) return;
      try {
          const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          const link = document.createElement('a');
          link.download = `Marksheet_${user.name}_${new Date().getTime()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
      } catch (e) {
          console.error('Download failed', e);
      }
  };

  const handleShare = async () => {
      const appLink = settings?.officialAppUrl || "https://play.google.com/store/apps/details?id=com.nsta.app"; 
      const text = `*${settings?.appName || 'IDEAL INSPIRATION CLASSES'} RESULT*\n\nName: ${user.name}\nScore: ${result.score}/${result.totalQuestions}\nAccuracy: ${percentage}%\nCorrect: ${result.correctCount}\nWrong: ${result.wrongCount}\nTime: ${formatTime(result.totalTimeSeconds)}\nDate: ${new Date(result.date).toLocaleDateString()}\n\nदेखिये मेरा NSTA रिजल्ट! आप भी टेस्ट दें...\nDownload App: ${appLink}`;
      if (navigator.share) {
          try { await navigator.share({ title: 'Result', text }); } catch(e) {}
      } else {
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
  };

  const handleUnlockRecommendations = async () => {
      // 1. Get Weak & Average Topics
      const targetTopics = topicBreakdown
          .filter(t => t.status === 'WEAK' || t.status === 'AVERAGE')
          .map(t => t.topic);

      if (targetTopics.length === 0 && topicBreakdown.length > 0) {
          alert("Excellent Work! You have no weak topics. Recommendations will show advanced content.");
      }

      // 2. Check Credits
      const cost = settings?.recommendationCost ?? 10;
      if (user.credits < cost && !user.role?.includes('ADMIN')) {
          alert(`Insufficient Credits! You need ${cost} coins to unlock recommendations.`);
          return;
      }

      setConfirmConfig({
          isOpen: true,
          title: "Unlock Recommendations",
          message: `Unlock personalized notes for ${targetTopics.length || 'all'} topics?\n\nCost: ${cost} Coins`,
          onConfirm: async () => {
              setIsLoadingRecs(true);
              setConfirmConfig(prev => ({...prev, isOpen: false}));

              // 3. Deduct Credits
              if (!user.role?.includes('ADMIN')) {
                  const updatedUser = { ...user, credits: user.credits - cost };
                  if (onUpdateUser) onUpdateUser(updatedUser);
                  localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
                  saveUserToLive(updatedUser);
              }

              // 4. Generate Recommendations
              try {
                  const board = user.board || 'CBSE';
                  const classLevel = result.classLevel || user.classLevel || '10';
                  const stream = user.stream || null;
                  const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
                  const key = `nst_content_${board}_${classLevel}${streamKey}_${result.subjectName}_${result.chapterId}`;

                  const chapterContent = await getChapterData(key);
                  if (chapterContent) {
                      const recs = getRecommendedContent(targetTopics, chapterContent, user, 'SCHOOL');
                      setRecommendations(recs);
                      setIsRecommendationsUnlocked(true);
                  } else {
                      alert("Content not found for this chapter.");
                  }
              } catch (e) {
                  console.error("Recs Error", e);
                  alert("Failed to load recommendations.");
              } finally {
                  setIsLoadingRecs(false);
              }
          }
      });
  };

  const renderOMRRow = (qIndex: number, selected: number, correct: number) => {
      const options = [0, 1, 2, 3];
      return (
          <div key={qIndex} className="flex items-center gap-3 mb-2">
              <span className="w-6 text-[10px] font-bold text-slate-500 text-right">{qIndex + 1}</span>
              <div className="flex gap-1.5">
                  {options.map((opt) => {
                      let bgClass = "bg-white border border-slate-300 text-slate-400";
                      
                      const isSelected = selected === opt;
                      const isCorrect = correct === opt;
                      
                      if (isSelected) {
                          if (isCorrect) bgClass = "bg-green-600 border-green-600 text-white shadow-sm";
                          else bgClass = "bg-red-500 border-red-500 text-white shadow-sm";
                      } else if (isCorrect && selected !== -1) {
                          bgClass = "bg-green-600 border-green-600 text-white opacity-80"; 
                      } else if (isCorrect && selected === -1) {
                          bgClass = "border-green-500 text-green-600 bg-green-50";
                      }

                      return (
                          <div key={opt} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${bgClass}`}>
                              {String.fromCharCode(65 + opt)}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const handleUniversalAnalysis = async (q: any) => {
      const qId = `${result.id}-${q.qIndex}`;
      if (universalAnalysisResults[qId]) return;

      setAnalyzingQuestionId(qId);
      try {
          const analysisStr = await generateUniversalAnalysis({
              class: result.classLevel || '10',
              subject: result.subjectName,
              chapter: result.chapterTitle,
              question: q.question,
              student_answer: "Wrong Answer Selected",
              correct_answer: q.correctAnswer ? q.correctAnswer.toString() : "Refer Answer Key",
              difficulty: "Medium"
          });

          let analysisData = {};
          try { analysisData = JSON.parse(analysisStr); } catch(e) {}

          setUniversalAnalysisResults(prev => ({...prev, [qId]: analysisData}));
      } catch (e) {
          console.error("Universal Analysis Error", e);
      } finally {
          setAnalyzingQuestionId(null);
      }
  };

  // --- SECTION RENDERERS ---

  const renderOMRSection = () => (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Grid size={18} /> OMR Response Sheet
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                {currentData.map((data) => renderOMRRow(data.qIndex, data.selected, data.correct))}
            </div>
            {hasOMR && totalPages > 1 && !isDownloadingAll && (
                <div className="flex justify-center items-center gap-4 mt-4 pt-3 border-t border-slate-100">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 bg-slate-100 rounded-lg disabled:opacity-30"><ChevronLeft size={16}/></button>
                    <span className="text-xs font-bold text-slate-500">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 bg-slate-100 rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
                </div>
            )}
        </div>
  );

  const renderMistakesSection = () => (
        <>
        <div className="flex items-center gap-2 mb-3 px-2">
            <XCircle className="text-red-500" size={20} />
            <h3 className="font-black text-slate-800 text-lg">Mistakes Review</h3>
        </div>
        {result.wrongQuestions && result.wrongQuestions.length > 0 ? (
            <div className="space-y-3">
                {result.wrongQuestions.map((q, idx) => {
                    const qId = `${result.id}-${q.qIndex}`;
                    const analysis = universalAnalysisResults[qId];
                    const isAnalyzing = analyzingQuestionId === qId;

                    return (
                    <div key={idx} className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                        <div className="p-4 flex gap-3">
                            <span className="w-6 h-6 flex-shrink-0 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                                {q.qIndex + 1}
                            </span>
                            <div className="flex-1">
                                <p className="text-sm text-slate-700 font-medium leading-relaxed mb-1">
                                    {q.question}
                                </p>
                                <p className="text-xs text-green-600 font-bold">
                                    Correct Answer: <span className="text-slate-700">{q.correctAnswer}</span>
                                </p>
                                {q.explanation && <p className="text-xs text-slate-500 mt-1 italic">{q.explanation}</p>}

                                {!analysis && (
                                    <button
                                        onClick={() => handleUniversalAnalysis(q)}
                                        disabled={isAnalyzing}
                                        className="mt-3 text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                    >
                                        {isAnalyzing ? <span className="animate-spin">⏳</span> : <BrainCircuit size={12} />}
                                        {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {analysis && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 mb-3">
                                    <BrainCircuit size={14} className="text-purple-600" />
                                    <span className="text-xs font-black text-slate-700 uppercase">AI Diagnosis</span>
                                </div>

                                <div className="space-y-3">
                                    {analysis.mistake_reason && (
                                        <div className="text-xs">
                                            <span className="font-bold text-red-600 block mb-0.5">Why Wrong:</span>
                                            <span className="text-slate-700">{analysis.mistake_reason}</span>
                                        </div>
                                    )}
                                    {analysis.correct_concept && (
                                        <div className="text-xs">
                                            <span className="font-bold text-green-600 block mb-0.5">Correct Concept:</span>
                                            <span className="text-slate-700">{analysis.correct_concept}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )})}
            </div>
        ) : (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                <p className="text-slate-500 font-bold">No mistakes found! Perfect Score! 🎉</p>
            </div>
        )}
        </>
  );

  const renderTopicAnalysisSection = () => (
      <div className="space-y-4 animate-in slide-in-from-bottom-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
              <h3 className="font-black text-blue-800 flex items-center gap-2 mb-2">
                  <Target size={18} /> Topic Breakdown
              </h3>
              <p className="text-xs text-blue-700">
                  Performance analysis based on your test results. Focus on Weak topics.
              </p>
          </div>

          {topicBreakdown.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">
                  <p>No topic data available for this test.</p>
              </div>
          ) : (
              <div className="space-y-3">
                  {topicBreakdown.map((item, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border-2 bg-white flex flex-col gap-3 ${
                          item.status === 'WEAK' ? 'border-red-100 shadow-sm' :
                          item.status === 'STRONG' ? 'border-green-100' : 'border-blue-100'
                      }`}>
                          <div className="flex justify-between items-center">
                              <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{item.topic}</h4>
                                  <div className="flex gap-2 mt-1">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          item.status === 'WEAK' ? 'bg-red-100 text-red-700' :
                                          item.status === 'STRONG' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                      }`}>
                                          {item.status}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-medium">
                                          {item.correct}/{item.total} Correct ({Math.round(item.accuracy)}%)
                                      </span>
                                  </div>
                              </div>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${
                                  item.status === 'WEAK' ? 'bg-red-50 text-red-600' :
                                  item.status === 'STRONG' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                  {Math.round(item.accuracy)}%
                              </div>
                          </div>

                          {/* Wrong Questions Preview */}
                          {item.wrongQuestions.length > 0 && (
                              <div className="bg-slate-50 p-3 rounded-lg text-xs">
                                  <p className="font-bold text-slate-500 mb-1">Mistakes:</p>
                                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                                      {item.wrongQuestions.map((q: any, i: number) => (
                                          <li key={i} className="line-clamp-1">{q.question}</li>
                                      ))}
                                  </ul>
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          )}
      </div>
  );

  const renderRecommendedSection = () => {
      // GATED VIEW
      if (!isRecommendationsUnlocked) {
          return (
              <div className="bg-gradient-to-br from-pink-600 to-rose-700 rounded-3xl p-8 text-center text-white shadow-xl animate-in zoom-in-95">
                  <Sparkles size={48} className="mx-auto mb-4 opacity-80" />
                  <h4 className="text-2xl font-black mb-2">Personalized Study Plan</h4>
                  <p className="text-pink-100 text-sm mb-8 max-w-xs mx-auto font-medium">
                      Unlock tailored notes for your weak topics. We curate specific content to boost your score.
                  </p>
                  <button
                      onClick={handleUnlockRecommendations}
                      disabled={isLoadingRecs}
                      className="bg-white text-pink-600 px-8 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-80"
                  >
                      {isLoadingRecs ? <span className="animate-spin">⏳</span> : <Lock size={18} />}
                      {isLoadingRecs ? 'Generating...' : `Unlock Recommendations (${settings?.recommendationCost ?? 10} Coins)`}
                  </button>
              </div>
          );
      }

      // UNLOCKED VIEW
      const freeItems = recommendations.filter(r => !r.isLocked);
      const premiumItems = recommendations.filter(r => r.isLocked);

      const renderItem = (item: RecommendedItem, isLocked: boolean) => (
          <div key={item.id} className={`bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between ${isLocked ? 'border-purple-200 bg-purple-50/50' : 'border-slate-200'}`}>
              <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      item.type === 'VIDEO' ? 'bg-blue-100 text-blue-600' :
                      item.type === 'PDF' ? 'bg-orange-100 text-orange-600' :
                      'bg-pink-100 text-pink-600'
                  }`}>
                      <FileText size={20} />
                  </div>
                  <div>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          {item.title}
                          {isLocked && <Lock size={12} className="text-purple-600" />}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${isLocked ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                              {isLocked ? 'PREMIUM' : 'FREE'}
                          </span>
                          {item.matchReason && (
                              <span className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                                  <Target size={10} /> Focus: {item.matchReason}
                              </span>
                          )}
                      </div>
                  </div>
              </div>

              {isLocked ? (
                  <button
                      onClick={() => alert("This content is locked for Premium Users. Please upgrade your plan!")}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center gap-1 shadow-lg shadow-purple-200"
                  >
                      <Lock size={12} /> Unlock
                  </button>
              ) : (
                  <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-1 shadow-lg"
                  >
                      Open
                  </a>
              )}
          </div>
      );

      return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <div className="bg-pink-50 p-4 rounded-xl border border-pink-100 mb-4">
                  <h3 className="font-black text-pink-800 flex items-center gap-2 mb-2">
                      <Sparkles size={18} /> Recommended Notes
                  </h3>
                  <p className="text-xs text-pink-700">
                      Tailored study material based on your test performance.
                  </p>
              </div>

              {recommendations.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                      <FileSearch size={48} className="mx-auto mb-2 opacity-50"/>
                      <p>No specific recommendations found.</p>
                      <p className="text-xs">Try reviewing the full chapter notes.</p>
                  </div>
              ) : (
                  <>
                      {/* FREE SECTION */}
                      {freeItems.length > 0 && (
                          <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                  <CheckCircle size={14} className="text-green-500" /> Free Notes
                              </h4>
                              <div className="grid gap-3">
                                  {freeItems.map(item => renderItem(item, false))}
                              </div>
                          </div>
                      )}

                      {/* PREMIUM SECTION */}
                      {premiumItems.length > 0 && (
                          <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2 mt-2">
                                  <Crown size={14} className="text-purple-500" /> Premium Notes (High Yield)
                              </h4>
                              <div className="grid gap-3 opacity-90">
                                  {premiumItems.map(item => renderItem(item, true))}
                              </div>
                          </div>
                      )}
                  </>
              )}
          </div>
      );
  };

  const renderStatsSection = () => (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
            <div className="flex flex-col items-center text-center relative z-10">
                <h2 className="text-2xl font-black text-slate-800 capitalize mb-1">{user.name}</h2>
                <p className="text-xs font-bold text-slate-400 font-mono tracking-wider mb-6">UID: {user.displayId || user.id}</p>
                
                <div className="relative w-40 h-40 mb-6">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            fill="none"
                            stroke={percentage >= 80 ? "#22c55e" : percentage >= 50 ? "#3b82f6" : "#ef4444"}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={`${(percentage / 100) * 440} 440`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-slate-800">{result.score}</span>
                        <span className="text-sm font-bold text-slate-400">/{result.totalQuestions}</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full">
                    <div className="bg-green-50 p-3 rounded-2xl border border-green-100">
                        <p className="text-xl font-black text-green-700">{result.correctCount}</p>
                        <p className="text-[10px] font-bold text-green-600 uppercase">Correct</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-2xl border border-red-100">
                        <p className="text-xl font-black text-red-700">{result.wrongCount}</p>
                        <p className="text-[10px] font-bold text-red-600 uppercase">Wrong</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                        <p className="text-xl font-black text-blue-700">{Math.round((result.totalTimeSeconds || 0) / 60)}m</p>
                        <p className="text-[10px] font-bold text-blue-600 uppercase">Time</p>
                    </div>
                </div>
            </div>
        </div>
  );

  // MARKSHET STYLE 1: Centered Logo
  const renderMarksheetStyle1 = () => (
      <div id="marksheet-style-1" className="bg-white p-8 max-w-2xl mx-auto border-4 border-slate-900 rounded-none relative">
          <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-900"></div>
          <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-slate-900"></div>
          <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-slate-900"></div>
          <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-900"></div>
          
          {/* Header */}
          <div className="text-center mb-8">
              {settings?.appLogo && (
                  <img src={settings.appLogo} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />
              )}
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-widest">{settings?.appName || 'INSTITUTE NAME'}</h1>
              <p className="text-lg font-bold text-slate-500">{settings?.aiName || 'AI Assessment Center'}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Generated By {settings?.aiName || 'AI'}</p>
          </div>

          {/* User Info */}
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 flex justify-between items-center">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Candidate Name</p>
                  <p className="text-xl font-black text-slate-800">{user.name}</p>
              </div>
              <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase">UID / Roll No</p>
                  <p className="text-xl font-black font-mono text-slate-800">{user.displayId || user.id}</p>
              </div>
          </div>

          {/* Score Grid */}
          <div className="mb-8">
              <h3 className="text-center font-bold text-slate-900 uppercase mb-4 border-b pb-2">Performance Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="border p-4 bg-slate-50">
                      <p className="text-xs font-bold text-slate-400 uppercase">Total Questions</p>
                      <p className="text-xl font-black">{result.totalQuestions}</p>
                  </div>
                  <div className="border p-4 bg-slate-50">
                      <p className="text-xs font-bold text-slate-400 uppercase">Attempted</p>
                      <p className="text-xl font-black">{result.correctCount + result.wrongCount}</p>
                  </div>
                  <div className="border p-4 bg-green-50 border-green-200">
                      <p className="text-xs font-bold text-green-600 uppercase">Correct</p>
                      <p className="text-xl font-black text-green-700">{result.correctCount}</p>
                  </div>
                  <div className="border p-4 bg-red-50 border-red-200">
                      <p className="text-xs font-bold text-red-600 uppercase">Wrong</p>
                      <p className="text-xl font-black text-red-700">{result.wrongCount}</p>
                  </div>
              </div>
              <div className="mt-4 bg-slate-900 text-white p-6 text-center rounded-xl">
                  <p className="text-sm font-bold opacity-60 uppercase mb-1">Total Score</p>
                  <p className="text-5xl font-black">{result.score} <span className="text-lg opacity-50">/ {result.totalQuestions}</span></p>
                  <p className="text-sm font-bold mt-2 text-yellow-400">{percentage}% Accuracy</p>
              </div>
          </div>

          {/* Footer */}
          <div className="text-center border-t border-slate-200 pt-4 mt-8">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Developed by {devName}</p>
          </div>
      </div>
  );

  // MARKSHET STYLE 2: Side Logo
  const renderMarksheetStyle2 = () => (
      <div id="marksheet-style-2" className="bg-white p-8 max-w-2xl mx-auto border border-slate-300 relative">
          
          {/* Header */}
          <div className="flex items-center gap-6 mb-8 border-b-2 border-slate-900 pb-6">
              {settings?.appLogo ? (
                  <img src={settings.appLogo} alt="Logo" className="w-20 h-20 object-contain" />
              ) : (
                  <div className="w-20 h-20 bg-slate-900 flex items-center justify-center text-white font-black text-2xl">A</div>
              )}
              <div>
                  <h1 className="text-4xl font-black text-slate-900 uppercase leading-none mb-1">{settings?.appName || 'INSTITUTE NAME'}</h1>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{settings?.aiName || 'AI Assessment Center'}</p>
              </div>
          </div>

          {/* User Info */}
          <div className="mb-8">
              <table className="w-full text-left">
                  <tbody>
                      <tr className="border-b border-slate-100">
                          <td className="py-2 text-sm font-bold text-slate-500 uppercase w-32">Candidate</td>
                          <td className="py-2 text-lg font-black text-slate-900 uppercase">{user.name}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                          <td className="py-2 text-sm font-bold text-slate-500 uppercase">ID No.</td>
                          <td className="py-2 text-lg font-mono font-bold text-slate-700">{user.displayId || user.id}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                          <td className="py-2 text-sm font-bold text-slate-500 uppercase">Test Date</td>
                          <td className="py-2 text-lg font-bold text-slate-700">{new Date(result.date).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                          <td className="py-2 text-sm font-bold text-slate-500 uppercase">Subject</td>
                          <td className="py-2 text-lg font-bold text-slate-700">{result.subjectName}</td>
                      </tr>
                  </tbody>
              </table>
          </div>

          {/* Score Big */}
          <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 bg-slate-100 p-6 rounded-lg text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase">Total Marks</p>
                  <p className="text-3xl font-black text-slate-900">{result.score}</p>
              </div>
              <div className="flex-1 bg-slate-900 text-white p-6 rounded-lg text-center">
                  <p className="text-xs font-bold opacity-60 uppercase">Percentage</p>
                  <p className="text-3xl font-black text-yellow-400">{percentage}%</p>
              </div>
          </div>

          {/* Detailed Grid */}
          <div className="grid grid-cols-4 gap-2 mb-12 text-center text-xs">
              <div className="bg-slate-50 p-2 border">
                  <span className="block font-bold text-slate-400 uppercase">Total Qs</span>
                  <span className="font-black text-lg">{result.totalQuestions}</span>
              </div>
              <div className="bg-slate-50 p-2 border">
                  <span className="block font-bold text-slate-400 uppercase">Attempted</span>
                  <span className="font-black text-lg">{result.correctCount + result.wrongCount}</span>
              </div>
              <div className="bg-green-50 p-2 border border-green-200">
                  <span className="block font-bold text-green-600 uppercase">Correct</span>
                  <span className="font-black text-lg text-green-700">{result.correctCount}</span>
              </div>
              <div className="bg-red-50 p-2 border border-red-200">
                  <span className="block font-bold text-red-600 uppercase">Wrong</span>
                  <span className="font-black text-lg text-red-700">{result.wrongCount}</span>
              </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end border-t-2 border-slate-900 pt-4">
               <div>
                   {settings?.appLogo && <img src={settings.appLogo} className="w-8 h-8 opacity-50 grayscale" />}
                   <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Generated By {settings?.aiName || 'AI'}</p>
               </div>
               <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Developed By</p>
                   <p className="text-xs font-black uppercase text-slate-900">{devName}</p>
               </div>
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in overflow-hidden">
        <CustomConfirm
            isOpen={confirmConfig.isOpen}
            title={confirmConfig.title}
            message={confirmConfig.message}
            onConfirm={confirmConfig.onConfirm}
            onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
        />
        <div className="w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
            
            {/* Header - Sticky */}
            <div className="bg-white text-slate-800 px-4 py-3 border-b border-slate-100 flex justify-between items-center z-10 sticky top-0 shrink-0">
                <div className="flex items-center gap-3">
                    {settings?.appLogo && (
                        <img src={settings.appLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 border" />
                    )}
                    <div>
                        <h1 className="text-sm font-black uppercase text-slate-900 tracking-wide">
                            {settings?.appName || 'RESULT'}
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400">Official Marksheet</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* TAB HEADER */}
            <div className="px-4 pt-2 pb-0 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide">
                <button 
                    onClick={() => setActiveTab('OMR')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'OMR' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <Grid size={14} className="inline mr-1 mb-0.5" /> OMR
                </button>
                <button 
                    onClick={() => setActiveTab('MISTAKES')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'MISTAKES' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <XCircle size={14} className="inline mr-1 mb-0.5" /> Mistakes
                </button>
                <button 
                    onClick={() => setActiveTab('STATS')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'STATS' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <BarChart3 size={14} className="inline mr-1 mb-0.5" /> Normal
                </button>
                <button 
                    onClick={() => setActiveTab('TOPIC_ANALYSIS')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'TOPIC_ANALYSIS' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <BrainCircuit size={14} className="inline mr-1 mb-0.5" /> Topic Analysis
                </button>
                <button
                    onClick={() => setActiveTab('RECOMMENDED')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'RECOMMENDED' ? 'border-pink-600 text-pink-600 bg-pink-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <Sparkles size={14} className="inline mr-1 mb-0.5" /> Recommended
                </button>
                <button 
                    onClick={() => setActiveTab('MARKSHEET_1')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'MARKSHEET_1' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <FileText size={14} className="inline mr-1 mb-0.5" /> Marksheet
                </button>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div id="marksheet-content" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
                
                {/* 1. OMR SECTION */}
                {activeTab === 'OMR' && (
                    <div className="animate-in slide-in-from-bottom-4">
                         {renderOMRSection()}
                    </div>
                )}

                {/* 2. MISTAKES SECTION */}
                {activeTab === 'MISTAKES' && (
                    <div className="animate-in slide-in-from-bottom-4">
                        {renderMistakesSection()}
                    </div>
                )}

                {/* 3. NORMAL ANALYSIS (STATS) SECTION */}
                {activeTab === 'STATS' && (
                    <div className="animate-in slide-in-from-bottom-4">
                        {renderStatsSection()}
                    </div>
                )}
                
                {/* 4. TOPIC ANALYSIS SECTION (Replaces AI) */}
                {activeTab === 'TOPIC_ANALYSIS' && renderTopicAnalysisSection()}

                {/* 5. RECOMMENDED SECTION */}
                {activeTab === 'RECOMMENDED' && (
                    <div className="animate-in slide-in-from-bottom-4">
                        {renderRecommendedSection()}
                    </div>
                )}

                {/* MARKSHEET STYLES */}
                {activeTab === 'MARKSHEET_1' && renderMarksheetStyle1()}
                {activeTab === 'MARKSHEET_2' && renderMarksheetStyle2()}

            </div>

            {/* Footer Actions */}
            <div className="bg-white p-4 border-t border-slate-100 flex gap-2 justify-center z-10 shrink-0 flex-col sm:flex-row">
                {onViewAnalysis && (
                    <button onClick={() => onViewAnalysis(0)} className="flex-1 bg-blue-50 text-blue-600 px-4 py-3 rounded-xl font-bold text-xs shadow-sm border border-blue-100 hover:bg-blue-100 flex justify-center gap-2">
                        <FileSearch size={16} /> Review Answers
                    </button>
                )}
                
                <button onClick={handleShare} className="flex-1 bg-green-600 text-white px-4 py-3 rounded-xl font-bold text-xs shadow hover:bg-green-700 flex justify-center gap-2">
                    <Share2 size={16} /> Share Result
                </button>
                
                <div className="flex gap-2 flex-1">
                     <button onClick={() => handleDownload()} className="bg-slate-100 text-slate-600 px-4 py-3 rounded-xl font-bold text-xs hover:bg-slate-200 flex-1 flex justify-center items-center gap-2">
                        <Download size={16} /> {['MARKSHEET_1','MARKSHEET_2'].includes(activeTab) ? 'Download Marksheet' : 'Download Page'}
                    </button>
                    {/* DOWNLOAD ALL BUTTON */}
                    {!['MARKSHEET_1','MARKSHEET_2'].includes(activeTab) && (
                         <button onClick={handleDownloadAll} className="bg-slate-900 text-white px-4 py-3 rounded-xl font-bold text-xs hover:bg-slate-800 flex-1 flex justify-center items-center gap-2">
                             <Download size={16} /> Download Full Analysis
                         </button>
                    )}
                </div>
            </div>
             
             {/* STRICT BRANDING FOOTER */}
             <div className="text-center py-2 bg-slate-50 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Developed by Nadim Anwar</p>
             </div>
        </div>

        {/* HIDDEN PRINT CONTAINER FOR DOWNLOAD ALL */}
        {isDownloadingAll && (
            <div id="full-analysis-report" className="absolute top-0 left-0 w-[800px] bg-white z-[-1] p-8 space-y-8 pointer-events-none">
                {/* Header */}
                <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
                    <h1 className="text-4xl font-black text-slate-900 uppercase">{settings?.appName || 'INSTITUTE'}</h1>
                    <p className="text-lg font-bold text-slate-500">Comprehensive Performance Report</p>
                    <p className="text-sm font-bold text-slate-400 mt-2">{user.name} | {new Date().toLocaleDateString()}</p>
                </div>
                
                {/* 1. STATS */}
                <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-4 border-l-8 border-blue-600 pl-3 uppercase">1. Performance Summary</h2>
                    {renderStatsSection()}
                </div>

                {/* 2. MISTAKES */}
                {result.wrongQuestions && result.wrongQuestions.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-l-8 border-red-600 pl-3 uppercase">2. Mistakes Review</h2>
                        {renderMistakesSection()}
                    </div>
                )}

                {/* 3. TOPIC ANALYSIS */}
                {topicBreakdown.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-l-8 border-violet-600 pl-3 uppercase">3. Topic Breakdown</h2>
                        {renderTopicAnalysisSection()}
                    </div>
                )}

                {/* 4. OMR */}
                {hasOMR && (
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-l-8 border-slate-600 pl-3 uppercase">4. OMR Sheet</h2>
                        {renderOMRSection()}
                    </div>
                )}

                {/* Footer */}
                <div className="text-center border-t border-slate-200 pt-4 mt-8">
                    <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Developed by {devName}</p>
                </div>
            </div>
        )}
    </div>
  );
};
