"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type DocType,
  explainFile,
  explainFlow,
  generateCourse,
  generateDecisions,
  generateDocument,
  generateOverview,
  getCurrentUser,
  getDecisions,
  getDocuments,
  getFile,
  getFiles,
  getFlowPath,
  getFlows,
  getGitHubRepositories,
  getGraph,
  getGraphChildren,
  getLessons,
  getOverview,
  getRepositories,
  importRepository,
  searchGitHubRepositories,
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

/** Search public GitHub repositories. Pass an already-debounced query. */
export function useSearchGitHubRepositories(query: string) {
  return useQuery({
    queryKey: ["github-search", query],
    queryFn: () => searchGitHubRepositories(query),
    enabled: query.trim().length > 0,
    staleTime: 60_000,
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

export function useFiles(repositoryId: number | null) {
  return useQuery({
    queryKey: ["files", repositoryId],
    queryFn: () => getFiles(repositoryId as number),
    enabled: repositoryId !== null,
  });
}

export function useFile(repositoryId: number | null, fileId: number | null) {
  return useQuery({
    queryKey: ["file", repositoryId, fileId],
    queryFn: () => getFile(repositoryId as number, fileId as number),
    enabled: repositoryId !== null && fileId !== null,
  });
}

export function useExplainFile() {
  return useMutation({
    mutationFn: ({ repositoryId, fileId }: { repositoryId: number; fileId: number }) =>
      explainFile(repositoryId, fileId),
  });
}

export function useOverview(repositoryId: number | null) {
  return useQuery({
    queryKey: ["overview", repositoryId],
    queryFn: () => getOverview(repositoryId as number),
    enabled: repositoryId !== null,
    retry: false, // a 404 means "not generated yet", not a transient failure
  });
}

export function useGenerateOverview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: number) => generateOverview(repositoryId),
    onSuccess: (data, repositoryId) => {
      queryClient.setQueryData(["overview", repositoryId], data);
    },
  });
}

export function useLessons(repositoryId: number | null) {
  return useQuery({
    queryKey: ["lessons", repositoryId],
    queryFn: () => getLessons(repositoryId as number),
    enabled: repositoryId !== null,
  });
}

export function useGenerateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: number) => generateCourse(repositoryId),
    onSuccess: (data, repositoryId) => {
      queryClient.setQueryData(["lessons", repositoryId], data);
    },
  });
}

export function useDecisions(repositoryId: number | null) {
  return useQuery({
    queryKey: ["decisions", repositoryId],
    queryFn: () => getDecisions(repositoryId as number),
    enabled: repositoryId !== null,
  });
}

export function useGenerateDecisions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: number) => generateDecisions(repositoryId),
    onSuccess: (data, repositoryId) => {
      queryClient.setQueryData(["decisions", repositoryId], data);
    },
  });
}

/** Whole-repo graph down to a level (used to seed search). */
export function useGraph(repositoryId: number | null, maxLevel: number) {
  return useQuery({
    queryKey: ["graph", repositoryId, maxLevel],
    queryFn: () => getGraph(repositoryId as number, maxLevel),
    enabled: repositoryId !== null,
    staleTime: 5 * 60_000,
  });
}

/** Children of the currently scoped node — what the Atlas canvas renders. */
export function useGraphChildren(repositoryId: number | null, key: string | null) {
  return useQuery({
    queryKey: ["graph-children", repositoryId, key],
    queryFn: () => getGraphChildren(repositoryId as number, key as string),
    enabled: repositoryId !== null && key !== null,
    staleTime: 5 * 60_000,
  });
}

/** Request entry points for the Atlas "Request Flow" mode. */
export function useFlows(repositoryId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["flows", repositoryId],
    queryFn: () => getFlows(repositoryId as number),
    enabled: repositoryId !== null && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useFlowPath(repositoryId: number | null, key: string | null) {
  return useQuery({
    queryKey: ["flow-path", repositoryId, key],
    queryFn: () => getFlowPath(repositoryId as number, key as string),
    enabled: repositoryId !== null && key !== null,
    staleTime: 5 * 60_000,
  });
}

export function useExplainFlow() {
  return useMutation({
    mutationFn: ({ repositoryId, key }: { repositoryId: number; key: string }) =>
      explainFlow(repositoryId, key),
  });
}

export function useDocuments(repositoryId: number | null) {
  return useQuery({
    queryKey: ["docs", repositoryId],
    queryFn: () => getDocuments(repositoryId as number),
    enabled: repositoryId !== null,
  });
}

export function useGenerateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repositoryId, docType }: { repositoryId: number; docType: DocType }) =>
      generateDocument(repositoryId, docType),
    onSuccess: (_data, { repositoryId }) => {
      queryClient.invalidateQueries({ queryKey: ["docs", repositoryId] });
    },
  });
}
