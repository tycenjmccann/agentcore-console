/**
 * Code Search Provider — stub implementation
 *
 * This module provides code search capabilities for the workflow engine.
 * Currently returns a no-op provider. Replace with Bedrock Knowledge Base
 * or other search backend when configured.
 */

interface CodeSearchResult {
  file: string;
  snippet: string;
  score: number;
}

interface CodeSearchProvider {
  isIndexed(repoUrl: string): Promise<boolean>;
  getArchitecture(repoUrl: string, branch?: string): Promise<string>;
  searchCode(params: { query: string; repo: string; maxResults?: number }): Promise<CodeSearchResult[]>;
}

const noopProvider: CodeSearchProvider = {
  async isIndexed() {
    return false;
  },
  async getArchitecture() {
    return "";
  },
  async searchCode() {
    return [];
  },
};

export function getCodeSearchProvider(): CodeSearchProvider {
  // TODO: Return real provider when BEDROCK_KB_ID is configured
  return noopProvider;
}
