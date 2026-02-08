
import React, { useState, useEffect, useRef } from 'react';
import { User, Subject, StudentTab, SystemSettings, CreditPackage, WeeklyTest, Chapter, MCQItem, Challenge20 } from '../types';
import { updateUserStatus, db, saveUserToLive, getChapterData, rtdb, saveAiInteraction, saveSystemSettings } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, query, limitToLast, onValue } from 'firebase/database';
import { getSubjectsList, DEFAULT_APP_FEATURES, ALL_APP_FEATURES } from '../constants';
import { getActiveChallenges } from '../services/questionBank';
import { generateDailyChallengeQuestions } from '../utils/challengeGenerator';
import { generateMorningInsight } from '../services/morningInsight';
import { RedeemSection } from './RedeemSection';
import { PrizeList } from './PrizeList';
import { Store } from './Store';
import { Layout, Gift, Sparkles, Megaphone, Lock, BookOpen, AlertCircle, Edit, Settings, Play, Pause, RotateCcw, MessageCircle, Gamepad2, Timer, CreditCard, Send, CheckCircle, Mail, X, Ban, Smartphone, Trophy, ShoppingBag, ArrowRight, Video, Youtube, Home, User as UserIcon, Book, BookOpenText, List, BarChart3, Award, Bell, Headphones, LifeBuoy, WifiOff, Zap, Star, Crown, History, ListChecks, Rocket, Ticket, TrendingUp, BrainCircuit, Menu, Compass } from 'lucide-react';
import { BannerCarousel } from './BannerCarousel';
import { SubjectSelection } from './SubjectSelection';
import { ChapterSelection } from './ChapterSelection'; // Imported for Video Flow
import { ContentTypeSelection } from './ContentTypeSelection'; // New Component
import { VideoPlaylistView } from './VideoPlaylistView'; // Imported for Video Flow
import { AudioPlaylistView } from './AudioPlaylistView'; // Imported for Audio Flow
import { PdfView } from './PdfView'; // Imported for PDF Flow
import { McqView } from './McqView'; // Imported for MCQ Flow
import { MiniPlayer } from './MiniPlayer'; // Imported for Audio Flow
import { HistoryPage } from './HistoryPage';
import { Leaderboard } from './Leaderboard';
import { SpinWheel } from './SpinWheel';
import { fetchChapters, generateCustomNotes } from '../services/groq'; // Needed for Video Flow
import { FileText, CheckSquare } from 'lucide-react'; // Icons
import { LoadingOverlay } from './LoadingOverlay';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { UserGuide } from './UserGuide';
import { CustomAlert } from './CustomDialogs';
import { AnalyticsPage } from './AnalyticsPage';
import { LiveResultsFeed } from './LiveResultsFeed';
// import { ChatHub } from './ChatHub';
import { UniversalInfoPage } from './UniversalInfoPage';
import { UniversalChat } from './UniversalChat';
import { AiHistoryPage } from './AiHistoryPage';
import { ExpiryPopup } from './ExpiryPopup';
import { SubscriptionHistory } from './SubscriptionHistory';
import { MonthlyMarksheet } from './MonthlyMarksheet';
import { SearchResult } from '../utils/syllabusSearch';
import { AiDeepAnalysis } from './AiDeepAnalysis';
import { CustomBloggerPage } from './CustomBloggerPage';
import { ReferralPopup } from './ReferralPopup';
import { StudentAiAssistant } from './StudentAiAssistant';
import { SpeakButton } from './SpeakButton';

interface Props {
  user: User;
  dailyStudySeconds: number; // Received from Global App
  onSubjectSelect: (subject: Subject) => void;
  onRedeemSuccess: (user: User) => void;
  settings?: SystemSettings; // New prop
  onStartWeeklyTest?: (test: WeeklyTest) => void;
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  setFullScreen: (full: boolean) => void; // Passed from App
  onNavigate?: (view: 'ADMIN_DASHBOARD') => void; // Added for Admin Switch
  isImpersonating?: boolean;
  onNavigateToChapter?: (chapterId: string, chapterTitle: string, subjectName: string, classLevel?: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (v: boolean) => void;
}

const DEFAULT_PACKAGES: CreditPackage[] = [
    { id: 'pkg-1', name: 'Starter Pack', price: 100, credits: 150 },
    { id: 'pkg-2', name: 'Value Pack', price: 200, credits: 350 },
    { id: 'pkg-3', name: 'Pro Pack', price: 500, credits: 1500 },
    { id: 'pkg-4', name: 'Ultra Pack', price: 1000, credits: 3000 },
    { id: 'pkg-5', name: 'Mega Pack', price: 2000, credits: 7000 },
    { id: 'pkg-6', name: 'Giga Pack', price: 3000, credits: 12000 },
    { id: 'pkg-7', name: 'Ultimate Pack', price: 5000, credits: 20000 }
];

export const StudentDashboard: React.FC<Props> = ({ user, dailyStudySeconds, onSubjectSelect, onRedeemSuccess, settings, onStartWeeklyTest, activeTab, onTabChange, setFullScreen, onNavigate, isImpersonating, onNavigateToChapter, isDarkMode, onToggleDarkMode }) => {
  // CUSTOM ALERT STATE (Moved up to be available for early hooks)
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, type: 'SUCCESS'|'ERROR'|'INFO', title?: string, message: string}>({isOpen: false, type: 'INFO', message: ''});
  const showAlert = (msg: string, type: 'SUCCESS'|'ERROR'|'INFO' = 'INFO', title?: string) => {
      setAlertConfig({ isOpen: true, type, title, message: msg });
  };

  // NEW NOTIFICATION LOGIC
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  useEffect(() => {
      const q = query(ref(rtdb, 'universal_updates'), limitToLast(1));
      const unsub = onValue(q, snap => {
          const data = snap.val();
          if (data) {
              const latest = Object.values(data)[0] as any;
              const lastRead = localStorage.getItem('nst_last_read_update') || '0';
              if (new Date(latest.timestamp).getTime() > Number(lastRead)) {
                  setHasNewUpdate(true);
                      // IMMEDIATE ALERT FOR NEW UPDATE (FIX: Show once per update ID)
                      const alertKey = `nst_update_alert_shown_${latest.id}`;
                      if (!localStorage.getItem(alertKey)) {
                          showAlert(`New Content Available: ${latest.text}`, 'INFO', 'New Update');
                          localStorage.setItem(alertKey, 'true');
                      }
              } else {
                  setHasNewUpdate(false);
              }
          }
      });
      return () => unsub();
  }, []);

  // const [activeTab, setActiveTab] = useState<StudentTab>('VIDEO'); // REMOVED LOCAL STATE
  const [testAttempts, setTestAttempts] = useState<Record<string, any>>(JSON.parse(localStorage.getItem(`nst_test_attempts_${user.id}`) || '{}'));
  const globalMessage = localStorage.getItem('nst_global_message');
  const [activeExternalApp, setActiveExternalApp] = useState<string | null>(null);
  const [pendingApp, setPendingApp] = useState<{app: any, cost: number} | null>(null);
  // GENERIC CONTENT FLOW STATE (Used for Video, PDF, MCQ)
  const [contentViewStep, setContentViewStep] = useState<'TYPES' | 'SUBJECTS' | 'CHAPTERS' | 'PLAYER'>('TYPES');
  const [selectedContentType, setSelectedContentType] = useState<'VIDEO' | 'PDF' | 'MCQ' | 'AUDIO'>('PDF');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [syllabusMode, setSyllabusMode] = useState<'SCHOOL' | 'COMPETITION'>('SCHOOL');
  const [currentAudioTrack, setCurrentAudioTrack] = useState<{url: string, title: string} | null>(null);


  // LOADING STATE FOR 10S RULE
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
      classLevel: user.classLevel || '10',
      board: user.board || 'CBSE',
      stream: user.stream || 'Science',
      newPassword: '',
      dailyGoalHours: 3 // Default
  });

  const [canClaimReward, setCanClaimReward] = useState(false);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showNameChangeModal, setShowNameChangeModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  // REPLACED CHAT WITH SUPPORT MODAL
  const [showSupportModal, setShowSupportModal] = useState(false); // Keep for legacy/direct email if needed
  const [showChat, setShowChat] = useState(false); // New Universal Chat

  // ADMIN LAYOUT EDITING STATE
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);

  // Expiry Logic
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);

  // Monthly Report
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showReferralPopup, setShowReferralPopup] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Navigation Refs
  const heroRef = useRef<HTMLDivElement>(null);

  // --- REFERRAL POPUP CHECK ---
  useEffect(() => {
      const isNew = (Date.now() - new Date(user.createdAt).getTime()) < 10 * 60 * 1000; // 10 mins window
      if (isNew && !user.redeemedReferralCode && !localStorage.getItem(`referral_shown_${user.id}`)) {
          setShowReferralPopup(true);
          localStorage.setItem(`referral_shown_${user.id}`, 'true');
      }
  }, [user.id, user.createdAt, user.redeemedReferralCode]);

  const handleSupportEmail = () => {
    const email = "nadim841442@gmail.com";
    const subject = encodeURIComponent(`Support Request: ${user.name} (ID: ${user.id})`);
    const body = encodeURIComponent(`Student Details:\nName: ${user.name}\nUID: ${user.id}\nEmail: ${user.email}\n\nIssue Description:\n`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  // Request Content Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestData, setRequestData] = useState({ subject: '', topic: '', type: 'PDF' });

  // AI Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Custom Daily Target Logic
  const [dailyTargetSeconds, setDailyTargetSeconds] = useState(3 * 3600);
  const REWARD_AMOUNT = settings?.dailyReward || 3;

  // Phone setup
  const adminPhones = settings?.adminPhones || [{id: 'default', number: '8227070298', name: 'Admin'}];
  const defaultPhoneId = adminPhones.find(p => p.isDefault)?.id || adminPhones[0]?.id || 'default';

  if (!selectedPhoneId && adminPhones.length > 0) {
    setSelectedPhoneId(defaultPhoneId);
  }

  // --- CHALLENGE 2.0 LOGIC ---
  const [challenges20, setChallenges20] = useState<Challenge20[]>([]);
  useEffect(() => {
      const loadChallenges = async () => {
          if (user.classLevel) {
              const active = await getActiveChallenges(user.classLevel);
              setChallenges20(active);
          }
      };
      loadChallenges();
      // Poll every minute
      const interval = setInterval(loadChallenges, 60000);
      return () => clearInterval(interval);
  }, [user.classLevel]);

  const startChallenge20 = (challenge: Challenge20) => {
      // Map Challenge20 to WeeklyTest structure
      const safeQuestions = Array.isArray(challenge.questions) ? challenge.questions : [];

      const mappedTest: WeeklyTest = {
          id: challenge.id,
          name: challenge.title,
          description: challenge.description || '2.0 Challenge',
          isActive: true,
          classLevel: challenge.classLevel,
          questions: safeQuestions,
          totalQuestions: safeQuestions.length,
          passingScore: Math.ceil(safeQuestions.length * 0.5), // 50% Passing Default
          createdAt: challenge.createdAt,
          durationMinutes: challenge.durationMinutes || (challenge.type === 'DAILY_CHALLENGE' ? 15 : 60),
          autoSubmitEnabled: true
      };

      if (onStartWeeklyTest) onStartWeeklyTest(mappedTest);
  };

  // --- SELF-REPAIR SYNC (Fix for "New User Not Showing") ---
  useEffect(() => {
      if (user && user.id) {
          saveUserToLive(user);
      }
  }, [user.id]);

  // --- DISCOUNT TIMER STATE ---
  const [discountTimer, setDiscountTimer] = useState<string | null>(null);
  const [discountStatus, setDiscountStatus] = useState<'WAITING' | 'ACTIVE' | 'NONE'>('NONE');
  const [showDiscountBanner, setShowDiscountBanner] = useState(false);
  const [morningBanner, setMorningBanner] = useState<any>(null); // NEW: Morning Banner

  // --- MORNING INSIGHT LOADER & AUTO-GENERATOR ---
  useEffect(() => {
      const loadMorningInsight = async () => {
          const now = new Date();
          // Check if time is past 10 AM (Hour 10)
          if (now.getHours() >= 10) {
              const today = now.toDateString();
              const savedBanner = localStorage.getItem('nst_morning_banner');

              if (savedBanner) {
                  const parsed = JSON.parse(savedBanner);
                  if (parsed.date === today) {
                      setMorningBanner(parsed);
                      return;
                  }
              }

              // IF MISSING: Auto-Generate (Client-side automation)
              // We allow any user to trigger this to ensure it happens
              // Logic: Fetch logs -> Generate -> Save -> Display
              // We check a 'generating' flag to prevent double hits
              const isGen = localStorage.getItem(`nst_insight_gen_${today}`);
              if (!isGen) {
                  localStorage.setItem(`nst_insight_gen_${today}`, 'true'); // Lock
                  try {
                      console.log("Generating Morning Insight...");
                      // Mock Logs if Universal Logs unavailable locally
                      const logs = JSON.parse(localStorage.getItem('nst_universal_analysis_logs') || '[]');

                      if (logs.length === 0) {
                          // Skip generation if no data
                          console.log("No logs for insight.");
                          return;
                      }

                      await generateMorningInsight(
                          logs,
                          settings,
                          (banner) => {
                              localStorage.setItem('nst_morning_banner', JSON.stringify(banner));
                              setMorningBanner(banner);
                              // Sync to Firebase if Admin
                              if (user.role === 'ADMIN') {
                                  // Implementation details for firebase sync omitted for safety
                              }
                          }
                      );
                  } catch (e) {
                      console.error("Insight Gen Failed", e);
                      localStorage.removeItem(`nst_insight_gen_${today}`); // Unlock
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

          // 1. DAILY CHALLENGE (Reset every day)
          const lastDaily = localStorage.getItem(`daily_challenge_gen_${dateStr}`);
          if (!lastDaily) {
              // Generate Logic
              if (user && user.classLevel && settings) {
                  try {
                      const challenge = await generateDailyChallengeQuestions(
                          user.classLevel,
                          user.board || 'CBSE',
                          user.stream || null,
                          settings,
                          user.id,
                          'DAILY'
                      );
                      // Save to LocalStorage to prevent re-gen today
                      localStorage.setItem(`daily_challenge_data`, JSON.stringify(challenge));
                      localStorage.setItem(`daily_challenge_gen_${dateStr}`, 'true');
                  } catch (e) { console.error("Daily Challenge Gen Error", e); }
              }
          }

          // 2. WEEKLY CHALLENGE (Reset every Sunday)
          // Check if today is Sunday (0) and not generated
          if (today.getDay() === 0) {
              const lastWeekly = localStorage.getItem(`weekly_challenge_gen_${dateStr}`);
              if (!lastWeekly) {
                  if (user && user.classLevel && settings) {
                      try {
                          const challenge = await generateDailyChallengeQuestions(
                              user.classLevel,
                              user.board || 'CBSE',
                              user.stream || null,
                              settings,
                              user.id,
                              'WEEKLY'
                          );
                          localStorage.setItem(`weekly_challenge_data`, JSON.stringify(challenge));
                          localStorage.setItem(`weekly_challenge_gen_${dateStr}`, 'true');
                      } catch (e) { console.error("Weekly Challenge Gen Error", e); }
                  }
              }
          }
      };

      checkAndGenerateChallenges();
  }, [user.classLevel, user.board, settings]); // Re-run if user profile changes

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
          showAlert("Challenge not ready yet. Please try again later.", "INFO");
      }
  };

  useEffect(() => {
     const evt = settings?.specialDiscountEvent;

     const formatDiff = (diff: number) => {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        const parts = [];
        if(d > 0) parts.push(`${d}d`);
        parts.push(`${h.toString().padStart(2, '0')}h`);
        parts.push(`${m.toString().padStart(2, '0')}m`);
        parts.push(`${s.toString().padStart(2, '0')}s`);
        return parts.join(' ');
     };

     const checkStatus = () => {
         if (!evt?.enabled) {
             setShowDiscountBanner(false);
             setDiscountStatus('NONE');
             setDiscountTimer(null);
             return;
         }

         const now = Date.now();
         const startsAt = evt.startsAt ? new Date(evt.startsAt).getTime() : now;
         const endsAt = evt.endsAt ? new Date(evt.endsAt).getTime() : now;

         if (now < startsAt) {
             // WAITING (Cooldown)
             setDiscountStatus('WAITING');
             setShowDiscountBanner(true);
             const diff = startsAt - now;
             setDiscountTimer(formatDiff(diff));
         } else if (now < endsAt) {
             // ACTIVE
             setDiscountStatus('ACTIVE');
             setShowDiscountBanner(true);
             const diff = endsAt - now;
             setDiscountTimer(formatDiff(diff));
         } else {
             // EXPIRED
             setDiscountStatus('NONE');
             setShowDiscountBanner(false);
             setDiscountTimer(null);
         }
     };

     // Initial Check (Immediate)
     checkStatus();

     // Interval Check
     if (evt?.enabled) {
         const interval = setInterval(checkStatus, 1000);
         return () => clearInterval(interval);
     } else {
         // Reset if disabled
         setShowDiscountBanner(false);
         setDiscountStatus('NONE');
     }
  }, [settings?.specialDiscountEvent]);

  // --- HERO SLIDER STATE ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
      { id: 1, title: "Ultra Subscription", subtitle: "Unlock Everything: Videos, PDFs & Tests", icon: <Crown className="text-yellow-400" size={40} />, btnText: "Get Access" },
      { id: 3, title: "Smart Notes & PDFs", subtitle: "High Quality Digital Material", icon: <FileText className="text-white" size={40} />, btnText: "Read Notes" },
      { id: 4, title: "MCQ & Tests", subtitle: "Compete & View Ranks", icon: <Trophy className="text-yellow-400" size={40} />, btnText: "Start Test" },
    ];

  const handleAiNotesGeneration = async () => {
      if (!aiTopic.trim()) {
          showAlert("Please enter a topic!", "ERROR");
          return;
      }

      // Check Limits
      const today = new Date().toDateString();
      const usageKey = `nst_ai_usage_${user.id}_${today}`;
      const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');

      let limit = settings?.aiLimits?.free || 0; // Default Free Limit
      if (user.subscriptionLevel === 'BASIC' && user.isPremium) limit = settings?.aiLimits?.basic || 0;
      if (user.subscriptionLevel === 'ULTRA' && user.isPremium) limit = settings?.aiLimits?.ultra || 0;

      if (currentUsage >= limit) {
          showAlert(`Daily Limit Reached! You have used ${currentUsage}/${limit} AI generations today.`, "ERROR", "Limit Exceeded");
          return;
      }

      setAiGenerating(true);
      try {
          const notes = await generateCustomNotes(aiTopic, settings?.aiNotesPrompt || '', {
             classLevel: user.classLevel || '10',
             board: user.board || 'CBSE',
             subject: 'General'
          });
          setAiResult(notes);

          // Increment Usage
          localStorage.setItem(usageKey, (currentUsage + 1).toString());

          // SAVE TO HISTORY
          saveAiInteraction({
              id: `ai-note-${Date.now()}`,
              userId: user.id,
              userName: user.name,
              type: 'AI_NOTES',
              query: aiTopic,
              response: notes,
              timestamp: new Date().toISOString()
          });

          showAlert("Notes Generated Successfully!", "SUCCESS");
      } catch (e) {
          console.error(e);
          showAlert("Failed to generate notes. Please try again.", "ERROR");
      } finally {
          setAiGenerating(false);
      }
  };

  useEffect(() => {
      const timer = setInterval(() => {
          setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 5000); // 5s Interval as requested
      return () => clearInterval(timer);
  }, []);

  // --- ADMIN SWITCH HANDLER ---
  const handleSwitchToAdmin = () => {
    if (onNavigate) {
       onNavigate('ADMIN_DASHBOARD');
    }
  };

  const toggleLayoutVisibility = (sectionId: string) => {
      if (!settings) return;
      const currentLayout = settings.dashboardLayout || {};
      const currentConfig = currentLayout[sectionId] || { id: sectionId, visible: true };

      const newLayout = {
          ...currentLayout,
          [sectionId]: { ...currentConfig, visible: !currentConfig.visible }
      };

      // Save locally and trigger update (assuming parent handles persistence via settings prop updates or we need a way to save)
      // Since settings is a prop, we can't mutate it directly. We need to save to localStorage 'nst_system_settings' and trigger reload or use a callback if available.
      // But StudentDashboard props doesn't have onUpdateSettings.
      // We will write to localStorage directly as a quick fix for Admin convenience, ensuring AdminDashboard picks it up or we reload.
      const newSettings = { ...settings, dashboardLayout: newLayout };
      localStorage.setItem('nst_system_settings', JSON.stringify(newSettings));

      // Also update Firebase if connected (best effort)
      saveSystemSettings(newSettings);
      window.location.reload();
  };

  const getPhoneNumber = (phoneId?: string) => {
    const phone = adminPhones.find(p => p.id === (phoneId || selectedPhoneId));
    return phone ? phone.number : '8227070298';
  };

  // --- STRICT COMPETITION MODE SUBSCRIPTION CHECK ---
  useEffect(() => {
      const checkCompetitionAccess = () => {
          if (syllabusMode === 'COMPETITION') {
              const now = new Date();
              const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > now;
              // Competition Mode requires ULTRA subscription
              const hasAccess = isSubscribed && (user.subscriptionLevel === 'ULTRA' || user.subscriptionTier === 'YEARLY' || user.subscriptionTier === 'LIFETIME');

              if (!hasAccess) {
                  setSyllabusMode('SCHOOL');
                  document.documentElement.style.setProperty('--primary', settings?.themeColor || '#3b82f6');
                  showAlert("⚠️ Competition Mode is locked! Please upgrade to an Ultra subscription to access competition content.", 'ERROR', 'Locked Feature');
              }
          }
      };

      checkCompetitionAccess();

      // Auto-lock if subscription expires while using the app
      const interval = setInterval(checkCompetitionAccess, 60000); // Check every minute
      return () => clearInterval(interval);
  }, [syllabusMode, user.isPremium, user.subscriptionEndDate, user.subscriptionTier, user.subscriptionLevel, settings?.themeColor]);

  useEffect(() => {
      // Load user's custom goal
      const storedGoal = localStorage.getItem(`nst_goal_${user.id}`);
      if (storedGoal) {
          const hours = parseInt(storedGoal);
          setDailyTargetSeconds(hours * 3600);
          setProfileData(prev => ({...prev, dailyGoalHours: hours}));
      }
  }, [user.id]);

  // ... (Existing Reward Logic - Keep as is) ...
  // --- CHECK YESTERDAY'S REWARD ON LOAD ---
  useEffect(() => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yDateStr = yesterday.toDateString();

      const yActivity = parseInt(localStorage.getItem(`activity_${user.id}_${yDateStr}`) || '0');
      const yClaimed = localStorage.getItem(`reward_claimed_${user.id}_${yDateStr}`);

      if (!yClaimed && (!user.subscriptionTier || user.subscriptionTier === 'FREE')) {
          let reward = null;
          if (yActivity >= 10800) reward = { tier: 'MONTHLY', level: 'ULTRA', hours: 4 }; // 3 Hrs -> Ultra
          else if (yActivity >= 3600) reward = { tier: 'WEEKLY', level: 'BASIC', hours: 4 }; // 1 Hr -> Basic

          if (reward) {
              const expiresAt = new Date(new Date().setHours(new Date().getHours() + 24)).toISOString();
              const newMsg: any = {
                  id: `reward-${Date.now()}`,
                  text: `🎁 Daily Reward! You studied enough yesterday. Claim your ${reward.hours} hours of ${reward.level} access now!`,
                  date: new Date().toISOString(),
                  read: false,
                  type: 'REWARD',
                  reward: { tier: reward.tier as any, level: reward.level as any, durationHours: reward.hours },
                  expiresAt: expiresAt,
                  isClaimed: false
              };

              const updatedUser = {
                  ...user,
                  inbox: [newMsg, ...(user.inbox || [])]
              };

              handleUserUpdate(updatedUser);
              localStorage.setItem(`reward_claimed_${user.id}_${yDateStr}`, 'true');
          }
      }
  }, [user.id]);

  const claimRewardMessage = (msgId: string, reward: any, gift?: any) => {
      const updatedInbox = user.inbox?.map(m => m.id === msgId ? { ...m, isClaimed: true, read: true } : m);
      let updatedUser: User = { ...user, inbox: updatedInbox };
      let successMsg = '';

      if (gift) {
          // HANDLE ADMIN GIFT
          if (gift.type === 'CREDITS') {
              updatedUser.credits = (user.credits || 0) + Number(gift.value);
              successMsg = `🎁 Gift Claimed! Added ${gift.value} Credits.`;
          } else if (gift.type === 'SUBSCRIPTION') {
              const [tier, level] = (gift.value as string).split('_');
              const duration = gift.durationHours || 24;
              const endDate = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

              updatedUser.subscriptionTier = tier as any;
              updatedUser.subscriptionLevel = level as any;
              updatedUser.subscriptionEndDate = endDate;
              updatedUser.isPremium = true;

              successMsg = `🎁 Gift Claimed! ${tier} ${level} unlocked for ${duration} hours.`;
          }
      } else if (reward) {
          // HANDLE AUTO REWARD
          const duration = reward.durationHours || 4;
          const endDate = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

          updatedUser.subscriptionTier = reward.tier;
          updatedUser.subscriptionLevel = reward.level;
          updatedUser.subscriptionEndDate = endDate;
          updatedUser.isPremium = true;

          successMsg = `✅ Reward Claimed! Enjoy ${duration} hours of ${reward.level} access.`;
      }

      handleUserUpdate(updatedUser);
      showAlert(successMsg, 'SUCCESS', 'Rewards Claimed');
  };

  // --- TRACK TODAY'S ACTIVITY & FIRST DAY BONUSES ---
  useEffect(() => {
    if (!user.id) return;
    const unsub = onSnapshot(doc(db, "users", user.id), (doc) => {
        if (doc.exists()) {
            const cloudData = doc.data() as User;
            if (cloudData.credits !== user.credits ||
                cloudData.subscriptionTier !== user.subscriptionTier ||
                cloudData.isPremium !== user.isPremium ||
                cloudData.isGameBanned !== user.isGameBanned) {
                const updated = { ...user, ...cloudData };
                onRedeemSuccess(updated);
            }
        }
    });
    return () => unsub();
  }, [user.id]);

  const secondsRef = useRef(dailyStudySeconds);
  useEffect(() => { secondsRef.current = dailyStudySeconds; }, [dailyStudySeconds]);

  useEffect(() => {
      const interval = setInterval(() => {
          updateUserStatus(user.id, secondsRef.current);
          const todayStr = new Date().toDateString();
          localStorage.setItem(`activity_${user.id}_${todayStr}`, secondsRef.current.toString());

          const accountAgeHours = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
          const firstDayBonusClaimed = localStorage.getItem(`first_day_ultra_${user.id}`);

          if (accountAgeHours < 24 && secondsRef.current >= 3600 && !firstDayBonusClaimed) {
              const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 Hour
              const updatedUser: User = {
                  ...user,
                  subscriptionTier: 'MONTHLY', // Ultra
                  subscriptionEndDate: endDate,
                  isPremium: true
              };
              const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
              const idx = storedUsers.findIndex((u:User) => u.id === user.id);
              if (idx !== -1) storedUsers[idx] = updatedUser;

              localStorage.setItem('nst_users', JSON.stringify(storedUsers));
              localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
              localStorage.setItem(`first_day_ultra_${user.id}`, 'true');

              onRedeemSuccess(updatedUser);
              showAlert("🎉 FIRST DAY BONUS: You unlocked 1 Hour Free ULTRA Subscription!", 'SUCCESS');
          }

      }, 60000);
      return () => clearInterval(interval);
  }, []);

  // Inbox
  const [showInbox, setShowInbox] = useState(false);
  const unreadCount = user.inbox?.filter(m => !m.read).length || 0;

  useEffect(() => {
    const today = new Date().toDateString();
    const lastClaim = user.lastRewardClaimDate ? new Date(user.lastRewardClaimDate).toDateString() : '';
    setCanClaimReward(lastClaim !== today && dailyStudySeconds >= dailyTargetSeconds);
  }, [user.lastRewardClaimDate, dailyStudySeconds, dailyTargetSeconds]);

  const claimDailyReward = () => {
      if (!canClaimReward) return;

      // DYNAMIC REWARD LOGIC: 10 for Basic, 20 for Ultra, Default for Free
      let finalReward = REWARD_AMOUNT; // Default (e.g. 3)
      if (user.subscriptionLevel === 'BASIC' && user.isPremium) finalReward = 10;
      if (user.subscriptionLevel === 'ULTRA' && user.isPremium) finalReward = 20;

      const updatedUser = {
          ...user,
          credits: (user.credits || 0) + finalReward,
          lastRewardClaimDate: new Date().toISOString()
      };
      handleUserUpdate(updatedUser);
      setCanClaimReward(false);
      showAlert(`Received: ${finalReward} Free Credits!`, 'SUCCESS', 'Daily Goal Met');
  };

  const handleExternalAppClick = (app: any) => {
      if (app.isLocked) { showAlert("This app is currently locked by Admin.", 'ERROR'); return; }
      if (app.creditCost > 0) {
          if (user.credits < app.creditCost) { showAlert(`Insufficient Credits! You need ${app.creditCost} credits.`, 'ERROR'); return; }
          if (user.isAutoDeductEnabled) processAppAccess(app, app.creditCost);
          else setPendingApp({ app, cost: app.creditCost });
          return;
      }
      setActiveExternalApp(app.url);
  };

  const processAppAccess = (app: any, cost: number, enableAuto: boolean = false) => {
      let updatedUser = { ...user, credits: user.credits - cost };
      if (enableAuto) updatedUser.isAutoDeductEnabled = true;
      handleUserUpdate(updatedUser);
      setActiveExternalApp(app.url);
      setPendingApp(null);
  };


  const handleBuyPackage = (pkg: CreditPackage) => {
      const phoneNum = getPhoneNumber();
      const message = `Hello Admin, I want to buy credits.\n\n🆔 User ID: ${user.id}\n📦 Package: ${pkg.name}\n💰 Amount: ₹${pkg.price}\n💎 Credits: ${pkg.credits}\n\nPlease check my payment.`;
      const url = `https://wa.me/91${phoneNum}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveProfile = () => {
      // Cost Check
      const isPremium = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
      const cost = settings?.profileEditCost ?? 10;

      if (!isPremium && user.credits < cost) {
          showAlert(`Profile update costs ${cost} NST Coins.\nYou have ${user.credits} coins.`, 'ERROR');
          return;
      }

      const updatedUser = {
          ...user,
          board: profileData.board,
          classLevel: profileData.classLevel,
          stream: profileData.stream,
          password: profileData.newPassword.trim() ? profileData.newPassword : user.password,
          credits: isPremium ? user.credits : user.credits - cost
      };
      localStorage.setItem(`nst_goal_${user.id}`, profileData.dailyGoalHours.toString());
      setDailyTargetSeconds(profileData.dailyGoalHours * 3600);
      handleUserUpdate(updatedUser);
      window.location.reload();
      setEditMode(false);
  };

  const handleUserUpdate = (updatedUser: User) => {
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      const userIdx = storedUsers.findIndex((u:User) => u.id === updatedUser.id);
      if (userIdx !== -1) {
          storedUsers[userIdx] = updatedUser;
          localStorage.setItem('nst_users', JSON.stringify(storedUsers));

          if (!isImpersonating) {
              localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
              saveUserToLive(updatedUser);
          }
          onRedeemSuccess(updatedUser);
      }
  };

  const markInboxRead = () => {
      if (!user.inbox) return;
      const updatedInbox = user.inbox.map(m => ({ ...m, read: true }));
      handleUserUpdate({ ...user, inbox: updatedInbox });
  };

  // --- GENERIC CONTENT FLOW HANDLERS ---
  const handleContentSubjectSelect = async (subject: Subject) => {
      setSelectedSubject(subject);
      setLoadingChapters(true);
      setContentViewStep('CHAPTERS');
      try {
          const ch = await fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', subject, 'English');
          setChapters(ch);
      } catch(e) { console.error(e); }
      setLoadingChapters(false);
  };

  const [showSyllabusPopup, setShowSyllabusPopup] = useState<{
    subject: Subject;
    chapter: Chapter;
  } | null>(null);

  const handleContentChapterSelect = (chapter: Chapter) => {
    // Record Activity
    if (typeof (window as any).recordActivity === 'function') {
        const typeMap: Record<string, any> = {
            'VIDEO': 'VIDEO',
            'PDF': 'PDF',
            'MCQ': 'MCQ',
            'AUDIO': 'AUDIO'
        };
        const currentType = typeMap[activeTab] || 'VIEW';
        (window as any).recordActivity(currentType, chapter.title, 0, {
            itemId: chapter.id,
            subject: selectedSubject?.name || 'General'
        });
    }

    setSelectedChapter(chapter);
    setContentViewStep('PLAYER');
    setFullScreen(true);
  };

  const confirmSyllabusSelection = (mode: 'SCHOOL' | 'COMPETITION') => {
    if (showSyllabusPopup) {
      if (mode === 'COMPETITION') {
          // 1. Check if Globally Disabled
          if (settings?.isCompetitionModeEnabled === false) {
              showAlert("Coming Soon! Competition Mode is currently disabled.", 'INFO');
              return;
          }
          // 2. Check User Access (Strictly ULTRA & Active)
          const now = new Date();
          const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > now;
          const hasAccess = (isSubscribed && (user.subscriptionLevel === 'ULTRA' || user.subscriptionTier === 'YEARLY')) || user.subscriptionTier === 'LIFETIME';

          if (!hasAccess) {
              showAlert("🏆 Competition Mode is exclusive to Active ULTRA users! Renew or Upgrade.", 'ERROR');
              return;
          }
      }

      setSyllabusMode(mode);
      setSelectedChapter(showSyllabusPopup.chapter);
      setContentViewStep('PLAYER');
      setFullScreen(true);
      setShowSyllabusPopup(null);
    }
  };

  const onLoadingComplete = () => {
      setIsLoadingContent(false);
      setContentViewStep('PLAYER');
      setFullScreen(true);
  };

  // GENERIC CONTENT SECTION RENDERER
  // Trend Analysis (Last 5 tests for Home Page)
  const homeTrendData = (user.mcqHistory || [])
      .slice(0, 5)
      .reverse()
      .map(h => ({
          score: h.totalQuestions > 0 ? Math.round((h.correctCount / h.totalQuestions) * 100) : 0,
          topic: h.chapterTitle || 'Test'
      }));

  const renderContentSection = (type: 'VIDEO' | 'PDF' | 'MCQ' | 'AUDIO') => {
      const handlePlayerBack = () => {
          setContentViewStep('CHAPTERS');
          setFullScreen(false);
      };

      if (contentViewStep === 'PLAYER' && selectedChapter && selectedSubject) {
          if (type === 'VIDEO') {
            return <VideoPlaylistView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} initialSyllabusMode={syllabusMode} />;
          } else if (type === 'PDF') {
            return <PdfView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} initialSyllabusMode={syllabusMode} />;
          } else if (type === 'AUDIO') {
            return <AudioPlaylistView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} onPlayAudio={setCurrentAudioTrack} initialSyllabusMode={syllabusMode} />;
          } else {
            return <McqView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} />;
          }
      }

      if (contentViewStep === 'CHAPTERS' && selectedSubject) {
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
                      if (contentType) {
                          // contentType based logic if needed, but for now we just go to player
                          setContentViewStep('PLAYER');
                          setFullScreen(true);
                      } else {
                          handleContentChapterSelect(chapter);
                      }
                  }}
                  onBack={() => { setContentViewStep('SUBJECTS'); }}
              />
          );
      }

      return null;
  };

  const isGameEnabled = settings?.isGameEnabled ?? true;

  const DashboardSectionWrapper = ({ id, children, label }: { id: string, children: React.ReactNode, label: string }) => {
      const isVisible = settings?.dashboardLayout?.[id]?.visible !== false;

      if (!isVisible && !isLayoutEditing) return null;

      return (
          <div className={`relative ${isLayoutEditing ? 'border-2 border-dashed border-yellow-400 p-2 rounded-xl mb-4 bg-yellow-50/10' : ''}`}>
              {isLayoutEditing && (
                  <div className="absolute -top-3 left-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow z-50 flex items-center gap-2">
                      <span>{label}</span>
                      <button
                          onClick={(e) => { e.stopPropagation(); toggleLayoutVisibility(id); }}
                          className={`px-2 py-0.5 rounded text-xs ${isVisible ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                      >
                          {isVisible ? 'ON' : 'OFF'}
                      </button>
                  </div>
              )}
              <div className={!isVisible ? 'opacity-50 grayscale pointer-events-none' : ''}>
                  {children}
              </div>
          </div>
      );
  };

  const DashboardTileWrapper = ({ id, children, label }: { id: string, children: React.ReactNode, label: string }) => {
      const isVisible = settings?.dashboardLayout?.[id]?.visible !== false;

      if (!isVisible && !isLayoutEditing) return null;

      return (
          <div className={`relative h-full ${isLayoutEditing ? 'border-2 border-dashed border-yellow-400 rounded-xl bg-yellow-50/10' : ''}`}>
              {isLayoutEditing && (
                  <div className="absolute -top-2 -right-2 z-50">
                      <button
                          onClick={(e) => { e.stopPropagation(); toggleLayoutVisibility(id); }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${isVisible ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                      >
                          {isVisible ? '✓' : '✕'}
                      </button>
                  </div>
              )}
              <div className={`${!isVisible ? 'opacity-50 grayscale pointer-events-none' : ''} h-full`}>
                  {children}
              </div>
          </div>
      );
  };

  const renderHeroLayer = () => {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    // Calculate progress based on dailyStudySeconds vs dailyTargetSeconds
    const progress = Math.min(dailyStudySeconds / (dailyTargetSeconds || 10800), 1);
    const strokeDashoffset = circumference - progress * circumference;

    return (
      <div ref={heroRef} className="flex flex-col items-center justify-start pt-6 pb-8 min-h-screen relative">
         {/* 1. STUDY TIMER (Apple Watch Ring) */}
         <div className="relative mb-8">
             <svg width="200" height="200" className="transform -rotate-90">
                {/* Background Ring */}
                <circle cx="100" cy="100" r={radius} stroke="#e2e8f0" strokeWidth="12" fill="transparent" />
                {/* Progress Ring */}
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

             {/* Timer Controls */}
             <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-2 w-max">
                 <button className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold shadow-lg hover:scale-105 transition-transform border border-slate-700">15m</button>
                 <button className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold shadow-lg hover:scale-105 transition-transform border border-slate-700">30m</button>
                 <button className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold shadow-lg hover:scale-105 transition-transform border border-slate-700">1h</button>
             </div>
         </div>

         {/* 2. AI PERSONAL TUTOR (Hero Card) */}
         <div className="w-full px-4 mb-6">
             <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 rounded-3xl shadow-xl shadow-indigo-200 text-white relative overflow-hidden group cursor-pointer" onClick={() => onTabChange('AI_CHAT' as any)}>
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors"></div>
                 <div className="relative z-10">
                     <div className="flex items-center gap-3 mb-3">
                         <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                             <Sparkles size={20} className="text-yellow-300" />
                         </div>
                         <h3 className="text-lg font-black italic">AI Personal Tutor</h3>
                     </div>
                     <p className="text-sm text-indigo-100 mb-4 font-medium">Stuck on a doubt? Ask anything, I'll teach you.</p>

                     <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center justify-between">
                         <span className="text-xs text-indigo-200">Tap to start chatting...</span>
                         <div className="bg-white text-indigo-600 p-1.5 rounded-lg">
                             <ArrowRight size={14} strokeWidth={3} />
                         </div>
                     </div>
                 </div>
             </div>
         </div>

         {/* 3. CONTINUE & CHALLENGE GRID */}
         <div className="w-full px-4 grid grid-cols-2 gap-3">
             {/* Continue Learning */}
             <button onClick={() => onTabChange('COURSES')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start gap-2 hover:bg-slate-50 transition-colors text-left group">
                 <div className="p-2 bg-orange-100 rounded-lg text-orange-600 group-hover:bg-orange-200 transition-colors">
                     <Play size={18} fill="currentColor" />
                 </div>
                 <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Continue</p>
                     <p className="text-xs font-black text-slate-800 leading-tight line-clamp-2">Courses Library</p>
                 </div>
             </button>

             {/* Daily Challenge */}
             <button onClick={() => startAutoChallenge('DAILY')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start gap-2 hover:bg-slate-50 transition-colors text-left group">
                 <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-200 transition-colors">
                     <Rocket size={18} />
                 </div>
                 <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Daily Task</p>
                     <p className="text-xs font-black text-slate-800 leading-tight">Mixed Quiz (15m)</p>
                 </div>
             </button>
         </div>


      </div>
    );
  };

  const renderPowerZoneDrawer = () => {
     if (!isDrawerOpen) return null;

     return (
        <div className="fixed inset-0 z-[60] flex animate-in fade-in duration-200">
           {/* Backdrop */}
           <div
             className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
             onClick={() => setIsDrawerOpen(false)}
           ></div>

           {/* Drawer Content */}
           <div className="relative w-[85%] max-w-sm h-full bg-slate-50 overflow-y-auto shadow-2xl animate-in slide-in-from-left duration-300">
              <div className="p-4 space-y-6 pb-24">
                 <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Layout size={24} className="text-blue-600" /> Power Zone
                    </h2>
                    <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-200 rounded-full hover:bg-slate-300">
                        <X size={20} className="text-slate-600" />
                    </button>
                 </div>

                 {/* PROFILE HEADER (Moved from Home) */}
                 <DashboardSectionWrapper id="section_profile_header" label="Profile Header">
                    <div
                        onClick={() => onTabChange('ANALYTICS')}
                        className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-3xl shadow-lg border border-white/10 relative overflow-hidden cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                    <UserIcon size={24} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white leading-tight">{user.name}</h2>
                                    <p className="text-white/60 text-[10px] font-bold uppercase">{user.classLevel} • {user.board}</p>
                                </div>
                            </div>

                            {/* Stats Summary */}
                             <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                                    <p className="text-[9px] text-white/50 uppercase font-bold">Credits</p>
                                    <p className="text-lg font-mono font-bold text-yellow-400">{user.credits}</p>
                                </div>
                                <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                                    <p className="text-[9px] text-white/50 uppercase font-bold">Streak</p>
                                    <p className="text-lg font-mono font-bold text-orange-400">{user.streak} Days</p>
                                </div>
                             </div>
                        </div>
                    </div>
                 </DashboardSectionWrapper>

                 {/* QUICK ACTIONS GRID */}
                 <DashboardSectionWrapper id="services_grid" label="Services Grid">
                      <div>
                          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                              <Layout size={18} /> Quick Actions
                          </h3>
                          <div className="grid grid-cols-3 gap-3">
                              {/* Row 1 */}
                              <DashboardTileWrapper id="tile_inbox" label="Inbox">
                              <button onClick={() => { setShowInbox(true); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform relative group">
                                  <Mail size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Inbox</span>
                                  {unreadCount > 0 && <span className="absolute top-2 right-2 w-4 h-4 bg-yellow-400 text-black text-[9px] font-bold flex items-center justify-center rounded-full shadow-sm animate-pulse">{unreadCount}</span>}
                              </button>
                              </DashboardTileWrapper>

                              <DashboardTileWrapper id="tile_analytics" label="Analytics">
                              <button onClick={() => { onTabChange('ANALYTICS'); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Analytics</span>
                              </button>
                              </DashboardTileWrapper>

                              <DashboardTileWrapper id="tile_marksheet" label="Marksheet">
                              <button onClick={() => { setShowMonthlyReport(true); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <FileText size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Marksheet</span>
                              </button>
                              </DashboardTileWrapper>

                              {(user.role === 'ADMIN' || isImpersonating) && (
                                <DashboardTileWrapper id="tile_admin" label="Admin App">
                                <button onClick={() => { handleSwitchToAdmin(); setIsDrawerOpen(false); }} className="h-20 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                    <Layout size={20} className="text-yellow-400" />
                                    <span className="text-[9px] font-black text-white uppercase tracking-wider">Admin</span>
                                </button>
                                </DashboardTileWrapper>
                              )}

                              <DashboardTileWrapper id="tile_history" label="History">
                              <button onClick={() => { onTabChange('HISTORY'); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <History size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">History</span>
                              </button>
                              </DashboardTileWrapper>

                              <DashboardTileWrapper id="tile_ai_history" label="AI History">
                              <button onClick={() => { onTabChange('AI_HISTORY'); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <BrainCircuit size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">AI Logs</span>
                              </button>
                              </DashboardTileWrapper>

                              {/* Row 2 */}
                              <DashboardTileWrapper id="tile_premium" label="Store">
                              <button onClick={() => { onTabChange('STORE'); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <Crown size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Premium</span>
                              </button>
                              </DashboardTileWrapper>

                              <DashboardTileWrapper id="tile_my_plan" label="My Plan">
                              <button onClick={() => { onTabChange('SUB_HISTORY' as any); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <CreditCard size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">My Plan</span>
                              </button>
                              </DashboardTileWrapper>

                              {isGameEnabled && (
                                <DashboardTileWrapper id="tile_game" label="Game">
                                <button onClick={() => { onTabChange('GAME'); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                    <Gamepad2 size={20} style={{ color: 'var(--primary)' }} />
                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Game</span>
                                </button>
                                </DashboardTileWrapper>
                              )}

                              {/* Row 3 */}
                              <DashboardTileWrapper id="tile_redeem" label="Redeem">
                              <button onClick={() => { onTabChange('REDEEM'); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <Gift size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Redeem</span>
                              </button>
                              </DashboardTileWrapper>

                              <DashboardTileWrapper id="tile_prizes" label="Prizes">
                              <button onClick={() => { onTabChange('PRIZES'); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <Award size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Prizes</span>
                              </button>
                              </DashboardTileWrapper>

                              <DashboardTileWrapper id="tile_leaderboard" label="Ranks">
                              <button onClick={() => { onTabChange('LEADERBOARD'); setIsDrawerOpen(false); }} className="h-20 w-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                  <Trophy size={20} style={{ color: 'var(--primary)' }} />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Ranks</span>
                              </button>
                              </DashboardTileWrapper>
                          </div>
                      </div>
                 </DashboardSectionWrapper>
              </div>
           </div>
        </div>
     );
  };

  // --- RENDER BASED ON ACTIVE TAB ---
  const renderMainContent = () => {
      // 1. HOME TAB
      if (activeTab === 'HOME') {
          const isPremium = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();

          return (
              <div className="space-y-6 pb-24 relative">
                {/* 3-LAYER SYSTEM INTEGRATION */}

                {/* Layer 3: Power Zone (Drawer) */}
                {renderPowerZoneDrawer()}

                {/* Layer 1 Header (Menu + Stats) */}
                <div className="flex items-center justify-between px-2 pt-2">
                    <button onClick={() => setIsDrawerOpen(true)} className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-700 hover:bg-slate-50">
                        <Menu size={24} />
                    </button>

                    <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg">
                        <Zap size={16} className="text-yellow-400 fill-yellow-400" />
                        <span className="font-mono font-bold text-sm">{user.streak} Day Streak</span>
                    </div>
                </div>

                {renderHeroLayer()}

                <div className="bg-slate-50 pt-4 pb-32 relative z-10">
                    <div className="px-2 space-y-4">

                {/* HERO SECTION */}
                  <div className="space-y-4 mb-6">

                      {/* SPECIAL DISCOUNT BANNER (Kept separate as requested) */}
                      {showDiscountBanner && discountTimer && (
                          <div
                              onClick={() => onTabChange('STORE')}
                              className="mx-1 mb-4 relative p-[2px] rounded-2xl overflow-hidden cursor-pointer group"
                          >
                              {/* Rotating Border Animation */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-spin-slow opacity-0 group-hover:opacity-100 transition-opacity" style={{ animationDuration: '3s' }}></div>
                              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-600 animate-border-rotate"></div>

                              <div className="relative bg-gradient-to-r from-blue-900 to-slate-900 p-4 rounded-2xl shadow-xl overflow-hidden">
                                  {/* Glossy Overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>

                                  <div className="flex justify-between items-center relative z-10 text-white">
                                      <div>
                                          <h3 className="text-lg font-black italic flex items-center gap-2">
                                              <Sparkles size={18} className="text-yellow-400 animate-pulse" />
                                              {discountStatus === 'WAITING' ? '⚡ SALE STARTING SOON' : `🔥 ${settings?.specialDiscountEvent?.eventName || 'LIMITED TIME OFFER'} IS LIVE!`}
                                          </h3>
                                          <p className="text-xs font-bold text-blue-200">
                                              {discountStatus === 'WAITING' ? 'Get ready for massive discounts!' : `Get ${settings?.specialDiscountEvent?.discountPercent || 50}% OFF on all premium plans!`}
                                          </p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">{discountStatus === 'WAITING' ? 'STARTS IN' : 'ENDS IN'}</p>
                                          <p className="text-2xl font-black font-mono leading-none text-white drop-shadow-md">{discountTimer}</p>
                                      </div>
                                  </div>

                                  {/* Moving Shine Effect */}
                                  <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"></div>
                              </div>
                          </div>
                      )}

                      {/* CONSOLIDATED BANNER CAROUSEL */}
                      <BannerCarousel>
                          {/* 1. HERO SLIDER */}
                          <DashboardSectionWrapper id="hero_slider" label="Hero Slider">
                              <div className="relative h-48 rounded-2xl overflow-hidden shadow-xl mx-1 border border-white/20" style={{ backgroundColor: 'var(--primary)' }}>
                                  <div className="absolute inset-0 bg-gradient-to-br from-black/40 to-transparent"></div>
                                  {slides.map((slide, index) => (
                                      <div
                                          key={slide.id}
                                          className={`absolute inset-0 flex flex-col justify-center p-6 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                                      >
                                          <div className="text-white relative z-10">
                                              <div className="inline-block px-3 py-1 bg-black/20 rounded-full text-[10px] font-black tracking-widest mb-2 backdrop-blur-md border border-white/10 shadow-sm">
                                                  ✨ FEATURED
                                              </div>
                                              <h2 className="text-3xl font-black mb-2 leading-none drop-shadow-md">{slide.title}</h2>
                                              <p className="text-sm font-medium opacity-90 mb-4 max-w-[80%]">{slide.subtitle}</p>

                                              <button onClick={() => onTabChange('STORE')} className="bg-white text-slate-900 px-5 py-2.5 rounded-xl text-xs font-black shadow-lg hover:scale-105 transition-transform flex items-center gap-2 uppercase tracking-wider">
                                                  <Zap size={14} className="text-yellow-500 fill-yellow-500" />
                                                  {(slide as any).btnText || 'Get Access'}
                                              </button>
                                          </div>
                                          {/* Animated Background Element */}
                                          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                                      </div>
                                  ))}
                              </div>
                          </DashboardSectionWrapper>


                          {/* 3. MORNING INSIGHT BANNER */}
                          {morningBanner && (
                              <div className="mx-1 h-48 bg-gradient-to-r from-orange-100 to-amber-100 p-4 rounded-2xl shadow-sm border border-orange-200 overflow-y-auto">
                                  <div className="flex justify-between items-start mb-2">
                                      <h3 className="font-black text-orange-900 flex items-center gap-2">
                                          <Sparkles size={18} className="text-orange-600" /> {morningBanner.title || 'Morning Insight'}
                                      </h3>
                                      <div className="flex items-center gap-2">
                                          <SpeakButton text={`${morningBanner.title}. ${morningBanner.wisdom}. Common Trap: ${morningBanner.commonTrap}. Pro Tip: ${morningBanner.proTip}`} className="text-orange-600 hover:bg-orange-200" iconSize={16} />
                                          <span className="text-[10px] font-bold text-orange-600 bg-orange-200 px-2 py-0.5 rounded-full">{morningBanner.date}</span>
                                      </div>
                                  </div>
                                  <p className="text-xs text-orange-800 italic mb-3">"{morningBanner.wisdom}"</p>
                                  <div className="space-y-2">
                                      <div className="bg-white/60 p-2 rounded-lg text-xs">
                                          <span className="font-bold text-red-600 block">⚠️ Common Trap:</span>
                                          <span className="text-slate-700">{morningBanner.commonTrap}</span>
                                      </div>
                                      <div className="bg-white/60 p-2 rounded-lg text-xs">
                                          <span className="font-bold text-green-600 block">💡 Pro Tip:</span>
                                          <span className="text-slate-700">{morningBanner.proTip}</span>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* 4. CUSTOM PAGE BANNER */}
                          <div
                              onClick={() => onTabChange('CUSTOM_PAGE')}
                              className="mx-1 h-48 bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-2xl shadow-lg text-white flex flex-col justify-center cursor-pointer border border-white/20 relative overflow-hidden group"
                          >
                              <div className="relative z-10 flex justify-between items-center">
                                  <div>
                                      <h3 className="text-lg font-black flex items-center gap-2">
                                          <Sparkles size={18} className="text-yellow-300 animate-pulse" />
                                          What's New?
                                      </h3>
                                      <p className="text-xs font-medium text-orange-100">Tap to see special updates!</p>
                                  </div>
                                  <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm group-hover:scale-110 transition-transform relative z-10">
                                      <ArrowRight size={20} className="text-white" />
                                  </div>
                              </div>
                              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                          </div>

                          {/* 5. LIVE CHALLENGES & AUTO CHALLENGES */}
                          <DashboardSectionWrapper id="live_challenges" label="Live Challenges">
                              <div className="mx-1 h-48 bg-slate-900 p-4 rounded-2xl shadow-lg text-white border border-slate-700 relative overflow-hidden flex flex-col">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>

                                  <h3 className="font-black text-white flex items-center gap-2 mb-3 relative z-10">
                                      <Rocket size={18} className="text-indigo-400" /> Daily & Weekly Challenges
                                  </h3>

                                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide relative z-10 flex-1 items-center">
                                      {/* AUTO DAILY CARD */}
                                      <button onClick={() => startAutoChallenge('DAILY')} className="min-w-[140px] bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-indigo-500 transition-all text-left group">
                                          <p className="text-[10px] font-bold text-yellow-400 uppercase mb-1">Daily Challenge</p>
                                          <p className="font-bold text-sm text-white leading-tight mb-2">Mixed Practice</p>
                                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                                              <span>30 Qs</span>
                                              <span className="text-yellow-400 font-mono">15 Mins</span>
                                          </div>
                                      </button>

                                      {/* AUTO WEEKLY CARD (Only Show on Sundays) */}
                                      {new Date().getDay() === 0 && (
                                          <button onClick={() => startAutoChallenge('WEEKLY')} className="min-w-[140px] bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-purple-500 transition-all text-left group">
                                              <p className="text-[10px] font-bold text-purple-400 uppercase mb-1">Weekly Mega Test</p>
                                              <p className="font-bold text-sm text-white leading-tight mb-2">Full Revision</p>
                                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                  <span>100 Qs</span>
                                                  <span className="text-purple-400 font-mono">60 Mins</span>
                                              </div>
                                          </button>
                                      )}

                                      {challenges20.map(c => {
                                          const expiry = new Date(c.expiryDate);
                                          const now = Date.now();
                                          const timeLeft = Math.max(0, Math.floor((expiry.getTime() - now) / (1000 * 60))); // Minutes
                                          const hours = Math.floor(timeLeft / 60);
                                          const mins = timeLeft % 60;

                                          return (
                                              <button
                                                  key={c.id}
                                                  onClick={() => startChallenge20(c)}
                                                  className="min-w-[140px] bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-indigo-500 transition-all text-left group"
                                              >
                                                  <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">
                                                      {c.type === 'DAILY_CHALLENGE' ? 'Special Challenge' : 'Special Test'}
                                                  </p>
                                                  <p className="font-bold text-sm text-white leading-tight mb-2 truncate">{c.title}</p>
                                                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                      <span>{c.questions.length} Qs</span>
                                                      <span className="text-red-400 font-mono">{hours}h {mins}m left</span>
                                                  </div>
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          </DashboardSectionWrapper>

                          {/* 6. SUBSCRIPTION PROMO BANNER (Inline with Credits) */}
                          <DashboardSectionWrapper id="promo_banner" label="Promo Banner">
                              <div onClick={() => onTabChange('STORE')} className="mx-1 h-48 bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-center cursor-pointer border border-slate-700 relative overflow-hidden group">
                                  <div className="relative z-10 mb-4">
                                      <div className="flex items-center gap-2 mb-1">
                                          <Crown size={16} className="text-yellow-400 animate-pulse" />
                                          <span className="text-xs font-black text-white tracking-widest">PRO MEMBERSHIP</span>
                                      </div>
                                      <p className="text-[10px] text-slate-400">Unlock All Features + Get Credits</p>
                                  </div>
                                  <div className="relative z-10 flex flex-col items-end">
                                      <span className="text-xl font-black text-white">BASIC / ULTRA</span>
                                      <span className="text-[10px] font-bold bg-yellow-400 text-black px-2 py-0.5 rounded-full">+ 5000 Credits</span>
                                  </div>
                                  {/* Shine Effect */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                              </div>
                          </DashboardSectionWrapper>
                      </BannerCarousel>

                      {/* FEATURED SHORTCUTS (Admin Configured) */}
                      <DashboardSectionWrapper id="featured_shortcuts" label="Shortcuts">
                          <div className="px-1 mb-2">
                              <div className="grid grid-cols-2 gap-3">
                                  {/* Featured Items Logic Removed due to missing property */}
                              </div>
                          </div>
                      </DashboardSectionWrapper>

                      {/* FEATURES SLIDER (360 Loop) - DYNAMIC & CONFIGURABLE */}
                      <DashboardSectionWrapper id="features_ticker" label="Features Ticker">
                      <div className="overflow-hidden py-4 bg-slate-50 border-y border-slate-200">
                          <div className="flex gap-8 animate-marquee whitespace-nowrap">
                              {/* Use ALL_APP_FEATURES to ensure 100+ items rotate */}
                              {ALL_APP_FEATURES.map((feat, i) => (
                                  <span key={feat.id} className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                      {feat.title}
                                  </span>
                              ))}
                              {/* DUPLICATE FOR SMOOTH LOOP */}
                              {ALL_APP_FEATURES.map((feat, i) => (
                                  <span key={`dup-${feat.id}`} className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                      {feat.title}
                                  </span>
                              ))}
                          </div>
                      </div>
                      </DashboardSectionWrapper>
                  </div>

              </div>
              </div>
              </div>
          );
      }
      // 2. COURSES TAB (Schooling System)
      if (activeTab === 'COURSES') {
          if (contentViewStep === 'TYPES') {
              return (
                  <ContentTypeSelection
                      onSelect={(type) => {
                          setSelectedContentType(type);
                          setContentViewStep('SUBJECTS');
                      }}
                      onBack={() => onTabChange('HOME')}
                      settings={settings}
                  />
              );
          }
          if (contentViewStep === 'SUBJECTS') {
              return (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
                      <SubjectSelection
                          classLevel={user.classLevel || '10'}
                          stream={user.stream || null}
                          onSelect={handleContentSubjectSelect}
                          onBack={() => setContentViewStep('TYPES')}
                      />
                  </div>
              );
          }
          return renderContentSection(selectedContentType);
      }

      // 4. LEGACY TABS (Mapped to new structure or kept as sub-views)
      if (activeTab === 'CUSTOM_PAGE') return <CustomBloggerPage onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'DEEP_ANALYSIS') return <AiDeepAnalysis user={user} settings={settings} onUpdateUser={handleUserUpdate} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'AI_HISTORY') return <AiHistoryPage user={user} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'UPDATES') return <UniversalInfoPage onBack={() => onTabChange('HOME')} />;
      if ((activeTab as string) === 'ANALYTICS') return <AnalyticsPage user={user} onBack={() => onTabChange('HOME')} settings={settings} onNavigateToChapter={onNavigateToChapter} />;
      if ((activeTab as string) === 'SUB_HISTORY') return <SubscriptionHistory user={user} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'HISTORY') return <HistoryPage user={user} onUpdateUser={handleUserUpdate} settings={settings} />;
      if (activeTab === 'LEADERBOARD') return <Leaderboard user={user} settings={settings} />;
      if (activeTab === 'GAME') return isGameEnabled ? (user.isGameBanned ? <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100"><Ban size={48} className="mx-auto text-red-500 mb-4" /><h3 className="text-lg font-bold text-red-700">Access Denied</h3><p className="text-sm text-red-600">Admin has disabled the game for your account.</p></div> : <SpinWheel user={user} onUpdateUser={handleUserUpdate} settings={settings} />) : null;
      if (activeTab === 'REDEEM') return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><RedeemSection user={user} onSuccess={onRedeemSuccess} /></div>;
      if (activeTab === 'PRIZES') return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><PrizeList /></div>;
      // if (activeTab === 'REWARDS') return (...); // REMOVED TO PREVENT CRASH
      if (activeTab === 'STORE') return <Store user={user} settings={settings} onUserUpdate={handleUserUpdate} />;
      if (activeTab === 'PROFILE') return (
                <div className="animate-in fade-in zoom-in duration-300 pb-24">
                    <div className={`rounded-3xl p-8 text-center text-white mb-6 shadow-xl relative overflow-hidden transition-all duration-500 ${
                        user.subscriptionLevel === 'ULTRA' && user.isPremium
                        ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 shadow-purple-500/50 ring-2 ring-purple-400/50'
                        : user.subscriptionLevel === 'BASIC' && user.isPremium
                        ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 shadow-blue-500/50'
                        : 'bg-gradient-to-br from-slate-700 to-slate-900'
                    }`}>
                        {/* ANIMATED BACKGROUND FOR ULTRA */}
                        {user.subscriptionLevel === 'ULTRA' && user.isPremium && (
                            <>
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-spin-slow"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
                            </>
                        )}

                        {/* ANIMATED BACKGROUND FOR BASIC */}
                        {user.subscriptionLevel === 'BASIC' && user.isPremium && (
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-30 animate-pulse"></div>
                        )}

                        {/* SPECIAL BANNER ANIMATION (7/30/365) */}
                        {(user.subscriptionTier === 'WEEKLY' || user.subscriptionTier === 'MONTHLY' || user.subscriptionTier === 'YEARLY' || user.subscriptionTier === 'LIFETIME') && user.isPremium && (
                            <div className="absolute top-2 right-2 animate-bounce">
                                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/30">
                                    {user.subscriptionTier === 'WEEKLY' ? '7 DAYS' : user.subscriptionTier === 'MONTHLY' ? '30 DAYS' : user.subscriptionTier === 'LIFETIME' ? '∞' : '365 DAYS'}
                                </span>
                            </div>
                        )}

                        <div className={`w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-black shadow-2xl relative z-10 ${
                            user.subscriptionLevel === 'ULTRA' && user.isPremium ? 'text-purple-700 ring-4 ring-purple-300 animate-bounce-slow' :
                            user.subscriptionLevel === 'BASIC' && user.isPremium ? 'text-blue-600 ring-4 ring-cyan-300' :
                            'text-slate-800'
                        }`}>
                            {user.name.charAt(0)}
                            {user.subscriptionLevel === 'ULTRA' && user.isPremium && <div className="absolute -top-2 -right-2 text-2xl">👑</div>}
                        </div>

                        <div className="flex items-center justify-center gap-2 relative z-10">
                            <h2 className="text-3xl font-black">{user.name}</h2>
                            <button
                                onClick={() => { setNewNameInput(user.name); setShowNameChangeModal(true); }}
                                className="bg-white/20 p-1.5 rounded-full hover:bg-white/40 transition-colors"
                            >
                                <Edit size={14} />
                            </button>
                        </div>
                        <p className="text-white/80 text-sm font-mono relative z-10">ID: {user.displayId || user.id}</p>
                        {user.createdAt && (
                            <p className="text-white/60 text-[10px] mt-1 font-medium relative z-10">
                                Joined: {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        )}

                        <div className="mt-4 relative z-10">
                            <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg ${
                                user.subscriptionLevel === 'ULTRA' && user.isPremium ? 'bg-purple-500 text-white border border-purple-300' :
                                user.subscriptionLevel === 'BASIC' && user.isPremium ? 'bg-cyan-500 text-white' : 'bg-slate-600 text-slate-300'
                            }`}>
                                {user.isPremium ? `✨ ${user.subscriptionLevel} MEMBER ✨` : 'Free User'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Class</p>
                            <p className="text-lg font-black text-slate-800">{user.classLevel} • {user.board} • {user.stream}</p>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Subscription</p>
                            <p className="text-lg font-black text-slate-800">
                                {user.subscriptionTier === 'CUSTOM' ? (user.customSubscriptionName || 'Basic Ultra') : (user.subscriptionTier || 'FREE')}
                            </p>
                            {user.subscriptionEndDate && user.subscriptionTier !== 'LIFETIME' && (
                                <div className="mt-1">
                                    <p className="text-xs text-slate-500 font-medium">Expires on:</p>
                                    <p className="text-xs font-bold text-slate-700">
                                        {new Date(user.subscriptionEndDate).toLocaleString('en-IN', {
                                            year: 'numeric', month: 'long', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                                        })}
                                    </p>
                                    <p className="text-[10px] text-red-500 mt-1 font-mono">
                                        (Time left: {
                                            (() => {
                                                const diff = new Date(user.subscriptionEndDate).getTime() - Date.now();
                                                if (diff <= 0) return 'Expired';
                                                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                                                const m = Math.floor((diff / 1000 / 60) % 60);
                                                return `${d}d ${h}h ${m}m`;
                                            })()
                                        })
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <p className="text-xs font-bold text-blue-600 uppercase">Credits</p>
                                <p className="text-2xl font-black text-blue-600">{user.credits}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                                <p className="text-xs font-bold text-orange-600 uppercase">Streak</p>
                                <p className="text-2xl font-black text-orange-600">{user.streak} Days</p>
                            </div>
                        </div>

                        <button onClick={() => setShowMonthlyReport(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow flex items-center justify-center gap-2"><BarChart3 size={18} /> View Monthly Report</button>
                        <button onClick={() => onTabChange('SUB_HISTORY')} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow flex items-center justify-center gap-2"><History size={18} /> View Subscription History</button>

                        <div className="flex items-center justify-between p-4 bg-slate-100 rounded-xl">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-white text-slate-600'}`}>
                                    {isDarkMode ? <Sparkles size={16} /> : <Zap size={16} />}
                                </div>
                                <span className="font-bold text-slate-700 text-sm">Dark Mode</span>
                            </div>
                            <button
                                onClick={() => onToggleDarkMode && onToggleDarkMode(!isDarkMode)}
                                className={`w-12 h-7 rounded-full transition-all relative ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${isDarkMode ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>

                        <button onClick={() => setEditMode(true)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900">✏️ Edit Profile</button>
                        <button onClick={() => {localStorage.removeItem(`nst_user_${user.id}`); window.location.reload();}} className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600">🚪 Logout</button>
                    </div>
                </div>
      );

      // Handle Drill-Down Views (Video, PDF, MCQ, AUDIO)
      if (activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ' || activeTab === 'AUDIO') {
          return renderContentSection(activeTab);
      }

      return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
        {/* ADMIN SWITCH BUTTON */}
        {(user.role === 'ADMIN' || isImpersonating) && (
             <div className="fixed bottom-36 right-4 z-50 flex flex-col gap-3 items-end">
                 <button
                    onClick={() => setIsLayoutEditing(!isLayoutEditing)}
                    className={`p-4 rounded-full shadow-2xl border-2 hover:scale-110 transition-transform flex items-center gap-2 ${isLayoutEditing ? 'bg-yellow-400 text-black border-yellow-500' : 'bg-white text-slate-800 border-slate-200'}`}
                 >
                     <Edit size={20} />
                     {isLayoutEditing && <span className="font-bold text-xs">Editing Layout</span>}
                 </button>
                 <button
                    onClick={handleSwitchToAdmin}
                    className="bg-slate-900 text-white p-4 rounded-full shadow-2xl border-2 border-slate-700 hover:scale-110 transition-transform flex items-center gap-2 animate-bounce-slow"
                 >
                     <Layout size={20} className="text-yellow-400" />
                     <span className="font-bold text-xs">Admin Panel</span>
                 </button>
             </div>
        )}

        {/* NOTIFICATION BAR (Only on Home) (COMPACT VERSION) */}
        {activeTab === 'HOME' && settings?.noticeText && (
            <div className="bg-slate-900 text-white p-3 mb-4 rounded-xl shadow-md border border-slate-700 animate-in slide-in-from-top-4 relative mx-2 mt-2">
                <div className="flex items-center gap-3">
                    <Megaphone size={16} className="text-yellow-400 shrink-0" />
                    <div className="overflow-hidden flex-1">
                        <p className="text-xs font-medium truncate">{settings.noticeText}</p>
                    </div>
                    <SpeakButton text={settings.noticeText} className="text-white hover:bg-white/10" iconSize={14} />
                </div>
            </div>
        )}


        {/* REQUEST CONTENT MODAL */}
        {showRequestModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    <div className="flex items-center gap-2 mb-4 text-pink-600">
                        <Megaphone size={24} />
                        <h3 className="text-lg font-black text-slate-800">Request Content</h3>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                            <input
                                type="text"
                                value={requestData.subject}
                                onChange={e => setRequestData({...requestData, subject: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                                placeholder="e.g. Mathematics"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Topic / Chapter</label>
                            <input
                                type="text"
                                value={requestData.topic}
                                onChange={e => setRequestData({...requestData, topic: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                                placeholder="e.g. Trigonometry"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                            <select
                                value={requestData.type}
                                onChange={e => setRequestData({...requestData, type: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                            >
                                <option value="PDF">PDF Notes</option>
                                <option value="VIDEO">Video Lecture</option>
                                <option value="MCQ">MCQ Test</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setShowRequestModal(false)} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">Cancel</button>
                        <button
                            onClick={() => {
                                if (!requestData.subject || !requestData.topic) {
                                    showAlert("Please fill all fields", 'ERROR');
                                    return;
                                }
                                const request = {
                                    id: `req-${Date.now()}`,
                                    userId: user.id,
                                    userName: user.name,
                                    details: `${user.classLevel || '10'} ${user.board || 'CBSE'} - ${requestData.subject} - ${requestData.topic} - ${requestData.type}`,
                                    timestamp: new Date().toISOString()
                                };
                                const existing = JSON.parse(localStorage.getItem('nst_demand_requests') || '[]');
                                existing.push(request);
                                localStorage.setItem('nst_demand_requests', JSON.stringify(existing));

                                setShowRequestModal(false);
                                showAlert("✅ Request Sent! Admin will check it.", 'SUCCESS');
                            }}
                            className="flex-1 py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-700 shadow-lg"
                        >
                            Send Request
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* NAME CHANGE MODAL */}
        {showNameChangeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">Change Display Name</h3>
                    <input
                        type="text"
                        value={newNameInput}
                        onChange={e => setNewNameInput(e.target.value)}
                        className="w-full p-3 border rounded-xl mb-2"
                        placeholder="Enter new name"
                    />
                    <p className="text-xs text-slate-500 mb-4">Cost: <span className="font-bold text-orange-600">{settings?.nameChangeCost || 10} Coins</span></p>
                    <div className="flex gap-2">
                        <button onClick={() => setShowNameChangeModal(false)} className="flex-1 py-2 text-slate-500 font-bold bg-slate-100 rounded-lg">Cancel</button>
                        <button
                            onClick={() => {
                                const cost = settings?.nameChangeCost || 10;
                                if (newNameInput && newNameInput !== user.name) {
                                    if (user.credits < cost) { showAlert(`Insufficient Coins! Need ${cost}.`, 'ERROR'); return; }
                                    const u = { ...user, name: newNameInput, credits: user.credits - cost };
                                    handleUserUpdate(u);
                                    setShowNameChangeModal(false);
                                    showAlert("Name Updated Successfully!", 'SUCCESS');
                                }
                            }}
                            className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                        >
                            Pay & Update
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div className="p-4">
            {renderMainContent()}

            {settings?.showFooter !== false && (
                <div className="mt-8 mb-4 text-center">
                    <p
                        className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: settings?.footerColor || '#cbd5e1' }}
                    >
                        Developed by Nadim Anwar
                    </p>
                </div>
            )}
        </div>

        {/* MINI PLAYER */}
        <MiniPlayer track={currentAudioTrack} onClose={() => setCurrentAudioTrack(null)} />

        {/* FIXED BOTTOM NAVIGATION */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                <button onClick={() => { onTabChange('HOME'); setContentViewStep('SUBJECTS'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'HOME' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Home size={24} fill={activeTab === 'HOME' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Home</span>
                </button>

                <button onClick={() => {
                        // Open Universal Video Playlist directly
                        setSelectedSubject({ id: 'universal', name: 'Special' } as any);
                        setSelectedChapter({ id: 'UNIVERSAL', title: 'Featured Lectures' } as any);
                        setContentViewStep('PLAYER');
                        setFullScreen(true);
                        onTabChange('VIDEO');

                        // Clear Notification
                        localStorage.setItem('nst_last_read_update', Date.now().toString());
                        setHasNewUpdate(false);
                    }}
                    className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'VIDEO' && selectedChapter?.id === 'UNIVERSAL' ? 'text-blue-600' : 'text-slate-400'}`}
                >
                    <div className="relative">
                         {/* Changed Icon to PlayCircle as requested */}
                         <Play size={24} fill={activeTab === 'VIDEO' && selectedChapter?.id === 'UNIVERSAL' ? "currentColor" : "none"} />
                         {hasNewUpdate && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border border-white animate-pulse"></span>}
                    </div>
                    <span className="text-[10px] font-bold mt-1">Videos</span>
                </button>

                <button onClick={() => { onTabChange('COURSES'); setContentViewStep('TYPES'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'COURSES' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Book size={24} fill={activeTab === 'COURSES' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Courses</span>
                </button>

                <button onClick={() => { onTabChange('AI_CHAT'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'AI_CHAT' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Compass size={24} fill={activeTab === 'AI_CHAT' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Explorer</span>
                </button>

                <button onClick={() => { onTabChange('STORE'); setContentViewStep('SUBJECTS'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'STORE' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <ShoppingBag size={24} fill={activeTab === 'STORE' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Store</span>
                </button>

                <button onClick={() => onTabChange('SUB_HISTORY')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'SUB_HISTORY' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <CreditCard size={24} fill={activeTab === 'SUB_HISTORY' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Sub</span>
                </button>

                <button onClick={() => onTabChange('PROFILE')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'PROFILE' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <UserIcon size={24} fill={activeTab === 'PROFILE' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Profile</span>
                </button>
            </div>
        </div>

        {/* SYLLABUS SELECTION POPUP */}
        {showSyllabusPopup && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
                <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-in-center">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                            <BookOpen size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800">Choose Syllabus Mode</h3>
                        <p className="text-sm text-slate-500 mt-1">Select how you want to study this chapter.</p>
                    </div>

                    <div className="space-y-3 mb-6">
                        <button
                            onClick={() => confirmSyllabusSelection('SCHOOL')}
                            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            🏫 School Mode
                        </button>
                        <button
                            onClick={() => confirmSyllabusSelection('COMPETITION')}
                            className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-purple-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            🏆 Competition Mode
                        </button>
                    </div>

                    <button
                        onClick={() => setShowSyllabusPopup(null)}
                        className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}

        {/* MODALS */}
        {showUserGuide && <UserGuide onClose={() => setShowUserGuide(false)} />}

        {editMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    {/* ... (Edit Profile Content - duplicated code removed for brevity, should use component) ... */}
                    {/* Re-implementing simplified edit mode here as it was inside a helper function before */}
                    <h3 className="font-bold text-lg mb-4">Edit Profile & Settings</h3>
                    <div className="space-y-3 mb-6">
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Daily Study Goal (Hours)</label><input type="number" value={profileData.dailyGoalHours} onChange={e => setProfileData({...profileData, dailyGoalHours: Number(e.target.value)})} className="w-full p-2 border rounded-lg" min={1} max={12}/></div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">New Password</label><input type="text" placeholder="Set new password (optional)" value={profileData.newPassword} onChange={e => setProfileData({...profileData, newPassword: e.target.value})} className="w-full p-2 border rounded-lg bg-yellow-50 border-yellow-200"/><p className="text-[9px] text-slate-400 mt-1">Leave blank to keep current password.</p></div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Board</label><select value={profileData.board} onChange={e => setProfileData({...profileData, board: e.target.value as any})} className="w-full p-2 border rounded-lg"><option value="CBSE">CBSE</option><option value="BSEB">BSEB</option></select></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Class</label><select value={profileData.classLevel} onChange={e => setProfileData({...profileData, classLevel: e.target.value as any})} className="w-full p-2 border rounded-lg">{['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        {['11','12'].includes(profileData.classLevel) && (<div><label className="text-xs font-bold text-slate-500 uppercase">Stream</label><select value={profileData.stream} onChange={e => setProfileData({...profileData, stream: e.target.value as any})} className="w-full p-2 border rounded-lg"><option value="Science">Science</option><option value="Commerce">Commerce</option><option value="Arts">Arts</option></select></div>)}

                        {/* NAME CHANGE */}
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Display Name ({settings?.nameChangeCost || 10} Coins)</label>
                            <input
                                type="text"
                                value={user.name}
                                onChange={(e) => {
                                    // Normally name is in user object, here we modify a local state if we want preview,
                                    // but saveProfile uses profileData. Let's add name to profileData.
                                    // BUT user prop is read-only here. We need to handle this in saveProfile properly.
                                    // For now, we will just prompt for Name Change separately or add it here.
                                    // Adding separate logic for Name Change.
                                    // Actually, let's keep it simple: separate button in profile view is better.
                                }}
                                disabled
                                className="w-full p-2 border rounded-lg bg-slate-100 text-slate-500"
                                placeholder="Change from Profile Page"
                            />
                            <p className="text-[9px] text-slate-400 mt-1">Use 'Edit Name' on Profile page to change.</p>
                        </div>
                    </div>
                    <div className="flex gap-2"><button onClick={() => setEditMode(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button><button onClick={saveProfile} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Save Changes</button></div>
                </div>
            </div>
        )}

        {showInbox && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Mail size={18} className="text-blue-600" /> Admin Messages</h3>
                        <button onClick={() => setShowInbox(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                        {(!user.inbox || user.inbox.length === 0) && <p className="text-slate-400 text-sm text-center py-8">No messages.</p>}
                        {user.inbox?.map(msg => (
                            <div key={msg.id} className={`p-3 rounded-xl border text-sm ${msg.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'} transition-all`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-slate-500">{msg.type === 'GIFT' ? '🎁 GIFT' : 'MESSAGE'}</p>
                                        {!msg.read && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                                    </div>
                                    <p className="text-slate-400 text-[10px]">{new Date(msg.date).toLocaleDateString()}</p>
                                </div>
                                <p className="text-slate-700 leading-relaxed mb-2">{msg.text}</p>

                                {(msg.type === 'REWARD' || msg.type === 'GIFT') && !msg.isClaimed && (
                                    <button
                                        onClick={() => claimRewardMessage(msg.id, msg.reward, msg.gift)}
                                        className="w-full mt-2 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-lg shadow-md hover:scale-[1.02] transition-transform text-xs flex items-center justify-center gap-2"
                                    >
                                        <Gift size={14} /> Claim {msg.type === 'GIFT' ? 'Gift' : 'Reward'}
                                    </button>
                                )}
                                {(msg.isClaimed) && <p className="text-[10px] text-green-600 font-bold bg-green-50 inline-block px-2 py-1 rounded">✅ Claimed</p>}
                            </div>
                        ))}
                    </div>
                    {unreadCount > 0 && <button onClick={markInboxRead} className="w-full py-3 bg-blue-600 text-white font-bold text-sm hover:opacity-90">Mark All as Read</button>}
                </div>
            </div>
        )}

        {/* SUPPORT MODAL (Replacing ChatHub) */}
        {showSupportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Headphones size={32} className="text-blue-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Need Help?</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Contact Admin directly for support, subscription issues, or questions.
                    </p>

                    <button
                        onClick={handleSupportEmail}
                        className="w-full bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2 mb-3"
                    >
                        <Mail size={20} /> Email Support
                    </button>

                    <button
                        onClick={() => setShowSupportModal(false)}
                        className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
                    >
                        Close
                    </button>
                </div>
            </div>
        )}

        {isLoadingContent && <LoadingOverlay dataReady={isDataReady} onComplete={onLoadingComplete} />}
        {activeExternalApp && <div className="fixed inset-0 z-50 bg-white flex flex-col"><div className="flex items-center justify-between p-4 border-b bg-slate-50"><button onClick={() => setActiveExternalApp(null)} className="p-2 bg-white rounded-full border shadow-sm"><X size={20} /></button><p className="font-bold text-slate-700">External App</p><div className="w-10"></div></div><iframe src={activeExternalApp} className="flex-1 w-full border-none" title="External App" allow="camera; microphone; geolocation; payment" /></div>}
        {pendingApp && <CreditConfirmationModal title={`Access ${pendingApp.app.name}`} cost={pendingApp.cost} userCredits={user.credits} isAutoEnabledInitial={!!user.isAutoDeductEnabled} onCancel={() => setPendingApp(null)} onConfirm={(auto) => processAppAccess(pendingApp.app, pendingApp.cost, auto)} />}

        {/* GLOBAL ALERT MODAL */}
        <CustomAlert
            isOpen={alertConfig.isOpen}
            type={alertConfig.type}
            title={alertConfig.title}
            message={alertConfig.message}
            onClose={() => setAlertConfig(prev => ({...prev, isOpen: false}))}
        />

        {showChat && <UniversalChat user={user} onClose={() => setShowChat(false)} />}

        {/* AI INTERSTITIAL */}
        {/* ... (existing ai interstitial code if any) ... */}

        {/* EXPIRY POPUP */}
        <ExpiryPopup
            isOpen={showExpiryPopup}
            onClose={() => setShowExpiryPopup(false)}
            expiryDate={user.subscriptionEndDate || new Date().toISOString()}
            onRenew={() => {
                setShowExpiryPopup(false);
                onTabChange('STORE');
            }}
        />

        {showMonthlyReport && <MonthlyMarksheet user={user} settings={settings} onClose={() => setShowMonthlyReport(false)} />}
        {showReferralPopup && <ReferralPopup user={user} onClose={() => setShowReferralPopup(false)} onUpdateUser={handleUserUpdate} />}

        <StudentAiAssistant
            user={user}
            settings={settings}
            isOpen={activeTab === 'AI_CHAT'}
            onClose={() => onTabChange('HOME')}
        />
    </div>
  );
};