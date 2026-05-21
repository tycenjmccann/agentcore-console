"use client";

import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { CodeBlock } from "./CodeBlock";

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
}: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm prose-invert max-w-none agent-output-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSanitize]}
        components={{
          pre({ children }) {
            // Unwrap <pre> so CodeBlock handles the presentation
            return <>{children}</>;
          },
          code({ children, className, node, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            // Detect if this is a block code element (has language class or is multi-line)
            const content = String(children).replace(/\n$/, "");
            const isBlock =
              Boolean(match) ||
              (node?.position &&
                node.position.start.line !== node.position.end.line);

            if (isBlock || (className && className.includes("hljs"))) {
              // rehype-highlight adds hljs classes and renders HTML inside code
              // We need to pass the raw HTML content
              return (
                <CodeBlock language={match?.[1]} className={className} highlightedHtml={content} />
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          img({ src, alt, ...props }) {
            return (
              <img
                src={src}
                alt={alt || ""}
                loading="lazy"
                {...(props as React.ImgHTMLAttributes<HTMLImageElement>)}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;
