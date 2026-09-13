-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة الأصناف للصينية المبسّطة - دفعة ٤: المعجنات التركية + الكبة + شاورما + معكرونة + المشاوي
--  يعتمد على db/menu_i18n_zh.sql. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

-- المعجنات التركية
update menu_items set name_zh = '马苏里拉芝士', description_zh = '融化的马苏里拉芝士' where id = 'b5049b47-f7f7-4a15-b1d5-3cdb20576284';
update menu_items set name_zh = '土耳其拉赫马金', description_zh = '羊肉末混合特制香料' where id = '035a212a-253e-4a3b-9586-870a12c85e35';
update menu_items set name_zh = '芝士配鸡蛋', description_zh = '融化马苏里拉芝士配鸡蛋' where id = '285c39ca-ea74-4b5a-8a34-94c18b095b3a';
update menu_items set name_zh = '芝士鸡肉', description_zh = '鸡肉配马苏里拉芝士' where id = '25ccb53c-2d19-4767-8bb5-ad1d65e23d44';
update menu_items set name_zh = '芝士金枪鱼', description_zh = '融化马苏里拉芝士配金枪鱼' where id = '8bbf4c23-8116-49a9-9b59-05fd9c42d2e1';
update menu_items set name_zh = '芝士羊肉', description_zh = '羊肉末配马苏里拉芝士' where id = 'a9804f79-a16c-4c24-8a94-2740a661e5b3';
update menu_items set name_zh = '拉布纳配百里香', description_zh = '拉布纳配绿百里香' where id = '9e5920c1-51a1-4775-a74b-48aa1346862f';

-- الكبة
update menu_items set name_zh = '炸基贝', description_zh = '羊肉末配白色麦粒和洋葱，炸制而成' where id = '8c26e5b0-95d4-42bd-80eb-822bc613d41f';
update menu_items set name_zh = '萨吉基贝', description_zh = '白色麦粒配羊肉末、洋葱、什锦坚果、油脂，以萨吉铁板烹制' where id = '87b23a7e-0cf2-43d6-b2b4-a847867ccd89';
update menu_items set name_zh = '烤基贝', description_zh = '羊肉末配白色麦粒、洋葱、石榴籽，烤制而成' where id = 'd1b6f200-19d0-45c7-a9db-c355f106ab08';
update menu_items set name_zh = '烤箱基贝', description_zh = '白色麦粒配羊肉末、洋葱、什锦坚果，烤箱烤制' where id = 'd3caf25c-4a7d-4ae2-8599-b5ea8b76ace5';

-- شاورما
update menu_items set name_zh = '沙威玛拼盘', description_zh = '鸡肉沙威玛片配炸薯条、蔬菜和蒜蓉酱' where id = 'a18ce3bc-c01c-4359-91f0-e91b2fab7577';
update menu_items set name_zh = '阿拉伯沙威玛', description_zh = '鸡肉沙威玛三明治切片，配炸薯条、蔬菜和蒜蓉酱' where id = 'a12845b8-fa40-484c-97d7-f700f266b664';
update menu_items set name_zh = '沙威玛配米饭', description_zh = '鸡肉沙威玛片配白米饭，佐以阿拉伯沙拉、蔬菜和蒜蓉酱' where id = '1e0ccb0a-a097-4fea-a270-6e0f38cedb86';
update menu_items set name_zh = '沙威玛套餐', description_zh = '普通鸡肉三明治配薯条、番茄、腌菜、胡萝卜和蒜蓉酱' where id = '6d5a34ba-e5b3-4f4c-9b86-d44904eaaeed';
update menu_items set name_zh = '帕内沙威玛', description_zh = '香脆芝士鸡肉沙威玛三明治，配蒜蓉酱和蔬菜' where id = 'fa770984-4202-40b4-b0f9-b3ff35908db2';

-- معكرونة
update menu_items set name_zh = '奶油鸡肉意面', description_zh = '通心粉、奶油酱、鸡肉和什锦香草' where id = '93e7929a-dcf8-4dc7-b1ed-245d0cf84c85';
update menu_items set name_zh = '蔬菜意面', description_zh = '意面、蘑菇、番茄酱、什锦辣椒、洋葱和香草' where id = '61dfc8bf-6f62-416d-b6cf-251161ff7896';
update menu_items set name_zh = '鸡肉意面', description_zh = '意面、番茄酱、洋葱、什锦辣椒、大蒜和什锦香草' where id = '96931c09-41db-4d0c-8457-e783a3f84ae0';
update menu_items set name_zh = '牛肉意面', description_zh = '意面、番茄酱、洋葱、肉末、大蒜' where id = '02bbb49d-e2d8-4137-b633-405c3358d266';
update menu_items set name_zh = '卡邦尼意面', description_zh = '意面、蘑菇、大蒜，配什锦优质海鲜' where id = '075705a8-5e3f-4f2d-85ea-e0a10e7a7d29';

-- المشاوي
update menu_items set name_zh = '土豆烤肉饼', description_zh = '新鲜土豆和羊肉烤箱烘烤，配番茄、辣椒和洋葱片' where id = '01f84dd8-62f6-4473-a420-ccc22c3d4be6';
update menu_items set name_zh = '兰花阿拉伊斯', description_zh = '传统烤面包卷羊肉末、洋葱、番茄、辣椒、马苏里拉芝士和蒜蓉酱' where id = 'af4b780b-133a-429b-bfd4-3f9e9e64db11';
update menu_items set name_zh = '茄子烤肉串', description_zh = '茄子铺羊肉末，配蒜蓉酱和特制酱汁的彩椒' where id = 'd6b2b142-78ff-45bc-b349-b5de70f1ff17';
update menu_items set name_zh = '无骨烤鸡', description_zh = '无骨烤鸡配柠檬、大蒜和香料腌制，佐以炸薯条和蒜蓉酱' where id = 'ffd0cc48-16de-4e21-a118-30ef483d5897';
update menu_items set name_zh = '羊肉烤肉串', description_zh = '腌制羊肉烤串，配芝麻酱汁、炸薯条和蒜蓉酱' where id = '6368717e-9f93-4dc6-ad64-7b4cbf9cd17a';
update menu_items set name_zh = '什锦烤肉', description_zh = '牛肉烤肉串、鸡肉烤肉串、什锡烤鸡肉串、羊肉块各一份' where id = 'c7bd505b-0edb-44a7-8ed2-2ac753a64f61';
update menu_items set name_zh = '兰花什锦烤肉', description_zh = '羊肉烤肉串、鸡肉烤肉串、什锡烤鸡肉串、羊肉块、鸡翅、羊肉阿拉伊斯各两份' where id = '1f8e7192-3292-44db-8c3c-743c3e5e4735';
update menu_items set name_zh = '什锡烤鸡肉串', description_zh = '烤鸡胸串，配炸薯条和蒜蓉酱' where id = '673869c1-91b9-4782-bf43-31e24a15db6e';
update menu_items set name_zh = '陶罐什锡', description_zh = '鸡肉块、芝士和奶油酱配蔬菜' where id = '59f6e3f3-473b-4578-8d02-0ff6a5dd81e1';
update menu_items set name_zh = '羊肉阿拉伊斯', description_zh = '羊肉末烤于黎巴嫩面包上，配蒜蓉酱' where id = 'a980f5cb-2be2-448e-a233-6f60f25eca99';
update menu_items set name_zh = '芝士烤肉饼', description_zh = '腌制烤羊肉末混合香料和马苏里拉芝士，配炸薯条和蒜蓉酱' where id = 'c865b0f5-c831-4bbf-b0f8-cfdbc520f4ee';
update menu_items set name_zh = '兰花烤肉饼', description_zh = '茄子配肉烤箱烘烤，配番茄、辣椒和洋葱片' where id = '9fca0d9f-585a-4e51-b004-6d0a9dbab609';
update menu_items set name_zh = '鸡肉阿拉伊斯', description_zh = '鸡肉末烤于黎巴嫩面包上，配蒜蓉酱' where id = 'c7238758-4db5-416e-bbf7-c76b3fa45cd1';
update menu_items set name_zh = '芝麻酱烤肉饼', description_zh = '烤羊肉末配芝麻酱' where id = '6809faf4-6d9a-45f0-a5f3-e72c3ba6babc';
update menu_items set name_zh = '鸡翅', description_zh = '烤鸡翅配柠檬、大蒜和香料腌制，佐以蒜蓉酱' where id = '0f75a347-4c66-4594-b8bf-21d88caa56e3';
update menu_items set name_zh = '牛肉块', description_zh = '烤牛里脊，配蒜蓉酱和炸薯条' where id = '47ed653c-a868-4d70-a41e-c350fb21ea8d';
update menu_items set name_zh = '拜蒂烤肉串', description_zh = '腌制烤羊肉配芝麻酱汁和炸薯条' where id = '7c87c113-749f-4ce8-89fc-789b653b6d1f';
update menu_items set name_zh = '羊排', description_zh = '调味多汁羊排，配柠檬蒜蓉混合酱' where id = '776208f9-ce3d-4626-9903-6da341f549af';
update menu_items set name_zh = '鸡肉烤肉串', description_zh = '腌制烤鸡肉串，配蒜蓉酱和炸薯条' where id = '2b7c5b6e-c297-4099-84e4-bdfa8aa169ef';
update menu_items set name_zh = '半米烤肉拼盘', description_zh = '鸡肉烤肉串、羊肉烤肉串、牛肉块、什锡烤鸡肉串、烤鸡翅' where id = 'a13a4e34-32ca-4d60-89cc-aed2607dd580';
update menu_items set name_zh = '烤盘烤肉饼', description_zh = '羊肉末烤箱烘烤，配番茄、辣椒和洋葱片' where id = 'ada7acae-ca41-4e8a-89c5-a3790fd1aabd';
update menu_items set name_zh = '卡什卡什烤肉串', description_zh = '烤羊肉末串块，铺于香辣番茄酱之上' where id = '8fa1c009-ee7c-4541-9371-ea233bb7a20e';
update menu_items set name_zh = '烤鸡', description_zh = '半只烤鸡配柠檬、大蒜和香料腌制，佐以炸薯条和蒜蓉酱' where id = '12f68b58-89ef-4349-afbe-95bcdaa69fcf';
update menu_items set name_zh = '一米烤肉拼盘', description_zh = '鸡肉烤肉串、羊肉烤肉串、牛肉块、什锡烤鸡肉串、烤鸡翅、兰花阿拉伊斯' where id = '6b6776b2-3dc4-4509-982e-fc780db86989';

notify pgrst, 'reload schema';
