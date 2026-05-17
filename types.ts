// Existing types (preserve all existing types)

// Model Configuration Types
export interface ModelConfig {
  provider: 'bedrock' | 'openai' | 'gemini';
  modelId: string;
  displayName: string;
  bedrockModelConfig?: {
    modelId: string;
  };
  openAiModelConfig?: {
    modelId: string;
    apiKeyArn: string;
  };
  geminiModelConfig?: {
    modelId: string;
    apiKeyArn: string;
  };
}

// Workflow State Types
export interface WorkflowState {
  workflowId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  tickets: WorkflowTicket[];
  requirements?: string;
  modelConfig?: ModelConfig; // New field
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTicket {
  id: string;
  title: string;
  description: string;
  assignee: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  blockedBy?: string[];
  createdAt: string;
  completedAt?: string;
}

// Intake Form Types
export interface IntakeFormData {
  projectName: string;
  description: string;
  requirements: string;
  modelConfig?: ModelConfig; // New field
}

// API Response Types
export interface ApiAvailabilityResponse {
  openAiAvailable: boolean;
  geminiAvailable: boolean;
}
