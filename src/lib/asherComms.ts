/**
 * ASHER Comms — data access layer.
 * All encryption happens client-side via asherCrypto. Server only stores ciphertext.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  encryptForRecipients,
  decryptMessage,
  unlockIdentity,
  type RecipientKey,
} from "@/lib/asherCrypto";

export type Clearance =
  | "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET" | "TS_SCI" | "TS_SCI_NOFORN";

export interface Operator {
  id: string;
  user_id: string;
  callsign: string;
  rank: string | null;
  clearance: Clearance;
  status: string;
  status_message: string | null;
  last_seen_at: string | null;
}

export interface Conversation {
  id: string;
  kind: "dm" | "group" | "channel";
  name: string | null;
  topic: string | null;
  classification: string;
  created_by: string;
  created_at: string;
  archived_at: string | null;
}

export interface DecryptedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  classification: string;
  message_type: string;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  hash: string;
}

export interface RawMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  iv: string;
  classification: string;
  message_type: string;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  hash: string;
}

// ---------- Operators ----------
export async function listOperators(): Promise<Operator[]> {
  const { data, error } = await supabase
    .from("asher_operators")
    .select("*")
    .order("callsign");
  if (error) throw error;
  return (data ?? []) as Operator[];
}

export async function inviteOperator(input: {
  user_id: string;
  callsign: string;
  rank?: string;
  clearance?: Clearance;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("asher_operators").insert({
    user_id: input.user_id,
    callsign: input.callsign,
    rank: input.rank ?? null,
    clearance: input.clearance ?? "UNCLASSIFIED",
    invited_by: auth.user.id,
  });
  if (error) throw error;
  await audit("operator_invited", { user_id: input.user_id });
}

export async function updateOwnPresence(status: "online" | "away" | "busy" | "offline", message?: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase
    .from("asher_operators")
    .update({ status, status_message: message ?? null, last_seen_at: new Date().toISOString() })
    .eq("user_id", auth.user.id);
}

// ---------- Identity keys ----------
export async function uploadPublicKey(publicKeyJwk: JsonWebKey, fingerprint: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("asher_identity_keys").upsert(
    {
      user_id: auth.user.id,
      public_key: publicKeyJwk as never,
      key_fingerprint: fingerprint,
      algorithm: "ECDH-P256",
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function fetchPublicKeys(userIds: string[]): Promise<Map<string, JsonWebKey>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("asher_identity_keys")
    .select("user_id, public_key")
    .in("user_id", userIds);
  if (error) throw error;
  const map = new Map<string, JsonWebKey>();
  for (const row of data ?? []) map.set(row.user_id, row.public_key as JsonWebKey);
  return map;
}

// ---------- Conversations ----------
export async function listConversations(): Promise<Conversation[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  // Fetch convs the user is a member of
  const { data: mems } = await supabase
    .from("asher_conversation_members")
    .select("conversation_id")
    .eq("user_id", auth.user.id);
  const ids = (mems ?? []).map((m) => m.conversation_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("asher_conversations")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function listMembers(conversationId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("asher_conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);
  if (error) throw error;
  return (data ?? []).map((m) => m.user_id);
}

export async function createDM(otherUserId: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const me = auth.user.id;

  // Check for existing DM between the two
  const { data: myConvs } = await supabase
    .from("asher_conversation_members")
    .select("conversation_id")
    .eq("user_id", me);
  const myIds = (myConvs ?? []).map((c) => c.conversation_id);
  if (myIds.length > 0) {
    const { data: theirShared } = await supabase
      .from("asher_conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myIds);
    const sharedIds = (theirShared ?? []).map((c) => c.conversation_id);
    if (sharedIds.length > 0) {
      const { data: dms } = await supabase
        .from("asher_conversations")
        .select("id")
        .in("id", sharedIds)
        .eq("kind", "dm")
        .limit(1);
      if (dms && dms.length > 0) return dms[0].id;
    }
  }

  const { data: conv, error } = await supabase
    .from("asher_conversations")
    .insert({ kind: "dm", created_by: me, classification: "UNCLASSIFIED" })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("asher_conversation_members").insert([
    { conversation_id: conv.id, user_id: me, role: "owner" },
    { conversation_id: conv.id, user_id: otherUserId, role: "member" },
  ]);
  await audit("dm_created", { conversation_id: conv.id, with: otherUserId });
  return conv.id;
}

export async function addMembers(conversationId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const rows = userIds.map((uid) => ({
    conversation_id: conversationId,
    user_id: uid,
    role: "member" as const,
  }));
  const { error } = await supabase
    .from("asher_conversation_members")
    .upsert(rows, { onConflict: "conversation_id,user_id" });
  if (error) throw error;
  await audit("members_added", { conversation_id: conversationId, count: userIds.length });
}

export async function createGroup(input: {
  name: string;
  topic?: string;
  classification?: string;
  member_ids: string[];
}): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const me = auth.user.id;
  const { data: conv, error } = await supabase
    .from("asher_conversations")
    .insert({
      kind: "group",
      name: input.name,
      topic: input.topic ?? null,
      classification: input.classification ?? "UNCLASSIFIED",
      created_by: me,
    })
    .select()
    .single();
  if (error) throw error;
  const members = Array.from(new Set([me, ...input.member_ids])).map((uid) => ({
    conversation_id: conv.id,
    user_id: uid,
    role: uid === me ? "owner" : "member",
  }));
  const { error: memErr } = await supabase.from("asher_conversation_members").insert(members);
  if (memErr) throw memErr;
  await audit("group_created", { conversation_id: conv.id, name: input.name, members: members.length });
  return conv.id;
}

export async function createChannel(input: {
  name: string;
  topic?: string;
  classification?: string;
  member_ids: string[];
}): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const me = auth.user.id;
  const { data: conv, error } = await supabase
    .from("asher_conversations")
    .insert({
      kind: "channel",
      name: input.name,
      topic: input.topic ?? null,
      classification: input.classification ?? "UNCLASSIFIED",
      created_by: me,
    })
    .select()
    .single();
  if (error) throw error;

  const members = Array.from(new Set([me, ...input.member_ids])).map((uid) => ({
    conversation_id: conv.id,
    user_id: uid,
    role: uid === me ? "owner" : "member",
  }));
  await supabase.from("asher_conversation_members").insert(members);
  await audit("channel_created", { conversation_id: conv.id, name: input.name });
  return conv.id;
}

// ---------- Messages ----------
export async function sendMessage(input: {
  conversation_id: string;
  plaintext: string;
  classification?: string;
  reply_to?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const memberIds = await listMembers(input.conversation_id);
  if (memberIds.length === 0) throw new Error("No members in conversation");

  const pubMap = await fetchPublicKeys(memberIds);
  const recipients: RecipientKey[] = [];
  for (const uid of memberIds) {
    const pk = pubMap.get(uid);
    if (pk) recipients.push({ recipient_id: uid, pubkey: pk });
  }
  if (recipients.length === 0) {
    throw new Error("No recipients have published encryption keys yet.");
  }

  const enc = await encryptForRecipients(input.plaintext, recipients);

  const { data: msg, error } = await supabase
    .from("asher_messages")
    .insert({
      conversation_id: input.conversation_id,
      sender_id: auth.user.id,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      hash: enc.hash,
      classification: input.classification ?? "UNCLASSIFIED",
      reply_to: input.reply_to ?? null,
      message_type: "text",
    })
    .select()
    .single();
  if (error) throw error;

  // Insert per-recipient wrapped keys
  const keyRows = enc.perRecipient.map((r) => ({
    message_id: msg.id,
    recipient_id: r.recipient_id,
    wrapped_key: r.wrapped_key,
    ephemeral_pubkey: r.ephemeral_pubkey as never,
  }));
  const { error: keyErr } = await supabase.from("asher_message_keys").insert(keyRows);
  if (keyErr) throw keyErr;

  await audit("message_sent", {
    conversation_id: input.conversation_id,
    message_id: msg.id,
    recipient_count: recipients.length,
    classification: input.classification ?? "UNCLASSIFIED",
  });
  return msg.id;
}

export async function fetchMessages(conversationId: string, limit = 100): Promise<RawMessage[]> {
  const { data, error } = await supabase
    .from("asher_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RawMessage[];
}

export async function decryptInbox(
  userId: string,
  passphrase: string,
  raw: RawMessage[]
): Promise<DecryptedMessage[]> {
  const privKey = await unlockIdentity(userId, passphrase);
  if (raw.length === 0) return [];

  // Fetch my wrapped keys for these messages
  const ids = raw.map((m) => m.id);
  const { data: keys, error } = await supabase
    .from("asher_message_keys")
    .select("message_id, wrapped_key, ephemeral_pubkey")
    .eq("recipient_id", userId)
    .in("message_id", ids);
  if (error) throw error;
  const keyMap = new Map<string, { wrapped_key: string; ephemeral_pubkey: JsonWebKey }>();
  for (const k of keys ?? []) {
    keyMap.set(k.message_id, {
      wrapped_key: k.wrapped_key,
      ephemeral_pubkey: k.ephemeral_pubkey as JsonWebKey,
    });
  }

  const out: DecryptedMessage[] = [];
  for (const m of raw) {
    if (m.deleted_at) {
      out.push({ ...m, body: "[message deleted]" });
      continue;
    }
    const k = keyMap.get(m.id);
    if (!k) {
      out.push({ ...m, body: "[no key for this message]" });
      continue;
    }
    try {
      const body = await decryptMessage(privKey, m.ciphertext, m.iv, k.wrapped_key, k.ephemeral_pubkey);
      out.push({ ...m, body });
    } catch (err) {
      console.error("decrypt failed", m.id, err);
      out.push({ ...m, body: "[decryption failed]" });
    }
  }
  return out;
}

export async function markRead(messageId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase
    .from("asher_message_reads")
    .upsert({ message_id: messageId, user_id: auth.user.id }, { onConflict: "message_id,user_id" });
}

// Phase 3: soft-delete a message (sender can recover within 30 days via purge_soft_deleted).
export async function softDeleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_asher_message" as never, { p_message_id: messageId } as never);
  if (error) throw error;
}

// ---------- Audit ----------
export async function audit(action: string, metadata: Record<string, unknown>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("asher_comms_audit").insert({
    actor_id: auth.user.id,
    action,
    conversation_id: (metadata.conversation_id as string) ?? null,
    message_id: (metadata.message_id as string) ?? null,
    metadata: metadata as never,
  });
}
