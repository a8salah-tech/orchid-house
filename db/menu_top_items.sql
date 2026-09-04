-- ══════════════════════════════════════════════════════════════════════════════
--  الأكثر طلباً — أعلى الأصناف حسب الطلبات المدفوعة فعلياً (من صفحة الكاشير)
--  يُستخدم في صفحة menu/items. التشغيل: انسخ الملف في Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function app_menu_top_items(p_limit int default 10, p_days int default null)
returns table (menu_item_id uuid, times_ordered bigint, units bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select oi.menu_item_id,
         count(*)::bigint                       as times_ordered,   -- عدد مرات الطلب (أسطر الطلب)
         coalesce(sum(oi.quantity), 0)::bigint  as units            -- إجمالي الكمية المطلوبة
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.status = 'paid'
    and coalesce(oi.status, '') <> 'cancelled'
    and oi.menu_item_id is not null
    and (p_days is null or o.paid_at >= now() - make_interval(days => p_days))
  group by oi.menu_item_id
  order by units desc, times_ordered desc
  limit greatest(p_limit, 1);
$$;

grant execute on function app_menu_top_items(int, int) to authenticated;

notify pgrst, 'reload schema';
