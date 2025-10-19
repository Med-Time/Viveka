import type { LessonPlanResponse } from '../types/api';

export const fetchLessonPlan = async (sessionId: string): Promise<LessonPlanResponse> => {
  const response = await fetch(`http://localhost:8000/lesson-plan/${sessionId}`);
  console.log('Fetching lesson plan for session:', sessionId);
  console.log('Response status:', response.status);
  console.log('Response headers:', response.headers);
  if (!response.ok) throw new Error('Failed to fetch lesson plan');
  return response.json();
};