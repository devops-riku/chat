import { create } from "zustand";
import { api, ApiError, type User } from "@/lib/api";
import { disconnectSocket, getSocket } from "@/lib/socket";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchMe: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    display_name: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  fetchMe: async () => {
    try {
      const user = await api.get<User>("/auth/me");
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ user: null, isAuthenticated: false, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  login: async (identifier, password) => {
    const user = await api.post<User>("/auth/login", { identifier, password });
    set({ user, isAuthenticated: true, isLoading: false });
  },

  register: async (data) => {
    await api.post<User>("/auth/register", data);
    await useAuthStore.getState().login(data.email, data.password);
  },

  logout: async () => {
    const s = getSocket();
    if (s.connected) {
      s.emit("going_offline", {});
    }
    disconnectSocket();
    await api.post("/auth/logout");
    set({ user: null, isAuthenticated: false });
  },
}));
