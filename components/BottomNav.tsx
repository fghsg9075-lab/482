import React from 'react';
import { Home, BrainCircuit, BookOpen, User } from 'lucide-react';
import { ViewState, StudentTab } from '../types';

interface Props {
    currentView: ViewState;
    studentTab: StudentTab;
    onNavigate: (view: ViewState) => void;
    onTabChange: (tab: StudentTab) => void;
}

export const BottomNav: React.FC<Props> = ({ currentView, studentTab, onNavigate, onTabChange }) => {

    const isHomeActive = currentView === 'STUDENT_DASHBOARD' && studentTab === 'HOME';
    const isAiActive = currentView === 'AI_TOOLS';
    const isLibraryActive = currentView === 'STUDENT_DASHBOARD' && studentTab === 'COURSES';
    const isProfileActive = currentView === 'STUDENT_DASHBOARD' && studentTab === 'PROFILE';

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-[env(safe-area-inset-bottom,20px)]">
            <div className="flex justify-around items-center h-16">

                {/* HOME */}
                <button
                    onClick={() => { onNavigate('STUDENT_DASHBOARD'); onTabChange('HOME'); }}
                    className={`flex flex-col items-center justify-center w-full h-full ${isHomeActive ? 'text-blue-600' : 'text-slate-400'}`}
                >
                    <Home size={24} fill={isHomeActive ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Home</span>
                </button>

                {/* AI TOOLS */}
                <button
                    onClick={() => { onNavigate('AI_TOOLS'); }}
                    className={`flex flex-col items-center justify-center w-full h-full ${isAiActive ? 'text-indigo-600' : 'text-slate-400'}`}
                >
                    <BrainCircuit size={24} className={isAiActive ? "animate-pulse" : ""} />
                    <span className="text-[10px] font-bold mt-1">AI Tools</span>
                </button>

                {/* LIBRARY */}
                <button
                    onClick={() => { onNavigate('STUDENT_DASHBOARD'); onTabChange('COURSES'); }}
                    className={`flex flex-col items-center justify-center w-full h-full ${isLibraryActive ? 'text-blue-600' : 'text-slate-400'}`}
                >
                    <BookOpen size={24} fill={isLibraryActive ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Library</span>
                </button>

                {/* PROFILE */}
                <button
                    onClick={() => { onNavigate('STUDENT_DASHBOARD'); onTabChange('PROFILE'); }}
                    className={`flex flex-col items-center justify-center w-full h-full ${isProfileActive ? 'text-blue-600' : 'text-slate-400'}`}
                >
                    <User size={24} fill={isProfileActive ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Profile</span>
                </button>

            </div>
        </div>
    );
};
