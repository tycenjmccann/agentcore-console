import { NextRequest, NextResponse } from 'next/server';
import { HealthCheckResponse, ValidationResult, ConnectorConfig } from '@/lib/connectors/types';
import { validateConnector } from '@/lib/connectors/validators';
import { checkRateLimit } from '@/lib/connectors/rate-limiter';

const CACHE_TTL_SECONDS = 30;

interface CacheEntry {
  response: HealthCheckResponse;
  cachedAt: number;
}

// Module-level cache
const healthCache = new Map<string, CacheEntry>();

function getDefaultConnectors(): ConnectorConfig[] {
  const connectors: ConnectorConfig[] = [];

  const ticketsTable = process.env.TICKETS_TABLE || 'agentis-tickets';
  const workflowsTable = process.env.WORKFLOWS_TABLE || 'agentis-workflows';

  connectors.push({
    type: 'dynamodb',
    id: 'tickets-table',
    name: 'Tickets Table',
    config: { tableName: ticketsTable },
  });

  connectors.push({
    type: 'dynamodb',
    id: 'workflows-table',
    name: 'Workflows Table',
    config: { tableName: workflowsTable },
  });

  const ticketLambda = process.env.TICKET_TOOLS_LAMBDA;
  if (ticketLambda) {
    connectors.push({
      type: 'lambda',
      id: 'ticket-tools-lambda',
      name: 'Ticket Tools Lambda',
      config: { functionArn: ticketLambda },
    });
  }

  const s3Bucket = process.env.ARTIFACTS_BUCKET || process.env.S3_BUCKET;
  if (s3Bucket) {
    connectors.push({
      type: 's3',
      id: 'artifacts-bucket',
      name: 'Artifacts Bucket',
      config: { bucketName: s3Bucket },
    });
  }

  return connectors;
}

export async function GET(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Rate limiting
  const rateCheck = checkRateLimit('/api/connectors/health', clientIp);
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

  // Check cache
  const cacheKey = 'default';
  const cached = healthCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.cachedAt) < CACHE_TTL_SECONDS * 1000) {
    return NextResponse.json(cached.response, {
      headers: {
        'X-Cache': 'HIT',
        'X-Cache-Age': Math.floor((now - cached.cachedAt) / 1000).toString(),
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });
  }

  try {
    const connectors = getDefaultConnectors();

    if (connectors.length === 0) {
      const response: HealthCheckResponse = {
        status: 'healthy',
        connectors: [],
        ttlSeconds: CACHE_TTL_SECONDS,
      };
      return NextResponse.json(response);
    }

    // Validate all connectors in parallel
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
        message: result.reason?.message || 'Health check failed',
        timestamp: new Date().toISOString(),
      };
    });

    // Determine overall status
    const hasUnhealthy = validationResults.some(r => r.status === 'unhealthy' || r.status === 'error');
    const hasDegraded = validationResults.some(r => r.status === 'degraded');
    const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    const response: HealthCheckResponse = {
      status: overallStatus,
      connectors: validationResults,
      cachedAt: new Date().toISOString(),
      ttlSeconds: CACHE_TTL_SECONDS,
    };

    // Update cache
    healthCache.set(cacheKey, { response, cachedAt: now });

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });
  } catch (err) {
    console.error('[connectors/health] Error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Health check failed' },
      { status: 500 }
    );
  }
}
