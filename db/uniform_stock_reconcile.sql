-- ══════════════════════════════════════════════════════════════════════════════
--  تسوية مخزون اليونيفورم: خصم التسليمات التي تمت بعد إضافة المخزون وقبل تفعيل الخصم التلقائي
-- ══════════════════════════════════════════════════════════════════════════════
--  • لكل طلب مُسلَّم تاريخ تسليمه بعد أول إضافة مخزون لنفس الصنف والمقاس في فرع الموظف، ولم يُخصم بعد:
--    يُضاف سطر خصم سالب (بتاريخ التسليم الفعلي ومرتبط بالطلب) في uniform_stock_entries.
--  • يعتمد على db/uniform_stock_deduct.sql (عمود request_id) — يجب تشغيله قبله (شُغّل سابقًا).
--  • آمن لإعادة التشغيل: لا يضيف خصمًا لطلب له خصم موجود أصلًا (ولا يتكرر بفضل الفهرس الفريد).
--  • وقت الفحص (11 أكتوبر 2026) كان المطلوب خصمه 9 قطع: جاكيت أسود S×2 وM×5 وL×1، ومريول M×1 — كلها في أوركيد هاوس.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════════════════════

insert into uniform_stock_entries (item_type, size, quantity, branch_id, request_id, added_by, created_at)
select i.item_type,
       i.size,
       -sum(i.quantity),
       e.branch_id,
       r.id,
       r.delivered_by,
       r.delivered_at
  from uniform_request_items i
  join uniform_requests r on r.id = i.request_id and r.status = 'delivered'
  join employees e on e.id = r.employee_id
 where e.branch_id is not null
   and r.delivered_at is not null
   and r.delivered_at >= (
         select min(s.created_at)
           from uniform_stock_entries s
          where s.item_type = i.item_type and s.size = i.size
            and s.branch_id = e.branch_id and s.quantity > 0
       )
   and not exists (
         select 1 from uniform_stock_entries d
          where d.request_id = r.id and d.item_type = i.item_type and d.size = i.size
       )
 group by i.item_type, i.size, e.branch_id, r.id, r.delivered_by, r.delivered_at;
