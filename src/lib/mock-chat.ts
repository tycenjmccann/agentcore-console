// Mock data for the chat/invoke interface only
// Everything else uses real ABCA APIs

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  agent_name?: string;
}

const mockResponses = [
  "I've analyzed the repository structure. The codebase uses a microservices architecture with 3 main services: auth, payments, and notifications. Let me start implementing the requested changes...",
  "I'm working on the backend implementation now. I've identified the following workstreams needed:\n\n1. **Backend API** - New endpoint for user preferences\n2. **iOS** - SwiftUI view for settings screen\n3. **Security** - Input validation and rate limiting\n\nStarting with the backend API...",
  "The implementation is complete. I've created a pull request with the following changes:\n\n- Added `POST /api/v1/preferences` endpoint\n- Updated the user model with preference fields\n- Added unit tests (12 passing)\n- Updated API documentation\n\nPR: https://github.com/org/repo/pull/142",
  "I'm reviewing the existing code patterns and will follow the established conventions. The project uses dependency injection with the factory pattern, so I'll maintain that consistency.",
  "Task complete. All tests pass and the PR is ready for review. The changes are backwards-compatible and include migration scripts for the database schema updates.",
];

export function getMockResponse(): string {
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

export function generateMockConversation(): ChatMessage[] {
  return [
    {
      id: "1",
      role: "user",
      content: "Build a new user preferences API endpoint that allows users to update their notification settings",
      timestamp: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: "2",
      role: "agent",
      content: mockResponses[0],
      timestamp: new Date(Date.now() - 290000).toISOString(),
      agent_name: "Backend Agent",
    },
    {
      id: "3",
      role: "agent",
      content: mockResponses[1],
      timestamp: new Date(Date.now() - 200000).toISOString(),
      agent_name: "Backend Agent",
    },
    {
      id: "4",
      role: "user",
      content: "Make sure to add rate limiting to the new endpoint",
      timestamp: new Date(Date.now() - 150000).toISOString(),
    },
    {
      id: "5",
      role: "agent",
      content: mockResponses[2],
      timestamp: new Date(Date.now() - 60000).toISOString(),
      agent_name: "Backend Agent",
    },
  ];
}
