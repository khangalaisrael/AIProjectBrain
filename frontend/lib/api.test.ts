import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE_URL, ApiError, apiFetch, streamChat } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

/** A minimal stand-in for the parts of `Response` that `apiFetch` touches. */
function response({ ok = true, status = 200, body = {} as unknown } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

/** The `RequestInit` that `apiFetch` handed to `fetch`. */
function initOf(mock: ReturnType<typeof vi.fn>): RequestInit {
  return mock.mock.calls[0][1] as RequestInit;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ token: null });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiFetch", () => {
  it("prefixes the path with API_BASE_URL", async () => {
    fetchMock.mockResolvedValue(response());
    await apiFetch("/repositories");
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/repositories`, expect.anything());
  });

  it("omits the Authorization header when there is no token", async () => {
    fetchMock.mockResolvedValue(response());
    await apiFetch("/x");
    const headers = initOf(fetchMock).headers as Record<string, string>;
    expect(headers).not.toHaveProperty("Authorization");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends the stored token as a Bearer credential", async () => {
    useAuthStore.setState({ token: "jwt-123" });
    fetchMock.mockResolvedValue(response());
    await apiFetch("/x");
    const headers = initOf(fetchMock).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-123");
  });

  it("lets caller-supplied headers override the defaults", async () => {
    fetchMock.mockResolvedValue(response());
    await apiFetch("/x", { headers: { "Content-Type": "text/plain" } });
    const headers = initOf(fetchMock).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("text/plain");
  });

  it("forwards the rest of the RequestInit", async () => {
    fetchMock.mockResolvedValue(response());
    await apiFetch("/x", { method: "POST", body: '{"a":1}' });
    const init = initOf(fetchMock);
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
  });

  it("returns the parsed JSON body on success", async () => {
    fetchMock.mockResolvedValue(response({ body: { id: 7, name: "brain" } }));
    await expect(apiFetch<{ id: number }>("/x")).resolves.toEqual({ id: 7, name: "brain" });
  });

  it("returns undefined on 204 without reading a body", async () => {
    const res = response({ status: 204 });
    fetchMock.mockResolvedValue(res);
    await expect(apiFetch("/x")).resolves.toBeUndefined();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("throws an ApiError carrying the HTTP status", async () => {
    fetchMock.mockResolvedValue(response({ ok: false, status: 404, body: {} }));
    const error = await apiFetch("/repositories/9").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(404);
  });

  it("uses the backend's `detail` as the error message", async () => {
    fetchMock.mockResolvedValue(
      response({ ok: false, status: 404, body: { detail: "Repository not found" } }),
    );
    await expect(apiFetch("/repositories/9")).rejects.toThrow("Repository not found");
  });

  it("falls back to a generic message when the body has no `detail`", async () => {
    fetchMock.mockResolvedValue(response({ ok: false, status: 500, body: { oops: true } }));
    await expect(apiFetch("/x")).rejects.toThrow("Request to /x failed (500)");
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token <")),
    });
    await expect(apiFetch("/x")).rejects.toThrow("Request to /x failed (502)");
  });

  it("ignores a non-string `detail`", async () => {
    // FastAPI validation errors put an array in `detail`.
    fetchMock.mockResolvedValue(
      response({ ok: false, status: 422, body: { detail: [{ msg: "field required" }] } }),
    );
    await expect(apiFetch("/x")).rejects.toThrow("Request to /x failed (422)");
  });
});

describe("streamChat", () => {
  function sseResponse(...chunks: string[]) {
    const encoder = new TextEncoder();
    return {
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          for (const c of chunks) controller.enqueue(encoder.encode(c));
          controller.close();
        },
      }),
    };
  }

  async function collect(source: AsyncGenerator<unknown>) {
    const out: unknown[] = [];
    for await (const item of source) out.push(item);
    return out;
  }

  it("POSTs the question and yields each event", async () => {
    fetchMock.mockResolvedValue(
      sseResponse('data: {"type":"token","text":"hi"}\n\n', 'data: {"type":"done"}\n\n'),
    );

    const events = await collect(streamChat(3, "why?"));
    expect(events).toEqual([{ type: "token", text: "hi" }, { type: "done" }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/repositories/3/chat/stream`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ question: "why?" });
  });

  it("sends the bearer token", async () => {
    useAuthStore.setState({ token: "jwt-123" });
    fetchMock.mockResolvedValue(sseResponse('data: {"type":"done"}\n\n'));

    await collect(streamChat(1, "q"));
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-123");
  });

  it("throws an ApiError carrying the backend's detail", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({ detail: "Repository not found" }),
    });

    const error = await collect(streamChat(9, "q")).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("Repository not found");
  });

  it("throws when the response carries no body to stream", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, body: null });
    await expect(collect(streamChat(1, "q"))).rejects.toBeInstanceOf(ApiError);
  });
});
