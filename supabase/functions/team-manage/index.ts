/**
 * Asherin Team — the server side of every membership action.
 *
 * RLS already constrains what a browser can touch. This function exists for
 * the steps RLS cannot do alone: sending an invitation, moving Stripe seat
 * quantity, swapping ownership atomically, and cancelling a subscription when
 * a workspace is deleted. Every action re-derives the caller's role from the
 * database — a role sent by the client is ignored.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";
import { billingError, requireBillingUser } from "../_shared/billingHttp.ts";
import { clampSeats } from "../_shared/teamPricing.ts";

type Role = "owner" | "admin" | "member" | "viewer";

const log = (step: string, details?: unknown) =>
  console.log(`[TEAM-MANAGE] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function appOrigin(req: Request): string {
  const raw = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(raw) ? raw : "https://asherin.com";
}

function fail(message: string, corsHeaders: Record<string, string>, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status,
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const anon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const ok = (body: Record<string, unknown>) =>
    new Response(JSON.stringify({ ok: true, ...body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });

  try {
    const user = await requireBillingUser(req, (t) => anon.auth.getUser(t) as any);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const teamId = String(body?.team_id ?? "");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripe = stripeKey
      ? new Stripe(stripeKey, { apiVersion: (Deno.env.get("STRIPE_API_VERSION") || "2025-08-27.basil") as any })
      : null;

    // ── Invite answers are keyed by the invite, not by a team the caller is
    // not yet on, so they resolve before the membership lookup. ─────────────
    if (action === "accept" || action === "decline") {
      const inviteId = String(body?.invite_id ?? "");
      const { data: invite } = await admin
        .from("team_invites").select("*").eq("id", inviteId).maybeSingle();
      if (!invite) return fail("That invitation no longer exists.", corsHeaders, 404);
      if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
        return fail("This invitation was issued to a different address.", corsHeaders, 403);
      }
      if (invite.status !== "pending") return fail(`This invitation was already ${invite.status}.`, corsHeaders);
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        await admin.from("team_invites").update({ status: "expired" }).eq("id", invite.id);
        return fail("This invitation expired. Ask an admin to send a new one.", corsHeaders);
      }

      if (action === "decline") {
        await admin.from("team_invites").update({ status: "declined" }).eq("id", invite.id);
        return ok({ status: "declined" });
      }

      const { data: team } = await admin
        .from("teams").select("id,name,seat_quantity,billing_status").eq("id", invite.team_id).maybeSingle();
      if (!team) return fail("That workspace no longer exists.", corsHeaders, 404);
      if (team.billing_status !== "active") {
        return fail("This workspace is not billing-active right now. Ask the owner to check billing.", corsHeaders);
      }

      const { error: joinErr } = await admin
        .from("team_members")
        .insert({ team_id: invite.team_id, user_id: user.id, role: invite.role });
      if (joinErr && !joinErr.message.includes("duplicate")) return fail(joinErr.message, corsHeaders);

      await admin.from("team_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: user.id })
        .eq("id", invite.id);
      await admin.from("audit_log").insert({
        user_id: user.id, team_id: invite.team_id, action: "team_invite_accepted",
        resource_type: "team_member", resource_id: invite.team_id,
      });
      log("Invite accepted", { teamId: invite.team_id, role: invite.role });
      return ok({ team_id: invite.team_id, role: invite.role, team_name: team.name });
    }

    // ── Roster read ─────────────────────────────────────────────────────────
    // The browser cannot resolve a member's email (auth.users is not exposed
    // and profiles carries no address), so the roster is assembled here from
    // memberships the caller actually holds. No team the caller is not on can
    // ever appear in this payload.
    if (action === "list") {
      const { data: myTeams } = await admin
        .from("team_members").select("team_id, role, joined_at").eq("user_id", user.id);
      const ids = (myTeams ?? []).map((r) => r.team_id);

      const { data: teamRows } = ids.length
        ? await admin.from("teams").select("*").in("id", ids)
        : { data: [] as any[] };
      const { data: memberRows } = ids.length
        ? await admin.from("team_members").select("team_id, user_id, role, joined_at").in("team_id", ids)
        : { data: [] as any[] };

      // Pending invites: those the caller can administer, plus any addressed to
      // the caller's own mailbox on a workspace they have not joined yet.
      const adminTeamIds = (myTeams ?? [])
        .filter((r) => r.role === "owner" || r.role === "admin")
        .map((r) => r.team_id);
      const { data: adminInvites } = adminTeamIds.length
        ? await admin.from("team_invites").select("*").in("team_id", adminTeamIds).eq("status", "pending")
        : { data: [] as any[] };
      const { data: myInvites } = await admin
        .from("team_invites").select("*").ilike("email", user.email).eq("status", "pending");

      const inviteTeamIds = [...new Set((myInvites ?? []).map((i) => i.team_id))];
      const { data: inviteTeams } = inviteTeamIds.length
        ? await admin.from("teams").select("id,name,description,icon").in("id", inviteTeamIds)
        : { data: [] as any[] };

      // Resolve display identity for every roster row in one pass.
      const memberIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];
      const { data: profs } = memberIds.length
        ? await admin.from("profiles").select("user_id, display_name, avatar_url").in("user_id", memberIds)
        : { data: [] as any[] };
      const emailById = new Map<string, string>();
      for (const id of memberIds) {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          if (data?.user?.email) emailById.set(id, data.user.email);
        } catch { /* identity stays masked */ }
      }

      const roster = (memberRows ?? []).map((m) => {
        const p = (profs ?? []).find((x: any) => x.user_id === m.user_id);
        return {
          ...m,
          email: emailById.get(m.user_id) ?? null,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          is_self: m.user_id === user.id,
        };
      });

      return ok({
        teams: teamRows ?? [],
        members: roster,
        invites: adminInvites ?? [],
        my_invites: (myInvites ?? []).map((i) => ({
          ...i,
          team: (inviteTeams ?? []).find((t: any) => t.id === i.team_id) ?? null,
        })),
        my_email: user.email,
      });
    }

    if (!teamId) return fail("Missing team.", corsHeaders);

    const { data: team } = await admin.from("teams").select("*").eq("id", teamId).maybeSingle();
    if (!team) return fail("That workspace no longer exists.", corsHeaders, 404);

    const { data: myRow } = await admin
      .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
    const myRole = (myRow?.role ?? null) as Role | null;
    if (!myRole) return fail("You are not a member of that workspace.", corsHeaders, 403);

    const isOwner = myRole === "owner";
    const isAdmin = isOwner || myRole === "admin";
    // Invites stay open through the 3-day past-due grace, then freeze.
    const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
    const billingLive =
      team.billing_status === "active" ||
      (team.billing_status === "past_due" &&
        team.past_due_since != null &&
        Date.now() - new Date(team.past_due_since).getTime() < GRACE_MS);

    const audit = (act: string, resourceId?: string) =>
      admin.from("audit_log").insert({
        user_id: user.id, team_id: teamId, action: act,
        resource_type: "team", resource_id: resourceId ?? teamId,
      });

    switch (action) {
      // ── W2 invite ───────────────────────────────────────────────────────
      case "invite":
      case "resend": {
        if (!isAdmin) return fail("Only the owner or an admin can invite.", corsHeaders, 403);
        if (!billingLive) return fail("Invites are frozen until the workspace subscription is active.", corsHeaders);

        let inviteRow: any = null;

        if (action === "resend") {
          const { data } = await admin
            .from("team_invites").select("*").eq("id", String(body?.invite_id ?? "")).eq("team_id", teamId).maybeSingle();
          if (!data || data.status !== "pending") return fail("That invitation is no longer pending.", corsHeaders);
          const fresh = new Date(Date.now() + 14 * 864e5).toISOString();
          await admin.from("team_invites").update({ expires_at: fresh }).eq("id", data.id);
          inviteRow = { ...data, expires_at: fresh };
        } else {
          const email = String(body?.email ?? "").trim().toLowerCase();
          const role = String(body?.role ?? "member");
          if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.", corsHeaders);
          if (!["admin", "member", "viewer"].includes(role)) return fail("Unknown role.", corsHeaders);
          if (email === user.email.toLowerCase()) return fail("You already hold a seat here.", corsHeaders);

          const { data: usage } = await admin.rpc("team_seat_usage", { _team_id: teamId });
          if (Number(usage ?? 0) >= team.seat_quantity) {
            return fail(
              `All ${team.seat_quantity} seats are taken by members and pending invites. Add a seat to invite more.`,
              corsHeaders,
            );
          }

          const { data: inserted, error: inviteErr } = await admin
            .from("team_invites")
            .insert({ team_id: teamId, email, role, invited_by: user.id, status: "pending" })
            .select().single();
          if (inviteErr) {
            return fail(
              inviteErr.message.includes("duplicate")
                ? "That address already has a pending invitation."
                : inviteErr.message,
              corsHeaders,
            );
          }
          inviteRow = inserted;
          await audit("team_invite_sent", inserted.id);
        }

        const acceptUrl = `${appOrigin(req)}/dashboard?view=teams&invite=${inviteRow.id}`;
        let emailed = false;
        let emailStatus = 0;
        try {
          const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              templateName: "team-invite",
              recipientEmail: inviteRow.email,
              idempotencyKey: `team-invite-${inviteRow.id}-${inviteRow.expires_at}`,
              templateData: {
                teamName: team.name,
                inviterName: "The workspace owner",
                role: inviteRow.role,
                acceptUrl,
                expiresAt: new Date(inviteRow.expires_at).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                }),
              },
            }),
          });
          emailStatus = resp.status;
          emailed = resp.ok;
          if (!resp.ok) log("Invite email rejected", { status: resp.status, detail: (await resp.text()).slice(0, 300) });
        } catch (mailErr) {
          log("Invite email threw", { error: String(mailErr) });
        }

        // Never claim "sent" without a 2xx — the UI shows the link instead.
        return ok({ invite_id: inviteRow.id, emailed, email_status: emailStatus, accept_url: acceptUrl });
      }

      // ── W4 revoke ───────────────────────────────────────────────────────
      case "revoke": {
        if (!isAdmin) return fail("Only the owner or an admin can revoke invitations.", corsHeaders, 403);
        const { error } = await admin.from("team_invites")
          .update({ status: "revoked" })
          .eq("id", String(body?.invite_id ?? "")).eq("team_id", teamId).eq("status", "pending");
        if (error) return fail(error.message, corsHeaders);
        await audit("team_invite_revoked");
        return ok({ status: "revoked" });
      }

      // ── W5 change role ──────────────────────────────────────────────────
      case "change_role": {
        if (!isAdmin) return fail("Only the owner or an admin can change roles.", corsHeaders, 403);
        const targetId = String(body?.user_id ?? "");
        const role = String(body?.role ?? "");
        if (!["admin", "member", "viewer"].includes(role)) return fail("Unknown role.", corsHeaders);
        const { data: target } = await admin
          .from("team_members").select("role").eq("team_id", teamId).eq("user_id", targetId).maybeSingle();
        if (!target) return fail("That person is not on this workspace.", corsHeaders, 404);
        if (target.role === "owner") return fail("The owner's role can only change through a transfer.", corsHeaders, 403);
        if (target.role === "admin" && !isOwner) return fail("Only the owner can change another admin.", corsHeaders, 403);
        if (targetId === user.id && !isOwner) return fail("You cannot change your own role.", corsHeaders, 403);

        const { error } = await admin.from("team_members")
          .update({ role }).eq("team_id", teamId).eq("user_id", targetId);
        if (error) return fail(error.message, corsHeaders);
        await audit(`team_role_${role}`, targetId);
        return ok({ user_id: targetId, role });
      }

      // ── W6 remove / W8 leave ────────────────────────────────────────────
      case "remove_member":
      case "leave": {
        const targetId = action === "leave" ? user.id : String(body?.user_id ?? "");
        if (action === "remove_member" && !isAdmin) {
          return fail("Only the owner or an admin can remove people.", corsHeaders, 403);
        }
        const { data: target } = await admin
          .from("team_members").select("role").eq("team_id", teamId).eq("user_id", targetId).maybeSingle();
        if (!target) return fail("That person is not on this workspace.", corsHeaders, 404);
        if (target.role === "owner") {
          return fail("The owner holds the workspace. Transfer ownership first.", corsHeaders, 403);
        }
        if (action === "remove_member" && target.role === "admin" && !isOwner) {
          return fail("Only the owner can remove an admin.", corsHeaders, 403);
        }

        const { error } = await admin.from("team_members")
          .delete().eq("team_id", teamId).eq("user_id", targetId);
        if (error) return fail(error.message, corsHeaders);
        await audit(action === "leave" ? "team_left" : "team_member_removed", targetId);
        return ok({ user_id: targetId, removed: true });
      }

      // ── W8 transfer ─────────────────────────────────────────────────────
      case "transfer_owner": {
        if (!isOwner) return fail("Only the owner can transfer the workspace.", corsHeaders, 403);
        const targetId = String(body?.user_id ?? "");
        const { data: target } = await admin
          .from("team_members").select("role").eq("team_id", teamId).eq("user_id", targetId).maybeSingle();
        if (!target || target.role === "owner") return fail("Pick another member to receive the workspace.", corsHeaders);

        // Demote first, then promote: the single-owner constraint is deferred
        // to the end of the transaction, so the intermediate state is legal.
        await admin.from("team_members").update({ role: "admin" }).eq("team_id", teamId).eq("user_id", user.id);
        const { error } = await admin.from("team_members").update({ role: "owner" }).eq("team_id", teamId).eq("user_id", targetId);
        if (error) {
          await admin.from("team_members").update({ role: "owner" }).eq("team_id", teamId).eq("user_id", user.id);
          return fail(error.message, corsHeaders);
        }
        await admin.from("teams").update({ owner_id: targetId }).eq("id", teamId);
        await audit("team_ownership_transferred", targetId);
        return ok({ owner_id: targetId });
      }

      // ── W7 seats ────────────────────────────────────────────────────────
      case "set_seats": {
        if (!isOwner) return fail("Only the owner can change seats or billing.", corsHeaders, 403);
        const seats = clampSeats(body?.seats);
        const { data: usage } = await admin.rpc("team_seat_usage", { _team_id: teamId });
        if (seats < Number(usage ?? 0)) {
          return fail(`Remove members or invitations first — ${usage} seats are currently occupied.`, corsHeaders);
        }
        if (!stripe || !team.stripe_subscription_id) {
          return fail("This workspace has no live subscription to update.", corsHeaders);
        }

        const sub = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
        // Seats are the only line that can ever carry a quantity above one.
        const seatItem = sub.items.data.find((i) => (i.quantity ?? 1) > 1) ?? sub.items.data[1] ?? null;
        if (!seatItem) return fail("Could not locate the seat line on this subscription.", corsHeaders, 500);

        await stripe.subscriptions.update(team.stripe_subscription_id, {
          items: [{ id: seatItem.id, quantity: seats }],
          proration_behavior: "create_prorations",
        });
        await admin.from("teams").update({ seat_quantity: seats }).eq("id", teamId);
        await audit("team_seats_updated");
        log("Seats updated", { teamId, seats });
        return ok({ seat_quantity: seats });
      }

      // ── W9 delete ───────────────────────────────────────────────────────
      case "delete_workspace": {
        if (!isOwner) return fail("Only the owner can delete the workspace.", corsHeaders, 403);
        if (String(body?.confirm_name ?? "").trim() !== team.name) {
          return fail("Type the workspace name exactly to confirm.", corsHeaders);
        }
        if (stripe && team.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(team.stripe_subscription_id);
          } catch (cancelErr) {
            log("WARNING: Stripe cancel failed", { error: String(cancelErr) });
          }
        }
        await admin.from("team_invites").delete().eq("team_id", teamId);
        await admin.from("projects").update({ team_id: null }).eq("team_id", teamId);
        await admin.from("team_members").delete().eq("team_id", teamId).neq("role", "owner");
        await admin.from("team_members").delete().eq("team_id", teamId);
        await admin.from("teams").delete().eq("id", teamId);
        log("Workspace deleted", { teamId });
        return ok({ deleted: true });
      }

      // ── W1 rename ───────────────────────────────────────────────────────
      case "update_workspace": {
        if (!isAdmin) return fail("Only the owner or an admin can edit the workspace.", corsHeaders, 403);
        const name = String(body?.name ?? team.name).trim();
        if (name.length < 2 || name.length > 60) return fail("Workspace name must be 2–60 characters.", corsHeaders);
        const { error } = await admin.from("teams").update({
          name,
          description: String(body?.description ?? team.description).slice(0, 240),
          icon: String(body?.icon ?? team.icon).slice(0, 24),
        }).eq("id", teamId);
        if (error) return fail(error.message, corsHeaders);
        await audit("team_updated");
        return ok({ name });
      }

      default:
        return fail("Unknown action.", corsHeaders);
    }
  } catch (error) {
    return billingError(error, corsHeaders, "TEAM-MANAGE");
  }
});
