// client/src/features/ai_assistant/assistant.api.ts
import { axiosClient } from "@/api/axiosClient";

// Define the shape of the request payload
export type AssistantMessagePayload = {
  message: string;
  studyId: string;
  chapterIdx: number;
  subtopicIdx: number;
};

// Define the shape of the expected response
export type AssistantMessageResponse = {
  reply: string;
  // You can add more fields here if the backend returns them
};

/**
 * Sends a message and context to the AI assistant backend.
 */
const sendMessage = async (
  payload: AssistantMessagePayload
): Promise<AssistantMessageResponse> => {
  // Use the API prefix you use elsewhere (e.g., /api/v1)
  const { data } = await axiosClient.post(
    "/api/v1/assistant/chat", // This is our new backend endpoint
    payload
  );
  return data;
};

export const assistantApi = {
  sendMessage,
};