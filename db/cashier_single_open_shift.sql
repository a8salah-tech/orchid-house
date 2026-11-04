-- ══════════════════════════════════════════════════════════════════════════════
--  كاشير واحد فقط ممسك بالشيفت في كل فرع (جلسة مفتوحة واحدة لكل فرع)
-- ══════════════════════════════════════════════════════════════════════════════
--  المشكلة: كان ممكنًا أن يمسك أكثر من كاشير شيفتًا مفتوحًا في الفرع نفسه (شيفتات مختلفة، أو جلسات منسية).
--  الحل في الواجهة: لا يبدأ كاشير جديد قبل أن يُغلق الحالي شيفته، ويرى الجميع من يمسكه.
--  هذا الملف يضيف الضمان الأخير في قاعدة البيانات (لو بدأ كاشيران في اللحظة نفسها يرفض الثاني):
--    1) يُغلق أي جلسات مفتوحة زائدة داخل الفرع الواحد ويُبقي الأحدث فقط
--       (تُغلق عند وقت بدايتها هي نفسها، فلا تظهر في أي تقرير ولا تغيّر أرقامه).
--    2) يُنشئ فهرسًا فريدًا جزئيًا: جلسة واحدة فقط ended_at فاضي لكل فرع.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل.
--  شغّله قبل رفع النسخة الجديدة أو بعدها مباشرة؛ الواجهة تعمل بدونه لكن بلا ضمان قاعدة البيانات.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- 1) أغلق الجلسات المفتوحة الزائدة: أبقِ أحدث جلسة مفتوحة لكل فرع وأغلق ما عداها عند وقت بدايتها
with ranked as (
  select id, started_at,
         row_number() over (partition by coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) order by started_at desc) as rn
  from public.cashier_shift_sessions
  where ended_at is null
)
update public.cashier_shift_sessions s
   set ended_at = r.started_at
  from ranked r
 where s.id = r.id and r.rn > 1;

-- 2) جلسة مفتوحة واحدة فقط لكل فرع
create unique index if not exists cashier_shift_sessions_one_open_per_branch
  on public.cashier_shift_sessions ((coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  where ended_at is null;

-- ── بوابة التحقق ──
do $$
begin
  if exists (
    select 1 from public.cashier_shift_sessions where ended_at is null
    group by coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) having count(*) > 1
  ) then raise exception 'FAIL: ما زال هناك أكثر من جلسة مفتوحة في فرع واحد'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'cashier_shift_sessions_one_open_per_branch') then
    raise exception 'FAIL: الفهرس لم يُنشأ';
  end if;
end $$;

commit;
