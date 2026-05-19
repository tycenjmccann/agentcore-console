# Localization Design: Collapsible History Sidebar + Intake Card Enhancements

## 1. Executive Summary

This document defines the internationalization (i18n) architecture for two UI feature areas in the AgentCore Console:

1. **Collapsible History Sidebar** — The workflow history panel (`src/app/workflow/page.tsx`) that lists active/completed workflows with search, status indicators, and relative time formatting.
2. **Intake Card Enhancements** — The workflow intake form (`src/components/workflow/IntakeForm.tsx`) including field labels, placeholders, validation messages, and model selection UI.

Currently, the application has **zero i18n infrastructure** — all user-facing strings are hardcoded in component JSX. This design establishes the foundational i18n system and provides the string catalog for these two feature areas.

---

## 2. Technical Architecture

### 2.1 Framework Selection

| Option | Library | Rationale |
|--------|---------|----------|
| **Recommended** | `next-intl` | First-class Next.js App Router support, lightweight, supports server components, React 18 compatible |
| Alternative | `react-i18next` | More mature ecosystem but heavier; requires additional config for App Router |

**Decision: `next-intl`** — optimal for Next.js 14 App Router, supports both client and server components, and provides built-in formatting (dates, numbers, relative time).

### 2.2 Locale Strategy

```
Default Locale:  en-US
Supported Locales (Phase 1): en-US, es-ES, fr-FR, de-DE, ja-JP
RTL Support (Phase 2): ar-SA
```

### 2.3 Fallback Chain

```
Requested locale → Language base → en-US (default)

Example: fr-CA → fr → en-US
```

### 2.4 Directory Structure

```
src/
├── i18n/
│   ├── config.ts              # Locale list, default, detection settings
│   ├── request.ts             # next-intl request config
│   └── messages/
│       ├── en-US/
│       │   ├── common.json    # Shared strings (buttons, status labels)
│       │   ├── workflow.json  # Workflow sidebar + board strings
│       │   └── intake.json   # Intake form strings
│       ├── es-ES/
│       │   ├── common.json
│       │   ├── workflow.json
│       │   └── intake.json
│       ├── fr-FR/
│       │   └── ...
│       ├── de-DE/
│       │   └── ...
│       └── ja-JP/
│           └── ...
├── middleware.ts              # Locale detection + routing
```

### 2.5 Locale Detection Order

1. URL path prefix (`/en-US/workflow`)
2. Cookie (`NEXT_LOCALE`)
3. `Accept-Language` header
4. Default: `en-US`

---

## 3. String Catalog

### 3.1 Naming Convention

```
{namespace}.{component}.{element}.{variant}
```

Examples:
- `workflow.sidebar.title`
- `workflow.sidebar.search.placeholder`
- `intake.form.title.label`
- `common.status.active`

### 3.2 Workflow Sidebar Strings (`workflow.json`)

```json
{
  "sidebar": {
    "title": "Workflows",
    "newWorkflow": "New Workflow",
    "search": {
      "placeholder": "Search epics..."
    },
    "sections": {
      "active": "Active",
      "completed": "Completed"
    },
    "empty": {
      "noResults": "No matching workflows",
      "noWorkflows": "No workflows yet"
    },
    "status": {
      "running": "{phase}",
      "error": "Error",
      "complete": "Complete"
    },
    "time": {
      "justNow": "just now",
      "minutesAgo": "{count}m ago",
      "hoursAgo": "{count}h ago",
      "daysAgo": "{count}d ago"
    },
    "collapse": {
      "expand": "Show sidebar",
      "collapse": "Hide sidebar",
      "ariaLabel": "Toggle workflow history sidebar"
    }
  },
  "main": {
    "emptyState": {
      "title": "Select a workflow or start a new one",
      "description": "Choose a past run from the sidebar to view its pipeline state, or create a new workflow to watch agents work in real-time.",
      "cta": "New Workflow"
    }
  },
  "board": {
    "loading": "Loading pipeline...",
    "status": {
      "complete": "Complete",
      "error": "Error",
      "processing": "Processing phase {current} of {total}",
      "allComplete": "All agents have completed their work",
      "errorOccurred": "An error occurred"
    }
  }
}
```

### 3.3 Intake Form Strings (`intake.json`)

```json
{
  "form": {
    "heading": "Start Team Workflow",
    "subheading": "Provide product input and the agent team will handle requirements, design, and implementation.",
    "title": {
      "label": "Feature Title",
      "placeholder": "e.g., Add profile photo carousel"
    },
    "description": {
      "label": "Description / PRD",
      "placeholder": "Describe the feature, user stories, or paste your PRD content..."
    },
    "sources": {
      "label": "Input Sources",
      "hint": "Add URLs to mockups, one-pagers, demo sites, or S3 locations",
      "placeholder": "https://... or s3://bucket/key",
      "addButton": "Add",
      "removeAriaLabel": "Remove source {url}"
    },
    "repo": {
      "label": "Target Repository",
      "layout": {
        "monorepo": "Monorepo",
        "multiRepo": "Multi-repo"
      },
      "urlPlaceholder": "https://github.com/org/repo.git",
      "branchPlaceholder": "main"
    },
    "model": {
      "label": "Model Selection (Optional)",
      "hint": "Select AI model for development agents. Defaults to Claude Sonnet 4.5.",
      "loading": "Loading models...",
      "ariaLabel": "Select AI model for development agents",
      "recommended": "(Recommended)"
    },
    "submit": {
      "idle": "Start Team Workflow",
      "loading": "Starting workflow..."
    },
    "validation": {
      "titleRequired": "Feature title is required",
      "titleMinLength": "Title must be at least {min} characters",
      "invalidUrl": "Please enter a valid URL or S3 path"
    }
  }
}
```

### 3.4 Common Strings (`common.json`)

```json
{
  "status": {
    "active": "Active",
    "complete": "Complete",
    "error": "Error",
    "loading": "Loading...",
    "idle": "Idle"
  },
  "actions": {
    "search": "Search",
    "cancel": "Cancel",
    "submit": "Submit",
    "add": "Add",
    "remove": "Remove",
    "close": "Close",
    "expand": "Expand",
    "collapse": "Collapse",
    "new": "New"
  },
  "time": {
    "relative": {
      "justNow": "just now",
      "minutes": "{count, plural, one {# minute ago} other {# minutes ago}}",
      "hours": "{count, plural, one {# hour ago} other {# hours ago}}",
      "days": "{count, plural, one {# day ago} other {# days ago}}",
      "weeks": "{count, plural, one {# week ago} other {# weeks ago}}"
    }
  },
  "aria": {
    "navigation": "Main navigation",
    "sidebar": "Sidebar",
    "mainContent": "Main content"
  }
}
```

---

## 4. Pluralization Rules

Different languages require different plural forms:

| Language | Plural Forms | Example Rule |
|----------|-------------|-------------|
| English (en) | 2 (one, other) | 1 item / 2 items |
| French (fr) | 2 (one, other) | 0-1 item / 2+ items (zero is singular!) |
| German (de) | 2 (one, other) | 1 Element / 2 Elemente |
| Japanese (ja) | 1 (other) | No plural forms |
| Arabic (ar) | 6 (zero, one, two, few, many, other) | Complex rules |

**Implementation**: Use ICU MessageFormat syntax via `next-intl`:

```typescript
// Message definition
"items": "{count, plural, =0 {No items} one {# item} other {# items}}"

// Usage in component
t('items', { count: workflows.length })
```

---

## 5. Date/Time/Number Formatting

### 5.1 Relative Time (History Sidebar)

Replace the hardcoded `formatRelativeTime()` helper with locale-aware formatting:

```typescript
import { useFormatter } from 'next-intl';

function WorkflowListItem({ workflow }: Props) {
  const format = useFormatter();

  // Automatic locale-aware relative time
  const timeStr = format.relativeTime(new Date(workflow.startedAt));
  // en-US: "3 hours ago"
  // ja-JP: "3時間前"
  // de-DE: "vor 3 Stunden"
}
```

### 5.2 Date Formatting

```typescript
// For dates displayed in expanded detail views
format.dateTime(new Date(workflow.startedAt), {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});
// en-US: "Jan 15, 2025, 03:42 PM"
// de-DE: "15. Jan. 2025, 15:42"
// ja-JP: "2025年1月15日 15:42"
```

---

## 6. String Length Variation and Layout Impact

### 6.1 Width Analysis for Sidebar

| String (en-US) | de-DE (est.) | ja-JP (est.) | Impact |
|---------------|-------------|-------------|--------|
| "Workflows" (9ch) | "Arbeitsabläufe" (15ch, +67%) | "ワークフロー" (6ch, -33%) | Sidebar title — needs flex/truncate |
| "Search epics..." (15ch) | "Epics durchsuchen..." (21ch, +40%) | "エピックを検索..." (9ch) | Input placeholder — OK, ellipsis handles |
| "New Workflow" (12ch) | "Neuer Workflow" (14ch, +17%) | "新規ワークフロー" (8ch) | Button — low risk |
| "Active" (6ch) | "Aktiv" (5ch) | "実行中" (3ch) | Section label — OK |
| "No matching workflows" (22ch) | "Keine passenden Workflows" (27ch, +23%) | "一致するワークフローなし" (12ch) | Empty state — OK with wrapping |

### 6.2 Width Analysis for Intake Form

| String (en-US) | de-DE (est.) | Impact |
|---------------|-------------|--------|
| "Start Team Workflow" (19ch) | "Team-Workflow starten" (22ch, +16%) | Heading — flex OK |
| "Feature Title" (13ch) | "Feature-Titel" (13ch, 0%) | Label — OK |
| "Description / PRD" (18ch) | "Beschreibung / PRD" (19ch, +6%) | Label — OK |
| "Model Selection (Optional)" (27ch) | "Modellauswahl (Optional)" (25ch) | Label — OK |
| "Start Team Workflow" (button, 19ch) | "Team-Workflow starten" (22ch) | Full-width button — OK |

### 6.3 Layout Safeguards

- Sidebar width: Fixed at `w-72` (288px). German text fits within truncation.
- For collapsible mode: Icon-only collapsed state avoids text entirely.
- Form labels: Block-level, full width — no overflow issues.
- Buttons: Full-width (`w-full`) — handles expansion naturally.
- Tooltips: Should have `max-w-xs` to contain long translations.

---

## 7. Collapsible Sidebar Localization Specifics

### 7.1 Collapse Toggle Strings

The new collapse/expand button needs accessible labels that vary by language:

```json
{
  "collapse": {
    "expandTooltip": "Show workflow history",
    "collapseTooltip": "Hide workflow history",
    "ariaExpanded": "Workflow history sidebar, expanded",
    "ariaCollapsed": "Workflow history sidebar, collapsed"
  }
}
```

### 7.2 Collapsed State (Icon-Only Mode)

When the sidebar is collapsed:
- No visible text, only icons — **no localization needed for visual state**
- `aria-label` attributes still need localization for screen readers
- Tooltip on hover must be localized

### 7.3 Responsive Breakpoint Considerations

| Breakpoint | Sidebar Behavior | Localization Impact |
|-----------|-----------------|-------------------|
| >= 1280px (xl) | Always visible, full width | All strings displayed |
| 768-1279px (md-lg) | Collapsible, default collapsed | Toggle tooltip localized |
| < 768px (sm) | Overlay/drawer | Drawer header localized |

---

## 8. Implementation Plan

### 8.1 Phase 1: Foundation (This Sprint)

1. Install `next-intl` package
2. Create `src/i18n/` directory with config
3. Add locale middleware for detection
4. Extract strings from workflow page + intake form into JSON catalogs
5. Wire up `NextIntlClientProvider` in layout
6. Replace hardcoded strings with `useTranslations()` hook calls
7. Replace `formatRelativeTime()` with `useFormatter().relativeTime()`

### 8.2 Phase 2: Collapsible Sidebar i18n

1. Add collapse toggle ARIA labels
2. Localize tooltip strings for collapsed state
3. Test German/Japanese string expansion in sidebar (288px constraint)
4. Add responsive collapse behavior with localized drawer header

### 8.3 Phase 3: Intake Card Enhancements i18n

1. Localize all form field labels, placeholders, and hints
2. Localize validation error messages
3. Localize model selector labels and descriptions
4. Localize submit button states (idle/loading)

### 8.4 Phase 4: Translation and QA

1. Generate translation files for es-ES, fr-FR, de-DE, ja-JP
2. Pseudo-localization testing (string expansion + accented chars)
3. Screenshot comparison per locale
4. RTL layout prep (no changes needed until Phase 2 Arabic support)

---

## 9. Code Migration Pattern

### Before (Current - Hardcoded):

```tsx
// src/app/workflow/page.tsx
<h2 className="text-sm font-semibold">Workflows</h2>
<input placeholder="Search epics..." />
<p>No workflows yet</p>
```

### After (Localized):

```tsx
// src/app/workflow/page.tsx
import { useTranslations } from 'next-intl';

export default function WorkflowPage() {
  const t = useTranslations('workflow');

  return (
    <>
      <h2 className="text-sm font-semibold">{t('sidebar.title')}</h2>
      <input placeholder={t('sidebar.search.placeholder')} />
      <p>{t('sidebar.empty.noWorkflows')}</p>
    </>
  );
}
```

### Relative Time Migration:

```tsx
// Before
function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  // ...
}

// After
import { useFormatter } from 'next-intl';

function WorkflowListItem({ workflow }) {
  const format = useFormatter();
  const timeStr = format.relativeTime(new Date(workflow.startedAt));
  // Automatically formats per locale
}
```

---

## 10. Testing Strategy

### 10.1 Pseudo-Localization

Use pseudo-locale to detect hardcoded strings and layout issues:

```
"Workflows" → "[Ẃöŕķƒĺöẃš______]" (padded 40% for German expansion)
```

### 10.2 Test Matrix

| Test Type | Locales | Target |
|-----------|---------|--------|
| Unit (string resolution) | en-US, pseudo | All keys resolve without fallback |
| Visual regression | en-US, de-DE, ja-JP | Sidebar + Intake screenshots |
| Overflow testing | de-DE (longest) | No text truncation in buttons |
| RTL layout | (future: ar-SA) | Mirror sidebar position |
| Accessibility | all | aria-labels match locale |
| Playwright E2E | en-US, es-ES | Full workflow submission flow |

### 10.3 Playwright Locale Test

```typescript
// tests/i18n/workflow-sidebar.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Workflow Sidebar - Localization', () => {
  test('renders in German with no overflow', async ({ page }) => {
    await page.goto('/de-DE/workflow');
    const sidebar = page.locator('[data-testid="workflow-sidebar"]');
    await expect(sidebar.locator('h2')).toHaveText('Arbeitsabläufe');
    // Verify no horizontal scrollbar
    const hasOverflow = await sidebar.evaluate(el => el.scrollWidth > el.clientWidth);
    expect(hasOverflow).toBe(false);
  });

  test('renders in Japanese with correct relative time', async ({ page }) => {
    await page.goto('/ja-JP/workflow');
    const sidebar = page.locator('[data-testid="workflow-sidebar"]');
    await expect(sidebar.locator('h2')).toHaveText('ワークフロー');
  });
});
```

---

## 11. Accessibility and i18n Intersection

| Element | ARIA Requirement | Localization |
|---------|-----------------|-------------|
| Sidebar toggle | `aria-expanded`, `aria-label` | Both attributes localized |
| Search input | `aria-label` (when no visible label) | Localized |
| Workflow list | `role="listbox"`, items have `aria-selected` | Status text localized |
| Intake form fields | `<label>` elements | Localized via `t()` |
| Model select | `aria-label`, `aria-describedby` | Both localized |
| Submit button | Loading state announced | `aria-busy` + localized text |

---

## 12. Configuration Files

### `src/i18n/config.ts`

```typescript
export const locales = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en-US';

export const localeNames: Record<Locale, string> = {
  'en-US': 'English',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'ja-JP': '日本語',
};

// Direction map for future RTL support
export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  'en-US': 'ltr',
  'es-ES': 'ltr',
  'fr-FR': 'ltr',
  'de-DE': 'ltr',
  'ja-JP': 'ltr',
};
```

### `middleware.ts` (Locale routing)

```typescript
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
  localePrefix: 'as-needed', // Only prefix non-default locales
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

---

## 13. Dependencies and Package Changes

```json
{
  "dependencies": {
    "next-intl": "^3.20.0"
  }
}
```

No other dependency changes required. `next-intl` uses the Intl API built into modern browsers/Node.js for date/number/relative time formatting.

---

## 14. Summary of Deliverables

| Artifact | Description |
|----------|-------------|
| `src/i18n/config.ts` | Locale configuration |
| `src/i18n/request.ts` | next-intl request handler |
| `src/i18n/messages/en-US/workflow.json` | Sidebar + board strings |
| `src/i18n/messages/en-US/intake.json` | Intake form strings |
| `src/i18n/messages/en-US/common.json` | Shared strings |
| `middleware.ts` | Locale detection routing |
| Updated `src/app/workflow/page.tsx` | Localized sidebar |
| Updated `src/components/workflow/IntakeForm.tsx` | Localized form |
| `tests/i18n/` | Locale test specs |

---

## 15. Open Questions for Team

1. **Locale switcher UI**: Should we add a language selector in the Header component, or rely solely on browser language detection?
2. **Dynamic content**: Agent names, workflow titles, and model descriptions are user-generated. These are NOT localized — only UI chrome is translated.
3. **API error messages**: Should API error strings from server routes be localized, or displayed as-is (English) with a localized wrapper ("An error occurred: {message}")?
4. **Translation workflow**: Manual JSON editing, or integrate with a TMS (Crowdin, Lokalise) for professional translation in Phase 4?
