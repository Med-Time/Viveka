import { axiosClient } from "@/api/axiosClient";
import { PersonaGetResponse, PersonaReport } from "@/types/api";

export const personaApi = {
  get: async (studyId: string): Promise<PersonaReport> => {
    const response = await axiosClient.get<PersonaGetResponse>(`/interview/persona/${studyId}`);
    // server returns { status: 'success', data: persona_report }
    return response.data.data;
  },
};
