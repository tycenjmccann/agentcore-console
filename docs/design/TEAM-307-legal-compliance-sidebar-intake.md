# Legal & Compliance Design Review: Collapsible History Sidebar + Intake Card Enhancements

**Ticket:** TEAM-307  
**Author:** team-legal-compliance  
**Workflow:** wf_1779226395045_zc9sf3  
**Status:** Complete — No Legal Blockers  

---

## 1. Feature Overview

This document provides the legal compliance and privacy analysis for two interconnected UI enhancements to the AgentCore Console's Workflow page (`/workflow`):

1. **Collapsible History Sidebar** — The left-panel sidebar (currently fixed at 288px/`w-72`) that displays workflow run history (active + completed), allowing users to search and select past workflows. Enhancement makes it collapsible to reclaim screen space for the pipeline visualization.

2. **Intake Card Enhancements** — Improvements to the `IntakeForm` component used to start new workflows, which collects feature title, description/PRD content, input source URLs, repository configuration, and AI model selection.

---

## 2. Data Inventory & Classification

### 2.1 Personal Data Collected via Intake Form

| Data Field | Classification | Legal Basis | Retention |
|---|---|---|---|
| Feature Title | Business data | Legitimate interest (service operation) | Workflow lifecycle |
| Description / PRD | Business data (may contain PII) | Legitimate interest | Workflow lifecycle |
| Input Source URLs | Business data / Metadata | Legitimate interest | Workflow lifecycle |
| Repository URL | Technical config | Legitimate interest | Workflow lifecycle |
| Branch name | Technical config | Legitimate interest | Workflow lifecycle |
| Model selection | Preference data | Legitimate interest | Session duration |

### 2.2 Data Stored in History Sidebar

| Data Field | Source | Classification | Notes |
|---|---|---|---|
| `workflow.id` | System-generated | Technical identifier | UUID, non-personal |
| `workflow.input.title` | User input | Business data | Displayed in sidebar list |
| `workflow.input.description` | User input | Business data (may contain PII) | NOT displayed in sidebar — only stored in state |
| `workflow.epicId` | System-generated | Business identifier | e.g., "TEAM-301" |
| `workflow.phase` | System state | Operational data | Status indicator |
| `workflow.startedAt` | System-generated | Timestamp | ISO 8601 |
| `workflow.completedAt` | System-generated | Timestamp | ISO 8601 |
| `workflow.agentTasks` | Agent outputs | Mixed (may contain PII from processing) | Contains agent outputs, branches, commit SHAs |

### 2.3 Data Flow Diagram

```
User Input (IntakeForm)
    │
    ▼
POST /api/workflow/start
    │
    ├──► DynamoDB (WorkflowState persistence)
    │       └── Stores full WorkflowInput including description text
    │
    ├──► S3 (Agent workspace artifacts)
    │       └── workflows/{id}/shared/ and workflows/{id}/agents/{agent-id}/
    │
    ├──► EventBridge (Event emission)
    │       └── Workflow events for agent orchestration
    │
    └──► SSE Stream (/api/workflow/{id}/stream)
            └── Real-time updates to UI (ephemeral, not persisted separately)

History Sidebar (GET /api/workflow/list)
    │
    └──► Reads from DynamoDB
            └── Returns WorkflowSummary[] (id, phase, epicId, input.title, startedAt)
```

---

## 3. Privacy & Compliance Analysis

### 3.1 GDPR Compliance (if applicable to EU users)

#### 3.1.1 Lawful Basis for Processing

- **Legitimate Interest (Art. 6(1)(f))**: Processing workflow data is necessary for operating the development pipeline service. The data subject (user) initiates the workflow and reasonably expects their input to be processed by AI agents.
- **No explicit consent mechanism needed** for core service operation, BUT:

#### 3.1.2 Recommendations

| # | Requirement | Current State | Recommendation | Priority |
|---|---|---|---|---|
| 1 | **Data Minimization** | Description field accepts unlimited text | Add character limit guidance (not hard block) + warning if potentially sensitive data patterns detected | Medium |
| 2 | **Purpose Limitation** | Input data used only for agent processing | ✅ Compliant — data stays within workflow scope | N/A |
| 3 | **Storage Limitation** | No explicit retention policy visible in code | Implement configurable retention period (default: 90 days for completed workflows) | High |
| 4 | **Right to Erasure** | No delete workflow endpoint visible | Add `DELETE /api/workflow/{id}` with cascade to S3 artifacts and DynamoDB records | High |
| 5 | **Right to Access** | Users can view history in sidebar | Partially compliant — add full data export capability | Medium |
| 6 | **Transparency** | No privacy notice in IntakeForm | Add brief data usage notice before submission | Medium |

#### 3.1.3 Sidebar-Specific Concerns

The collapsible sidebar **reduces** exposure risk by:
- Allowing users to hide historical workflow titles from screen (useful in shared screen/demo scenarios)
- Maintaining the same data access patterns (no new data collected)

**No additional GDPR concerns introduced** by the collapsibility feature itself.

### 3.2 CCPA Compliance

| Right | Implementation Status | Notes |
|---|---|---|
| Right to Know | Sidebar provides visibility into stored workflows | Enhance with full data export |
| Right to Delete | Not implemented | Required — add workflow deletion |
| Right to Opt-Out of Sale | N/A — no data sale | Not applicable |
| Non-Discrimination | N/A | Not applicable |

### 3.3 Data Retention Requirements

```
┌─────────────────────────────────────────────────────────┐
│                  RETENTION POLICY                         │
├─────────────────────────────────────────────────────────┤
│ Active Workflows    │ Indefinite (until complete/error)  │
│ Completed Workflows │ 90 days (configurable)             │
│ Error Workflows     │ 30 days (for debugging)            │
│ S3 Artifacts        │ Same as parent workflow             │
│ SSE Event Logs      │ 7 days (operational monitoring)    │
│ Audit Logs          │ 1 year (compliance requirement)    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Security Considerations

### 4.1 History Sidebar

| Risk | Description | Mitigation |
|---|---|---|
| **Information Disclosure** | Workflow titles visible in sidebar may reveal business-sensitive feature names | Collapsible sidebar mitigates (user can hide). Consider: add "blur/redact" mode for demos |
| **Unauthorized Access** | No visible auth check on `/api/workflow/list` | Ensure API routes are protected by session/auth middleware |
| **Data Leakage via URL** | `?id=` parameter exposes workflow ID in browser history | Low risk — IDs are opaque UUIDs. Acceptable. |
| **Client-Side Caching** | Workflow data may persist in browser memory | Use `cache: "no-store"` (already implemented in fetch). Clear state on logout. |

### 4.2 Intake Form Enhancements

| Risk | Description | Mitigation |
|---|---|---|
| **PII in Description** | Users may paste customer names, emails, or other PII in PRD text | Add client-side PII detection warning (non-blocking) |
| **Source URL Exposure** | S3 URLs or internal links may be entered as sources | Validate URL format; warn on internal/sensitive-looking URLs |
| **Model Selection** | Model choice does not pose privacy risk | ✅ No concern |
| **XSS via Input** | Title/description rendered in sidebar list items | Ensure React default escaping is active (it is via JSX) — ✅ Safe |
| **Secrets in Input** | Users might paste API keys or tokens in description | Consider: add secret-scanning on submission (non-blocking warning) |

---

## 5. Audit & Accountability Requirements

### 5.1 Required Audit Events for Compliance

The following events MUST be logged for compliance audit trail:

```typescript
interface ComplianceAuditEvent {
  eventType: 
    | "workflow_created"      // User initiated a new workflow
    | "workflow_accessed"     // User viewed a workflow from history
    | "workflow_deleted"      // User or system deleted a workflow
    | "data_exported"         // User exported workflow data
    | "pii_warning_shown"    // PII detection triggered
    | "retention_purge";     // System auto-deleted expired workflow
  timestamp: string;         // ISO 8601
  userId?: string;           // If auth is implemented
  workflowId: string;
  metadata?: Record<string, string>;
}
```

### 5.2 Audit Storage

- Store in a separate audit DynamoDB table or CloudWatch Logs
- Retention: 1 year minimum (regulatory requirement for most frameworks)
- Immutable: audit records MUST NOT be deletable by normal operations

---

## 6. Intake Form Enhancement Compliance Requirements

### 6.1 Privacy Notice (Recommended Addition)

Add a brief, non-intrusive notice below the description field:

```
ℹ️ Your input will be processed by AI agents to generate requirements, 
designs, and code. Avoid including personally identifiable information 
(PII), credentials, or sensitive customer data. Workflow data is retained 
for 90 days after completion.
```

### 6.2 Input Validation & Warnings

| Check | Type | Action |
|---|---|---|
| Email pattern in description | Client-side regex | Show yellow warning banner |
| Phone number pattern | Client-side regex | Show yellow warning banner |
| AWS key pattern (`AKIA...`) | Client-side regex | Show red warning, block submission |
| Input > 50,000 chars | Client-side length check | Show info notice about processing time |
| Internal URL patterns | Configurable list | Show info notice |

### 6.3 Data Minimization for Sidebar Display

The sidebar currently displays:
- `workflow.input.title` ✅ (minimal, necessary for identification)
- `workflow.epicId` ✅ (system identifier)
- `workflow.startedAt` ✅ (timestamp for ordering)
- `workflow.phase` ✅ (status indicator)

**No additional PII is exposed in the sidebar UI.** The full description/PRD content is only loaded when a workflow is actively selected and its `WorkflowBoard` is rendered.

---

## 7. Cross-Border Data Transfer Analysis

### 7.1 Current Architecture

- **Data stays within single AWS region** (configurable via `NEXT_PUBLIC_AWS_REGION`)
- **No cross-border transfer** unless:
  - User's browser is in a different jurisdiction than AWS region
  - S3 bucket has cross-region replication enabled

### 7.2 Recommendations

- Document the AWS region in privacy policy
- If serving EU users from US region, implement Standard Contractual Clauses (SCCs)
- Consider: add region indicator in UI footer for transparency

---

## 8. Accessibility & Inclusivity Compliance

The collapsible sidebar must meet accessibility standards that also have legal implications (ADA, Section 508, EAA):

| Requirement | Implementation |
|---|---|
| Keyboard navigable collapse/expand | `aria-expanded`, `aria-controls`, keyboard event handlers |
| Screen reader announcement | `aria-label` on toggle button, live region for state change |
| Focus management | Return focus to toggle button after collapse |
| Reduced motion | Respect `prefers-reduced-motion` for animation |
| Minimum touch target | Toggle button ≥ 44x44px (WCAG 2.5.5) |

---

## 9. Compliance Checklist for Implementation

### Pre-Implementation
- [ ] Confirm no new PII collection beyond existing fields
- [ ] Verify auth/session protection on all API routes
- [ ] Document data flows in privacy documentation

### During Implementation
- [ ] Collapsible sidebar preserves existing data access patterns (no new data exposed)
- [ ] Intake form enhancements include privacy notice text
- [ ] Client-side PII/secret detection warnings implemented (non-blocking)
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Sidebar collapsed state persisted in localStorage only (no server tracking)
- [ ] No analytics/tracking added for sidebar toggle behavior

### Post-Implementation
- [ ] Security review of new API endpoints (if any)
- [ ] Penetration test for XSS via enhanced input fields
- [ ] Privacy Impact Assessment (PIA) update if serving regulated industries
- [ ] Update Terms of Service if data retention policy is formalized
- [ ] Document retention/deletion procedures in runbook

---

## 10. Risk Assessment Summary

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|---|---|---|---|---|
| PII in workflow descriptions | Medium | Medium | PII detection warnings | Low |
| Lack of data deletion capability | High | High | Implement DELETE API + auto-purge | Medium → Low |
| Unauthorized workflow access | Low | High | Auth middleware (verify exists) | Low |
| Data retention without policy | High | Medium | Define and implement retention schedule | Low |
| Accessibility non-compliance | Medium | Medium | Follow WCAG 2.1 AA guidelines | Low |
| Screen sharing data exposure | Medium | Low | Collapsible sidebar addresses this | Very Low |

---

## 11. Conclusion & Recommendations

The "Collapsible History Sidebar + Intake Card Enhancements" feature has **low privacy risk** overall. The collapsible sidebar actually **improves** privacy posture by allowing users to hide workflow history during screen sharing.

### Critical Items to Address (Follow-up Tickets)

1. **[HIGH]** Implement workflow data deletion capability (Right to Erasure)
2. **[HIGH]** Define and enforce data retention policy for completed workflows
3. **[MEDIUM]** Add privacy notice to intake form
4. **[MEDIUM]** Add PII/credential detection warnings on intake submission
5. **[MEDIUM]** Verify authentication/authorization on workflow list/state APIs

### Verdict

**✅ NO LEGAL BLOCKERS** — The team may proceed with the UI enhancements. The above items should be tracked as separate follow-up tickets for the compliance backlog.

---

## Appendix A: Applicable Regulations Reference

| Regulation | Jurisdiction | Relevance |
|---|---|---|
| GDPR | EU/EEA | Data minimization, retention, erasure rights |
| CCPA/CPRA | California, USA | Right to delete, right to know |
| ADA Title III | USA | Accessibility of web applications |
| Section 508 | USA (Federal) | Accessibility for government use |
| EAA | EU | European Accessibility Act (2025) |
| SOC 2 Type II | Global (B2B) | Audit logging, access controls |

## Appendix B: localStorage Usage for Sidebar State

The sidebar collapsed state SHOULD be stored in `localStorage` under a non-PII key:

```typescript
// Acceptable — no PII, no tracking
localStorage.setItem("workflow-sidebar-collapsed", "true");

// NOT acceptable — do not store:
// - User identity
// - Workflow IDs viewed
// - Timestamps of access
// - Any behavioral tracking data
```

This approach requires no cookie consent banner as localStorage for functional preferences is exempt under ePrivacy Directive Article 5(3).
