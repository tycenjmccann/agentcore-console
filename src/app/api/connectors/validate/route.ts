import { NextRequest, NextResponse } from 'next/server';
import { BatchValidationRequest, BatchValidationResponse, ConnectorConfig } from '@/lib/connectors/types';
import { ConnectorValidationError, CONNECTOR_ERRORS } from '@/lib/connectors/errors';
import { validateConnector } from '@/lib/connectors/validators';
import { checkRateLimit } from '@/lib/connectors/rate-limiter';

const MAX_CONNECTORS_PER_BATCH = 20;
const DEFAULT_TIMEOUT = 10000;

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Rate limiting
  const rateCheck = checkRateLimit('/api/connectors/validate', clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', code: 'CVE-500', retryAfter: new Date(rateCheck.resetAt).toISOString() },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateCheck.resetAt).toISOString(),
          'Retry-After': Math.ceil((rateCheck.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  try {
    const body: BatchValidationRequest = await req.json();

    // Validate request
    if (!body.connectors || !Array.isArray(body.connectors)) {
      return NextResponse.json(
        { error: 'connectors array is required', code: 'CVE-401' },
        { status: 400 }
      );
    }

    if (body.connectors.length === 0) {
      return NextResponse.json(
        { error: 'At least one connector is required', code: 'CVE-401' },
        { status: 400 }
      );
    }

    if (body.connectors.length > MAX_CONNECTORS_PER_BATCH) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CONNECTORS_PER_BATCH} connectors per batch`, code: 'CVE-501' },
        { status: 400 }
      );
    }

    // Validate each connector has required fields
    for (const connector of body.connectors) {
      if (!connector.type || !connector.id || !connector.config) {
        return NextResponse.json(
          { error: 'Each connector must have type, id, and config fields', code: 'CVE-401' },
          { status: 400 }
        );
      }

      // Reject plaintext secrets
      if (hasPlaintextSecrets(connector)) {
        return NextResponse.json(
          { error: 'Plaintext secrets detected. Use credentialArn with SSM/Secrets Manager ARN', code: 'CVE-104' },
          { status: 400 }
        );
      }
    }

    const timeout = body.timeout || DEFAULT_TIMEOUT;
    const start = Date.now();

    // Run validations in parallel
    const results = await Promise.allSettled(
      body.connectors.map(connector => validateConnector(connector, timeout))
    );

    const validationResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // Handle rejected promises
      return {
        connectorId: body.connectors[index].id,
        connectorType: body.connectors[index].type,
        status: 'error' as const,
        latencyMs: Date.now() - start,
        errorCode: 'CVE-200',
        message: result.reason?.message || 'Validation failed unexpectedly',
        timestamp: new Date().toISOString(),
      };
    });

    const summary = {
      total: validationResults.length,
      healthy: validationResults.filter(r => r.status === 'healthy').length,
      degraded: validationResults.filter(r => r.status === 'degraded').length,
      unhealthy: validationResults.filter(r => r.status === 'unhealthy').length,
      errors: validationResults.filter(r => r.status === 'error').length,
    };

    const response: BatchValidationResponse = {
      results: validationResults,
      summary,
      durationMs: Date.now() - start,
    };

    return NextResponse.json(response, {
      headers: {
        'X-RateLimit-Remaining': rateCheck.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateCheck.resetAt).toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body', code: 'CVE-400' }, { status: 400 });
    }
    console.error('[connectors/validate] Error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function hasPlaintextSecrets(connector: ConnectorConfig): boolean {
  const config = connector.config as Record<string, unknown>;

  const secretFields = ['apiKey', 'apiToken', 'password', 'secret', 'token', 'accessToken'];

  for (const field of secretFields) {
    const value = config[field];
    if (typeof value === 'string' && value.length > 0 && !value.startsWith('arn:aws:')) {
      return true;
    }
  }

  return false;
}
