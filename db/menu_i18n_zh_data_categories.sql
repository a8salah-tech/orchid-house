-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة أسماء الأقسام (menu_categories.name_zh) إلى الصينية المبسّطة
--  يعتمد على db/menu_i18n_zh.sql (إضافة الأعمدة). آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

update menu_categories set name_zh = '蛋糕'      where id = 'c349a109-48e3-4e13-af7f-c3bfe381b335';
update menu_categories set name_zh = '甜点'      where id = '5805f3bd-b0a9-4ab2-aea7-649726fb1a07';
update menu_categories set name_zh = '加料'      where id = '35a90bf6-478e-4281-972d-efa1d6d859d3';
update menu_categories set name_zh = '热开胃菜'  where id = '25b16458-0c32-41f8-9730-b4bbaeb1e03b';
update menu_categories set name_zh = '也门菜'    where id = '5a92d1ca-edb3-4ce4-b923-7fb70841cb9c';
update menu_categories set name_zh = '意面'      where id = '87f2daec-3604-44ea-8b8e-42af5e47b0ac';
update menu_categories set name_zh = '冷饮'      where id = '356d7ac4-a5a6-4758-8105-41b5475908ae';
update menu_categories set name_zh = '基贝'      where id = '84be299f-9720-4f18-8e74-e704e18c1613';
update menu_categories set name_zh = '凉开胃菜'  where id = 'e3d3f290-b51b-4413-a25a-63e0ae77243c';
update menu_categories set name_zh = '土耳其烤饼' where id = '70634780-5b5b-41e6-98b5-361198987391';
update menu_categories set name_zh = '披萨'      where id = 'b3c151ba-bb8c-46a4-ba44-39d620364bd3';
update menu_categories set name_zh = '午餐时段'  where id = '0d8e7562-00c5-4b07-b8cd-6ff0331f4370';
update menu_categories set name_zh = '家庭套餐'  where id = '99020816-226e-414c-9f16-32a6bbafb487';
update menu_categories set name_zh = '水烟'      where id = '56f7d261-1228-44f4-951e-a479cbeb42d7';
update menu_categories set name_zh = '沙拉'      where id = 'b72ec4e3-e6b2-43d4-bd1d-e464469d3ced';
update menu_categories set name_zh = '海鲜'      where id = 'a2235d56-f9ec-4d71-9c1b-28d114823c77';
update menu_categories set name_zh = '叙利亚菜'  where id = '50bae98f-b5bd-414c-9d36-78b6c8be0924';
update menu_categories set name_zh = '热饮'      where id = 'a9ed00f9-9a94-4f61-b747-0bb3d805d6da';
update menu_categories set name_zh = '烧烤'      where id = '9345c645-88fb-42f9-9a69-d15842cab805';
update menu_categories set name_zh = '汤类'      where id = '1f45370f-6ca2-412b-81f3-b322a7acafba';
update menu_categories set name_zh = '主菜'      where id = '68ba66a8-c9b9-4aa0-a462-d475d0900cf0';
update menu_categories set name_zh = '沙威玛'    where id = '84eb88b8-6aea-453e-8cb9-a977d8822310';

notify pgrst, 'reload schema';
