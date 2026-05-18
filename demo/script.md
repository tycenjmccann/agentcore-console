# Demo Video Script: AgentCore Console — AI Development Pipeline

## Overview
- **Total runtime target**: ~3-4 minutes (after speedup of waiting sections)
- **Raw recording**: ~15-20 minutes (agents take time)
- **Speedup sections**: Agent working phases at 8x speed
- **Voice**: AWS Polly neural voice "Matthew" (professional male)

---

## Scene 1: Opening / Dashboard (0:00 - 0:20)

**Visual**: Dashboard page with agent cards, metrics, traces overview

**Narration**:
"This is AgentCore Console — an orchestration platform that turns feature requests into production-ready pull requests using a team of AI agents. Let me show you what happens when I submit a real feature request."

---

## Scene 2: Navigate to Workflow Tab (0:20 - 0:35)

**Visual**: Click "Workflow" in sidebar, show the intake form

**Narration**:
"The workflow system accepts any feature description — a PRD, mockup URL, or just a plain text request. Each submission kicks off a team of specialized agents: requirements analysis, design, development, and code review."

---

## Scene 3: Submit Feature Request (0:35 - 1:00)

**Visual**: Fill in the intake form:
- Title: "Add light/dark mode theme toggle"
- Description: "Add a theme toggle to the site header that switches between light and dark mode. Persist the user's preference in localStorage. Use CSS variables for theming so all components automatically adapt."
- Repo URL: the GitHub repo
- Select "Claude Opus 4" model

**Narration**:
"I'm submitting a request to add light and dark mode with a theme toggle. The system will figure out the requirements, design the implementation, write the code, and open a pull request — all autonomously."

---

## Scene 4: Requirements Agent Working (1:00 - 1:30)

**Visual**: Workflow board appears, requirements agent card shows "running" with streaming output. Tickets being created.

**Narration**:
"First, the requirements agent analyzes the request and breaks it into tickets. It decides which specialists are needed — for a frontend-only change like this, it won't spin up backend or mobile agents."

**[SPEEDUP: 4x through the requirements phase]**

---

## Scene 5: Design Agents Working (1:30 - 2:00)

**Visual**: Design phase agents activate in parallel. Show the ticket panel with stories assigned.

**Narration**:
"Design agents work in parallel — each one produces specifications for their domain. They can query each other directly using agent-to-agent communication if they need clarification."

**[SPEEDUP: 8x through design phase]**

---

## Scene 6: Development Agent Working (2:00 - 2:45)

**Visual**: Dev agent card shows "running", streaming code output. Show the agent writing actual files.

**Narration**:
"Now the development agent takes over. It clones the repo, creates a feature branch, writes the implementation, and commits working code. It has access to a code interpreter sandbox for testing, and the full git toolkit."

**[SPEEDUP: 8x through development, show key moments at normal speed]**

---

## Scene 7: PR Created (2:45 - 3:15)

**Visual**: Workflow shows "complete". Navigate to GitHub to show the actual PR with file changes.

**Narration**:
"The workflow is complete. A pull request has been created with the full implementation — CSS variables for theming, a toggle component in the header, and localStorage persistence. Let's merge it."

---

## Scene 8: Merge and Deploy (3:15 - 3:30)

**Visual**: Click merge on GitHub PR. Show deployment.

**Narration**:
"One click to merge. The code is production-ready — written by an AI agent team that understands the codebase, follows existing patterns, and produces clean, reviewable pull requests."

---

## Scene 9: Final Result (3:30 - 3:50)

**Visual**: Refresh the site, click the theme toggle, show light mode and dark mode switching.

**Narration**:
"And there it is — light and dark mode, built entirely by AI agents from a one-sentence feature request to a merged pull request. This is the future of software development."

---

## Scene 10: Closing (3:50 - 4:00)

**Visual**: Return to dashboard, show the completed workflow summary.

**Narration**:
"AgentCore Console. From idea to production in minutes, not days."

---

## Technical Notes

- Record at 1920x1080
- Use dark theme (current default) for most of the video
- Final scene shows the light theme toggle working as proof
- Mouse movements should be deliberate and visible
- Add 500ms pauses before/after clicks for readability
