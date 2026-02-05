import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { User, Subject, StudentTab, SystemSettings, WeeklyTest } from '../types';
import { generateDailyChallengeQuestions } from '../utils/challengeGenerator';
import { generateMorningInsight } from '../services/morningInsight';
import { saveUserToLive } from '../firebase';
import { DashboardHome } from './pages/DashboardHome';
import { AITools } from './pages/AITools';
import { CoursesLibrary } from './pages/CoursesLibrary';
import { ProfilePage } from './pages/ProfilePage';

interface Props {
  user: User;
  dailyStudySeconds: number;
  onSubjectSelect: (subject: Subject) => void;
  onRedeemSuccess: (user: User) => void;
  settings?: SystemSettings;
  onStartWeeklyTest?: (test: WeeklyTest) => void;
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  setFullScreen: (full: boolean) => void;
  onNavigate?: (view: 'ADMIN_DASHBOARD') => void;
  isImpersonating?: boolean;
  onNavigateToChapter?: (chapterId: string, chapterTitle: string, subjectName: string, classLevel?: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (v: boolean) => void;
}

export const StudentDashboard: React.FC<Props> = ({
    user, dailyStudySeconds, onSubjectSelect, onRedeemSuccess, settings,
    onStartWeeklyTest, activeTab, onTabChange, setFullScreen, onNavigate,
    isImpersonating, isDarkMode, onToggleDarkMode
}) => {

    // --- MORNING INSIGHT LOADER & AUTO-GENERATOR ---
    useEffect(() => {
        const loadMorningInsight = async () => {
            const now = new Date();
            if (now.getHours() >= 10) {
                const today = now.toDateString();
                const savedBanner = localStorage.getItem('nst_morning_banner');

                if (savedBanner) {
                    const parsed = JSON.parse(savedBanner);
                    if (parsed.date === today) return;
                }

                const isGen = localStorage.getItem(`nst_insight_gen_${today}`);
                if (!isGen) {
                    localStorage.setItem(`nst_insight_gen_${today}`, 'true');
                    try {
                        const logs = JSON.parse(localStorage.getItem('nst_universal_analysis_logs') || '[]');
                        if (logs.length === 0) return;

                        await generateMorningInsight(logs, settings, (banner) => {
                            localStorage.setItem('nst_morning_banner', JSON.stringify(banner));
                        });
                    } catch (e) {
                        localStorage.removeItem(`nst_insight_gen_${today}`);
                    }
                }
            }
        };
        loadMorningInsight();
    }, [user.role, settings]);

    // --- DAILY/WEEKLY CHALLENGE AUTO-GENERATOR ---
    useEffect(() => {
        const checkAndGenerateChallenges = async () => {
            const today = new Date();
            const dateStr = today.toDateString();

            // 1. DAILY CHALLENGE
            const lastDaily = localStorage.getItem(`daily_challenge_gen_${dateStr}`);
            if (!lastDaily && user && user.classLevel && settings) {
                try {
                    const challenge = await generateDailyChallengeQuestions(
                        user.classLevel, user.board || 'CBSE', user.stream || null,
                        settings, user.id, 'DAILY'
                    );
                    localStorage.setItem(`daily_challenge_data`, JSON.stringify(challenge));
                    localStorage.setItem(`daily_challenge_gen_${dateStr}`, 'true');
                } catch (e) { console.error("Daily Challenge Gen Error", e); }
            }

            // 2. WEEKLY CHALLENGE (Sunday)
            if (today.getDay() === 0) {
                const lastWeekly = localStorage.getItem(`weekly_challenge_gen_${dateStr}`);
                if (!lastWeekly && user && user.classLevel && settings) {
                    try {
                        const challenge = await generateDailyChallengeQuestions(
                            user.classLevel, user.board || 'CBSE', user.stream || null,
                            settings, user.id, 'WEEKLY'
                        );
                        localStorage.setItem(`weekly_challenge_data`, JSON.stringify(challenge));
                        localStorage.setItem(`weekly_challenge_gen_${dateStr}`, 'true');
                    } catch (e) { console.error("Weekly Challenge Gen Error", e); }
                }
            }
        };

        checkAndGenerateChallenges();
    }, [user.classLevel, user.board, settings]);

    const startAutoChallenge = (type: 'DAILY' | 'WEEKLY') => {
        const key = type === 'DAILY' ? 'daily_challenge_data' : 'weekly_challenge_data';
        const stored = localStorage.getItem(key);
        if (stored) {
            const challenge = JSON.parse(stored);
            const mappedTest: WeeklyTest = {
                id: challenge.id,
                name: challenge.name,
                description: type === 'DAILY' ? 'Daily Mixed Practice' : 'Weekly Mega Test',
                isActive: true,
                classLevel: user.classLevel || '10',
                questions: challenge.questions,
                totalQuestions: challenge.questions.length,
                passingScore: Math.ceil(challenge.questions.length * 0.5),
                createdAt: new Date().toISOString(),
                durationMinutes: challenge.durationMinutes,
                autoSubmitEnabled: true
            };
            if (onStartWeeklyTest) onStartWeeklyTest(mappedTest);
        } else {
            alert("Challenge not ready yet. Please try again later.");
        }
    };

    return (
        <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
                <DashboardHome
                    user={user}
                    dailyStudySeconds={dailyStudySeconds}
                    settings={settings}
                    onStartAutoChallenge={startAutoChallenge}
                />
            } />
            <Route path="/ai-tools" element={
                <AITools
                    user={user}
                    settings={settings}
                    onUpdateUser={onRedeemSuccess}
                />
            } />
            <Route path="/courses" element={
                <CoursesLibrary
                    user={user}
                    settings={settings}
                    onUpdateUser={onRedeemSuccess}
                    onSubjectSelect={onSubjectSelect}
                />
            } />
            <Route path="/profile" element={
                <ProfilePage
                    user={user}
                    settings={settings}
                    onUpdateUser={onRedeemSuccess}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={onToggleDarkMode}
                    onLogout={() => {
                        localStorage.removeItem('nst_current_user');
                        window.location.reload();
                    }}
                />
            } />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
};
