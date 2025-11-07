import { axiosClient } from "@/api/axiosClient";
import { AuthResponse, SignupRequest, LoginRequest } from "@/types/api";

export const authApi = {
  signup: async (data: SignupRequest): Promise<AuthResponse> => {
    const response = await axiosClient.post<AuthResponse>("/auth/signup", data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await axiosClient.post<AuthResponse>("/auth/login", data);
    return response.data;
  },
};
