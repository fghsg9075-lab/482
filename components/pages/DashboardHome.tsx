import React, { useRef } from 'react';
import { Play, Rocket, Video, Book, FileText, History as HistoryIcon, Zap } from 'lucide-react';
import { User, SystemSettings } from '../../types';
import { StudentBottomNav } from '../navigation/StudentBottomNav';
import { useNavigate } from 'react-router-dom';

interface Props {
    user: User;
    dailyStudySeconds: number;
    settings?: SystemSettings;
    onStartAutoChallenge: (type: 'DAILY' | 'WEEKLY') => void;
}

export const DashboardHome: React.FC<Props> = ({ user, dailyStudySeconds, settings, onStartAutoChallenge }) => {
    const navigate = useNavigate();
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const dailyTargetSeconds = 10800; // 3 Hours default
    const progress = Math.min(dailyStudySeconds / dailyTargetSeconds, 1);
    const strokeDashoffset = circumference - progress * circumference;

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-white pb-24 relative">
             {/* Header */}
             <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-700">
                        {user.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 leading-tight">Hi, {user.name.split(' ')[0]}</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Let's learn today!</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-full shadow-lg">
                    <Zap size={14} className="text-yellow-400 fill-yellow-400" />
                    <span className="font-mono font-bold text-xs">{user.streak} Days</span>
                </div>
            </div>

            {/* Study Timer Ring */}
            <div className="flex flex-col items-center justify-center py-8">
                 <div className="relative mb-6">
                     <svg width="200" height="200" className="transform -rotate-90">
                        <circle cx="100" cy="100" r={radius} stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                        <circle
                            cx="100" cy="100" r={radius}
                            stroke="var(--primary, #3b82f6)"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-in-out"
                        />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-4xl font-black text-slate-800 font-mono tracking-tighter">
                            {formatTime(dailyStudySeconds)}
                         </span>
                         <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Study Time</span>
                     </div>
                 </div>
            </div>

            {/* Quick Actions Grid (Row of 3) */}
            <div className="px-4 mb-4">
                <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => onStartAutoChallenge('DAILY')} className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex flex-col items-center gap-2 hover:bg-blue-100 transition-colors">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                            <Rocket size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight">Mixed Quiz</span>
                    </button>

                    <button onClick={() => navigate('/courses')} className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 flex flex-col items-center gap-2 hover:bg-indigo-100 transition-colors">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                            <Book size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight">Courses</span>
                    </button>

                    <button onClick={() => navigate('/courses?tab=video')} className="bg-red-50 p-3 rounded-2xl border border-red-100 flex flex-col items-center gap-2 hover:bg-red-100 transition-colors">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                            <Video size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight">Universal Video</span>
                    </button>
                </div>
            </div>

            {/* Secondary Actions Grid (Row of 3) */}
            <div className="px-4">
                <div className="grid grid-cols-3 gap-3">
                     <button onClick={() => navigate('/courses')} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center gap-2 hover:bg-slate-100 transition-colors">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                            <Book size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight">Library</span>
                    </button>

                    <button onClick={() => navigate('/courses?tab=pdf')} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center gap-2 hover:bg-slate-100 transition-colors">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                            <FileText size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight">Saved Notes</span>
                    </button>

                    <button onClick={() => navigate('/profile')} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center gap-2 hover:bg-slate-100 transition-colors">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                            <HistoryIcon size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight">History</span>
                    </button>
                </div>
            </div>

            <StudentBottomNav />
        </div>
    );
};
