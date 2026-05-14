/**
 * Skill Loader Lambda — serves skill instructions to AgentCore harness agents.
 * Called via MCP gateway as a tool: load_skill({ skill_name: "ios-architecture" })
 * Returns detailed markdown instructions that guide the agent's behavior.
 */

const SKILLS = {
  // ===== DESIGN AGENT SKILLS =====
  "ios-architecture": `# Skill: iOS Architecture Design

## Purpose
Design native iOS application features with production-grade architecture.

## Instructions
When designing an iOS feature:

1. **Component Architecture**
   - Define the module structure (Swift Package targets)
   - Specify protocols/interfaces between components
   - Design the data flow (unidirectional where possible)
   - Use @Observable pattern with SwiftUI (no ViewModels)

2. **Data Model**
   - Define all model types as structs (Codable, Sendable)
   - Specify persistence strategy (SwiftData, UserDefaults, Keychain)
   - Design API request/response types
   - Include migration strategy if modifying existing models

3. **API Contract**
   - Define REST/GraphQL endpoints needed
   - Specify request/response schemas with examples
   - Document error cases and status codes
   - Include rate limiting and retry strategy

4. **UI/UX Flow**
   - Describe each screen and its states (loading, loaded, error, empty)
   - Define navigation flow between screens
   - Specify animations and transitions
   - Include accessibility requirements (VoiceOver, Dynamic Type)

5. **System Integration**
   - iOS frameworks required (UserNotifications, HealthKit, etc.)
   - Background processing requirements
   - Permission flow and fallback behavior
   - Device capability checks

6. **Risk Assessment**
   - Memory/battery impact
   - Network failure handling
   - App Store review considerations
   - Privacy and data handling (App Tracking Transparency, etc.)

## Output Format
Produce a structured design document with clear sections, code snippets for key interfaces, and a dependency diagram described in text.`,

  "backend-systems": `# Skill: Backend Systems Design

## Purpose
Design scalable backend services, APIs, and infrastructure.

## Instructions
When designing a backend system:

1. **Service Architecture**
   - Define service boundaries and responsibilities
   - Specify communication patterns (sync REST, async events, gRPC)
   - Design for horizontal scalability
   - Document service dependencies and failure modes

2. **Data Layer**
   - Choose appropriate data stores (DynamoDB, RDS, ElastiCache, S3)
   - Design table/schema with access patterns in mind
   - Specify indexes (GSI/LSI for DynamoDB, B-tree for RDS)
   - Plan for data growth and archival

3. **API Design**
   - RESTful resource modeling with proper HTTP semantics
   - Authentication/authorization strategy (JWT, API keys, IAM)
   - Rate limiting tiers and throttling behavior
   - Versioning strategy (URL path vs header)
   - OpenAPI/Swagger specification

4. **Security**
   - Input validation and sanitization
   - SQL injection / NoSQL injection prevention
   - CORS configuration
   - Secrets management (Secrets Manager, Parameter Store)
   - Encryption at rest and in transit

5. **Observability**
   - Structured logging with correlation IDs
   - CloudWatch metrics and alarms
   - X-Ray tracing for distributed calls
   - Health check endpoints

6. **Infrastructure**
   - AWS CDK constructs needed
   - Lambda vs ECS vs Fargate decision
   - VPC configuration if needed
   - CI/CD pipeline stages

## Output Format
Produce architecture diagram (text), API specs, data model, and infrastructure requirements.`,

  "privacy-compliance": `# Skill: Privacy & Compliance Design

## Purpose
Design features that comply with privacy regulations (GDPR, CCPA, etc.)

## Instructions
When designing privacy/compliance features:

1. **Data Inventory**
   - Catalog all personal data involved
   - Map data flows (collection → processing → storage → deletion)
   - Identify data processors and controllers
   - Document legal basis for processing

2. **User Rights Implementation**
   - Right to access (data export format, timeline)
   - Right to deletion (cascade logic, retention exceptions)
   - Right to portability (machine-readable format)
   - Right to rectification (edit flows)
   - Consent management (granular opt-in/out)

3. **Technical Controls**
   - Data minimization (collect only what's needed)
   - Purpose limitation enforcement
   - Encryption and pseudonymization
   - Access controls and audit logging
   - Automated data retention and purging

4. **API Design for Privacy**
   - Data export endpoint (async job, signed download URL)
   - Deletion endpoint with cascading logic
   - Consent preferences endpoint
   - Audit log query endpoint

5. **Compliance Documentation**
   - Data Processing Agreement requirements
   - Privacy Impact Assessment
   - Record of Processing Activities updates
   - Cross-border transfer mechanisms (SCCs, adequacy)

## Output Format
Data flow diagram, API specifications, deletion cascade logic, and compliance checklist.`,

  "localization": `# Skill: Localization & i18n Design

## Purpose
Design internationalization support for multi-language applications.

## Instructions
When designing localization:

1. **String Management**
   - Catalog all user-facing strings
   - Define string key naming convention
   - Handle pluralization rules per locale
   - Support interpolation and formatted strings
   - Plan for string length variation (German ~30% longer)

2. **Content Strategy**
   - Static UI strings vs dynamic content
   - Translation workflow (source → extract → translate → integrate)
   - Fallback chain (requested locale → region → language → default)
   - Right-to-left (RTL) layout support if applicable

3. **Technical Architecture**
   - iOS: Localizable.strings / String Catalogs
   - Backend: i18n middleware, locale detection
   - Database: multi-language content storage pattern
   - Asset localization (images, videos with text)

4. **Date, Number, Currency**
   - Locale-aware formatting (DateFormatter, NumberFormatter)
   - Timezone handling
   - Currency conversion vs display-only
   - Calendar system differences

5. **Testing Strategy**
   - Pseudo-localization for layout testing
   - Screenshot generation per locale
   - String length boundary testing
   - RTL layout verification

## Output Format
String catalog structure, translation workflow, technical implementation plan, and testing matrix.`,

  "general-design": `# Skill: General Software Design

## Purpose
Produce a comprehensive technical design for any software feature.

## Instructions
Follow standard software design methodology:
1. Requirements analysis and clarification
2. Component architecture and boundaries
3. Data model and persistence
4. API contracts and integration points
5. Error handling and edge cases
6. Testing strategy
7. Deployment and rollback plan
8. Risk assessment and mitigation

## Output Format
Structured design document with diagrams described in text, interface definitions, and implementation notes.`,

  // ===== DEV AGENT SKILLS =====
  "swift-development": `# Skill: Swift/iOS Development

## Purpose
Implement iOS features with production-quality Swift code.

## Instructions
When implementing iOS features:

1. **Code Standards**
   - Swift 6.1+ with strict concurrency
   - SwiftUI with @Observable (no ViewModels, no ObservableObject)
   - Structured concurrency (async/await, actors, @MainActor)
   - Google Swift style guide compliance

2. **Architecture Pattern**
   - Model-View (MV) pattern — views own their state
   - @State for local state, @Environment for shared services
   - .task { } for async operations (never Task in onAppear)
   - Enums for view states (loading, loaded, error)

3. **Implementation Checklist**
   - [ ] Define model types (struct, Codable, Sendable)
   - [ ] Create service layer (@Observable class with async methods)
   - [ ] Build SwiftUI views with proper state management
   - [ ] Add accessibility modifiers (labels, hints, traits)
   - [ ] Handle errors with user-facing messaging
   - [ ] Write Swift Testing tests (@Test, #expect, #require)

4. **Quality Requirements**
   - No force unwraps without guard
   - All async boundaries are Sendable-safe
   - Memory: no retain cycles (weak self in closures)
   - Accessibility: VoiceOver navigable, Dynamic Type support

## Output Format
Complete implementation files with inline comments for non-obvious logic. Include unit tests.`,

  "node-typescript": `# Skill: Node.js/TypeScript Development

## Purpose
Implement backend services with TypeScript on AWS.

## Instructions
When implementing backend features:

1. **Code Standards**
   - TypeScript strict mode
   - ESM modules (import/export)
   - Zod for runtime validation
   - Proper error types (never throw raw strings)

2. **AWS Lambda Pattern**
   - Single-purpose handlers
   - Middy middleware for cross-cutting concerns
   - Environment-based configuration
   - Structured JSON logging

3. **Implementation Checklist**
   - [ ] Define types/interfaces for all data shapes
   - [ ] Input validation with Zod schemas
   - [ ] Service layer with dependency injection
   - [ ] Error handling with typed errors
   - [ ] Unit tests with vitest
   - [ ] Integration test with real AWS services

4. **CDK Infrastructure**
   - Define constructs for each resource
   - Use environment-specific configuration
   - Include alarms and dashboards
   - Document deployment steps

## Output Format
Implementation files, CDK constructs, tests, and deployment instructions.`,

  "data-services": `# Skill: Data Services Development

## Purpose
Implement data processing, export, and compliance features.

## Instructions
When implementing data services:

1. **Data Export**
   - Async job pattern (request → process → notify → download)
   - Signed S3 URLs for secure downloads
   - Progress tracking and resumability
   - Format: JSON (machine), CSV (human), ZIP (bundled)

2. **Data Deletion**
   - Soft delete with grace period
   - Cascade logic across services
   - Audit trail of deletion actions
   - Verification endpoint (confirm deletion complete)

3. **Implementation Pattern**
   - Step Functions for multi-stage pipelines
   - SQS for decoupled processing
   - DynamoDB streams for cascade triggers
   - S3 lifecycle rules for automatic cleanup

## Output Format
Lambda handlers, Step Function definition, CDK infrastructure, and integration tests.`,

  "i18n-tooling": `# Skill: Internationalization Tooling

## Purpose
Implement localization infrastructure and tooling.

## Instructions
1. String extraction pipeline (code → string catalog)
2. Translation management integration
3. Runtime locale switching
4. Pluralization and interpolation engine
5. CI checks for missing translations

## Output Format
Implementation code, CI scripts, and integration guide.`,

  "full-stack": `# Skill: Full-Stack Development

## Purpose
Implement features spanning frontend and backend.

## Instructions
1. API implementation (Lambda/Express handlers)
2. Frontend integration (React/SwiftUI consuming the API)
3. End-to-end type safety
4. Integration testing across the stack
5. Deployment of both layers

## Output Format
Backend handlers, frontend components, shared types, and E2E tests.`,
};

export const handler = async (event) => {
  console.log("Skill loader invoked:", JSON.stringify(event));

  // AgentCore gateway sends tool input directly as the event
  // Format is just: { "skill_name": "ios-architecture" }
  const skillName = event.skill_name || event.input?.skill_name || event.arguments?.skill_name;

  if (!skillName) {
    const available = Object.keys(SKILLS).join(", ");
    return {
      content: [
        {
          type: "text",
          text: `skill_name is required. Available skills: ${available}`,
        },
      ],
    };
  }

  const content = SKILLS[skillName];
  if (!content) {
    const available = Object.keys(SKILLS).join(", ");
    return {
      content: [
        {
          type: "text",
          text: `Unknown skill: "${skillName}". Available skills: ${available}`,
        },
      ],
    };
  }

  // Return in MCP tool result format
  return {
    content: [
      {
        type: "text",
        text: content,
      },
    ],
  };
};
