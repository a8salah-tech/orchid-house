-- ══════════════════════════════════════════════════════════════════════════════
--  حصة الإجازة الأسبوعية لكل موظف (يحدّدها مدير النظام)
-- ══════════════════════════════════════════════════════════════════════════════
--  • عمود employees.weekly_days_off: عدد أيام الإجازة المسموحة في الأسبوع (الأحد → السبت). الافتراضي يومان لكل الموظفين.
--  • يعدّله مدير النظام من نافذة تعديل الموظف في صفحة الموظفين.
--  • في إدارة الشيفتات لا يُسمح لمدير القسم/الفرع بحفظ جدول فيه إجازات أكثر من الحصة في أي أسبوع،
--    ومدير النظام يُنبَّه فقط ويقدر يتجاوز، وتظهر الحصة بجانب اسم الموظف وعدّاد لكل أسبوع داخل نافذة التعيين.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table employees
  add column if not exists weekly_days_off smallint not null default 2;

-- حدود منطقية (1 إلى 7)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_weekly_days_off_range') then
    alter table employees add constraint employees_weekly_days_off_range check (weekly_days_off between 1 and 7);
  end if;
end $$;

notify pgrst, 'reload schema';
