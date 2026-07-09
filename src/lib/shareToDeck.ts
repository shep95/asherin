// shareToDeck — one-call bridge that lets any suite (Aureon Chat, AXRLEN,
// Zophiel, ZERLAL, IDE) post an artifact into the currently active channel
// of the currently active server. The message body is normalized so the
// channel-side renderer draws a clean "shared from X" card with a fenced
// payload — no ad-hoc string shapes bleeding across suites.
//
// The caller supplies the destination (serverId, channelId, authorHandle).
// This function assumes those are already the ones the operator is looking
// at; it does NOT switch channels or servers behind the operator's back.

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ShareSource = "aureon-chat" | "zophiel" | "axrlen" | "zerlal" | "ide" | "external";

export interface ShareArgs {
  source: ShareSource;
  title: string;                       // one-line label for the card
  body: string;                        // the payload (markdown or plain)
  language?: string;                   // for code payloads — "ts", "sql", …
  serverId: string;
  channelId: string;
  authorId: string;
  authorHandle: string;
  compartments?: string[];
}

const SOURCE_LABEL: Record<ShareSource, string> = {
  "aureon-chat": "Aureon Chat",
  zophiel:       "Zophiel Search",
  axrlen:        "AXRLEN Forecast",
  zerlal:        "ZERLAL Cyber",
  ide:           "Sovereign IDE",
  external:      "External",
};

export function formatSharedMessage(source: ShareSource, title: string, body: string, lang?: string): string {
  const header = `**⇢ Shared from ${SOURCE_LABEL[source]}** · ${title.trim()}`;
  const fence  = lang ? "```" + lang : "```";
  return `${header}\n${fence}\n${body.trim()}\n\`\`\``;
}

export async function shareToDeck(args: ShareArgs): Promise<void> {
  const {
    source, title, body, language,
    serverId, channelId, authorId, authorHandle, compartments = [],
  } = args;

  if (!body?.trim()) { toast.error("Nothing to share."); return; }

  const composed = formatSharedMessage(source, title || SOURCE_LABEL[source], body, language);

  const { error } = await supabase.from("hoa_messages").insert({
    server_id:     serverId,
    channel_id:    channelId,
    author_id:     authorId,
    author_handle: authorHandle,
    body:          composed,
    compartments,
    sealed:        false,
    pinned:        false,
  });
  if (error) { toast.error(error.message); return; }

  await supabase.from("hoa_audit").insert({
    server_id:     serverId,
    actor_id:      authorId,
    actor_handle:  authorHandle,
    action:        "SUITE_SHARE",
    target:        SOURCE_LABEL[source],
    detail:        title.slice(0, 200),
  });

  toast.success(`Shared to channel from ${SOURCE_LABEL[source]}`);
}
