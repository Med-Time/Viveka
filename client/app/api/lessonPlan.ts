import type { LessonPlanResponse } from '../types/api';
// If you have a demoLessonPlan.json, import it:
import demoLessonPlan from '../demoLessonPlan.json';
export const fetchLessonPlan = async (sessionId: string): Promise<LessonPlanResponse> => {
  // In a real API, you'd use sessionId to fetch the lesson plan.
  // For the demo, just return the imported JSON.
  // Type assertion is safe here because demoLessonPlan matches LessonPlanResponse structure.
  return demoLessonPlan as LessonPlanResponse;
};

// export const fetchLessonPlan = async (sessionId: string): Promise<LessonPlanResponse> => {
//   const response = await fetch(`/api/lesson-plan/generate/${sessionId}`);
//   if (!response.ok) throw new Error('Failed to fetch lesson plan');
//   return response.json();
// };