import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, Lightbulb, Bug, Radio, Send, Loader2, Plus } from "lucide-react";
import LandingBackground from "@/components/LandingBackground";
import Header from "@/components/Header";
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

const CATEGORIES: { id: Category; label: string; icon: typeof Lightbulb; desc: string }[] = [
  { id: "idea", label: "Ideas", icon: Lightbulb, desc: "Suggestions for what to build next" },
  { id: "leak", label: "Leaks", icon: Radio,     desc: "Insider intel & disclosures" },
  { id: "bug",  label: "Bugs",  icon: Bug,       desc: "Issues that need to be fixed" },
];

const Forums = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
    const { data } = await supabase
      .from("forum_posts").select("*")
      .eq("category", cat)
      .order("created_at", { ascending: false })
      .limit(200);
    setPosts((data ?? []) as ForumPost[]);
    setLoading(false);
  };

  useEffect(() => { loadPosts(tab); }, [tab]);

  const submitPost = async () => {
    if (!user) { toast({ title: "Sign in required" }); return; }
    const t = title.trim(), b = body.trim();
    if (t.length < 3 || t.length > 200) { toast({ title: "Title 3–200 chars", variant: "destructive" }); return; }
    if (!b || b.length > 8000) { toast({ title: "Body 1–8000 chars", variant: "destructive" }); return; }
    setSubmitting(true);
    const { error } = await supabase.from("forum_posts").insert({
      user_id: user.id, category: tab, title: t, body: b,
      author_name: user.email?.split("@")[0] ?? null,
    });
    setSubmitting(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setTitle(""); setBody(""); setComposeOpen(false);
    loadPosts(tab);
  };

  const openPost = async (p: ForumPost) => {
    setActivePost(p);
    const { data } = await supabase.from("forum_replies").select("*")
      .eq("post_id", p.id).order("created_at", { ascending: true });
    setReplies((data ?? []) as ForumReply[]);
  };

  const submitReply = async () => {
    if (!user || !activePost) return;
    const b = replyBody.trim();
    if (!b || b.length > 4000) { toast({ title: "Reply 1–4000 chars", variant: "destructive" }); return; }
    const { error, data } = await supabase.from("forum_replies").insert({
      post_id: activePost.id, user_id: user.id, body: b,
      author_name: user.email?.split("@")[0] ?? null,
    }).select().single();
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setReplies((r) => [...r, data as ForumReply]);
    setReplyBody("");
  };

  const ActiveIcon = CATEGORIES.find(c => c.id === tab)!.icon;

  return (
    <LandingBackground>
      <Header />
      <main className="relative z-10 mx-auto max-w-5xl px-6 pt-28 pb-24">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-extralight tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors uppercase mb-8">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-5 w-5 text-foreground/70" strokeWidth={1.3} />
          <p className="text-[10px] font-light tracking-[0.4em] text-muted-foreground/60 uppercase">Community Forums</p>
        </div>
        <h1 className="text-5xl sm:text-6xl font-extralight tracking-[0.1em] zophiel-shimmer-text mb-3">FORUMS</h1>
        <p className="max-w-xl text-sm font-extralight leading-relaxed text-muted-foreground/80 mb-10">
          Share ideas, drop leaks, and report bugs that need to be fixed. Text only — no file uploads.
        </p>

        {/* Category tabs */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {CATEGORIES.map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setActivePost(null); }}
              className={`text-left rounded-2xl border backdrop-blur-md p-4 transition-all ${
                tab === id
                  ? "border-foreground/40 bg-foreground/[0.07]"
                  : "border-border/15 bg-card/30 hover:border-border/40 hover:bg-card/50"
              }`}
            >
              <Icon className="h-4 w-4 text-foreground/70 mb-2" strokeWidth={1.4} />
              <p className="text-sm font-light tracking-wide text-foreground">{label}</p>
              <p className="text-[10px] font-light text-muted-foreground/60 mt-1 leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>

        {!activePost ? (
          <>
            {/* Compose */}
            <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-md mb-6">
              {!composeOpen ? (
                <button
                  onClick={() => { if (!user) { toast({ title: "Sign in to post" }); return; } setComposeOpen(true); }}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Share a {tab}…
                </button>
              ) : (
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">
                    <ActiveIcon className="h-3 w-3" /> New {tab}
                  </div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    placeholder="Title"
                    className="w-full bg-transparent border-b border-border/20 pb-2 text-base font-light text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/40 transition-colors"
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={8000}
                    rows={6}
                    placeholder={`Describe your ${tab} in detail. Text only — no file uploads.`}
                    className="w-full bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-border/15">
                    <span className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">{body.length} / 8000</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setComposeOpen(false); setTitle(""); setBody(""); }} className="text-[11px] font-light tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase">Cancel</button>
                      <button
                        onClick={submitPost}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg border border-foreground/30 bg-foreground/10 px-4 py-1.5 text-[11px] font-light tracking-[0.2em] text-foreground hover:bg-foreground/20 transition-all uppercase disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Posts list - scrollable */}
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground/60">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : posts.length === 0 ? (
                <div className="rounded-2xl border border-border/15 bg-card/20 p-12 text-center">
                  <ActiveIcon className="h-6 w-6 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.2} />
                  <p className="text-sm font-light text-muted-foreground/60 tracking-wide">No {tab}s yet. Be the first.</p>
                </div>
              ) : posts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openPost(p)}
                  className="block w-full text-left rounded-2xl border border-border/15 bg-card/30 backdrop-blur-md hover:border-border/40 hover:bg-card/50 transition-all p-5 group"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-base font-light text-foreground tracking-wide group-hover:text-foreground">{p.title}</h3>
                    <span className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase whitespace-nowrap pt-1">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs font-light text-muted-foreground/80 line-clamp-2 leading-relaxed">{p.body}</p>
                  <p className="mt-3 text-[10px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">— {p.author_name ?? "anon"}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Post detail */}
            <button onClick={() => { setActivePost(null); setReplies([]); }} className="text-[11px] font-light tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase mb-4 inline-flex items-center gap-2">
              <ArrowLeft className="h-3 w-3" /> Back to {tab}s
            </button>
            <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-md p-6 mb-6">
              <h2 className="text-2xl font-extralight tracking-wide text-foreground mb-2">{activePost.title}</h2>
              <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase mb-4">
                {activePost.category} · {activePost.author_name ?? "anon"} · {new Date(activePost.created_at).toLocaleDateString()}
              </p>
              <p className="text-sm font-light text-foreground/85 leading-relaxed whitespace-pre-wrap">{activePost.body}</p>
            </div>

            <p className="text-[10px] font-light tracking-[0.25em] text-muted-foreground/60 uppercase mb-3">{replies.length} replies</p>
            <div className="space-y-2 mb-6">
              {replies.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/15 bg-card/30 backdrop-blur-md p-4">
                  <p className="text-sm font-light text-foreground/85 leading-relaxed whitespace-pre-wrap">{r.body}</p>
                  <p className="mt-2 text-[10px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">— {r.author_name ?? "anon"} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-md p-4">
              {user ? (
                <div className="flex items-end gap-3">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    maxLength={4000}
                    rows={2}
                    placeholder="Write a reply…"
                    className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
                  />
                  <button onClick={submitReply} className="rounded-lg border border-foreground/30 bg-foreground/10 px-3 py-2 hover:bg-foreground/20 transition-all">
                    <Send className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <p className="text-center text-[11px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase py-2">Sign in to reply</p>
              )}
            </div>
          </>
        )}
      </main>
    </LandingBackground>
  );
};

export default Forums;
