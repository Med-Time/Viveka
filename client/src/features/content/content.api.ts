import { axiosClient } from "@/api/axiosClient";
import { ChapterContent } from "@/types/api";

export const contentApi = {
  generate: async (sessionId: string, chapterIdx: number): Promise<void> => {
    await axiosClient.get(`/content/generate/${sessionId}/${chapterIdx}`);
  },

  get: async (sessionId: string, chapterIdx: number): Promise<ChapterContent> => {
    const response = await axiosClient.get<ChapterContent>(`/content/${sessionId}/${chapterIdx}`);
    return response.data;
  },
};
