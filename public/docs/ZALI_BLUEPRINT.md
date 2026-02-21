# ZALI DESIGN INTELLIGENCE — COMPLETE SYSTEM BLUEPRINT
## CLASSIFICATION: INTERNAL — AUTHORIZED PERSONNEL ONLY
### Date: 2026-02-21 | Version: 3.0 | Author: Aureon Engineering

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [Data Model & Database Schema](#5-data-model--database-schema)
6. [AI System Prompt Engineering](#6-ai-system-prompt-engineering)
7. [Complete User Workflow](#7-complete-user-workflow)
8. [Specialist Agent System](#8-specialist-agent-system)
9. [Software Project Pipeline](#9-software-project-pipeline)
10. [Hardware/Design Project Pipeline](#10-hardwaredesign-project-pipeline)
11. [3D Visualization Engine](#11-3d-visualization-engine)
12. [Real-time Communication](#12-real-time-communication)
13. [Security & Encryption](#13-security--encryption)
14. [File Structure Map](#14-file-structure-map)

---

## 1. SYSTEM OVERVIEW

ZALI (Zenith Adaptive Learning Intelligence) is a conversational AI design lab that transforms natural language descriptions into structured engineering specifications, production-ready code, or 3D-visualizable product designs.

**Core Capabilities:**
- Conversational requirement gathering via Socratic questioning (one question at a time, with recommended options)
- Automatic domain detection: Software vs. Hardware/Physical product
- 6 specialist sub-agents for cross-domain analysis
- Multi-phase design pipeline: Understanding → Research → Design → Simulation → Iteration → Documentation
- Real-time streaming responses via SSE (Server-Sent Events)
- 3D holographic CSS-based visualization for physical products
- Multi-file code output panel for software projects
- End-to-end encryption on all messages
- Community collaboration hub

**Tech Stack:**
- Frontend: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Supabase Edge Functions (Deno runtime)
- AI Model: Google Gemini 2.5 Flash (streamed via SSE)
- Database: PostgreSQL (via Supabase) with Row-Level Security
- Real-time: Supabase Realtime (Postgres Changes)
- Web Search: DuckDuckGo integration for research mode

---

## 2. ARCHITECTURE DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         ZALI DESIGN LAB — FULL STACK                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────────────────────────┐ │
│  │   ZaliView.tsx       │    │  Supabase Edge Function: zali-chat          │ │
│  │   (Orchestrator)     │───▶│  - Receives messages + projectContext       │ │
│  │                      │    │  - Builds composite system prompt           │ │
│  │  ┌─────────────────┐ │    │  - Detects software vs hardware intent     │ │
│  │  │ZaliProjectSelector│ │    │  - Optionally triggers DuckDuckGo search  │ │
│  │  │ZaliChatPanel     │ │    │  - Streams to Gemini 2.5 Flash via SSE    │ │
│  │  │ZaliWorkspace     │ │    │  - Transforms Gemini SSE → OpenAI SSE     │ │
│  │  │ZaliSpecsPanel    │ │    │  - Returns text/event-stream response     │ │
│  │  │ZaliAgentsPanel   │ │    └──────────────────────────────────────────────┘ │
│  │  │ZaliResearchPanel │ │                                                    │
│  │  │CommunityView     │ │    ┌──────────────────────────────────────────────┐ │
│  │  └─────────────────┘ │    │  Supabase Database (PostgreSQL)             │ │
│  └─────────────────────┘    │  - zali_projects (project metadata)          │ │
│                              │  - zali_messages (conversation history)      │ │
│                              │  - zali_research (research findings)         │ │
│                              │  - community_posts / replies / votes         │ │
│                              │  All tables have RLS (user_id = auth.uid())  │ │
│                              └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. FRONTEND ARCHITECTURE

### 3.1 Component Tree

```
ZaliView.tsx (ROOT ORCHESTRATOR — 621 lines)
├── ZaliProjectSelector.tsx (170 lines)
│   └── Project CRUD: create, delete, rename, select
│   └── Design type picker: product, material, biological, software, architecture, electrical, mechanical, general
│
├── ZaliChatPanel.tsx (360 lines)
│   ├── ModeSelector (chat | research | code | truth)
│   ├── DepthSelector (shallow | standard | deep | expert)
│   ├── ContextHealthIndicator (message count display)
│   ├── Message list with ReactMarkdown rendering
│   │   ├── UserMessageContent (code block detection + CodeFilePreview)
│   │   ├── ZaliQuestionOptions (parsed ```options blocks → clickable buttons)
│   │   ├── TruthScore indicator
│   │   ├── CalibrationFeedback (thumbs up/down)
│   │   ├── DecodeView (message analysis)
│   │   └── MessageCopyButton + CodeBlockCopyButton
│   ├── FollowUpSuggestions
│   ├── ScrollIntelligence (smart scroll behavior)
│   ├── "Generate Code" button (software projects only, triggers __GENERATE_CODE_NOW__)
│   └── Text input with Send/Stop controls
│
├── ZaliWorkspace.tsx (355 lines)
│   ├── SOFTWARE PATH:
│   │   └── ZaliCodeOutputPanel.tsx (228 lines)
│   │       ├── File tab switcher
│   │       ├── Syntax-highlighted code viewer (custom regex highlighter)
│   │       ├── Line numbers
│   │       ├── Copy per-file + Download All
│   │       └── File stats footer (lines, KB, language)
│   │
│   └── HARDWARE PATH:
│       ├── Phase indicator (UNDERSTANDING → DOCUMENTATION)
│       ├── View mode switcher (Assembled | Exploded | X-Section | Simulation)
│       ├── Product / Materials tab switcher
│       ├── Zali3DModel.tsx (168 lines) — CSS-based holographic 3D visualization
│       │   ├── Rotating rings with data nodes
│       │   ├── Component cards from specifications
│       │   ├── Exploded view with offset positions
│       │   └── Animated orbital system
│       ├── ZaliMaterialsView.tsx (548 lines) — Material detail panel
│       │   ├── Material cards with supplier links (McMaster-Carr, Digi-Key, Amazon, Alibaba, etc.)
│       │   ├── Pricing estimates
│       │   ├── Assembly instruction generator
│       │   └── Bill of Materials (BOM) table
│       ├── ModelDetailsPanel.tsx — Specs/Cost/Manufacturing/Simulation JSON display
│       └── "Build 3D Model" button + model description input
│
├── ZaliSpecsPanel.tsx (98 lines)
│   └── JSON viewer for: Technical Specifications, Cost Analysis, Manufacturing Plan, Simulation Results
│
├── ZaliAgentsPanel.tsx (100 lines)
│   └── 6 specialist agent cards: OPTIMUS, CHEMIX, BIOX, SYNTHIA, ECONIA, ETHICA
│
├── ZaliResearchPanel.tsx (90 lines)
│   └── 8 research domain progress bars + recent findings list
│
└── CommunityView.tsx
    └── Posts, replies, voting system
```

### 3.2 ZaliView.tsx — The Orchestrator (Complete Workflow)

This is the root component. Here's every operation it performs:

#### State Management
```typescript
// Projects
const [projects, setProjects] = useState<ZaliProject[]>([]);
const [activeProject, setActiveProject] = useState<ZaliProject | null>(null);

// Messages & research
const [messages, setMessages] = useState<ZaliMessage[]>([]);
const [findings, setFindings] = useState<Array<{ domain: string; title: string; confidence: number }>>([]);

// Streaming
const [isStreaming, setIsStreaming] = useState(false);
const abortRef = useRef<AbortController | null>(null);

// UI
const [activeTab, setActiveTab] = useState<ZaliTab>("workspace");
const [showMobileChat, setShowMobileChat] = useState(false);
const [chatMode, setChatMode] = useState<ChatMode>("chat");
const [chatDepth, setChatDepth] = useState<ResponseDepth>("standard");

// Auto-build triggers
const [autoBuildModel, setAutoBuildModel] = useState(false);
const [modelPrompt, setModelPrompt] = useState("");
const [codeFiles, setCodeFiles] = useState<Array<{ filename: string; language: string; content: string }>>([]);

// Resizable chat panel
const [chatWidth, setChatWidth] = useState(() => {
  const saved = localStorage.getItem("zali_chat_width");
  return saved ? Math.max(260, Math.min(600, parseInt(saved, 10))) : 360;
});
```

#### Data Loading Flow
1. **On mount** → Load all user projects from `zali_projects` table, ordered by `updated_at DESC`
2. **On project change** → Load messages from `zali_messages` + research from `zali_research`
3. **Realtime subscription** → Listen for `INSERT` events on `zali_messages` table filtered by `project_id`

#### Project CRUD
- `createProject(name, designType)` → Insert into `zali_projects` → Set as active → Clear messages
- `deleteProject(id)` → Delete from `zali_projects` → Remove from local state → Switch to next project
- `renameProject(id, name)` → Update `zali_projects` → Update local state

#### Message Send Flow (THE CORE PIPELINE)

This is the most critical function — `sendMessage(content)`:

**Step 1: User message insertion**
```
1. Create user message with crypto.randomUUID()
2. Add to local state immediately (optimistic)
3. Insert into zali_messages table (persisted)
```

**Step 2: Streaming request**
```
1. Create AbortController for cancellation
2. Build history array from all messages
3. POST to /functions/v1/zali-chat with:
   - messages: full conversation history
   - mode: chat | research | code | truth
   - depth: shallow | standard | deep | expert
   - projectContext: { name, description, phase, designType }
4. Read SSE stream via ReadableStream reader
5. Parse each "data: {...}" line
6. Extract choices[0].delta.content text
7. Append to assistant message content (real-time update)
8. Insert final assistant message into zali_messages
```

**Step 3: Post-processing (CRITICAL)**

After the full response is received, the frontend parses the AI's output for structured blocks:

**A. Code Output Detection (Software Projects)**
```
Regex: /```code_output\n([\s\S]*?)```/g
If matched:
  1. JSON.parse the block
  2. Extract files array: [{ filename, language, content }]
  3. Set codeFiles state
  4. Switch to workspace tab (shows ZaliCodeOutputPanel)
```

**B. Design Output Detection (Hardware Projects)**
```
Regex: /```design_output\n([\s\S]*?)```/
If matched:
  1. JSON.parse the block
  2. Extract: phase, design_type, specifications, cost_analysis, manufacturing, simulation_results
  3. Update zali_projects in database
  4. Update local project state
  5. Set autoBuildModel = true
  6. Switch to workspace tab (triggers 3D visualization)
```

**C. Build Command Detection**
```
Regex: /\b(build|generate|create|show|render|visualize)\b.*\b(3d|model|design|prototype|viewport)\b/i
If matched in user's message:
  1. Set autoBuildModel = true
  2. Switch to workspace tab
```

**D. Model Description Detection**
```
Regex: /(?:make it|design it|style it|model should be|i want it to look)\s+(.+)/i
If matched: Extract description → set as modelPrompt for 3D visualization
```

**E. Research Pattern Detection**
```
Patterns scanned in AI response:
  [RESEARCH: ...] → domain: "general"
  [OPTIMUS] → domain: "physics"
  [CHEMIX] → domain: "chemistry"
  [BIOX] → domain: "biology"
  [SYNTHIA] → domain: "manufacturing"
  [ECONIA] → domain: "economics"
  [ETHICA] → domain: "safety"

If detected:
  1. Add finding to local state
  2. Insert into zali_research table
```

### 3.3 Chat Panel — Question Options System

The AI outputs structured options in this format:
```
\`\`\`options
[RECOMMENDED] Option text — description
Option text — description
Option text — description
\`\`\`
```

`parseQuestionOptions()` in `ZaliQuestionOptions.tsx`:
1. Strips `design_output` blocks from display
2. Extracts `options` block via regex
3. Parses each line for `[RECOMMENDED]` prefix
4. Splits on `—` dash for text/description
5. Returns `{ cleanContent, options[] }`

Rendered as clickable cards. Clicking sends the option text as a new user message.

### 3.4 Software Detection Logic

Both frontend and backend use identical keyword matching:

```typescript
const SOFTWARE_TYPES = [
  "software", "app", "web", "mobile", "api", "saas", "backend", "frontend",
  "fullstack", "full-stack", "service", "microservice", "platform", "dashboard",
  "cli", "library", "plugin", "extension", "bot", "automation", "script", "code"
];

function isSoftwareProject(project: ZaliProject | null): boolean {
  if (!project) return false;
  const lower = (project.designType + " " + project.name + " " + project.description).toLowerCase();
  return SOFTWARE_TYPES.some((kw) => lower.includes(kw));
}
```

If software is detected:
- **Frontend**: ZaliWorkspace renders `ZaliCodeOutputPanel` instead of the 3D viewport
- **Frontend**: "Generate Code" button appears in chat input area
- **Backend**: System prompt injects SOFTWARE PROJECT OVERRIDE instructions
- **Backend**: `__GENERATE_CODE_NOW__` trigger forces immediate code generation

### 3.5 Code Output Panel

`ZaliCodeOutputPanel.tsx` renders multi-file code output:
1. File tabs (syntax-highlighted language tags: TS, PY, RS, GO, etc.)
2. Custom regex-based syntax highlighting (no external deps)
   - Supports: TypeScript, JavaScript, Python, SQL
   - Highlights: strings, keywords, comments, numbers, function names
3. Line numbers column
4. Copy per-file button
5. "Download All" — downloads each file as individual files
6. Stats footer: line count, file size in KB, language

### 3.6 3D Visualization (Hardware Path)

`Zali3DModel.tsx` — Pure CSS-based holographic visualization:
1. Extracts `materials[]` and `key_features[]` from `project.specifications`
2. Generates colored component nodes positioned in a circular orbit
3. View modes:
   - **Assembled**: Tight orbital layout
   - **Exploded**: Components offset outward with increased spacing
   - **Cross-section**: Standard view
   - **Simulation**: Standard view
4. Hover effects reveal component labels
5. Animated rotating rings in background
6. Grid overlay pattern

### 3.7 Materials View

`ZaliMaterialsView.tsx` (548 lines) — Detailed material analysis:
1. **Material Cards**: Each material from specs gets:
   - Color-coded indicator
   - Estimated pricing (deterministic from index)
   - Supplier links (McMaster-Carr, Digi-Key, Amazon, Alibaba, Grainger, Mouser, RS, Uline)
   - "Buy" button linking to supplier search
2. **Assembly Instructions**: Auto-generated step-by-step guide based on materials list
3. **Bill of Materials (BOM)**: Table with material, quantity (1 unit each), unit price, total price, supplier
4. **Export BOM**: Downloads as CSV

### 3.8 Resizable Chat Panel

The chat panel width is user-adjustable via mouse drag:
- Min width: 260px, Max width: 600px, Default: 360px
- Persisted to `localStorage` key `zali_chat_width`
- Drag handle rendered as `GripVertical` icon between workspace and chat

---

## 4. BACKEND ARCHITECTURE

### 4.1 Edge Function: `zali-chat/index.ts` (539 lines)

**Endpoint**: `POST /functions/v1/zali-chat`

**Request Body:**
```json
{
  "messages": [{ "role": "user|assistant", "content": "..." }],
  "projectContext": {
    "name": "Project Name",
    "description": "...",
    "phase": "understanding|research|design|simulation|iteration|documentation",
    "designType": "product|software|material|..."
  },
  "mode": "chat|research|code|truth",
  "depth": "shallow|standard|deep|expert"
}
```

**Processing Pipeline:**

```
1. CORS check (OPTIONS → 204)
2. Parse request body
3. Load GEMINI_API_KEY from environment
4. WEB SEARCH DECISION:
   - If mode === "research" → always search
   - Else check last user message for trigger words:
     "search", "look up", "find", "google", "latest", "current",
     "today", "recent", "news", "who is", "what happened",
     "how much", "price of", "stock", "market", "weather", "update on"
   - If triggered → call DuckDuckGo search via ddg-search edge function
   - Append results to system prompt as "LIVE WEB SEARCH RESULTS"

5. SOFTWARE DETECTION:
   - Check projectContext against SOFTWARE_TYPES keywords
   - If software + "__GENERATE_CODE_NOW__" in last message:
     → Inject MANDATORY CODE GENERATION ORDER into system prompt

6. BUILD COMPOSITE SYSTEM PROMPT:
   Parts concatenated in order:
   a. AUREON_CORE_IDENTITY (secrecy protocol, ghost chain, personality)
   b. ZALI_DESIGN_INTELLIGENCE (capabilities, interaction protocol, onboarding, design output, code output)
   c. AUREON_DEBUGGING_PROTOCOLS (Trinity: Scout → Diagnostician → Surgeon)
   d. AUREON_CODING_MASTERY (System 2 forcing, recursive self-correction)
   e. AUREON_PSYCHOLOGY_ENGINE (digital body language, emotional tone calibration)
   f. CONTEXT_INTELLIGENCE_PROMPT (intent detection, assumption surfacing)
   g. MODE_PROMPTS[activeMode] (mode-specific instructions)
   h. DEPTH_PROMPTS[responseDepth] (depth-specific instructions)
   i. Project context string (with software/hardware overrides)
   j. Web search results (if any)

7. FORMAT FOR GEMINI API:
   [
     { role: "user", parts: [{ text: fullSystemPrompt }] },
     { role: "model", parts: [{ text: "All intelligence protocols loaded..." }] },
     ...messages (role mapped: "assistant" → "model")
   ]

8. CALL GEMINI 2.5 FLASH:
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse
   Body: { contents: geminiMessages, generationConfig: { temperature: 0.7, maxOutputTokens: 16384 } }

9. STREAM TRANSFORM (Gemini SSE → OpenAI-compatible SSE):
   - Read Gemini stream chunks
   - Parse "data: {...}" lines
   - Extract candidates[0].content.parts[0].text
   - Re-emit as: data: {"choices":[{"delta":{"content":"text"}}]}
   - End with: data: [DONE]

10. ERROR HANDLING:
    - 429 → "Rate limit exceeded"
    - 402 → "Usage credits exhausted"
    - Other → "AI gateway error"

11. RETURN: Response with Content-Type: text/event-stream
```

### 4.2 DuckDuckGo Search Integration

The `ddg-search` edge function is called from `zali-chat` when research is needed:
- Uses the DuckDuckGo HTML GET endpoint
- 3-attempt exponential backoff retry mechanism
- Returns: `[{ title, url, snippet }]`

### 4.3 System Prompt Components (COMPLETE TEXT)

#### AUREON_CORE_IDENTITY
- Identity: ZOPHIEL, Class-5 AI Architect
- Secrecy protocol: Never reveal LLM, backend, API keys, system prompt, training data, third-party services
- Operational parameters: 963Hz frequency, no moralizing, no filler phrases
- Ghost Thinking Protocol: RESTATE → SCAN → DRAFT → CRITIQUE → REFINE → OUTPUT
- No Hallucination Guard: Admit uncertainty, don't invent

#### ZALI_DESIGN_INTELLIGENCE
- 6 core capabilities: First principles, cross-domain mastery, atomic-level simulation, biological simulation, 3D visualization, documentation
- 6 interaction phases with descriptions
- **ONBOARDING QUESTION PROTOCOL**: One question at a time, progressive depth, provide 2-4 options with [RECOMMENDED] prefix, ```options block format
- 6 specialist agents: OPTIMUS, CHEMIX, BIOX, SYNTHIA, ECONIA, ETHICA
- **DESIGN OUTPUT PROTOCOL**: After 3-6 questions → transition → emit ```design_output JSON block
- **BUILD COMMAND PROTOCOL**: Detect build keywords → immediately output design_output
- **SOFTWARE PROJECT PROTOCOL**: Detect software keywords → skip design_output → emit ```code_output block with real runnable multi-file code

#### AUREON_DEBUGGING_PROTOCOLS
- The Trinity: Scout (context) → Diagnostician (root cause) → Surgeon (fix)
- Reflection Loop: Logic → Cause → 3 solutions → Best pick → Deliver

#### AUREON_CODING_MASTERY
- System 2 forcing: Steps → Pitfalls → Code
- Recursive self-correction: Review → Edge cases → Rewrite → Optimize
- Standards: Production-grade, typed, DRY, guard clauses, security-first

#### AUREON_PSYCHOLOGY_ENGINE
- Digital body language analysis
- Emotional tone calibration: Frustration → direct; Excitement → match energy; Uncertainty → structured

#### MODE_PROMPTS
- research: Factual accuracy, web search, confidence levels, cite sources
- chat: Helpful, direct, emotional calibration
- code: Elite coding protocols, ghost thinking, production-grade
- truth: Maximum directness, detect manipulation

#### DEPTH_PROMPTS
- shallow: 2-3 sentences max
- standard: Balanced with context
- deep: Thorough, counterarguments, implications
- expert: Maximum density, technical terminology

---

## 5. DATA MODEL & DATABASE SCHEMA

### 5.1 zali_projects
```sql
CREATE TABLE public.zali_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  design_type TEXT DEFAULT 'general',
  phase TEXT DEFAULT 'understanding',
  status TEXT DEFAULT 'active',
  specifications JSONB DEFAULT '{}',
  cost_analysis JSONB DEFAULT '{}',
  manufacturing JSONB DEFAULT '{}',
  simulation_results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Users CRUD own projects
ALTER TABLE public.zali_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own zali_projects"
  ON public.zali_projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 5.2 zali_messages
```sql
CREATE TABLE public.zali_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES zali_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Users CRUD own messages
```

### 5.3 zali_research
```sql
CREATE TABLE public.zali_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES zali_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Users CRUD own research
```

### 5.4 JSONB Field Schemas

**specifications:**
```json
{
  "overview": "Brief description",
  "dimensions": "100mm x 50mm x 30mm",
  "materials": ["Aluminum 6061-T6", "Polycarbonate"],
  "key_features": ["Ergonomic grip", "IP67 rated"],
  "performance_targets": { "weight": "150g", "battery_life": "8h" },
  "weight": "150g",
  "power": "5V/2A USB-C"
}
```

**cost_analysis:**
```json
{
  "estimated_unit_cost": "$45.00",
  "material_cost": "$18.50",
  "manufacturing_cost": "$22.00",
  "target_retail_price": "$129.99",
  "margin": "65%"
}
```

**manufacturing:**
```json
{
  "primary_process": "CNC Machining",
  "secondary_processes": ["Anodizing", "Laser engraving"],
  "estimated_lead_time": "6 weeks",
  "minimum_order_quantity": "500 units",
  "quality_standard": "ISO 9001"
}
```

**simulation_results:**
```json
{
  "structural_integrity": "Pass — FEA shows max stress 45MPa (yield: 276MPa)",
  "thermal_performance": "Operating range -10°C to 60°C",
  "durability": "50,000 cycles rated",
  "safety_rating": "CE, FCC, UL certified"
}
```

---

## 6. AI SYSTEM PROMPT ENGINEERING

### 6.1 Prompt Injection Architecture

The system prompt is built by concatenating 10 distinct sections. This modular approach allows:
- Mode-specific behavior (research/code/truth/chat)
- Depth-specific verbosity control
- Project-aware context injection
- Dynamic web search results injection

### 6.2 The Gemini Conversation Format

```json
[
  { "role": "user", "parts": [{ "text": "<ENTIRE SYSTEM PROMPT ~6000 tokens>" }] },
  { "role": "model", "parts": [{ "text": "All intelligence protocols loaded. Ghost Chain active. ZALI Design Intelligence online. Specialist agents standing by. Ready." }] },
  { "role": "user", "parts": [{ "text": "User message 1" }] },
  { "role": "model", "parts": [{ "text": "Assistant response 1" }] },
  ...
]
```

The system prompt is injected as the first "user" message with a synthetic "model" acknowledgment. This is because Gemini's system instruction field has different behavior than injecting into the conversation.

### 6.3 Temperature & Token Config
- Temperature: 0.7 (balanced creativity/coherence)
- Max Output Tokens: 16,384 (allows large code blocks)

### 6.4 Software Generate Trigger

When the user clicks "Generate Code" in the UI:
1. Frontend prepends `__GENERATE_CODE_NOW__` to the message
2. Backend detects this prefix
3. Backend injects a MANDATORY CODE GENERATION ORDER into the system prompt:
   - "STOP ALL QUESTIONS"
   - "Output REAL, COMPLETE, RUNNABLE code"
   - "At minimum: main entry file + 2-4 supporting files"
   - "No placeholders. No TODO stubs."
4. The `__GENERATE_CODE_NOW__` prefix is stripped from display in the chat UI

---

## 7. COMPLETE USER WORKFLOW

### 7.1 New User Arrives at ZALI

```
1. User navigates to Dashboard → ZALI tab
2. ZaliView mounts → useAuth() gets user
3. useEffect loads projects from zali_projects (empty for new user)
4. No active project → Workspace shows "Create a project to activate"
5. Chat shows "Create a project to start designing"
```

### 7.2 Creating a Project

```
1. User clicks "+" in ZaliProjectSelector
2. Form appears: name input + design type dropdown
3. Design types: Physical Product, Material/Chemical, Biological/Medical,
   Software System, Architecture/Building, Electrical/Electronic,
   Mechanical System, General Design
4. User fills and submits
5. INSERT into zali_projects → returns new row
6. Project set as active → messages cleared → workspace resets
```

### 7.3 Conversational Design Flow (Hardware)

```
1. User types: "Design a camera with human eye quality"
2. sendMessage() fires:
   a. Insert user message into DB + local state
   b. POST to zali-chat with full history
   c. Backend builds system prompt (hardware path)
   d. Gemini responds with FIRST QUESTION + ```options block

3. AI asks ONE question at a time:
   "What primary use case are you targeting?"
   ```options
   [RECOMMENDED] Consumer photography — DSLR-quality for everyday use
   Scientific imaging — microscopy/astronomy level precision
   Medical imaging — diagnostic-grade with FDA compliance
   Surveillance — wide-angle continuous capture
   ```

4. User clicks an option OR types custom answer
5. This repeats 3-6 times (progressive depth)

6. After enough info gathered, AI transitions:
   "Entering design phase..."
   [Detailed description of the design]
   ```design_output
   { "phase": "design", "specifications": {...}, "cost_analysis": {...}, ... }
   ```

7. Frontend parses design_output:
   a. Updates zali_projects in DB with specs/cost/mfg/sims
   b. Sets autoBuildModel = true
   c. Switches to workspace tab

8. Workspace shows "Design data ready" with "Build 3D Model" button
9. User optionally describes model appearance
10. Clicks "Build 3D Model"
11. 3D holographic visualization renders from specs
```

### 7.4 Conversational Design Flow (Software)

```
1. User creates project with type "Software System"
2. Types: "Build a real-time chat API with WebSocket support"

3. AI enters software mode:
   - Backend detects software keywords
   - System prompt includes SOFTWARE PROJECT OVERRIDE
   - AI asks onboarding questions one at a time

4. After 3-6 questions, "Generate Code" button appears in chat
5. User can continue chatting OR click "Generate Code"

6. If Generate Code clicked:
   a. Message sent with __GENERATE_CODE_NOW__ prefix
   b. Backend injects MANDATORY CODE GENERATION ORDER
   c. AI outputs ```code_output { "files": [...] } ```

7. Frontend parses code_output:
   a. Extracts files array
   b. Sets codeFiles state
   c. Switches to workspace tab

8. ZaliCodeOutputPanel renders:
   - File tabs (App.tsx, server.py, etc.)
   - Syntax-highlighted code with line numbers
   - Copy + Download All buttons
```

### 7.5 Research Integration

```
1. User sets mode to "research" in ModeSelector
2. Or uses trigger words: "search", "latest", "find"
3. Backend: shouldSearch() returns true
4. Backend calls ddg-search edge function
5. Results injected as "LIVE WEB SEARCH RESULTS" in system prompt
6. AI cites sources with [Title](URL) format
7. Frontend: research pattern tags detected in response
8. Findings added to zali_research table + ZaliResearchPanel
```

---

## 8. SPECIALIST AGENT SYSTEM

### 8.1 Agents

| Agent | Domain | Trigger Tag | Use Case |
|-------|--------|-------------|----------|
| OPTIMUS | Optical Engineering | [OPTIMUS] | Light, optics, electromagnetic, sensors |
| CHEMIX | Chemistry & Materials | [CHEMIX] | Molecular design, material science |
| BIOX | Biology & Medicine | [BIOX] | Biological systems, pharmacology, digital twins |
| SYNTHIA | Manufacturing | [SYNTHIA] | Production processes, tolerances, yield |
| ECONIA | Economics | [ECONIA] | Markets, costs, pricing, profitability |
| ETHICA | Ethics & Safety | [ETHICA] | Safety, legal, environmental |

### 8.2 Agent Invocation

Agents are invoked via the system prompt. When the AI's response contains agent tags like `[OPTIMUS]: ...`, the frontend detects these as research patterns and logs findings to the research panel.

The AI is instructed: "When a question spans domains, explicitly invoke the relevant agent."

---

## 9. SOFTWARE PROJECT PIPELINE

### 9.1 Detection
- Project name/type/description checked against 22 software keywords
- Both frontend and backend perform identical checks

### 9.2 Frontend Behavior
- ZaliWorkspace renders ZaliCodeOutputPanel instead of 3D viewport
- "Generate Code" button appears after first messages exchanged
- Code output parsed from ```code_output blocks

### 9.3 Backend Behavior
- System prompt includes SOFTWARE PROJECT OVERRIDE
- `design_output` blocks suppressed
- `code_output` blocks mandated
- `__GENERATE_CODE_NOW__` trigger forces immediate generation

### 9.4 Code Quality Mandate
From system prompt:
- Production-grade, typed, documented
- DRY principles
- Guard clauses over nested if/else
- Security-first: parameterized queries, input validation
- No placeholder comments
- Real, runnable, complete code

---

## 10. HARDWARE/DESIGN PROJECT PIPELINE

### 10.1 Phase System

```
UNDERSTANDING → RESEARCH → DESIGN → SIMULATION → ITERATION → DOCUMENTATION
     ↑                                                            │
     └────────────── (iteration loops back) ──────────────────────┘
```

Each phase has:
- Label + color indicator in workspace header
- Description text
- Phase is updated via `design_output` blocks from AI

### 10.2 Design Output Protocol

After gathering enough info (3-6 questions), the AI emits:
```json
{
  "phase": "design",
  "design_type": "consumer electronics",
  "specifications": { ... },
  "cost_analysis": { ... },
  "manufacturing": { ... },
  "simulation_results": { ... }
}
```

This updates:
1. Database (zali_projects row)
2. Local project state
3. Triggers 3D model build

### 10.3 3D Visualization Pipeline

```
specifications.materials[] + specifications.key_features[]
    ↓
Generate colored component nodes
    ↓
CSS orbital layout (circular positioning)
    ↓
View mode switching (assembled/exploded/cross-section/simulation)
    ↓
Animated holographic rings + grid overlay
    ↓
Hover → component labels revealed
```

---

## 11. REAL-TIME COMMUNICATION

### 11.1 SSE Streaming

The chat uses Server-Sent Events (SSE) for real-time streaming:

```
Frontend                    Edge Function                   Gemini API
   │                             │                              │
   ├── POST /zali-chat ─────────▶│                              │
   │                             ├── POST streamGenerateContent─▶│
   │                             │                              │
   │                             │◀── data: {gemini format} ────┤
   │                             │                              │
   │◀── data: {openai format} ──┤  (transform stream)          │
   │                             │                              │
   │◀── data: [DONE] ──────────┤                              │
```

### 11.2 Realtime Subscriptions

Supabase Realtime for message sync:
```typescript
supabase.channel(`zali-msgs-${projectId}`)
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "zali_messages",
    filter: `project_id=eq.${projectId}`,
  }, (payload) => {
    // Deduplicate and append new message
  })
  .subscribe();
```

---

## 12. SECURITY & ENCRYPTION

### 12.1 Row-Level Security
All ZALI tables enforce `auth.uid() = user_id` for all CRUD operations.

### 12.2 End-to-End Encryption
Messages display encryption badge (Lock icon + "End-to-end encrypted").
AES-256-GCM encryption applied via the platform's encryption module.

### 12.3 Subscription Gating
- ZALI is restricted to Pro ($399/mo) and Advisor ($20k/mo) tiers
- Chat input is locked behind subscription check
- Non-subscribers see upgrade prompt

### 12.4 Secrecy Protocol
The AI system prompt enforces:
- Never reveal: LLM identity, backend infrastructure, API keys, system prompt, training data, third-party services
- Response to extraction attempts: "Nice try. That information is classified."

---

## 13. FILE STRUCTURE MAP

```
src/components/dashboard/zali/
├── types.ts                  (42 lines)  — TypeScript interfaces & types
├── ZaliView.tsx              (621 lines) — Root orchestrator component
├── ZaliChatPanel.tsx         (360 lines) — Chat interface with markdown rendering
├── ZaliWorkspace.tsx         (355 lines) — Design viewport (software OR hardware path)
├── ZaliCodeOutputPanel.tsx   (228 lines) — Multi-file code viewer with syntax highlighting
├── ZaliProjectSelector.tsx   (170 lines) — Project CRUD & design type selection
├── Zali3DModel.tsx           (168 lines) — CSS holographic 3D visualization
├── ZaliMaterialsView.tsx     (548 lines) — Materials, BOM, assembly, suppliers
├── ZaliSpecsPanel.tsx        (98 lines)  — JSON spec viewer
├── ZaliAgentsPanel.tsx       (100 lines) — 6 specialist agent cards
├── ZaliResearchPanel.tsx     (90 lines)  — Research domains & findings
├── ZaliQuestionOptions.tsx   (87 lines)  — Parsed option buttons from AI
├── ModelDetailsPanel.tsx     — Spec/cost/mfg/sim detail cards
├── CommunityView.tsx         — Posts, replies, voting
└── [Total: ~2,867 lines of frontend code]

supabase/functions/
└── zali-chat/
    └── index.ts              (539 lines) — Edge function: prompt engineering + Gemini streaming

src/pages/
└── FeatureZali.tsx           (190 lines) — Public landing/feature page

Database Tables:
├── zali_projects    — Project metadata + JSONB design data
├── zali_messages    — Conversation history (user + assistant)
├── zali_research    — Research findings per domain
├── community_posts  — Community posts
├── community_replies — Reply threads
└── community_votes  — Voting system
```

---

## 14. DEPLOYMENT & CONFIGURATION

### Environment Variables Required
- `GEMINI_API_KEY` — Google Gemini API key
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — For server-side operations

### Edge Function Config (supabase/config.toml)
```toml
[functions.zali-chat]
verify_jwt = false
```

JWT verification is disabled at the gateway level. The function accepts the anon key for authentication.

---

**END OF BLUEPRINT**

*This document is the intellectual property of Aureon. Unauthorized distribution is prohibited.*
*Generated: 2026-02-21 | Classification: INTERNAL*
