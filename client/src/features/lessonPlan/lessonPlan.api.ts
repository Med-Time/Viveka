import { axiosClient } from "@/api/axiosClient";
import { LessonPlan } from "@/types/api";

export const lessonPlanApi = {
  generate: async (study_id: string): Promise<void> => {
    await axiosClient.get(`/lesson-plan/generate/${study_id}`);
  },

  enqueue: async (study_id: string): Promise<{job_id: string, status: string}> => {
    const response = await axiosClient.post(`/lesson-plan/enqueue/${study_id}`);
    return response.data;
  },

  getJob: async (jobId: string): Promise<any> => {
    const response = await axiosClient.get(`/lesson-plan/job/${jobId}`);
    return response.data;
  },


  get: async (study_id: string): Promise<LessonPlan> => {
    const response = await axiosClient.get<LessonPlan>(`/lesson-plan/${study_id}`);
    return response.data;
  },
};
