-- ══════════════════════════════════════════════════════════════════════════════
--  (1) الأكثر طلباً لكل فرع   (2) قسم الفطور: 05:00–10:00 بتوقيت ماليزيا في الفرعين
-- ══════════════════════════════════════════════════════════════════════════════
--  (1) كانت الدالة app_menu_top_items تحسب أعلى 10 أصناف على مستوى كل الفروع ثم تطابقها مع منيو الفرع المعروض؛ ولأن لكل فرع
--      منيو مستقل بمعرّفات أصناف مختلفة، فكان فرع KLCC يكاد لا يطابق شيئاً. الآن تأخذ معرّف الفرع وتحسب لصنف ذلك الفرع فقط.
--  (2) يضبط قسم «الفطور» في Orchid House: كل يوم من 05:00 إلى 10:00 (توقيت ماليزيا) بشارة «وقت الفطور»،
--      وينشئ قسم «الفطور» في Orchid KLCC بالضبط نفسه إن لم يكن موجوداً (القسم فارغ — أضف أصنافه من صفحة المنيو).
--      يمكن تعديل الأوقات لاحقاً من صفحة المنيو (زر ✎ على بطاقة القسم).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
--  ⚠️ شغّله **قبل** رفع النسخة (الصفحة تمرّر معامل الفرع للدالة).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── (1) الأكثر طلباً لكل فرع ──────────────────────────────────────────────────
drop function if exists app_menu_top_items(int, int);

create or replace function app_menu_top_items(p_limit int default 10, p_days int default null, p_branch uuid default null)
returns table (menu_item_id uuid, times_ordered bigint, units bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select oi.menu_item_id,
         count(*)::bigint                       as times_ordered,
         coalesce(sum(oi.quantity), 0)::bigint  as units
  from order_items oi
  join orders o on o.id = oi.order_id
  join menu_items mi on mi.id = oi.menu_item_id
  where o.status = 'paid'
    and coalesce(oi.status, '') <> 'cancelled'
    and oi.menu_item_id is not null
    and (p_branch is null or mi.branch_id = p_branch)
    and (p_days is null or o.paid_at >= now() - make_interval(days => p_days))
  group by oi.menu_item_id
  order by units desc, times_ordered desc
  limit greatest(p_limit, 1);
$$;
grant execute on function app_menu_top_items(int, int, uuid) to authenticated;

-- ── (2) قسم الفطور ───────────────────────────────────────────────────────────
-- Orchid House
update menu_categories
   set available_days = null, available_from = '05:00:00', available_to = '10:00:00',
       time_badge_ar = 'وقت الفطور', time_badge_en = 'Breakfast Time'
 where id = '9f29384f-e43f-47eb-8848-355f75c49356';

-- Orchid KLCC: ينشأ نفس القسم إن لم يوجد قسم فطور فيه
insert into menu_categories (name, name_en, name_ms, name_zh, name_ru, icon, sort_order, is_active, destination, branch_id,
                             available_days, available_from, available_to, time_badge_ar, time_badge_en)
select c.name, trim(c.name_en), c.name_ms, c.name_zh, c.name_ru, c.icon,
       (select coalesce(max(k.sort_order), -1) + 1 from menu_categories k where k.branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1' and k.is_active),
       true, c.destination, '9375998c-0a98-48c8-be7a-485e0c616ae1',
       null, '05:00:00', '10:00:00', 'وقت الفطور', 'Breakfast Time'
  from menu_categories c
 where c.id = '9f29384f-e43f-47eb-8848-355f75c49356'
   and not exists (
     select 1 from menu_categories k
      where k.branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1'
        and (k.name = c.name or lower(trim(coalesce(k.name_en, ''))) = 'breakfast')
   );

-- تحقق
do $$
begin
  if not exists (select 1 from menu_categories where id = '9f29384f-e43f-47eb-8848-355f75c49356' and available_from = '05:00:00' and available_to = '10:00:00') then
    raise exception 'FAIL: قسم الفطور في Orchid House لم يُضبط';
  end if;
  if not exists (select 1 from menu_categories where branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1' and lower(trim(coalesce(name_en, ''))) = 'breakfast') then
    raise exception 'FAIL: قسم الفطور في KLCC غير موجود';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
