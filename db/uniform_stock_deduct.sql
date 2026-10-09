-- ══════════════════════════════════════════════════════════════════════════════
--  اليونيفورم: خصم الكمية من مخزون الفرع عند "تم التسليم"
-- ══════════════════════════════════════════════════════════════════════════════
--  • كل تسليم طلب يسجّل في uniform_stock_entries سطر خصم بكمية سالبة لكل صنف/مقاس، لفرع الموظف،
--    ومرتبطًا بالطلب عبر العمود الجديد request_id.
--  • يُزال أي قيد CHECK قديم على الكمية (لو كان يمنع السالب)، ويُستبدل بقيد "لا تساوي صفرًا".
--  • فهرس فريد (request_id, item_type, size) يمنع خصم نفس الطلب مرتين على مستوى قاعدة البيانات.
--  • حذف طلب (مدير النظام) يحذف أسطر خصمه تلقائيًا، فترجع الكمية للمخزون.
--  • التسليمات القديمة (قبل هذا التحديث) لا تُخصم بأثر رجعي، والتسجيلات بأثر رجعي من تبويب "آخر استلام" لا تخصم.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table uniform_stock_entries
  add column if not exists request_id uuid references uniform_requests(id) on delete cascade;

-- إزالة أي قيد CHECK على quantity يمنع القيم السالبة
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'uniform_stock_entries'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%quantity%'
  loop
    execute format('alter table uniform_stock_entries drop constraint %I', c.conname);
  end loop;
end $$;

alter table uniform_stock_entries
  add constraint uniform_stock_entries_quantity_nonzero check (quantity <> 0);

create unique index if not exists uniform_stock_entries_request_item_key
  on uniform_stock_entries (request_id, item_type, size) where request_id is not null;

notify pgrst, 'reload schema';
