
## Cross Universal Platform — Implementation Plan

### Phase 1: Core Types & Mode System (Now)
- Expand `AnalysisMode` to include all use cases: `trading`, `coding`, `design`, `finance`, `writing`, `research`, `healthcare`, `education`, `music`, `gaming`, `email`, `general`
- Add `CrossContext` fields for each domain (language, file, tool, project, etc.)
- Add universal `VerdictAction` types beyond trading: `FIX_NOW`, `OPTIMIZE`, `REFACTOR`, `APPROVE`, `FLAG`, `IMPROVE`
- Expand `AlertType` to include domain-specific types: `BUG`, `VULNERABILITY`, `DESIGN_ISSUE`, `OPTIMIZATION`, `COMPLIANCE`, `DEADLINE`

### Phase 2: Dashboard Redesign (Now)
- **Active Monitoring Card**: Shows currently watched app + detected context + domain-specific status
- **Mode Selector**: Visual mode picker with icons for each domain
- **Recent Activity Feed**: Universal timeline of actions/suggestions across domains
- **Active Automations Panel**: List of running automations with toggle controls
- **Analytics Summary**: Time saved, success rate, suggestions accepted
- **Quick Stats Bar**: Mode-aware metrics (bugs found for coding, signals for trading, etc.)

### Phase 3: Cloud Intelligence Update (Now)
- Update `cross-analyze` edge function to handle all modes with domain-specific prompts
- Trading mode: Keep existing Nestal Fractal strategy
- Coding mode: Code review, bug detection, refactoring suggestions
- Design mode: Composition, accessibility, consistency analysis
- Finance mode: Formula errors, data validation, anomaly detection
- General mode: Workflow optimization, productivity suggestions

### Phase 4: Local Intelligence Engine (Now)
- Keep `LocalIntelligenceEngine` for trading (Nestal Fractal)
- Add `UniversalLocalEngine` for non-trading modes with domain-specific pattern detection
- Coding: Syntax patterns, error detection from screen
- Design: Layout analysis, color consistency
- General: Workflow timing, idle detection

### Phase 5: Extension Update (Future)
- Update Chrome extension to support multi-mode operation
- Mode auto-detection based on active tab

### What ships NOW (this implementation):
1. ✅ Expanded types system for universal modes
2. ✅ New Cross dashboard with monitoring dashboard, activity feed, automations panel
3. ✅ Updated edge function with multi-domain prompts
4. ✅ Mode-aware UI that changes layout/context based on selected mode
5. ✅ Analytics summary cards
