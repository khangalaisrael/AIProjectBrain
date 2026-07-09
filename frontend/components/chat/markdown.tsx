"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import "highlight.js/styles/github-dark.css";

/**
 * Renders assistant answers as GitHub-flavored markdown with syntax-highlighted
 * code blocks. Element styles are supplied inline so we don't depend on a
 * typography plugin.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="mt-3 mb-2 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 mb-2 text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>,
          ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code className="bg-background/60 rounded px-1 py-0.5 font-mono text-[0.8em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="border-border bg-background/60 mb-3 overflow-x-auto rounded-md border p-3 text-xs">
              {children}
            </pre>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
