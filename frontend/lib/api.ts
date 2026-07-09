/**
 * Typed fetch client for the backend API.
 *
 * Attaches the stored JWT as a Bearer token and exposes the Phase 1 endpoints
 * (auth, repositories) used by the UI.
 */

import { getToken } from "@/lib/auth-store";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

/** Full URL the browser navigates to in order to start GitHub OAuth. */
export const GITHUB_LOGIN_URL = `${API_BASE_URL}/auth/github/login`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Request to ${path} failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// ---- Types (mirror backend Pydantic schemas) ----

export type ImportStatus = "pending" | "cloning" | "parsing" | "indexing" | "ready" | "failed";

export interface AuthUser {
  id: number;
  github_id: number;
  username: string;
  email: string | null;
  avatar_url: string | null;
}

export interface Repository {
  id: number;
  github_id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  is_private: boolean;
  default_branch: string;
  status: ImportStatus;
  error_message: string | null;
}

export interface GitHubRepo {
  github_id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  private: boolean;
  default_branch: string;
}

// ---- Endpoints ----

export const getCurrentUser = () => apiFetch<AuthUser>("/auth/me");

export const getRepositories = () => apiFetch<Repository[]>("/repositories");

export const getGitHubRepositories = () => apiFetch<GitHubRepo[]>("/repositories/github");

export const importRepository = (fullName: string) =>
  apiFetch<Repository>("/repositories", {
    method: "POST",
    body: JSON.stringify({ full_name: fullName }),
  });

export interface Citation {
  file_path: string;
  name: string;
  start_line: number;
  end_line: number;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export const askRepository = (repositoryId: number, question: string) =>
  apiFetch<ChatResponse>(`/repositories/${repositoryId}/chat`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });

export interface FileTreeItem {
  id: number;
  path: string;
  language: string | null;
  function_count: number;
}

export interface FunctionItem {
  id: number;
  name: string;
  signature: string | null;
  start_line: number;
  end_line: number;
}

export interface FileDetail {
  id: number;
  path: string;
  language: string | null;
  content: string;
  functions: FunctionItem[];
}

export const getFiles = (repositoryId: number) =>
  apiFetch<FileTreeItem[]>(`/repositories/${repositoryId}/files`);

export const getFile = (repositoryId: number, fileId: number) =>
  apiFetch<FileDetail>(`/repositories/${repositoryId}/files/${fileId}`);

export const explainFile = (repositoryId: number, fileId: number) =>
  apiFetch<{ explanation: string }>(`/repositories/${repositoryId}/files/${fileId}/explain`, {
    method: "POST",
  });
