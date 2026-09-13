-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة الأصناف للصينية المبسّطة - دفعة ٥: الوجبات العائلية + المأكولات البحرية + المشروبات الساخنة
--  + بيتزا + السلطة + الكاتو + المقبلات الباردة
--  يعتمد على db/menu_i18n_zh.sql. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

-- الوجبات العائلية
update menu_items set name_zh = '家庭鸡肉曼迪套餐', description_zh = '鸡肉曼迪 + 自选米饭 + 阿拉伯沙拉 + 萨哈维酱 + 库纳法 + 阿拉伯茶' where id = '456ab99b-a900-4295-8853-911e403a8588';
update menu_items set name_zh = '全羊肩', description_zh = '全羊肩 / 自选米饭 / 阿拉伯沙拉 / 萨哈维酱 / 库纳法 / 阿拉伯茶' where id = '24cab84f-f86b-4c7d-94a7-ccdb552daf2e';
update menu_items set name_zh = '家庭什锦烤肉', description_zh = '什锦烤肉 / 自选米饭 / 阿拉伯沙拉 / 萨哈维酱 / 库纳法 / 阿拉伯茶' where id = 'e143c4db-e0a0-4144-9f86-1a809d54375b';
update menu_items set name_zh = '家庭羊肉鸡肉曼迪套餐', description_zh = '羊肉鸡肉曼迪 + 自选米饭 + 阿拉伯沙拉 + 萨哈维酱 + 库纳法 + 阿拉伯茶' where id = '013d26ce-23bb-4c1e-b630-08d515a790cb';

-- المأكولات البحرية
update menu_items set name_zh = '一米海鲜拼盘', description_zh = '炸虾、烤虾、炸鱼条、龙虾、烤鱼、炸鱼、虾、米饭' where id = '65725ae6-d0b7-4be2-9e17-85d72570041f';
update menu_items set name_zh = '烤虾', description_zh = '腌制烤虾配炸薯条、香芹和洋葱' where id = 'd1275013-b207-42ee-b8d2-df848f7232b1';
update menu_items set name_zh = '炸虾', description_zh = '炸虾配炸薯条和青菜' where id = 'cac16e69-e678-4f41-8306-519cb16cb2ab';
update menu_items set name_zh = '炸鱼柳', description_zh = '特制香料腌制鱼柳，炸至金黄酥脆，配炸薯条' where id = 'c9e19e46-d307-49c9-8b5a-60c3d17922dc';
update menu_items set name_zh = '烤鱼', description_zh = '特制香料腌制笛鲷鱼，配炸薯条' where id = '352a20ab-cb0d-4c77-9e57-48b518f8a756';
update menu_items set name_zh = '炸鱼', description_zh = '特制香料腌制笛鲷鱼，炸至金黄酥脆' where id = 'b0bf6ad5-0828-413f-9b11-84325c057e40';
update menu_items set name_zh = '半米海鲜拼盘', description_zh = '炸鱼、炸虾、炸大虾、米饭' where id = '2cc6c167-a90b-4320-9bba-30cd78c3d913';

-- المشروبات الساخنة
update menu_items set name_zh = '美式咖啡' where id = '37d97443-c1a9-402e-ac25-b1fc9c308486';
update menu_items set name_zh = '摩卡咖啡' where id = '86d17b20-22d7-4825-babc-eab3a6d64e0a';
update menu_items set name_zh = '柠檬姜蜜茶' where id = '43b979b5-2764-47b3-b460-07cec83c47f8';
update menu_items set name_zh = '奶茶', description_zh = '壶装 RM18 / 杯装 RM7' where id = '24402b18-b722-4504-a7f7-663fed37d6eb';
update menu_items set name_zh = '扎乎拉特花草茶' where id = '808f3cb8-5d0d-4738-a281-473e4ea76d23';
update menu_items set name_zh = '单份浓缩咖啡' where id = '25bf4376-287e-4a24-bce4-97b0d7162343';
update menu_items set name_zh = '拿铁咖啡' where id = '703fcbf4-5974-49da-98f1-f08fe4cc460f';
update menu_items set name_zh = '土耳其咖啡' where id = '27e86d2e-79bb-43b0-a523-abc600de9071';
update menu_items set name_zh = '鲜奶' where id = '93e746d6-7ad6-4ec8-9229-18630237012c';
update menu_items set name_zh = '双份浓缩咖啡' where id = '02c97204-1747-491f-8efd-c686336ed6c1';
update menu_items set name_zh = '绿茶', description_zh = '壶装 RM16 / 杯装 RM6' where id = 'c4a4887c-e4f1-47ad-8686-84f06af2221e';
update menu_items set name_zh = '红茶' where id = '0487b62f-1313-4af3-b02d-2fe75dfa2c39';
update menu_items set name_zh = '卡布奇诺' where id = '112516f6-9752-4204-8dda-e5404a241026';
update menu_items set name_zh = '热雀巢咖啡' where id = '46da0b4a-dd0d-4746-954f-ad603640f0ec';
update menu_items set name_zh = '洛神花茶' where id = '19fb5a66-7d08-4d47-90c4-e538640871f2';
update menu_items set name_zh = '热美禄' where id = '43b9a20f-93ee-416e-9c98-86a3e8a48a36';

-- بيتزا
update menu_items set name_zh = '意式辣香肠披萨' where id = '3c02fa92-e31d-4465-a8a0-7ad28165f578';
update menu_items set name_zh = '玛格丽特披萨', description_zh = '石窑烤制面团配番茄酱，铺新鲜马苏里拉芝士、香罗勒叶和橄榄油' where id = '4394710d-5832-450e-ba9e-ba0ec5e756a7';
update menu_items set name_zh = '羊肉披萨', description_zh = '松软披萨面团、兰花之家特制番茄酱、融化马苏里拉芝士、烤牛排片、红洋葱和黑橄榄' where id = 'd26f7aea-bc37-412d-a27b-120e30fdfcae';
update menu_items set name_zh = '夏威夷披萨', description_zh = '经典番茄酱、马苏里拉芝士、新鲜菠萝片' where id = '027fa3f5-bf55-47b0-8d07-398419e26add';
update menu_items set name_zh = '鸡肉披萨', description_zh = '披萨面团铺兰花之家特制番茄酱、马苏里拉芝士、东西方香料腌制鸡肉条、彩椒、洋葱和橄榄' where id = '42fbffa0-cd38-4f0e-a156-64c29eea14b0';
update menu_items set name_zh = '蔬菜披萨', description_zh = '兰花之家秘制番茄酱、马苏里拉芝士、彩椒、黑橄榄、蘑菇、洋葱和甜玉米' where id = 'd264ca42-e925-40ea-bb61-dbabd69ac1cd';
update menu_items set name_zh = '兰花披萨', description_zh = '意式面团配番茄酱、马苏里拉芝士、兰花之家调味肉、洋葱片、彩椒、蘑菇及额外橄榄油' where id = '447e8168-4cc0-481b-86de-2e7b0784d8ff';

-- السلطة
update menu_items set name_zh = '塔布勒沙拉', description_zh = '碎小麦配切碎香芹、番茄、洋葱，淋橄榄油和新鲜柠檬调味' where id = '384360cf-91e4-4e38-8187-e71d586f3d12';
update menu_items set name_zh = '兰花法图什沙拉', description_zh = '烤皮塔面包、茄子、黄瓜、番茄、生菜、薄荷、彩椒和橄榄，淋石榴糖蜜调味' where id = 'ec1d5e58-53a8-42fc-ae4a-da64dcab77dc';
update menu_items set name_zh = '兰花沙拉', description_zh = '樱桃番茄、洋葱片、香芹、墨西哥辣椒腌菜' where id = 'cb4c95c1-094d-46b2-b6a3-199dfd4eda1f';
update menu_items set name_zh = '虾仁沙拉', description_zh = '新鲜虾仁、玉米、生菜、新鲜柠檬、烤面包' where id = 'b4af33ef-f2e4-4e3a-adef-1903631df23e';
update menu_items set name_zh = '橄榄沙拉', description_zh = '胡萝卜丝、绿橄榄片，以柠檬汁、橄榄油和石榴糖蜜调味' where id = '56cf1f23-6fea-4d43-b5c3-93b53954b75a';
update menu_items set name_zh = '甜菜根沙拉', description_zh = '甜菜根、芝士、洋葱、大蒜、新鲜香芹，以柠檬汁和橄榄油调味' where id = '17a36d1f-6fbd-498a-a11f-3074d5d3af32';
update menu_items set name_zh = '金枪鱼沙拉', description_zh = '切碎金枪鱼、新鲜生菜、玉米、蛋黄酱，以芥末调味' where id = '26d0bb2e-c25a-4675-87ad-74ad60935049';
update menu_items set name_zh = '凯撒沙拉', description_zh = '生菜、烤面包、鸡肉，配凯撒酱' where id = '29a4083e-4ea4-4b38-a8cc-ac0cfa4cf95b';
update menu_items set name_zh = '阿拉伯沙拉', description_zh = '黄瓜、生菜、番茄、洋葱、香芹，以新鲜柠檬汁和橄榄油调味' where id = '60cdd4a0-5874-4650-8f43-f7bc98c98bf9';
update menu_items set name_zh = '法图什沙拉', description_zh = '烤皮塔面包、茄子、黄瓜、番茄、生菜、薄荷、彩椒和橄榄，淋石榴糖蜜调味' where id = '2bfe7744-2f13-41ed-bf61-d0d13a01ffdf';

-- الكاتو
update menu_items set name_zh = '鼓乐蛋糕秀 🎂🥁', description_zh = '您最爱的蛋糕，配我们团队热情的鼓乐表演' where id = '23e8ad5e-5c15-429c-9ebe-c5b98c5e6a6d';

-- المقبلات الباردة
update menu_items set name_zh = '穆哈马拉辣椒酱', description_zh = '红椒、面包屑、石榴糖蜜、核桃和橄榄油' where id = '37dd827a-f5fb-4651-850a-bf316c42fb0f';
update menu_items set name_zh = '兰花巴巴葛努什', description_zh = '烤茄子、番茄、青红椒、洋葱、大蒜、芝麻酱、香芹，以新鲜柠檬和橄榄油调味' where id = '95ba75db-cf49-4d7a-8085-7045f7723dda';
update menu_items set name_zh = '兰花鹰嘴豆泥', description_zh = '鹰嘴豆泥、开心果、芝麻酱、柠檬汁、香芹、洋葱、橄榄油' where id = '34ffff87-fea2-46a9-a95a-cc397930517f';
update menu_items set name_zh = '甜菜根鹰嘴豆泥', description_zh = '鹰嘴豆泥、甜菜根、芝麻酱、柠檬汁、橄榄油' where id = '7b59ce8f-0d3d-47ca-a573-af85626d2987';
update menu_items set name_zh = '基什克', description_zh = '新鲜拉布纳配白色麦粒和洋葱，淋橄榄油和核桃' where id = '598cd42d-d1b9-4753-a1f0-bb46864085a2';
update menu_items set name_zh = '葡萄叶卷', description_zh = '葡萄叶卷入调味米饭，用柠檬和橄榄油腌制' where id = 'ca78d2cc-491f-49ee-ab0c-7fa9a3fdd3c6';
update menu_items set name_zh = '开心果鹰嘴豆泥', description_zh = '鹰嘴豆泥、开心果、芝麻酱、柠檬汁、橄榄油' where id = '4a57c079-18f8-4e3e-9137-5637f76924d8';
update menu_items set name_zh = '甜菜根穆塔巴勒', description_zh = '烤茄子、甜菜根、芝麻酱、酸奶、大蒜、橄榄油和柠檬汁' where id = 'dba45a58-c89f-498d-abb2-ae6da5aa344d';
update menu_items set name_zh = '鹰嘴豆泥', description_zh = '鹰嘴豆泥、芝麻酱、柠檬汁、橄榄油' where id = '45861f1b-e6f7-4719-bd12-72fd1425eb7a';
update menu_items set name_zh = '什锦开胃菜（B）', description_zh = '甜菜根穆塔巴勒、鹰嘴豆泥、穆哈马拉辣椒酱、巴巴葛努什' where id = '860f2c82-c28d-4815-b544-d7bfeff9c13d';
update menu_items set name_zh = '茄子穆塔巴勒', description_zh = '茄子、芝麻酱、酸奶、石榴籽、大蒜、橄榄油和柠檬汁' where id = '3d871bdc-c9f9-429d-9385-8080c2f09853';
update menu_items set name_zh = '巴巴葛努什', description_zh = '烤茄子、番茄、青红椒、新鲜柠檬和橄榄油' where id = '724bf53b-1338-4376-bdd7-516cb55cbe10';
update menu_items set name_zh = '什锦开胃菜（A）', description_zh = '鹰嘴豆泥、葡萄叶卷、阿拉伯沙拉' where id = '42f58c16-d316-4fe2-b64f-3ea106bf4d2b';

notify pgrst, 'reload schema';
