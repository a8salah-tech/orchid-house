-- ══════════════════════════════════════════════════════════════════════════════
--  سجل محاولات الطلب من جهاز/عنوان محظور
-- ══════════════════════════════════════════════════════════════════════════════
--  كل مرة يحاول فيها جهاز أو IP محظور إرسال طلب من المنيو، يرفضه /api/submit-order ويسجّل هنا محاولة
--  (الوقت، الـIP، المتصفح، الطاولة). تظهر في "مراقبة الطلبات" أمام كل محظور: عدد المحاولات وآخرها.
--  الجدول مقفول: مدير النظام فقط يقرأ (السيرفر يكتب بمفتاح service-role).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists blocked_attempts (
  id uuid primary key default gen_random_uuid(),
  blocked_id uuid not null references blocked_clients(id) on delete cascade,
  ip_address text,
  user_agent text,
  table_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists blocked_attempts_blocked_idx on blocked_attempts (blocked_id, created_at desc);

alter table blocked_attempts enable row level security;

drop policy if exists blocked_attempts_super_admin on blocked_attempts;
create policy blocked_attempts_super_admin on blocked_attempts
  for all to authenticated
  using (app_is_super_admin())
  with check (app_is_super_admin());

notify pgrst, 'reload schema';
