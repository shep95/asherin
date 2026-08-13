// Forum Daily Digest — aggregates last 24h of forum activity and emails the admin.
// Trigger: pg_cron once per day, or manual POST for testing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Recipient lives in ASHERIN_DIGEST_RECIPIENT. A mailbox written into the
// repository is a disclosure that survives every later cleanup, so the digest
// simply does not send when the secret is absent.
const ADMIN_RECIPIENT = (Deno.env.get("ASHERIN_DIGEST_RECIPIENT") || "").trim();

interface Post {
  id: string;
  category: string;
  title: string;
  body: string;
  author_name: string | null;
  created_at: string;
}

function pack(p: Post, score?: number) {
  return {
    title: p.title,
    body: p.body,
    author: p.author_name ?? "anon",
    created_at: p.created_at,
    ...(typeof score === "number" ? { score } : {}),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const date = new Date().toISOString().slice(0, 10);

    // Pull last 24h across all categories (service role bypasses RLS).
    const { data: postsRaw, error: pErr } = await supabase
      .from("forum_posts")
      .select("id, category, title, body, author_name, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (pErr) throw pErr;
    const posts = (postsRaw ?? []) as Post[];

    const bugs = posts.filter((p) => p.category === "bug");
    const theories = posts.filter((p) => p.category === "theory");
    const ideas = posts.filter((p) => p.category === "idea");

    // Tally votes for the ideas in this window.
    let topIdea: any = null;
    let ideasRunnersUp: any[] = [];
    if (ideas.length > 0) {
      const { data: votes } = await supabase
        .from("forum_post_votes")
        .select("post_id, value")
        .in("post_id", ideas.map((i) => i.id))
        .gte("created_at", since);
      const scores = new Map<string, number>();
      for (const v of votes ?? []) {
        scores.set(v.post_id, (scores.get(v.post_id) ?? 0) + (v.value as number));
      }
      const ranked = ideas
        .map((i) => ({ post: i, score: scores.get(i.id) ?? 0 }))
        .sort((a, b) => b.score - a.score);
      if (ranked.length > 0 && ranked[0].score > 0) {
        topIdea = pack(ranked[0].post, ranked[0].score);
        ideasRunnersUp = ranked.slice(1, 6)
          .filter((r) => r.score > 0)
          .map((r) => pack(r.post, r.score));
      }
    }

    // Split bugs into "clearly-tagged software" vs. "random / uncategorized".
    // Heuristic: title contains obvious module keyword → software; otherwise random.
    const SOFTWARE_KEYS = /aureon|asher|zaxin|zerlal|zacoon|axrlen|zophiel|nomad|briefing|ide|vault|forum|dashboard|blog|billing|stripe|auth|login|signup/i;
    const softwareBugs = bugs.filter((b) => SOFTWARE_KEYS.test(b.title) || SOFTWARE_KEYS.test(b.body));
    const randomBugs = bugs.filter((b) => !SOFTWARE_KEYS.test(b.title) && !SOFTWARE_KEYS.test(b.body));

    const templateData = {
      date,
      bugs: softwareBugs.map((p) => pack(p)),
      randomBugs: randomBugs.map((p) => pack(p)),
      theories: theories.map((p) => pack(p)),
      topIdea,
      ideasRunnersUp,
    };

    const hasContent = bugs.length + theories.length + ideas.length > 0;
    if (!hasContent) {
      return new Response(JSON.stringify({ ok: true, skipped: "no activity" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "forum-daily-digest",
        recipientEmail: ADMIN_RECIPIENT,
        idempotencyKey: `forum-digest-${date}`,
        templateData,
      },
    });
    if (sendErr) throw sendErr;

    return new Response(
      JSON.stringify({
        ok: true,
        date,
        counts: { bugs: bugs.length, theories: theories.length, ideas: ideas.length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
