import { render, screen } from '@testing-library/react';
import { ModelDisplay } from '@/components/ModelDisplay';
import { ModelConfig } from '@/lib/types';

describe('ModelDisplay', () => {
  it('displays default model when modelConfig is undefined', () => {
    render(<ModelDisplay />);
    
    expect(screen.getByText(/Bedrock - Claude Sonnet 4.5/)).toBeInTheDocument();
  });

  it('displays Bedrock model correctly', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'us.anthropic.claude-opus-4-5-v2:0',
      displayName: 'Claude Opus 4.5',
      bedrockModelConfig: {
        modelId: 'us.anthropic.claude-opus-4-5-v2:0'
      }
    };

    render(<ModelDisplay modelConfig={config} />);
    
    expect(screen.getByText(/Bedrock - Claude Opus 4.5/)).toBeInTheDocument();
  });

  it('displays OpenAI model correctly', () => {
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
    
    expect(screen.getByText(/OpenAI - GPT-5.5/)).toBeInTheDocument();
  });

  it('displays Google Gemini model correctly', () => {
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
    
    expect(screen.getByText(/Google Gemini - Gemini 2.5 Pro/)).toBeInTheDocument();
  });

  it('displays Unknown Model for invalid config', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: '',
      displayName: ''
    };

    render(<ModelDisplay modelConfig={config} />);
    
    expect(screen.getByText(/Unknown Model/)).toBeInTheDocument();
  });

  it('shows tooltip with full model ID on hover', async () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'us.anthropic.claude-sonnet-4-5-v2:0',
      displayName: 'Claude Sonnet 4.5',
      bedrockModelConfig: {
        modelId: 'us.anthropic.claude-sonnet-4-5-v2:0'
      }
    };

    render(<ModelDisplay modelConfig={config} />);
    
    // Check that model ID is in the document (in tooltip)
    expect(screen.getByText('us.anthropic.claude-sonnet-4-5-v2:0')).toBeInTheDocument();
  });

  it('handles missing displayName gracefully', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'some-model-id',
      displayName: '',
      bedrockModelConfig: {
        modelId: 'some-model-id'
      }
    };

    render(<ModelDisplay modelConfig={config} />);
    
    expect(screen.getByText(/Unknown Model/)).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(<ModelDisplay />);
    
    // Check for key styling classes
    expect(container.querySelector('.bg-slate-100')).toBeInTheDocument();
    expect(container.querySelector('.rounded-md')).toBeInTheDocument();
  });
});
