# Workflow Management Feature

This implementation adds comprehensive workflow management capabilities to the AgentCore console.

## Features Implemented

### 1. Workflow List Page (`/workflows`)
- **Overview Dashboard**: View all workflows with status, phase, and duration
- **Stats Cards**: Quick metrics for total, active, completed, and failed workflows
- **Create Workflow Modal**: Start new agentic workflows with title, description, and repository config
- **Real-time Status**: Visual indicators for workflow phases (intake, requirements, design, development, review, complete, error)

### 2. Workflow Detail Page (`/workflows/[id]`)
- **Workflow Information**: Title, description, epic ID, and overall status
- **Agent Task Tracking**: See all agents working on the workflow with their status, branches, and output
- **Repository Configuration**: View linked repositories and their platform types
- **Duration Tracking**: See how long each task and the overall workflow has been running
- **Notifications**: Display human notifications for blockers, reviews, PRs, and errors

### 3. API Routes

#### `/api/workflows` (GET, POST, PATCH)
- **GET**: List all workflows or fetch a specific workflow by ID
- **POST**: Create a new workflow with title, description, and repo config
- **PATCH**: Update workflow phase, add agent tasks, or add notifications

#### `/api/tickets` (GET, POST, PATCH)
- **GET**: List all tickets or fetch a specific ticket by ID
- **POST**: Create new tickets (epic, story, task)
- **PATCH**: Update ticket status, assignee, or add comments

#### `/api/workflows/stream` (SSE)
- Server-Sent Events endpoint for real-time workflow updates
- Streams agent status changes, phase transitions, and completion events

### 4. Type Safety
All components use the existing TypeScript types from `src/lib/workflow/types.ts`:
- `WorkflowState`
- `JiraTicket`
- `AgentTask`
- `WorkflowPhase`
- `TicketStatus`

### 5. Navigation
- Added "Workflows" navigation item to the sidebar
- Proper routing with Next.js App Router
- Active state indication for current page

## Data Storage

Currently uses in-memory storage with seed data for development. In production, this should be replaced with:
- DynamoDB for persistent workflow state
- S3 for workflow artifacts
- EventBridge for workflow event streaming

## Mock Data

The implementation includes realistic mock data:
- Sample workflow (wf_1778997791713_48ltk8) with agent tasks
- Sample tickets (TEAM-58, TEAM-59, TEAM-1) with comments
- Proper relationships between tickets (parent/child, blockers)

## UI Components

### Reusable Components
- `StatCard`: Displays metric with icon, label, and value
- `CreateWorkflowModal`: Form for creating new workflows
- Status badges with dynamic colors based on phase/status
- Duration formatting utilities

### Design System
Follows the existing AgentCore console design:
- Dark theme with surface colors
- Brand color (orange) for primary actions
- Consistent spacing and typography
- Lucide icons for visual consistency

## Future Enhancements

1. **Real-time Updates**: Connect SSE endpoint to actual workflow events
2. **Persistence**: Replace in-memory storage with DynamoDB
3. **Workflow Actions**: Add pause, resume, cancel operations
4. **Agent Chat**: Inline A2A message thread viewer
5. **Artifacts Viewer**: Display design docs, code diffs, PRs inline
6. **Advanced Filtering**: Filter workflows by phase, agent, date range
7. **Workflow Templates**: Pre-configured workflow types for common patterns

## Testing

To test the implementation:

1. Start the dev server: `npm run dev`
2. Navigate to http://localhost:3000/workflows
3. View the mock workflow or create a new one
4. Click on a workflow to see detailed agent task view
5. Verify navigation, stats, and status indicators

## Files Created

- `src/app/api/workflows/route.ts` - Workflow CRUD API
- `src/app/api/workflows/stream/route.ts` - SSE streaming endpoint
- `src/app/api/tickets/route.ts` - Ticket management API
- `src/app/workflows/page.tsx` - Workflows list page
- `src/app/workflows/[id]/page.tsx` - Workflow detail page
- `src/components/layout/Sidebar.tsx` - Updated navigation (modified)

## Integration Points

The workflow feature integrates with existing AgentCore systems:
- Uses existing type definitions from `src/lib/workflow/types.ts`
- Follows existing API patterns (Next.js route handlers)
- Uses existing UI components and styling
- Maintains consistency with agent invocation flows