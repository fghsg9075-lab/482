import { UniversalAnalysisLog } from '../types';
import { executeCanonicalRaw } from '@/services/ai/router';

export const generateMorningInsight = async (
  logs: UniversalAnalysisLog[],
  settings: any,
  onSave: (banner: any) => void
): Promise<string> => {

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentLogs = logs.filter(l => new Date(l.date) > yesterday);

  if (recentLogs.length === 0) return "No recent data for analysis.";

  const samples = recentLogs.slice(0, 50).map(l => ({
    subject: l.subject,
    chapter: l.chapter,
    score: `${l.score}/${l.totalQuestions}`,
    mistakes: l.aiResponse ? "Yes" : "No"
  }));

  const prompt = `
You are an AI Mentor for students.
Analyze logs and generate Morning Insight Banner.

LOGS:
${JSON.stringify(samples)}

OUTPUT JSON ONLY:
{
  "title": "",
  "wisdom": "",
  "commonTrap": "",
  "proTip": "",
  "motivation": ""
}
`;

  try {
    const result = await executeCanonicalRaw({
      engine: "MORNING_INSIGHT_ENGINE",
      messages: [{ role: "user", content: prompt }],
    });

    const bannerData = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);

    bannerData.date = new Date().toDateString();
    bannerData.id = `insight-${Date.now()}`;

    onSave(bannerData);
    return "Morning Insight Generated Successfully!";
  } catch (e) {
    console.error("Morning Insight Generation Error", e);
    throw new Error("Failed to generate insight.");
  }
};
