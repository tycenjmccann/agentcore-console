# Design: Collapsible History Sidebar + Intake Card Enhancements

## Overview
This document specifies UI/UX design enhancements for the Workflow page (`/workflow`) in the Agentis Hub console. Two key areas are addressed:

1. **Collapsible History Sidebar** — Transform the fixed 288px sidebar into a collapsible panel with smooth transitions, persistent state, and improved information density.
2. **Intake Card Enhancements** — Elevate the IntakeForm with better visual hierarchy, progressive disclosure, form validation UX, and contextual guidance.

---

## 1. Collapsible History Sidebar

### 1.1 Current State Analysis

The existing sidebar (`src/app/workflow/page.tsx`):
- Fixed width: `w-72` (288px)
- Always visible, consuming horizontal real-estate
- Contains: header with "New Workflow" button, search input, active/completed workflow lists
- No mechanism to collapse or minimize
- On smaller viewports, the pipeline visualization is cramped

### 1.2 Design Goals

| Goal | Rationale |
|------|----------|
| Maximize pipeline canvas area | WorkflowBoard is 1720px wide; users need horizontal space |
| Preserve quick access to history | Context switching between workflows is a core action |
| Persist collapse preference | Avoid user frustration on page navigation |
| Accessible keyboard interaction | Sidebar toggle must be keyboard-operable |
| Smooth animation | Collapse/expand should feel native and responsive |

### 1.3 Component Architecture

```
WorkflowPage
├── CollapsibleSidebar (new wrapper)
│   ├── SidebarHeader (title, new button, collapse toggle)
│   ├── SidebarSearch (search input)
│   ├── WorkflowList
│   │   ├── ActiveSection
│   │   │   └── WorkflowListItem[]
│   │   └── CompletedSection
│   │       └── WorkflowListItem[]
│   └── CollapsedRail (visible when collapsed)
│       ├── NewWorkflowButton (icon-only)
│       └── RecentIndicators (status dots)
└── MainContent
    ├── IntakeForm | WorkflowBoard | EmptyState
    └── (expands to fill available space)
```

### 1.4 Visual States

#### Expanded State (Default)
- Width: `w-72` (288px) — matches current
- Full sidebar content visible
- Toggle button: `ChevronLeft` icon in header area
- Transition: `width 300ms cubic-bezier(0.4, 0, 0.2, 1)`

#### Collapsed State
- Width: `w-14` (56px) — icon rail only
- Shows: collapse toggle (`ChevronRight`), new workflow icon button, status dots for active workflows
- Tooltip on hover for collapsed items
- Search and text labels hidden

#### Responsive Behavior
- **< 1280px (lg breakpoint)**: Auto-collapse sidebar, show overlay on expand
- **≥ 1280px**: Normal collapsible behavior
- **< 768px (md breakpoint)**: Sidebar becomes a slide-over drawer with backdrop

### 1.5 Interaction Specifications

| Action | Behavior |
|--------|----------|
| Click toggle button | Collapse/expand with 300ms animation |
| Keyboard: `Ctrl+\` or `Cmd+\` | Toggle sidebar collapse |
| Click collapsed rail item | Expand sidebar and select workflow |
| Hover collapsed icon | Show tooltip with workflow title |
| Drag edge (optional, P2) | Resize sidebar width (280–400px) |

### 1.6 State Persistence

```typescript
// Use localStorage for persistence
const SIDEBAR_COLLAPSED_KEY = 'workflow-sidebar-collapsed';

// Hook: useCollapsibleSidebar
interface CollapsibleSidebarState {
  isCollapsed: boolean;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
}
```

### 1.7 Collapsed Rail Design

```
┌──────┐
│  ☰   │  ← Toggle (ChevronRight) 
├──────┤
│  +   │  ← New Workflow (Plus icon)
├──────┤
│  🟢  │  ← Active workflow 1 (green dot + tooltip)
│  🟢  │  ← Active workflow 2
├──────┤
│  ⚫  │  ← Completed workflow (muted dot)
│  ⚫  │  
│  ⚫  │  
└──────┘
```

### 1.8 Animation Details

```css
.sidebar-container {
  transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.sidebar-content {
  opacity: 1;
  transition: opacity 150ms ease-in;
}

.sidebar-container.collapsed .sidebar-content {
  opacity: 0;
  pointer-events: none;
}

.sidebar-rail {
  opacity: 0;
  transition: opacity 150ms ease-out 200ms; /* delay until collapse completes */
}

.sidebar-container.collapsed .sidebar-rail {
  opacity: 1;
  pointer-events: auto;
}
```

### 1.9 Accessibility Requirements

- Toggle button: `aria-expanded="true|false"`, `aria-controls="sidebar-content"`
- Sidebar container: `role="complementary"`, `aria-label="Workflow history"`
- Keyboard shortcut communicated via tooltip on toggle button
- Focus trap: not needed (sidebar is not modal in expanded state)
- Screen reader: collapsed state announced with "Sidebar collapsed, press Enter to expand"

---

## 2. Intake Card Enhancements

### 2.1 Current State Analysis

The existing `IntakeForm` (`src/components/workflow/IntakeForm.tsx`):
- Simple linear form layout
- Fields: Title, Description/PRD, Input Sources, Target Repository, Model Selection
- No progressive disclosure — all fields visible immediately
- No real-time validation feedback
- No templates or quick-start patterns
- Fixed dark theme colors (zinc-*) instead of CSS variable system

### 2.2 Design Goals

| Goal | Rationale |
|------|----------|
| Reduce cognitive load | Progressive disclosure for advanced options |
| Faster time-to-submit | Templates and smart defaults |
| Better validation UX | Inline feedback, not just disabled button |
| Theme-aware styling | Use CSS variables instead of hardcoded zinc colors |
| Visual card treatment | Elevated card presentation with subtle depth |
| Contextual help | Inline tips and examples for each field |

### 2.3 Enhanced Form Layout — Progressive Disclosure

```
┌─────────────────────────────────────────────────────────┐
│  🚀 Start Team Workflow                                  │
│  Provide product input and agents handle the rest.       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Quick Start Templates ──────────────────────────┐  │
│  │ [Feature]  [Bug Fix]  [Refactor]  [Blank]        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  Feature Title *                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ e.g., Add profile photo carousel                 │    │
│  └─────────────────────────────────────────────────┘    │
│  ✓ Clear and specific titles help agents scope work     │
│                                                          │
│  Description / PRD *                                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                   │    │
│  │ (rich textarea with line count indicator)         │    │
│  │                                                   │    │
│  └─────────────────────────────────────────────────┘    │
│  📝 240 chars · Tip: Include user stories for best      │
│     results                                              │
│                                                          │
│  ─── Advanced Options ─────────── [▼ Expand] ──────     │
│                                                          │
│  (collapsed by default — contains:)                      │
│  • Input Sources (URL attachments)                       │
│  • Target Repository configuration                      │
│  • Model Selection                                       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  [  ▶  Start Team Workflow  ]                            │
│                                                          │
│  Estimated: ~3-5 min · 6 agents will be activated       │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Component Architecture

```
IntakeForm (enhanced)
├── IntakeHeader (title + subtitle)
├── QuickStartTemplates (new)
│   └── TemplateChip[] (Feature, Bug Fix, Refactor, Blank)
├── CoreFields
│   ├── TitleField (with inline validation + helper)
│   └── DescriptionField (with char count + tips)
├── AdvancedOptionsAccordion (new — progressive disclosure)
│   ├── SourcesSection (URL inputs)
│   ├── RepoConfigSection (monorepo/multi-repo + URL)
│   └── ModelSelectSection (dropdown)
├── SubmitSection
│   ├── SubmitButton (with loading state)
│   └── EstimateIndicator (new — "~3-5 min, 6 agents")
└── FormValidation (new — real-time inline errors)
```

### 2.5 Quick Start Templates

Templates pre-fill Title prefix and Description skeleton:

| Template | Title Prefix | Description Pre-fill |
|----------|-------------|---------------------|
| Feature | "Add: " | "## User Story\nAs a [user], I want [feature] so that [benefit]\n\n## Acceptance Criteria\n- [ ] \n" |
| Bug Fix | "Fix: " | "## Bug Description\n\n## Steps to Reproduce\n1. \n\n## Expected vs Actual\n" |
| Refactor | "Refactor: " | "## Current State\n\n## Desired State\n\n## Scope\n- [ ] \n" |
| Blank | "" | "" |

### 2.6 Inline Validation Rules

| Field | Rule | Error Message | Timing |
|-------|------|---------------|--------|
| Title | Min 5 chars | "Title must be at least 5 characters" | onBlur + onChange after first blur |
| Title | Max 100 chars | "Title too long (100 char max)" | onChange |
| Description | Min 20 chars for submission | "Add more detail to help agents understand scope" | onBlur |
| Repo URL | Valid URL pattern | "Enter a valid repository URL" | onBlur |
| Sources URL | Valid URL or s3:// | "Must be a valid URL or s3:// path" | onAdd |

### 2.7 Theme-Aware Styling Migration

Replace hardcoded zinc colors with CSS variables:

```typescript
// Before (hardcoded dark):
"bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500"

// After (theme-aware):
"bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
```

### 2.8 Card Visual Treatment

The form container gets elevated card styling:

```css
.intake-card {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -2px rgba(0, 0, 0, 0.1);
  max-width: 720px;
  margin: 0 auto;
}

/* Subtle gradient accent at top */
.intake-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 24px;
  right: 24px;
  height: 3px;
  background: linear-gradient(90deg, var(--color-brand-500), var(--color-brand-400));
  border-radius: 0 0 2px 2px;
}
```

### 2.9 Advanced Options Accordion

```typescript
interface AdvancedOptionsProps {
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// Visual design:
// - Collapsed: shows dashed separator line with "Advanced Options" label + chevron
// - Expanded: smooth height animation reveals content sections
// - Each section has a subtle left border accent for grouping
```

### 2.10 Submit Button Enhancement

```
┌────────────────────────────────────────┐
│  ▶  Start Team Workflow                 │  ← Primary action, full-width
└────────────────────────────────────────┘
  ~3-5 min · 6 agents will be activated    ← Subtle estimate below

// Loading state:
┌────────────────────────────────────────┐
│  ⟳  Creating epic and assigning...     │  ← Spinner + descriptive text
└────────────────────────────────────────┘
```

### 2.11 Description Field Enhancement

- Character/word count indicator
- Auto-resize to content height (min 6 rows, max 20 rows)
- Drag-to-resize handle retained
- Markdown preview toggle (P2 — future enhancement)

---

## 3. Data Flow and State Management

### 3.1 Sidebar State

```typescript
// New hook: src/hooks/useCollapsibleSidebar.ts
const SIDEBAR_COLLAPSED_KEY = 'workflow-sidebar-collapsed';

export function useCollapsibleSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });

  const toggle = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  return { isCollapsed, toggle, expand: () => setIsCollapsed(false), collapse: () => setIsCollapsed(true) };
}
```

### 3.2 Form State Enhancement

```typescript
// Enhanced form state with validation
interface IntakeFormState {
  title: string;
  description: string;
  sources: IntakeSource[];
  repoLayout: RepoLayout;
  repoUrl: string;
  defaultBranch: string;
  selectedModelId: string;
  
  // New state
  template: 'feature' | 'bugfix' | 'refactor' | 'blank';
  advancedExpanded: boolean;
  touched: Record<string, boolean>;
  errors: Record<string, string | null>;
}
```

---

## 4. File Changes Required

### New Files
| Path | Purpose |
|------|--------|
| `src/hooks/useCollapsibleSidebar.ts` | Sidebar collapse state + keyboard shortcut |
| `src/components/workflow/CollapsibleSidebar.tsx` | Wrapper with collapse animation logic |
| `src/components/workflow/SidebarRail.tsx` | Collapsed icon rail component |
| `src/components/workflow/QuickStartTemplates.tsx` | Template chip selector |
| `src/components/workflow/AdvancedOptions.tsx` | Accordion for advanced form fields |
| `src/components/workflow/FormField.tsx` | Reusable field wrapper with label, error, helper |

### Modified Files
| Path | Changes |
|------|--------|
| `src/app/workflow/page.tsx` | Integrate CollapsibleSidebar, adjust layout |
| `src/components/workflow/IntakeForm.tsx` | Progressive disclosure, templates, validation, theme vars |
| `src/styles/globals.css` | Add sidebar animation utilities (if not using inline) |

---

## 5. Responsive Breakpoints

| Breakpoint | Sidebar Behavior | Main Content |
|-----------|-----------------|---------------|
| ≥ 1440px | Expanded default, collapsible | Full pipeline width |
| 1280–1439px | Collapsed default, expandable | Pipeline fits with scroll |
| 768–1279px | Hidden, slide-over drawer | Full width |
| < 768px | Full-screen drawer overlay | Hidden when drawer open |

---

## 6. Accessibility Checklist

- [ ] Sidebar toggle: `aria-expanded`, `aria-controls`, `aria-label`
- [ ] Collapsed rail icons: `aria-label` with workflow title, `role="button"`
- [ ] Keyboard shortcut: Documented in tooltip, not the only way to toggle
- [ ] Form fields: Associated labels, `aria-describedby` for helpers/errors
- [ ] Validation errors: `role="alert"`, `aria-live="polite"`
- [ ] Focus management: On expand, focus returns to last active element
- [ ] Color contrast: All text meets WCAG AA (4.5:1 for body, 3:1 for large)
- [ ] Reduced motion: Honor `prefers-reduced-motion` for animations

---

## 7. Performance Considerations

- Sidebar animation uses `width` transition (triggers layout) — consider using `transform: translateX()` for collapsed state to avoid reflow
- WorkflowList should virtualize if > 50 items (use `react-window` or intersection observer)
- Template pre-fill should not trigger validation until user modifies
- Model dropdown fetch: already cached, no change needed
- localStorage reads: performed once on mount, not per render

---

## 8. Testing Strategy

### Unit Tests
- `useCollapsibleSidebar`: toggle, persist, keyboard shortcut
- `IntakeForm`: validation rules, template pre-fill, form submission payload

### Integration Tests (Playwright)
- Sidebar collapse/expand animation completes
- Sidebar state persists across page navigation
- Workflow selection works from collapsed rail
- Form submission with all fields populated
- Progressive disclosure accordion expand/collapse
- Template selection pre-fills correctly

### Visual Regression
- Sidebar expanded + dark theme
- Sidebar collapsed + dark theme
- Sidebar expanded + light theme
- IntakeForm with validation errors visible
- IntakeForm with advanced options expanded

---

## 9. Implementation Priority

| Priority | Feature | Effort |
|----------|---------|--------|
| P0 | Sidebar collapse/expand with animation | M |
| P0 | Sidebar state persistence (localStorage) | S |
| P0 | Collapsed rail with status indicators | M |
| P0 | IntakeForm theme-aware styling migration | S |
| P1 | Progressive disclosure (Advanced Options) | M |
| P1 | Quick Start Templates | S |
| P1 | Inline form validation | M |
| P1 | Submit button estimate indicator | S |
| P2 | Responsive breakpoint behaviors | L |
| P2 | Keyboard shortcut (Ctrl+\\) | S |
| P2 | Description char count + auto-resize | S |
| P3 | Sidebar drag-to-resize | M |
| P3 | Markdown preview toggle | L |

---

## 10. Design Tokens Reference

All new components should use these existing design tokens:

```css
/* Surfaces */
--color-surface-0   /* page background */
--color-surface-1   /* card/sidebar background */
--color-surface-2   /* elevated elements, inputs */
--color-surface-3   /* hover states */
--color-surface-4   /* borders, dividers */

/* Text */
--color-text-primary    /* headings, primary content */
--color-text-secondary  /* body text, descriptions */
--color-text-muted      /* placeholders, tertiary info */

/* Brand */
--color-brand-400 through --color-brand-600  /* interactive elements */

/* Border */
--color-border        /* default borders */
--color-border-hover  /* focus/hover borders (brand-tinted) */
```

Tailwind utility mapping: `bg-surface-1`, `text-[var(--color-text-primary)]`, `border-[var(--color-border)]`

---

## 11. Implementation Notes for Developers

Since this is a Next.js/React/Tailwind codebase:

- **Animations**: Use Tailwind `transition-all duration-300` + conditional classes, or CSS custom properties for complex sequences
- **Icons**: Use `lucide-react` (already in project): `ChevronLeft`, `ChevronRight`, `PanelLeftClose`, `PanelLeftOpen`, `Sparkles` (for templates)
- **Accordion**: Custom implementation (no heavy library needed), use `max-height` transition with `overflow-hidden`
- **Form validation**: React state + `onBlur`/`onChange` handlers, no form library needed (keeping current pattern)
- **No new dependencies required**: All features achievable with existing stack (React, Tailwind, lucide-react, next.js)
