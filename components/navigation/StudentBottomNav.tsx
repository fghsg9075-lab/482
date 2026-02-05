import React from 'react';
import { Home, Sparkles, Book, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const StudentBottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;

    const isActive = (p: string) => path === p || path.startsWith(p + '/');

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-around items-center h-16">
                <button onClick={() => navigate('/dashboard')} className={`flex flex-col items-center justify-center w-full h-full ${isActive('/dashboard') ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Home size={24} fill={isActive('/dashboard') ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Home</span>
                </button>

                <button onClick={() => navigate('/ai-tools')} className={`flex flex-col items-center justify-center w-full h-full ${isActive('/ai-tools') ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Sparkles size={24} fill={isActive('/ai-tools') ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">AI Tools</span>
                </button>

                <button onClick={() => navigate('/courses')} className={`flex flex-col items-center justify-center w-full h-full ${isActive('/courses') ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Book size={24} fill={isActive('/courses') ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Library</span>
                </button>

                <button onClick={() => navigate('/profile')} className={`flex flex-col items-center justify-center w-full h-full ${isActive('/profile') ? 'text-blue-600' : 'text-slate-400'}`}>
                    <User size={24} fill={isActive('/profile') ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Profile</span>
                </button>
            </div>
        </div>
    );
};
