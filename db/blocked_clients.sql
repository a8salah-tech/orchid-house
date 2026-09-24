-- ══════════════════════════════════════════════════════════════════════════════
--  حظر أجهزة العملاء (وعناوين IP اختيارياً) من إرسال طلبات المنيو
-- ══════════════════════════════════════════════════════════════════════════════
--  • كل جهاز عميل يحصل على رمز عشوائي ثابت في متصفحه (device_id) يُرسل مع كل طلب ويُحفظ في order_client_meta.
--  • مدير النظام (من صفحة "مراقبة الطلبات") يقدر يحظر رمز الجهاز (دائم) أو الـIP (مؤقت عادة).
--  • مسار /api/submit-order يرفض أي طلب من جهاز/IP محظور. المحظور يفضل يتصفح المنيو عادي.
--  • الجدول مقفول: مدير النظام فقط يقرأ ويكتب (السيرفر يستخدم service-role).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table order_client_meta add column if not exists device_id text;

create table if not exists blocked_clients (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('device', 'ip')),
  value text not null,
  reason text,
  expires_at timestamptz,
  blocked_by_name text,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

create index if not exists blocked_clients_lookup_idx on blocked_clients (kind, value);

alter table blocked_clients enable row level security;

drop policy if exists blocked_clients_super_admin on blocked_clients;
create policy blocked_clients_super_admin on blocked_clients
  for all to authenticated
  using (app_is_super_admin())
  with check (app_is_super_admin());

notify pgrst, 'reload schema';
