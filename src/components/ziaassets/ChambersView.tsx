import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Hash, Megaphone, Send, Loader2, Lock } from "lucide-react";
import { encryptText, decryptText } from "@/lib/ziaassets/crypto";
import { getSessionKey } from "@/lib/ziaassets/session";
import { toast } from "sonner";

interface Channel {
  id: string; name: string; slug: string; kind: string; topic: string | null; min_rank: string;
}
interface Message {
  id: string; channel_id: string; sender_id: string; ciphertext: string; iv: string;
  created_at: string; kind: string;
}

export default function ChambersView() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [codenames, setCodenames] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ziaassets_channels")
        .select("id, name, slug, kind, topic, min_rank")
        .eq("is_archived", false)
        .order("name");
      const list = (data ?? []) as Channel[];
      setChannels(list);
      if (list.length && !activeId) setActiveId(list[0].id);
    })();
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("ziaassets_messages")
        .select("id, channel_id, sender_id, ciphertext, iv, created_at, kind")
        .eq("channel_id", activeId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!alive) return;
      const msgs = (data ?? []) as Message[];
      setMessages(msgs);
      // Load codenames for senders
      const ids = Array.from(new Set(msgs.map((m) => m.sender_id)));
      if (ids.length) {
        const { data: mems } = await supabase
          .from("ziaassets_members").select("user_id, codename").in("user_id", ids);
        const map: Record<string, string> = {};
        (mems ?? []).forEach((r: { user_id: string; codename: string }) => { map[r.user_id] = r.codename; });
        setCodenames(map);
      }
    })();

    const ch = supabase.channel(`ziaassets:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ziaassets_messages", filter: `channel_id=eq.${activeId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [activeId]);

  // Decrypt any new messages
  useEffect(() => {
    const key = getSessionKey();
    if (!key) return;
    (async () => {
      const next: Record<string, string> = { ...decrypted };
      for (const m of messages) {
        if (next[m.id]) continue;
        try {
          next[m.id] = await decryptText(key, m.ciphertext, m.iv, m.channel_id);
        } catch {
          next[m.id] = "🔒 [Unable to decrypt — different key epoch]";
        }
      }
      setDecrypted(next);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || !activeId) return;
    const key = getSessionKey();
    if (!key) { toast.error("Vault locked. Re-enter your passphrase."); return; }
    setBusy(true);
    try {
      const { ciphertext, iv } = await encryptText(key, draft.trim(), activeId);
      const { error } = await supabase.from("ziaassets_messages").insert({
        channel_id: activeId, sender_id: user!.id, ciphertext, iv, aad: activeId, kind: "text",
      });
      if (error) throw error;
      setDraft("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const activeChannel = useMemo(() => channels.find((c) => c.id === activeId), [channels, activeId]);

  return (
    <div className="grid grid-cols-[240px_1fr] gap-0 h-[calc(100vh-180px)] border border-white/10 rounded-lg overflow-hidden bg-background/40 backdrop-blur">
      <aside className="border-r border-white/10 bg-background/60">
        <div className="p-3 text-xs uppercase tracking-widest text-muted-foreground">Chambers</div>
        <ScrollArea className="h-[calc(100%-40px)]">
          {channels.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/5 ${activeId === c.id ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>
              {c.kind === "broadcast" ? <Megaphone className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
              <span className="truncate">{c.name}</span>
              <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">{c.min_rank}</Badge>
            </button>
          ))}
          {!channels.length && <div className="p-3 text-xs text-muted-foreground">No chambers yet.</div>}
        </ScrollArea>
      </aside>

      <section className="flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
          <Hash className="w-4 h-4 text-muted-foreground" />
          <div className="font-semibold">{activeChannel?.name ?? "Select a chamber"}</div>
          {activeChannel?.topic && <div className="text-xs text-muted-foreground border-l border-white/10 pl-2 ml-1">{activeChannel.topic}</div>}
          <Lock className="w-3 h-3 ml-auto text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">AES-256-GCM · E2E</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                [{new Date(m.created_at).toLocaleTimeString()}] {codenames[m.sender_id] ?? "???"}:
              </span>{" "}
              <span className="whitespace-pre-wrap">{decrypted[m.id] ?? "…"}</span>
            </div>
          ))}
          {!messages.length && <div className="text-xs text-muted-foreground">No messages yet. Break the seal.</div>}
        </div>
        <div className="p-3 border-t border-white/10 flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Encrypted message…" disabled={!activeId} />
          <Button onClick={send} disabled={busy || !draft.trim() || !activeId} size="icon">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </section>
    </div>
  );
}
