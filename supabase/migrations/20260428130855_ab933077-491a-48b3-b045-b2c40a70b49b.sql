-- ASHER Secure Messaging — E2EE schema

-- Operator roster (admin invites users into Asher Comms)
CREATE TABLE public.asher_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  callsign TEXT NOT NULL,
  rank TEXT,
  clearance TEXT NOT NULL DEFAULT 'UNCLASSIFIED'
    CHECK (clearance IN ('UNCLASSIFIED','CONFIDENTIAL','SECRET','TOP_SECRET','TS_SCI','TS_SCI_NOFORN')),
  status TEXT NOT NULL DEFAULT 'offline',
  status_message TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E2EE identity keys (public only; private stays on device)
CREATE TABLE public.asher_identity_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key JSONB NOT NULL, -- JWK format
  key_fingerprint TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'ECDH-P256',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ
);

-- Conversations: dm | group | channel
CREATE TABLE public.asher_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('dm','group','channel')),
  name TEXT,
  topic TEXT,
  classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE public.asher_conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.asher_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','readonly')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

-- E2EE messages: only ciphertext stored
CREATE TABLE public.asher_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.asher_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  ciphertext TEXT NOT NULL,        -- base64 AES-256-GCM
  iv TEXT NOT NULL,                -- base64 96-bit IV
  classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  message_type TEXT NOT NULL DEFAULT 'text', -- text|file|location|intel|voice
  attachment_meta JSONB,           -- encrypted blob storage refs
  reply_to UUID REFERENCES public.asher_messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  hash TEXT NOT NULL,              -- SHA-256 of ciphertext for chain-of-custody
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asher_messages_conv ON public.asher_messages(conversation_id, created_at DESC);

-- Per-recipient wrapped content keys (one row per member per message)
CREATE TABLE public.asher_message_keys (
  message_id UUID NOT NULL REFERENCES public.asher_messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wrapped_key TEXT NOT NULL,       -- AES key encrypted with recipient's pubkey ECDH
  ephemeral_pubkey JSONB NOT NULL, -- sender's ephemeral pubkey for this msg
  PRIMARY KEY (message_id, recipient_id)
);

-- Read receipts
CREATE TABLE public.asher_message_reads (
  message_id UUID NOT NULL REFERENCES public.asher_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Reactions
CREATE TABLE public.asher_message_reactions (
  message_id UUID NOT NULL REFERENCES public.asher_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Metadata-only audit log (no plaintext, ever)
CREATE TABLE public.asher_comms_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  conversation_id UUID,
  message_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asher_audit_actor ON public.asher_comms_audit(actor_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.asher_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_identity_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_message_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_comms_audit ENABLE ROW LEVEL SECURITY;

-- Helper: is this user an active operator?
CREATE OR REPLACE FUNCTION public.is_asher_operator(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.asher_operators WHERE user_id = _user_id);
$$;

-- Helper: is user a member of conversation?
CREATE OR REPLACE FUNCTION public.is_asher_conv_member(_user_id UUID, _conv_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.asher_conversation_members WHERE user_id = _user_id AND conversation_id = _conv_id);
$$;

-- Operators: admin manages, operators read all (roster)
CREATE POLICY "Operators viewable by operators" ON public.asher_operators
  FOR SELECT USING (public.is_asher_operator(auth.uid()) OR public.is_admin_user(auth.uid()));
CREATE POLICY "Admin manages operators" ON public.asher_operators
  FOR ALL USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));
CREATE POLICY "Operator updates own status" ON public.asher_operators
  FOR UPDATE USING (auth.uid() = user_id);

-- Identity keys: anyone authenticated can read pubkeys (needed for E2EE), only owner writes
CREATE POLICY "Public keys readable by operators" ON public.asher_identity_keys
  FOR SELECT USING (public.is_asher_operator(auth.uid()) OR public.is_admin_user(auth.uid()));
CREATE POLICY "User manages own key" ON public.asher_identity_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Conversations: members only
CREATE POLICY "Members view conversations" ON public.asher_conversations
  FOR SELECT USING (public.is_asher_conv_member(auth.uid(), id) OR public.is_admin_user(auth.uid()));
CREATE POLICY "Operators create conversations" ON public.asher_conversations
  FOR INSERT WITH CHECK (public.is_asher_operator(auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Owners update conversations" ON public.asher_conversations
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin_user(auth.uid()));

-- Members: visible to conv members
CREATE POLICY "Members view membership" ON public.asher_conversation_members
  FOR SELECT USING (public.is_asher_conv_member(auth.uid(), conversation_id) OR public.is_admin_user(auth.uid()));
CREATE POLICY "Owners add members" ON public.asher_conversation_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.asher_conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
    OR public.is_admin_user(auth.uid())
    OR auth.uid() = user_id  -- self-join for invites
  );
CREATE POLICY "Owners remove members" ON public.asher_conversation_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.asher_conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
    OR public.is_admin_user(auth.uid())
    OR auth.uid() = user_id
  );

-- Messages: members read, sender writes
CREATE POLICY "Members read messages" ON public.asher_messages
  FOR SELECT USING (public.is_asher_conv_member(auth.uid(), conversation_id));
CREATE POLICY "Members send messages" ON public.asher_messages
  FOR INSERT WITH CHECK (public.is_asher_conv_member(auth.uid(), conversation_id) AND auth.uid() = sender_id);
CREATE POLICY "Sender edits own messages" ON public.asher_messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- Message keys: recipient reads own, sender writes
CREATE POLICY "Recipient reads own key" ON public.asher_message_keys
  FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Sender writes message keys" ON public.asher_message_keys
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.asher_messages m WHERE m.id = message_id AND m.sender_id = auth.uid())
  );

-- Reads & reactions: members
CREATE POLICY "Members manage reads" ON public.asher_message_reads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members view reads" ON public.asher_message_reads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.asher_messages m WHERE m.id = message_id AND public.is_asher_conv_member(auth.uid(), m.conversation_id))
  );
CREATE POLICY "Members manage reactions" ON public.asher_message_reactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members view reactions" ON public.asher_message_reactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.asher_messages m WHERE m.id = message_id AND public.is_asher_conv_member(auth.uid(), m.conversation_id))
  );

-- Audit: admin only
CREATE POLICY "Admin views audit" ON public.asher_comms_audit
  FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Operators write audit" ON public.asher_comms_audit
  FOR INSERT WITH CHECK (public.is_asher_operator(auth.uid()) AND auth.uid() = actor_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.asher_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asher_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asher_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asher_operators;
ALTER TABLE public.asher_messages REPLICA IDENTITY FULL;
ALTER TABLE public.asher_operators REPLICA IDENTITY FULL;