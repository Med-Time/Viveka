// src/features/progress/progress.api.ts
import { axiosClient } from "@/api/axiosClient";

export interface ProgressCompleteRequest {
    user_id: string;
    study_id: string;
    chapter_idx: number;
    subtopic_idx: number;
    chapter_title?: string;
    subtopic_title?: string;
}

export interface ProgressCompleteResponse {
    status: "ok" | "error";
    study_id?: string;
    chapter_idx?: number;
    subtopic_idx?: number;
    message?: string;
}

export const progressApi = {
  complete: async (data: ProgressCompleteRequest): Promise<ProgressCompleteResponse> => {
    const res = await axiosClient.post<ProgressCompleteResponse>("content/progress/complete_subtopic", data);
    return res.data;
  },
};
