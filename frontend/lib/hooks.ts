"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCurrentUser,
  getGitHubRepositories,
  getRepositories,
  importRepository,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

/** Auth state + helpers derived from the persisted store and /auth/me. */
export function useAuth() {
  const { token, user, hydrated, setUser, logout } = useAuthStore();

  const query = useQuery({
    queryKey: ["me", token],
    queryFn: getCurrentUser,
    enabled: hydrated && Boolean(token),
    retry: false,
  });

  // Sync the fetched profile into the store; clear auth on 401.
  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  useEffect(() => {
    if (query.isError) logout();
  }, [query.isError, logout]);

  return {
    token,
    user: user ?? query.data ?? null,
    isAuthenticated: hydrated && Boolean(token) && !query.isError,
    isLoading: !hydrated || (Boolean(token) && query.isLoading),
    logout,
  };
}

const PROCESSING: ReadonlySet<string> = new Set(["pending", "cloning", "parsing", "indexing"]);

export function useRepositories(enabled = true) {
  return useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    enabled,
    // Poll while any repository is still being indexed so status badges update.
    refetchInterval: (query) =>
      query.state.data?.some((r) => PROCESSING.has(r.status)) ? 3000 : false,
  });
}

export function useGitHubRepositories(enabled: boolean) {
  return useQuery({
    queryKey: ["github-repositories"],
    queryFn: getGitHubRepositories,
    enabled,
  });
}

export function useImportRepository() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fullName: string) => importRepository(fullName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}
