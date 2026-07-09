"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { type DocType } from "@/lib/api";
import { useAuth, useDocuments, useGenerateDocument, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/auth-controls";
import { Markdown } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";

const TABS: { type: DocType; label: string }[] = [
  { type: "readme", label: "README" },
  { type: "api", label: "API" },
  { type: "architecture", label: "Architecture" },
  { type: "folders", label: "Folders" },
];

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DocumentationPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: repositories } = useRepositories(isAuthenticated);
  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DocType>("readme");
  const [copied, setCopied] = useState(false);

  const readyRepos = useMemo(
    () => (repositories ?? []).filter((r) => r.status === "ready"),
    [repositories],
  );

  useEffect(() => {
    if (repositoryId === null && readyRepos.length > 0) setRepositoryId(readyRepos[0].id);
  }, [readyRepos, repositoryId]);

  const docs = useDocuments(repositoryId);
  const generate = useGenerateDocument();

  const active = useMemo(
    () => (docs.data ?? []).find((d) => d.doc_type === activeTab),
    [docs.data, activeTab],
  );

  useEffect(() => setCopied(false), [activeTab, repositoryId]);

  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader title="Documentation" description="Generated docs for the project." />
        <EmptyState
          icon={FileText}
          title="Sign in to generate docs"
          description="Connect GitHub and import a repository to generate its documentation."
          action={<SignInButton />}
        />
      </>
    );
  }

  if (readyRepos.length === 0) {
    return (
      <>
        <PageHeader title="Documentation" description="Generated docs for the project." />
        <EmptyState
          icon={FileText}
          title="No indexed repositories"
          description="Import a repository and wait for indexing to finish to generate docs."
        />
      </>
    );
  }

  const isGenerating = generate.isPending && generate.variables?.docType === activeTab;

  async function copy() {
    if (!active) return;
    await navigator.clipboard.writeText(active.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <PageHeader title="Documentation" description="Generated docs for the project." />
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

      {/* Tabs + actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="border-border inline-flex rounded-md border p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.type
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {active && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadMarkdown(`${active.doc_type}.md`, active.content)}
            >
              <Download className="size-4" /> Download .md
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                repositoryId !== null && generate.mutate({ repositoryId, docType: activeTab })
              }
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Regenerate
            </Button>
          </div>
        )}
      </div>

      {docs.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : active ? (
        <article className="border-border rounded-lg border p-6">
          <Markdown>{active.content}</Markdown>
        </article>
      ) : (
        <EmptyState
          icon={Sparkles}
          title={`No ${TABS.find((t) => t.type === activeTab)?.label} yet`}
          description="Generate this document from the indexed codebase."
          action={
            <Button
              onClick={() =>
                repositoryId !== null && generate.mutate({ repositoryId, docType: activeTab })
              }
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Generate
                </>
              )}
            </Button>
          }
        />
      )}
    </>
  );
}
