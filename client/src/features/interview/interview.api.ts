import { axiosClient } from "@/api/axiosClient";
import {
  StartInterviewResponse,
  StartInterviewRequest,
  AnswerInterviewRequest,
  AnswerInterviewResponse,
} from "@/types/api";

export const interviewApi = {
  start: async (data: StartInterviewRequest): Promise<StartInterviewResponse> => {
    const response = await axiosClient.post<StartInterviewResponse>("/interview/start", data);
    return response.data;
  },

  answer: async (data: AnswerInterviewRequest): Promise<AnswerInterviewResponse> => {
    const response = await axiosClient.post<AnswerInterviewResponse>("/interview/answer", data);
    return response.data;
  },

  
};
