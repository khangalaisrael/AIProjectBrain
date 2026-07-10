"use client";

import { useMemo } from "react";
import hljs from "highlight.js/lib/common";

import "highlight.js/styles/github-dark.css";

const LANG_MAP: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
};

/** Read-only syntax-highlighted source viewer with a line-number gutter. */
export function CodeViewer({
  content,
  language,
  startLine = 1,
}: {
  content: string;
  language: string | null;
  /** Line number of the first row — set when showing a slice of a file. */
  startLine?: number;
}) {
  const html = useMemo(() => {
    const lang = language ? LANG_MAP[language] : undefined;
    try {
      return lang && hljs.getLanguage(lang)
        ? hljs.highlight(content, { language: lang }).value
        : hljs.highlightAuto(content).value;
    } catch {
      return content;
    }
  }, [content, language]);

  const lineCount = content.split("\n").length;

  return (
    <div className="flex overflow-auto text-xs leading-relaxed">
      <pre className="text-muted-foreground/50 px-3 py-3 text-right font-mono select-none">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{startLine + i}</div>
        ))}
      </pre>
      <pre className="hljs flex-1 !bg-transparent py-3 pr-4 font-mono">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
