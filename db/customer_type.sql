-- ══════════════════════════════════════════════════════════════════════════════
--  تصنيف العميل: عادي / طالب / شركة سياحة
--  الخطوة الأولى لميزة خصومات الطلاب وشركات السياحة (نسبة الخصم وصفحة التسجيل لاحقًا).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table customers add column if not exists customer_type text not null default 'regular';

-- نضمن إن القيم محصورة في الثلاثة المسموحين فقط
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'customers' and constraint_name = 'customers_customer_type_check'
  ) then
    alter table customers add constraint customers_customer_type_check
      check (customer_type in ('regular', 'student', 'tour_company'));
  end if;
end $$;

-- أي صف قديم قيمته NULL (نظريًا مش هيحصل بسبب default، بس احتياطًا)
update customers set customer_type = 'regular' where customer_type is null;

create index if not exists idx_customers_type on customers(customer_type) where customer_type <> 'regular';

notify pgrst, 'reload schema';
