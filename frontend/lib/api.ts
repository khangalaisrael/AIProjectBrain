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

/**
 * The reason a request failed, preferring FastAPI's `{"detail": "..."}` body.
 *
 * Validation errors put a list in `detail`, and a proxy may return HTML, so
 * anything that isn't a plain string falls back to the status line.
 */
async function errorMessage(response: Response, path: string): Promise<string> {
  const fallback = `Request to ${path} failed (${response.status})`;
  try {
    const body = await response.json();
    return typeof body?.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
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
    throw new ApiError(response.status, await errorMessage(response, path));
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
  stars: number;
}

// ---- Endpoints ----

export const getCurrentUser = () => apiFetch<AuthUser>("/auth/me");

export const getRepositories = () => apiFetch<Repository[]>("/repositories");

export const getGitHubRepositories = () => apiFetch<GitHubRepo[]>("/repositories/github");

/** Search any public repository on GitHub. */
export const searchGitHubRepositories = (query: string) =>
  apiFetch<GitHubRepo[]>(`/repositories/search?q=${encodeURIComponent(query)}`);

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

export interface FolderMapItem {
  folder: string;
  file_count: number;
}

export interface Overview {
  summary: string;
  difficulty: string | null;
  learning_time_minutes: number | null;
  architecture_style: string | null;
  technologies: string[];
  features: string[];
  folder_map: FolderMapItem[];
}

export const getOverview = (repositoryId: number) =>
  apiFetch<Overview>(`/repositories/${repositoryId}/overview`);

export const generateOverview = (repositoryId: number) =>
  apiFetch<Overview>(`/repositories/${repositoryId}/overview`, { method: "POST" });

export interface Lesson {
  id: number;
  order_index: number;
  title: string;
  content: string;
}

export const getLessons = (repositoryId: number) =>
  apiFetch<Lesson[]>(`/repositories/${repositoryId}/lessons`);

export const generateCourse = (repositoryId: number) =>
  apiFetch<Lesson[]>(`/repositories/${repositoryId}/lessons`, { method: "POST" });

export interface Decision {
  id: number;
  order_index: number;
  decision: string;
  reason: string;
  tradeoffs: string;
  alternatives: string;
}

export const getDecisions = (repositoryId: number) =>
  apiFetch<Decision[]>(`/repositories/${repositoryId}/decisions`);

export const generateDecisions = (repositoryId: number) =>
  apiFetch<Decision[]>(`/repositories/${repositoryId}/decisions`, { method: "POST" });

export type DocType = "readme" | "api" | "architecture" | "folders";

export interface Document {
  id: number;
  doc_type: DocType;
  title: string;
  content: string;
}

// ---- Software Atlas (knowledge graph) ----

export type GraphNodeKind =
  "repository" | "system" | "folder" | "file" | "class" | "function" | "external";

export type GraphEdgeKind = "imports" | "calls" | "extends" | "implements" | "contains";

export interface GraphNode {
  key: string;
  kind: GraphNodeKind;
  level: number;
  name: string;
  path: string | null;
  parent_key: string | null;
  meta: {
    file_id?: number | null;
    start_line?: number;
    end_line?: number;
    signature?: string | null;
    bucket?: string;
  };
}

export interface GraphEdge {
  source_key: string;
  target_key: string;
  kind: GraphEdgeKind;
  weight: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Whole-repo view down to a zoom level, with deeper edges rolled up. */
export const getGraph = (repositoryId: number, maxLevel: number) =>
  apiFetch<Graph>(`/repositories/${repositoryId}/graph?max_level=${maxLevel}`);

/** Direct children of a node — the drill-in primitive the Atlas navigates with. */
export const getGraphChildren = (repositoryId: number, key: string) =>
  apiFetch<Graph>(`/repositories/${repositoryId}/graph/children?key=${encodeURIComponent(key)}`);

export const getGraphNode = (repositoryId: number, key: string) =>
  apiFetch<GraphNode>(`/repositories/${repositoryId}/graph/node?key=${encodeURIComponent(key)}`);

// ---- Request Flow (animated replay) ----

export interface FlowEntry {
  key: string;
  name: string;
  path: string | null;
}

export interface FlowStep {
  key: string;
  name: string;
  path: string | null;
  file_id: number | null;
  start_line: number | null;
  end_line: number | null;
  depth: number;
  caller_key: string | null;
}

export interface Flow {
  entry_key: string;
  steps: FlowStep[];
  edges: { source_key: string; target_key: string }[];
}

export interface FlowExplanation {
  summary: string;
  steps: { key: string; explanation: string }[];
}

/** Request entry points: public route handlers nothing else calls. */
export const getFlows = (repositoryId: number) =>
  apiFetch<FlowEntry[]>(`/repositories/${repositoryId}/flows`);

export const getFlowPath = (repositoryId: number, key: string) =>
  apiFetch<Flow>(`/repositories/${repositoryId}/flows/path?key=${encodeURIComponent(key)}`);

export const explainFlow = (repositoryId: number, key: string) =>
  apiFetch<FlowExplanation>(
    `/repositories/${repositoryId}/flows/explain?key=${encodeURIComponent(key)}`,
    { method: "POST" },
  );

export const getDocuments = (repositoryId: number) =>
  apiFetch<Document[]>(`/repositories/${repositoryId}/docs`);

export const generateDocument = (repositoryId: number, docType: DocType) =>
  apiFetch<Document>(`/repositories/${repositoryId}/docs/${docType}`, { method: "POST" });
