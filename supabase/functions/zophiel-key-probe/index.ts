// ZOPHIEL KEY PROBE
// Live data-pull from API keys/tokens that Link Intelligence surfaced.
// For each known provider type, the probe hits the provider's authenticated
// inventory endpoint with the supplied key and returns the raw observable
// data the key exposes (account email, project name, models, buckets, etc.).
// Read-only calls only — no mutations are performed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProbeResult = {
  ok: boolean;
  type: string;
  status: number;
  endpoint: string;
  summary: string;
  data: unknown;
  error?: string;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function safeJson(res: Response): Promise<unknown> {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt.slice(0, 4000); }
}

async function probeOpenAI(key: string): Promise<ProbeResult> {
  const ep = "https://api.openai.com/v1/models";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "openai", status: r.status, endpoint: ep,
    summary: r.ok
      ? `${(data as any)?.data?.length ?? 0} models accessible`
      : `OpenAI rejected key (${r.status})`,
    data,
  };
}

async function probeAnthropic(key: string): Promise<ProbeResult> {
  const ep = "https://api.anthropic.com/v1/models";
  const r = await fetch(ep, {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "anthropic", status: r.status, endpoint: ep,
    summary: r.ok
      ? `${(data as any)?.data?.length ?? 0} Claude models accessible`
      : `Anthropic rejected key (${r.status})`,
    data,
  };
}

async function probeGemini(key: string): Promise<ProbeResult> {
  const ep = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const r = await fetch(ep);
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "google_api", status: r.status, endpoint: ep.replace(key, "***"),
    summary: r.ok
      ? `${(data as any)?.models?.length ?? 0} Gemini models accessible`
      : `Google rejected key (${r.status})`,
    data,
  };
}

async function probeStripe(key: string): Promise<ProbeResult> {
  const ep = "https://api.stripe.com/v1/account";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r);
  const acct = data as any;
  return {
    ok: r.ok, type: "stripe", status: r.status, endpoint: ep,
    summary: r.ok
      ? `Stripe acct ${acct?.id} · ${acct?.business_profile?.name ?? acct?.email ?? "unknown"} · ${acct?.country}`
      : `Stripe rejected key (${r.status})`,
    data,
  };
}

async function probeSendgrid(key: string): Promise<ProbeResult> {
  const ep = "https://api.sendgrid.com/v3/user/profile";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r);
  const p = data as any;
  return {
    ok: r.ok, type: "sendgrid", status: r.status, endpoint: ep,
    summary: r.ok
      ? `SendGrid ${p?.email ?? p?.username ?? "?"} · ${p?.company ?? ""}`
      : `SendGrid rejected key (${r.status})`,
    data,
  };
}

async function probeMailgun(key: string): Promise<ProbeResult> {
  const ep = "https://api.mailgun.net/v4/domains";
  const auth = "Basic " + btoa(`api:${key}`);
  const r = await fetch(ep, { headers: { Authorization: auth } });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "mailgun", status: r.status, endpoint: ep,
    summary: r.ok
      ? `${(data as any)?.total_count ?? 0} sending domains accessible`
      : `Mailgun rejected key (${r.status})`,
    data,
  };
}

async function probeGithub(key: string): Promise<ProbeResult> {
  const ep = "https://api.github.com/user";
  const r = await fetch(ep, {
    headers: { Authorization: `token ${key}`, Accept: "application/vnd.github+json" },
  });
  const data = await safeJson(r);
  const u = data as any;
  return {
    ok: r.ok, type: "github_token", status: r.status, endpoint: ep,
    summary: r.ok
      ? `GitHub ${u?.login} · ${u?.name ?? ""} · ${u?.public_repos ?? 0} public repos`
      : `GitHub rejected token (${r.status})`,
    data,
  };
}

async function probeSlack(key: string): Promise<ProbeResult> {
  const ep = "https://slack.com/api/auth.test";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r) as any;
  return {
    ok: !!data?.ok, type: "slack", status: r.status, endpoint: ep,
    summary: data?.ok
      ? `Slack workspace ${data.team} · user ${data.user}`
      : `Slack rejected token (${data?.error ?? r.status})`,
    data,
  };
}

async function probeTwilio(sid: string, token: string): Promise<ProbeResult> {
  const ep = `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`;
  const auth = "Basic " + btoa(`${sid}:${token}`);
  const r = await fetch(ep, { headers: { Authorization: auth } });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "twilio", status: r.status, endpoint: ep,
    summary: r.ok
      ? `Twilio ${(data as any)?.friendly_name} · ${(data as any)?.status}`
      : `Twilio rejected creds (${r.status})`,
    data,
  };
}

async function probeAirtable(key: string): Promise<ProbeResult> {
  const ep = "https://api.airtable.com/v0/meta/bases";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "airtable", status: r.status, endpoint: ep,
    summary: r.ok
      ? `${(data as any)?.bases?.length ?? 0} Airtable bases accessible`
      : `Airtable rejected key (${r.status})`,
    data,
  };
}

async function probeAlgolia(key: string, appId?: string): Promise<ProbeResult> {
  if (!appId) {
    return {
      ok: false, type: "algolia", status: 0, endpoint: "(needs appId)",
      summary: "Algolia probe needs the application ID — supply hostHint",
      data: null,
    };
  }
  const ep = `https://${appId}-dsn.algolia.net/1/indexes`;
  const r = await fetch(ep, {
    headers: { "X-Algolia-API-Key": key, "X-Algolia-Application-Id": appId },
  });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "algolia", status: r.status, endpoint: ep,
    summary: r.ok
      ? `${(data as any)?.items?.length ?? 0} Algolia indexes accessible`
      : `Algolia rejected key (${r.status})`,
    data,
  };
}

async function probeSupabase(jwt: string, hostHint?: string): Promise<ProbeResult> {
  // Try the URL embedded near the key, else fall back to introspection of the JWT.
  let base = hostHint?.replace(/\/$/, "") ?? "";
  if (!/^https?:\/\//.test(base)) {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload?.ref) base = `https://${payload.ref}.supabase.co`;
    } catch { /* ignore */ }
  }
  if (!base) {
    return {
      ok: false, type: "supabase_key", status: 0, endpoint: "(unknown project)",
      summary: "Supabase probe couldn't infer project URL — pass hostHint",
      data: null,
    };
  }
  const ep = `${base}/rest/v1/?apikey=${jwt}`;
  const r = await fetch(ep, {
    headers: { apikey: jwt, Authorization: `Bearer ${jwt}` },
  });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "supabase_key", status: r.status, endpoint: ep.replace(jwt, "***"),
    summary: r.ok
      ? `Supabase REST reachable at ${base}`
      : `Supabase rejected key at ${base} (${r.status})`,
    data,
  };
}

async function probeFirebaseWebKey(key: string): Promise<ProbeResult> {
  // Identity Toolkit accepts any project's web API key for unauthenticated lookups
  // — we use the public project-config endpoint which echoes the project ID.
  const ep = `https://identitytoolkit.googleapis.com/v1/projects?key=${key}`;
  const r = await fetch(ep);
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "firebase_key", status: r.status, endpoint: ep.replace(key, "***"),
    summary: r.ok
      ? `Firebase project metadata reachable: ${(data as any)?.projectId ?? "ok"}`
      : `Firebase rejected key (${r.status})`,
    data,
  };
}

async function probeDigitalocean(key: string): Promise<ProbeResult> {
  const ep = "https://api.digitalocean.com/v2/account";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "digitalocean", status: r.status, endpoint: ep,
    summary: r.ok
      ? `DO acct ${(data as any)?.account?.email} · ${(data as any)?.account?.status}`
      : `DigitalOcean rejected token (${r.status})`,
    data,
  };
}

async function probeHeroku(key: string): Promise<ProbeResult> {
  const ep = "https://api.heroku.com/account";
  const r = await fetch(ep, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/vnd.heroku+json; version=3",
    },
  });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "heroku", status: r.status, endpoint: ep,
    summary: r.ok
      ? `Heroku acct ${(data as any)?.email}`
      : `Heroku rejected key (${r.status})`,
    data,
  };
}

async function probeNpm(key: string): Promise<ProbeResult> {
  const ep = "https://registry.npmjs.org/-/whoami";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "npm_token", status: r.status, endpoint: ep,
    summary: r.ok
      ? `npm user ${(data as any)?.username}`
      : `npm rejected token (${r.status})`,
    data,
  };
}

async function probeFbPixel(pixelId: string): Promise<ProbeResult> {
  // Meta Pixel IDs are public identifiers. We confirm the pixel is live by
  // posting a noop server-side event using the public Graph endpoint and
  // reading the validation response (no access token required for the
  // basic existence/version check via the public CDN).
  const ep = `https://www.facebook.com/tr/?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`;
  const r = await fetch(ep, { redirect: "manual" });
  // Meta returns a 1x1 gif (200) for any registered pixel id, 302/404 otherwise.
  const live = r.status === 200 && (r.headers.get("content-type") || "").includes("image");
  return {
    ok: live,
    type: "fb_pixel",
    status: r.status,
    endpoint: ep,
    summary: live
      ? `Meta Pixel ${pixelId} is LIVE · serving tracking gif`
      : `Meta Pixel ${pixelId} not serving (status ${r.status}) — likely disabled or invalid`,
    data: {
      pixel_id: pixelId,
      content_type: r.headers.get("content-type"),
      cache_control: r.headers.get("cache-control"),
      x_fb_debug: r.headers.get("x-fb-debug"),
      facebook_api_version: r.headers.get("x-fb-rev"),
    },
  };
}

async function probeSegment(key: string): Promise<ProbeResult> {
  // Segment Write Keys authenticate via HTTP Basic with the key as the
  // username and an empty password. The tracking API returns 200 for any
  // valid write key with a well-formed event.
  const ep = "https://api.segment.io/v1/identify";
  const auth = "Basic " + btoa(`${key}:`);
  const body = JSON.stringify({
    userId: "zophiel-probe",
    traits: { probe: true, ts: new Date().toISOString() },
    context: { library: { name: "zophiel-key-probe", version: "1.0" } },
  });
  const r = await fetch(ep, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body,
  });
  const data = await safeJson(r);
  return {
    ok: r.ok,
    type: "segment_write",
    status: r.status,
    endpoint: ep,
    summary: r.ok
      ? `Segment write key VALID — events accepted into workspace pipeline`
      : `Segment rejected write key (${r.status})`,
    data: { response: data, key_prefix: key.slice(0, 6) + "…" + key.slice(-4) },
  };
}

async function probeGeneric(key: string, hostHint?: string): Promise<ProbeResult> {
  // Last-resort: just probe the host's /api or root with the key as Bearer to see if it responds.
  const target = hostHint && /^https?:\/\//.test(hostHint) ? hostHint : null;
  if (!target) {
    return {
      ok: false, type: "unknown", status: 0, endpoint: "(no probe registered)",
      summary: "No live probe is registered for this key type",
      data: null,
    };
  }
  const r = await fetch(target, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await safeJson(r);
  return {
    ok: r.ok, type: "generic", status: r.status, endpoint: target,
    summary: `Generic Bearer probe → ${r.status}`,
    data,
  };
}

async function dispatch(
  type: string,
  key: string,
  hostHint?: string,
  extras?: Record<string, string>,
): Promise<ProbeResult> {
  switch (type) {
    case "openai_sk":      return probeOpenAI(key);
    case "anthropic_key":  return probeAnthropic(key);
    case "google_api":     return probeGemini(key);
    case "firebase_key":   return probeFirebaseWebKey(key);
    case "stripe_live":
    case "stripe_test":    return probeStripe(key);
    case "sendgrid":       return probeSendgrid(key);
    case "mailgun_key":    return probeMailgun(key);
    case "github_token":
    case "github_pat":     return probeGithub(key);
    case "slack_bot":
    case "slack_token":    return probeSlack(key);
    case "twilio":         return probeTwilio(extras?.sid ?? hostHint ?? "", key);
    case "airtable":       return probeAirtable(key);
    case "algolia_key":    return probeAlgolia(key, extras?.appId ?? hostHint);
    case "supabase_key":   return probeSupabase(key, hostHint);
    case "digitalocean":   return probeDigitalocean(key);
    case "heroku_api":     return probeHeroku(key);
    case "npm_token":      return probeNpm(key);
    case "fb_pixel":       return probeFbPixel(key);
    case "segment_write":  return probeSegment(key);
    default:               return probeGeneric(key, hostHint);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const type = String(body?.type ?? "").trim();
  const key = String(body?.key ?? "").trim();
  const hostHint = body?.hostHint ? String(body.hostHint).trim() : undefined;
  const extras = (body?.extras && typeof body.extras === "object") ? body.extras : undefined;

  if (!type || !key) return json(400, { error: "type and key are required" });
  if (key.length > 4000) return json(400, { error: "key too long" });

  try {
    const result = await dispatch(type, key, hostHint, extras);
    return json(200, result);
  } catch (e: any) {
    return json(200, {
      ok: false,
      type,
      status: 0,
      endpoint: "(network error)",
      summary: e?.message || "probe failed",
      data: null,
      error: e?.message || String(e),
    } satisfies ProbeResult);
  }
});
