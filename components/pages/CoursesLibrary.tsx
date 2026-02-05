import React, { useState } from 'react';
import { Youtube, FileText, CheckSquare, Headphones, Book, Trophy, Search } from 'lucide-react';
import { User, SystemSettings, Subject, Chapter } from '../../types';
import { getSubjectsList } from '../../constants';
import { fetchChapters } from '../../services/groq';
import { VideoPlaylistView } from '../VideoPlaylistView';
import { PdfView } from '../PdfView';
import { McqView } from '../McqView';
import { AudioPlaylistView } from '../AudioPlaylistView';
import { ChapterSelection } from '../ChapterSelection';
import { StudentBottomNav } from '../navigation/StudentBottomNav';
import { useNavigate, useLocation } from 'react-router-dom';

interface Props {
    user: User;
    settings?: SystemSettings;
    onSubjectSelect?: (subject: Subject) => void;
    onUpdateUser: (user: User) => void;
}

export const CoursesLibrary: React.FC<Props> = ({ user, settings, onSubjectSelect, onUpdateUser }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Parse query param for initial tab? e.g. /courses?tab=video
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') ? searchParams.get('tab')!.toUpperCase() : 'MAIN';

    const [activeView, setActiveView] = useState<string>(initialTab); // MAIN, VIDEO, PDF, MCQ, AUDIO
    const [contentStep, setContentStep] = useState<'SUBJECTS' | 'CHAPTERS' | 'PLAYER'>('SUBJECTS');
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loadingChapters, setLoadingChapters] = useState(false);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<{url: string, title: string} | null>(null);

    const handleSubjectSelect = async (subject: Subject) => {
        setSelectedSubject(subject);
        setLoadingChapters(true);
        setContentStep('CHAPTERS');
        try {
            const ch = await fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', subject, 'English');
            setChapters(ch);
        } catch(e) { console.error(e); }
        setLoadingChapters(false);
    };

    const handleBack = () => {
        if (contentStep === 'PLAYER') {
            setContentStep('CHAPTERS');
        } else if (contentStep === 'CHAPTERS') {
            setContentStep('SUBJECTS');
        } else {
            setActiveView('MAIN');
            navigate('/courses'); // Clear query params
        }
    };

    const renderContent = () => {
        if (contentStep === 'PLAYER' && selectedChapter && selectedSubject) {
            if (activeView === 'VIDEO') return <VideoPlaylistView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handleBack} onUpdateUser={onUpdateUser} settings={settings} />;
            if (activeView === 'PDF') return <PdfView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handleBack} onUpdateUser={onUpdateUser} settings={settings} />;
            if (activeView === 'MCQ') return <McqView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handleBack} onUpdateUser={onUpdateUser} settings={settings} />;
            if (activeView === 'AUDIO') return <AudioPlaylistView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handleBack} onUpdateUser={onUpdateUser} settings={settings} onPlayAudio={setCurrentAudioTrack} />;
        }

        if (contentStep === 'CHAPTERS' && selectedSubject) {
            return (
                <ChapterSelection
                    chapters={chapters}
                    subject={selectedSubject}
                    classLevel={user.classLevel || '10'}
                    loading={loadingChapters}
                    user={user}
                    settings={settings}
                    onSelect={(chapter, contentType) => {
                        setSelectedChapter(chapter);
                        // If content type passed (from mixed list), map to view?
                        // For now we assume the view is already set (VIDEO/PDF/etc)
                        setContentStep('PLAYER');
                    }}
                    onBack={handleBack}
                />
            );
        }

        // SUBJECT SELECTION VIEW
        const visibleSubjects = getSubjectsList(user.classLevel || '10', user.stream || null)
                                .filter(s => !(settings?.hiddenSubjects || []).includes(s.id));

        return (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                {visibleSubjects.map(s => (
                    <button
                        key={s.id}
                        onClick={() => handleSubjectSelect(s)}
                        className={`p-4 rounded-xl border shadow-sm text-left transition-all hover:scale-105 ${
                            activeView === 'VIDEO' ? 'bg-red-50 border-red-100 text-red-900' :
                            activeView === 'PDF' ? 'bg-blue-50 border-blue-100 text-blue-900' :
                            activeView === 'MCQ' ? 'bg-purple-50 border-purple-100 text-purple-900' :
                            'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                    >
                        <span className="font-bold text-sm block">{s.name}</span>
                        <span className="text-[10px] opacity-60 uppercase font-bold">{activeView}</span>
                    </button>
                ))}
            </div>
        );
    };

    // MAIN MENU VIEW
    if (activeView === 'MAIN') {
        return (
            <div className="min-h-screen bg-slate-50 pb-24 px-4 pt-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Book className="text-blue-600" /> Library
                    </h2>
                    <button className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-yellow-200 transition">
                        <Trophy size={14} /> Leaderboard
                    </button>
                </div>

                <div className="space-y-4">
                    {settings?.contentVisibility?.VIDEO !== false && (
                        <button onClick={() => { setActiveView('VIDEO'); setContentStep('SUBJECTS'); }} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                                <Youtube size={24} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-800 text-lg">Video Lectures</h3>
                                <p className="text-xs text-slate-500">Watch high-quality classes</p>
                            </div>
                        </button>
                    )}

                    {settings?.contentVisibility?.PDF !== false && (
                        <button onClick={() => { setActiveView('PDF'); setContentStep('SUBJECTS'); }} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                <FileText size={24} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-800 text-lg">Notes & PDFs</h3>
                                <p className="text-xs text-slate-500">Read chapters and summaries</p>
                            </div>
                        </button>
                    )}

                    {settings?.contentVisibility?.MCQ !== false && (
                        <button onClick={() => { setActiveView('MCQ'); setContentStep('SUBJECTS'); }} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                <CheckSquare size={24} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-800 text-lg">MCQ Practice</h3>
                                <p className="text-xs text-slate-500">Test your knowledge</p>
                            </div>
                        </button>
                    )}

                    {settings?.contentVisibility?.AUDIO !== false && (
                        <button onClick={() => { setActiveView('AUDIO'); setContentStep('SUBJECTS'); }} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 group-hover:scale-110 transition-transform">
                                <Headphones size={24} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-800 text-lg">Audio Library</h3>
                                <p className="text-xs text-slate-500">Listen on the go</p>
                            </div>
                        </button>
                    )}
                </div>
                <StudentBottomNav />
            </div>
        );
    }

    // CONTENT VIEW (SUBJECTS -> CHAPTERS -> PLAYER)
    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b flex items-center gap-3">
                <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div>
                    <h2 className="font-bold text-slate-800 text-lg leading-none">
                        {contentStep === 'SUBJECTS' ? `Select Subject` : contentStep === 'CHAPTERS' ? selectedSubject?.name : selectedChapter?.title}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{activeView} Mode</p>
                </div>
            </div>

            <div className="p-4">
                {renderContent()}
            </div>

            {/* Show Bottom Nav only if not in player full screen? user said 'Navigation Flow... Bottom Navbar' everywhere. */}
            {contentStep !== 'PLAYER' && <StudentBottomNav />}
        </div>
    );
};
