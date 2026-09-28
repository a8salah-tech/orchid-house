-- ══════════════════════════════════════════════════════════════════════════════
--  إغلاق يوم حجز لفرع معيّن (Admin فقط)
-- ══════════════════════════════════════════════════════════════════════════════
--  • جدول جديد booking_closed_days: يسجّل الأيام المُغلقة للحجز في كل فرع (مثلاً
--    يوم مناسبة خاصة أو صيانة)، يُدار من صفحة "حجوزات العملاء" في لوحة التحكم.
--  • قراءة عامة (الزائر المجهول في صفحة /bookings يحتاج يعرف الأيام المغلقة قبل
--    الإرسال)، وكتابة (إغلاق/فتح) لمدير النظام فقط — وليس أي دور كاشير آخر.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists booking_closed_days (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  closed_date date not null,
  note text,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (branch_id, closed_date)
);

create index if not exists booking_closed_days_branch_date_idx
  on booking_closed_days (branch_id, closed_date);

alter table booking_closed_days enable row level security;

drop policy if exists booking_closed_days_read on booking_closed_days;
create policy booking_closed_days_read on booking_closed_days
  for select to anon, authenticated
  using (true);

drop policy if exists booking_closed_days_admin_write on booking_closed_days;
create policy booking_closed_days_admin_write on booking_closed_days
  for all to authenticated
  using (app_is_super_admin())
  with check (app_is_super_admin());

notify pgrst, 'reload schema';
