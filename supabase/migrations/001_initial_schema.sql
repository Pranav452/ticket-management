-- ============================================================
--  Manilal Ticket Management System — Initial Schema
--  Run this in Supabase Studio (localhost:3001) SQL Editor
--  after starting Docker Compose
-- ============================================================

-- ─── App config table (stores dev email for trigger) ────
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

-- Seed the dev email — this is the account that auto-gets 'dev' role on signup
insert into public.app_config (key, value)
values ('dev_email', 'pranavnairop090@gmail.com')
on conflict (key) do nothing;

-- ─── Profiles ────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'user'
                check (role in ('user', 'dev')),
  created_at  timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- ─── Tickets ─────────────────────────────────────────────
create table if not exists public.tickets (
  id            uuid default gen_random_uuid() primary key,
  title         text not null,
  subject       text not null,
  description   text,
  priority      text not null default 'medium'
                  check (priority in ('low', 'medium', 'high', 'urgent')),
  status        text not null default 'backlog'
                  check (status in ('backlog', 'todo', 'doing', 'done')),
  created_by    uuid references public.profiles(id) on delete set null,
  assigned_to   uuid references public.profiles(id) on delete set null,
  cc            text[] default '{}',
  bcc           text[] default '{}',
  column_order  float default 0,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

alter table public.tickets enable row level security;

-- ─── Ticket Files ────────────────────────────────────────
create table if not exists public.ticket_files (
  id           uuid default gen_random_uuid() primary key,
  ticket_id    uuid references public.tickets(id) on delete cascade not null,
  file_url     text not null,
  file_name    text not null,
  file_type    text not null,
  file_size    bigint not null,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz default now() not null
);

alter table public.ticket_files enable row level security;

-- ─── Messages (ticket chat) ──────────────────────────────
create table if not exists public.messages (
  id          uuid default gen_random_uuid() primary key,
  ticket_id   uuid references public.tickets(id) on delete cascade not null,
  sender_id   uuid references public.profiles(id) on delete set null not null,
  content     text not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.messages enable row level security;

-- ============================================================
--  HELPER FUNCTIONS
-- ============================================================

-- Check if current user has dev role
create or replace function public.is_dev()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'dev'
  );
$$;

-- ============================================================
--  TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tickets_updated_at
  before update on public.tickets
  for each row execute function public.handle_updated_at();

create trigger messages_updated_at
  before update on public.messages
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup + assign dev role if email matches
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dev_email_config text;
begin
  -- Try to get dev email from app_config table
  select value into dev_email_config
  from public.app_config
  where key = 'dev_email';

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case
      when lower(new.email) = lower(coalesce(dev_email_config, ''))
      then 'dev'
      else 'user'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  ROW LEVEL SECURITY POLICIES
-- ============================================================

-- ─── profiles ────────────────────────────────────────────
create policy "Authenticated users can read all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── tickets ─────────────────────────────────────────────
create policy "Dev can see all tickets"
  on public.tickets for select
  to authenticated
  using (public.is_dev());

create policy "Users can see their own tickets"
  on public.tickets for select
  to authenticated
  using (created_by = auth.uid());

create policy "Authenticated users can create tickets"
  on public.tickets for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Dev can update any ticket"
  on public.tickets for update
  to authenticated
  using (public.is_dev());

create policy "Users can update their own tickets"
  on public.tickets for update
  to authenticated
  using (created_by = auth.uid() and not public.is_dev());

create policy "Dev can delete any ticket"
  on public.tickets for delete
  to authenticated
  using (public.is_dev());

create policy "Users can delete their own tickets"
  on public.tickets for delete
  to authenticated
  using (created_by = auth.uid());

-- ─── ticket_files ────────────────────────────────────────
create policy "Dev can see all ticket files"
  on public.ticket_files for select
  to authenticated
  using (public.is_dev());

create policy "Users can see files on their tickets"
  on public.ticket_files for select
  to authenticated
  using (
    exists (
      select 1 from public.tickets
      where id = ticket_files.ticket_id
      and created_by = auth.uid()
    )
  );

create policy "Authenticated users can upload files"
  on public.ticket_files for insert
  to authenticated
  with check (uploaded_by = auth.uid());

create policy "Dev can delete any ticket file"
  on public.ticket_files for delete
  to authenticated
  using (public.is_dev());

create policy "Users can delete their own ticket files"
  on public.ticket_files for delete
  to authenticated
  using (uploaded_by = auth.uid());

-- ─── messages ────────────────────────────────────────────
create policy "Dev can see all messages"
  on public.messages for select
  to authenticated
  using (public.is_dev());

create policy "Users can see messages on their tickets"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.tickets
      where id = messages.ticket_id
      and created_by = auth.uid()
    )
  );

create policy "Authenticated users can send messages on accessible tickets"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_dev()
      or exists (
        select 1 from public.tickets
        where id = messages.ticket_id
        and created_by = auth.uid()
      )
    )
  );

-- ============================================================
--  STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  true,
  52428800,  -- 50 MB
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ]
)
on conflict (id) do nothing;

-- Storage RLS: public read, authenticated upload
create policy "Public read access for ticket attachments"
  on storage.objects for select
  using (bucket_id = 'ticket-attachments');

create policy "Authenticated users can upload ticket attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ticket-attachments');

create policy "Users can delete their own attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ticket-attachments' and owner = auth.uid());

-- ============================================================
--  REALTIME PUBLICATIONS
-- ============================================================

-- Enable realtime for messages (chat) and tickets (status updates)
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.tickets;
