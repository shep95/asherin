import { supabase } from "@/integrations/supabase/client";

export type AsherAuditEvent =
  | "passcode_success"
  | "passcode_failure"
  | "session_locked"
  | "session_unlocked"
  | "module_open"
  | "map_query"
  | "target_saved"
  | "target_deleted"
  | "imagine_generated"
  | "imagine_chat"
  | "geofence_event"
  | "logout";


export async function logAsherEvent(event_type: AsherAuditEvent, detail: Record<string, any> = {}) {
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return;
    await supabase.from("asher_audit_log").insert({
      user_id: uid,
      event_type,
      detail,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
    });
  } catch {
    /* never break the UI for audit */
  }
}
