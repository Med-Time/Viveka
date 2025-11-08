import axios from "axios";
import { toast } from "@/hooks/use-toast";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const axiosClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      window.location.href = "/auth";
      toast({
        title: "Session expired",
        description: "Please log in again.",
        variant: "destructive",
      });
    } else if (error.response?.data?.message) {
      toast({
        title: "Error",
        description: error.response.data.message,
        variant: "destructive",
      });
    } else if (error.message === "Network Error") {
      toast({
        title: "Network Error",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    }
    return Promise.reject(error);
  }
);
