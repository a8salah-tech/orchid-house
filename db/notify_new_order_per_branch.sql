-- ══════════════════════════════════════════════════════════════════════════════
--  إشعار "طلب جديد" لكل فرع بشكل منفصل (جرس الإشعارات)
-- ══════════════════════════════════════════════════════════════════════════════
--  المشكلة: دالة notify_new_order القديمة كانت تكتب الإشعار "بالدور" (cashier / kitchen_manager / kitchen_supervisor) فيصل كل من يحمل
--  الدور في الفرعين معًا، ولا يحمل الإشعار رقم الفرع، وأسماء الطاولات تتكرر بين الفرعين (Table 30 و31 موجودتان في كليهما).
--  الحل: نرسل الإشعار لكل موظف نشط **في فرع الطاولة فقط** (target_employee_id):
--    • المطبخ: مدير المطبخ ومشرف المطبخ (رابط /dashboard/kitchen) — كما كان لكن لفرع الطاولة فقط.
--    • الكاشير: الكاشير + مساعد الكاشير + مدير الكاشير (رابط /dashboard/cashier) — مساعد الكاشير ومدير الكاشير لم يكونا يصلهما شيء سابقًا.
--  لو الطاولة بلا فرع (نادر) نرجع للسلوك القديم بالدور.
--  نفس الشرط السابق: الطلب confirmed وهذا أول صنف فيه (إشعار واحد لكل طلب). التريغر الحالي يبقى كما هو (نستبدل الدالة فقط).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_table_name text;
  v_order_status text;
  v_table_id uuid;
  v_branch uuid;
begin
  select status, table_id into v_order_status, v_table_id from orders where id = new.order_id;

  if v_order_status = 'confirmed' then
    -- أول صنف في الطلب فقط (عشان الإشعار يجي مرة واحدة)
    if (select count(*) from order_items where order_id = new.order_id) = 1 then
      select coalesce(name, 'Table ' || number::text), branch_id
        into v_table_name, v_branch
        from tables where id = v_table_id;

      if v_branch is not null then
        insert into notifications (type, title, body, link, target_role, target_employee_id)
        select 'order', '🍽️ طلب جديد', 'طلب جديد من ' || v_table_name,
               case when e.role in ('kitchen_supervisor', 'kitchen_manager') then '/dashboard/kitchen' else '/dashboard/cashier' end,
               null, e.id
          from employees e
         where e.is_active = true
           and e.branch_id = v_branch
           and e.role in ('kitchen_supervisor', 'kitchen_manager', 'cashier', 'assistant_cashier', 'cashier_manager');
      else
        -- طاولة بلا فرع: السلوك القديم بالدور
        insert into notifications (type, title, body, link, target_role)
        values ('order', '🍽️ طلب جديد', 'طلب جديد من ' || v_table_name, '/dashboard/kitchen', 'kitchen_supervisor');
        insert into notifications (type, title, body, link, target_role)
        values ('order', '🍽️ طلب جديد', 'طلب جديد من ' || v_table_name, '/dashboard/kitchen', 'kitchen_manager');
        insert into notifications (type, title, body, link, target_role)
        values ('order', '🍽️ طلب جديد', 'طلب جديد من ' || v_table_name, '/dashboard/cashier', 'cashier');
      end if;
    end if;
  end if;
  return new;
end;
$function$;

notify pgrst, 'reload schema';
