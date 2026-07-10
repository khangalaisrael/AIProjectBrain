"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  FileCode2,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Send,
  User,
  X,
} from "lucide-react";

import { type Citation, askRepository } from "@/lib/api";
import { useAuth, useRepositories } from "@/lib/hooks";
import { PANEL } from "@/lib/panel-size-store";
import { useResizable } from "@/lib/use-resizable";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { Markdown } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";

/** Preset widths the maximize button toggles between. */
const CHAT_DEFAULT_WIDTH = 448;
const CHAT_WIDE_WIDTH = 768;

interface RepoRef {
  fullName: string;
  branch: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  repo?: RepoRef;
}

function citationUrl(repo: RepoRef, c: Citation): string {
  return `https://github.com/${repo.fullName}/blob/${repo.branch}/${c.file_path}#L${c.start_line}-L${c.end_line}`;
}

export function ChatDock() {
  const { isAuthenticated } = useAuth();
  const { data: repositories } = useRepositories(isAuthenticated);

  const [open, setOpen] = useState(false);
  const panel = useResizable({
    id: PANEL.chatDock,
    defaultWidth: CHAT_DEFAULT_WIDTH,
    min: 360,
    max: 1100,
    edge: "left",
  });
  // The maximize button is a shortcut for what dragging the edge already does.
  const expanded = panel.width > (CHAT_DEFAULT_WIDTH + CHAT_WIDE_WIDTH) / 2;
  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const readyRepos = useMemo(
    () => (repositories ?? []).filter((r) => r.status === "ready"),
    [repositories],
  );

  useEffect(() => {
    if (repositoryId === null && readyRepos.length > 0) {
      setRepositoryId(readyRepos[0].id);
    }
  }, [readyRepos, repositoryId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  if (!isAuthenticated) return null;

  async function send() {
    const question = input.trim();
    if (!question || repositoryId === null || pending) return;

    const repo = readyRepos.find((r) => r.id === repositoryId);
    const repoRef: RepoRef | undefined = repo
      ? { fullName: repo.full_name, branch: repo.default_branch }
      : undefined;

    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setPending(true);
    try {
      const res = await askRepository(repositoryId, question);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer, citations: res.citations, repo: repoRef },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI chat"
          className="bg-accent text-accent-foreground fixed right-6 bottom-6 z-40 flex size-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        >
          <MessageSquare className="size-5" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            style={{ width: panel.width }}
            className="border-border bg-background fixed inset-y-0 right-0 z-50 flex max-w-full flex-col border-l shadow-xl"
          >
            {/* Grab the panel's left edge to widen the conversation. */}
            <ResizeHandle
              {...panel.separatorProps}
              isDragging={panel.isDragging}
              className="absolute inset-y-0 -left-1 z-10"
            />

            {/* Header */}
            <div className="border-border flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <Bot className="text-accent size-5" />
                <span className="text-sm font-semibold">Ask the codebase</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => panel.setWidth(expanded ? CHAT_DEFAULT_WIDTH : CHAT_WIDE_WIDTH)}
                  aria-label={expanded ? "Shrink panel" : "Expand panel"}
                >
                  {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Repository selector */}
            <div className="border-border border-b px-4 py-2">
              {readyRepos.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No indexed repositories yet. Import one and wait for it to finish indexing.
                </p>
              ) : (
                <label className="text-muted-foreground flex items-center gap-2 text-xs">
                  Repository
                  <select
                    value={repositoryId ?? ""}
                    onChange={(e) => setRepositoryId(Number(e.target.value))}
                    className="border-border bg-background text-foreground flex-1 rounded-md border px-2 py-1 text-sm"
                  >
                    {readyRepos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-y-auto p-4"
            >
              {messages.length === 0 && (
                <div className="text-muted-foreground mt-10 text-center text-sm">
                  <MessageSquare className="mx-auto mb-2 size-6 opacity-50" />
                  Ask anything about the selected repository — how it works, where a feature lives,
                  why a decision was made.
                </div>
              )}
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
              {pending && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" /> Thinking…
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-border border-t p-3">
              <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
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
                  placeholder={
                    readyRepos.length === 0 ? "Waiting for an indexed repo…" : "Ask a question…"
                  }
                  disabled={readyRepos.length === 0}
                  className="border-border bg-muted/40 placeholder:text-muted-foreground max-h-32 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
                />
                <Button
                  size="icon"
                  onClick={() => void send()}
                  disabled={pending || !input.trim() || repositoryId === null}
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-muted" : "bg-accent/15 text-accent",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn("min-w-0 space-y-2", isUser ? "text-right" : "w-full text-left")}>
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
        {message.citations && message.citations.length > 0 && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">Sources</p>
            {message.citations.map((c, i) => {
              const label = (
                <>
                  <FileCode2 className="size-3 shrink-0" />
                  <span className="truncate">
                    {c.file_path}
                    <span className="opacity-60">
                      {" "}
                      · {c.name} ({c.start_line}-{c.end_line})
                    </span>
                  </span>
                </>
              );
              return message.repo ? (
                <a
                  key={i}
                  href={citationUrl(message.repo, c)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-accent flex items-center gap-1.5 text-xs transition-colors"
                >
                  {label}
                </a>
              ) : (
                <div key={i} className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  {label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
