"use client";

import { useEffect, useRef } from "react";

import { getProgress, setLessonProgress } from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useProgressStore } from "@/lib/progress-store";

/**
 * Keeps lesson progress on the account. Once per sign-in: upload anything this
 * device completed that the server doesn't know about (older, device-only
 * progress), then adopt the server's copy so every device agrees.
 */
export function ProgressSync() {
  const { isAuthenticated, user } = useAuth();
  const syncedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user || syncedFor.current === user.id) return;
    syncedFor.current = user.id;

    (async () => {
      try {
        const server = await getProgress();
        const known = new Set(Object.values(server.completed).flat());
        const local = Object.values(useProgressStore.getState().done).flat();
        const missing = local.filter((id) => !known.has(id));
        if (missing.length > 0) {
          await Promise.allSettled(missing.map((id) => setLessonProgress(id, true)));
        }
        const fresh = missing.length > 0 ? await getProgress() : server;
        useProgressStore.getState().replaceDone(fresh.completed);
      } catch {
        syncedFor.current = null; // try again next time
      }
    })();
  }, [isAuthenticated, user]);

  return null;
}
