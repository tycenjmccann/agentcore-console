"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Loader2, FileText, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ArtifactPreviewProps {
  workflowId: string;
  filePath: string;
  onClose: () => void;
}

export default function ArtifactPreview({ workflowId, filePath, onClose }: ArtifactPreviewProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileName = filePath.split("/").pop() || filePath;
  const fileExt = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Encode the path parts properly
      const pathAfterWorkflow = filePath.replace(`workflows/${workflowId}/`, "");
      const res = await fetch(`/api/workflow/${workflowId}/artifacts/${pathAfterWorkflow}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch file: ${res.status}`);
      }
      const text = await res.text();
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  }, [workflowId, filePath]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may not be available
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin mr-2" />
          <span className="text-sm text-zinc-400">Loading file...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-sm text-red-400 mb-2">Failed to load file</p>
          <p className="text-xs text-zinc-500">{error}</p>
        </div>
      );
    }

    // Markdown rendering
    if (fileExt === "md") {
      return (
        <div className="prose prose-invert prose-sm max-w-none px-6 py-4 prose-headings:text-zinc-200 prose-p:text-zinc-300 prose-code:text-blue-300 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700 prose-a:text-blue-400 prose-strong:text-zinc-200 prose-li:text-zinc-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      );
    }

    // JSON with syntax highlighting
    if (fileExt === "json") {
      let formatted = content;
      try {
        formatted = JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        // Use raw content if not valid JSON
      }
      return (
        <pre className="px-6 py-4 overflow-x-auto">
          <code className="text-xs font-mono leading-relaxed">
            {highlightJSON(formatted)}
          </code>
        </pre>
      );
    }

    // Code files with syntax highlighting
    if (["ts", "tsx", "js", "jsx", "css", "scss", "html"].includes(fileExt || "")) {
      return (
        <pre className="px-6 py-4 overflow-x-auto">
          <code className="text-xs font-mono leading-relaxed">
            {highlightCode(content, fileExt || "")}
          </code>
        </pre>
      );
    }

    // Plain text fallback
    return (
      <pre className="px-6 py-4 overflow-x-auto text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {content}
      </pre>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-zinc-900 border-l border-zinc-700 z-50 flex flex-col shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-900/95 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <span className="text-sm font-mono text-zinc-200 truncate" title={filePath}>
              {fileName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Copy content"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File path breadcrumb */}
        <div className="px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/80 flex-shrink-0">
          <p className="text-[10px] text-zinc-500 font-mono truncate">{filePath}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.2s ease-out;
        }
      `}</style>
    </>
  );
}

// ─── Lightweight Syntax Highlighting ─────────────────────────────────────────

function highlightJSON(code: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const highlighted = line
      .replace(/("[^"]*")\s*:/g, '<span class="text-blue-300">$1</span>:')
      .replace(/:\s*("[^"]*")/g, ': <span class="text-green-300">$1</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="text-amber-300">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="text-purple-300">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="text-zinc-500">$1</span>');
    return (
      <div key={i} className="text-zinc-300">
        <span className="text-zinc-600 select-none inline-block w-8 text-right mr-4">{i + 1}</span>
        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    );
  });
}

function highlightCode(code: string, ext: string): React.ReactNode[] {
  const lines = code.split("\n");
  const keywords = ext === "css" || ext === "scss"
    ? ["@import", "@media", "@keyframes", "@mixin", "@include", "!important"]
    : ["import", "export", "from", "const", "let", "var", "function", "return",
       "if", "else", "for", "while", "class", "extends", "implements",
       "interface", "type", "enum", "async", "await", "new", "this",
       "try", "catch", "throw", "default", "switch", "case", "break"];

  return lines.map((line, i) => {
    let highlighted = escapeHtml(line);

    // Comments
    if (highlighted.trimStart().startsWith("//") || highlighted.trimStart().startsWith("/*") || highlighted.trimStart().startsWith("*")) {
      highlighted = `<span class="text-zinc-500 italic">${highlighted}</span>`;
    } else {
      // Strings
      highlighted = highlighted.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, '<span class="text-green-300">$1</span>');
      // Keywords
      for (const kw of keywords) {
        const regex = new RegExp(`\\b(${escapeRegex(kw)})\\b`, "g");
        highlighted = highlighted.replace(regex, '<span class="text-purple-300">$1</span>');
      }
      // Types / components (PascalCase)
      highlighted = highlighted.replace(/\b([A-Z][a-zA-Z0-9]+)\b/g, '<span class="text-amber-300">$1</span>');
    }

    return (
      <div key={i} className="text-zinc-300 hover:bg-zinc-800/30">
        <span className="text-zinc-600 select-none inline-block w-8 text-right mr-4">{i + 1}</span>
        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    );
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
