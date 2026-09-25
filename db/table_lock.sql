-- ══════════════════════════════════════════════════════════════════════════════
--  قفل الطاولات الفارغة: لا يطلب العميل من المنيو إلا بعد أن يفتح الكاشير/المساعد الطاولة
-- ══════════════════════════════════════════════════════════════════════════════
--  • tables.opened_at: وقت فتح الطاولة (NULL = مقفلة). الكاشير يفتحها بالضغط على الطاولة الفارغة + تأكيد.
--  • عند تحرير الطاولة (دفع/إلغاء/نقل: current_order_id يتحول من قيمة إلى NULL) تُقفل تلقائياً بتريغر، فتغطي كل المسارات.
--  • الطاولات المشغولة الآن (لها طلب) تُفتح تلقائياً عند التشغيل، فلا ينقطع أي زبون جالس.
--  • القفل لطاولات الصالة فقط (indoor/upstairs/outdoor)، لا takeaway ولا staff ولا cancel_hub (تُستثنى في الكود).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table tables add column if not exists opened_at timestamptz;

-- الطاولات المشغولة حالياً = مفتوحة
update tables set opened_at = now() where current_order_id is not null and opened_at is null;

create or replace function tables_relock_on_free()
returns trigger language plpgsql as $$
begin
  if old.current_order_id is not null and new.current_order_id is null then
    new.opened_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tables_relock_on_free on tables;
create trigger tables_relock_on_free
  before update on tables
  for each row execute function tables_relock_on_free();

notify pgrst, 'reload schema';
