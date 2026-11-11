-- ══════════════════════════════════════════════════════════════════════════════
--  فترات توقف الموظف (employment_breaks) + تسجيل رجوع Hussein Ali (ORK-39) في 13/10/2026
-- ══════════════════════════════════════════════════════════════════════════════
--  المشكلة: عند إيقاف موظف ثم إعادة تفعيله كان النظام يمسح تاريخ الإيقاف (deactivated_at) ولا يحتفظ بأي أثر للتوقف.
--  فبقي تاريخ تعيينه القديم (2025-01-06)، فاحتُسب راتب أكتوبر كاملًا (30/30) رغم أنه لم يعمل قبل 13/10،
--  وظهرت أيام غيابه في الحضور «يوم راحة».
--  الحل:
--    • جدول employment_breaks: كل فترة توقف (من تاريخ، وأول يوم عمل بعد العودة، وملاحظة).
--    • صفحة الموظفين تسجّلها عند الإيقاف / إعادة التفعيل (مع ملاحظة اختيارية).
--    • صفحة الرواتب تستثني أيام التوقف من أيام العمل وتكتب ملاحظة في الكشف.
--    • تقرير الحضور يعرض أيام التوقف «⏸ موقوف عن العمل» بدل «يوم راحة».
--  الصلاحيات: القراءة لأي موظف مسجَّل (يحتاجها تقرير الحضور)، والكتابة لمن يملك صلاحية HR فقط.
--  تسجيل Hussein: توقف من 2026-09-01 (اليوم التالي لآخر شيفت له 31/8 — عدّله إن كان لديك تاريخ أدق) وعاد 2026-10-13
--    (أول شيفت وأول بصمة له). المهم لراتب أكتوبر تاريخ العودة فقط.
--  بعد التشغيل: افتح الرواتب ← أكتوبر ليُعاد حساب كشفه تلقائيًا (19 يومًا بدل 30) ويُحفظ.
--  ⚠️ شغّل الملف **بعد** رفع نسخة الكود.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل؛ يتراجع كله عند أي اختلاف.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.employment_breaks (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  stopped_on  date not null,            -- أول يوم توقف فيه
  resumed_on  date,                     -- أول يوم عمل بعد العودة (null = ما زال موقوفًا)
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  constraint employment_breaks_order check (resumed_on is null or resumed_on > stopped_on)
);

create index if not exists employment_breaks_emp_idx on public.employment_breaks (employee_id, stopped_on);

alter table public.employment_breaks enable row level security;

drop policy if exists employment_breaks_select on public.employment_breaks;
create policy employment_breaks_select on public.employment_breaks
  for select to authenticated using (true);

drop policy if exists employment_breaks_insert on public.employment_breaks;
create policy employment_breaks_insert on public.employment_breaks
  for insert to authenticated with check ((select app_has_perm('hr')));

drop policy if exists employment_breaks_update on public.employment_breaks;
create policy employment_breaks_update on public.employment_breaks
  for update to authenticated using ((select app_has_perm('hr'))) with check ((select app_has_perm('hr')));

drop policy if exists employment_breaks_delete on public.employment_breaks;
create policy employment_breaks_delete on public.employment_breaks
  for delete to authenticated using ((select app_has_perm('hr')));

-- ── تسجيل رجوع Hussein (ORK-39) ──
do $$
declare
  c_emp constant uuid := '22f92a75-880e-4db0-a3ec-3f6eb3a3da07';
begin
  if not exists (select 1 from public.employees where id = c_emp and employee_number = 'ORK-39') then
    raise exception 'FAIL: الموظف ORK-39 غير موجود';
  end if;
  if not exists (select 1 from public.employment_breaks where employee_id = c_emp and resumed_on = '2026-10-13') then
    insert into public.employment_breaks (employee_id, stopped_on, resumed_on, note)
    values (c_emp, '2026-09-01', '2026-10-13', 'توقف عن العمل ثم عاد في 13/10/2026 — لا راتب عن أيام التوقف / Stopped, then returned on 13 Oct 2026 — no pay for the break');
  end if;
end $$;

-- ── بوابة التحقق ──
do $$
declare bad text := '';
begin
  if to_regclass('public.employment_breaks') is null then bad := bad || 'الجدول؛ '; end if;
  if not exists (select 1 from pg_class where relname = 'employment_breaks' and relrowsecurity) then bad := bad || 'RLS؛ '; end if;
  if (select count(*) from pg_policies where tablename = 'employment_breaks') <> 4 then bad := bad || 'السياسات؛ '; end if;
  if not exists (select 1 from public.employment_breaks where employee_id = '22f92a75-880e-4db0-a3ec-3f6eb3a3da07' and resumed_on = '2026-10-13') then bad := bad || 'تسجيل Hussein؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
end $$;

commit;
