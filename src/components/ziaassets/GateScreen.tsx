import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { randomSalt, scorePassphrase } from "@/lib/ziaassets/crypto";
import { unlock, subscribeSession, getSessionKey } from "@/lib/ziaassets/session";
import { isOwnerEmail } from "@/lib/adminEmail";

type MemberRow = {
  id: string;
  codename: string;
  rank: string;
  status: string;
  phrase_hash: string | null;
  key_salt: string | null;
  locked_until: string | null;
};

export default function GateScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberRow | null>(null);
  const [mode, setMode] = useState<"enroll" | "unlock">("unlock");
  const [phrase, setPhrase] = useState("");
  const [phrase2, setPhrase2] = useState("");
  const [duress, setDuress] = useState("");
  const [codename, setCodename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = scorePassphrase(phrase);

  useSyncExternalStore(subscribeSession, () => getSessionKey());

  const isEmperor =
    isOwnerEmail(user?.email);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) { setLoading(false); return; }
      if (isEmperor) {
        // Bootstrap Emperor idempotently
        await supabase.rpc("ziaassets_bootstrap_emperor" as never);
      }
      const { data, error: e } = await supabase
        .from("ziaassets_members")
        .select("id, codename, rank, status, phrase_hash, key_salt, locked_until")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      if (e) {
        setError(e.message);
      } else if (!data) {
        setMode("enroll");
        setMember(null);
      } else {
        setMember(data as MemberRow);
        setMode(data.phrase_hash ? "unlock" : "enroll");
        setCodename(data.codename);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, isEmperor]);

  const handleEnroll = async () => {
    setError(null);
    if (strength.score < 70) {
      setError("Passphrase strength must be STRONG or higher.");
      return;
    }
    if (phrase !== phrase2) { setError("Passphrases do not match."); return; }
    if (duress && duress === phrase) { setError("Duress phrase must differ from the sovereign passphrase."); return; }
    if (!codename || codename.length < 3) { setError("Codename must be at least 3 characters."); return; }
    setBusy(true);
    try {
      // Insert member row if it doesn't exist yet (non-emperor self-enroll → pending)
      if (!member) {
        const { error: iErr } = await supabase.from("ziaassets_members").insert({
          user_id: user!.id,
          codename,
          rank: isEmperor ? "emperor" : "initiate",
          status: isEmperor ? "active" : "pending",
        });
        if (iErr) throw iErr;
      } else if (member.codename !== codename) {
        await supabase.from("ziaassets_members").update({ codename }).eq("user_id", user!.id);
      }

      const salt = randomSalt(32);
      const { error: rErr } = await supabase.rpc("ziaassets_set_phrase" as never, {
        _phrase: phrase, _key_salt: salt, _duress_phrase: duress || null,
      } as never);
      if (rErr) throw rErr;

      await unlock(phrase, salt, isEmperor ? "emperor" : "initiate");
      toast.success("Sovereign passphrase sealed. Access granted.");
      onUnlocked();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  const handleUnlock = async () => {
    setError(null); setBusy(true);
    try {
      const { data, error: rErr } = await supabase.rpc("ziaassets_verify_phrase" as never, { _phrase: phrase } as never);
      if (rErr) throw rErr;
      const arr = data as unknown as Array<{ ok: boolean; key_salt: string; member_rank: string; duress: boolean; locked_until: string | null }> | null;
      const row = arr && Array.isArray(arr) ? arr[0] : (data as unknown as { ok: boolean; key_salt: string; member_rank: string; duress: boolean; locked_until: string | null } | null);
      if (!row?.ok) {
        if (row?.locked_until) setError(`Locked until ${new Date(row.locked_until).toLocaleTimeString()}.`);
        else setError("Passphrase rejected.");
        return;
      }
      await unlock(phrase, row.key_salt, row.member_rank);
      toast.success("Vault unlocked.");
      onUnlocked();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (member && member.status === "pending") {
    return (
      <Card className="max-w-md mx-auto mt-16 p-6 space-y-3 bg-background/60 backdrop-blur border-white/10">
        <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /><h2 className="text-lg font-semibold">Awaiting Emperor Approval</h2></div>
        <p className="text-sm text-muted-foreground">
          Your codename <span className="font-mono">{member.codename}</span> is registered. The Emperor must activate your membership before you can enter the deck.
        </p>
      </Card>
    );
  }

  if (member && member.status === "revoked") {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto mt-16">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>Access revoked by the Emperor.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="max-w-md mx-auto mt-16 p-6 space-y-4 bg-background/60 backdrop-blur border-white/10">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5" />
        <h2 className="text-lg font-semibold tracking-wide">
          {mode === "enroll" ? "Seal Sovereign Passphrase" : "ZIAASSETS Gate"}
        </h2>
      </div>

      {mode === "enroll" && (
        <>
          <div>
            <Label>Codename</Label>
            <Input value={codename} onChange={(e) => setCodename(e.target.value)} placeholder="e.g. NIGHTHAWK" />
          </div>
          <div>
            <Label>Sovereign Passphrase (min 16 chars, ≥3 char classes)</Label>
            <Input type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Passphrase" />
            <div className="mt-2">
              <Progress value={strength.score} />
              <p className="text-xs mt-1 font-mono">{strength.label} ({strength.score}/100)</p>
              {strength.issues.map((i) => (
                <p key={i} className="text-xs text-amber-500">• {i}</p>
              ))}
            </div>
          </div>
          <div>
            <Label>Confirm Passphrase</Label>
            <Input type="password" value={phrase2} onChange={(e) => setPhrase2(e.target.value)} />
          </div>
          <div>
            <Label>Duress Phrase (optional, silent alarm)</Label>
            <Input type="password" value={duress} onChange={(e) => setDuress(e.target.value)} placeholder="If typed, silently suspends your access" />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button onClick={handleEnroll} disabled={busy} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Seal & Enter"}
          </Button>
        </>
      )}

      {mode === "unlock" && (
        <>
          <div>
            <Label>Sovereign Passphrase</Label>
            <Input type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()} autoFocus />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button onClick={handleUnlock} disabled={busy || !phrase} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            5 failed attempts locks the gate for 15 minutes.
          </p>
        </>
      )}
    </Card>
  );
}
