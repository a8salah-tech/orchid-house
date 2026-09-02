-- ══════════════════════════════════════════════════════════════════════════════
--  بصمة اليد / بصمة الوجه لتسجيل الحضور (WebAuthn / Passkeys)
-- ══════════════════════════════════════════════════════════════════════════════
--
--  • webauthn_credentials : مفتاح عام لكل جهاز سجّله الموظف (المفتاح السري يبقى في الجهاز).
--  • webauthn_challenges   : تحدٍّ مؤقت بين طلب الخيارات والتحقق — السيرفر فقط.
--  • app_settings          : مفتاح تشغيل/إيقاف عام (biometric_checkin) — يبدأ false.
--
--  الكتابة على credentials/challenges تتم عبر مسار /api/webauthn بمفتاح service_role
--  (يتخطى RLS). العميل يقرأ أجهزته فقط، ويحذفها. مدير النظام/الموارد البشرية يحذف لأي حد
--  (إعادة تعيين عند فقدان الموبايل).
--
--  يعتمد على دوال db/rls_stage_a.sql. التشغيل: انسخ الملف كله في Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── (1) بيانات اعتماد البصمة ──
create table if not exists webauthn_credentials (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references employees(id) on delete cascade,
  credential_id  text not null unique,      -- base64url
  public_key     text not null,             -- base64
  counter        bigint not null default 0,
  transports     text[],
  device_label   text,
  created_at     timestamptz default now(),
  last_used_at   timestamptz
);
create index if not exists idx_webauthn_cred_emp on webauthn_credentials(employee_id);

alter table webauthn_credentials enable row level security;
drop policy if exists wc_all    on webauthn_credentials;
drop policy if exists wc_select on webauthn_credentials;
drop policy if exists wc_delete on webauthn_credentials;

-- قراءة: الموظف يشوف أجهزته؛ الأدوار غير الأساسية تشوف الكل (للإدارة)
create policy wc_select on webauthn_credentials for select to authenticated
  using (employee_id = app_current_employee_id() or not app_is_basic_employee());
-- حذف: الموظف لأجهزته؛ مدير النظام / صلاحية hr لأي حد (إعادة تعيين)
create policy wc_delete on webauthn_credentials for delete to authenticated
  using (employee_id = app_current_employee_id() or app_is_super_admin() or app_has_perm('hr'));
-- لا سياسة insert/update للعميل — الكتابة عبر service_role فقط

-- ── (2) التحديات المؤقتة (السيرفر فقط) ──
create table if not exists webauthn_challenges (
  employee_id  uuid primary key references employees(id) on delete cascade,
  challenge    text not null,
  kind         text not null,             -- 'register' | 'auth'
  expires_at   timestamptz not null
);
alter table webauthn_challenges enable row level security;
-- RLS مفعّل بلا أي سياسة = مقفول تمامًا عن العميل (service_role فقط)

-- ── (3) إعدادات عامة + مفتاح تشغيل البصمة ──
create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);
insert into app_settings (key, value) values ('biometric_checkin', 'false'::jsonb)
  on conflict (key) do nothing;

alter table app_settings enable row level security;
drop policy if exists as_read  on app_settings;
drop policy if exists as_write on app_settings;
create policy as_read  on app_settings for select to authenticated using (true);
create policy as_write on app_settings for all to authenticated
  using (app_is_super_admin()) with check (app_is_super_admin());

-- ── (4) بوابة تحقق ──
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='app_current_employee_id') then
    raise exception 'FAIL: app_current_employee_id() مفقودة — شغّل db/rls_stage_a.sql أولاً';
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='webauthn_credentials') then
    raise exception 'FAIL: webauthn_credentials لم يُنشأ';
  end if;
  if not exists (select 1 from app_settings where key='biometric_checkin') then
    raise exception 'FAIL: مفتاح biometric_checkin مفقود';
  end if;
  raise notice 'ALL CHECKS PASSED';
end $$;

commit;

-- ✅ إجبار PostgREST على إعادة تحميل مخطط قاعدة البيانات فوراً حتى ترى الجداول الجديدة
-- (بدون هذا قد يفشل /api/webauthn برسالة "انتهت صلاحية الطلب" لأن الجدول غير مرئي للـ API)
notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════
--  تفعيل البصمة لاحقًا (بعد ما الموظفون يسجّلوا أجهزتهم):
--    update app_settings set value='true'::jsonb, updated_at=now() where key='biometric_checkin';
--  الإيقاف الطارئ:
--    update app_settings set value='false'::jsonb where key='biometric_checkin';
-- ══════════════════════════════════════════════════════════════════════════════
