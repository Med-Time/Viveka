import { axiosClient } from "@/api/axiosClient";

export const certificateApi = {
  getCertificate: async (studyId: string) => {
    const response = await axiosClient.get(`/certificate/${studyId}`);
    return response.data;
  },

  downloadCertificate: async (studyId: string): Promise<Blob> => {
    const response = await axiosClient.post(
      `/certificate/${studyId}/download`,
      {},
      { responseType: "blob" }
    );
    return response.data;
  },
  
  certificateExists: async (studyId: string): Promise<{ exists: boolean; certificate_id: string | null }> => {
    const response = await axiosClient.get(`/certificate/${studyId}/exists`);
    return response.data;
  },
};