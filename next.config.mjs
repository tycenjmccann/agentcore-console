/** @type {import("next").NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@aws-sdk/**"],
  },
  serverExternalPackages: [
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/lib-dynamodb",
    "@aws-sdk/client-lambda",
    "@aws-sdk/client-s3",
    "@aws-sdk/client-cloudwatch-logs",
    "@aws-sdk/client-bedrock-runtime",
    "@aws-sdk/client-bedrock-agentcore",
    "@aws-sdk/client-bedrock-agentcore-control",
  ],
};

export default nextConfig;
