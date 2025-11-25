import { axiosClient } from "@/api/axiosClient";
import { ChapterContent } from "@/types/api";

export const contentApi = {
  generate: async (sessionId: string, chapterIdx: number, index: number): Promise<void> => {
    await axiosClient.get(`/content/generate/${sessionId}/${chapterIdx}/${index}`);
  },

  enqueue: async (sessionId: string, chapterIdx: number, index: number): Promise<{job_id: string, status: string}> => {
    const response = await axiosClient.post(`/content/enqueue/${sessionId}/${chapterIdx}/${index}`);
    return response.data;
  },

  getJob: async (jobId: string): Promise<any> => {
    const response = await axiosClient.get(`/content/job/${jobId}`);
    return response.data;
  },

  get: async (sessionId: string, chapterIdx: number, index: number): Promise<ChapterContent> => {
    const response = await axiosClient.get<ChapterContent>(`/content/${sessionId}/${chapterIdx}/${index}`);
    return response.data;
  },
};
