-- ══════════════════════════════════════════════════════════════════════════════
--  السماح لمشرف الصالة (hall_supervisor) بإغلاق/فتح أيام الحجز — لفرعه فقط
-- ══════════════════════════════════════════════════════════════════════════════
--  كانت الكتابة على booking_closed_days مقصورة على مدير النظام فقط. الآن مشرف
--  الصالة يقدر كمان يغلق/يفتح يوم، لكن فقط لنفس الفرع الذي يعمل به (بنفس الفكرة
--  المستخدمة في باقي الصفحات: app_current_role() / app_current_branch_id()).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists booking_closed_days_admin_write on booking_closed_days;
create policy booking_closed_days_admin_write on booking_closed_days
  for all to authenticated
  using (
    app_is_super_admin()
    or (app_current_role() = 'hall_supervisor' and app_current_branch_id() = branch_id)
  )
  with check (
    app_is_super_admin()
    or (app_current_role() = 'hall_supervisor' and app_current_branch_id() = branch_id)
  );

notify pgrst, 'reload schema';
