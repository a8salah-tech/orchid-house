-- ══════════════════════════════════════════════════════════════════════════════
--  سجل تعديلات الحجز — مين عدّل (بالاسم الكامل) وإيه اللي اتغيّر (من → إلى)
-- ══════════════════════════════════════════════════════════════════════════════
--  • كل حفظ لتعديل التاريخ/الوقت/عدد الأشخاص/القسم من نافذة تفاصيل الحجز في صفحة "حجوزات العملاء"
--    يضيف صفًّا هنا، ويظهر تحت "Edit history" في نفس النافذة.
--  • قراءة وإضافة لغير الأدوار الأساسية فقط (نفس قاعدة باقي جداول الإدارة)، ولا تعديل ولا حذف.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists booking_edit_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  edited_by uuid references employees(id) on delete set null,
  edited_by_name text,
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_edit_log_booking_idx
  on booking_edit_log (booking_id, created_at desc);

alter table booking_edit_log enable row level security;

drop policy if exists booking_edit_log_select on booking_edit_log;
create policy booking_edit_log_select on booking_edit_log
  for select to authenticated
  using (not app_is_basic_employee());

drop policy if exists booking_edit_log_insert on booking_edit_log;
create policy booking_edit_log_insert on booking_edit_log
  for insert to authenticated
  with check (not app_is_basic_employee());

notify pgrst, 'reload schema';
