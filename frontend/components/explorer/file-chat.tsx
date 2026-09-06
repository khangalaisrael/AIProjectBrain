"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Send, Trash2, User } from "lucide-react";

import { clearFileChatMessages, streamFileQuestion } from "@/lib/api";
import { useFileChatMessages } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * A conversation scoped to the file currently open in the Code Explorer.
 *
 * The thread is stored server-side per (user, file), so switching files swaps
 * the conversation and a reload resumes it. The prompt context is the whole
 * file, so questions work even for files with no parsed functions.
 */
export function FileChat({ repositoryId, fileId }: { repositoryId: number; fileId: number }) {
  const queryClient = useQueryClient();
  const { data: saved } = useFileChatMessages(repositoryId, fileId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed from the saved thread whenever it loads or the file changes — but not
  // mid-stream, when the local optimistic messages are ahead of the server.
  useEffect(() => {
    if (pending) return;
    setMessages((saved ?? []).map((m) => ({ role: m.role, content: m.content })));
  }, [saved, fileId, pending]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function clearThread() {
    if (pending) return;
    setMessages([]);
    try {
      await clearFileChatMessages(repositoryId, fileId);
    } catch {
      // Already gone from view; a failed delete resurfaces on reload.
    }
    queryClient.invalidateQueries({ queryKey: ["file-chat", repositoryId, fileId] });
  }

  async function send() {
    const question = input.trim();
    if (!question || pending) return;

    setMessages((m) => [
      ...m,
      { role: "user", content: question },
      // The assistant bubble is created empty and filled by the stream.
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setPending(true);

    const updateAnswer = (apply: (current: Message) => Message) =>
      setMessages((m) => [...m.slice(0, -1), apply(m[m.length - 1])]);

    try {
      let streamed = false;
      for await (const event of streamFileQuestion(repositoryId, fileId, question)) {
        if (event.type === "token") {
          streamed = true;
          updateAnswer((current) => ({ ...current, content: current.content + event.text }));
        } else if (event.type === "error") {
          updateAnswer((current) => ({
            ...current,
            content: current.content || "Something went wrong. Please try again.",
          }));
        }
      }
      if (!streamed) {
        updateAnswer((current) => ({
          ...current,
          content: current.content || "The answer came back empty. Please try again.",
        }));
      }
    } catch {
      updateAnswer((current) => ({
        ...current,
        content: current.content || "Something went wrong. Please try again.",
      }));
    } finally {
      setPending(false);
      queryClient.invalidateQueries({ queryKey: ["file-chat", repositoryId, fileId] });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="text-muted-foreground flex items-center justify-between px-1 pb-2 text-xs font-medium">
        <span>Ask about this file</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => void clearThread()}
          disabled={pending || messages.length === 0}
          aria-label="Clear conversation"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Ask anything about this file — what it does, how a function works, why it&apos;s
            written this way.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {pending && !messages[messages.length - 1]?.content && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Ask a question…"
          className="border-border bg-muted/40 placeholder:text-muted-foreground max-h-32 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none"
        />
        <Button
          size="icon"
          onClick={() => void send()}
          disabled={pending || !input.trim()}
          aria-label="Send"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-muted" : "bg-accent/15 text-accent",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div className={cn("min-w-0", isUser ? "text-right" : "w-full text-left")}>
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 text-sm",
            isUser
              ? "bg-accent text-accent-foreground whitespace-pre-wrap"
              : "bg-muted text-foreground w-full",
          )}
        >
          {isUser ? message.content : <Markdown>{message.content}</Markdown>}
        </div>
      </div>
    </div>
  );
}
