
import { LessonContent, User } from '../types';

export interface RecommendedItem {
    id: string;
    title: string;
    type: 'VIDEO' | 'PDF' | 'AUDIO';
    url: string;
    price: number;
    access: 'FREE' | 'BASIC' | 'ULTRA';
    matchReason?: string; // e.g. "Weak Topic: Newton's Law"
}

export const getRecommendedContent = (
    weakTopics: string[],
    content: LessonContent,
    user: User,
    syllabusMode: 'SCHOOL' | 'COMPETITION' = 'SCHOOL'
): RecommendedItem[] => {

    // 1. Identify User Access Level
    const isPremium = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
    const isFreeUser = !isPremium && user.role !== 'ADMIN';

    let recommendations: RecommendedItem[] = [];

    // Helper to normalize string for fuzzy match
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 2. Gather All Content Candidates based on Mode
    let candidates: RecommendedItem[] = [];

    // Videos
    const videos = syllabusMode === 'SCHOOL'
        ? (content.schoolVideoPlaylist || content.videoPlaylist || [])
        : (content.competitionVideoPlaylist || []);

    videos.forEach(v => {
        candidates.push({
            id: `vid-${v.url}`,
            title: v.title,
            type: 'VIDEO',
            url: v.url,
            price: v.price || 0,
            access: v.access || 'FREE'
        });
    });

    // Audio
    const audios = syllabusMode === 'SCHOOL'
        ? (content.schoolAudioPlaylist || content.audioPlaylist || [])
        : (content.competitionAudioPlaylist || []);

    audios.forEach(a => {
        candidates.push({
            id: `aud-${a.url}`,
            title: a.title,
            type: 'AUDIO',
            url: a.url,
            price: a.price || 0,
            access: a.access || 'FREE'
        });
    });

    // Notes (PDFs & Premium Slots)
    // Note: HTML content is single block, so we can't easily recommend "part" of it unless we parse it.
    // For now, we recommend PDF links or specific slots.

    // Main PDF
    const pdfLink = syllabusMode === 'SCHOOL' ? content.schoolPdfLink : content.competitionPdfLink;
    if (pdfLink) {
        candidates.push({
            id: 'main-pdf',
            title: 'Chapter Notes (PDF)',
            type: 'PDF',
            url: pdfLink,
            price: (syllabusMode === 'SCHOOL' ? content.schoolPdfPrice : content.competitionPdfPrice) || 0,
            access: 'BASIC'
        });
    }

    // Premium Slots
    const slots = syllabusMode === 'SCHOOL'
        ? (content.schoolPdfPremiumSlots || content.premiumNoteSlots || [])
        : (content.competitionPdfPremiumSlots || []);

    slots.forEach(s => {
        candidates.push({
            id: s.id,
            title: s.title,
            type: 'PDF',
            url: s.url,
            price: 5, // Default slot price
            access: s.access || 'BASIC'
        });
    });

    // 3. Match Weak Topics
    let matchedVideos: RecommendedItem[] = [];
    let matchedNotes: RecommendedItem[] = [];
    let matchedAudios: RecommendedItem[] = [];

    // If no weak topics, maybe return generic top items?
    // User implies recommendations happen AFTER analysis finding weak topics.
    // If weakTopics is empty, return empty? Or return "General Revision"?
    // Let's strictly match first.

    weakTopics.forEach(topic => {
        const normTopic = normalize(topic);
        if (normTopic.length < 3) return; // Skip too short

        candidates.forEach(item => {
            // Check if Item Title contains Topic
            if (normalize(item.title).includes(normTopic)) {
                // Avoid duplicates
                const isAlreadyAdded = [...matchedVideos, ...matchedNotes, ...matchedAudios].some(x => x.id === item.id);
                if (!isAlreadyAdded) {
                    // Add Match Reason
                    item.matchReason = topic;

                    if (item.type === 'VIDEO') matchedVideos.push(item);
                    else if (item.type === 'PDF') matchedNotes.push(item);
                    else if (item.type === 'AUDIO') matchedAudios.push(item);
                }
            }
        });
    });

    // 4. Apply Limits & User Restrictions

    // Filter for Free Users (Notes Only)
    // User said: "free user ko bas notes hi dikhega na video na audio"
    if (isFreeUser) {
        matchedVideos = []; // Remove videos
        matchedAudios = []; // Remove audios
        // Notes are kept
    }

    // Limits: 2 Video, 2 Notes, 1 Audio
    const finalVideos = matchedVideos.slice(0, 2);
    const finalNotes = matchedNotes.slice(0, 2);
    const finalAudios = matchedAudios.slice(0, 1);

    recommendations = [...finalVideos, ...finalNotes, ...finalAudios];

    // Fallback: If no matches found but we have weak topics, maybe suggest the MAIN PDF or MAIN VIDEO if available?
    if (recommendations.length === 0 && weakTopics.length > 0) {
        // Suggest Main PDF if exists
        const mainPdf = candidates.find(c => c.id === 'main-pdf');
        if (mainPdf) recommendations.push({ ...mainPdf, matchReason: 'General Revision' });

        // Suggest 1 Video if allowed
        if (!isFreeUser) {
            const firstVideo = candidates.find(c => c.type === 'VIDEO');
            if (firstVideo) recommendations.push({ ...firstVideo, matchReason: 'General Revision' });
        }
    }

    return recommendations;
};
