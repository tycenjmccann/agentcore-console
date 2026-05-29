# Connector Validation Infrastructure

SAM template for the connector validation feature, provisioning DynamoDB, S3, EventBridge, Lambda, and SQS resources.

## Architecture

- **DynamoDB** — Single-table design with two GSIs for agent timeline and connector type queries. TTL-enabled for automatic record expiration.
- **S3** — Validation report storage with KMS encryption, lifecycle rules (IA after 30 days, expiry at 90 days), and all public access blocked.
- **EventBridge** — Custom event bus receiving `ConnectorValidationRequested` events from the console.
- **Lambda** — Multi-stage validation pipeline triggered by EventBridge events.
- **SQS DLQ** — Dead letter queue for failed event deliveries and Lambda invocations (14-day retention).

## Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) installed
- AWS credentials configured (`aws configure` or environment variables)
- Node.js 20.x (for local invocation/testing)

## Deployment

### Build

```bash
cd infrastructure/connector-validation
sam build
```

### Deploy (guided, first time)

```bash
sam deploy --guided
```

You will be prompted for:
- **Stack Name** — e.g., `connector-validation-dev`
- **AWS Region** — e.g., `us-east-1`
- **Environment** — `dev`, `staging`, or `prod`
- **ValidationTableName** — DynamoDB table name prefix (default: `agentcore-connector-validations`)
- **ReportsBucketName** — S3 bucket name prefix (default: `agentcore-validation-reports`)

The guided deploy saves your choices to `samconfig.toml` for subsequent deploys.

### Deploy (subsequent)

```bash
sam deploy
```

### Deploy to a specific environment

```bash
sam deploy --parameter-overrides Environment=staging
```

## Local Development

### Invoke locally

```bash
sam local invoke ConnectorValidatorFunction --event events/sample-validation-event.json
```

### Run with local DynamoDB

```bash
sam local start-lambda --env-vars env.json
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `sam build` | Build Lambda deployment artifacts |
| `sam deploy --guided` | Interactive first-time deploy |
| `sam deploy` | Deploy using saved config |
| `sam logs -n ConnectorValidatorFunction --tail` | Tail Lambda logs |
| `sam delete` | Tear down the stack |
| `sam validate` | Validate the template |

## Stack Outputs

After deployment, the stack exports:

| Output | Description |
|--------|-------------|
| `ValidationTableName` | DynamoDB table name |
| `ValidationTableArn` | DynamoDB table ARN |
| `ReportsBucketName` | S3 bucket name |
| `EventBusName` | EventBridge bus name |
| `EventBusArn` | EventBridge bus ARN |
| `LambdaFunctionArn` | Lambda function ARN |
| `DLQUrl` | Dead letter queue URL |
| `DLQArn` | Dead letter queue ARN |

## Sending a Test Event

```bash
aws events put-events --entries '[{
  "Source": "agentcore.console",
  "DetailType": "ConnectorValidationRequested",
  "EventBusName": "validation-events-dev",
  "Detail": "{\"connectorId\":\"conn-123\",\"agentId\":\"agent-456\",\"connectorType\":\"jira\"}"
}]'
```
