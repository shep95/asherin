import { useState, useMemo } from "react";
import { Key, Copy, AlertTriangle, Check, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function b64decode(str: string): string {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(atob(padded).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
  } catch { return ""; }
}

function parseJwt(token: string) {
  const parts = token.trim().split(".");
  if (parts.length < 2) return null;
  try {
    const header = JSON.parse(b64decode(parts[0]));
    const payload = JSON.parse(b64decode(parts[1]));
    return { header, payload, signature: parts[2] || "", raw: parts };
  } catch { return null; }
}

function formatTime(ts: number): string {
  try { return new Date(ts * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC"); }
  catch { return String(ts); }
}

const SAMPLE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const TIME_CLAIMS = ["exp", "iat", "nbf", "auth_time"];

const JwtDebugger = () => {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");

  const parsed = useMemo(() => parseJwt(token), [token]);

  const isExpired = useMemo(() => {
    if (!parsed?.payload?.exp) return null;
    return Date.now() / 1000 > parsed.payload.exp;
  }, [parsed]);

  const timeUntilExpiry = useMemo(() => {
    if (!parsed?.payload?.exp) return null;
    const diff = parsed.payload.exp - Date.now() / 1000;
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}h ${m}m remaining`;
  }, [parsed]);

  return (
    <div className="h-full flex flex-col bg-background/40">
      <div className="px-4 py-3 border-b border-border/[0.06] flex items-center gap-3">
        <Key className="h-4 w-4 text-foreground/40" />
        <div>
          <h2 className="text-[11px] font-light tracking-[0.1em] text-foreground/80 uppercase">JWT Debugger</h2>
          <p className="text-[8px] text-muted-foreground/30">Decode, inspect, and verify JSON Web Tokens</p>
        </div>
        <Button size="sm" variant="ghost" className="ml-auto text-[9px] h-6" onClick={() => setToken(SAMPLE_JWT)}>
          Load Sample
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* Left: Token Input */}
          <div className="space-y-3">
            <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">Encoded Token</div>
            <Textarea value={token} onChange={e => setToken(e.target.value)} placeholder="Paste JWT here..."
              className="min-h-[200px] text-xs font-mono bg-card/30 border-border/[0.08] break-all" />
            
            {parsed && (
              <div className="space-y-2">
                <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">Token Parts</div>
                <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3 font-mono text-[10px] break-all space-y-1">
                  <span className="text-red-400/70">{parsed.raw[0]}</span>
                  <span className="text-foreground/20">.</span>
                  <span className="text-purple-400/70">{parsed.raw[1]}</span>
                  <span className="text-foreground/20">.</span>
                  <span className="text-cyan-400/70">{parsed.signature}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">Verify Signature (HMAC)</div>
              <Input value={secret} onChange={e => setSecret(e.target.value)} placeholder="Enter secret key..."
                className="text-xs font-mono bg-card/30 border-border/[0.08]" type="password" />
              <p className="text-[8px] text-muted-foreground/20">Client-side only — key never leaves browser</p>
            </div>
          </div>

          {/* Right: Decoded */}
          <div className="space-y-3">
            {parsed ? (
              <>
                {/* Status badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[8px] bg-foreground/[0.03]">
                    <Shield className="h-2.5 w-2.5 mr-1" /> {parsed.header.alg || "Unknown"}
                  </Badge>
                  <Badge variant="outline" className="text-[8px] bg-foreground/[0.03]">
                    {parsed.header.typ || "JWT"}
                  </Badge>
                  {isExpired !== null && (
                    <Badge variant="outline" className={`text-[8px] ${isExpired ? "border-red-500/30 text-red-400" : "border-emerald-500/30 text-emerald-400"}`}>
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      {isExpired ? "EXPIRED" : timeUntilExpiry}
                    </Badge>
                  )}
                </div>

                {/* Header */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-red-400/60 uppercase tracking-wider">Header</span>
                    <Button size="sm" variant="ghost" className="h-5 text-[8px]" onClick={() => { navigator.clipboard.writeText(JSON.stringify(parsed.header, null, 2)); toast.success("Copied"); }}>
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                  <pre className="text-[10px] font-mono bg-card/30 border border-border/[0.08] rounded-lg p-3 text-red-400/80 overflow-auto max-h-[120px]">
                    {JSON.stringify(parsed.header, null, 2)}
                  </pre>
                </div>

                {/* Payload */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-purple-400/60 uppercase tracking-wider">Payload</span>
                    <Button size="sm" variant="ghost" className="h-5 text-[8px]" onClick={() => { navigator.clipboard.writeText(JSON.stringify(parsed.payload, null, 2)); toast.success("Copied"); }}>
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                  <pre className="text-[10px] font-mono bg-card/30 border border-border/[0.08] rounded-lg p-3 text-purple-400/80 overflow-auto max-h-[200px]">
                    {JSON.stringify(parsed.payload, null, 2)}
                  </pre>
                </div>

                {/* Claims table */}
                <div>
                  <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1.5">Claims</div>
                  <div className="rounded-lg border border-border/[0.08] bg-card/20 divide-y divide-border/[0.04] max-h-[200px] overflow-y-auto">
                    {Object.entries(parsed.payload).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between px-3 py-1.5 text-[10px]">
                        <span className="font-mono text-foreground/50">{k}</span>
                        <span className="font-mono text-foreground/70 text-right max-w-[60%] truncate">
                          {TIME_CLAIMS.includes(k) && typeof v === "number"
                            ? formatTime(v)
                            : typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signature */}
                <div>
                  <div className="text-[9px] text-cyan-400/60 uppercase tracking-wider mb-1">Signature</div>
                  <div className="text-[10px] font-mono text-cyan-400/50 bg-card/30 border border-border/[0.08] rounded-lg p-3 break-all">
                    {parsed.signature || "No signature"}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                  <Key className="h-8 w-8 text-muted-foreground/10 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground/30">Paste a JWT to decode it</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JwtDebugger;
