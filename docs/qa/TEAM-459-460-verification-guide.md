# QA Verification Guide — TEAM-459 & TEAM-460

## Workflow: wf_1779248410004_5c84v6
## Epic: TEAM-457
## Feature Branch: `feature/TEAM-471-frontend-dev`
## Pull Request: https://github.com/tycenjmccann/agentcore-console/pull/53
## Repository: tycenjmccann/agentcore-console (owner: tycenjmccann)

---

## Overview

This document provides all information needed for the QA agent (TEAM-461) to verify the implementation of:
1. **TEAM-459**: Collapsible history sidebar with resize support
2. **TEAM-460**: Enhanced intake card visual hierarchy and spacing

---

## Files Changed

### New Files
| File | Path | Purpose |
|------|------|--------|
| useLocalStorage hook | `src/hooks/useLocalStorage.ts` | Custom hook for SSR-safe localStorage persistence |
| HistorySidebar component | `src/components/workflow/HistorySidebar.tsx` | Resizable, collapsible sidebar component |

### Modified Files
| File | Path | Purpose |
|------|------|--------|
| Workflow page | `src/app/workflow/page.tsx` | Refactored to use new HistorySidebar component |
| IntakeForm component | `src/components/workflow/IntakeForm.tsx` | Improved visual hierarchy (headings > body > metadata) |
| Workflow index | `src/components/workflow/index.ts` | Added HistorySidebar export |

---

## TEAM-459: Collapsible History Sidebar — Verification Checklist

### Functional Requirements
- [ ] Sidebar renders with default width of 288px
- [ ] Sidebar is resizable by dragging the right edge handle
- [ ] Minimum resize width is 200px (cannot go smaller)
- [ ] Maximum resize width is 400px (cannot go larger)
- [ ] Collapse button (ChevronLeft icon) reduces sidebar to 48px icon strip
- [ ] Expand button (ChevronRight icon) restores sidebar to previous width
- [ ] Transition is smooth with 250ms ease-in-out animation
- [ ] Collapsed state persists across page loads via localStorage key `console_sidebar_collapsed`
- [ ] Sidebar width persists via localStorage key `console_sidebar_width`
- [ ] Workflow run entries display with title and relative timestamps (e.g., "2h ago")
- [ ] Workflow list scrolls when content overflows (`overflow-y: auto`)
- [ ] Empty state shown when no workflows exist
- [ ] "No matching workflows" shown when search returns no results
- [ ] Clicking a workflow entry navigates to that workflow run
- [ ] Search input filters workflows by title, epicId, or id
- [ ] Active workflows shown separately from completed workflows
- [ ] New Workflow button (Plus icon) is available in both collapsed and expanded states

### Accessibility Requirements
- [ ] Collapse/expand toggle has `aria-expanded` attribute ("true" when expanded, "false" when collapsed)
- [ ] Collapse/expand toggle has descriptive `aria-label` ("Collapse sidebar" / "Expand sidebar")
- [ ] Keyboard support: Enter/Space keys toggle collapse state
- [ ] Resize handle has `role="separator"` and `aria-orientation="vertical"`
- [ ] Resize handle has `aria-valuenow`, `aria-valuemin`, `aria-valuemax` attributes
- [ ] Selected sidebar item has `aria-current="true"`
- [ ] Search input has `aria-label="Search workflow history"`
- [ ] Sidebar container has `role="complementary"` and `aria-label="Workflow history sidebar"`

### Code Quality
- [ ] `useLocalStorage` hook handles SSR correctly (reads only after mount)
- [ ] Mouse event listeners are properly cleaned up on unmount
- [ ] Cursor style is reset after resize ends
- [ ] Component uses `cn()` utility for conditional classNames

---

## TEAM-460: Intake Card Visual Hierarchy — Verification Checklist

### Visual Hierarchy
- [ ] Card header has icon (Sparkles) + title ("Start Team Workflow") + description group
- [ ] Form sections use `<fieldset>` with `<legend>` elements
- [ ] Section legends have icons: FileText (Core Details), Link2 (Input Sources), GitBranch (Target Repository), Sparkles (Model Selection)
- [ ] Section legends use uppercase, tracking-wider, small font style
- [ ] Required fields have red asterisk indicator

### Spacing & Layout
- [ ] Sections have consistent spacing (`space-y-6` between sections, `space-y-4` within)
- [ ] Inputs have consistent padding (`px-3 py-2.5`)
- [ ] Form max-width constrained (`max-w-2xl mx-auto`)

### Theme Awareness
- [ ] All colors use CSS variables (no hardcoded `zinc-*` classes)
- [ ] Background: `var(--color-surface-2)` on inputs
- [ ] Border: `var(--color-border)` on inputs
- [ ] Text: `var(--color-text-primary)` for labels, `var(--color-text-muted)` for placeholders
- [ ] Focus: `focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20`

### Interactive States
- [ ] All inputs have focus ring with blue accent
- [ ] Submit button has shadow (`shadow-lg shadow-blue-600/20`)
- [ ] Submit button hover changes shadow (`hover:shadow-blue-500/30`)
- [ ] Submit button disabled state has reduced opacity and not-allowed cursor
- [ ] Loading state shows animated spinner SVG with "Starting workflow..." text
- [ ] Source remove button has hover:text-red-400 transition
- [ ] Source items have border and rounded-lg styling

### Model Selection Section
- [ ] Shows "(optional)" label in legend
- [ ] Graceful degradation: hides section on API error
- [ ] Loading state: shows animated pulse placeholder
- [ ] Default model shown with ⭐ emoji prefix
- [ ] Description shown below select with ℹ️ emoji
- [ ] "(Recommended)" badge shown for default model in green

---

## Implementation Details for Code Review

### useLocalStorage Hook (`src/hooks/useLocalStorage.ts`)
```typescript
// Key behaviors to verify:
// 1. Uses useState with defaultValue initially (SSR-safe)
// 2. Reads from localStorage in useEffect (client-side only)
// 3. Supports function updater pattern: setValue(prev => newValue)
// 4. Catches and warns on localStorage errors (doesn't throw)
// 5. Generic type parameter <T> supports boolean, number, string, etc.
```

### HistorySidebar Component (`src/components/workflow/HistorySidebar.tsx`)
```typescript
// Key architectural decisions:
// 1. Exports WorkflowEntry interface for parent usage
// 2. Uses composition: HistorySidebar > SidebarItem + EmptyState
// 3. Resize uses document-level mouse listeners (not element-level)
// 4. Body cursor/userSelect set during resize, cleaned up after
// 5. Transition class only applied during collapse/expand (not resize)
// 6. Width controlled via inline style, not Tailwind class
```

### IntakeForm Component (`src/components/workflow/IntakeForm.tsx`)
```typescript
// Key changes from previous version:
// 1. Replaced all zinc-* hardcoded colors with CSS variables
// 2. Wrapped form fields in <fieldset> with <legend>
// 3. Added icon imports (FileText, GitBranch, Link2, Sparkles)
// 4. Added loading spinner SVG in submit button
// 5. Enhanced focus states with ring-1 + ring-blue-500/20
// 6. Source items now have border + rounded-lg (were flat before)
```

---

## How to Access the Code

### Via Pull Request
PR #53: https://github.com/tycenjmccann/agentcore-console/pull/53
- View all file diffs
- Review individual file changes

### Via Branch
```bash
git fetch origin feature/TEAM-471-frontend-dev
git checkout feature/TEAM-471-frontend-dev
```

### Via GitHub API
```
GET /repos/tycenjmccann/agentcore-console/contents/src/hooks/useLocalStorage.ts?ref=feature/TEAM-471-frontend-dev
GET /repos/tycenjmccann/agentcore-console/contents/src/components/workflow/HistorySidebar.tsx?ref=feature/TEAM-471-frontend-dev
GET /repos/tycenjmccann/agentcore-console/contents/src/components/workflow/IntakeForm.tsx?ref=feature/TEAM-471-frontend-dev
GET /repos/tycenjmccann/agentcore-console/contents/src/app/workflow/page.tsx?ref=feature/TEAM-471-frontend-dev
```

---

## Testing Instructions

1. **Clone the branch**: `git checkout feature/TEAM-471-frontend-dev`
2. **Install deps**: `npm install`
3. **Run dev server**: `npm run dev`
4. **Navigate to**: `http://localhost:3000/workflow`
5. **Test sidebar**: Try resizing, collapsing, expanding, searching
6. **Test intake card**: Click "New Workflow" button, verify visual hierarchy
7. **Test persistence**: Collapse sidebar, refresh page — should remain collapsed
8. **Test accessibility**: Tab navigation, screen reader, ARIA attributes
