## ZERLAL — Vulnerability Intelligence Platform Build Plan

### Phase 1: Foundation & Dashboard (Screen 1)
- Create Zerlal layout with persistent left nav (Projects, Findings, Reports, Integrations, Settings, Team)
- Build "Security Posture" center panel (critical count, trend line, severity/category donut charts)
- Build "Action Required" right panel (top 5 findings by risk)
- Top bar with Scan Now, Notifications, Team count

### Phase 2: Project View (Screen 2)
- Repository header with risk grade (A-F), last scan, scan duration
- Tab bar: Findings | Dependency Graph | History | Settings
- Findings table with severity, title, file/line, category, confidence, age, assignee, status
- Filter bar (severity, category, status, confidence slider, search)
- Expandable rows with explanation, code snippet, suggested fix diff, actions

### Phase 3: Finding Detail Page (Screen 3)
- Full-page finding view with 2/3 + 1/3 layout
- Code view with highlighted vulnerability
- Chained vulnerability flow diagram
- Dataflow trace visualization
- Metadata panel, similar CVEs, compliance mapping, timeline

### Phase 4: Ingestion Flow (Screen 4)
- 3-step modal: Source → Scan Profile → Notifications
- Source icons (GitHub, GitLab, Bitbucket, Upload, URL, Docker)
- Scan presets with time estimates
- Notification configuration

### Phase 5: Reports (Screen 5)
- Report type selection (Executive, Technical, Compliance, Remediation, Benchmark)
- Format options (PDF, CSV, JSON)
- Scheduled report configuration

### Phase 6: Integrations Hub (Screen 6)
- Visual grid of integration tiles by category
- Connected status, configure button per tile

**Note:** All screens use mock/demo data. Backend tables and edge functions will be added in a follow-up phase. Uses existing design system tokens and AUREON aesthetic.