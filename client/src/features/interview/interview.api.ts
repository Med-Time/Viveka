import { axiosClient } from "@/api/axiosClient";
import {
  StartInterviewRequest,
  AnswerInterviewRequest,
} from "@/types/api";
import type { QuestionType } from "@/types/api";

/**
 * Response when starting an interview (matches your /start route)
 */
export type StartApiResponse = {
  status: "ok" | "error";
  study_id: string;
  type?: QuestionType;
  question?: string;
  concept?: string;
  message?: string;
};

/**
 * Response for /answer when there is a next question (normal flow)
 */
export type AnswerOkResponse = {
  status: "ok";
  study_id: string;
  type?: QuestionType;
  question?: string;
  concept?: string;
  score?: number;
  feedback?: any[]; // keep loose here — refine if you have a concrete shape
};

/**
 * Response for /answer when interview is finished
 */
export type AnswerDoneResponse = {
  status: "done";
  final_score?: number;
  summary?: string;
  feedback?: any[];
};

/**
 * Union of possible /answer responses
 */
export type AnswerApiResponse = AnswerOkResponse | AnswerDoneResponse;

export const interviewApi = {
  start: async (data: StartInterviewRequest): Promise<StartApiResponse> => {
    const response = await axiosClient.post<StartApiResponse>("/interview/start", data);
    return response.data;
  },

  answer: async (data: AnswerInterviewRequest): Promise<AnswerApiResponse> => {
    const response = await axiosClient.post<AnswerApiResponse>("/interview/answer", data);
    return response.data;
  },
};
