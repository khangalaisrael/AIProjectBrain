/**
 * Minimal typed fetch client for the backend API.
 *
 * Feature-specific calls (auth, repositories, chat, …) build on `apiFetch` as
 * they are implemented. No endpoints beyond `health` exist yet.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Request to ${path} failed (${response.status})`);
  }

  return (await response.json()) as T;
}

/** Backend liveness check. */
export function getHealth() {
  return apiFetch<{ status: string }>("/health");
}
