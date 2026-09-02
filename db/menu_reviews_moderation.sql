-- ══════════════════════════════════════════════════════════════════════════════
--  موافقة الإدارة قبل نشر تقييمات العملاء + حماية من العبث
-- ══════════════════════════════════════════════════════════════════════════════
--
--  قبل: أي زائر يقدر يبعت تقييمات بلا حد وتظهر فورًا للزوّار — قابل للتخريب
--  (سكربت تقييمات وهمية، نص مسيء يظهر قبل ما يشوفه موظف).
--
--  بعد:
--    • عمود status: pending | approved | rejected  (الافتراضي pending)
--    • الزائر يقرأ المعتمد فقط، ويضيف كـ pending فقط (ما يقدرش يعتمد تقييمه)
--    • الموظف (صفحة تقييمات العملاء) يشوف الكل ويعتمد/يرفض/يحذف
--    • التقييمات الموجودة حاليًا (ظاهرة بالفعل) تُعتبر معتمدة
--
--  الكود المصاحب (منشور): صفحة المنيو تجيب المعتمد فقط، وترسل الجديد pending،
--  وتمنع تكرار التقييم لنفس الطبق من نفس الجهاز (localStorage).
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- (1) عمود الحالة
alter table menu_item_reviews add column if not exists status text not null default 'pending';

-- (2) التقييمات الموجودة حاليًا ظاهرة بالفعل — نعتبرها معتمدة
update menu_item_reviews set status = 'approved' where status = 'pending';

-- (3) RLS للزائر المجهول: قراءة المعتمد فقط، إضافة pending فقط
drop policy if exists anon_read on menu_item_reviews;
drop policy if exists anon_insert on menu_item_reviews;
create policy anon_read on menu_item_reviews for select to anon
  using (status = 'approved');
create policy anon_insert on menu_item_reviews for insert to anon
  with check (status = 'pending');
-- (authenticated_all من المرحلة 4 كما هي — الموظف يقرأ الكل ويحدّث الحالة)

-- (4) بوابة تحقق
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='menu_item_reviews' and column_name='status') then
    raise exception 'FAIL: status column missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='menu_item_reviews' and policyname='anon_read') then
    raise exception 'FAIL: anon_read missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='menu_item_reviews' and policyname='anon_insert') then
    raise exception 'FAIL: anon_insert missing';
  end if;
  raise notice 'ALL CHECKS PASSED';
end $$;

commit;

-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ
-- ══════════════════════════════════════════════════════════════════════════════
--  • زائر (Console بدون دخول):
--      await sb.from('menu_item_reviews').insert({ menu_item_id:'<id>', stars:5, status:'approved' })  → خطأ RLS
--      await sb.from('menu_item_reviews').insert({ menu_item_id:'<id>', stars:5, status:'pending' })   → ينجح
--      await sb.from('menu_item_reviews').select('*')  → المعتمد فقط
--  • صفحة المنيو: التقييمات القديمة تظهر؛ التقييم الجديد "قيد المراجعة" ولا يظهر لحد الاعتماد
--  • صفحة تقييمات العملاء: فلتر "قيد المراجعة" + زر اعتماد/رفض
--
--  التراجع:
--    begin;
--    drop policy if exists anon_read on menu_item_reviews;
--    drop policy if exists anon_insert on menu_item_reviews;
--    create policy anon_read on menu_item_reviews for select to anon using (true);
--    create policy anon_insert on menu_item_reviews for insert to anon with check (true);
--    -- alter table menu_item_reviews drop column status;  (اختياري)
--    commit;
