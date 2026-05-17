// types.ts

export interface ModelConfig {
  provider: 'bedrock' | 'openai' | 'gemini';
  modelId: string;
  displayName: string;
  bedrockModelConfig?: { modelId: string };
  openAiModelConfig?: { modelId: string; apiKeyArn: string };
  geminiModelConfig?: { modelId: string; apiKeyArn: string };
}

export interface WorkflowState {
  workflowId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  modelConfig?: ModelConfig;
  // ... other existing properties
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed';
  assignee?: string;
  blockedBy?: string[];
}

export interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'completed';
}
