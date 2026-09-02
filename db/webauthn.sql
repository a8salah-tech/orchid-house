-- ══════════════════════════════════════════════════════════════════════════════
--  بصمة اليد / بصمة الوجه لتسجيل الحضور (WebAuthn / Passkeys)
-- ══════════════════════════════════════════════════════════════════════════════
--
--  • webauthn_credentials : مفتاح عام لكل جهاز سجّله الموظف (المفتاح السري يبقى في الجهاز).
--  • webauthn_challenges   : تحدٍّ مؤقت بين طلب الخيارات والتحقق — السيرفر فقط.
--  • app_settings          : مفتاح تشغيل/إيقاف عام (biometric_checkin) — يبدأ false.
--
--  الكتابة على credentials/challenges تتم عبر مسار /api/webauthn بمفتاح service_role
--  (يتخطى RLS). العميل يقرأ أجهزته فقط، ويحذفها. مدير النظام/الموارد البشرية يحذف لأي حد.
--
--  يعتمد على دوال db/rls_stage_a.sql (app_current_employee_id / app_is_basic_employee /
--  app_is_super_admin / app_has_perm). التشغيل: انسخ الملف كله في Supabase SQL Editor → Run.
--  ملاحظة: بلا begin/commit عمداً — لفّ المحرّر لها في معاملة كان يفشل بصمت ويرجع rollback.
-- ══════════════════════════════════════════════════════════════════════════════

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

-- ── (2) التحديات المؤقتة (السيرفر فقط) ──
create table if not exists webauthn_challenges (
  employee_id  uuid primary key references employees(id) on delete cascade,
  challenge    text not null,
  kind         text not null,             -- 'register' | 'auth'
  expires_at   timestamptz not null
);

-- ── (3) إعدادات عامة + مفتاح تشغيل البصمة ──
create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);
insert into app_settings (key, value) values ('biometric_checkin', 'false'::jsonb)
  on conflict (key) do nothing;

-- ── (4) RLS ──
alter table webauthn_credentials enable row level security;
alter table webauthn_challenges  enable row level security;  -- بلا أي سياسة = مقفول عن العميل (service_role فقط)
alter table app_settings         enable row level security;

-- قراءة: الموظف يشوف أجهزته؛ الأدوار غير الأساسية تشوف الكل (للإدارة)
drop policy if exists wc_select on webauthn_credentials;
create policy wc_select on webauthn_credentials for select to authenticated
  using (employee_id = app_current_employee_id() or not app_is_basic_employee());

-- حذف: الأدمن فقط (مدير النظام / صلاحية hr) — الموظف لا يمكنه حذف بصمته بنفسه، يراجع الإدارة
drop policy if exists wc_delete on webauthn_credentials;
create policy wc_delete on webauthn_credentials for delete to authenticated
  using (app_is_super_admin() or app_has_perm('hr'));
-- لا سياسة insert/update للعميل — الكتابة عبر service_role فقط

drop policy if exists as_read  on app_settings;
create policy as_read  on app_settings for select to authenticated using (true);
drop policy if exists as_write on app_settings;
create policy as_write on app_settings for all to authenticated
  using (app_is_super_admin()) with check (app_is_super_admin());

-- ── (5) إجبار PostgREST على إعادة تحميل المخطط فوراً حتى ترى الجداول الجديدة ──
notify pgrst, 'reload schema';

-- ── (6) تحقق — لازم يرجّع 3 صفوف ──
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('webauthn_credentials','webauthn_challenges','app_settings')
order by table_name;

-- ══════════════════════════════════════════════════════════════════════════════
--  تفعيل البصمة لاحقًا (بعد ما الموظفون يسجّلوا أجهزتهم):
--    update app_settings set value='true'::jsonb, updated_at=now() where key='biometric_checkin';
--  الإيقاف الطارئ:
--    update app_settings set value='false'::jsonb where key='biometric_checkin';
-- ══════════════════════════════════════════════════════════════════════════════
