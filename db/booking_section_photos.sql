-- ══════════════════════════════════════════════════════════════════════════════
--  صور توضيحية لكل قسم في صفحة الحجز (Indoor / Outdoor / Upstairs لكل فرع)
-- ══════════════════════════════════════════════════════════════════════════════
--  • جدول جديد booking_section_photos: صورة واحدة لكل (فرع + قسم)، تُدار من
--    صفحة "🏪 صور الفروع" في لوحة التحكم، وتظهر للعميل تحت كل قسم في صفحة الحجز.
--  • قراءة عامة (الزائر المجهول يفتح صفحة /bookings بلا تسجيل دخول)، وكتابة لمدير
--    النظام فقط (نفس صلاحية صفحة صور الفروع).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists booking_section_photos (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  section text not null check (section in ('outdoor', 'indoor', 'upstairs')),
  image_url text,
  updated_at timestamptz not null default now(),
  unique (branch_id, section)
);

alter table booking_section_photos enable row level security;

drop policy if exists booking_section_photos_read on booking_section_photos;
create policy booking_section_photos_read on booking_section_photos
  for select to anon, authenticated
  using (true);

drop policy if exists booking_section_photos_admin_write on booking_section_photos;
create policy booking_section_photos_admin_write on booking_section_photos
  for all to authenticated
  using (app_is_super_admin())
  with check (app_is_super_admin());

notify pgrst, 'reload schema';
