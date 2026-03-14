import { useState, useEffect } from "react";
import { Target, Lock, Unlock, Edit3, Check, X, ChevronDown, ChevronUp } from "lucide-react";

interface GoalLockData {
  objective: string;
  constraints: string;
  definitionOfDone: string;
  locked: boolean;
}

interface GoalLockHeaderProps {
  conversationId: string;
  onGoalChange?: (goal: GoalLockData | null) => void;
}

const STORAGE_KEY = "aureon_goal_locks";

function loadGoals(): Record<string, GoalLockData> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveGoals(goals: Record<string, GoalLockData>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

const GoalLockHeader = ({ conversationId, onGoalChange }: GoalLockHeaderProps) => {
  const [goal, setGoal] = useState<GoalLockData | null>(() => loadGoals()[conversationId] || null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<GoalLockData>({
    objective: "", constraints: "", definitionOfDone: "", locked: false,
  });

  useEffect(() => {
    if (goal) {
      const all = loadGoals();
      all[conversationId] = goal;
      saveGoals(all);
      onGoalChange?.(goal);
    }
  }, [goal, conversationId, onGoalChange]);

  const startEditing = () => {
    setDraft(goal || { objective: "", constraints: "", definitionOfDone: "", locked: false });
    setEditing(true);
  };

  const save = () => {
    if (!draft.objective.trim()) return;
    setGoal(draft);
    setEditing(false);
    setExpanded(true);
  };

  const toggleLock = () => {
    if (goal) setGoal({ ...goal, locked: !goal.locked });
  };

  const clear = () => {
    setGoal(null);
    const all = loadGoals();
    delete all[conversationId];
    saveGoals(all);
    onGoalChange?.(null);
    setEditing(false);
    setExpanded(false);
  };

  if (!goal && !editing) {
    return (
      <button
        onClick={startEditing}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-light text-muted-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors"
      >
        <Target className="h-3 w-3" />
        Set Goal
      </button>
    );
  }

  if (editing) {
    return (
      <div className="mx-3 my-2 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-3 space-y-2 animate-scale-in">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-light text-foreground uppercase tracking-wider">Goal Lock</span>
          <div className="flex gap-1">
            <button onClick={save} className="p-1 text-accent hover:text-accent/80 transition-colors"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground/50 uppercase tracking-wider block mb-0.5">Objective</label>
          <input
            value={draft.objective}
            onChange={e => setDraft({ ...draft, objective: e.target.value })}
            placeholder="What are we trying to accomplish?"
            className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none border-b border-border/20 pb-1"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground/50 uppercase tracking-wider block mb-0.5">Constraints</label>
          <textarea
            value={draft.constraints}
            onChange={e => setDraft({ ...draft, constraints: e.target.value })}
            placeholder="What's off-limits or required?"
            rows={2}
            className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none border-b border-border/20 pb-1 resize-none"
          />
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground/50 uppercase tracking-wider block mb-0.5">Definition of Done</label>
          <textarea
            value={draft.definitionOfDone}
            onChange={e => setDraft({ ...draft, definitionOfDone: e.target.value })}
            placeholder="How do we know we're finished?"
            rows={2}
            className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none border-b border-border/20 pb-1 resize-none"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-3 my-2 rounded-xl border backdrop-blur-sm transition-all ${goal?.locked ? "border-accent/30 bg-accent/5" : "border-border/30 bg-card/30"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Target className={`h-3.5 w-3.5 shrink-0 ${goal?.locked ? "text-accent" : "text-muted-foreground/50"}`} />
          <span className="text-[11px] font-light text-foreground truncate">{goal?.objective}</span>
          {goal?.locked && <Lock className="h-3 w-3 text-accent/60 shrink-0" />}
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/30" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/30" />}
      </button>
      {expanded && goal && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/10">
          {goal.constraints && (
            <div>
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-0.5">Constraints</p>
              <p className="text-[10px] text-muted-foreground/70 font-light whitespace-pre-wrap">{goal.constraints}</p>
            </div>
          )}
          {goal.definitionOfDone && (
            <div>
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-0.5">Done When</p>
              <p className="text-[10px] text-muted-foreground/70 font-light whitespace-pre-wrap">{goal.definitionOfDone}</p>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={toggleLock} className="flex items-center gap-1 text-[9px] text-muted-foreground/50 hover:text-foreground transition-colors">
              {goal.locked ? <><Unlock className="h-3 w-3" /> Unlock</> : <><Lock className="h-3 w-3" /> Lock</>}
            </button>
            <button onClick={startEditing} className="flex items-center gap-1 text-[9px] text-muted-foreground/50 hover:text-foreground transition-colors">
              <Edit3 className="h-3 w-3" /> Edit
            </button>
            <button onClick={clear} className="flex items-center gap-1 text-[9px] text-destructive/50 hover:text-destructive transition-colors">
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalLockHeader;
