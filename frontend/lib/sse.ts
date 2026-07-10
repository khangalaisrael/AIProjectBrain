/**
 * Minimal server-sent-events framing.
 *
 * `fetch` hands back arbitrary byte chunks, so an event can be split across two
 * reads and two events can arrive in one. Framing is therefore a separate,
 * pure step: feed it whatever text arrived, get back the complete frames and
 * the leftover to prepend next time.
 */

const FRAME = "\n\n";
const DATA = "data:";

export interface SseSplit {
  /** The `data:` payloads of every frame that is complete. */
  frames: string[];
  /** Bytes belonging to a frame that has not finished arriving. */
  rest: string;
}

/**
 * Split a buffer into complete SSE frames.
 *
 * Non-`data:` lines (comments, `event:`, `id:`) are ignored — this backend only
 * sends `data:`. A frame with several `data:` lines is joined with newlines, as
 * the spec requires.
 */
export function splitSseFrames(buffer: string): SseSplit {
  const parts = buffer.split(FRAME);
  // The final part is whatever came after the last frame terminator.
  const rest = parts.pop() ?? "";

  const frames: string[] = [];
  for (const part of parts) {
    const data = part
      .split("\n")
      .filter((line) => line.startsWith(DATA))
      .map((line) => line.slice(DATA.length).trimStart())
      .join("\n");
    if (data) frames.push(data);
  }

  return { frames, rest };
}

/**
 * Decode a `ReadableStream` of SSE bytes into parsed `data:` payloads.
 *
 * Yields one value per frame. Malformed JSON is skipped rather than thrown —
 * a single bad frame should not abandon a half-written answer.
 */
export async function* readSseStream<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = splitSseFrames(buffer);
      buffer = rest;

      for (const frame of frames) {
        try {
          yield JSON.parse(frame) as T;
        } catch {
          // Not JSON — ignore the frame and keep reading.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
