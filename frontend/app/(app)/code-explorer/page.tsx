"use client";

import { useEffect, useMemo, useState } from "react";
import { FileCode2, Loader2, Sparkles } from "lucide-react";

import { useAuth, useExplainFile, useFile, useFiles, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/auth-controls";
import { CodeViewer } from "@/components/explorer/code-viewer";
import { Markdown } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";

export default function CodeExplorerPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: repositories } = useRepositories(isAuthenticated);

  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);

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

  // Reset selection + explanation when switching repository.
  useEffect(() => {
    setFileId(null);
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
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <PageHeader title="Code Explorer" description="Browse files and functions with AI help." />
        <select
          value={repositoryId ?? ""}
          onChange={(e) => setRepositoryId(Number(e.target.value))}
          className="border-border bg-background text-foreground h-9 rounded-md border px-2 text-sm"
        >
          {readyRepos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_1fr_360px]">
        {/* File tree */}
        <div className="border-border min-h-0 overflow-y-auto rounded-lg border">
          <div className="text-muted-foreground border-border bg-background sticky top-0 border-b px-3 py-2 text-xs font-medium">
            Files {files ? `(${files.length})` : ""}
          </div>
          {filesLoading ? (
            <div className="text-muted-foreground p-3 text-sm">Loading…</div>
          ) : (
            <ul className="p-1">
              {(files ?? []).map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => setFileId(f.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      fileId === f.id
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{f.path}</span>
                    {f.function_count > 0 && (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {f.function_count}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Code viewer */}
        <div className="border-border flex min-h-0 flex-col overflow-hidden rounded-lg border">
          {file ? (
            <>
              <div className="border-border bg-background text-muted-foreground border-b px-3 py-2 font-mono text-xs">
                {file.path}
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

        {/* Functions + AI explanation */}
        <div className="border-border flex min-h-0 flex-col overflow-hidden rounded-lg border">
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
        </div>
      </div>
    </div>
  );
}
