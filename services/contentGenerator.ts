import { ClassLevel, Subject, Chapter, LessonContent, Language, Board, Stream, ContentType, MCQItem, SystemSettings } from "../types";
import { STATIC_SYLLABUS } from "../constants";
import { getChapterData, getCustomSyllabus } from "../firebase";
import { storage } from "../utils/storage";
import { executeCanonical } from "./ai/router";
import { performWebSearch } from "./search";
import { CanonicalModel } from "./ai/types";

const chapterCache: Record<string, Chapter[]> = {};

const cleanJson = (text: string) => {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

const processTemplate = (template: string, replacements: Record<string, string>) => {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`{${key}}`, 'gi'), value);
    }
    return result;
};

// --- UNIVERSAL BOARD PROMPT GENERATOR ---
const generateBoardPrompt = async (
    classLevel: string,
    subject: string,
    board: string,
    chapter: string,
    topic: string,
    mode: 'NOTES' | 'MCQ',
    settings?: SystemSettings
): Promise<string> => {
    // 1. BOARD RULES
    let boardRules = "";
    let searchContext = "";

    if (board === 'CBSE') {
        boardRules = `
        1. Follow NCERT pattern strictly.
        2. Focus on Conceptual Understanding + Application.
        3. Include: Competency Based Questions, Assertion-Reason, HOTS.
        4. Style: To-the-point, clear definitions, diagrams descriptions.
        `;
    } else if (board === 'BSEB') {
        boardRules = `
        1. Follow Bihar Board (BSEB) syllabus & exam pattern.
        2. Focus on Direct Theory + Exam Pattern Questions.
        3. Include: Short Answer (2 Marks), Long Answer (5 Marks), Objective (MCQ).
        4. Style: Simple Hinglish (Hindi + English mix), Bullet points, easy to memorize.
        `;
    } else {
        boardRules = "Follow standard Indian school curriculum pattern.";
    }

    // 2. LIVE SEARCH (RAG)
    let searchQuery = "";
    if (board === 'CBSE') searchQuery = `NCERT Class ${classLevel} ${subject} ${chapter} ${topic} notes 2025`;
    else if (board === 'BSEB') searchQuery = `Bihar Board Class ${classLevel} ${subject} ${chapter} important questions 2025`;

    if (searchQuery) {
        searchContext = await performWebSearch(searchQuery, settings);
    }

    // 3. EXAM MODE STYLING
    const examModeInstructions = `
    CRITICAL FORMATTING RULES FOR "EXAM MODE":
    - Mark very important lines/concepts with ★ (e.g., ★ Newton's Second Law...).
    - Enclose all Formulas in [FORMULA]...[/FORMULA] blocks (or just mark clearly).
    - For important Questions, prefix with [IMP-Q].
    `;

    // 4. STRUCTURE
    const structure = mode === 'NOTES' ? `
    Structure:
    - Clear Definitions
    - All Subtopics covered
    - Bullet points + Paragraphs
    - Tables (where needed)
    - Flowcharts (Text based)
    - Diagram Descriptions (Step-by-step)
    - 15 Board Specific Questions
    - 5 HOTS Questions
    ` : `
    Structure:
    - 20 High Quality MCQs
    - Mix of Easy, Medium, Hard
    - Case Based / Assertion Reason if CBSE
    `;

    return `
    You are an expert Indian school teacher and educational content designer.
    Generate extremely detailed, exam-oriented, and structured content for:
    Class: ${classLevel}
    Board: ${board}
    Subject: ${subject}
    Chapter: ${chapter}
    Topic: ${topic || 'Full Chapter'}

    ${searchContext}

    Rules:
    ${boardRules}

    ${examModeInstructions}

    ${structure}

    Language: Simple Hinglish (Hindi + English mix) where appropriate for explanation, English for terms.
    Do NOT keep it short. Write like top Indian coaching notes (Allen/Aakash level).
    `;
};

// --- TRANSLATION HELPER ---
export const translateToHindi = async (content: string, isJson: boolean = false, userId?: string): Promise<string> => {
    const prompt = `
    You are an expert translator for Bihar Board students.
    Translate the following ${isJson ? 'JSON Data' : 'Educational Content'} into Hindi (Devanagari).

    Style Guide:
    - Use "Hinglish" for technical terms (e.g., "Force" -> "Force (बल)").
    - Keep tone simple and student-friendly.
    - ${isJson ? 'Maintain strict JSON structure. Only translate values (question, options, explanation, etc). Do NOT translate keys.' : 'Keep Markdown formatting intact.'}

    CONTENT:
    ${content}
    `;

    try {
        const text = await executeCanonical({
            canonicalModel: 'TRANSLATION_ENGINE',
            prompt: prompt,
            userId,
            jsonMode: isJson
        });
        return isJson ? cleanJson(text) : text;
    } catch (e) {
        console.error("Translation Failed", e);
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
    const key = `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapterId}`;

    try {
        let parsed = await getChapterData(key);
        if (!parsed) parsed = await storage.getItem(key);

        if (parsed) {
            // Logic mirrored from gemini.ts for backward compatibility
            if (type === 'PDF_FREE' || type === 'NOTES_SIMPLE') {
                const linkKey = syllabusMode === 'SCHOOL' ? 'schoolPdfLink' : 'competitionPdfLink';
                const htmlKey = syllabusMode === 'SCHOOL' ? 'schoolFreeNotesHtml' : 'competitionFreeNotesHtml';
                const link = parsed[linkKey] || parsed.freeLink;
                const html = parsed[htmlKey] || parsed.freeNotesHtml;

                if (link && type === 'PDF_FREE') {
                    return { id: Date.now().toString(), title: "Free Material", subtitle: "Admin Provided", content: link, type: 'PDF_FREE', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
                }
                if (html) {
                     return { id: Date.now().toString(), title: "Study Notes", subtitle: "Admin Notes", content: html, type: 'NOTES_SIMPLE', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
                }
            }

            if (type === 'PDF_PREMIUM' || type === 'NOTES_PREMIUM') {
                const linkKey = syllabusMode === 'SCHOOL' ? 'schoolPdfPremiumLink' : 'competitionPdfPremiumLink';
                const htmlKey = syllabusMode === 'SCHOOL' ? 'schoolPremiumNotesHtml' : 'competitionPremiumNotesHtml';
                const link = parsed[linkKey] || parsed.premiumLink;
                const html = parsed[htmlKey] || parsed.premiumNotesHtml;

                if (link && type === 'PDF_PREMIUM') {
                    return { id: Date.now().toString(), title: "Premium Notes", subtitle: "High Quality", content: link, type: 'PDF_PREMIUM', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
                }
                if (html) {
                    const htmlKeyHI = syllabusMode === 'SCHOOL' ? 'schoolPremiumNotesHtml_HI' : 'competitionPremiumNotesHtml_HI';
                    return { id: Date.now().toString(), title: "Premium Notes", subtitle: "Exclusive", content: html, type: 'NOTES_PREMIUM', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false, schoolPremiumNotesHtml_HI: syllabusMode === 'SCHOOL' ? parsed[htmlKeyHI] : undefined, competitionPremiumNotesHtml_HI: syllabusMode === 'COMPETITION' ? parsed[htmlKeyHI] : undefined };
                }
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
        canonicalModel: 'NOTES_ENGINE', // Use Notes Engine for Syllabus too
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

  // Settings Loading
  let settings: SystemSettings | undefined = undefined;
  let customInstruction = "";
  let promptNotes = "";
  let promptNotesPremium = "";
  let promptMCQ = "";

  try {
      const stored = localStorage.getItem('nst_system_settings');
      if (stored) {
          settings = JSON.parse(stored) as SystemSettings;
          if (settings.aiInstruction) customInstruction = `IMPORTANT INSTRUCTION: ${settings.aiInstruction}`;

          if (syllabusMode === 'COMPETITION') {
              if (board === 'CBSE') {
                  if (settings.aiPromptNotesCompetitionCBSE) promptNotes = settings.aiPromptNotesCompetitionCBSE;
                  if (settings.aiPromptNotesPremiumCompetitionCBSE) promptNotesPremium = settings.aiPromptNotesPremiumCompetitionCBSE;
                  if (settings.aiPromptMCQCompetitionCBSE) promptMCQ = settings.aiPromptMCQCompetitionCBSE;
              }
              if (!promptNotes && settings.aiPromptNotesCompetition) promptNotes = settings.aiPromptNotesCompetition;
              if (!promptNotesPremium && settings.aiPromptNotesPremiumCompetition) promptNotesPremium = settings.aiPromptNotesPremiumCompetition;
              if (!promptMCQ && settings.aiPromptMCQCompetition) promptMCQ = settings.aiPromptMCQCompetition;
          } else {
              if (board === 'CBSE') {
                  if (settings.aiPromptNotesCBSE) promptNotes = settings.aiPromptNotesCBSE;
                  if (settings.aiPromptNotesPremiumCBSE) promptNotesPremium = settings.aiPromptNotesPremiumCBSE;
                  if (settings.aiPromptMCQCBSE) promptMCQ = settings.aiPromptMCQCBSE;
              }
              if (!promptNotes && settings.aiPromptNotes) promptNotes = settings.aiPromptNotes;
              if (!promptNotesPremium && settings.aiPromptNotesPremium) promptNotesPremium = settings.aiPromptNotesPremium;
              if (!promptMCQ && settings.aiPromptMCQ) promptMCQ = settings.aiPromptMCQ;
          }
      }
  } catch(e) {}

  if (!forceRegenerate) {
      const adminContent = await getAdminContent(board, classLevel, stream, subject, chapter.id, type, syllabusMode);
      if (adminContent) return { ...adminContent, title: chapter.title };
  }

  if ((type.includes('PDF') || type === 'PDF_VIEWER') && !forceRegenerate) {
      return { id: Date.now().toString(), title: chapter.title, subtitle: "Content Unavailable", content: "", type: type, dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: true };
  }

  if (!allowAiGeneration) {
      return { id: Date.now().toString(), title: chapter.title, subtitle: "Content Unavailable", content: "", type: type, dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: true };
  }

  // MCQ Mode
  if (type === 'MCQ_ANALYSIS' || type === 'MCQ_SIMPLE') {
      const effectiveCount = Math.max(targetQuestions, 20);
      let prompt = "";

      if (promptMCQ) {
           prompt = processTemplate(promptMCQ, { board: board || '', class: classLevel, stream: stream || '', subject: subject.name, chapter: chapter.title, language: language, count: effectiveCount.toString(), instruction: customInstruction });
           if (adminPromptOverride) prompt += `\nINSTRUCTION: ${adminPromptOverride}`;
      } else {
          // USE NEW UNIVERSAL BOARD PROMPT
          prompt = await generateBoardPrompt(classLevel, subject.name, board, chapter.title, "", 'MCQ', settings);
          prompt += `\nCreate ${effectiveCount} MCQs STRICT JSON array of {question, options[], correctAnswer(index), explanation}.`;
      }

      // We use MCQ_ENGINE
      const text = await executeCanonical({
          canonicalModel: 'MCQ_ENGINE',
          prompt: prompt,
          jsonMode: true,
      });

      const data = JSON.parse(cleanJson(text));

      let hindiMcqData = undefined;
      if (language === 'English') {
          try {
             const translatedJson = await translateToHindi(JSON.stringify(data), true);
             hindiMcqData = JSON.parse(translatedJson);
          } catch(e) {}
      }

      return {
          id: Date.now().toString(),
          title: `MCQ Test: ${chapter.title}`,
          subtitle: `${data.length} Questions`,
          content: '',
          type: type,
          dateCreated: new Date().toISOString(),
          subjectName: subject.name,
          mcqData: data,
          manualMcqData_HI: hindiMcqData
      };
  }

  // NOTES Mode
  const generateNotes = async (detailed: boolean): Promise<{text: string, hindiText?: string}> => {
      let prompt = "";
      const template = detailed ? promptNotesPremium : promptNotes;

      if (template) {
           prompt = processTemplate(template, { board: board || '', class: classLevel, stream: stream || '', subject: subject.name, chapter: chapter.title, language: language, instruction: customInstruction });
      } else {
          // USE NEW UNIVERSAL BOARD PROMPT
          const basePrompt = await generateBoardPrompt(classLevel, subject.name, board, chapter.title, "", 'NOTES', settings);

          if (detailed) {
              prompt = `${customInstruction} ${adminPromptOverride || ""} ${basePrompt} STRICT TARGET: 1000-1500 Words. Comprehensive, structured, with examples.`;
          } else {
              prompt = `${customInstruction} ${adminPromptOverride || ""} ${basePrompt} Write SHORT SUMMARY NOTES. STRICT TARGET: 200-300 Words. Key points only.`;
          }
      }

      const text = await executeCanonical({
          canonicalModel: 'NOTES_ENGINE',
          prompt: prompt,
          onStream
      });

      let hindiText = undefined;
      if (language === 'English') {
          try {
              hindiText = await translateToHindi(text, false);
          } catch(e) {}
      }
      return { text, hindiText };
  };

  if (dualGeneration && (type === 'NOTES_PREMIUM' || type === 'NOTES_SIMPLE')) {
       // Dual logic ...
       const prompt = `${customInstruction} ${adminPromptOverride || ""} TASK: 1. Generate Premium Detailed Analysis Notes for ${board} Class ${classLevel} ${subject.name}, Chapter: "${chapter.title}". 2. Generate a 200-300 word Summary for Free Notes. Language: ${language}. OUTPUT FORMAT STRICTLY: <<<PREMIUM>>> [Content] <<<SUMMARY>>> [Content]`;

       const rawText = await executeCanonical({ canonicalModel: 'NOTES_ENGINE', prompt: prompt });

       let premiumText = rawText;
       let freeText = "Summary not generated.";

       if (rawText.includes("<<<PREMIUM>>>")) {
           const parts = rawText.split("<<<PREMIUM>>>");
           if (parts[1]) {
               const subParts = parts[1].split("<<<SUMMARY>>>");
               premiumText = subParts[0].trim();
               if (subParts[1]) freeText = subParts[1].trim();
           }
       }

       let premiumTextHI = undefined;
       let freeTextHI = undefined;
       if (language === 'English') {
          try {
              const [p, f] = await Promise.all([
                  translateToHindi(premiumText, false),
                  translateToHindi(freeText, false)
              ]);
              premiumTextHI = p;
              freeTextHI = f;
          } catch(e) {}
       }

      return {
          id: Date.now().toString(),
          title: chapter.title,
          subtitle: "Premium & Free Notes (Dual)",
          content: premiumText,
          type: 'NOTES_PREMIUM',
          dateCreated: new Date().toISOString(),
          subjectName: subject.name,
          schoolPremiumNotesHtml: syllabusMode === 'SCHOOL' ? premiumText : undefined,
          competitionPremiumNotesHtml: syllabusMode === 'COMPETITION' ? premiumText : undefined,
          schoolPremiumNotesHtml_HI: syllabusMode === 'SCHOOL' ? premiumTextHI : undefined,
          competitionPremiumNotesHtml_HI: syllabusMode === 'COMPETITION' ? premiumTextHI : undefined,
          schoolFreeNotesHtml: syllabusMode === 'SCHOOL' ? freeText : undefined,
          competitionFreeNotesHtml: syllabusMode === 'COMPETITION' ? freeText : undefined,
          schoolFreeNotesHtml_HI: syllabusMode === 'SCHOOL' ? freeTextHI : undefined,
          competitionFreeNotesHtml_HI: syllabusMode === 'COMPETITION' ? freeTextHI : undefined,
          isComingSoon: false
      };
  }

  const isDetailed = type === 'NOTES_PREMIUM' || type === 'NOTES_HTML_PREMIUM';
  const result = await generateNotes(isDetailed);

  return {
      id: Date.now().toString(),
      title: chapter.title,
      subtitle: isDetailed ? "Premium Study Notes" : "Quick Revision Notes",
      content: result.text,
      type: type,
      dateCreated: new Date().toISOString(),
      subjectName: subject.name,
      schoolPremiumNotesHtml_HI: syllabusMode === 'SCHOOL' && isDetailed ? result.hindiText : undefined,
      competitionPremiumNotesHtml_HI: syllabusMode === 'COMPETITION' && isDetailed ? result.hindiText : undefined,
      isComingSoon: false
  };
};

export const generateCustomNotes = async (
    userTopic: string,
    adminPrompt: string,
    context?: { board?: string, classLevel?: string, subject?: string }
): Promise<string> => {
    let settings: SystemSettings | undefined;
    try {
        const stored = localStorage.getItem('nst_system_settings');
        if (stored) settings = JSON.parse(stored);
    } catch(e) {}

    // Use Context to build a smarter prompt
    let prompt = "";
    if (context && context.board && context.classLevel && context.subject) {
        const basePrompt = await generateBoardPrompt(context.classLevel, context.subject, context.board, "Custom Topic", userTopic, 'NOTES', settings);
        prompt = `${basePrompt} \nUSER TOPIC: ${userTopic} \n${adminPrompt || ''}`;
    } else {
        // Fallback for generic calls
        prompt = `${adminPrompt || 'Generate detailed notes for the following topic:'} TOPIC: ${userTopic} Ensure the content is well-structured with headings and bullet points.`;
    }

    return await executeCanonical({ canonicalModel: 'NOTES_ENGINE', prompt });
};

export const generateUltraAnalysis = async (data: any, settings?: SystemSettings): Promise<string> => {
    let customInstruction = settings?.aiInstruction || "";
    const prompt = `${customInstruction} ROLE: Expert Educational Mentor. Analyze performance: ${JSON.stringify(data)} Return STRICT JSON {topics:[], motivation:"", nextSteps:{}, weakToStrongPath:[]}`;
    return await executeCanonical({ canonicalModel: 'ANALYSIS_ENGINE', prompt, jsonMode: true });
};
