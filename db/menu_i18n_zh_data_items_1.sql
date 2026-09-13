-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة الأصناف للصينية المبسّطة - دفعة ١: وقت الغداء + الشوربة + المقبلات الساخنة + إضافات
--  يعتمد على db/menu_i18n_zh.sql. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

-- وقت الغداء
update menu_items set name_zh = '（午餐）烤鸡肉串配米饭', description_zh = '烤鸡肉串配米饭' where id = 'e840a1a2-a34d-4f28-82a8-973db6d1a085';
update menu_items set name_zh = '（午餐）沙威玛配米饭', description_zh = '沙威玛配米饭 + 免费冰柠檬茶' where id = 'a967eac6-11d4-4f46-9917-acd15e74687c';
update menu_items set name_zh = '（午餐）曼迪鸡饭', description_zh = '曼迪鸡饭 + 免费冰柠檬茶' where id = 'd17fc7bb-9ce9-40cf-85d3-e357559817d3';
update menu_items set name_zh = '（午餐）鸡肉烤肉串配米饭', description_zh = '鸡肉烤肉串配米饭 + 免费冰柠檬茶' where id = '28f639ab-accf-40f4-9841-aa6124f5bd17';
update menu_items set name_zh = '（午餐）沙威玛套餐', description_zh = '鸡肉沙威玛套餐 + 免费冰柠檬茶' where id = '66fb785b-62ba-4604-8a39-53bd29ff5ff5';
update menu_items set name_zh = '（午餐）羊肉烤肉串配米饭', description_zh = '羊肉烤肉串配米饭 + 免费冰柠檬茶' where id = 'c1d20e8b-cc78-4017-878f-62c99052b1a2';

-- الشوربة
update menu_items set name_zh = '小扁豆汤', description_zh = '红扁豆配洋葱、胡萝卜和土豆，挤上新鲜柠檬汁，用我们特制香料调味' where id = '3135a3d5-fdc6-4fc8-8b62-356a120a9c91';
update menu_items set name_zh = '蘑菇汤', description_zh = '蘑菇、洋葱与奶油牛奶的搭配，以盐和胡椒调味' where id = 'd3ea932b-02d8-408d-9ccc-781b8e26c2cf';
update menu_items set name_zh = '兰花海鲜汤', description_zh = '海鲜浸于清澈美味的香料汤中，配柠檬角享用' where id = '05272e63-d834-43d4-b14f-86fae6afaa4a';
update menu_items set name_zh = '鸡肉汤', description_zh = '鸡肉与奶油牛奶的搭配，以盐和胡椒调味' where id = '69c78e70-c96b-4e5b-b760-c4a83d2f28c8';
update menu_items set name_zh = '蔬菜汤', description_zh = '洋葱、土豆、胡萝卜，以盐和干香料调味' where id = '141bdb5d-e77c-4e08-b49c-6d905bacff10';

-- المقبلات الساخنة
update menu_items set name_zh = '羊肉法塔', description_zh = '羊肉末、香脆面包、石榴籽、香芹、芝麻酱、酥油、坚果' where id = '1addac81-7a16-4e19-8b76-ec0c7a72fd7b';
update menu_items set name_zh = '鸡肉法塔', description_zh = '水煮鸡肉、芝麻酱、烤面包、大蒜、石榴籽、坚果和酥油' where id = '7e417fda-16cb-4773-b8ba-8236639868e6';
update menu_items set name_zh = '芝麻酱蚕豆', description_zh = '蚕豆、芝麻酱、柠檬汁、大蒜，配香芹和番茄，淋橄榄油' where id = 'f4ee7e78-af47-4ce7-9768-36dc1a789440';
update menu_items set name_zh = '法拉费拼盘', description_zh = '磨碎鹰嘴豆、大蒜、洋葱、香芹，配芝麻酱汁享用' where id = 'a0da3014-9533-45df-a74a-d4487baa1067';
update menu_items set name_zh = '橄榄油蚕豆', description_zh = '蚕豆、柠檬汁、大蒜，配香芹和番茄，淋橄榄油' where id = '0016a175-2300-465a-a0a7-7cfca76c17a5';
update menu_items set name_zh = '香肠', description_zh = '黄油煎香肠配红椒和特制香料' where id = '4e4be480-4761-4eb6-8bf3-ca0ba54cb7ac';
update menu_items set name_zh = '塔拉图花椰菜', description_zh = '炸花椰菜配芝麻酱汁和新鲜红椒' where id = '01e044ea-f331-4eab-aec8-4123f5a8abe5';
update menu_items set name_zh = '沙威玛法塔', description_zh = '沙威玛鸡肉片、香脆面包、石榴籽、香芹、芝麻酱、酥油、坚果' where id = '0413d703-f8c1-4441-a4da-399c69d36624';
update menu_items set name_zh = '春卷', description_zh = '香脆春卷，内馅为芝士' where id = 'bc9fa27f-0592-40c5-9204-2e6a711421a6';
update menu_items set name_zh = '炸薯条' where id = '186c32d3-5bb4-4e73-b423-da652482fcaf';
update menu_items set name_zh = '黎巴嫩香肠', description_zh = '黄油煎香肠配柠檬和大蒜' where id = 'aeee633c-8994-4379-a510-99f674bc398a';
update menu_items set name_zh = '蘑菇羊肉末', description_zh = '羊肉末、蘑菇、香菜、洋葱和柠檬汁' where id = '4d2c60aa-e782-4f31-bd76-c25802e70f25';
update menu_items set name_zh = '兰花法塔', description_zh = '茄子、芝麻酱、酥油、坚果、石榴籽、番茄酱、香芹' where id = 'e984c7db-26a3-45e3-b5db-8ce2008b90b9';
update menu_items set name_zh = '香辣土豆', description_zh = '香脆土豆配辣椒粉、大蒜和柠檬' where id = 'd16713c3-1747-419b-8d66-fbb92528dac4';
update menu_items set name_zh = '麦克茂尔茄子', description_zh = '烤茄子配新鲜番茄、大蒜和鹰嘴豆炖煮' where id = '4d3a5ef9-926d-4f4a-97c9-7d19e756e210';
update menu_items set name_zh = '鹰嘴豆泥法塔', description_zh = '鹰嘴豆泥、香脆面包、石榴籽、香芹、芝麻酱、酥油、坚果' where id = 'b17ee8a0-f4da-48a8-8fe4-ee61959353d2';
update menu_items set name_zh = '羊肉鹰嘴豆泥', description_zh = '鹰嘴豆泥配羊肉末、芝麻酱汁、柠檬汁和橄榄油' where id = '646a371a-1ed8-4b36-936e-91c27087713a';

-- إضافات
update menu_items set name_zh = '冰水' where id = '1c261566-3858-4d0c-9b9f-3632953770ba';
update menu_items set name_zh = '冰柠檬茶（壶装）' where id = 'fab461d2-3be5-40a8-a9db-f220d81037ad';
update menu_items set name_zh = '冰水（壶装）' where id = 'fcba83c6-b1da-4f6e-9fda-35027b394253';
update menu_items set name_zh = '面包' where id = '0ab7c8ff-0fa4-4694-9bde-51e1ae801474';
update menu_items set name_zh = '冰红茶（壶装）' where id = 'c33f33cf-a081-478c-9380-ec42bd9efd37';
update menu_items set name_zh = '热水' where id = '0971f4c4-3f06-4a9d-8815-8095ffd13fe1';
update menu_items set name_zh = '温水' where id = 'c395e28b-ff26-4ee6-be56-8e3c6aee53b8';
update menu_items set name_zh = '白米饭', description_zh = '不含鸡肉或羊肉的白米饭' where id = '03085b35-c175-4464-9bef-8433bd4bd54b';
update menu_items set name_zh = '缤味多果汁（壶装）' where id = '570928db-55e0-4000-a1af-0f22fcefa134';

notify pgrst, 'reload schema';
