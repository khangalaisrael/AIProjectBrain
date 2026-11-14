"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProgressState {
  /** Completed lesson ids, keyed by repository id. */
  done: Record<string, number[]>;
  /** Last lesson index the learner was on, keyed by repository id. */
  lastIndex: Record<string, number>;
  /** The repository the learner most recently studied. */
  lastRepoId: number | null;
  setDone: (repoId: number, lessonId: number, done: boolean) => void;
  setLastIndex: (repoId: number, index: number) => void;
  setLastRepo: (repoId: number) => void;
}

/** Learning progress lives on the device: there's no backend field for it yet. */
export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      done: {},
      lastIndex: {},
      lastRepoId: null,
      setDone: (repoId, lessonId, done) =>
        set((s) => {
          const key = String(repoId);
          const current = new Set(s.done[key] ?? []);
          if (done) current.add(lessonId);
          else current.delete(lessonId);
          return { done: { ...s.done, [key]: [...current] } };
        }),
      setLastIndex: (repoId, index) =>
        set((s) => ({ lastIndex: { ...s.lastIndex, [String(repoId)]: index } })),
      setLastRepo: (repoId) => set({ lastRepoId: repoId }),
    }),
    { name: "brain-learn-progress" },
  ),
);
