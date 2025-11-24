-- Audit/event logs table
create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tenant_id uuid null,
  actor_id uuid null,
  actor_email text null,
  action text not null,
  entity text null,
  entity_id text null,
  details jsonb null
);

-- Useful indexes
create index if not exists app_events_created_at_idx on public.app_events (created_at desc);
create index if not exists app_events_action_idx on public.app_events (action);
create index if not exists app_events_entity_idx on public.app_events (entity);
create index if not exists app_events_tenant_idx on public.app_events (tenant_id);

-- Optional: enable RLS with permissive policies (adjust later for multi-tenant)
alter table public.app_events enable row level security;
do $$ begin
  create policy app_events_select_all on public.app_events for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy app_events_insert_all on public.app_events for insert with check (true);
exception when duplicate_object then null; end $$;
