import type { LessonPlanResponse } from '../types/api';

export const fetchLessonPlan = async (sessionId: string): Promise<LessonPlanResponse> => {
  const response = await fetch(`http://localhost:8000/lesson-plan/generate/${sessionId}`);
  if (!response.ok) throw new Error('Failed to fetch lesson plan');
  return response.json();
};