import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, LogOut, Crown } from "lucide-react";
import GateScreen from "@/components/ziaassets/GateScreen";
import ChambersView from "@/components/ziaassets/ChambersView";
import VaultView from "@/components/ziaassets/VaultView";
import MembersConsole from "@/components/ziaassets/MembersConsole";
import AuditLogView from "@/components/ziaassets/AuditLogView";
import { subscribeSession, getSessionKey, lock, getSessionRank } from "@/lib/ziaassets/session";
import { toast } from "sonner";

export default function Ziaassets() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [busy, setBusy] = useState(false);
  // Track live member status so a pending/revoked user cannot slip past the
  // gate just because a session key was sealed during enrollment.
  const [memberStatus, setMemberStatus] = useState<"active" | "pending" | "revoked" | "unknown">("unknown");

  // Re-render on session unlock/lock
  const key = useSyncExternalStore(subscribeSession, () => getSessionKey());

  useEffect(() => {
    document.title = "ZIAASSETS · Sovereign Command Deck";
  }, []);

  // Re-fetch member.status any time the user or session key changes.  If the
  // Emperor activates a pending member, unlocking (or a page refresh) will
  // pick it up on the next tick.  Also runs on cross-tab session changes.
  useEffect(() => {
    let cancelled = false;
    if (!user) { setMemberStatus("unknown"); return; }
    (async () => {
      const { data, error } = await supabase
        .from("ziaassets_members")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) { setMemberStatus("unknown"); return; }
      setMemberStatus((data.status as any) === "active" ? "active"
                    : (data.status as any) === "revoked" ? "revoked"
                    : "pending");
    })();
    return () => { cancelled = true; };
  }, [user, key]);


  const handleAuth = async () => {
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/ziaassets`;
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        toast.success("Account created. Sealing sovereign passphrase next.");
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-screen bg-black" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 bg-background/60 backdrop-blur border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            <h1 className="text-lg font-semibold tracking-widest">ZIAASSETS</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Sovereign command deck for the House of Asher. Email + password only. No Google. No social login.
          </p>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
          </div>
          <div>
            <Label>Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} />
          </div>
          <Button onClick={handleAuth} disabled={busy || !email || !password} className="w-full">
            {busy ? "…" : mode === "sign-in" ? "Sign In" : "Create Account"}
          </Button>
          <button className="text-xs text-muted-foreground w-full text-center"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
            {mode === "sign-in" ? "No account? Register" : "Already registered? Sign in"}
          </button>
          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-white/10">
            After sign-in you must seal a Sovereign Passphrase (client-side AES-256-GCM key).
          </p>
        </Card>
      </div>
    );
  }

  if (!key) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black p-4">
        <div className="max-w-6xl mx-auto pt-8">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5" />
            <h1 className="text-lg font-semibold tracking-widest">ZIAASSETS · Command Deck</h1>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => supabase.auth.signOut()}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
          <GateScreen onUnlocked={() => { /* rerender via store */ }} />
        </div>
      </div>
    );
  }

  const rank = getSessionRank();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-foreground">
      <header className="border-b border-white/10 bg-background/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-3">
          <Crown className="w-5 h-5" />
          <h1 className="text-sm font-semibold tracking-widest">ZIAASSETS · SOVEREIGN COMMAND DECK</h1>
          <span className="text-[10px] text-muted-foreground font-mono uppercase ml-2">rank: {rank}</span>
          <Button variant="ghost" size="sm" onClick={() => lock()} className="ml-auto">
            <Lock className="w-4 h-4 mr-1" /> Lock
          </Button>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4">
        <Tabs defaultValue="chambers">
          <TabsList className="bg-background/60 backdrop-blur border border-white/10">
            <TabsTrigger value="chambers">Chambers</TabsTrigger>
            <TabsTrigger value="vault">Vault</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
          <TabsContent value="chambers" className="mt-4"><ChambersView /></TabsContent>
          <TabsContent value="vault" className="mt-4"><VaultView /></TabsContent>
          <TabsContent value="members" className="mt-4"><MembersConsole /></TabsContent>
          <TabsContent value="audit" className="mt-4"><AuditLogView /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
