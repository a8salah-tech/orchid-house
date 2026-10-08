-- ══════════════════════════════════════════════════════════════════════════════
--  إغلاق قسم معيّن للحجز في يوم معيّن (مثلًا "الصالة الداخلية فول" يوم كذا)
-- ══════════════════════════════════════════════════════════════════════════════
--  • جدول booking_closed_sections: (فرع + تاريخ + قسم). يُدار من نافذة "Closed Days / Sections"
--    في صفحة "حجوزات العملاء". القسم المغلق لا يظهر للعميل في صفحة /bookings، ويرفضه السيرفر أيضًا.
--  • قراءة عامة (الزائر المجهول يحتاج يعرف الأقسام المغلقة)، والكتابة لمدير النظام أو مشرف الصالة لفرعه
--    (نفس قاعدة booking_closed_days).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists booking_closed_sections (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  closed_date date not null,
  section text not null,
  note text,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (branch_id, closed_date, section)
);

create index if not exists booking_closed_sections_branch_date_idx
  on booking_closed_sections (branch_id, closed_date);

alter table booking_closed_sections enable row level security;

drop policy if exists booking_closed_sections_read on booking_closed_sections;
create policy booking_closed_sections_read on booking_closed_sections
  for select to anon, authenticated
  using (true);

drop policy if exists booking_closed_sections_write on booking_closed_sections;
create policy booking_closed_sections_write on booking_closed_sections
  for all to authenticated
  using (
    app_is_super_admin()
    or (app_current_role() = 'hall_supervisor' and app_current_branch_id() = branch_id)
  )
  with check (
    app_is_super_admin()
    or (app_current_role() = 'hall_supervisor' and app_current_branch_id() = branch_id)
  );

notify pgrst, 'reload schema';
