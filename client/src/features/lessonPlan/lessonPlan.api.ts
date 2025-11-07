import { axiosClient } from "@/api/axiosClient";
import { LessonPlan } from "@/types/api";

export const lessonPlanApi = {
  generate: async (sessionId: string): Promise<void> => {
    await axiosClient.get(`/lesson-plan/generate/${sessionId}`);
    // await axiosClient.get(`/lesson-plan/68cd06a9d04e51025dac3c7e`);
  },


  get: async (sessionId: string): Promise<LessonPlan> => {
    const response = await axiosClient.get<LessonPlan>(`/lesson-plan/${sessionId}`);
    return response.data;
  },
};
