# Workflow Management Feature

## Overview

This feature adds a complete workflow management interface to the Agentis Hub console, allowing users to create and monitor agentic workflows from requirements intake through deployment.

## Features

### 1. Workflow List View (`/workflow`)
- **Dashboard-style overview** with key metrics:
  - Total workflows
  - Active workflows
  - Completed workflows
  - Workflows with errors
- **Filtering** by workflow phase (intake, requirements, design, development, review, complete, error)
- **Quick navigation** to individual workflows
- **Progress tracking** showing task completion percentages

### 2. Workflow Detail View (`/workflow/[id]`)
- **Comprehensive workflow information**:
  - Title, description, and unique IDs
  - Repository configuration
  - Current phase and status
- **Tabbed interface** for viewing:
  - **Agent Tasks**: All agent tasks with their current status, output, and errors
  - **Tickets**: Related Jira tickets with status tracking
  - **Messages**: Agent-to-agent communication history
- **Real-time status indicators** showing task progress

### 3. Workflow Creation (`/workflow/new`)
- **Guided form** for creating new workflows
- **Repository configuration**:
  - Support for monorepo or multi-repo layouts
  - Multiple repository targets per workflow
  - Platform-specific configurations (iOS, Android, backend, shared)
  - Path prefixes for monorepo structures
- **Validation** ensuring required fields are provided
- **Immediate navigation** to workflow detail on creation

### 4. API Routes (`/api/workflow`)
- **GET** - List all workflows or get specific workflow details
- **POST** - Create new workflows with full configuration
- **PATCH** - Update workflow state, phase, and agent tasks

## Architecture

### Type System
All workflows use the comprehensive type definitions from `src/lib/workflow/types.ts`:
- `WorkflowState` - Complete workflow state including phase, tasks, messages
- `JiraTicket` - Ticket tracking with status, assignee, dependencies
- `AgentTask` - Individual agent task execution details
- `RepoConfig` - Repository configuration for code generation

### State Management
Currently uses in-memory storage for demo purposes. Production deployment should replace with:
- **S3** for workflow state persistence
- **DynamoDB** for ticket and task tracking
- **EventBridge** for workflow orchestration

### UI Components
Built with:
- **Next.js 15** (App Router)
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Consistent design system** matching existing AgentCore console

## Usage

### Creating a Workflow

1. Navigate to `/workflow`
2. Click "New Workflow"
3. Fill in:
   - **Title**: Brief description of the work
   - **Description**: Detailed requirements (optional)
   - **Repository Layout**: Monorepo or multi-repo
   - **Repositories**: One or more Git repositories
     - URL (required)
     - Default branch (default: main)
     - Platform (iOS, Android, backend, shared)
     - Path prefix (for monorepos)
4. Click "Create Workflow"

### Monitoring Workflows

1. Navigate to `/workflow`
2. View metrics at the top (total, active, complete, errors)
3. Filter workflows by phase if needed
4. Click on any workflow to view details

### Viewing Workflow Details

1. Click on a workflow from the list
2. View workflow information at the top
3. Switch between tabs:
   - **Tasks** - See all agent tasks and their status
   - **Tickets** - View related Jira tickets
   - **Messages** - Read agent communication history
4. Task details show:
   - Agent name and ticket assignment
   - Current status with visual indicators
   - Output or error messages
   - Git branch information (for dev agents)

## Integration Points

### Navigation
- Added to sidebar as "Workflows" with GitBranch icon
- Positioned between "Build" and "Routing"

### Future Enhancements
1. **SSE Integration**: Real-time workflow updates via Server-Sent Events
2. **Agent Orchestration**: Trigger agent tasks from the UI
3. **Ticket Management**: Create and update tickets directly
4. **Artifact Viewer**: View design docs, code diffs, and PRs inline
5. **Workflow Templates**: Pre-configured workflows for common patterns
6. **Workflow Analytics**: Metrics and insights on workflow performance

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── workflow/
│   │       └── route.ts           # API handlers
│   └── workflow/
│       ├── page.tsx               # List view
│       ├── new/
│       │   └── page.tsx           # Creation form
│       └── [id]/
│           └── page.tsx           # Detail view
├── components/
│   └── layout/
│       └── Sidebar.tsx            # Updated navigation
└── lib/
    └── workflow/
        └── types.ts               # Type definitions (existing)
```

## Testing

### Manual Testing Steps

1. **List View**:
   - Navigate to `/workflow`
   - Verify stats cards display correctly
   - Test filtering by different phases
   - Confirm empty state shows when no workflows exist

2. **Creation**:
   - Click "New Workflow"
   - Try submitting with empty title (should show error)
   - Fill in valid data and create
   - Verify redirect to detail page

3. **Detail View**:
   - View workflow information
   - Switch between Tasks, Tickets, and Messages tabs
   - Verify empty states show when no data exists
   - Test navigation back to list

4. **Navigation**:
   - Verify "Workflows" link appears in sidebar
   - Confirm active state highlights correctly
   - Test navigation from all pages

## Production Considerations

### Before Deployment
1. **Replace in-memory storage** with persistent backend (S3 + DynamoDB)
2. **Add authentication** to protect workflow data
3. **Implement SSE** for real-time updates
4. **Add error boundaries** for better error handling
5. **Performance optimization**:
   - Pagination for large workflow lists
   - Lazy loading for workflow details
   - Caching for frequently accessed workflows

### Security
- Validate all inputs on both client and server
- Sanitize repository URLs to prevent injection
- Implement proper access controls
- Audit log for workflow operations

### Monitoring
- Track workflow creation rates
- Monitor workflow completion times
- Alert on workflow errors
- Measure agent task performance
