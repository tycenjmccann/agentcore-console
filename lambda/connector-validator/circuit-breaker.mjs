/**
 * DynamoDB-backed circuit breaker per connector type.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

const FAILURE_THRESHOLD = parseInt(process.env.CB_FAILURE_THRESHOLD || '5');
const RECOVERY_TIMEOUT_MS = parseInt(process.env.CB_RECOVERY_TIMEOUT_MS || '60000');

export async function checkCircuitBreaker(connectorType, docClient, tableName) {
  const { GetCommand } = await import('@aws-sdk/lib-dynamodb');

  try {
    const result = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { PK: `CB#${connectorType}`, SK: 'STATE' },
    }));

    if (!result.Item) {
      return { state: 'CLOSED', failureCount: 0 };
    }

    const item = result.Item;

    // If OPEN, check if recovery timeout has passed
    if (item.state === 'OPEN') {
      const openedAt = new Date(item.openedAt).getTime();
      const now = Date.now();
      if (now - openedAt >= RECOVERY_TIMEOUT_MS) {
        // Transition to HALF_OPEN
        await transitionToHalfOpen(connectorType, docClient, tableName);
        return { state: 'HALF_OPEN', failureCount: item.failureCount, openedAt: item.openedAt };
      }
      return { state: 'OPEN', failureCount: item.failureCount, openedAt: item.openedAt };
    }

    return item;
  } catch (err) {
    // If circuit breaker check fails, default to CLOSED (allow request)
    console.warn('Circuit breaker check failed, defaulting to CLOSED:', err.message);
    return { state: 'CLOSED', failureCount: 0 };
  }
}

export async function recordFailure(connectorType, docClient, tableName) {
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { PK: `CB#${connectorType}`, SK: 'STATE' },
      UpdateExpression: 'SET failureCount = if_not_exists(failureCount, :zero) + :one, lastFailureAt = :now, #s = :state',
      ExpressionAttributeNames: { '#s': 'state' },
      ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': new Date().toISOString(), ':state': 'CLOSED' },
      ReturnValues: 'ALL_NEW',
    }));

    // Check if threshold exceeded
    if (result.Attributes.failureCount >= FAILURE_THRESHOLD) {
      await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: `CB#${connectorType}`, SK: 'STATE' },
        UpdateExpression: 'SET #s = :state, openedAt = :now',
        ExpressionAttributeNames: { '#s': 'state' },
        ExpressionAttributeValues: { ':state': 'OPEN', ':now': new Date().toISOString() },
      }));
    }
  } catch (err) {
    console.error('Failed to record circuit breaker failure:', err.message);
  }
}

export async function recordSuccess(connectorType, docClient, tableName) {
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');

  try {
    await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { PK: `CB#${connectorType}`, SK: 'STATE' },
      UpdateExpression: 'SET #s = :state, failureCount = :zero',
      ExpressionAttributeNames: { '#s': 'state' },
      ExpressionAttributeValues: { ':state': 'CLOSED', ':zero': 0 },
    }));
  } catch (err) {
    console.error('Failed to record circuit breaker success:', err.message);
  }
}

async function transitionToHalfOpen(connectorType, docClient, tableName) {
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');

  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: `CB#${connectorType}`, SK: 'STATE' },
    UpdateExpression: 'SET #s = :state, halfOpenAt = :now',
    ExpressionAttributeNames: { '#s': 'state' },
    ExpressionAttributeValues: { ':state': 'HALF_OPEN', ':now': new Date().toISOString() },
  }));
}
