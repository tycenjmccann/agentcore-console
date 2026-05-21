"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FolderOpen,
  ChevronRight,
  FileText,
  FileCode,
  File,
  Image,
  Download,
  AlertCircle,
  Loader2,
} from "lucide-react";
import "./pipeline.css";

interface ArtifactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
}

interface S3ArtifactFile {
  key: string;
  size: number;
  lastModified: string;
  contentType?: string;
}

interface ArtifactFolder {
  path: string;
  displayName: string;
  files: S3ArtifactFile[];
}

/** Get file icon based on extension */
function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["md", "txt", "pdf"].includes(ext)) return FileText;
  if (["ts", "tsx", "js", "jsx"].includes(ext)) return FileCode;
  if (["json", "yaml", "yml"].includes(ext)) return FileCode;
  if (["png", "jpg", "jpeg", "svg", "gif", "webp"].includes(ext)) return Image;
  return File;
}

/** Format bytes to human-readable */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format date to short string */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return "< 1h ago";
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** Format folder path to display name */
function formatFolderName(folderPath: string): string {
  if (folderPath === "shared/") return "Shared Artifacts";
  if (folderPath === "prompts/") return "Prompts";
  if (folderPath.startsWith("agents/")) {
    const agentId = folderPath.replace("agents/", "").replace(/\/$/, "");
    return agentId
      .replace(/^team-/, "")
      .split("-")
      .map((word) => {
        const upper = word.toUpperCase();
        if (["IOS", "API", "UI", "QA"].includes(upper)) return upper;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
  return folderPath.replace(/\/$/, "") || "Root";
}

/** Group files by folder */
function groupFilesByFolder(files: S3ArtifactFile[], workflowPrefix: string): ArtifactFolder[] {
  const folderMap = new Map<string, S3ArtifactFile[]>();

  for (const file of files) {
    // Strip the workflow prefix to get relative path
    const relativePath = file.key.startsWith(workflowPrefix)
      ? file.key.slice(workflowPrefix.length)
      : file.key;
    const parts = relativePath.split("/");
    let folderPath: string;
    if (parts.length <= 1) {
      folderPath = "root/";
    } else if (parts[0] === "agents" && parts.length > 2) {
      folderPath = `agents/${parts[1]}/`;
    } else {
      folderPath = `${parts[0]}/`;
    }
    if (!folderMap.has(folderPath)) {
      folderMap.set(folderPath, []);
    }
    folderMap.get(folderPath)!.push(file);
  }

  // Sort: shared first, agents alphabetical, prompts last, others last
  const folders: ArtifactFolder[] = [];
  const sortedKeys = Array.from(folderMap.keys()).sort((a, b) => {
    if (a === "shared/") return -1;
    if (b === "shared/") return 1;
    if (a.startsWith("agents/") && !b.startsWith("agents/")) return -1;
    if (!a.startsWith("agents/") && b.startsWith("agents/")) return 1;
    if (a === "prompts/") return 1;
    if (b === "prompts/") return -1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    folders.push({
      path: key,
      displayName: formatFolderName(key),
      files: folderMap.get(key)!.sort((a, b) => {
        const nameA = a.key.split("/").pop() || "";
        const nameB = b.key.split("/").pop() || "";
        return nameA.localeCompare(nameB);
      }),
    });
  }

  return folders;
}

export default function ArtifactsModal({
  isOpen,
  onClose,
  workflowId,
}: ArtifactsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [files, setFiles] = useState<S3ArtifactFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Portal mount (client-only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch artifacts when modal opens
  useEffect(() => {
    if (!isOpen || !workflowId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/workflow/${workflowId}/artifacts`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setFiles(data.files || []);
        // Auto-collapse if many files
        if ((data.files || []).length > 50) {
          const folders = groupFilesByFolder(data.files || [], `workflows/${workflowId}/`);
          setCollapsedFolders(new Set(folders.map((f) => f.path)));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load artifacts");
        setLoading(false);
      });
  }, [isOpen, workflowId]);

  // Focus management
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusableSelector =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusableEls = modalRef.current.querySelectorAll(focusableSelector);
      if (focusableEls.length === 0) return;
      const firstFocusable = focusableEls[0] as HTMLElement;
      const lastFocusable = focusableEls[focusableEls.length - 1] as HTMLElement;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsAnimatingOut(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isAnimatingOut) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isAnimatingOut, handleClose]);

  const handleAnimationEnd = useCallback(() => {
    if (isAnimatingOut) {
      setIsAnimatingOut(false);
      onClose();
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }
  }, [isAnimatingOut, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleFileClick = (fileKey: string) => {
    const url = `/api/workflow/${workflowId}/artifacts/${encodeURIComponent(fileKey)}`;
    window.open(url, "_blank");
  };

  const handleDownloadAll = () => {
    const url = `/api/workflow/${workflowId}/artifacts/download-all`;
    window.open(url, "_blank");
  };

  const retryFetch = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/workflow/${workflowId}/artifacts`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setFiles(data.files || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load artifacts");
        setLoading(false);
      });
  };

  if ((!isOpen && !isAnimatingOut) || !mounted) return null;

  const workflowPrefix = `workflows/${workflowId}/`;
  const folders = groupFilesByFolder(files, workflowPrefix);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const modal = (
    <div
      className={`modal-backdrop ${isAnimatingOut ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifacts-modal-title"
        className={`artifacts-modal ${isAnimatingOut ? "modal-card-exit" : "modal-card-enter"}`}
        ref={modalRef}
        onAnimationEnd={handleAnimationEnd}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="artifacts-modal-header-left">
            <FolderOpen size={18} style={{ color: "var(--pipeline-active)", flexShrink: 0 }} aria-hidden="true" />
            <h2 id="artifacts-modal-title" className="modal-header-title">
              S3 Artifacts
            </h2>
          </div>
          <div className="artifacts-modal-header-actions">
            {!loading && !error && files.length > 0 && (
              <button
                className="artifacts-download-all-btn"
                onClick={handleDownloadAll}
                aria-label="Download all artifacts as ZIP"
              >
                <Download size={14} aria-hidden="true" />
                <span className="btn-label">Download All</span>
              </button>
            )}
            <button
              ref={closeButtonRef}
              className="modal-close-btn"
              onClick={handleClose}
              aria-label="Close artifacts viewer"
              type="button"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="artifacts-content">
          {loading ? (
            <div className="artifacts-state-container">
              <Loader2
                size={24}
                style={{ color: "var(--pipeline-active)", animation: "spin 1s linear infinite" }}
                aria-hidden="true"
              />
              <p className="artifacts-state-title" style={{ marginTop: 12 }}>Loading artifacts...</p>
            </div>
          ) : error ? (
            <div className="artifacts-state-container">
              <div className="artifacts-state-icon error">
                <AlertCircle size={18} style={{ color: "var(--pipeline-error)" }} aria-hidden="true" />
              </div>
              <p className="artifacts-state-title">Failed to load artifacts</p>
              <p className="artifacts-state-subtitle">{error}</p>
              <button className="artifacts-retry-btn" onClick={retryFetch}>
                Try Again
              </button>
            </div>
          ) : files.length === 0 ? (
            <div className="artifacts-state-container">
              <div className="artifacts-state-icon">
                <FolderOpen size={18} style={{ color: "var(--pipeline-text-muted)" }} aria-hidden="true" />
              </div>
              <p className="artifacts-state-title">No artifacts found</p>
              <p className="artifacts-state-subtitle">
                Artifacts will appear here as agents produce output.
              </p>
            </div>
          ) : (
            folders.map((folder) => {
              const isCollapsed = collapsedFolders.has(folder.path);
              return (
                <div key={folder.path} className="artifacts-folder">
                  <button
                    className="artifacts-folder-header"
                    onClick={() => toggleFolder(folder.path)}
                    aria-expanded={!isCollapsed}
                  >
                    <ChevronRight
                      size={14}
                      className={`artifacts-folder-chevron ${!isCollapsed ? "expanded" : ""}`}
                      aria-hidden="true"
                    />
                    <FolderOpen size={14} className="artifacts-folder-icon" aria-hidden="true" />
                    <span className="artifacts-folder-name">{folder.displayName}</span>
                    <span className="artifacts-folder-count">{folder.files.length}</span>
                  </button>
                  <div
                    className={`artifacts-folder-files ${isCollapsed ? "collapsed" : ""}`}
                    role="group"
                  >
                    {folder.files.map((file) => {
                      const filename = file.key.split("/").pop() || file.key;
                      const FileIcon = getFileIcon(filename);
                      return (
                        <button
                          key={file.key}
                          className="artifact-row"
                          onClick={() => handleFileClick(file.key)}
                          aria-label={`${filename}, ${formatFileSize(file.size)}, last modified ${formatDate(file.lastModified)}`}
                        >
                          <FileIcon size={14} className="artifact-row-icon" aria-hidden="true" />
                          <span className="artifact-row-name">{filename}</span>
                          <span className="artifact-row-size">{formatFileSize(file.size)}</span>
                          <span className="artifact-row-date">{formatDate(file.lastModified)}</span>
                          <Download size={14} className="artifact-row-download" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {!loading && !error && files.length > 0 && (
          <div className="artifacts-footer">
            <span className="artifacts-footer-stat">
              {files.length} file{files.length !== 1 ? "s" : ""} in {folders.length} folder{folders.length !== 1 ? "s" : ""}
            </span>
            <span className="artifacts-footer-stat">
              Total: {formatFileSize(totalSize)}
            </span>
          </div>
        )}

        {/* Screen reader live region */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {loading && "Loading artifacts..."}
          {!loading && !error && files.length > 0 && `Loaded ${files.length} files in ${folders.length} folders`}
          {!loading && !error && files.length === 0 && "No artifacts found"}
          {error && `Error loading artifacts: ${error}`}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
