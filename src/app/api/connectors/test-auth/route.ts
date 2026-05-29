import { NextRequest, NextResponse } from 'next/server';
import { TestAuthRequest, TestAuthResponse, ConnectorType } from '@/lib/connectors/types';
import { ConnectorValidationError } from '@/lib/connectors/errors';
import { resolveSecret, validateCredentialArn, validateUrlSafety } from '@/lib/connectors/secret-resolver';
import { checkRateLimit } from '@/lib/connectors/rate-limiter';

const SUPPORTED_TYPES: ConnectorType[] = ['bedrock', 'lambda', 'dynamodb', 's3', 'jira', 'github'];

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Rate limiting (stricter for auth testing)
  const rateCheck = checkRateLimit('/api/connectors/test-auth', clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', code: 'CVE-500' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateCheck.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  try {
    const body: TestAuthRequest = await req.json();

    // Validate request
    if (!body.connectorType) {
      return NextResponse.json(
        { error: 'connectorType is required', code: 'CVE-401' },
        { status: 400 }
      );
    }

    if (!SUPPORTED_TYPES.includes(body.connectorType)) {
      return NextResponse.json(
        { error: `Unsupported connector type: ${body.connectorType}`, code: 'CVE-403' },
        { status: 400 }
      );
    }

    if (!body.credentialArn) {
      return NextResponse.json(
        { error: 'credentialArn is required', code: 'CVE-401' },
        { status: 400 }
      );
    }

    // Validate ARN format (rejects plaintext)
    try {
      validateCredentialArn(body.credentialArn);
    } catch (err) {
      if (err instanceof ConnectorValidationError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.httpStatus }
        );
      }
      throw err;
    }

    const start = Date.now();

    try {
      const response = await testAuth(body);
      return NextResponse.json(response);
    } catch (err) {
      const latencyMs = Date.now() - start;
      if (err instanceof ConnectorValidationError) {
        const response: TestAuthResponse = {
          success: false,
          connectorType: body.connectorType,
          errorCode: err.code,
          message: err.message,
          latencyMs,
        };
        return NextResponse.json(response, { status: err.httpStatus });
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body', code: 'CVE-400' }, { status: 400 });
    }
    console.error('[connectors/test-auth] Error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function testAuth(request: TestAuthRequest): Promise<TestAuthResponse> {
  const start = Date.now();

  const credential = await resolveSecret(request.credentialArn);

  switch (request.connectorType) {
    case 'bedrock':
    case 'lambda':
    case 'dynamodb':
    case 's3':
      return testAwsAuth(request, start);

    case 'jira':
      return testJiraAuth(request, credential, start);

    case 'github':
      return testGitHubAuth(request, credential, start);

    default:
      throw new ConnectorValidationError('CVE-403', `Unsupported type: ${request.connectorType}`);
  }
}

async function testAwsAuth(request: TestAuthRequest, start: number): Promise<TestAuthResponse> {
  try {
    const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
    const region = (request.config as Record<string, string>).region || process.env.AWS_REGION || 'us-east-1';
    const client = new STSClient({ region });

    const response = await client.send(new GetCallerIdentityCommand({}));

    return {
      success: true,
      connectorType: request.connectorType,
      identity: response.Arn || response.Account || 'Unknown',
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new ConnectorValidationError('CVE-102', message);
  }
}

async function testJiraAuth(request: TestAuthRequest, credential: string, start: number): Promise<TestAuthResponse> {
  const baseUrl = (request.config as Record<string, string>).baseUrl;
  if (!baseUrl) {
    throw new ConnectorValidationError('CVE-401', 'config.baseUrl required for Jira auth test');
  }

  validateUrlSafety(baseUrl);

  let authHeaders: Record<string, string>;
  try {
    const parsed = JSON.parse(credential);
    if (parsed.accessToken) {
      authHeaders = { 'Authorization': `Bearer ${parsed.accessToken}` };
    } else if (parsed.email && parsed.token) {
      const encoded = Buffer.from(`${parsed.email}:${parsed.token}`).toString('base64');
      authHeaders = { 'Authorization': `Basic ${encoded}` };
    } else {
      throw new ConnectorValidationError('CVE-400', 'Invalid Jira credential format');
    }
  } catch (parseErr) {
    if (parseErr instanceof ConnectorValidationError) throw parseErr;
    const email = process.env.JIRA_EMAIL || '';
    const encoded = Buffer.from(`${email}:${credential}`).toString('base64');
    authHeaders = { 'Authorization': `Basic ${encoded}` };
  }

  const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
    headers: { ...authHeaders, 'Accept': 'application/json' },
  });

  if (response.ok) {
    const user = await response.json();
    return {
      success: true,
      connectorType: 'jira',
      identity: user.displayName || user.emailAddress || 'Authenticated',
      latencyMs: Date.now() - start,
    };
  }

  throw new ConnectorValidationError('CVE-103', `Jira auth failed with status ${response.status}`);
}

async function testGitHubAuth(request: TestAuthRequest, credential: string, start: number): Promise<TestAuthResponse> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${credential}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'agentcore-connector-validator',
    },
  });

  if (response.ok) {
    const user = await response.json();
    return {
      success: true,
      connectorType: 'github',
      identity: user.login || 'Authenticated',
      latencyMs: Date.now() - start,
    };
  }

  if (response.status === 401) {
    throw new ConnectorValidationError('CVE-103', 'GitHub token is invalid or expired');
  }

  throw new ConnectorValidationError('CVE-103', `GitHub auth failed with status ${response.status}`);
}
