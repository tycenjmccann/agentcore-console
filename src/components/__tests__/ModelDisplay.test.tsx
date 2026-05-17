// components/__tests__/ModelDisplay.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelDisplay } from '../ModelDisplay';
import { ModelConfig } from '../../types';

describe('ModelDisplay', () => {
  it('should render default model when no config provided', () => {
    render(<ModelDisplay />);
    expect(screen.getByText(/Bedrock - Claude Sonnet 4.5/i)).toBeInTheDocument();
  });

  it('should render Bedrock model correctly', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'us.anthropic.claude-sonnet-4-5-20250131-v1:0',
      displayName: 'Claude Sonnet 4.5',
      bedrockModelConfig: {
        modelId: 'us.anthropic.claude-sonnet-4-5-20250131-v1:0'
      }
    };
    render(<ModelDisplay modelConfig={config} />);
    expect(screen.getByText(/Bedrock - Claude Sonnet 4.5/i)).toBeInTheDocument();
  });

  it('should render OpenAI model correctly', () => {
    const config: ModelConfig = {
      provider: 'openai',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key'
      }
    };
    render(<ModelDisplay modelConfig={config} />);
    expect(screen.getByText(/OpenAI - GPT-5.5/i)).toBeInTheDocument();
  });

  it('should render Gemini model correctly', () => {
    const config: ModelConfig = {
      provider: 'gemini',
      modelId: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      geminiModelConfig: {
        modelId: 'gemini-2.5-pro',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:gemini-key'
      }
    };
    render(<ModelDisplay modelConfig={config} />);
    expect(screen.getByText(/Gemini - Gemini 2.5 Pro/i)).toBeInTheDocument();
  });

  it('should show tooltip on hover', async () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'us.anthropic.claude-sonnet-4-5-20250131-v1:0',
      displayName: 'Claude Sonnet 4.5',
      bedrockModelConfig: {
        modelId: 'us.anthropic.claude-sonnet-4-5-20250131-v1:0'
      }
    };
    render(<ModelDisplay modelConfig={config} />);
    
    const badge = screen.getByRole('button');
    fireEvent.mouseEnter(badge);
    
    // Tooltip should show full model ID
    expect(screen.getByText(/Model ID:/i)).toBeInTheDocument();
    expect(screen.getByText(/us.anthropic.claude-sonnet-4-5-20250131-v1:0/i)).toBeInTheDocument();
  });

  it('should render provider badge icon', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'test-model',
      displayName: 'Test Model',
    };
    render(<ModelDisplay modelConfig={config} />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
