import { axiosClient } from "@/api/axiosClient";

export const quizStatusApi = {
  get: async (studyId: string, chapterIdx: number, subtopicIdx: number) => {
    const url = `/quiz-status/${encodeURIComponent(studyId)}/${chapterIdx}/${subtopicIdx}`;
    console.log("Fetching quiz status:", axiosClient.defaults.baseURL + url);

    try {
      const res = await axiosClient.get(url);
      console.log("Received response:", res.data);
      return res.data;
    } catch (err: any) {
      console.error("Error fetching quiz status:", err);
      throw new Error(`Failed to fetch quiz status (${err.response?.status})`);
    }
  },

  save: async (payload: any) => {
    try {
      const res = await axiosClient.post(`/quiz-status/`, payload);
      return res.data;
    } catch (err: any) {
      console.error("Error saving quiz status:", err);
      throw new Error(`Failed to save quiz status (${err.response?.status})`);
    }
  },
};
