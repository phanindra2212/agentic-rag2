import { create } from "zustand";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  setAuth: (access: string, refresh: string, user: UserProfile) => void;
  updateUser: (user: UserProfile) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Safe window checks for SSR/SSG compilation
  const isClient = typeof window !== "undefined";
  const storedAccess = isClient ? localStorage.getItem("accessToken") : null;
  const storedRefresh = isClient ? localStorage.getItem("refreshToken") : null;
  const storedUser = isClient ? localStorage.getItem("user") : null;

  return {
    accessToken: storedAccess,
    refreshToken: storedRefresh,
    user: storedUser ? JSON.parse(storedUser) : null,
    setAuth: (access, refresh, user) => {
      if (isClient) {
        localStorage.setItem("accessToken", access);
        localStorage.setItem("refreshToken", refresh);
        localStorage.setItem("user", JSON.stringify(user));
      }
      set({ accessToken: access, refreshToken: refresh, user });
    },
    updateUser: (user) => {
      if (isClient) {
        localStorage.setItem("user", JSON.stringify(user));
      }
      set({ user });
    },
    clearAuth: () => {
      if (isClient) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
      }
      set({ accessToken: null, refreshToken: null, user: null });
    },
  };
});
