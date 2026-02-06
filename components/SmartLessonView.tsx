import React, { useState, useEffect } from 'react';
import { LessonContent, Subject, Chapter, User, SystemSettings, ClassLevel, Stream } from '../types';
import { fetchLessonContent } from '../services/contentGenerator';
import { LessonView } from './LessonView';

interface Props {
  chapter: Chapter;
  subject: Subject;
  user: User;
  board: string;
  classLevel: string;
  stream: string | null;
  onBack: () => void;
  onUpdateUser?: (user: User) => void;
  settings?: SystemSettings;
}

export const SmartLessonView: React.FC<Props> = ({
  chapter,
  subject,
  user,
  board,
  classLevel,
  stream,
  onBack,
  onUpdateUser,
  settings
}) => {
  const [content, setContent] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        const data = await fetchLessonContent(
          board as any,
          classLevel as ClassLevel,
          stream as Stream,
          subject,
          chapter,
          'English',
          'SMART_LESSON',
          0,
          user.isPremium,
          15, // targetQuestions
          "", // adminPromptOverride
          true // allowAiGeneration
        );
        setContent(data);
      } catch (error) {
        console.error("Failed to load smart lesson:", error);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [chapter.id, subject.id]); // Reload if chapter changes

  return (
    <LessonView
      content={content}
      subject={subject}
      classLevel={classLevel as ClassLevel}
      chapter={chapter}
      loading={loading}
      onBack={onBack}
      user={user}
      onUpdateUser={onUpdateUser}
      settings={settings}
    />
  );
};
