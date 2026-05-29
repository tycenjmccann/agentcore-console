import { ConnectorConfig, ValidationResult } from './types';
import { validateConnector } from './validators';

/**
 * Resolves which connectors are needed for a workflow based on its configuration.
 */
export function resolveConnectorsForWorkflow(workflowInput: {
  repoConfig?: { repos?: Array<{ url?: string }> };
  ticketProvider?: string;
}): ConnectorConfig[] {
  const connectors: ConnectorConfig[] = [];
  const region = process.env.AWS_REGION || 'us-east-1';

  // DynamoDB tables are always required
  const ticketsTable = process.env.TICKETS_TABLE || 'agentis-tickets';
  const workflowsTable = process.env.WORKFLOWS_TABLE || 'agentis-workflows';

  connectors.push({
    type: 'dynamodb',
    id: 'tickets-table',
    name: 'Tickets Table',
    region,
    config: { tableName: ticketsTable, region },
  });

  connectors.push({
    type: 'dynamodb',
    id: 'workflows-table',
    name: 'Workflows Table',
    region,
    config: { tableName: workflowsTable, region },
  });

  // Ticket tools Lambda
  const ticketLambda = process.env.TICKET_TOOLS_LAMBDA;
  if (ticketLambda) {
    connectors.push({
      type: 'lambda',
      id: 'ticket-tools-lambda',
      name: 'Ticket Tools Lambda',
      region,
      config: { functionArn: ticketLambda, region },
    });
  }

  // S3 artifacts bucket
  const s3Bucket = process.env.ARTIFACTS_BUCKET || process.env.S3_BUCKET;
  if (s3Bucket) {
    connectors.push({
      type: 's3',
      id: 'artifacts-bucket',
      name: 'Artifacts S3 Bucket',
      region,
      config: { bucketName: s3Bucket, region },
    });
  }

  // GitHub repos from workflow config
  if (workflowInput.repoConfig?.repos) {
    for (const repo of workflowInput.repoConfig.repos) {
      if (repo.url) {
        const match = repo.url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          const [, owner, repoName] = match;
          const cleanName = repoName.replace(/\.git$/, '');
          connectors.push({
            type: 'github',
            id: `github-${owner}-${cleanName}`,
            name: `GitHub: ${owner}/${cleanName}`,
            config: { owner, repo: cleanName },
          });
        }
      }
    }
  }

  // Jira connector (if using Jira provider)
  const ticketProvider = workflowInput.ticketProvider || process.env.TICKET_PROVIDER || 'dynamodb';
  if (ticketProvider === 'jira') {
    const jiraBaseUrl = process.env.JIRA_BASE_URL;
    const jiraCredArn = process.env.JIRA_CREDENTIAL_ARN;
    if (jiraBaseUrl && jiraCredArn) {
      connectors.push({
        type: 'jira',
        id: 'jira-cloud',
        name: 'Jira Cloud',
        config: {
          baseUrl: jiraBaseUrl,
          projectKey: process.env.JIRA_PROJECT_KEY || 'TEAM',
          credentialArn: jiraCredArn,
        },
      });
    }
  }

  return connectors;
}

/**
 * Run preflight validation for a workflow.
 */
export async function runPreflightValidation(workflowInput: {
  repoConfig?: { repos?: Array<{ url?: string }> };
  ticketProvider?: string;
}): Promise<{ passed: boolean; results: ValidationResult[]; failedConnectors: string[] }> {
  const connectors = resolveConnectorsForWorkflow(workflowInput);

  if (connectors.length === 0) {
    return { passed: true, results: [], failedConnectors: [] };
  }

  const results = await Promise.allSettled(
    connectors.map(c => validateConnector(c, 5000))
  );

  const validationResults: ValidationResult[] = results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      connectorId: connectors[index].id,
      connectorType: connectors[index].type,
      status: 'error' as const,
      latencyMs: 0,
      message: result.reason?.message || 'Preflight check failed',
      timestamp: new Date().toISOString(),
    };
  });

  const failedConnectors = validationResults
    .filter(r => r.status === 'unhealthy' || r.status === 'error')
    .map(r => r.connectorId);

  return {
    passed: failedConnectors.length === 0,
    results: validationResults,
    failedConnectors,
  };
}
