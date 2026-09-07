-- ══════════════════════════════════════════════════════════════════════════════
--  تصنيف العميل: عادي / ستاف / طالب / شركة سياحة
--  الأساس لميزة الخصومات بالأكواد (لكل تصنيف نسبة خصم خاصة، وصفحة تسجيل/كاشير لاحقًا).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table customers add column if not exists customer_type text not null default 'regular';

-- القيم المسموحة: عادي / ستاف / طالب / شركة سياحة
-- نُسقِط القيد القديم (لو موجود بثلاث قيم) ونعيد إنشاءه بالأربع قيم — إعادة التشغيل آمنة.
alter table customers drop constraint if exists customers_customer_type_check;
alter table customers add constraint customers_customer_type_check
  check (customer_type in ('regular', 'staff', 'student', 'tour_company'));

-- أي صف قديم قيمته NULL (نظريًا مش هيحصل بسبب default، بس احتياطًا)
update customers set customer_type = 'regular' where customer_type is null;

create index if not exists idx_customers_type on customers(customer_type) where customer_type <> 'regular';

notify pgrst, 'reload schema';
