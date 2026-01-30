"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  children: string;
  className?: string;
}

export function MarkdownText({ children, className }: MarkdownTextProps) {
  return (
    <ReactMarkdown
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const isInline = !match;

          if (isInline) {
            return (
              <code
                className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            // @ts-expect-error - SyntaxHighlighter has typing issues with React 18
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              className="rounded-lg text-sm"
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          );
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-4 mb-2">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-4 mb-2">{children}</ol>;
        },
        li({ children }) {
          return <li className="mb-1">{children}</li>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {children}
            </a>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2">
              {children}
            </blockquote>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-gray-300">
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-gray-300 px-3 py-2">{children}</td>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
