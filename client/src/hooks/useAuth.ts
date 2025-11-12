import { useState, useEffect } from "react";
import { AuthResponse } from "@/types/api";

export const useAuth = () => {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("user");
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = (authData: AuthResponse) => {
    setToken(authData.token);
    setUser(authData.user);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    localStorage.removeItem("study_id");
    localStorage.removeItem("current_study_id");
    setToken(null);
    setUser(null);
  };

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    logout,
  };
};
