import { axiosClient } from "@/api/axiosClient";
import { safeSetJson } from "@/utils/storage";

export const authApi = {
  login: async (payload: { email: string; password: string }) => {
    const resp = await axiosClient.post("/auth/login", payload);
    const data = resp.data;
    const access = data.access_token;
    if (access) localStorage.setItem("auth_token", access);
    if (data.user) safeSetJson("user", data.user);
    return data;
  },

  signup: async (payload: any) => {
    const resp = await axiosClient.post("/auth/signup", payload);
    return resp.data;
  },
};
