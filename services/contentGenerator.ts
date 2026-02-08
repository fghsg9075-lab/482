import { ClassLevel, Subject, Chapter, LessonContent, Language, Board, Stream, ContentType, MCQItem, SystemSettings } from "../types";
import { STATIC_SYLLABUS } from "../constants";
import { getChapterData, saveChapterData, getCustomSyllabus } from "../firebase";
import { storage } from "../utils/storage";
import { executeCanonical } from "./ai/router";
import { CanonicalModel } from "./ai/types";
import { searchWeb } from "./search";

const chapterCache: Record<string, Chapter[]> = {};

const cleanJson = (text: string) => {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T | null = null): Promise<T | null> => {
    return Promise.race([
        promise,
        new Promise<T | null>((resolve) => setTimeout(() => {
            console.warn(`Operation timed out after ${ms}ms`);
            resolve(fallback);
        }, ms))
    ]);
};

// --- TRANSLATION HELPER ---
export const translateToHindi = async (content: string, isJson: boolean = false, userId?: string): Promise<string> => {
    const prompt = `
    Translate to Hindi (Bihar Board Style Hinglish).
    ${isJson ? 'Keep JSON structure. Translate values only.' : 'Keep Markdown.'}
    Content: ${content.substring(0, 3000)}...`; // Truncate for translation speed

    try {
        const text = await executeCanonical({
            canonicalModel: 'TRANSLATION_ENGINE',
            prompt: prompt,
            userId,
            jsonMode: isJson
        });
        return isJson ? cleanJson(text) : text;
    } catch (e) {
        return content;
    }
};

// --- CONTENT LOOKUP ---
const getAdminContent = async (
    board: Board,
    classLevel: ClassLevel,
    stream: Stream | null,
    subject: Subject,
    chapterId: string,
    type: ContentType,
    syllabusMode: 'SCHOOL' | 'COMPETITION' = 'SCHOOL'
): Promise<LessonContent | null> => {
    const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
    // Legacy Key
    const key = `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapterId}`;

    try {
        let parsed = await getChapterData(key);
        if (!parsed) parsed = await storage.getItem(key);

        if (parsed) {
            if (type === 'PDF_FREE' || type === 'NOTES_SIMPLE') {
                const link = parsed.freeLink;
                const html = parsed.freeNotesHtml;
                if (link && type === 'PDF_FREE') return { id: Date.now().toString(), title: "Free Material", subtitle: "Admin Provided", content: link, type: 'PDF_FREE', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
                if (html) return { id: Date.now().toString(), title: "Study Notes", subtitle: "Admin Notes", content: html, type: 'NOTES_SIMPLE', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
            }
            if (type === 'PDF_PREMIUM' || type === 'NOTES_PREMIUM') {
                const link = parsed.premiumLink;
                const html = parsed.premiumNotesHtml;
                if (link && type === 'PDF_PREMIUM') return { id: Date.now().toString(), title: "Premium Notes", subtitle: "High Quality", content: link, type: 'PDF_PREMIUM', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
                if (html) return { id: Date.now().toString(), title: "Premium Notes", subtitle: "Exclusive", content: html, type: 'NOTES_PREMIUM', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
            }
            if (type === 'VIDEO_LECTURE' && (parsed.premiumVideoLink || parsed.freeVideoLink)) {
                return { id: Date.now().toString(), title: "Video Lecture", subtitle: "Watch Class", content: parsed.premiumVideoLink || parsed.freeVideoLink, type: 'PDF_VIEWER', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
            }
            if ((type === 'MCQ_SIMPLE' || type === 'MCQ_ANALYSIS') && parsed.manualMcqData) {
                return { id: Date.now().toString(), title: "Class Test", subtitle: `${parsed.manualMcqData.length} Qs`, content: '', type: type, dateCreated: new Date().toISOString(), subjectName: subject.name, mcqData: parsed.manualMcqData, manualMcqData_HI: parsed.manualMcqData_HI }
            }
        }
    } catch (e) { console.error(e); }
    return null;
};

export const fetchChapters = async (
  board: Board,
  classLevel: ClassLevel,
  stream: Stream | null,
  subject: Subject,
  language: Language
): Promise<Chapter[]> => {
  const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
  const cacheKey = `${board}-${classLevel}${streamKey}-${subject.name}-${language}`;

  const firebaseChapters = await getCustomSyllabus(cacheKey);
  if (firebaseChapters && firebaseChapters.length > 0) return firebaseChapters;

  const customChapters = await storage.getItem<Chapter[]>(`nst_custom_chapters_${cacheKey}`);
  if (customChapters && customChapters.length > 0) return customChapters;

  if (chapterCache[cacheKey]) return chapterCache[cacheKey];

  const staticKey = `${board}-${classLevel}-${subject.name}`;
  const staticList = STATIC_SYLLABUS[staticKey];
  if (staticList && staticList.length > 0) {
      const chapters = staticList.map((title, idx) => ({ id: `static-${idx + 1}`, title, description: `Chapter ${idx + 1}` }));
      chapterCache[cacheKey] = chapters;
      return chapters;
  }

  const prompt = `List 15 standard chapters for ${classLevel === 'COMPETITION' ? 'Competitive Exam' : `Class ${classLevel}`} ${stream ? stream : ''} Subject: ${subject.name} (${board}). Return JSON array: [{"title": "...", "description": "..."}].`;
  try {
    const text = await executeCanonical({
        canonicalModel: 'NOTES_ENGINE',
        prompt: prompt,
        jsonMode: true
    });
    const data = JSON.parse(cleanJson(text));
    const chapters: Chapter[] = data.map((item: any, index: number) => ({ id: `ch-${index + 1}`, title: item.title, description: item.description || '' }));
    chapterCache[cacheKey] = chapters;
    return chapters;
  } catch (error) {
    const data = [{id:'1', title: 'Chapter 1'}, {id:'2', title: 'Chapter 2'}];
    chapterCache[cacheKey] = data;
    return data;
  }
};

export const fetchLessonContent = async (
  board: Board,
  classLevel: ClassLevel,
  stream: Stream | null,
  subject: Subject,
  chapter: Chapter,
  language: Language,
  type: ContentType,
  existingMCQCount: number = 0,
  isPremium: boolean = false,
  targetQuestions: number = 15,
  adminPromptOverride: string = "",
  allowAiGeneration: boolean = false,
  syllabusMode: 'SCHOOL' | 'COMPETITION' = 'SCHOOL',
  forceRegenerate: boolean = false,
  dualGeneration: boolean = false,
  usageType: 'PILOT' | 'STUDENT' = 'STUDENT',
  onStream?: (text: string) => void
): Promise<LessonContent> => {

  // Load Settings
  let settings: SystemSettings | null = null;
  try {
      const stored = localStorage.getItem('nst_system_settings');
      if (stored) settings = JSON.parse(stored);
  } catch(e) {}

  // 1. Caching Layer (The "Brain")
  const structuredKey = `notes/${board}/${classLevel}/${subject.name}/${chapter.id}`;

  if (!forceRegenerate) {
      // Check Structured Cache First (RAG Cache)
      const cachedRAG = await getChapterData(structuredKey);
      if (cachedRAG && cachedRAG.content) {
          return {
              id: Date.now().toString(),
              title: chapter.title,
              subtitle: "Smart Notes (Cached)",
              content: cachedRAG.content,
              type: type, // Keep requested type
              dateCreated: cachedRAG.generatedAt || new Date().toISOString(),
              subjectName: subject.name,
              isComingSoon: false
          };
      }

      // Check Admin Content (Legacy/Manual)
      const adminContent = await withTimeout(getAdminContent(board, classLevel, stream, subject, chapter.id, type, syllabusMode), 2000);
      if (adminContent) return { ...adminContent, title: chapter.title };
  }

  // 2. Generation Allowed Check
  if (!allowAiGeneration) {
      return { id: Date.now().toString(), title: chapter.title, subtitle: "Content Unavailable", content: "", type: type, dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: true };
  }

  // 3. RAG + 3-Pass AI Pipeline
  if (type === 'NOTES_PREMIUM' || type === 'NOTES_SIMPLE' || type === 'NOTES_HTML_PREMIUM') {

      // Step A: Web Research (RAG Layer)
      let webContext = "";
      if (settings?.isWebSearchEnabled && settings?.googleSearchApiKey && settings?.googleSearchCxId) {
          if (onStream) onStream("🔍 Searching the web for latest curriculum...");
          const query = `${chapter.title} class ${classLevel} ${subject.name} ${board} syllabus notes explanation`;
          webContext = await searchWeb(query, settings.googleSearchApiKey, settings.googleSearchCxId);
      }

      // Step B: Pass 1 - Research Summarizer
      if (onStream) onStream("📑 Analyzing research data...");
      const pass1Prompt = `
      CONTEXT: ${webContext}
      TASK: Summarize key topics for ${chapter.title} (${board} Class ${classLevel}).
      FOCUS: Core concepts, definitions, and key facts. Keep it raw and factual.
      `;
      const researchSummary = await executeCanonical({ canonicalModel: 'NOTES_ENGINE', prompt: pass1Prompt });

      // Step C: Pass 2 - NCERT Structurer
      if (onStream) onStream("🏗️ Structuring content...");
      const pass2Prompt = `
      SOURCE MATERIAL: ${researchSummary}
      TASK: Structure this into a proper Chapter Layout.
      SECTIONS REQUIRED:
      1. Quick Overview
      2. Core Theory (Subtopics with Headings)
      3. Important Diagrams (Describe them)
      4. Comparison Tables
      `;
      const structuredContent = await executeCanonical({ canonicalModel: 'NOTES_ENGINE', prompt: pass2Prompt });

      // Step D: Pass 3 - Exam Optimizer (Final Output)
      if (onStream) onStream("✨ Finalizing notes...");
      const finalPrompt = `
      CONTENT: ${structuredContent}
      ROLE: Top Coaching Institute Teacher.
      TASK: Convert this into FINAL STUDY MATERIAL.

      MANDATORY LAYOUT (Use Markdown Headers):
      # Quick Overview
      (Summary + Exam Weightage)

      # Core Theory
      (Detailed explanation with Bullet points. Cover ALL subtopics from NCERT/BSEB)

      # Visual Learning
      (Flowcharts using text/arrows, Table of Differences)

      # Real Life Example
      (Connect topic to daily life)

      # Board Questions
      (5 Important subjective questions with model answers)

      # MCQs
      (5 Practice MCQs with answer key)

      STYLE:
      - Strict ${board} pattern.
      - Use "Hinglish" if Board is BSEB.
      - Make it engaging and premium.
      `;

      const finalContent = await executeCanonical({
          canonicalModel: 'NOTES_ENGINE',
          prompt: finalPrompt,
          onStream // Stream the final pass to user
      });

      // Step E: Save to Cache
      await saveChapterData(structuredKey, {
          content: finalContent,
          generatedAt: new Date().toISOString(),
          source: "RAG + 3-Pass"
      });

      return {
          id: Date.now().toString(),
          title: chapter.title,
          subtitle: "AI Generated Notes",
          content: finalContent,
          type: type,
          dateCreated: new Date().toISOString(),
          subjectName: subject.name,
          isComingSoon: false
      };
  }

  // Fallback for MCQ generation (Single Pass for now)
  if (type === 'MCQ_ANALYSIS' || type === 'MCQ_SIMPLE') {
      const prompt = `Generate 15 MCQs for ${chapter.title} (${board} Class ${classLevel}). JSON format: [{question, options[], correctAnswer, explanation}].`;
      const text = await executeCanonical({ canonicalModel: 'MCQ_ENGINE', prompt, jsonMode: true });
      const data = JSON.parse(cleanJson(text));

      return {
          id: Date.now().toString(),
          title: `MCQ Test: ${chapter.title}`,
          subtitle: "Practice Test",
          content: "",
          type: type,
          dateCreated: new Date().toISOString(),
          subjectName: subject.name,
          mcqData: data,
          isComingSoon: false
      };
  }

  return { id: Date.now().toString(), title: chapter.title, subtitle: "Error", content: "Generation failed.", type: type, dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: true };
};

export const generateCustomNotes = async (userTopic: string, adminPrompt: string, context?: { classLevel?: string, board?: string, subject?: string }): Promise<string> => {
    // Load Settings for RAG
    let settings: SystemSettings | null = null;
    try {
        const stored = localStorage.getItem('nst_system_settings');
        if (stored) settings = JSON.parse(stored);
    } catch(e) {}

    let webContext = "";
    if (settings?.isWebSearchEnabled && settings?.googleSearchApiKey && settings?.googleSearchCxId) {
        webContext = await searchWeb(userTopic, settings.googleSearchApiKey, settings.googleSearchCxId);
    }

    const { classLevel = "10", board = "CBSE" } = context || {};

    // HARDCORE PROMPT INJECTION
    const hardCoreInstructions = `
    COVER ALL SUBTOPICS. DO NOT JUST DEFINE THE TITLE.
    GENERATE FULL CHAPTER LIKE A COACHING MODULE.
    Structure: [Quick Overview] [Core Theory] [Real Life Example] [Exam Questions].
    `;

    const prompt = `
    ${adminPrompt || "Explain this topic detailed."}

    WEB CONTEXT: ${webContext}

    CRITICAL: ${hardCoreInstructions}

    Topic: ${userTopic}
    Class: ${classLevel}
    Board: ${board}
    `;

    return await executeCanonical({ canonicalModel: 'NOTES_ENGINE', prompt });
};

export const generateUltraAnalysis = async (data: any, settings?: SystemSettings): Promise<string> => {
    // 1. Minify Data to prevent Token Limit Errors
    const questions = data.questions || [];
    const userAnswers = data.userAnswers || {};

    const minifiedQuestions = questions.map((q: any, idx: number) => {
        const isCorrect = userAnswers[idx] === q.correctAnswer;
        return {
            q: q.question.substring(0, 100), // Truncate question text
            s: isCorrect ? 'C' : 'W', // C = Correct, W = Wrong
            t: q.topic || '' // Pass topic if available
        };
    });

    // Prioritize Wrong Answers + Limit to 40 items
    const wrong = minifiedQuestions.filter((q: any) => q.s === 'W');
    const correct = minifiedQuestions.filter((q: any) => q.s === 'C');

    const finalData = {
        subject: data.subject,
        chapter: data.chapter,
        score: data.score,
        total: data.total,
        // Take all wrong answers (up to 30), fill rest with correct answers (up to 10)
        items: [...wrong.slice(0, 30), ...correct.slice(0, 10)]
    };

    const prompt = `
    Analyze Student Performance for ${data.subject} - ${data.chapter}.
    Score: ${data.score}/${data.total}.

    DATA (C=Correct, W=Wrong):
    ${JSON.stringify(finalData)}

    TASK:
    Identify weak topics based on 'W' items.

    OUTPUT JSON ONLY:
    {
      "topics": [
        {"name": "Topic Name", "status": "WEAK" | "STRONG" | "AVG", "actionPlan": "Specific advice", "studyMode": "DEEP_STUDY" | "REVISION", "questions": [{"text": "Question snippet", "status": "CORRECT" | "WRONG"}]}
      ],
      "motivation": "Encouraging remark (max 20 words)",
      "nextSteps": {
        "focusTopics": ["Topic 1", "Topic 2"],
        "action": "Brief study plan"
      },
      "weakToStrongPath": [
         {"step": 1, "action": "Step 1 action"},
         {"step": 2, "action": "Step 2 action"}
      ]
    }
    `;

    try {
        const result = await executeCanonical({ canonicalModel: 'ANALYSIS_ENGINE', prompt, jsonMode: true });
        return cleanJson(result);
    } catch (e) {
        console.error("AI Analysis Failed", e);
        return JSON.stringify({
            error: "Analysis failed. Please try again.",
            topics: [],
            motivation: "Keep practicing!",
            nextSteps: {}
        });
    }
};
