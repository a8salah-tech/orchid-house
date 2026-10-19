-- ══════════════════════════════════════════════════════════════════════════════
--  الكيك: تحويل بين الفروع + كيكة مجانية (صفحة الحلويات ← قسم الكيك)
-- ══════════════════════════════════════════════════════════════════════════════
--  عند تحويل كمية من فرع إلى آخر: ينقص رصيد الفرع المحوِّل ويزيد رصيد الفرع المستلم بنفس الكمية.
--  يُسجَّل التحويل كصف واحد في cake_transfers (عملية واحدة ذرّية — لا ينقص طرف دون الآخر)، ولا يُحسب
--  إنتاجاً ولا توزيعاً على طاولة ولا منتهي صلاحية، فلا تتشوه أرقام «المُنتَج» و«الموزَّع» في التقارير.
--  رصيد الفرع = المُنتَج − الخارج (طلبات/طاولات/منتهي) + المحوَّل إليه − المحوَّل منه (تحسبه الصفحة).
--  الصلاحيات: القراءة والإضافة لغير الموظفين الأساسيين (مثل نماذج الإنتاج والمنتهي)، والحذف لمدير النظام فقط.
--  يعتمد على db/rls_stage_a.sql (app_is_basic_employee, app_is_super_admin).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
--  ── كيكة مجانية (مدير النظام فقط، والسبب إلزامي) ──
--  تُسجَّل في cake_table_log بمصدر source = 'free' وتنقص من رصيد الفرع ولا تُحسب توزيعاً ولا منتهي صلاحية.
--  يُضاف 'free' إلى قيد المصدر إن وُجد، ويُضاف تريغر حارس: لا يُدرج مصدر free إلا مدير النظام وبسبب (ملاحظات) 3 أحرف فأكثر.
--  التراجع:  drop table if exists public.cake_transfers;  drop trigger if exists za_cake_free_guard on public.cake_table_log;
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_is_basic_employee')
     or not exists (select 1 from pg_proc where proname = 'app_is_super_admin') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا (الدوال المساعدة غير موجودة)';
  end if;
end $$;

create table if not exists public.cake_transfers (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  from_branch_id      uuid not null references public.branches(id),
  to_branch_id        uuid not null references public.branches(id),
  quantity            integer not null check (quantity > 0),
  transferred_by_name text,
  notes               text,
  constraint cake_transfers_diff_branches check (from_branch_id <> to_branch_id)
);
create index if not exists idx_cake_transfers_created on public.cake_transfers (created_at);

alter table public.cake_transfers enable row level security;
drop policy if exists ct_select on public.cake_transfers;
drop policy if exists ct_insert on public.cake_transfers;
drop policy if exists ct_delete on public.cake_transfers;
create policy ct_select on public.cake_transfers for select to authenticated using (true);
create policy ct_insert on public.cake_transfers for insert to authenticated with check (not app_is_basic_employee());
create policy ct_delete on public.cake_transfers for delete to authenticated using (app_is_super_admin());

-- ── كيكة مجانية: السماح بمصدر free + حارس (مدير النظام فقط وسبب إلزامي) ──────────
do $$
declare
  c record;
  had_constraint boolean := false;
  allowed text[];
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.cake_table_log'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source%' and pg_get_constraintdef(oid) ilike '%menu_order%'  -- قيد قائمة المصادر فقط، لا نلمس أي قيد آخر
  loop
    had_constraint := true;
    execute format('alter table public.cake_table_log drop constraint %I', c.conname);
  end loop;
  if had_constraint then
    select array_agg(distinct t) into allowed from (
      select source as t from public.cake_table_log where source is not null
      union select unnest(array['menu_order', 'manual', 'expired', 'free'])
    ) s;
    execute format('alter table public.cake_table_log add constraint cake_table_log_source_check check (source = any (%L::text[]))', allowed);
  end if;
end $$;

create or replace function app_cake_free_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.source = 'free' then
    -- service_role / SQL Editor (auth.uid() = null) لا يتأثران
    if auth.uid() is not null and not app_is_super_admin() then
      raise exception 'الكيك المجاني لمدير النظام فقط';
    end if;
    if length(trim(coalesce(new.notes, ''))) < 3 then
      raise exception 'سبب الكيك المجاني إلزامي';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists za_cake_free_guard on public.cake_table_log;
create trigger za_cake_free_guard before insert or update on public.cake_table_log
  for each row execute function app_cake_free_guard();

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cake_transfers') then
    raise exception 'FAIL: cake_transfers';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
