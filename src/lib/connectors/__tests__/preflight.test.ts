import { describe, it, expect } from 'vitest';
import { resolveConnectorsForWorkflow } from '../preflight';

describe('resolveConnectorsForWorkflow', () => {
  it('always includes DynamoDB tables', () => {
    const connectors = resolveConnectorsForWorkflow({});
    const ddbConnectors = connectors.filter(c => c.type === 'dynamodb');
    expect(ddbConnectors.length).toBeGreaterThanOrEqual(2);
    expect(ddbConnectors.find(c => c.id === 'tickets-table')).toBeDefined();
    expect(ddbConnectors.find(c => c.id === 'workflows-table')).toBeDefined();
  });

  it('resolves GitHub connectors from repoConfig', () => {
    const connectors = resolveConnectorsForWorkflow({
      repoConfig: {
        repos: [{ url: 'https://github.com/myorg/myrepo' }],
      },
    });
    const ghConnectors = connectors.filter(c => c.type === 'github');
    expect(ghConnectors.length).toBe(1);
    expect(ghConnectors[0].id).toBe('github-myorg-myrepo');
  });

  it('handles .git suffix in repo URLs', () => {
    const connectors = resolveConnectorsForWorkflow({
      repoConfig: {
        repos: [{ url: 'https://github.com/org/repo.git' }],
      },
    });
    const ghConnectors = connectors.filter(c => c.type === 'github');
    expect(ghConnectors.length).toBe(1);
    expect((ghConnectors[0].config as any).repo).toBe('repo');
  });

  it('handles empty repoConfig', () => {
    const connectors = resolveConnectorsForWorkflow({
      repoConfig: { repos: [] },
    });
    const ghConnectors = connectors.filter(c => c.type === 'github');
    expect(ghConnectors.length).toBe(0);
  });

  it('does not include Jira connector for dynamodb provider', () => {
    const connectors = resolveConnectorsForWorkflow({
      ticketProvider: 'dynamodb',
    });
    const jiraConnectors = connectors.filter(c => c.type === 'jira');
    expect(jiraConnectors.length).toBe(0);
  });
});
