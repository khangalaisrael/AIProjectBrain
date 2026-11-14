"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  FileCode2,
  FolderTree,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { useAuth, useExplainFile, useFile, useFiles, useRepositories } from "@/lib/hooks";
import { PANEL } from "@/lib/panel-size-store";
import { useResizable } from "@/lib/use-resizable";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { SignInButton } from "@/components/auth/auth-controls";
import dynamic from "next/dynamic";

// Syntax highlighting and chat only matter once a file is open.
const CodeViewer = dynamic(
  () => import("@/components/explorer/code-viewer").then((m) => m.CodeViewer),
  { ssr: false, loading: () => <Skeleton className="m-3 h-40" /> },
);
const FileChat = dynamic(() => import("@/components/explorer/file-chat").then((m) => m.FileChat), {
  ssr: false,
});
import { FileTree } from "@/components/explorer/file-tree";
import { Markdown } from "@/components/chat/markdown";

export default function CodeExplorerPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: repositories } = useRepositories(isAuthenticated);

  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);
  const [asideMode, setAsideMode] = useState<"explain" | "ask">("explain");
  // On phones only one pane shows at a time.
  const [mobileTab, setMobileTab] = useState<"files" | "code" | "ai">("files");

  const readyRepos = useMemo(
    () => (repositories ?? []).filter((r) => r.status === "ready"),
    [repositories],
  );

  useEffect(() => {
    if (repositoryId === null && readyRepos.length > 0) setRepositoryId(readyRepos[0].id);
  }, [readyRepos, repositoryId]);

  const { data: files, isLoading: filesLoading } = useFiles(repositoryId);
  const { data: file, isLoading: fileLoading } = useFile(repositoryId, fileId);
  const explain = useExplainFile();

  const tree = useResizable({ id: PANEL.explorerTree, defaultWidth: 260, min: 180, max: 520 });
  const aside = useResizable({
    id: PANEL.explorerAside,
    defaultWidth: 360,
    min: 260,
    max: 640,
    edge: "left",
  });

  // Reset selection + explanation when switching repository.
  useEffect(() => {
    setFileId(null);
    setMobileTab("files");
    setAsideMode("explain");
    explain.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryId]);

  useEffect(() => {
    explain.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader title="Code Explorer" description="Browse files and functions with AI help." />
        <EmptyState
          icon={FileCode2}
          title="Sign in to explore code"
          description="Connect GitHub and import a repository to browse its files and functions."
          action={<SignInButton />}
        />
      </>
    );
  }

  if (readyRepos.length === 0) {
    return (
      <>
        <PageHeader title="Code Explorer" description="Browse files and functions with AI help." />
        <EmptyState
          icon={FileCode2}
          title="No indexed repositories"
          description="Import a repository and wait for indexing to finish, then explore it here."
        />
      </>
    );
  }

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-8rem)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <PageHeader title="Code Explorer" description="Browse files and functions with AI help." />
        <select
          value={repositoryId ?? ""}
          onChange={(e) => setRepositoryId(Number(e.target.value))}
          className="border-border bg-background text-foreground h-9 max-w-full min-w-0 rounded-md border px-2 text-sm"
        >
          {readyRepos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Phone tabs: Files / Code / AI */}
      <div className="border-border bg-muted/30 mb-3 grid grid-cols-3 gap-1 rounded-lg border p-1 lg:hidden">
        {(
          [
            { id: "files", label: "Files", icon: FolderTree },
            { id: "code", label: "Code", icon: FileCode2 },
            { id: "ai", label: "AI", icon: Sparkles },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors",
              mobileTab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-0">
        {/* File tree */}
        <div
          style={{ "--panel-w": `${tree.width}px` } as React.CSSProperties}
          className={cn(
            "border-border h-[65dvh] min-h-0 w-full shrink-0 overflow-y-auto rounded-lg border lg:block lg:h-auto lg:w-[var(--panel-w)]",
            mobileTab !== "files" && "hidden",
          )}
        >
          <div className="text-muted-foreground border-border bg-background sticky top-0 border-b px-3 py-2 text-xs font-medium">
            Files {files ? `(${files.length})` : ""}
          </div>
          {filesLoading ? (
            <div className="space-y-2 p-3">
              {[70, 55, 80, 45, 65, 50].map((w, i) => (
                <Skeleton key={i} className="h-5" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <FileTree
              files={files ?? []}
              selectedId={fileId}
              onSelect={(id) => {
                setFileId(id);
                setMobileTab("code");
              }}
            />
          )}
        </div>

        <ResizeHandle
          {...tree.separatorProps}
          isDragging={tree.isDragging}
          className="hidden lg:block"
        />

        {/* Code viewer */}
        <div
          className={cn(
            "border-border h-[65dvh] min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border lg:flex lg:h-auto lg:flex-1",
            mobileTab === "code" ? "flex" : "hidden",
          )}
        >
          {file ? (
            <>
              <div className="border-border bg-background text-muted-foreground flex flex-wrap items-center gap-0.5 border-b px-3 py-2 font-mono text-xs">
                {file.path.split("/").map((part, i, all) => (
                  <span key={i} className="flex items-center gap-0.5">
                    {i > 0 && <ChevronRight className="size-3 opacity-50" />}
                    <span className={i === all.length - 1 ? "text-foreground font-medium" : ""}>
                      {part}
                    </span>
                  </span>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <CodeViewer content={file.content} language={file.language} />
              </div>
            </>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm">
              {fileLoading ? "Loading file…" : "Select a file to view its source."}
            </div>
          )}
        </div>

        <ResizeHandle
          {...aside.separatorProps}
          isDragging={aside.isDragging}
          className="hidden lg:block"
        />

        {/* Functions + AI explanation */}
        <div
          style={{ "--panel-w": `${aside.width}px` } as React.CSSProperties}
          className={cn(
            "border-border h-[65dvh] min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-lg border lg:flex lg:h-auto lg:w-[var(--panel-w)]",
            mobileTab === "ai" ? "flex" : "hidden",
          )}
        >
          <div className="border-border flex shrink-0 items-center gap-1 border-b p-2">
            {(["explain", "ask"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAsideMode(mode)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  asideMode === mode
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "explain" ? (
                  <Sparkles className="size-3.5" />
                ) : (
                  <MessageSquare className="size-3.5" />
                )}
                {mode === "explain" ? "Explanation" : "Ask"}
              </button>
            ))}
          </div>

          {asideMode === "explain" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {file && file.functions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                      Functions ({file.functions.length})
                    </p>
                    <ul className="space-y-1">
                      {file.functions.map((fn) => (
                        <li key={fn.id} className="text-sm">
                          <span className="font-mono">{fn.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            · {fn.start_line}-{fn.end_line}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {explain.data ? (
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium">AI explanation</p>
                    <Markdown>{explain.data.explanation}</Markdown>
                  </div>
                ) : file ? (
                  <div className="text-muted-foreground text-sm">
                    Get an AI-generated explanation of this file.
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Select a file to see its functions and request an explanation.
                  </div>
                )}
              </div>

              {file && (
                <div className="border-border border-t p-3">
                  <Button
                    className="w-full"
                    onClick={() =>
                      repositoryId !== null && explain.mutate({ repositoryId, fileId: file.id })
                    }
                    disabled={explain.isPending}
                  >
                    {explain.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Explain this file
                  </Button>
                </div>
              )}
            </>
          ) : file && repositoryId !== null ? (
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <FileChat repositoryId={repositoryId} fileId={file.id} />
            </div>
          ) : (
            <div className="text-muted-foreground p-3 text-sm">
              Select a file to ask questions about it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
