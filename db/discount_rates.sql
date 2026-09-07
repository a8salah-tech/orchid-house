-- ══════════════════════════════════════════════════════════════════════════════
--  نسب الخصم حسب تصنيف العميل (ثابتة) + استثناء اختياري لكل عميل
--
--  • discount_rates: صف واحد لكل تصنيف، فيه النسبة الثابتة (٪).
--  • customers.discount_percent: نسبة خاصة لعميل بعينه — لو مُدخَلة تغلب نسبة التصنيف،
--    لو NULL يُطبَّق معدّل التصنيف.
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
--  يعتمد على app_is_super_admin() / app_has_perm() من db/rls_stage_a.sql.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists discount_rates (
  customer_type text primary key
    check (customer_type in ('regular','staff','student','tour_company','government','private')),
  percent numeric(5,2) not null default 0 check (percent >= 0 and percent <= 100),
  updated_at timestamptz not null default now()
);

-- تهيئة الصفوف الستة بنسبة 0 (تُعدَّل من لوحة صفحة العملاء)
insert into discount_rates (customer_type, percent) values
  ('regular', 0), ('staff', 0), ('student', 0),
  ('tour_company', 0), ('government', 0), ('private', 0)
on conflict (customer_type) do nothing;

-- استثناء لكل عميل — NULL = استخدم معدّل التصنيف
alter table customers add column if not exists discount_percent numeric(5,2)
  check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

-- ── RLS ──
alter table discount_rates enable row level security;

drop policy if exists discount_rates_sel on discount_rates;
create policy discount_rates_sel on discount_rates for select to authenticated
  using (
    app_is_super_admin()
    or app_has_perm('customers') or app_has_perm('loyalty') or app_has_perm('sales')
  );

drop policy if exists discount_rates_write on discount_rates;
create policy discount_rates_write on discount_rates for all to authenticated
  using (app_is_super_admin() or app_has_perm('customers'))
  with check (app_is_super_admin() or app_has_perm('customers'));

notify pgrst, 'reload schema';
