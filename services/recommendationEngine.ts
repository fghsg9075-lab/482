
import { Chapter, User } from '../types';

export interface RecommendedItem {
    id: string;
    title: string;
    type: 'VIDEO' | 'PDF' | 'AUDIO';
    url: string;
    price: number;
    access: 'FREE' | 'BASIC' | 'ULTRA';
    matchReason?: string; // e.g. "Weak Topic: Newton's Law"
    isLocked?: boolean;
}

export const getRecommendedContent = (
    weakTopics: string[],
    content: any, // Using 'any' to avoid strict type issues with large objects, but ideally use Chapter/LessonContent type
    user: User,
    syllabusMode: 'SCHOOL' | 'COMPETITION' = 'SCHOOL'
): RecommendedItem[] => {

    // 1. Identify User Access Level
    const isPremium = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();

    let candidates: RecommendedItem[] = [];

    // Helper to normalize string for fuzzy match
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 2. Gather Notes Candidates ONLY (No Video/Audio)

    // A. Main PDF (Usually Free or Basic)
    const pdfLink = syllabusMode === 'SCHOOL' ? content.schoolPdfLink : content.competitionPdfLink;
    const pdfPrice = (syllabusMode === 'SCHOOL' ? content.schoolPdfPrice : content.competitionPdfPrice) || 0;

    if (pdfLink) {
        candidates.push({
            id: 'main-pdf',
            title: 'Chapter Notes (Main)',
            type: 'PDF',
            url: pdfLink,
            price: pdfPrice,
            access: pdfPrice > 0 ? 'BASIC' : 'FREE',
            isLocked: !isPremium && pdfPrice > 0
        });
    }

    // B. Premium Note Slots (Strictly Premium)
    const slots = syllabusMode === 'SCHOOL'
        ? (content.schoolPdfPremiumSlots || content.premiumNoteSlots || [])
        : (content.competitionPdfPremiumSlots || []);

    slots.forEach((s: any) => {
        candidates.push({
            id: s.id,
            title: s.title,
            type: 'PDF',
            url: s.url,
            price: 5, // Default slot price
            access: s.access || 'BASIC',
            isLocked: !isPremium // Slots are generally premium
        });
    });

    // 3. Match Weak Topics (Fuzzy Search)
    let matchedItems: RecommendedItem[] = [];

    // If no weak topics, return generic suggestions (Top Free + Top Premium)
    if (!weakTopics || weakTopics.length === 0) {
         // Return top 2 free and top 2 premium items
         const free = candidates.filter(c => !c.isLocked).slice(0, 3);
         const premium = candidates.filter(c => c.isLocked).slice(0, 3);
         return [...free, ...premium];
    }

    weakTopics.forEach(topic => {
        const normTopic = normalize(topic);
        if (normTopic.length < 3) return; // Skip too short

        candidates.forEach(item => {
            // Check if Item Title contains Topic
            if (normalize(item.title).includes(normTopic)) {
                // Avoid duplicates
                const isAlreadyAdded = matchedItems.some(x => x.id === item.id);
                if (!isAlreadyAdded) {
                    item.matchReason = topic;
                    matchedItems.push(item);
                }
            }
        });
    });

    // If exact matches are few, add general chapter resources as fallback
    if (matchedItems.length < 3) {
        const generals = candidates.filter(c => !matchedItems.some(m => m.id === c.id)).slice(0, 3 - matchedItems.length);
        generals.forEach(g => {
            if(!g.matchReason) g.matchReason = "General Chapter Revision";
            matchedItems.push(g);
        });
    }

    // Sort: Free first, then Premium
    return matchedItems.sort((a, b) => (a.isLocked === b.isLocked) ? 0 : a.isLocked ? 1 : -1);
};
