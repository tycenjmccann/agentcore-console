#!/bin/bash
set -e

# Configuration
ECR_REGISTRY="023392223961.dkr.ecr.us-east-1.amazonaws.com"
IMAGE_NAME="claude-code-runtime"
IMAGE_TAG="${1:-latest}"
FULL_IMAGE_NAME="${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "Building Claude Code Runtime ARM64 container image..."
echo "Image: ${FULL_IMAGE_NAME}"

# Ensure we're logged into ECR
echo "Logging into ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Create ECR repo if it doesn't exist
aws ecr describe-repositories --repository-names ${IMAGE_NAME} --region us-east-1 2>/dev/null || \
  aws ecr create-repository --repository-name ${IMAGE_NAME} --region us-east-1

# Build the image for ARM64
echo "Building Docker image..."
docker build --platform linux/arm64 -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${FULL_IMAGE_NAME} .

# Push to ECR
echo "Pushing to ECR..."
docker push ${FULL_IMAGE_NAME}

echo "Successfully built and pushed ${FULL_IMAGE_NAME}"
