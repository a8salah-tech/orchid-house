-- ══════════════════════════════════════════════════════════════════════════════
--  إضافة 17 صنفًا جديدًا إلى فرع Orchid KLCC من منيو الـPDF الجديد (بأرقامها المطبوعة في الـPDF)
-- ══════════════════════════════════════════════════════════════════════════════
--  • المشاوي: 102 · 115 · 117 · 118 · 119 · 121 · 123 · 124   • مشروبات باردة: 199 · 202 · 225 · 230–234   • مشروبات ساخنة: 251
--  • الأسعار والأوصاف من الـPDF؛ الأسماء العربية لأصناف المشروبات الباردة والساخنة من اقتراحي (لم تكن مكتوبة بالعربية في الـPDF) — راجعها.
--  • الأصناف تُضاف مفعّلة ومتاحة وبلا صورة (تُضاف الصور لاحقًا من صفحة الأصناف).
--  • لا يمس فرع Orchid House. لا يضيف صنفًا رقمه موجود فعلًا في KLCC (آمن لإعادة التشغيل).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════════════════════

insert into menu_items (
  branch_id, category_id, or_code, sort_order, price, cost_price, discount_percent, is_active, is_available,
  name, name_en, name_ms, name_zh, name_ru,
  description, description_en, description_ms, description_zh, description_ru
)
select
  '9375998c-0a98-48c8-be7a-485e0c616ae1'::uuid, v.category_id, v.or_code, v.or_code::int, v.price, 0, 0, true, true,
  v.name, v.name_en, v.name_ms, v.name_zh, v.name_ru,
  v.d_ar, v.d_en, v.d_ms, v.d_zh, v.d_ru
from (values
    ('102', '58b500ed-f460-450a-a95f-1db625930566'::uuid, 60, 'كباب تركي', 'Long Fire Kebab', 'Kebab Api Panjang', '长火烤肉串', 'Длинный кебаб на огне', 'لحم ضأن مفروم غني بالنكهة، مشوي بإتقان ويُقدَّم على صينية طويلة سخية مع الخبز', 'Flavor-packed minced lamb, expertly grilled and served on a generous long platter, with bread', 'Daging kambing cincang penuh perisa, dipanggang dengan mahir dan dihidang di atas pinggan panjang bersama roti', '风味十足的羊肉末，精心烤制，盛于超长拼盘，配面包', 'Рубленая баранина, мастерски приготовленная на гриле, подаётся на длинном блюде с хлебом'),
    ('115', '58b500ed-f460-450a-a95f-1db625930566'::uuid, 35.5, 'دورم كباب', 'Kebab Wrap', 'Bungkus Kebab', '烤肉卷', 'Кебаб-ролл', 'لفافة لحم ضأن متبّل مع طماطم منعشة وصلصة ثوم وبطاطس مقرمشة', 'Spiced lamb wrap with zesty tomato, garlic dip, and crispy fries', 'Bungkus daging kambing berempah dengan tomato segar, cicah bawang putih dan kentang rangup', '香料羊肉卷，配酸爽番茄、蒜蓉酱和酥脆薯条', 'Ролл с пряной бараниной, пикантными томатами, чесночным соусом и хрустящим картофелем фри'),
    ('117', '58b500ed-f460-450a-a95f-1db625930566'::uuid, 36.5, 'رويال كباب', 'Kebab Royal', 'Kebab Diraja', '皇家烤肉', 'Кебаб Рояль', 'لحم مفروم مشوي على اللهب فوق مزيج ناعم من الباذنجان واللبن مع صلصة طماطم لذيذة', 'Flame-grilled minced meat atop a silky eggplant yogurt blend paired with savory tomato sauce', 'Daging cincang panggang api di atas campuran terung dan yogurt yang lembut bersama sos tomato', '明火烤肉末，铺在丝滑茄子酸奶泥上，配美味番茄酱', 'Рубленое мясо, приготовленное на огне, на шелковистом пюре из баклажанов с йогуртом и томатным соусом'),
    ('118', '58b500ed-f460-450a-a95f-1db625930566'::uuid, 36.5, 'علي نازك', 'Ember Kebab', 'Kebab Bara', '炭火烤肉配茄泥', 'Али Назик кебаб', 'مكعبات لحم ضأن طرية على مزيج الباذنجان واللبن الكريمي مع صلصة طماطم بالزبدة وخبز دافئ', 'Tender sliced diced lamb on creamy eggplant-yogurt, with buttery tomato sauce and warm bread', 'Daging kambing dadu lembut di atas terung-yogurt berkrim, dengan sos tomato mentega dan roti panas', '嫩羊肉丁铺在奶香茄子酸奶上，配黄油番茄酱和热面包', 'Нежные кубики баранины на кремовом пюре из баклажанов с йогуртом, томатным соусом с маслом и тёплым хлебом'),
    ('119', '58b500ed-f460-450a-a95f-1db625930566'::uuid, 35.5, 'كرات اللحم المشوية', 'Grilled Meatballs', 'Bebola Daging Panggang', '烤肉丸', 'Жареные фрикадельки', 'كرات لحم ضأن وبقر طرية مع الأرز والبطاطس المقرمشة والمخلل', 'Tender round lamb and beef meatballs with rice, crispy fries, and pickle capers', 'Bebola daging kambing dan lembu yang lembut bersama nasi, kentang rangup dan jeruk', '嫩滑羊牛肉丸，配米饭、酥脆薯条和腌菜', 'Нежные шарики из баранины и говядины с рисом, хрустящим картофелем фри и маринованными овощами'),
    ('121', '58b500ed-f460-450a-a95f-1db625930566'::uuid, 36, 'لحم إنيجول', 'Inegol Meatballs', 'Bebola Daging Inegol', '伊内格尔肉丸', 'Фрикадельки Инегёль', 'كفتة لحم ضأن وبقر لذيذة مع أرز مفلفل وبطاطس حارة ومخلل منعش', 'Savory lamb and beef meatballs with fluffy rice, spicy fries, and tangy pickles', 'Bebola daging kambing dan lembu yang enak bersama nasi gebu, kentang pedas dan jeruk masam', '鲜美羊牛肉丸，配松软米饭、香辣薯条和酸脆腌菜', 'Ароматные котлеты из баранины и говядины с рассыпчатым рисом, острым картофелем фри и маринадами'),
    ('123', '58b500ed-f460-450a-a95f-1db625930566'::uuid, 95, 'مشكل مشاوي وسط', 'Medium Mix Grills', 'Campuran Panggang Sederhana', '中份烤肉拼盘', 'Ассорти гриль (средняя порция)', 'كباب لحم وكباب دجاج على الفحم، مكعبات لحم ضأن، شيش طاووق، كرات لحم وجمبري مشوي، يُقدَّم مع البصل والبقدونس والبطاطس المقلية', 'Charcoal lamb kebab, chicken kebab, tender lamb cube, diced shish tawook, meatballs, and shrimp flame grilled feast, served with onion, parsley and fries', 'Kebab kambing dan ayam bakar arang, kiub kambing lembut, shish tawook dadu, bebola daging dan udang panggang api, dihidang bersama bawang, pasli dan kentang goreng', '炭烤羊肉串、鸡肉串、嫩羊肉块、鸡肉丁、肉丸和明火烤虾，配洋葱、欧芹和薯条', 'Баранья и куриная шашлычки на углях, нежные кубики баранины, шиш-таук, фрикадельки и креветки на гриле, подаётся с луком, петрушкой и картофелем фри'),
    ('124', '58b500ed-f460-450a-a95f-1db625930566'::uuid, 180, 'مشكل مشاوي كبير', 'Large Mix Grills', 'Campuran Panggang Besar', '大份烤肉拼盘', 'Ассорти гриль (большая порция)', 'صينية وافرة من كباب اللحم الطويل وكباب الدجاج ومكعبات لحم الضأن الطرية وشيش طاووق والكرات وأجنحة الدجاج، مليئة بالنكهة ومناسبة للمشاركة، تُقدَّم مع البصل والبقدونس والبطاطس المقلية', 'A hearty platter of long lamb kebab, chicken kebab, tender lamb cube, diced shish tawook, meatballs, and chicken wings bursting with flavor, perfect to share, served with onion, parsley and fries', 'Hidangan besar kebab kambing panjang, kebab ayam, kiub kambing lembut, shish tawook dadu, bebola daging dan kepak ayam penuh perisa, sesuai untuk dikongsi, dihidang bersama bawang, pasli dan kentang goreng', '丰盛拼盘：长羊肉串、鸡肉串、嫩羊肉块、鸡肉丁、肉丸和鸡翅，风味十足，适合分享，配洋葱、欧芹和薯条', 'Щедрое блюдо из длинного бараньего кебаба, куриного кебаба, нежных кубиков баранины, шиш-тауков, фрикаделек и куриных крылышек, отлично для компании, подаётся с луком, петрушкой и картофелем фри'),
    ('199', 'd5448c2a-2991-478d-beaa-e0eb1fd07f9d'::uuid, 16, 'ماهيتو باشن فروت', 'Passion Fruit Mojito', 'Mojito Markisa', '百香果莫吉托', 'Мохито с маракуйей', null, null, null, null, null),
    ('202', 'd5448c2a-2991-478d-beaa-e0eb1fd07f9d'::uuid, 16, 'ماهيتو رمان', 'Pomegranate Mojito', 'Mojito Delima', '石榴莫吉托', 'Мохито с гранатом', null, null, null, null, null),
    ('225', 'd5448c2a-2991-478d-beaa-e0eb1fd07f9d'::uuid, 17, 'مانغو دوريان', 'Mango Durian', 'Mango Durian', '芒果榴莲', 'Манго-дуриан', null, null, null, null, null),
    ('230', 'd5448c2a-2991-478d-beaa-e0eb1fd07f9d'::uuid, 12, 'بينا كولادا', 'Pina Colada', 'Pina Colada', '椰林飘香', 'Пина колада', null, null, null, null, null),
    ('231', 'd5448c2a-2991-478d-beaa-e0eb1fd07f9d'::uuid, 12, 'ليمون جراس باشن', 'Lemongrass Passion', 'Serai Markisa', '香茅百香果', 'Лемонграсс-маракуйя', null, null, null, null, null),
    ('232', 'd5448c2a-2991-478d-beaa-e0eb1fd07f9d'::uuid, 12, 'ليمون جراس خوخ', 'Lemongrass Peach', 'Serai Pic', '香茅水蜜桃', 'Лемонграсс-персик', null, null, null, null, null),
    ('233', 'd5448c2a-2991-478d-beaa-e0eb1fd07f9d'::uuid, 12, 'ياسمين خوخ', 'Peach Jasmine', 'Melur Pic', '水蜜桃茉莉', 'Персик-жасмин', null, null, null, null, null),
    ('234', 'd5448c2a-2991-478d-beaa-e0eb1fd07f9d'::uuid, 12, 'ياسمين باشن', 'Passion Jasmine', 'Melur Markisa', '百香果茉莉', 'Жасмин-маракуйя', null, null, null, null, null),
    ('251', 'a264b4c1-c19f-4622-bc2e-afe834800584'::uuid, 12, 'شوكولاتة ساخنة', 'Hot Chocolate', 'Coklat Panas', '热巧克力', 'Горячий шоколад', null, null, null, null, null)
) as v(or_code, category_id, price, name, name_en, name_ms, name_zh, name_ru, d_ar, d_en, d_ms, d_zh, d_ru)
where not exists (
  select 1 from menu_items m
   where m.branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1'::uuid and m.or_code = v.or_code and m.is_active = true
);

notify pgrst, 'reload schema';
