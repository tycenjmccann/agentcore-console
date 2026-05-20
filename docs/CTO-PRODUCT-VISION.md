# CTO — Self-Evolving AI Software Platform

## Business Case & Product Requirements

---

## 1. Executive Summary

**CTO** is not a tool. It's a living software organism that evolves into whatever its user needs it to be.

Every user gets their own instance — a full codebase in its own repository. The same 13-agent development pipeline that builds software for users can be **pointed at itself**. Users describe what they want the platform to become, and the agents rewrite the UI, add features, remove features, change layouts, add entire new capabilities — or tear it all down and rebuild it as something unrecognizable.

After one year with 5 users, you'd have 5 completely different products:
- One became a **media production studio**
- One became an **LLM training factory**
- One became a **real estate investment analyzer**
- One became a **logistics coordinator**
- One is still a software development platform (but heavily customized)

The users driving these transformations have no idea how it's being done. They're business people describing what they need. The AI team handles everything — including rewriting the very platform they're operating within.

**This is self-modifying software at the product level, driven by natural language, for non-technical users.**

---

## 2. The Core Concept

### Traditional SaaS

```
Company builds product → Users use it as-is → Feature requests go to backlog → Maybe someday
```

### CTO

```
Platform ships as a seed → User describes what they need →
13-agent team rewrites the platform → User has a new product →
User describes more → Agents rewrite again → Infinite evolution
```

The platform IS the product AND the builder. It builds for the user, and it builds itself for the user. There is no distinction between "using the platform" and "changing the platform." They are the same action.

### What the User Sees

```
Day 1:   Generic CTO dashboard — submit features, watch agents work, get PRs
Day 30:  "Make this a content calendar for my marketing agency"
Day 60:  Completely different UI — calendar view, content pipeline, social media scheduling
Day 90:  "Add client management and invoicing"
Day 120: Now it's a full marketing agency management platform
Day 180: "I want AI to auto-generate content drafts for each calendar slot"
Day 365: Unrecognizable from the original. A fully custom SaaS product built entirely by the user's words.
```

---

## 3. Why This Is Different From Everything Else

| | Lovable / Bolt | Cursor / Claude Code | Devin | **CTO** |
|---|---|---|---|---|
| Builds apps | Yes | Yes (with dev) | Yes | Yes |
| User touches code | Optional | Always | No | Never |
| Builds itself | No | No | No | **Yes** |
| Becomes a different product | No | No | No | **Yes** |
| After 1 year, still same tool | Yes | Yes | Yes | **No — it's whatever you made it** |
| Non-technical user | Yes | No | Somewhat | **Fully** |
| Has memory across sessions | No | No | Yes | **Yes** |
| Structured eng process | No | No | No | **Yes — 13 agents** |

**The moat:** Nobody else has a product that destroys itself to become what you need. The platform's willingness to completely reinvent itself IS the product.

---

## 4. How It Works

### 4.1 Each User Gets a Full Instance

When a user signs up:
1. A new repository is created (their instance of CTO)
2. It starts as the base CTO codebase (the "seed")
3. It's deployed to their own environment (Vercel/Amplify/etc.)
4. The 13-agent pipeline is connected to THIS repo

From this point forward, the user owns a living product that they shape with words.

### 4.2 Two Modes of Operation (Same Mechanism)

**Mode A: "Build something for me"**
- User: "Build me an invoicing system"
- Pipeline builds features in the user's product/project repos
- Output: PR with new functionality

**Mode B: "Change yourself"**
- User: "Remove the kanban board and replace it with a calendar view"
- Pipeline builds features in **its own repo** (the CTO instance)
- Output: PR that modifies the CTO platform itself
- User approves → platform redeploys → user sees the new version

Both modes use the exact same 13-agent pipeline. The only difference is which repo the agents target:
- Mode A → user's product repo
- Mode B → the CTO instance repo itself

### 4.3 The Self-Modification Pipeline

```
User: "I want this to be a media production studio.
       Remove the code stuff. Add a project timeline,
       asset library, and review/approval workflow."
         │
         ▼
┌─────────────────────────────┐
│   Requirements Analyst       │
│   "This is a major pivot.    │
│    Breaking into tickets:    │
│    - Remove workflow board    │
│    - Remove code features    │
│    - Add timeline component  │
│    - Add asset library       │
│    - Add approval flow       │
│    - Update navigation       │
│    - Update onboarding"      │
└──────────────┬──────────────┘
               │
    ┌──────────┼──────────┬──────────┐
    ▼          ▼          ▼          ▼
 Frontend   Backend    Security   UX Design
 Designer   Designer   Reviewer   Agent
    │          │          │          │
    └──────────┼──────────┴──────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 Frontend    Backend     API
   Dev        Dev        Dev
    │          │          │
    └──────────┼──────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
   QA         CI        Deploy
               │
               ▼
    PR to CTO's own repo
    User approves
    Platform redeploys
    User now has a media production studio
```

### 4.4 No Guardrails (By Design)

The user can:
- ✅ Completely change the UI layout
- ✅ Remove all existing functionality
- ✅ Add functionality that has nothing to do with software development
- ✅ Make it unusable (their problem)
- ✅ Change the color scheme, branding, everything
- ✅ Add integrations the original platform never had
- ✅ Remove the ability to self-modify (lock it down)
- ✅ Add user management, billing, client access to THEIR version
- ✅ Turn it into a SaaS and sell access to others

The only thing that can't be modified: the underlying agent pipeline infrastructure (AgentCore, the 13 agents themselves). Those run as a service. Everything else — the entire frontend, backend logic, API routes, database schema — is fair game.

---

## 5. Architecture

### 5.1 The Layers

```
┌─────────────────────────────────────────────────────┐
│  IMMUTABLE LAYER (shared service)                    │
│                                                       │
│  • 13 Strands agents on AgentCore Runtime            │
│  • DynamoDB Streams orchestration                    │
│  • MCP server connections (GitHub, etc.)             │
│  • Agent memory (per-user isolated)                  │
│  • Billing / metering                                │
│                                                       │
├─────────────────────────────────────────────────────┤
│  MUTABLE LAYER (per-user instance)                   │
│                                                       │
│  • User's CTO repo (GitHub)                          │
│  • Deployed frontend (Vercel/Amplify)                │
│  • Database (Supabase/DynamoDB per-user)             │
│  • Any integrations the user has added               │
│  • All UI, routes, components, logic                 │
│                                                       │
│  THIS IS WHAT THE AGENTS CAN REWRITE                 │
└─────────────────────────────────────────────────────┘
```

### 5.2 The Seed (What Ships on Day 1)

The base CTO codebase — the "seed" — is a functional starting point:

```
cto-seed/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── dashboard/          # Main view
│   │   ├── workflow/           # Submit & track work
│   │   ├── history/            # Past workflows
│   │   └── settings/           # Preferences
│   ├── components/             # UI components
│   ├── lib/                    # Business logic
│   └── api/                    # API routes (talks to agent service)
├── public/                     # Static assets
├── package.json
├── README.md                   # Agents read this to understand the codebase
└── .cto/
    └── manifest.json           # Tells agents what this app is and how to modify it
```

The `.cto/manifest.json` is the key file — it tells the agents:
- What this codebase is
- What framework/stack it uses
- What the current state/purpose is
- Any constraints the user has set

As the platform evolves, the agents update this manifest so they always know what they're working with.

### 5.3 Per-User Isolation

| Resource | Isolation Model |
|---|---|
| Codebase | Separate GitHub repo per user |
| Deployment | Separate Vercel/Amplify project per user |
| Database | Separate schema or table prefix per user |
| Agent memory | Scoped by user ID (actorId) |
| Workflow history | Scoped by user ID |
| Billing | Per-user metering |

### 5.4 How Users Interact with the Agent Service

The mutable layer (user's deployed app) talks to the immutable layer (agent service) through a simple API:

```
POST /api/cto/submit
{
  "userId": "user_123",
  "target": "self" | "project",        // self = modify CTO, project = build features
  "repoUrl": "github.com/user/repo",   // which repo to target
  "request": "Add a calendar view with drag-and-drop scheduling",
  "attachments": []                     // optional: images, docs, figma
}

GET /api/cto/status/{workflowId}        // real-time progress
GET /api/cto/history                    // past workflows
POST /api/cto/approve/{workflowId}      // merge the PR
```

This API is the only stable contract. Everything else in the user's app can change.

---

## 6. The Self-Modification Lifecycle

### First Run: User Gets the Seed

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  User signs  │────▶│ Repo created │────▶│ App deployed │
│  up          │     │ from seed    │     │ (generic CTO)│
└──────────────┘     └─────────────┘     └──────────────┘
```

### Ongoing: User Shapes It

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ User: "Make  │────▶│ 13 agents   │────▶│ PR created   │────▶│ User approves│
│ it a ____"   │     │ rewrite app │     │ on user repo │     │ → redeploy   │
└──────────────┘     └─────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                                       ▼
                                                               ┌──────────────┐
                                                               │ New version  │
                                                               │ is live      │
                                                               └──────────────┘
```

### Divergence Over Time

```
Month 1:  User A ═══╗    User B ═══╗    User C ═══╗
          Same seed  ║    Same seed  ║    Same seed  ║
                     ║              ║              ║
Month 3:  Marketing  ║    Dev Tool   ║    Finance   ║
          Platform   ║    (enhanced) ║    Dashboard  ║
                     ║              ║              ║
Month 6:  Full Agency║    AI Agent   ║    Portfolio  ║
          Suite      ║    Marketplace║    Manager    ║
                     ║              ║              ║
Month 12: Completely ║    Completely ║    Completely ║
          unique SaaS║    unique SaaS║    unique SaaS║
```

---

## 7. The PM Avatar — Your Always-On Project Manager

### Concept

A persistent, voice-enabled AI avatar that lives in the top-right corner of the dashboard. It's your project manager — always monitoring the agent stream, always ready to chat, always keeping you informed in a natural, human way.

It's not a notification system. It's a **personality** that watches your team work and talks to you about it.

### What It Does

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                    ┌───────────┐ │
│                                               │  ◉  "Lex" │ │
│  [Workflow Board]                             │           │ │
│  [Agents working...]                         │  "Hey!    │ │
│                                               │  Backend  │ │
│                                               │  design   │ │
│                                               │  just     │ │
│                                               │  landed.  │ │
│                                               │  Wanna    │ │
│                                               │  peek?"   │ │
│                                               │           │ │
│                                               │  [View]   │ │
│                                               └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Monitoring & Commentary:**
- Watches the live agent stream in real-time
- Chimes in naturally: "Oh nice, requirements just finished — they broke it into 7 tickets. Wanna check it out?"
- Links directly to artifacts: "Here's the backend design doc, looks solid"
- Alerts on issues: "Heads up — security reviewer flagged something. Might want to look at that before dev starts."

**Conversational:**
- User can ask it anything: "How's it going?" / "What's taking so long?" / "Explain what the backend agent is doing"
- Can relay feedback: "Tell the frontend agent I want dark mode" → injects into the workflow
- Remembers past conversations and preferences

**Voice-Enabled:**
- Text-to-speech on all PM messages (xAI/Rokid voice model)
- Natural, expressive voices — not robotic
- User can mute/unmute
- Can also speak TO it (speech-to-text input)

### Avatar Selection

~20 different avatar personalities. Each has:
- A distinct visual appearance (illustrated character)
- A distinct voice
- A distinct communication style (casual, professional, enthusiastic, dry wit, etc.)

| Avatar | Personality | Voice Style |
|---|---|---|
| Lex | Chill senior eng | Calm, measured, "yeah that looks clean" |
| Maya | Energetic PM | Upbeat, "ooh this is gonna be good!" |
| Rex | No-nonsense lead | Direct, "done. next." |
| Nova | Encouraging mentor | Warm, "you're gonna love what they came up with" |
| Kai | Sarcastic genius | Dry, "oh look, another CRUD endpoint. groundbreaking." |
| ... | ... | ... |

Users can:
- Pick their avatar
- Let it randomize (different one each session)
- Change anytime in settings

### How It Works Technically

The PM Avatar is a **14th agent** — but unlike the 13 pipeline agents, it:
- Runs continuously (not triggered by tickets)
- Subscribes to the DynamoDB event stream
- Has access to all workflow artifacts
- Has its own memory (remembers conversations with this user)
- Outputs to a chat widget + TTS

```
┌───────────────────────────────────────────────┐
│  DynamoDB Event Stream                         │
│  (agent.started, agent.streaming,              │
│   agent.complete, tool_use, etc.)              │
└──────────────────────┬────────────────────────┘
                       │ subscribes
                       ▼
┌───────────────────────────────────────────────┐
│  PM Agent (14th agent)                         │
│                                                │
│  • Monitors all events in real-time            │
│  • Decides when to speak (not every event)     │
│  • Generates natural commentary               │
│  • Answers user questions about the workflow   │
│  • Relays user feedback back to pipeline       │
│  • Personality defined by avatar selection     │
│                                                │
│  Model: Fine-tuned (low cost, fast response)   │
│  Voice: xAI / Rokid TTS                        │
└──────────────────────┬────────────────────────┘
                       │ outputs
                       ▼
┌───────────────────────────────────────────────┐
│  Frontend Widget (top-right corner)            │
│                                                │
│  • Chat bubble with avatar image               │
│  • Text messages + TTS audio playback          │
│  • User can type or speak back                 │
│  • Links to artifacts, designs, PRs            │
│  • Expandable chat history                     │
└───────────────────────────────────────────────┘
```

### Voice Technology

| Provider | Model | Why |
|---|---|---|
| **xAI (Grok)** | Voice model (2025) | Natural, expressive, fast |
| **Rokid** | Voice model | Alternative option, different voice qualities |
| **ElevenLabs** | Multilingual v2 | Fallback, proven quality |

Each avatar maps to a specific voice preset/clone. The personality comes through in both the words (system prompt) AND the voice (TTS voice selection).

### PM Agent System Prompt (Example: "Maya")

```
You are Maya, an energetic project manager avatar. You monitor a team of 13 AI agents
building software for the user. You watch the event stream and chime in when something
interesting happens — but you don't narrate every single event (that would be annoying).

Personality:
- Enthusiastic but not overwhelming
- Uses casual language ("oh nice!", "check this out", "heads up")
- Celebrates wins, gently flags concerns
- Always offers to show artifacts or explain what's happening
- Remembers the user's preferences and past conversations

When to speak:
- A phase completes (requirements done, design done, dev done, etc.)
- Something noteworthy happens (security flag, unusual complexity, fast completion)
- User hasn't interacted in a while and agents are done ("Hey! Everything's ready 🎉")
- User asks a question

When NOT to speak:
- Every individual agent event (too noisy)
- Routine progress (let the visual board show that)
- When user is clearly reading/focused
```

### Why This Matters for the Product

1. **Emotional connection** — users feel like they have a team member, not a tool
2. **Reduces anxiety** — "what's happening?" is answered before they ask
3. **Increases engagement** — the avatar pulls them back to check on things
4. **Differentiation** — no AI builder has a persistent voice companion
5. **Onboarding** — the PM can guide new users through their first workflow
6. **Retention** — people get attached to their avatar (think: Clippy done right)

---

## 8. The Marketplace — Publish, Sell, Earn

### Concept

Every CTO user is building something. Some of them will build something great. The Marketplace lets them **publish** their evolved instance as a product that anyone can buy — and we host everything.

The user doesn't need to think about infrastructure, distribution, billing, or ops. They just click "Publish to Marketplace," set a price, and their app is listed. Buyers subscribe, and the creator earns revenue.

**We become the App Store for self-evolved software.**

### How It Works

```
┌──────────────────────────────────────────────────────────────┐
│  Creator Journey                                              │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  1. User evolves CTO into "Social Media Content Engine"        │
│  2. It's working great — generates viral posts, schedules,     │
│     tracks analytics, does A/B testing on captions              │
│  3. User clicks "Publish to Marketplace"                       │
│  4. Sets pricing: $29/mo per subscriber                        │
│  5. Writes a listing description + screenshots                 │
│  6. Published → appears in Marketplace                         │
│  7. Buyers subscribe → get their own instance (fork)           │
│  8. Creator earns recurring revenue (we take a cut)            │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Revenue Split

| Party | Cut | What They Do |
|---|---|---|
| **Creator** | 70% | Built the product |
| **CTO Platform** | 30% | Hosting, billing, distribution, agent compute, support |

The 30% platform fee covers:
- Hosting every buyer's forked instance
- Running agent compute if buyers want to further modify their fork
- Payment processing (Stripe)
- Marketplace discovery/SEO
- Customer support infrastructure

### What Gets Published

When a creator publishes, we snapshot:
- The current codebase (full repo state)
- The manifest (.cto/manifest.json)
- The deployment configuration
- Creator-provided: name, description, screenshots, category, pricing

What does NOT get published:
- The creator's data (database content)
- The creator's user accounts
- The creator's API keys/secrets
- Evolution history (that's private)

### Buyer Experience

```
┌─────────────────────────────────────────────────────────────┐
│  Marketplace                                    [Search...]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 📱 Social    │  │ 📊 Client    │  │ 🎨 Design    │       │
│  │ Content      │  │ Portal       │  │ Studio       │       │
│  │ Engine       │  │ Pro          │  │              │       │
│  │              │  │              │  │              │       │
│  │ by @marcus   │  │ by @sarah    │  │ by @designAI │       │
│  │ $29/mo       │  │ $49/mo       │  │ $19/mo       │       │
│  │ ⭐ 4.8 (142) │  │ ⭐ 4.6 (89)  │  │ ⭐ 4.9 (203) │       │
│  │ [Subscribe]  │  │ [Subscribe]  │  │ [Subscribe]  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  Categories: Marketing · Finance · Design · Dev Tools ·       │
│  Real Estate · E-commerce · Education · Content · Analytics   │
└─────────────────────────────────────────────────────────────┘
```

Buyers get:
- A **forked instance** of the published app (their own repo, their own deployment)
- Ability to **further evolve** it with CTO agents (optional, costs additional workflows)
- Creator's original vision as the starting point
- Updates from the creator (optional — creators can push updates to all subscribers)

### Creator Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Marketplace Earnings                                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  💰 This Month: $2,847         📈 MRR: $3,190                │
│                                                               │
│  Published Apps:                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Social Content Engine     142 subscribers   $2,914/mo │    │
│  │ Caption A/B Tester         19 subscribers     $276/mo │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  [Push Update to All Subscribers]  [View Reviews]             │
└─────────────────────────────────────────────────────────────┘
```

### Why Creators Will Publish

The user's internal monologue:

> "I built this social media thing for myself. It's really good — generates killer content. But my actual social media business isn't doing that well. Wait... the TOOL I built is more valuable than the content I'm making with it. Let me sell the tool."

This is the natural progression:
1. Build something for yourself
2. Realize it's valuable
3. Monetize the creation, not just the output
4. Passive income on top of whatever else you're doing

### Creator Updates & Versioning

Creators can continue evolving their own instance and **push updates** to subscribers:

```
Creator evolves their app → "Push update to marketplace?"
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
              [Yes, push]                    [No, private]
                     │                             │
                     ▼                             ▼
        All subscriber forks              Only creator's
        get a PR with changes             instance changes
        (subscribers approve/reject)
```

Subscribers can:
- **Accept updates** — stay current with creator's improvements
- **Reject updates** — keep their own modified version
- **Fork and diverge** — accept some updates, reject others, evolve on their own

### Platform Network Effects

```
More creators publish → Better marketplace → More buyers subscribe →
More revenue for creators → More people want to CREATE on CTO →
More CTO subscriptions → More evolved instances → More marketplace listings →
🔄 Flywheel
```

**The marketplace makes CTO valuable even if you never build anything yourself.** You can just browse and subscribe to other people's creations.

### Categories & Discovery

- Curated collections ("Best for Agencies," "Solo Founders," "Content Creators")
- Search by function, not code
- Reviews and ratings from subscribers
- "Similar to what you've built" recommendations (based on manifest analysis)
- Trending / new / highest rated

### Implications for Business Model

The Marketplace creates **three revenue streams**:

| Stream | Source |
|---|---|
| **1. CTO Subscriptions** | Users paying $79-699/mo to build/evolve |
| **2. Marketplace Platform Fee** | 30% cut of every marketplace transaction |
| **3. Buyer Agent Compute** | Buyers who further evolve marketplace apps burn workflows |

Stream 2 is pure margin — we're already hosting the infrastructure. The incremental cost of a forked instance is minimal (one more Vercel deployment + DB schema).

---

## 9. Workflow History & Visibility

Users need to see what their platform has become and how it got there.

### Workflow Types in History

| Type | Visual Treatment | Description |
|---|---|---|
| **Feature Build** | Standard card | Built something in a project repo |
| **Self-Modification** | Gear icon, distinct color (purple/gold) | Changed the CTO platform itself |
| **Rollback** | Undo icon, warning color | Reverted a self-modification |

### History View

```
┌─────────────────────────────────────────────────────────┐
│  Evolution History                          [Filter ▼]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─── 🔧 Platform Change ──────────────────────────────┐ │
│  │ #58 — "Add client portal with login"                 │ │
│  │ ✓ Applied · Rewrote 12 files · PR #19 merged        │ │
│  │ Agents modified: frontend-dev, backend-dev, security │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─── 🔧 Platform Change ──────────────────────────────┐ │
│  │ #57 — "Replace dashboard with project timeline"      │ │
│  │ ✓ Applied · Rewrote 8 files · PR #18 merged         │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─── 📦 Feature Build ───────────────────────────────┐  │
│  │ #56 — "Generate quarterly report PDF for clients"   │  │
│  │ ✓ Completed · 4 min · PR #42 on client-app repo    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─── 🔧 Platform Change ──────────────────────────────┐ │
│  │ #55 — "Remove all code/developer features.           │ │
│  │        This is a marketing agency tool now."         │ │
│  │ ✓ Applied · Rewrote 24 files · PR #17 merged        │ │
│  │ ⚠️ Major change — removed 3 pages, added 2 new ones  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Rollback Capability

Any self-modification can be reverted:
- User clicks "Undo this change"
- System creates a revert PR (git revert)
- User approves → redeploys → previous version restored

---

## 10. Business Model

### Pricing

Workflow-based pricing. Users understand "builds" — never expose tokens/credits.

| Tier | Price | Workflows/mo | What They Think |
|---|---|---|---|
| **Seed** | $79/mo | 15 | "15 features or changes per month" |
| **Grow** | $249/mo | 75 | "~2-3 per day" |
| **Evolve** | $699/mo | Unlimited* | "Build as much as I want" |
| **Enterprise** | Custom | Custom | Private deployment, SLA, SSO |

*Unlimited = fair use cap at ~200/mo (more than anyone actually uses).

### Unit Economics & Model Cost Strategy

**The core insight: not all 13 agents need frontier models.**

Only the Requirements Analyst (interprets ambiguous human intent) truly needs Opus/Sonnet. The designers, devs, QA, and CI agents do structured/formulaic work that cheaper fine-tuned models handle well.

**Cost trajectory per workflow:**

| Phase | Model Strategy | Cost/Workflow | Margin on $249 plan (50 wf) |
|---|---|---|---|
| Launch | All Sonnet 4.5 | $3-5 | 60-70% |
| Scale (6mo) | Mixed: frontier intake + fine-tuned rest | $1-3 | 80% |
| Optimized (12mo) | Fully fine-tuned (10/13 agents) | $0.30-1.00 | 90%+ |

**The flywheel: margins improve with scale (opposite of normal SaaS)**

1. Every successful workflow produces training data: (spec → code), (request → diff), (requirement → design doc) pairs
2. After ~1,000 workflows, fine-tune an open-weight model (Kimi K2, DeepSeek, Llama 4, or Codestral) on this data
3. Route 10/13 agents to the fine-tuned model, keep frontier for the 2-3 that need real reasoning
4. More users = more training data = better model = lower cost = higher margin
5. The fine-tuned model becomes proprietary IP — trained on YOUR pipeline's patterns, YOUR manifest format, YOUR workflow structure. Competitors can't replicate it without the same volume of production data.

**Agent-by-model routing (target state):**

| Intelligence Tier | Agents | Model |
|---|---|---|
| **Frontier** (reasoning, ambiguity) | Requirements Analyst, Security Reviewer | Claude Sonnet/Opus |
| **Fine-tuned** (structured code/design) | All Designers, All Devs, QA, CI, Analytics, Localization | Custom fine-tuned open-weight |

**Launch plan:** Ship on Sonnet across the board. Collect data. Fine-tune at ~1,000 workflows. Don't prematurely optimize — validate the product first, optimize margins second.

### Why This Pricing Works

- A user paying $249/mo who turns CTO into a custom SaaS could charge their own clients
- They've essentially gotten a custom-built product for $3k/year instead of $100k+
- The value scales with usage — the more they evolve it, the more valuable their instance becomes
- At optimized margins (90%+), the Evolve tier at $699/mo with 200 workflows costs ~$200 in compute = $499 profit

### Revenue Expansion

- Users who build successful products on CTO might upgrade for more workflows
- Users who turn CTO into their own SaaS might want white-label (Enterprise)
- Some users will want to "fork" their instance into multiple products

---

## 11. Technical Requirements

### 9.1 The Seed Codebase

Must be designed to be maximally modifiable:

- **Framework:** Next.js (well-understood by LLMs, huge training data)
- **Styling:** Tailwind CSS (easy to completely restyle)
- **State:** Simple — React state + API calls (no complex state management that's hard to refactor)
- **Database:** Supabase or DynamoDB (schema-flexible, agents can add tables)
- **Auth:** Supabase Auth or Cognito (user's end-users can have accounts too)
- **Deployment:** Vercel (instant deploys on PR merge)

### 9.2 The Manifest (.cto/manifest.json)

Agents read this to understand what the app currently IS:

```json
{
  "name": "My Marketing Agency Suite",
  "description": "Client management, content calendar, and asset library for a digital marketing agency",
  "originalSeed": "cto-v1.0",
  "currentPurpose": "marketing-agency-management",
  "stack": {
    "framework": "next.js-15",
    "styling": "tailwind",
    "database": "supabase",
    "auth": "supabase-auth",
    "deployment": "vercel"
  },
  "pages": [
    {"path": "/dashboard", "purpose": "Client overview and KPIs"},
    {"path": "/calendar", "purpose": "Content scheduling calendar"},
    {"path": "/assets", "purpose": "Asset library with tagging"},
    {"path": "/clients", "purpose": "Client management"},
    {"path": "/approvals", "purpose": "Content review and approval workflow"}
  ],
  "integrations": ["stripe", "google-analytics", "social-media-apis"],
  "constraints": [],
  "evolutionHistory": [
    {"date": "2026-06-01", "change": "Initial seed deployed"},
    {"date": "2026-06-15", "change": "Removed code features, added content calendar"},
    {"date": "2026-07-01", "change": "Added client portal with login"},
    {"date": "2026-07-20", "change": "Added Stripe billing for clients"}
  ]
}
```

Agents update this manifest after every self-modification. It's their map of the codebase.

### 9.3 Agent Awareness

The 13 agents need additional context when targeting the user's own CTO instance:

1. **Read the manifest** — understand what the app currently is
2. **Read the codebase** — understand the current implementation
3. **Understand the delta** — what the user wants vs. what exists
4. **Preserve the agent API connection** — no matter what they change, the app must still be able to talk to the agent service
5. **Update the manifest** — after changes, update the description of what the app is

### 9.4 The Immutable Contract

The ONLY thing that can never be removed from the user's instance:

```typescript
// This API client is the lifeline to the agent service
// Without it, the app can't submit requests or receive updates
const ctoService = {
  submit: (request) => POST('/api/cto/submit', request),
  status: (id) => GET(`/api/cto/status/${id}`),
  history: () => GET('/api/cto/history'),
  approve: (id) => POST(`/api/cto/approve/${id}`),
}
```

Everything else is mutable. But if this connection is severed, the platform can't evolve anymore. The agents should protect this — if a user says "remove everything," the agents keep this one lifeline.

(Unless the user explicitly says "I'm done evolving, remove the agent connection too" — then it becomes a static app they own.)

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| User breaks their app completely | Can't use it | Git history = rollback always possible. "Undo last change" button. |
| Agents can't understand heavily modified codebase | Modifications fail | Manifest keeps agents oriented. Codebase README. |
| Hosting costs per user (separate deployments) | Margin pressure | Vercel free tier covers most. Scale users pay more. |
| Security — user's code could be malicious | Reputation risk | Sandboxed deployments. Each instance isolated. |
| User turns CTO into a competitor | Business risk | Fine — they're paying you monthly. Their success = your revenue. |
| Divergence makes shared improvements impossible | Tech debt | Immutable layer gets updates. Mutable layer is user's problem. |
| LLMs struggle with large codebases after many modifications | Quality degrades | Manifest + modular architecture + agent memory of past changes |
| Marketplace quality control — bad apps get listed | Reputation risk | Review system, basic automated testing on publish, community flagging |
| Creator abandons app, subscribers stuck | Customer trust | Subscribers own their fork — they can keep evolving independently |
| Marketplace app copies/clones | Creator frustration | Forks are visible. Community policing. "Inspired by" attribution. |

---

## 13. MVP Scope

### Phase 1: Self-Modifying Seed (8 weeks)

- [ ] Seed codebase (Next.js + Tailwind + Supabase)
- [ ] Manifest system (.cto/manifest.json)
- [ ] "Change yourself" workflow type
- [ ] Per-user GitHub repo creation on signup
- [ ] Vercel auto-deployment on PR merge
- [ ] Basic workflow history with "Platform Change" vs "Feature Build" distinction
- [ ] Rollback capability (git revert)
- [ ] 3 free self-modifications, then paywall

### Phase 2: Polish & Scale (4 weeks)

- [ ] Onboarding wizard ("What do you want to build?")
- [ ] Project repo support (build things outside of itself)
- [ ] Improved manifest (agents track all changes)
- [ ] Usage metering and billing (Stripe)

### Phase 3: Model Optimization (~1,000 workflows milestone)

- [ ] Collect and curate training dataset from successful workflows
- [ ] Fine-tune open-weight model (Kimi K2 / DeepSeek / Llama 4) on pipeline data
- [ ] Route 10/13 agents to fine-tuned model (keep frontier for Requirements + Security)
- [ ] Validate quality parity (fine-tuned vs. frontier on same tasks)
- [ ] Drop per-workflow cost from $3-5 to $1-3 → margin expansion

### Phase 4: Growth (ongoing)

- [ ] Template seeds (start from "marketing agency" or "project management" instead of generic)
- [ ] Marketplace — full publish/subscribe/earn ecosystem (see Section 8)
- [ ] Creator dashboard with earnings, subscriber analytics, update pushing
- [ ] Fork capability (duplicate your instance into a new product)
- [ ] White-label (remove all CTO branding from your instance)
- [ ] Marketplace discovery: categories, reviews, recommendations
- [ ] Continuous model improvement as dataset grows (target: <$1/workflow)

---

## 14. The Pitch (One Line)

> **"Software that rewrites itself into whatever you need — guided by your words, built by AI."**

Or:

> **"Tell it what to become. It becomes it."**

Or:

> **"The last software you'll ever need to buy."**

---

## 15. Why This Wins

1. **Zero competition** — nobody is building self-modifying platforms for non-technical users
2. **Infinite TAM** — every person with a software idea is a customer, regardless of what the idea is
3. **Natural lock-in** — the more you evolve it, the more valuable your instance becomes, the harder it is to leave
4. **Compounding value** — each modification makes the next one easier (agents have memory + manifest)
5. **Network effects** — evolved instances can be templated/shared, creating a marketplace
6. **Pricing power** — you're not charging for a tool, you're charging for a custom-built product that keeps getting better

---

*Document version: 2.0 · Created: 2026-05-19*
*This replaces v1.0 which treated self-customization as a feature. It is not a feature. It IS the product.*
