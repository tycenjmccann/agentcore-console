/**
 * Code Search Provider — stub implementation
 *
 * This module provides code search capabilities for the workflow engine.
 * Currently returns a no-op provider. Replace with Bedrock Knowledge Base
 * or other search backend when configured.
 */

interface CodeSearchResult {
  file: string;
  filePath: string;
  snippet: string;
  content: string;
  language: string;
  score: number;
}

interface ArchitectureInfo {
  buildSystem: string;
  targetPaths: { name: string; path: string; type: string }[];
  configFiles: { path: string; content: string }[];
}

interface CodeSearchProvider {
  isIndexed(repoUrl: string): Promise<boolean>;
  getArchitecture(repoUrl: string, branch?: string): Promise<ArchitectureInfo>;
  searchCode(params: { query: string; repo: string; maxResults?: number }): Promise<CodeSearchResult[]>;
}

const noopProvider: CodeSearchProvider = {
  async isIndexed() {
    return false;
  },
  async getArchitecture() {
    return { buildSystem: "", targetPaths: [], configFiles: [] };
  },
  async searchCode() {
    return [];
  },
};

export function getCodeSearchProvider(): CodeSearchProvider {
  // TODO: Return real provider when BEDROCK_KB_ID is configured
  return noopProvider;
}
