-- ══════════════════════════════════════════════════════════════════════════════
--  السماح لمساعد مدير الصالة (hall_assistant_manager) بإغلاق/فتح أيام وأقسام الحجز — لفرعه فقط
-- ══════════════════════════════════════════════════════════════════════════════
--  نفس صلاحية مشرف الصالة بالضبط (مدير النظام + مشرف الصالة + مساعد مدير الصالة، كلٌّ لفرعه).
--  يشمل الجدولين: booking_closed_days (🔒 الأيام) و booking_closed_sections (الأقسام).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists booking_closed_days_admin_write on booking_closed_days;
create policy booking_closed_days_admin_write on booking_closed_days
  for all to authenticated
  using (
    app_is_super_admin()
    or (app_current_role() in ('hall_supervisor', 'hall_assistant_manager') and app_current_branch_id() = branch_id)
  )
  with check (
    app_is_super_admin()
    or (app_current_role() in ('hall_supervisor', 'hall_assistant_manager') and app_current_branch_id() = branch_id)
  );

drop policy if exists booking_closed_sections_write on booking_closed_sections;
create policy booking_closed_sections_write on booking_closed_sections
  for all to authenticated
  using (
    app_is_super_admin()
    or (app_current_role() in ('hall_supervisor', 'hall_assistant_manager') and app_current_branch_id() = branch_id)
  )
  with check (
    app_is_super_admin()
    or (app_current_role() in ('hall_supervisor', 'hall_assistant_manager') and app_current_branch_id() = branch_id)
  );

commit;

notify pgrst, 'reload schema';
