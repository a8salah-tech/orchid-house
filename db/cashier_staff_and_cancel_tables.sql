-- ══════════════════════════════════════════════════════════════════════════════
--  طاولة الموظفين (خصم تلقائي 30% + بدون رسم خدمة) + طاولة "Cancellation" (تجميع طلبات
--  الإلغاء المعلَّقة بانتظار اعتماد مدير النظام/المشرف العام) — واحدة من كل نوع لكل فرع نشط
-- ══════════════════════════════════════════════════════════════════════════════
--  • tables.section = 'staff'      → الكاشير يستثنيها من رسم الخدمة ويفرض خصم 30% ثابت.
--  • tables.section = 'cancel_hub' → الوجهة التي يُنقَل إليها أي طلب عند بدء إلغائه من أي كاشير.
--    الطلب يبقى نشطاً (غير ملغى فعلياً) حتى يعتمد مدير النظام الإلغاء، أو يبقى نشطاً على
--    هذه الطاولة نفسها لو رفضه (كما طلب صاحب النظام صراحة).
--  • أعمدة جديدة على orders لتتبع من طلب الإلغاء، من أي طاولة، ومن اعتمده لاحقاً.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table orders add column if not exists cancel_requested_by_name text;
alter table orders add column if not exists cancel_requested_at timestamptz;
alter table orders add column if not exists cancel_from_table_name text;
alter table orders add column if not exists cancel_approved_by_name text;
alter table orders add column if not exists cancel_approved_at timestamptz;

do $$
declare
  b record;
  v_next int;
begin
  for b in select id from branches where is_active = true loop
    if not exists (select 1 from tables where branch_id = b.id and section = 'staff') then
      select coalesce(max(number), 0) + 1 into v_next from tables where branch_id = b.id;
      insert into tables (number, name, is_active, status, section, branch_id)
      values (v_next, 'Staff', true, 'available', 'staff', b.id);
    end if;

    if not exists (select 1 from tables where branch_id = b.id and section = 'cancel_hub') then
      select coalesce(max(number), 0) + 1 into v_next from tables where branch_id = b.id;
      insert into tables (number, name, is_active, status, section, branch_id)
      values (v_next, 'Cancellation', true, 'available', 'cancel_hub', b.id);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
