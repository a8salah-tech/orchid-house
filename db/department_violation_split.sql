-- ══════════════════════════════════════════════════════════════════════════════
--  مخالفة القسم: مبلغ إجمالي يُقسَّم بالتساوي على كل موظفي القسم في الفرع بعد اعتماد مدير القسم
-- ══════════════════════════════════════════════════════════════════════════════
--  • department_violations: أعمدة جديدة — المبلغ الإجمالي، الفرع، الحالة (pending/active/rejected/cancelled)، من اعتمد ومتى،
--    وعدد الموظفين الذين وُزّعت عليهم الحصص. المخالفات القديمة تبقى كما هي (حالة active بلا مبلغ = تقرير فقط، بلا حصص).
--  • violations.dept_violation_id: يربط كل حصة موظف بمخالفة القسم الأم (لإلغاء الحصص معًا عند إلغاء المخالفة).
--  • سياسة تعديل لغير الأدوار الأساسية (مدراء/مشرفون) حتى يستطيع مدير القسم الاعتماد.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table department_violations add column if not exists amount numeric;
alter table department_violations add column if not exists branch_id uuid references branches(id) on delete set null;
alter table department_violations add column if not exists status text not null default 'active';
alter table department_violations add column if not exists approved_by uuid references employees(id) on delete set null;
alter table department_violations add column if not exists approved_at timestamptz;
alter table department_violations add column if not exists applied_count integer;

alter table violations add column if not exists dept_violation_id uuid references department_violations(id) on delete set null;
create index if not exists violations_dept_violation_idx on violations (dept_violation_id) where dept_violation_id is not null;

-- تعبئة فرع المخالفات القديمة من فرع من سجّلها (للعرض فقط)
update department_violations d
   set branch_id = e.branch_id
  from employees e
 where d.branch_id is null and d.created_by = e.id;

-- سياسة التعديل (الاعتماد/الرفض/الإلغاء) لغير الأدوار الأساسية
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'department_violations' and rowsecurity) then
    drop policy if exists dept_violations_update on department_violations;
    create policy dept_violations_update on department_violations
      for update to authenticated
      using (not app_is_basic_employee())
      with check (not app_is_basic_employee());
  end if;
end $$;

notify pgrst, 'reload schema';
