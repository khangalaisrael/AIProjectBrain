import { describe, expect, it } from "vitest";

import { readSseStream, splitSseFrames } from "@/lib/sse";

/** A ReadableStream that emits the given strings as separate chunks. */
function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect<T>(source: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of source) out.push(item);
  return out;
}

describe("splitSseFrames", () => {
  it("returns nothing for an empty buffer", () => {
    expect(splitSseFrames("")).toEqual({ frames: [], rest: "" });
  });

  it("extracts a single complete frame", () => {
    expect(splitSseFrames('data: {"a":1}\n\n')).toEqual({ frames: ['{"a":1}'], rest: "" });
  });

  it("extracts several frames from one buffer", () => {
    const { frames } = splitSseFrames("data: one\n\ndata: two\n\n");
    expect(frames).toEqual(["one", "two"]);
  });

  it("holds back a frame that has not finished arriving", () => {
    const { frames, rest } = splitSseFrames("data: done\n\ndata: partia");
    expect(frames).toEqual(["done"]);
    expect(rest).toBe("data: partia");
  });

  it("ignores lines that are not data", () => {
    const { frames } = splitSseFrames(": keep-alive\nevent: ping\ndata: real\n\n");
    expect(frames).toEqual(["real"]);
  });

  it("joins multiple data lines in one frame with newlines", () => {
    expect(splitSseFrames("data: a\ndata: b\n\n").frames).toEqual(["a\nb"]);
  });

  it("tolerates no space after the colon", () => {
    expect(splitSseFrames("data:tight\n\n").frames).toEqual(["tight"]);
  });

  it("skips a frame with no data lines", () => {
    expect(splitSseFrames(": comment only\n\n").frames).toEqual([]);
  });
});

describe("readSseStream", () => {
  it("yields each frame's parsed JSON", async () => {
    const stream = streamOf('data: {"type":"token","text":"a"}\n\ndata: {"type":"done"}\n\n');
    await expect(collect(readSseStream(stream))).resolves.toEqual([
      { type: "token", text: "a" },
      { type: "done" },
    ]);
  });

  it("reassembles a frame split across two chunks", async () => {
    // The hazard this module exists for: fetch splits bytes wherever it likes.
    const stream = streamOf('data: {"type":"tok', 'en","text":"hi"}\n\n');
    await expect(collect(readSseStream(stream))).resolves.toEqual([{ type: "token", text: "hi" }]);
  });

  it("handles two frames arriving in one chunk", async () => {
    const stream = streamOf('data: {"n":1}\n\ndata: {"n":2}\n\n');
    await expect(collect(readSseStream(stream))).resolves.toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("splits a frame boundary that lands between the two newlines", async () => {
    const stream = streamOf('data: {"n":1}\n', '\ndata: {"n":2}\n\n');
    await expect(collect(readSseStream(stream))).resolves.toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("skips a malformed frame and keeps reading", async () => {
    const stream = streamOf("data: not json\n\n", 'data: {"ok":true}\n\n');
    await expect(collect(readSseStream(stream))).resolves.toEqual([{ ok: true }]);
  });

  it("drops a trailing frame that never terminated", async () => {
    const stream = streamOf('data: {"ok":true}\n\ndata: {"truncated":');
    await expect(collect(readSseStream(stream))).resolves.toEqual([{ ok: true }]);
  });

  it("yields nothing for an empty stream", async () => {
    await expect(collect(readSseStream(streamOf()))).resolves.toEqual([]);
  });

  it("decodes a multi-byte character split across chunks", async () => {
    // "é" is two bytes; cut between them.
    const encoder = new TextEncoder();
    const bytes = encoder.encode('data: {"t":"é"}\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 12));
        controller.enqueue(bytes.slice(12));
        controller.close();
      },
    });
    await expect(collect(readSseStream(stream))).resolves.toEqual([{ t: "é" }]);
  });
});
