
import { LessonContent, MCQItem, User, SystemSettings } from '../types';

export interface RecommendedItem {
    id: string;
    title: string;
    type: 'NOTE' | 'VIDEO' | 'PDF'; // Updated to include NOTE
    content?: string; // Inline HTML content for notes
    url?: string;
    price: number;
    access: 'FREE' | 'BASIC' | 'ULTRA';
    matchReason?: string;
    isLocked?: boolean;
}

/**
 * Analyzes MCQ performance to categorize topics into Weak, Average, and Strong.
 * @param questions List of MCQItems with 'topic' field
 * @param answers User's answers map (index -> selected option index)
 */
export const analyzeTopics = (questions: MCQItem[], answers: Record<number, number>) => {
    const topicStats: Record<string, { correct: number, total: number }> = {};

    questions.forEach((q, idx) => {
        const topic = q.topic ? q.topic.trim() : 'General';
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };

        topicStats[topic].total++;
        if (answers[idx] === q.correctAnswer) {
            topicStats[topic].correct++;
        }
    });

    const weak: string[] = [];
    const average: string[] = [];
    const strong: string[] = [];

    Object.keys(topicStats).forEach(topic => {
        const { correct, total } = topicStats[topic];
        const percentage = (correct / total) * 100;

        if (percentage < 50) weak.push(topic);
        else if (percentage < 80) average.push(topic);
        else strong.push(topic);
    });

    return { weak, average, strong, stats: topicStats };
};

/**
 * Generates recommended content based on Weak Topics.
 */
export const getRecommendedContent = (
    weakTopics: string[],
    lessonContent: LessonContent,
    user: User,
    settings?: SystemSettings
): RecommendedItem[] => {
    const isPremium = user.isPremium;
    const recommendations: RecommendedItem[] = [];
    const notes = lessonContent.topicNotes || [];

    // 1. Match Topic Notes
    weakTopics.forEach(topic => {
        const normTopic = topic.toLowerCase();

        // Find notes matching the weak topic
        const matchedNotes = notes.filter(n =>
            n.topic.toLowerCase().includes(normTopic) ||
            normTopic.includes(n.topic.toLowerCase())
        );

        matchedNotes.forEach(n => {
            // Filter by User Tier
            // Free User -> Sees FREE notes
            // Premium User -> Sees PREMIUM notes (and can see FREE too, but prioritize PREMIUM)

            const isTarget = isPremium ? n.type === 'PREMIUM' : n.type === 'FREE';

            if (isTarget) {
                 recommendations.push({
                    id: n.id,
                    title: `Review: ${n.topic}`,
                    type: 'NOTE',
                    content: n.content,
                    price: 0, // Unlocking is global for the recommendation set
                    access: n.type === 'PREMIUM' ? 'BASIC' : 'FREE',
                    matchReason: `Weak Topic: ${topic}`,
                    isLocked: false // Access controlled by the parent view
                });
            }
        });
    });

    // 2. Fallback: If no specific topic notes found, suggest main chapter notes
    if (recommendations.length === 0) {
        if (isPremium && lessonContent.schoolPremiumNotesHtml) {
             recommendations.push({
                id: 'main-premium-note',
                title: 'Full Chapter Notes (Premium)',
                type: 'NOTE',
                content: lessonContent.schoolPremiumNotesHtml,
                price: 0,
                access: 'BASIC',
                matchReason: 'General Revision'
            });
        } else if (lessonContent.schoolFreeNotesHtml) {
            recommendations.push({
                id: 'main-free-note',
                title: 'Chapter Notes (Summary)',
                type: 'NOTE',
                content: lessonContent.schoolFreeNotesHtml,
                price: 0,
                access: 'FREE',
                matchReason: 'General Revision'
            });
        }
    }

    return recommendations;
};
