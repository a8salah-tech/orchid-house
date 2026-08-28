-- ══════════════════════════════════════════════════════════════════════
-- ترقية وحدة الصيانة — تشغَّل مرة واحدة في Supabase SQL Editor
-- بعد تشغيلها تعمل الميزات الجديدة تلقائياً في صفحة /dashboard/maintenance
-- ══════════════════════════════════════════════════════════════════════

-- 1) تعدُّد الفنيين المسؤولين عن طلب الصيانة الواحد
alter table maintenance_requests
  add column if not exists assigned_to_ids uuid[] not null default '{}';

-- 2) متابعات متعددة لكل طلب صيانة (بدل حقل متابعة واحد)
create table if not exists maintenance_followups (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references maintenance_requests(id) on delete cascade,
  note text not null,
  created_by_id uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_maintenance_followups_request
  on maintenance_followups(request_id);
alter table maintenance_followups disable row level security;

-- 3) الصيانة الدورية — جدول المهام المتكررة
create table if not exists maintenance_periodic_tasks (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  title text not null,
  description text,
  interval_days int not null default 30,
  last_done_at date,
  next_due_at date not null default current_date,
  assigned_to_ids uuid[] not null default '{}',
  assigned_to_names text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table maintenance_periodic_tasks disable row level security;

-- 4) سجل تنفيذ الصيانة الدورية (كل مرة تُنفَّذ فيها المهمة)
create table if not exists maintenance_periodic_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references maintenance_periodic_tasks(id) on delete cascade,
  performed_at date not null default current_date,
  note text,
  performed_by_id uuid,
  performed_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_maintenance_periodic_logs_task
  on maintenance_periodic_logs(task_id);
alter table maintenance_periodic_logs disable row level security;
