-- ═══════════════════════════════════════════════════════════════════════════
-- Bajaj Chat Module — run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL CHECK (type IN ('direct', 'group')),
  name       text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_members (
  room_id      uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,                        -- ← required for unread counts
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      text NOT NULL,
  mentions     uuid[] NOT NULL DEFAULT '{}',
  enquiry_refs text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chat_members_user    ON public.chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room   ON public.chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.chat_rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: breaks RLS circular dependency between chat_rooms ↔ chat_members
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$;

-- chat_rooms: only see rooms you belong to
CREATE POLICY "members_select_rooms"
  ON public.chat_rooms FOR SELECT
  USING (public.is_room_member(id));

CREATE POLICY "auth_insert_rooms"
  ON public.chat_rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- chat_members
CREATE POLICY "members_select_members"
  ON public.chat_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_room_member(room_id));

CREATE POLICY "auth_insert_members"
  ON public.chat_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "members_update_own"
  ON public.chat_members FOR UPDATE
  USING (user_id = auth.uid());

-- chat_messages
CREATE POLICY "members_select_messages"
  ON public.chat_messages FOR SELECT
  USING (public.is_room_member(room_id));

CREATE POLICY "members_insert_messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND public.is_room_member(room_id));

-- ─── RPC: get_room_unread_counts ──────────────────────────────────────────────
-- Returns unread message count per room since last_read_at.
CREATE OR REPLACE FUNCTION public.get_room_unread_counts(
  p_user_id  uuid,
  p_room_ids uuid[]
)
RETURNS TABLE(room_id uuid, unread_count bigint)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    m.room_id,
    COUNT(msg.id) AS unread_count
  FROM public.chat_members m
  LEFT JOIN public.chat_messages msg
    ON  msg.room_id   = m.room_id
    AND msg.sender_id <> p_user_id
    AND (m.last_read_at IS NULL OR msg.created_at > m.last_read_at)
  WHERE
    m.user_id  = p_user_id
    AND m.room_id = ANY(p_room_ids)
  GROUP BY m.room_id;
$$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime on the messages table.
-- Also do: Supabase Dashboard → Database → Replication → Enable for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
