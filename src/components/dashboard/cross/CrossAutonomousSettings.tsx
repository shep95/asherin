import React, { useState } from "react";
import { Bot, ShieldAlert, Zap, DollarSign, Clock, AlertTriangle, Power, PowerOff } from "lucide-react";

interface AutonomousConfig {
  enabled: boolean;
  maxTradeSize: number;
  maxTradesPerDay: number;
  maxDailyLoss: number;
  minConfidence: number;
  cooldownSeconds: number;
  requireApprovalAbove: number;
  emergencyStopLoss: number;
}

const DEFAULT_CONFIG: AutonomousConfig = {
  enabled: false,
  maxTradeSize: 500,
  maxTradesPerDay: 20,
  maxDailyLoss: 1000,
  minConfidence: 80,
  cooldownSeconds: 120,
  requireApprovalAbove: 1000,
  emergencyStopLoss: 15,
};

interface Props {
  onConfigChange?: (config: AutonomousConfig) => void;
}

const CrossAutonomousSettings: React.FC<Props> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<AutonomousConfig>(DEFAULT_CONFIG);
  const [confirmEnable, setConfirmEnable] = useState(false);

  const update = (partial: Partial<AutonomousConfig>) => {
    const next = { ...config, ...partial };
    setConfig(next);
    onConfigChange?.(next);
  };

  const toggleEnabled = () => {
    if (!config.enabled) {
      setConfirmEnable(true);
    } else {
      update({ enabled: false });
    }
  };

  const confirmActivation = () => {
    setConfirmEnable(false);
    update({ enabled: true });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Autonomous Trading</h3>
        </div>
        <button
          onClick={toggleEnabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
            config.enabled
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-muted/20 border-border/30 text-muted-foreground hover:border-border"
          }`}
        >
          {config.enabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
          {config.enabled ? "ACTIVE" : "OFF"}
        </button>
      </div>

      {/* Confirmation Dialog */}
      {confirmEnable && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">Enable Autonomous Trading?</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The AI will automatically execute BUY/SELL trades on your behalf.
            Make sure your safety limits are configured correctly. This can result in real financial losses.
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmActivation}
              className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold"
            >
              I understand, enable
            </button>
            <button
              onClick={() => setConfirmEnable(false)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-muted/20 border border-border/30 text-muted-foreground text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Warning Banner */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-red-300/80 leading-relaxed">
            Autonomous mode gives the AI full control to click, type, and execute trades on DEX sites.
            <strong className="text-red-300"> You are responsible for all trades executed.</strong>
          </p>
        </div>
      </div>

      {/* Position Limits */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          Max Trade Size: ${config.maxTradeSize}
        </label>
        <input
          type="range"
          min={50}
          max={5000}
          step={50}
          value={config.maxTradeSize}
          onChange={e => update({ maxTradeSize: Number(e.target.value) })}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/40">
          <span>$50</span>
          <span>$5,000</span>
        </div>
      </div>

      {/* Daily Limits */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1 block">Max Trades/Day</label>
          <input
            type="number"
            min={1}
            max={100}
            value={config.maxTradesPerDay}
            onChange={e => update({ maxTradesPerDay: Number(e.target.value) })}
            className="w-full bg-background/50 border border-border/30 rounded-lg px-2 py-1.5 text-xs text-foreground"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1 block">Max Daily Loss</label>
          <input
            type="number"
            min={100}
            max={50000}
            step={100}
            value={config.maxDailyLoss}
            onChange={e => update({ maxDailyLoss: Number(e.target.value) })}
            className="w-full bg-background/50 border border-border/30 rounded-lg px-2 py-1.5 text-xs text-foreground"
          />
        </div>
      </div>

      {/* Min Confidence */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Min Confidence: {config.minConfidence}%
        </label>
        <input
          type="range"
          min={50}
          max={99}
          value={config.minConfidence}
          onChange={e => update({ minConfidence: Number(e.target.value) })}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/40">
          <span>Aggressive (50%)</span>
          <span>Conservative (99%)</span>
        </div>
      </div>

      {/* Cooldown */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Cooldown: {config.cooldownSeconds}s between trades
        </label>
        <input
          type="range"
          min={10}
          max={600}
          step={10}
          value={config.cooldownSeconds}
          onChange={e => update({ cooldownSeconds: Number(e.target.value) })}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/40">
          <span>10s (fast)</span>
          <span>10min (slow)</span>
        </div>
      </div>

      {/* Approval Threshold */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block">
          Require approval above: ${config.requireApprovalAbove}
        </label>
        <input
          type="range"
          min={100}
          max={10000}
          step={100}
          value={config.requireApprovalAbove}
          onChange={e => update({ requireApprovalAbove: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      {/* Emergency Stop Loss */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block flex items-center gap-1">
          <ShieldAlert className="h-3 w-3" />
          Emergency Stop: Portfolio down {config.emergencyStopLoss}%
        </label>
        <input
          type="range"
          min={5}
          max={50}
          step={5}
          value={config.emergencyStopLoss}
          onChange={e => update({ emergencyStopLoss: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      {/* Status Summary */}
      <div className="rounded-lg border border-border/20 bg-muted/5 p-2.5 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Safety Summary</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>Max per trade:</span><span className="text-foreground">${config.maxTradeSize}</span>
          <span>Daily trade cap:</span><span className="text-foreground">{config.maxTradesPerDay}</span>
          <span>Max daily loss:</span><span className="text-foreground">${config.maxDailyLoss}</span>
          <span>Min confidence:</span><span className="text-foreground">{config.minConfidence}%</span>
          <span>Cooldown:</span><span className="text-foreground">{config.cooldownSeconds}s</span>
          <span>Emergency stop:</span><span className="text-foreground">-{config.emergencyStopLoss}%</span>
        </div>
      </div>
    </div>
  );
};

export default CrossAutonomousSettings;
