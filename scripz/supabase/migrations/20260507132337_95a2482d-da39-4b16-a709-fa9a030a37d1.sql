create table public.telegram_updates (
  update_id bigint primary key,
  created_at timestamptz not null default now()
);
alter table public.telegram_updates enable row level security;