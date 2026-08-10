// ═══════════════════════════════════════════════════════════════════════════
// organism — the account-facing seam of the living layer
//
// Organs push sensations in; the operator reads vitals and stories out. The
// account is ALWAYS taken from the caller's verified session, never from the
// body, so no client can breathe into another account's bloodstream.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { publish, draw, type Sensation } from "../_shared/organism/bloodstream.ts";
import { metabolize } from "../_shared/organism/metabolism.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SensationSchema = z.object({
  organ: z.enum([
    "postmark", "voiceprint", "mesh", "ghost", "sentinel", "shield",
    "op", "lattice", "augur", "guardian", "zophiel", "chat",
  ]),
  kind: z.string().min(1).max(80),
  entity: z
    .object({
      kind: z.enum(["person", "email", "phone", "domain", "network", "device", "radio", "credential", "place", "org"]),
      key: z.string().min(1).max(300),
      label: z.string().max(200).nullable().optional(),
      attrs: z.record(z.unknown()).optional(),
    })
    .nullable()
    .optional(),
  verdict: z.enum(["clean", "benign", "anomalous", "hostile", "unknown"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  reflex: z.boolean().optional(),
  summary: z.string().max(500).optional(),
  evidence: z.record(z.unknown()).optional(),
  observedAt: z.string().datetime().optional(),
  dedupeKey: z.string().max(200).optional(),
  ttlDays: z.number().int().min(1).max(365).optional(),
});

const Body = z.object({
  action: z.enum(["publish", "pulse", "state", "designate", "acknowledge"]),
  sensations: z.array(SensationSchema).max(200).optional(),
  windowHours: z.number().int().min(1).max(720).optional(),
  entityId: z.string().uuid().optional(),
  selfStatus: z.enum(["self", "trusted", "unknown", "suspect", "hostile"]).optional(),
  findingId: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);

    const db = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: authData } = await db.auth.getUser();
    const user = authData?.user;
    if (!user) return json({ error: "unauthenticated" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "bad request", detail: parsed.error.flatten() }, 400);
    const body = parsed.data;

    switch (body.action) {
      case "publish": {
        const result = await publish(db, user.id, (body.sensations ?? []) as Sensation[]);
        return json({ ok: true, ...result });
      }

      case "pulse": {
        const result = await metabolize(db, user.id, { windowHours: body.windowHours ?? 72, renew: false });
        return json({ ok: true, ...result });
      }

      case "state": {
        const [{ data: state }, { data: findings }, blood] = await Promise.all([
          db.from("organism_state").select("*").eq("user_id", user.id).maybeSingle(),
          db
            .from("organism_findings")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "open")
            .order("severity", { ascending: false })
            .order("confidence", { ascending: false })
            .limit(60),
          draw(db, user.id, body.windowHours ?? 72, 250),
        ]);
        return json({
          ok: true,
          state: state ?? null,
          findings: findings ?? [],
          events: blood.events.slice(0, 120),
          entities: blood.entities.slice(0, 200),
        });
      }

      case "designate": {
        // The operator's word about what is theirs outranks the model's guess.
        if (!body.entityId || !body.selfStatus) return json({ error: "entityId and selfStatus required" }, 400);
        const { error } = await db
          .from("organism_entities")
          .update({ self_status: body.selfStatus, updated_at: new Date().toISOString() })
          .eq("id", body.entityId)
          .eq("user_id", user.id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "acknowledge": {
        if (!body.findingId) return json({ error: "findingId required" }, 400);
        const { error } = await db
          .from("organism_findings")
          .update({ status: "acknowledged", updated_at: new Date().toISOString() })
          .eq("id", body.findingId)
          .eq("user_id", user.id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
    }

    return json({ error: "unsupported action" }, 400);
  } catch (e) {
    console.error("[organism]", e instanceof Error ? e.message : String(e));
    return json({ error: "organism failure" }, 500);
  }
});
