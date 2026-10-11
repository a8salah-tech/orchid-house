-- ══════════════════════════════════════════════════════════════════════════════
--  الطاولة التي يُسنَد إليها طلب تُفتح تلقائيًا (إصلاح: طاولة النقل كانت تبقى "مقفلة" وعليها طلب)
-- ══════════════════════════════════════════════════════════════════════════════
--  • تريغر: أي طاولة يصير لها طلب (current_order_id غير فارغ) ولم تُفتح بعد (opened_at فارغ) تُفتح لحظتها.
--    يغطي كل المسارات: نقل الطلب، نقل أصناف، إضافة طلب من الكاشير، أو أي مسار آخر.
--  • القفل التلقائي عند تحرير الطاولة (دفع/إلغاء/نقل) باقٍ كما هو (db/table_lock.sql).
--  • تصحيح فوري: الطاولات التي عليها طلب حاليًا وما زالت مقفلة تُفتح الآن.
--  يعتمد على db/table_lock.sql (عمود opened_at) — شُغّل سابقًا.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function tables_open_on_assign()
returns trigger language plpgsql as $$
begin
  if new.current_order_id is not null and new.opened_at is null then
    new.opened_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists tables_open_on_assign on tables;
create trigger tables_open_on_assign
  before insert or update on tables
  for each row execute function tables_open_on_assign();

-- تصحيح الطاولات الحالية: عليها طلب وما زالت مقفلة
update tables set opened_at = now() where current_order_id is not null and opened_at is null;

notify pgrst, 'reload schema';
