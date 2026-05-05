import { useEffect, useState } from "react";
import { MessageSquare, Lightbulb, Bug, Radio, Send, X, ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Category = "idea" | "leak" | "bug";

interface ForumPost {
  id: string;
  user_id: string;
  category: Category;
  title: string;
  body: string;
  author_name: string | null;
  created_at: string;
}

interface ForumReply {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  author_name: string | null;
  created_at: string;
}

const CATEGORIES: { id: Category; label: string; icon: typeof Lightbulb }[] = [
  { id: "idea", label: "Ideas", icon: Lightbulb },
  { id: "leak", label: "Leaks", icon: Radio },
  { id: "bug",  label: "Bugs",  icon: Bug },
];

const ForumsDropdown = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Category>("idea");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activePost, setActivePost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [replyBody, setReplyBody] = useState("");

  const loadPosts = async (cat: Category) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("forum_posts")
      .select("*")
      .eq("category", cat)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setPosts(data as ForumPost[]);
    setLoading(false);
  };

  useEffect(() => { if (open) loadPosts(tab); }, [open, tab]);

  const submitPost = async () => {
    if (!user) { toast({ title: "Sign in required", description: "Log in to post." }); return; }
    const t = title.trim(); const b = body.trim();
    if (t.length < 3 || t.length > 200) { toast({ title: "Title 3–200 chars", variant: "destructive" }); return; }
    if (b.length < 1 || b.length > 8000) { toast({ title: "Body 1–8000 chars", variant: "destructive" }); return; }
    setSubmitting(true);
    const { error } = await supabase.from("forum_posts").insert({
      user_id: user.id,
      category: tab,
      title: t,
      body: b,
      author_name: user.email?.split("@")[0] ?? null,
    });
    setSubmitting(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setTitle(""); setBody(""); setComposeOpen(false);
    loadPosts(tab);
  };

  const openPost = async (p: ForumPost) => {
    setActivePost(p);
    const { data } = await supabase
      .from("forum_replies").select("*")
      .eq("post_id", p.id).order("created_at", { ascending: true });
    setReplies((data ?? []) as ForumReply[]);
  };

  const submitReply = async () => {
    if (!user || !activePost) return;
    const b = replyBody.trim();
    if (!b || b.length > 4000) { toast({ title: "Reply 1–4000 chars", variant: "destructive" }); return; }
    const { error, data } = await supabase.from("forum_replies").insert({
      post_id: activePost.id,
      user_id: user.id,
      body: b,
      author_name: user.email?.split("@")[0] ?? null,
    }).select().single();
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setReplies((r) => [...r, data as ForumReply]);
    setReplyBody("");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-2 sm:py-2.5 flex items-center gap-1.5 text-sm font-light tracking-wide text-muted-foreground transition-colors hover:text-foreground hover:bg-card/80 outline-none rounded-r-xl"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Forums
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setActivePost(null); setComposeOpen(false); }} />
          <div className="absolute right-0 mt-2 z-50 w-[440px] max-h-[78vh] overflow-hidden rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl animate-fade-in flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-foreground/70" strokeWidth={1.4} />
                <span className="text-[11px] font-light tracking-[0.25em] text-foreground/80 uppercase">Community Forums</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {!activePost ? (
              <>
                {/* Tabs */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-border/15">
                  {CATEGORIES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-light tracking-[0.15em] uppercase transition-all ${
                        tab === id
                          ? "bg-foreground/10 text-foreground border border-border/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-transparent"
                      }`}
                    >
                      <Icon className="h-3 w-3" strokeWidth={1.5} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Compose toggle */}
                <div className="px-3 pt-3">
                  {!composeOpen ? (
                    <button
                      onClick={() => { if (!user) { toast({ title: "Sign in to post" }); return; } setComposeOpen(true); }}
                      className="w-full rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-left text-xs font-light text-muted-foreground hover:text-foreground hover:border-border/50 transition-all"
                    >
                      Share a {tab}…
                    </button>
                  ) : (
                    <div className="rounded-lg border border-border/30 bg-background/40 p-3 space-y-2">
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                        placeholder="Title"
                        className="w-full bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/60 outline-none"
                      />
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        maxLength={8000}
                        rows={4}
                        placeholder={`Describe your ${tab}. No file uploads — text only.`}
                        className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/50 outline-none resize-none border-t border-border/15 pt-2"
                      />
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">{body.length}/8000</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setComposeOpen(false); setTitle(""); setBody(""); }} className="text-[10px] font-light tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase">Cancel</button>
                          <button
                            onClick={submitPost}
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 rounded-md border border-foreground/30 bg-foreground/10 px-3 py-1 text-[10px] font-light tracking-[0.2em] text-foreground hover:bg-foreground/20 transition-all uppercase disabled:opacity-50"
                          >
                            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Posts */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground/60"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  ) : posts.length === 0 ? (
                    <div className="text-center py-10 text-xs font-light text-muted-foreground/50 tracking-wide">No {tab}s yet. Be the first.</div>
                  ) : posts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openPost(p)}
                      className="w-full text-left rounded-lg border border-border/15 bg-background/30 hover:border-border/40 hover:bg-background/50 transition-all p-3 group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-light text-foreground tracking-wide line-clamp-1 group-hover:text-foreground">{p.title}</h4>
                        <span className="text-[9px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[11px] font-light text-muted-foreground/80 line-clamp-2 leading-relaxed">{p.body}</p>
                      <p className="mt-2 text-[9px] font-light tracking-[0.15em] text-muted-foreground/40 uppercase">— {p.author_name ?? "anon"}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Post detail */}
                <div className="px-4 py-3 border-b border-border/15">
                  <button onClick={() => { setActivePost(null); setReplies([]); }} className="text-[10px] font-light tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase mb-2">← Back</button>
                  <h3 className="text-sm font-light text-foreground tracking-wide">{activePost.title}</h3>
                  <p className="mt-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">{activePost.category} · {activePost.author_name ?? "anon"}</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  <p className="text-xs font-light text-foreground/85 leading-relaxed whitespace-pre-wrap">{activePost.body}</p>
                  <div className="border-t border-border/15 pt-3 space-y-2">
                    <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">{replies.length} replies</p>
                    {replies.map((r) => (
                      <div key={r.id} className="rounded-lg border border-border/15 bg-background/30 p-2.5">
                        <p className="text-xs font-light text-foreground/85 leading-relaxed whitespace-pre-wrap">{r.body}</p>
                        <p className="mt-1.5 text-[9px] font-light tracking-[0.15em] text-muted-foreground/40 uppercase">— {r.author_name ?? "anon"} · {new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border/20 p-3">
                  {user ? (
                    <div className="flex items-end gap-2">
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        maxLength={4000}
                        rows={2}
                        placeholder="Reply…"
                        className="flex-1 rounded-lg border border-border/30 bg-background/40 p-2 text-xs font-light text-foreground placeholder:text-muted-foreground/50 outline-none resize-none focus:border-border/60"
                      />
                      <button onClick={submitReply} className="rounded-lg border border-foreground/30 bg-foreground/10 p-2 hover:bg-foreground/20 transition-all">
                        <Send className="h-3.5 w-3.5 text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-center text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">Sign in to reply</p>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ForumsDropdown;
