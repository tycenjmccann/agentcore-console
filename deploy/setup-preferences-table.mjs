#!/usr/bin/env node
/**
 * Setup script for the User Preferences DynamoDB table.
 * Creates the table needed by GET/PUT /api/user/preferences.
 *
 * Usage:
 *   node deploy/setup-preferences-table.mjs [--region us-east-1]
 *
 * Table Schema:
 *   - Partition Key: userId (String) — defaults to "default" for single-user
 *   - PAY_PER_REQUEST billing mode (serverless-friendly)
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";

const REGION = process.argv.includes("--region")
  ? process.argv[process.argv.indexOf("--region") + 1]
  : process.env.AWS_REGION || "us-east-1";

const TABLE_NAME = process.env.USER_PREFERENCES_TABLE || "agentis-user-preferences";

const client = new DynamoDBClient({ region: REGION });

async function main() {
  console.log(`[setup] Creating table "${TABLE_NAME}" in ${REGION}...`);

  // Check if table already exists
  try {
    const desc = await client.send(
      new DescribeTableCommand({ TableName: TABLE_NAME })
    );
    console.log(
      `[setup] Table "${TABLE_NAME}" already exists (status: ${desc.Table?.TableStatus}). Skipping.`
    );
    return;
  } catch (err) {
    if (err.name !== "ResourceNotFoundException") {
      throw err;
    }
  }

  // Create table
  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: "userId", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
      ],
      BillingMode: "PAY_PER_REQUEST",
      Tags: [
        { Key: "Project", Value: "agentcore-console" },
        { Key: "Feature", Value: "user-preferences" },
      ],
    })
  );

  console.log(`[setup] ✅ Table "${TABLE_NAME}" created successfully.`);
  console.log(`[setup] Add to .env: USER_PREFERENCES_TABLE=${TABLE_NAME}`);
}

main().catch((err) => {
  console.error("[setup] ❌ Failed:", err.message);
  process.exit(1);
});
