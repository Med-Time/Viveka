import { axiosClient } from "@/api/axiosClient";
import { PersonaReport } from "@/types/api";

export const personaApi = {
  get: async (sessionId: string): Promise<PersonaReport> => {
    const response = await axiosClient.get<PersonaReport>(`/persona/${sessionId}`);
    return response.data;
  },
};
