import { axiosClient } from "@/api/axiosClient";
import { AssignmentResponse, SubmitResponse } from "@/types/api";

export const assignmentApi = {
  // 1. Get Subtopic Quiz
  getSubtopicQuiz: async (studyId: string, chapterIdx: number, subtopicIdx: number) => {
    const response = await axiosClient.post<AssignmentResponse>(
      `/iiismart-assignment/subtopic/${studyId}/${chapterIdx}/${subtopicIdx}`
    );
    return response.data;
  },

  // 2. Get Chapter Assignment
  getChapterTest: async (studyId: string, chapterIdx: number) => {
    const response = await axiosClient.post<AssignmentResponse>(
      `/iiismart-assignment/chapter/${studyId}/${chapterIdx}`
    );
    return response.data;
  },

  // 3. Get Subject Capstone
  getSubjectCapstone: async (studyId: string) => {
    const response = await axiosClient.post<AssignmentResponse>(
      `/iiismart-assignment/subject/${studyId}`
    );
    return response.data;
  },

  // 4. Submit Answers
  // We define a flexible payload to handle all 3 levels (subtopic/chapter/subject)
  submitAssignment: async (
    studyId: string,
    payload: {
      assignment_level: "subtopic" | "chapter" | "subject";
      chapter_idx: number;
      subtopic_idx?: number; // Optional, only for subtopic quizzes
      responses: { question_id: string; user_answer: string }[];
    }
  ) => {
    const response = await axiosClient.post<SubmitResponse>(
      `/iiismart-assignment/submit/${studyId}`,
      payload
    );
    return response.data;
  },
};