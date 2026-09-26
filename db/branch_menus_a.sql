-- ══════════════════════════════════════════════════════════════════════════════
--  منيو مستقل لكل فرع — الخطوة (أ): التجهيز (شغّلها قبل رفع النسخة)
-- ══════════════════════════════════════════════════════════════════════════════
--  • menu_categories / menu_items تأخذ branch_id. كل الموجود الآن يُنسب لفرع Orchid House (المعرّفات لا تتغير).
--  • يُنسخ المنيو الحالي (الأقسام والأصناف النشطة + الأحجام) إلى فرع Orchid KLCC **بحالة غير نشطة (is_active=false)**،
--    فلا يظهر لأي عميل ولا في أي صفحة حتى تشغّل الخطوة (ب) بعد رفع النسخة.
--  • الصور تُشارَك بالروابط. المكوّنات (menu_item_ingredients) لا تُنسخ لأن مستودع KLCC مختلف.
--  • default مؤقت لـ branch_id = Orchid House حتى لا تضيع أي إضافة تحصل أثناء فترة النشر (يُزال في الخطوة ب).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from branches where id = '783bc0ec-16f5-4e6c-9148-9c30b12d42c2') then
    raise exception 'فرع Orchid House غير موجود';
  end if;
  if not exists (select 1 from branches where id = '9375998c-0a98-48c8-be7a-485e0c616ae1') then
    raise exception 'فرع Orchid KLCC غير موجود';
  end if;
end $$;

alter table menu_categories add column if not exists branch_id uuid references branches(id);
alter table menu_categories add column if not exists cloned_from uuid;
alter table menu_items      add column if not exists branch_id uuid references branches(id);
alter table menu_items      add column if not exists cloned_from uuid;

update menu_categories set branch_id = '783bc0ec-16f5-4e6c-9148-9c30b12d42c2' where branch_id is null;
update menu_items      set branch_id = '783bc0ec-16f5-4e6c-9148-9c30b12d42c2' where branch_id is null;

alter table menu_categories alter column branch_id set default '783bc0ec-16f5-4e6c-9148-9c30b12d42c2';
alter table menu_items      alter column branch_id set default '783bc0ec-16f5-4e6c-9148-9c30b12d42c2';

create index if not exists menu_categories_branch_idx on menu_categories (branch_id);
create index if not exists menu_items_branch_idx on menu_items (branch_id);

-- نسخ الأقسام النشطة إلى KLCC (غير نشطة حتى الخطوة ب)
insert into menu_categories (name, name_en, icon, sort_order, is_active, destination, available_days, available_from, available_to,
                             time_badge_ar, time_badge_en, name_ms, name_zh, name_ru, branch_id, cloned_from)
select c.name, c.name_en, c.icon, c.sort_order, false, c.destination, c.available_days, c.available_from, c.available_to,
       c.time_badge_ar, c.time_badge_en, c.name_ms, c.name_zh, c.name_ru, '9375998c-0a98-48c8-be7a-485e0c616ae1', c.id
from menu_categories c
where c.branch_id = '783bc0ec-16f5-4e6c-9148-9c30b12d42c2' and c.is_active = true and c.cloned_from is null
  and not exists (select 1 from menu_categories k where k.cloned_from = c.id and k.branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1');

-- نسخ الأصناف النشطة (التي لها قسم؛ الأصناف اليدوية المخفية لا تُنسخ)
insert into menu_items (category_id, name, name_en, or_code, description, description_en, price, cost_price, image_url, is_active, is_available,
                        sort_order, tags, discount_percent, name_ms, description_ms, name_zh, description_zh, name_ru, description_ru, branch_id, cloned_from)
select kc.id, i.name, i.name_en, i.or_code, i.description, i.description_en, i.price, i.cost_price, i.image_url, false, i.is_available,
       i.sort_order, i.tags, i.discount_percent, i.name_ms, i.description_ms, i.name_zh, i.description_zh, i.name_ru, i.description_ru,
       '9375998c-0a98-48c8-be7a-485e0c616ae1', i.id
from menu_items i
join menu_categories kc on kc.cloned_from = i.category_id and kc.branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1'
where i.branch_id = '783bc0ec-16f5-4e6c-9148-9c30b12d42c2' and i.is_active = true and i.cloned_from is null and i.category_id is not null
  and not exists (select 1 from menu_items k where k.cloned_from = i.id and k.branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1');

-- نسخ الأحجام
insert into menu_item_sizes (menu_item_id, name, name_en, price, is_active, sort_order, name_ms, name_zh, name_ru)
select k.id, s.name, s.name_en, s.price, s.is_active, s.sort_order, s.name_ms, s.name_zh, s.name_ru
from menu_items k
join menu_item_sizes s on s.menu_item_id = k.cloned_from
where k.branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1'
  and not exists (select 1 from menu_item_sizes x where x.menu_item_id = k.id);

notify pgrst, 'reload schema';
