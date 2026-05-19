# PRD: Collapsible History Sidebar + Intake Card Enhancements

## Summary

Enhance the workflow page (`src/app/workflow/page.tsx`) with a collapsible, resizable history sidebar that auto-hides when a workflow is selected, and enrich the Intake phase card in the pipeline visualization (`src/components/workflow/WorkflowBoard.tsx`) to display the epic name and expandable source links.

## Current State

- The left sidebar is fixed at `w-72` (288px) and always visible
- Epic titles in the sidebar list are truncated with `truncate` CSS class
- The Intake phase card in the pipeline shows generic labels ("Upload PRD / Mockup / Figma", "Set Target Git Repo", "S3 Artifact Storage") with no connection to the actual workflow data
- There is no way to see what sources were uploaded or access them from the pipeline view

## Requirements

### 1. Collapsible Sidebar

**Behavior:**
- The sidebar should be collapsible/expandable with a toggle button
- When the user selects a workflow from the list, the sidebar auto-collapses to give the pipeline full width
- A small caret/chevron button appears on the left edge when collapsed, allowing re-expansion
- Default state on page load: open (unless a workflow ID is in the URL, then collapsed)

**Resize:**
- A drag handle on the right edge of the sidebar allows the user to resize it
- Minimum width: 220px
- Maximum width: 480px
- Default width: 320px (wider than current 288px to show full epic names)

**Text wrapping:**
- Epic titles in the sidebar list items should wrap (not truncate) so the full name is readable
- The wider default width + wrapping ensures epic names are fully visible

**Visual:**
- Collapse transition should be smooth (CSS transition, ~300ms)
- The collapse toggle should be a ChevronLeft icon in the sidebar header
- The expand toggle (when collapsed) should be a ChevronRight on the left edge, with subtle styling

### 2. Intake Card — Epic Name Display

**When a workflow is loaded:**
- The Intake phase box (Phase 1) in the pipeline should display the epic/feature title from `state.input.title`
- Display it as a small badge or subtitle below the "Intake" phase name
- Keep it concise — truncate with ellipsis if longer than ~40 characters, with a title tooltip for the full text

### 3. Intake Card — Expandable Source Links

**Tool items in the Intake "User Actions" section should be expandable:**
- Each tool item (e.g., "Upload PRD / Mockup / Figma", "S3 Artifact Storage") gets a small chevron/caret indicator
- Clicking the item expands it downward to reveal the actual sources from `state.input.sources`
- Each source is shown as a clickable link:
  - S3 sources (`s3://...`): Show the filename/key, link generates a pre-signed URL or opens in S3 console
  - URL sources (`https://...`): Show the URL, opens in new tab
- The "Jira Epic Created" output item should show the epic ID (e.g., "TEAM-173") when expanded

**Data source:**
- Sources come from `state.input.sources: IntakeSource[]` (already available in WorkflowState)
- Each source has `{ type: "url" | "upload" | "s3", value: string, label?: string }`

## Technical Context

### Files to modify:
1. `src/app/workflow/page.tsx` — Sidebar collapse/resize/auto-hide logic
2. `src/components/workflow/WorkflowBoard.tsx` — Intake card enhancements (epic name + expandable items)

### Key interfaces (from `src/lib/workflow/types.ts`):
```typescript
interface IntakeSource {
  type: IntakeSourceType; // "url" | "upload" | "s3"
  value: string;         // URL, file path, or s3://bucket/key
  contentType?: string;
  label?: string;
}

interface WorkflowInput {
  title: string;
  description: string;
  repoConfig: RepoConfig;
  sources: IntakeSource[];
  modelOverride?: ModelOverride;
}
```

### Component interface (do NOT change):
```typescript
<WorkflowBoard workflowId={string} />
```

### State available in WorkflowBoard:
- `state.input.title` — the epic/feature name
- `state.input.sources` — array of IntakeSource objects
- `state.epicId` — the Jira epic ticket ID (e.g., "TEAM-173")

### Dependencies already in project:
- `lucide-react` — for ChevronLeft, ChevronRight, GripVertical, ChevronDown icons
- Tailwind CSS — for utility classes
- CSS variables: `--color-border`, `--color-bg-secondary`, `--color-bg-tertiary`, `--color-text-primary`, `--color-text-muted`

## Design Constraints

- Dark theme only (bg #0f1419 for pipeline area, sidebar uses CSS variables)
- No new npm dependencies
- Must work at 1920x1080 viewport (demo recording size)
- Pipeline visualization is 1720px wide — needs all horizontal space possible (hence collapsible sidebar)
- Smooth animations, no jank

## Acceptance Criteria

1. Sidebar collapses when user clicks a workflow from the list
2. Collapsed state shows a small expand chevron on the left edge
3. Clicking the chevron re-expands the sidebar
4. Sidebar is resizable via drag handle (220px to 480px range)
5. Epic titles in sidebar wrap instead of truncating
6. Intake phase card shows the workflow title as a subtitle/badge
7. Intake "User Actions" items are expandable with a chevron indicator
8. Expanded items show actual source links from the workflow state
9. Source links for S3 URIs show the filename portion
10. Source links for URLs open in a new tab
11. Epic ID is visible in the Intake "Trigger" section when a workflow is loaded

## Out of Scope

- No backend changes needed
- No new API endpoints
- No pre-signed URL generation (just show the S3 path for now, clickable copy)
- No changes to the pipeline-config.ts or agents.json
- No changes to SSE/event handling
