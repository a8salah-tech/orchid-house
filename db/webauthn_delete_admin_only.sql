-- ══════════════════════════════════════════════════════════════════════════════
--  البصمة: الحذف للأدمن فقط
--  الموظف كان يقدر يحذف أجهزته بنفسه — دلوقتي لأ. يراجع الإدارة لإزالة/تغيير جهاز.
--  التشغيل: انسخه في Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists wc_delete on webauthn_credentials;
create policy wc_delete on webauthn_credentials for delete to authenticated
  using (app_is_super_admin() or app_has_perm('hr'));

notify pgrst, 'reload schema';
