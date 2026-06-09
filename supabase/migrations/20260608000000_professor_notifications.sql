-- F5-07: In-app notifications for professors
create table professor_notifications (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('attempt_submitted')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on professor_notifications (professor_id, created_at desc);

alter table professor_notifications enable row level security;

create policy "professor_notifications_select" on professor_notifications
  for select using (professor_id = auth.uid());

create policy "professor_notifications_update" on professor_notifications
  for update using (professor_id = auth.uid());
