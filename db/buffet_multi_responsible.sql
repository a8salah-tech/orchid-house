-- ══════════════════════════════════════════════════════════════════════════════
--  البوفية: (1) أكثر من موظف مسؤول عن التنفيذ (لكل واحد شيفته)  (2) ملاحظات بعد التأكيد
-- ══════════════════════════════════════════════════════════════════════════════
--  جدول buffet_responsibles: صف لكل (طلب بوفية، موظف مسؤول) مع شيفته ومن عيّنه ومتى.
--  • تنقل هذه الدفعة المسؤول الحالي (buffet_confirmations.responsible_employee_id) إلى الجدول الجديد بشيفت الطلب، فلا يضيع أحد.
--  • يبقى عمود responsible_employee_id في buffet_confirmations يشير إلى أول مسؤول (للتوافق مع بقية الشاشات).
--  • القراءة لكل المسجّلين (يلزم الموظف ليرى طلبه)، والتعيين/الإزالة لغير الموظفين الأساسيين.
--  يعتمد على db/rls_stage_a.sql (app_is_basic_employee, app_is_super_admin, app_current_employee_id).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
--  التراجع:  drop table if exists public.buffet_responsibles;
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_is_basic_employee') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا';
  end if;
end $$;

create table if not exists public.buffet_responsibles (
  id               uuid primary key default gen_random_uuid(),
  buffet_order_id  uuid not null references public.buffet_orders(id) on delete cascade,
  employee_id      uuid not null references public.employees(id) on delete cascade,
  shift            text,
  assigned_by      uuid,
  assigned_at      timestamptz not null default now(),
  unique (buffet_order_id, employee_id)
);
create index if not exists idx_buffet_resp_emp on public.buffet_responsibles (employee_id);

grant select, insert, update, delete on public.buffet_responsibles to authenticated;
grant select, insert, update, delete on public.buffet_responsibles to service_role;

alter table public.buffet_responsibles enable row level security;
drop policy if exists br_select on public.buffet_responsibles;
drop policy if exists br_write on public.buffet_responsibles;
create policy br_select on public.buffet_responsibles for select to authenticated using (true);
create policy br_write on public.buffet_responsibles for all to authenticated
  using (not app_is_basic_employee()) with check (not app_is_basic_employee());

-- نقل المسؤولين الحاليين (مرة واحدة، دون تكرار)
insert into public.buffet_responsibles (buffet_order_id, employee_id, shift, assigned_by, assigned_at)
select c.buffet_order_id, c.responsible_employee_id, o.shift, c.assigned_by, coalesce(c.assigned_at, now())
  from public.buffet_confirmations c
  join public.buffet_orders o on o.id = c.buffet_order_id
 where c.responsible_employee_id is not null
on conflict (buffet_order_id, employee_id) do nothing;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'buffet_responsibles') then
    raise exception 'FAIL: buffet_responsibles';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════
--  ملاحظات إضافية على طلب البوفية بعد التأكيد (سجل: من كتب، متى، ماذا)
-- ══════════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.buffet_notes (
  id               uuid primary key default gen_random_uuid(),
  buffet_order_id  uuid not null references public.buffet_orders(id) on delete cascade,
  note             text not null check (length(btrim(note)) > 0),
  created_by       uuid,
  created_by_name  text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_buffet_notes_order on public.buffet_notes (buffet_order_id, created_at);

grant select, insert, update, delete on public.buffet_notes to authenticated;
grant select, insert, update, delete on public.buffet_notes to service_role;

alter table public.buffet_notes enable row level security;
drop policy if exists bn_select on public.buffet_notes;
drop policy if exists bn_insert on public.buffet_notes;
drop policy if exists bn_delete on public.buffet_notes;
create policy bn_select on public.buffet_notes for select to authenticated using (true);
create policy bn_insert on public.buffet_notes for insert to authenticated
  with check (created_by = app_current_employee_id() or app_is_super_admin());
create policy bn_delete on public.buffet_notes for delete to authenticated using (app_is_super_admin());

commit;

notify pgrst, 'reload schema';
