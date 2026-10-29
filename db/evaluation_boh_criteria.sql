-- ══════════════════════════════════════════════════════════════════════════════
--  معايير تقييم خاصة بأقسام المطبخ والبار والحلويات والنظافة (لا يتعاملون مع العملاء مباشرة)
-- ══════════════════════════════════════════════════════════════════════════════
--  هؤلاء الموظفون يُستبدل لهم معيار «التعامل مع العملاء» (15%) بأربعة معايير:
--    recipe_standards  الالتزام بالوصفات ومعايير الجودة والتقديم   5%
--    prep_speed        السرعة والالتزام بأوقات التحضير             4%
--    waste_control     تقليل الهدر وحسن استخدام المواد            3%
--    workstation       تنظيف وتنظيم مكان العمل                    3%
--  باقي الأقسام (الصالة والكاشير والإدارة) تبقى بمعاييرها كما هي.
--  التقييمات المعتمدة السابقة لا تتغير (تبقى بمعاييرها القديمة).
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل.
--  شغّله قبل رفع النسخة الجديدة: حفظ تقييم موظف مطبخ/بار قبل تشغيله يفشل لعدم وجود الأعمدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.employee_evaluations
  add column if not exists recipe_standards smallint not null default 0,
  add column if not exists prep_speed       smallint not null default 0,
  add column if not exists waste_control    smallint not null default 0,
  add column if not exists workstation      smallint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employee_evaluations_boh_scores_range') then
    alter table public.employee_evaluations
      add constraint employee_evaluations_boh_scores_range check (
        recipe_standards between 0 and 10 and prep_speed between 0 and 10
        and waste_control between 0 and 10 and workstation between 0 and 10
      );
  end if;
end $$;

-- ── بوابة التحقق ──
do $$
declare missing text;
begin
  select string_agg(c, '، ') into missing
  from unnest(array['recipe_standards', 'prep_speed', 'waste_control', 'workstation']) as c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employee_evaluations' and column_name = c
  );
  if missing is not null then raise exception 'FAIL: أعمدة ناقصة: %', missing; end if;
end $$;

commit;

notify pgrst, 'reload schema';
