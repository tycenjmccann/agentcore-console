# Design Document: Collapsible History Sidebar + Intake Card Enhancements

**Ticket**: TEAM-303  
**Author**: team-ios-designer  
**Status**: Draft  
**Date**: 2025-01-20  

---

## Overview

This design enhances the Workflow page (`/workflow`) with two key improvements:
1. **Collapsible History Sidebar** — The existing left sidebar becomes collapsible to maximize workspace for the pipeline visualization
2. **Intake Card Enhancements** — The intake form transforms from a flat form into a polished card-based layout with improved visual hierarchy, validation states, and progressive disclosure

---

## 1. Collapsible History Sidebar

### Current State
- Fixed `w-72` (288px) sidebar on the left of the Workflow page
- Shows "Active" and "Completed" workflow lists with search
- Cannot be hidden — always consumes horizontal space
- Pipeline visualization (`WorkflowBoard`) is squeezed into remaining space

### Design Goals
- Allow users to collapse sidebar to gain full-width for the pipeline canvas
- Persist collapse state across sessions (localStorage)
- Smooth animated transition with clear affordance
- Collapsed state shows icon-only rail for quick access

---

### 1.1 Layout Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Header (existing)                                          │
├──────┬─────────────────────────────────────────────────────┤
│      │                                                      │
│ Side │   Main Content Area                                  │
│ bar  │   (IntakeForm | WorkflowBoard | Empty State)         │
│      │                                                      │
│  ↕   │                                                      │
│      │                                                      │
└──────┴─────────────────────────────────────────────────────┘
```

**Expanded State**: `w-72` (288px) — current behavior  
**Collapsed State**: `w-14` (56px) — icon rail only

---

### 1.2 Component: `CollapsibleSidebar`

**File**: `src/components/workflow/CollapsibleSidebar.tsx`

#### Props Interface
```typescript
interface CollapsibleSidebarProps {
  workflows: WorkflowSummary[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (id: string) => void;
  onNewWorkflow: () => void;
}
```

#### Collapsed Rail Items
When collapsed, show a vertical icon rail:
- **Toggle button** (ChevronRight icon) at top
- **New Workflow** (+) button
- **Active count** badge (green dot + number)
- **History count** badge (dim dot + number)

Clicking any item in collapsed state expands the sidebar first.

#### Expanded State
Same as current sidebar content, plus:
- **Toggle button** (ChevronLeft icon) in header row
- New workflow button inline next to search or in header

#### Animation
```css
/* Sidebar transition */
.sidebar-collapsed { width: 56px; }
.sidebar-expanded { width: 288px; }
.sidebar-transition {
  transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* Content fade on collapse */
.sidebar-content {
  transition: opacity 150ms ease;
}
.sidebar-collapsed .sidebar-content {
  opacity: 0;
  pointer-events: none;
}
```

#### Persistence
```typescript
const STORAGE_KEY = "workflow-sidebar-collapsed";

// On mount
const [collapsed, setCollapsed] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
});

// On toggle
const toggle = () => {
  const next = !collapsed;
  setCollapsed(next);
  localStorage.setItem(STORAGE_KEY, String(next));
};
```

---

### 1.3 Visual Specifications

#### Expanded Header
```
┌──────────────────────────────┐
│ ◀  Workflows           [+]  │
│ ┌──────────────────────────┐ │
│ │ 🔍 Search epics...      │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ ACTIVE                       │
│  🟢 Feature Title...        │
│     TEAM-301  ·  2m ago     │
│     ▪ requirements          │
├──────────────────────────────┤
│ COMPLETED                    │
│  ● Feature Title...         │
│     TEAM-290  ·  1d ago     │
└──────────────────────────────┘
```

#### Collapsed Rail
```
┌────┐
│ ▶  │  ← Toggle (top)
│    │
│ +  │  ← New workflow
│    │
│🟢 3│  ← Active count
│    │
│ 📋 │  ← History icon
│    │
└────┘
```

#### Colors & Tokens
| Element | Token / Value |
|---------|---------------|
| Rail background | `var(--color-surface-1)` (same as nav sidebar) |
| Divider | `var(--color-border)` |
| Toggle icon | `text-[var(--color-text-muted)]` → hover: `text-[var(--color-text-primary)]` |
| Active badge | `bg-green-500` text |
| Selected item | `bg-blue-600/15 border border-blue-500/30` (existing) |

---

### 1.4 Responsive Behavior

| Breakpoint | Behavior |
|-----------|----------|
| `≥1280px` (xl) | Default expanded |
| `<1280px` | Auto-collapse on first load (can expand manually) |
| `<768px` (md) | Sidebar overlays as drawer with backdrop |

For mobile drawer mode:
- Sidebar becomes `fixed inset-y-0 left-0 z-50 w-72`
- Semi-transparent backdrop `bg-black/40`
- Click backdrop or selecting workflow dismisses

---

### 1.5 Keyboard Accessibility

| Key | Action |
|-----|--------|
| `[` | Toggle sidebar collapse (when workflow page focused) |
| `Escape` | Collapse sidebar (if expanded on mobile) |
| `↑/↓` | Navigate workflow list items |
| `Enter` | Select focused workflow |

---

## 2. Intake Card Enhancements

### Current State
- `IntakeForm` is a flat form with uniform text inputs
- All fields visible at once (title, description, sources, repo config, model)
- No visual grouping or progressive disclosure
- Minimal validation feedback

### Design Goals
- Group related inputs into visual cards/sections
- Add progressive disclosure for optional fields (sources, model override)
- Improve validation states with inline feedback
- Better empty/placeholder states with contextual hints
- Make the form feel like a "product brief builder" not a generic form

---

### 2.1 Card Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Start Team Workflow                                     │
│  Provide product input and the agent team handles the   │
│  rest.                                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  📋 Feature Brief                                       │
│  ─────────────────────────────────────────────────────  │
│  Feature Title *                                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │ e.g., Add profile photo carousel                  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Description / PRD                                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  │ Describe the feature, user stories...             │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│  💡 Supports markdown. Paste a PRD for best results.    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🔗 Reference Materials              [Optional ▾]       │
│  ─────────────────────────────────────────────────────  │
│  Mockups, design docs, or demo URLs                     │
│  ┌────────────────────────────────────────────── [Add]┐ │
│  │ https://...                                        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │  📎 figma.com/file/abc123  ×               │        │
│  │  📎 s3://designs/mockup.png  ×             │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ⚙️ Configuration                    [Optional ▾]       │
│  ─────────────────────────────────────────────────────  │
│  Target Repository                                      │
│  ┌─────────────────────────────────────┐ ┌──────────┐  │
│  │ https://github.com/org/repo         │ │  main    │  │
│  └─────────────────────────────────────┘ └──────────┘  │
│  Layout: (●) Monorepo  ( ) Multi-repo                   │
│                                                         │
│  AI Model                                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ⭐ Claude Sonnet 4.5 (Recommended)             ▾ │  │
│  └───────────────────────────────────────────────────┘  │
│  ℹ️ Best balance of speed and quality for dev tasks     │
└─────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────┐
         │     🚀 Start Team Workflow           │
         └──────────────────────────────────────┘
```

---

### 2.2 Component: Enhanced `IntakeForm`

**File**: `src/components/workflow/IntakeForm.tsx` (modify existing)

#### New Sub-Components

```typescript
// Section card wrapper
interface IntakeCardProps {
  icon: LucideIcon;
  title: string;
  optional?: boolean;        // Shows "Optional" badge + collapsible
  defaultOpen?: boolean;     // For optional sections
  children: React.ReactNode;
}

// Source chip component  
interface SourceChipProps {
  source: IntakeSource;
  onRemove: () => void;
}

// Inline validation
interface FieldValidation {
  valid: boolean;
  message?: string;
}
```

---

### 2.3 Progressive Disclosure

Optional sections use a collapsible pattern:

```typescript
function IntakeCard({ icon: Icon, title, optional, defaultOpen = true, children }: IntakeCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
      <button
        onClick={() => optional && setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <Icon className="w-4 h-4 text-brand-400" />
        <span className="text-sm font-semibold text-[var(--color-text-primary)] flex-1">
          {title}
        </span>
        {optional && (
          <>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)] uppercase tracking-wider">
              Optional
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200",
              open && "rotate-180"
            )} />
          </>
        )}
      </button>
      
      <div className={cn(
        "overflow-hidden transition-all duration-200",
        open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-5 pb-5 pt-0 border-t border-[var(--color-border)]">
          {children}
        </div>
      </div>
    </div>
  );
}
```

---

### 2.4 Validation States

| State | Visual |
|-------|--------|
| Empty (unfocused) | Default border `border-[var(--color-border)]` |
| Focused | `border-brand-500 ring-1 ring-brand-500/20` |
| Valid (after blur) | `border-green-500/50` with subtle ✓ icon |
| Error | `border-red-500/50` with error message below |
| Hint | `text-[var(--color-text-muted)]` helper text below field |

**Title field validation:**
- Required — shows "Feature title is required" on submit attempt
- Min 3 chars — "Title should be at least 3 characters"

**URL source validation:**
- Must start with `https://`, `http://`, or `s3://`
- Shows "Invalid URL format" inline

---

### 2.5 Source Chips

Replace the current plain list with styled chips:

```typescript
function SourceChip({ source, onRemove }: SourceChipProps) {
  const icon = source.value.startsWith("s3://") ? "☁️" : "🔗";
  const domain = (() => {
    try { return new URL(source.value).hostname; }
    catch { return source.value.slice(0, 30); }
  })();

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-lg text-xs group">
      <span>{icon}</span>
      <span className="text-[var(--color-text-secondary)] truncate max-w-[200px]">
        {domain}
      </span>
      <button
        onClick={onRemove}
        className="text-[var(--color-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Remove ${domain}`}
      >
        ×
      </button>
    </div>
  );
}
```

---

### 2.6 Submit Button Enhancement

The submit button gets a loading state with progress indication:

```
Default:     [  🚀 Start Team Workflow  ]
Loading:     [  ⟳ Creating epic...      ]   (with spinner)
Success:     [  ✓ Workflow started!     ]   (flash green, then redirect)
```

```typescript
<button
  type="submit"
  disabled={!title.trim() || isLoading}
  className={cn(
    "w-full px-6 py-3.5 rounded-xl font-semibold text-sm transition-all",
    "flex items-center justify-center gap-2",
    isLoading
      ? "bg-brand-600/50 text-brand-200 cursor-wait"
      : "bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30"
  )}
>
  {isLoading ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin" />
      Creating epic...
    </>
  ) : (
    <>
      <Rocket className="w-4 h-4" />
      Start Team Workflow
    </>
  )}
</button>
```

---

### 2.7 Description Field Enhancement

Add a character counter and markdown hint:

```typescript
<div className="relative">
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Describe the feature, user stories, or paste your PRD content..."
    rows={6}
    className="w-full px-4 py-3 bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 resize-y text-sm"
  />
  <div className="flex items-center justify-between mt-1.5 px-1">
    <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
      💡 Supports markdown. Paste a PRD for best results.
    </span>
    <span className={cn(
      "text-[10px]",
      description.length > 5000 ? "text-red-400" : "text-[var(--color-text-muted)]"
    )}>
      {description.length.toLocaleString()} chars
    </span>
  </div>
</div>
```

---

## 3. Interaction Patterns

### 3.1 Sidebar ↔ Intake Flow

When user clicks "New Workflow" (+ button):
1. If sidebar collapsed → expand sidebar briefly to show context, then load intake
2. Selected workflow deselects (no blue highlight in sidebar)
3. Main area transitions to IntakeForm with a subtle fade-in

When workflow is submitted successfully:
1. New workflow appears at top of "Active" list in sidebar
2. Auto-selects the new workflow (blue highlight)
3. Main area transitions to `WorkflowBoard`
4. URL updates to `/workflow?id=<new-id>`

### 3.2 Keyboard Shortcuts Summary

| Shortcut | Action |
|----------|--------|
| `[` | Toggle sidebar |
| `n` | New workflow (when not in form) |
| `Escape` | Collapse sidebar / cancel form |

---

## 4. Implementation Plan

### Phase 1: Collapsible Sidebar
1. Extract sidebar into `CollapsibleSidebar.tsx` component
2. Add collapse/expand state with localStorage persistence
3. Implement animation with CSS transitions
4. Add collapsed rail view with badge counts
5. Add responsive breakpoint behavior

### Phase 2: Intake Card Sections
1. Create `IntakeCard` wrapper component
2. Refactor `IntakeForm` to use card sections
3. Add progressive disclosure for optional sections
4. Implement `SourceChip` component

### Phase 3: Validation & Polish
1. Add inline validation states to form fields
2. Enhance submit button with loading/success states
3. Add character counter to description
4. Add keyboard shortcuts

### Phase 4: Responsive & Accessibility
1. Mobile drawer behavior for sidebar
2. ARIA labels and roles for collapsible sections
3. Focus management on collapse/expand
4. Screen reader announcements for state changes

---

## 5. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/workflow/CollapsibleSidebar.tsx` | **CREATE** | New collapsible sidebar component |
| `src/components/workflow/IntakeCard.tsx` | **CREATE** | Section card wrapper component |
| `src/components/workflow/SourceChip.tsx` | **CREATE** | Source URL chip component |
| `src/components/workflow/IntakeForm.tsx` | **MODIFY** | Refactor to use cards + validation |
| `src/app/workflow/page.tsx` | **MODIFY** | Replace inline sidebar with `CollapsibleSidebar` |
| `src/styles/globals.css` | **MODIFY** | Add sidebar transition utilities |

---

## 6. Design Tokens Reference

All new styles use the existing design system tokens:

| Usage | Token |
|-------|-------|
| Card background | `var(--color-surface-2)` |
| Card border | `var(--color-border)` |
| Input background | `var(--color-surface-3)` |
| Section icon | `text-brand-400` |
| Optional badge | `bg-[var(--color-surface-3)] text-[var(--color-text-muted)]` |
| Focus ring | `border-brand-500 ring-1 ring-brand-500/20` |
| Error state | `border-red-500/50 text-red-400` |
| Success state | `border-green-500/50 text-green-400` |

---

## 7. Accessibility Checklist

- [x] Sidebar toggle has `aria-expanded` and `aria-label`
- [x] Collapsible cards use `aria-expanded` attribute
- [x] Form fields have associated labels
- [x] Validation errors linked via `aria-describedby`
- [x] Focus trapped in mobile drawer
- [x] Color contrast meets WCAG 2.1 AA (4.5:1 for text)
- [x] All interactive elements keyboard accessible
- [x] Motion respects `prefers-reduced-motion`

---

## 8. Performance Considerations

- Sidebar collapse uses CSS transitions (no JS layout recalc)
- localStorage access is sync but only on mount/toggle
- No additional API calls introduced
- Optional sections are rendered but hidden (not lazy) for instant open
- Pipeline canvas uses `flex-1` so it auto-expands when sidebar collapses

---

## 9. Edge Cases

| Scenario | Behavior |
|----------|----------|
| No workflows exist | Sidebar shows empty state, auto-open intake |
| 50+ workflows in history | Virtual scroll not needed (list is paginated by server) |
| Very long feature title | Truncate with ellipsis in sidebar list item |
| Network error on submit | Show inline error toast, keep form state |
| Model API fails to load | Graceful degradation — hide model selector (existing) |
| localStorage unavailable | Default to expanded, no persistence |
| User pastes very long description | Character counter turns red at 5000+, no hard limit |
