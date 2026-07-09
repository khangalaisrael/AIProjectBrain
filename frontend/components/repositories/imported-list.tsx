"use client";

import { FolderGit2, Lock } from "lucide-react";

import { type Repository } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/repositories/status-badge";

export function ImportedList({ repositories }: { repositories: Repository[] }) {
  return (
    <div className="grid gap-3">
      {repositories.map((repo) => (
        <Card key={repo.id} className="flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <FolderGit2 className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{repo.full_name}</span>
                {repo.is_private && <Lock className="text-muted-foreground size-3.5" />}
              </div>
              {repo.description && (
                <p className="text-muted-foreground truncate text-sm">{repo.description}</p>
              )}
              {repo.status === "failed" && repo.error_message && (
                <p className="mt-1 truncate text-xs text-red-500">{repo.error_message}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {repo.language && (
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {repo.language}
              </span>
            )}
            <StatusBadge status={repo.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}
