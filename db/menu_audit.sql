-- ══════════════════════════════════════════════════════════════════════════════
--  سجل التدقيق لجدولَي الأصناف وأحجامها — من عدّل الصنف (الاسم/الوصف/السعر/الرقم…) ومتى وماذا تغيّر
-- ══════════════════════════════════════════════════════════════════════════════
--  يعتمد على db/audit_log.sql (الجدول audit_log ودالة app_audit_trigger) المشغَّل مسبقًا.
--  يضيف trigger على: menu_items و menu_item_sizes.
--  • يظهر السجل داخل نافذة الصنف نفسه (تبويب «سجل التعديلات») لمدير النظام.
--  • تعديلات ملفات SQL التي تشغّلها من Supabase تُسجَّل باسم "⚙️ system".
--  • التسجيل يبدأ من لحظة تشغيل هذا الملف (لا يوجد سجل قديم للأصناف).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
--  الأفضل تشغيله قبل db/menu_descriptions_fix_2.sql ليظهر تصحيح الأوصاف في السجل.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_audit_trigger') then
    raise exception 'شغّل db/audit_log.sql أولًا (دالة app_audit_trigger غير موجودة)';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['menu_items', 'menu_item_sizes'] loop
    execute format('drop trigger if exists zz_audit on public.%I', t);
    execute format(
      'create trigger zz_audit after insert or update or delete on public.%I
       for each row execute function app_audit_trigger()', t);
  end loop;
end $$;

-- فهرس لسرعة جلب سجل صنف واحد من نافذة الصنف
create index if not exists idx_audit_new_menu_item
  on audit_log ((new_row ->> 'menu_item_id')) where table_name = 'menu_item_sizes';
create index if not exists idx_audit_old_menu_item
  on audit_log ((old_row ->> 'menu_item_id')) where table_name = 'menu_item_sizes';

commit;

notify pgrst, 'reload schema';
