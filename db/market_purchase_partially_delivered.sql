-- ══════════════════════════════════════════════════════════════════════════════
--  السماح بحالة "تم التسليم جزئيًا" لطلبات مشتريات السوق
-- ══════════════════════════════════════════════════════════════════════════════
--  استلام طلب فيه صنف مُعلَّم "غير متاح" كان يحاول تسجيل الحالة partially_delivered، لكن قاعدة البيانات
--  ترفضها (قيد CHECK على عمود status لا يعرفها)، فيرجع الطلب كما كان. هذا الملف يستبدل القيد بقيد يقبلها.
--  الحالات المسموحة: pending, purchased, delivered, partially_delivered, rejected.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'market_purchase_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table market_purchase_requests drop constraint %I', c.conname);
  end loop;

  alter table market_purchase_requests
    add constraint market_purchase_requests_status_check
    check (status in ('pending', 'purchased', 'delivered', 'partially_delivered', 'rejected'));
end $$;

notify pgrst, 'reload schema';
