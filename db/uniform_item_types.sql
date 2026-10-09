-- ══════════════════════════════════════════════════════════════════════════════
--  اليونيفورم: أصناف جديدة يضيفها مدير النظام / المشرف العام (مثلًا جاكيت بنوع مختلف)
-- ══════════════════════════════════════════════════════════════════════════════
--  • جدول uniform_item_types: الأصناف الإضافية (اسم عربي + اسم إنجليزي اختياري + صورة اختيارية).
--    تظهر مع الأصناف الثابتة في طلب اليونيفورم والمخزون والتقارير.
--  • القراءة لأي مستخدم مسجَّل (الموظفون يحتاجون الأسماء لطلبهم)، والإضافة/التعديل لمدير النظام والمشرف العام فقط.
--  • يُزال أي قيد CHECK قديم على عمود item_type في جدولَي أصناف الطلبات والمخزون (لو كان يحصر الأصناف في قائمة ثابتة)
--    حتى تُقبل مفاتيح الأصناف الجديدة.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists uniform_item_types (
  key text primary key,
  label_ar text not null,
  label_en text,
  image_url text,
  is_active boolean not null default true,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table uniform_item_types enable row level security;

drop policy if exists uniform_item_types_select on uniform_item_types;
create policy uniform_item_types_select on uniform_item_types
  for select to authenticated using (true);

drop policy if exists uniform_item_types_insert on uniform_item_types;
create policy uniform_item_types_insert on uniform_item_types
  for insert to authenticated
  with check (app_is_super_admin() or app_current_role() = 'general_supervisor');

drop policy if exists uniform_item_types_update on uniform_item_types;
create policy uniform_item_types_update on uniform_item_types
  for update to authenticated
  using (app_is_super_admin() or app_current_role() = 'general_supervisor')
  with check (app_is_super_admin() or app_current_role() = 'general_supervisor');

-- إزالة أي قيد CHECK يحصر item_type في قائمة ثابتة
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname from pg_constraint
    where conrelid in ('uniform_request_items'::regclass, 'uniform_stock_entries'::regclass)
      and contype = 'c' and pg_get_constraintdef(oid) ilike '%item_type%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

notify pgrst, 'reload schema';
