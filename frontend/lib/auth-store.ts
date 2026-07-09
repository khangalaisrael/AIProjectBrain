"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: number;
  github_id: number;
  username: string;
  email: string | null;
  avatar_url: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True once the persisted store has rehydrated from localStorage. */
  hydrated: boolean;
  setToken: (token: string) => void;
  setUser: (user: AuthUser | null) => void;
  setHydrated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      setHydrated: () => set({ hydrated: true }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "brain-auth",
      // Only the token is persisted; the user profile is re-fetched from /auth/me.
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

/** Read the current token outside React (used by the fetch client). */
export function getToken(): string | null {
  return useAuthStore.getState().token;
}
