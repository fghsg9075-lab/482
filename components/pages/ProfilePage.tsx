import React, { useState } from 'react';
import { User, SystemSettings } from '../../types';
import { Sparkles, Zap, Edit, BarChart3, History, LogOut } from 'lucide-react';
import { StudentBottomNav } from '../navigation/StudentBottomNav';
import { useNavigate } from 'react-router-dom';

interface Props {
    user: User;
    settings?: SystemSettings;
    onUpdateUser: (user: User) => void;
    onLogout: () => void;
    isDarkMode?: boolean;
    onToggleDarkMode?: (v: boolean) => void;
}

export const ProfilePage: React.FC<Props> = ({ user, settings, onUpdateUser, onLogout, isDarkMode, onToggleDarkMode }) => {
    const navigate = useNavigate();
    const [editMode, setEditMode] = useState(false);
    const [profileData, setProfileData] = useState({
        classLevel: user.classLevel || '10',
        board: user.board || 'CBSE',
        stream: user.stream || 'Science',
        newPassword: '',
        dailyGoalHours: 3
    });
    const [showNameChangeModal, setShowNameChangeModal] = useState(false);
    const [newNameInput, setNewNameInput] = useState('');

    const saveProfile = () => {
        // Simple save logic (extracted from original)
        const cost = settings?.profileEditCost ?? 10;
        const isPremium = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();

        if (!isPremium && user.credits < cost) {
            alert(`Insufficient Coins! Need ${cost}.`);
            return;
        }

        const updatedUser = {
            ...user,
            board: profileData.board as any,
            classLevel: profileData.classLevel as any,
            stream: profileData.stream as any,
            password: profileData.newPassword.trim() ? profileData.newPassword : user.password,
            credits: isPremium ? user.credits : user.credits - cost
        };
        onUpdateUser(updatedUser);
        setEditMode(false);
        alert("Profile Updated!");
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24 px-4 pt-6">
            {/* PROFILE CARD */}
            <div className={`rounded-3xl p-8 text-center text-white mb-6 shadow-xl relative overflow-hidden transition-all duration-500 ${
                user.subscriptionLevel === 'ULTRA' && user.isPremium
                ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 shadow-purple-500/50'
                : user.subscriptionLevel === 'BASIC' && user.isPremium
                ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 shadow-blue-500/50'
                : 'bg-gradient-to-br from-slate-700 to-slate-900'
            }`}>
                 <div className="relative z-10">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-black shadow-2xl text-slate-800">
                        {user.name.charAt(0)}
                    </div>

                    <div className="flex items-center justify-center gap-2">
                        <h2 className="text-3xl font-black">{user.name}</h2>
                        <button onClick={() => { setNewNameInput(user.name); setShowNameChangeModal(true); }} className="bg-white/20 p-1.5 rounded-full hover:bg-white/40"><Edit size={14} /></button>
                    </div>
                    <p className="text-white/80 text-sm font-mono">ID: {user.displayId || user.id}</p>

                    <div className="mt-4">
                        <span className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-white/20 backdrop-blur-sm border border-white/10">
                            {user.isPremium ? `✨ ${user.subscriptionLevel} MEMBER ✨` : 'Free User'}
                        </span>
                    </div>
                 </div>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-center">
                    <p className="text-xs font-bold text-blue-600 uppercase">Credits</p>
                    <p className="text-2xl font-black text-blue-600">{user.credits}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 text-center">
                    <p className="text-xs font-bold text-orange-600 uppercase">Streak</p>
                    <p className="text-2xl font-black text-orange-600">{user.streak} Days</p>
                </div>
            </div>

            {/* MENU ACTIONS */}
            <div className="space-y-3">
                <button onClick={() => navigate('/analytics')} className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 font-bold text-slate-700">
                    <BarChart3 size={20} className="text-blue-600" /> Analytics
                </button>
                <button onClick={() => navigate('/history')} className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 font-bold text-slate-700">
                    <History size={20} className="text-purple-600" /> History
                </button>

                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}>
                            {isDarkMode ? <Sparkles size={16} /> : <Zap size={16} />}
                        </div>
                        <span className="font-bold text-slate-700 text-sm">Dark Mode</span>
                    </div>
                    <button onClick={() => onToggleDarkMode && onToggleDarkMode(!isDarkMode)} className={`w-12 h-7 rounded-full relative transition-colors ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`}>
                         <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${isDarkMode ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>

                <button onClick={() => setEditMode(true)} className="w-full bg-slate-800 text-white p-4 rounded-xl font-bold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2">
                    <Edit size={18} /> Edit Profile
                </button>

                <button onClick={onLogout} className="w-full bg-red-50 text-red-600 p-4 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100">
                    <LogOut size={18} /> Logout
                </button>
            </div>

            {/* EDIT MODAL */}
            {editMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                        <h3 className="font-bold text-lg mb-4">Edit Profile</h3>
                        <div className="space-y-3">
                            <select value={profileData.classLevel} onChange={e => setProfileData({...profileData, classLevel: e.target.value})} className="w-full p-2 border rounded-lg">
                                {['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="password" placeholder="New Password" value={profileData.newPassword} onChange={e => setProfileData({...profileData, newPassword: e.target.value})} className="w-full p-2 border rounded-lg" />
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setEditMode(false)} className="flex-1 py-2 text-slate-500 font-bold bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={saveProfile} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* NAME CHANGE MODAL */}
            {showNameChangeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                        <h3 className="font-bold text-lg mb-4">Change Name</h3>
                        <input value={newNameInput} onChange={e => setNewNameInput(e.target.value)} className="w-full p-2 border rounded-lg mb-4" />
                        <div className="flex gap-2">
                             <button onClick={() => setShowNameChangeModal(false)} className="flex-1 py-2 text-slate-500 font-bold bg-slate-100 rounded-lg">Cancel</button>
                             <button onClick={() => {
                                 const cost = settings?.nameChangeCost || 10;
                                 if(user.credits < cost) { alert(`Need ${cost} coins`); return; }
                                 onUpdateUser({...user, name: newNameInput, credits: user.credits - cost});
                                 setShowNameChangeModal(false);
                             }} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg">Update ({settings?.nameChangeCost || 10}c)</button>
                        </div>
                    </div>
                </div>
            )}

            <StudentBottomNav />
        </div>
    );
};
