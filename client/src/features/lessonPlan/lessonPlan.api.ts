import { axiosClient } from "@/api/axiosClient";
import { LessonPlan } from "@/types/api";

export const lessonPlanApi = {
  generate: async (study_id: string): Promise<void> => {
    await axiosClient.get(`/lesson-plan/generate/${study_id}`);
  },


  get: async (study_id: string): Promise<LessonPlan> => {
    const response = await axiosClient.get<LessonPlan>(`/lesson-plan/${study_id}`);
    return response.data;
  },
};
