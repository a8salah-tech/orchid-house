-- ══════════════════════════════════════════════════════════════════════════════
--  توحيد أرقام أصناف فرع Orchid KLCC مع المنيو الجديد (ملف "Orchid - Menu KLCC New.pdf")
-- ══════════════════════════════════════════════════════════════════════════════
--  • يغيّر رقم الصنف (or_code) وترتيب العرض (sort_order) لأصناف فرع KLCC فقط، ليطابق الرقم المطبوع في الـPDF.
--  • 140 صنف يتغيّر رقمه ليطابق الـPDF (الأصناف المطابقة التي رقمها لم يتغيّر لا تُمَس).
--  • 9 صنفًا خارج الـPDF كان رقمها الحالي يتعارض مع رقم جديد لصنف آخر، فتُنقل مؤقتًا إلى أرقام 301–309 (غير مستخدمة) حتى لا يتكرر رقم.
--  • لا يغيّر أي سعر ولا اسم ولا صنف آخر، ولا يمس فرع Orchid House.
--  • الأصناف الموجودة في الـPDF وغير الموجودة في النظام لا تُنشأ هنا (يتم إضافتها لاحقًا برقمها).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. يعمل داخل معاملة واحدة (كله أو لا شيء). آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- 1) نقل مؤقت لكل الأصناف المتأثرة (لتفادي أي تعارض لحظي بين الأرقام أثناء التبديل)
update menu_items
   set or_code = 'TMP-' || id::text
 where branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1'
   and id in (
     'ee64948a-6f07-484e-98a9-79e532dff89e',
     '1ed34a1e-80a6-4934-9472-5e57e892013d',
     'ebe3c71a-9077-4cf6-b36f-465ab10f7817',
     'a0c0ae2a-4374-41e8-9070-ae2ad62c9ff0',
     'f07d92e3-674a-493f-bd20-9734332c323e',
     '2a7ddad9-63a2-472e-90c9-9b92b386fbb8',
     'd2fd94e1-96df-44f6-bdf8-4adb493ee543',
     '6e7ba62f-dd85-47a8-b026-502a036b0ccf',
     '158ca13e-b05a-4b6b-830b-5ed63005a1e5',
     '0b54d89d-4b70-4e53-b38e-d036af4cd031',
     'afb3abba-761b-4b82-a7a0-1028e3e0660d',
     '253d1c7c-b1fa-441b-9125-3ad27a5fc874',
     'e52283d4-1f98-4ed5-a41f-a751b3a66fba',
     '4762b6f0-5048-4b62-aab5-71a0d111f443',
     '5afb49f0-3fc6-44b2-ac07-a3cd21bfcb36',
     'aaadfee5-89a3-436e-9bbf-3b2c8ca160c4',
     '496a6d81-f697-4687-95fd-e3b24055fae1',
     'd0a87b6d-5d0c-4404-b89d-88eea9fc8f7b',
     '4b421a00-782b-4a29-8089-2ee7f8e8fcc3',
     '5f25a2c0-2446-4f11-9052-c8c4a027cd4e',
     'b2ce6f91-c86b-4fc7-88e5-ac462bd533fa',
     '9658b577-576f-45cd-92a4-8089a5d1042e',
     '1c134d02-0e30-4075-88c8-32f11c178759',
     'e3a58c19-938e-48a1-b09a-43c6382d4bc4',
     '52f6db56-c60f-4b88-9d03-23619b9f8387',
     '6196228c-fd6a-4a09-8ab1-40fbec0c061d',
     '11717e1e-d535-43bd-8021-1ee76695399f',
     '8dc209dc-062a-452e-8174-b9b98dafd5aa',
     '5ae4bc3b-8106-4190-be5a-9245bb047105',
     '1af84b73-4096-4109-a3c7-8d66bb4741e3',
     'c84e4361-3caa-4b7d-8b37-99a7bc4111da',
     'cc4fc690-dae1-4349-a05d-56dcc2b3119b',
     'cf974ed0-de6f-4df3-9097-c5ea26efab82',
     'a1852fe9-fbe5-4c1f-9bca-d7e6c484c045',
     '70204bd9-86ec-4273-ba33-0600e76ecb19',
     '29a06491-880f-4b52-88ec-57ac71a042fb',
     'a3ecafa6-a833-4eb0-9c21-3b282ae74995',
     '3cebf884-e216-4a40-8ae1-68e1f00e397b',
     'fbbda808-2f47-4773-8b31-e395c79a3932',
     '137263ed-c952-42a3-bacc-4d6ec414c49e',
     'dd5c6b28-1d31-4ba6-96c5-927d1941ce86',
     'c44cafa2-8dfb-48a9-82d6-f3f4013c67c2',
     'f8f1d6fb-99f1-47d5-83d3-445e8c40470c',
     '19b29501-c658-489e-9f89-b9ed0a4fbad2',
     '4b953d5a-c7bf-4ad2-ba18-25bc4f404cef',
     '2f7e3d07-42ce-4a57-9a87-50b6e9fc7a45',
     '3cb83335-e93d-4dd8-a94e-dbf1edc7ae92',
     'a094d62a-ebd1-4049-b643-f32f0c21df39',
     '527c8331-a8e2-4bea-a489-463af2bdedf0',
     '02928904-8647-43c9-903d-7b1e5987757d',
     'cb3365e1-c33d-4e66-b851-274679d61206',
     'c596c9e0-5ea5-4791-80fa-d9b0b59be0f9',
     '36c8920e-3ea7-40d4-bd34-287b7f47105d',
     'ae301438-12bb-46fe-940a-8d220f4b91ac',
     '557b0890-ade1-429a-9044-a4a214f66278',
     'ca8951b3-ca7e-4aeb-8f66-b5267fa7272e',
     '230a2de6-1898-4f57-8a84-339210a3a02d',
     '3140e066-0379-4520-9f7b-6d7897503f92',
     '24f190dd-bae9-4053-9a6c-d940bb1f29a5',
     'aca730d8-f53e-419b-983f-a1e7f9f0ea7b',
     '6c382215-76a1-4ad5-bb4e-59134d29f844',
     'f993fb15-0706-475b-95ca-e011e77b4ca5',
     '6de49b84-cab4-4f55-9a0f-121d90362403',
     'e7f261cb-583f-41cf-92df-f49831ce3f86',
     '035186e5-b234-43a1-97fb-12e68de57ce1',
     '84799c2d-347f-4275-8340-236bafd10ffd',
     '4951967f-d84f-4b0c-b3de-3b41f356a1df',
     '7490ce2f-af70-4125-8c4d-097ea9b6ad81',
     'b68f6cea-da35-41f7-a789-6bb7bcdcf072',
     'fe4d7064-8a95-4e52-82a8-ae5eda0422ea',
     'beb63144-89c1-47d4-87d4-ffcdc15b00c2',
     '68df88bf-5f44-40a5-be97-2d08c1c751de',
     '2e1d5dd3-a74c-4b90-bd18-1f77168755b8',
     '200002eb-c541-4b23-adb5-a528e46862c6',
     '8acc3680-9f08-4d68-8287-5cf3b62b34c3',
     '28959cfc-3344-4c36-9b8d-1ca367a0ba8d',
     '5781117c-a2a7-4967-9d40-311792210a40',
     '3e316c7b-2512-494a-a37e-00c120f34201',
     '1f95d96f-f00f-4cb0-bee7-bb18f49e79fb',
     '7cc2724f-66ac-41aa-a022-7ce674b791b8',
     'ea64bb53-a934-4692-b325-6ce30b123227',
     '82fb2493-7561-413b-9b35-4abf9be6fbfc',
     'b584e4bf-1a10-4fbd-9161-4d66a6967de0',
     '16a89930-224c-46ed-a890-553c139d0a2d',
     '6d07d567-526f-4ae5-becf-59baad466b4c',
     'fc00ddcf-e536-4dac-98c4-49b036383ca1',
     'bdbe7925-3529-4e6c-9068-a019d802ade9',
     '33a0faf9-acc8-4f5c-8660-1b251752ca0c',
     'bfce2c98-988d-4371-a1b5-cffc80387413',
     '2e087e0a-7dce-46fd-b6ce-067cbe1e19cd',
     '9803e968-c811-4497-9f81-faef4ea0977e',
     '418565e0-2a61-4a6e-bb08-3dd2bdfcb8f9',
     '214b824e-6b0b-4b00-a9fd-c664319293e6',
     '95211027-bd85-4e6a-88c0-17a2b49522bc',
     'b41df0d8-7a90-4ac0-97d1-c45a382f4769',
     '22348989-0d93-4ff4-a787-71a42f136931',
     'a4b1d542-e842-4f22-b1b8-41f191471fa5',
     'd00e24ab-3588-495d-bbeb-7a6be7c666a8',
     'b4e8cace-f1b3-41f0-b2ea-7696ad823da2',
     '5713e97c-e0e1-46e9-9647-b3a9a6d10302',
     '794627ba-270d-4236-9c89-b0b65ad8a391',
     'b6edd3c9-c742-4072-a195-72e61f2a376f',
     '909f8f7a-d77b-4545-b9c1-b37852825c26',
     '6f1d4f2e-b3ad-4aed-9e7c-8da6e4c3e48d',
     '8a933bd4-aacd-454a-bdac-d3b22339246c',
     '7e5c265d-a22c-419c-8ffc-8425611b317b',
     'ab0bd54b-7385-479c-8e07-2139a97ec2c2',
     'ee3a727d-55cc-43b1-82b3-036b5d57254f',
     'd5e7be42-917f-45f9-a225-81dab2abbade',
     '4513f4af-0d21-4ac6-9727-e599f75b4bcc',
     'cfec25d0-fb2d-48ac-b2ac-0f71d0870d10',
     'b391aa13-d3eb-4c68-a782-312614d21ded',
     'd015596f-a3fd-44c5-a787-818b065410ec',
     'c3c9e46f-2b47-4681-94a4-550cba656dbd',
     'a98184d2-7f29-4aa0-b276-863e795f8bc3',
     '5c3f8c10-267d-46ed-9069-ca6496ab5286',
     'bef9d69c-4382-4991-8916-2f3974fb9892',
     '4402879d-7074-4b35-a73c-2722f4df0c8d',
     'dca9e5db-0ba2-4bd7-a08b-06f0b45c0b6b',
     '518db2ac-d58e-4ec3-ae41-baf366e3c749',
     'cd7160fc-5168-433a-a648-2501232f87f4',
     'f533945b-287b-423c-a908-c32537ca1e5e',
     'd00d50f7-4c27-4616-9b2d-2c25348571d9',
     '89fbab7b-809a-43f6-82b0-7eebfadb701f',
     'c69646ca-28dd-462a-bd69-8cfd13b7ac37',
     'a4753ade-2e71-4c42-8018-d8533005c44a',
     '2299c4f4-0ff4-49ad-b019-c68360ce0fc8',
     'dfe906a4-8b32-4402-a2d4-ded7bdcc5615',
     '45e82f61-e4d5-438b-9871-1d3207f38abb',
     'ccb38587-5f86-422d-9484-93fbb1935951',
     '165a1423-2f24-4ae8-b68b-d865fdd862fa',
     '4e4bfaa8-e9ba-41d0-b1b4-eb9368c67c2e',
     '23154607-3c8d-4ceb-b02a-c9f8e70eb586',
     '37025d2d-b3f2-4a8b-9f0f-b33079aebdf8',
     '60a3f80e-cacb-42d8-bee7-48686edc6127',
     'ff12e906-9067-4251-b61a-8655a1600357',
     '725602c2-ab8c-400a-9da9-8947d63f0e8c',
     '27bede4a-e64b-4bde-a2ff-eb1bc61670a7',
     '5a36ad15-822f-43f2-ae28-9d28b15a5920',
     'ad220cff-abb9-4500-87c9-d1b481582e7d',
     '3a816363-7ae2-4860-b07b-4383bac8639e',
     '5c859571-945f-49d0-8241-ee6ffda6083f',
     'b7f69a0b-f955-40a2-9c9d-4a693729da06',
     '3eba22c8-d044-41fb-bc60-3ba319842022',
     'cb28e7cc-9a6e-4ef2-93e0-205949b20dc6',
     '2e4a4fda-a250-4d6a-ad4f-deb4b666f218',
     '08585d3c-7e01-43b7-abe1-b301bc2376eb',
     'b92edf5b-71c9-4393-87fa-810d84544b64',
     '5c2995f1-4577-4e5b-b257-4d1eaea28ec1'
   );

-- 2) الأرقام النهائية (الرقم القديم → الجديد، مع اسم الصنف للمراجعة)
update menu_items m
   set or_code = v.new_code,
       sort_order = v.new_code::int
  from (values
    ('ee64948a-6f07-484e-98a9-79e532dff89e'::uuid, '107'),  -- 112 → 107  Shish Tawook
    ('1ed34a1e-80a6-4934-9472-5e57e892013d'::uuid, '110'),  -- 113 → 110  Grill Chicken
    ('ebe3c71a-9077-4cf6-b36f-465ab10f7817'::uuid, '111'),  -- 114 → 111  Boneless Grill Chicken
    ('a0c0ae2a-4374-41e8-9070-ae2ad62c9ff0'::uuid, '112'),  -- 110 → 112  Lamb Arayes
    ('f07d92e3-674a-493f-bd20-9734332c323e'::uuid, '113'),  -- 111 → 113  Chicken Arayes
    ('2a7ddad9-63a2-472e-90c9-9b92b386fbb8'::uuid, '114'),  -- 115 → 114  Kash-Kash Kebab
    ('d2fd94e1-96df-44f6-bdf8-4adb493ee543'::uuid, '116'),  -- 117 → 116  Eggplant Kebab
    ('6e7ba62f-dd85-47a8-b026-502a036b0ccf'::uuid, '120'),  -- 116 → 120  Bayti Kebab
    ('158ca13e-b05a-4b6b-830b-5ed63005a1e5'::uuid, '122'),  -- 107 → 122  Mix Grills
    ('0b54d89d-4b70-4e53-b38e-d036af4cd031'::uuid, '125'),  -- 118 → 125  Orchid Mix Grills
    ('afb3abba-761b-4b82-a7a0-1028e3e0660d'::uuid, '127'),  -- 124 → 127  Fried Fish
    ('253d1c7c-b1fa-441b-9125-3ad27a5fc874'::uuid, '128'),  -- 125 → 128  Fried Fish Fillet
    ('e52283d4-1f98-4ed5-a41f-a751b3a66fba'::uuid, '131'),  -- 126 → 131  Grill Prawn
    ('4762b6f0-5048-4b62-aab5-71a0d111f443'::uuid, '132'),  -- 128 → 132  Grill Fish
    ('5afb49f0-3fc6-44b2-ac07-a3cd21bfcb36'::uuid, '133'),  -- 129 → 133  Shawarma Rice
    ('aaadfee5-89a3-436e-9bbf-3b2c8ca160c4'::uuid, '134'),  -- 130 → 134  Shawarma Meal
    ('496a6d81-f697-4687-95fd-e3b24055fae1'::uuid, '135'),  -- 131 → 135  Panne Shawarma
    ('d0a87b6d-5d0c-4404-b89d-88eea9fc8f7b'::uuid, '136'),  -- 132 → 136  Arabic Shawarma
    ('4b421a00-782b-4a29-8089-2ee7f8e8fcc3'::uuid, '137'),  -- 133 → 137  Shawarma Platter
    ('5f25a2c0-2446-4f11-9052-c8c4a027cd4e'::uuid, '138'),  -- 134 → 138  Turkish Lahmacun
    ('b2ce6f91-c86b-4fc7-88e5-ac462bd533fa'::uuid, '139'),  -- 135 → 139  Cheesy Lamb
    ('9658b577-576f-45cd-92a4-8089a5d1042e'::uuid, '140'),  -- 136 → 140  Cheese With Egg
    ('1c134d02-0e30-4075-88c8-32f11c178759'::uuid, '141'),  -- 137 → 141  Cheesy Chicken
    ('e3a58c19-938e-48a1-b09a-43c6382d4bc4'::uuid, '142'),  -- 138 → 142  Mozzarella Cheese
    ('52f6db56-c60f-4b88-9d03-23619b9f8387'::uuid, '143'),  -- 139 → 143  Cheesy Tuna
    ('6196228c-fd6a-4a09-8ab1-40fbec0c061d'::uuid, '144'),  -- 140 → 144  Labnah & Thyme
    ('11717e1e-d535-43bd-8021-1ee76695399f'::uuid, '145'),  -- 141 → 145  Orchid Pizza
    ('8dc209dc-062a-452e-8174-b9b98dafd5aa'::uuid, '146'),  -- 142 → 146  Hawaiian Pizza
    ('5ae4bc3b-8106-4190-be5a-9245bb047105'::uuid, '147'),  -- 143 → 147  Vegetables Pizza
    ('1af84b73-4096-4109-a3c7-8d66bb4741e3'::uuid, '148'),  -- 144 → 148  Pepperoni Pizza
    ('c84e4361-3caa-4b7d-8b37-99a7bc4111da'::uuid, '149'),  -- 145 → 149  Lamb Pizza
    ('cc4fc690-dae1-4349-a05d-56dcc2b3119b'::uuid, '150'),  -- 146 → 150  Chicken Pizza
    ('cf974ed0-de6f-4df3-9097-c5ea26efab82'::uuid, '151'),  -- 147 → 151  Margherita Pizza
    ('a1852fe9-fbe5-4c1f-9bca-d7e6c484c045'::uuid, '152'),  -- 148 → 152  Chicken Cream Pasta
    ('70204bd9-86ec-4273-ba33-0600e76ecb19'::uuid, '153'),  -- 149 → 153  Meat Pasta
    ('29a06491-880f-4b52-88ec-57ac71a042fb'::uuid, '154'),  -- 150 → 154  Chicken Pasta
    ('a3ecafa6-a833-4eb0-9c21-3b282ae74995'::uuid, '155'),  -- 151 → 155  Vegetables Pasta
    ('3cebf884-e216-4a40-8ae1-68e1f00e397b'::uuid, '156'),  -- 152 → 156  Carbonara Pasta
    ('fbbda808-2f47-4773-8b31-e395c79a3932'::uuid, '157'),  -- 176 → 157  Fruits Platter Small
    ('137263ed-c952-42a3-bacc-4d6ec414c49e'::uuid, '158'),  -- 177 → 158  Fruits Platter Large
    ('dd5c6b28-1d31-4ba6-96c5-927d1941ce86'::uuid, '159'),  -- 170 → 159  Cream Caramel
    ('c44cafa2-8dfb-48a9-82d6-f3f4013c67c2'::uuid, '160'),  -- 171 → 160  Kunafa Cheese
    ('f8f1d6fb-99f1-47d5-83d3-445e8c40470c'::uuid, '161'),  -- 172 → 161  Arabic Sweets
    ('19b29501-c658-489e-9f89-b9ed0a4fbad2'::uuid, '162'),  -- 173 → 162  Kunafa Ice Cream
    ('4b953d5a-c7bf-4ad2-ba18-25bc4f404cef'::uuid, '163'),  -- 174 → 163  Mouhalabiah
    ('2f7e3d07-42ce-4a57-9a87-50b6e9fc7a45'::uuid, '164'),  -- 175 → 164  Banana Split
    ('3cb83335-e93d-4dd8-a94e-dbf1edc7ae92'::uuid, '165'),  -- 153 → 165  Orchid Special Brownies
    ('a094d62a-ebd1-4049-b643-f32f0c21df39'::uuid, '166'),  -- 154 → 166  Special Kunafa Crepe
    ('527c8331-a8e2-4bea-a489-463af2bdedf0'::uuid, '167'),  -- 155 → 167  Brownie Pistachio Pancake
    ('02928904-8647-43c9-903d-7b1e5987757d'::uuid, '168'),  -- 156 → 168  Red Velvet Kunafa
    ('cb3365e1-c33d-4e66-b851-274679d61206'::uuid, '169'),  -- 157 → 169  Pistachio Kunafa
    ('c596c9e0-5ea5-4791-80fa-d9b0b59be0f9'::uuid, '170'),  -- 158 → 170  Lotus Kunafa
    ('36c8920e-3ea7-40d4-bd34-287b7f47105d'::uuid, '171'),  -- 159 → 171  Chocolate Kunafa
    ('ae301438-12bb-46fe-940a-8d220f4b91ac'::uuid, '172'),  -- 160 → 172  Marshmallow Sticks
    ('557b0890-ade1-429a-9044-a4a214f66278'::uuid, '173'),  -- 161 → 173  Strawberry Sticks
    ('ca8951b3-ca7e-4aeb-8f66-b5267fa7272e'::uuid, '174'),  -- 162 → 174  Banana Roll Crepe
    ('230a2de6-1898-4f57-8a84-339210a3a02d'::uuid, '175'),  -- 163 → 175  Fettuccine Crepe
    ('3140e066-0379-4520-9f7b-6d7897503f92'::uuid, '176'),  -- 164 → 176  Fruit Roll Crepe
    ('24f190dd-bae9-4053-9a6c-d940bb1f29a5'::uuid, '177'),  -- 165 → 177  Orchid Crepe
    ('aca730d8-f53e-419b-983f-a1e7f9f0ea7b'::uuid, '178'),  -- 166 → 178  Kit-Kat Waffle
    ('6c382215-76a1-4ad5-bb4e-59134d29f844'::uuid, '179'),  -- 167 → 179  Lotus Crepe
    ('f993fb15-0706-475b-95ca-e011e77b4ca5'::uuid, '180'),  -- 168 → 180  Lotus Waffle
    ('6de49b84-cab4-4f55-9a0f-121d90362403'::uuid, '181'),  -- 169 → 181  Fruit Waffle
    ('e7f261cb-583f-41cf-92df-f49831ce3f86'::uuid, '182'),  -- 178 → 182  Orchid Mocktail
    ('035186e5-b234-43a1-97fb-12e68de57ce1'::uuid, '183'),  -- 179 → 183  Arayse Mocktail
    ('84799c2d-347f-4275-8340-236bafd10ffd'::uuid, '184'),  -- 180 → 184  Orchid Heart
    ('4951967f-d84f-4b0c-b3de-3b41f356a1df'::uuid, '185'),  -- 181 → 185  Hi Five
    ('7490ce2f-af70-4125-8c4d-097ea9b6ad81'::uuid, '186'),  -- 182 → 186  Power
    ('b68f6cea-da35-41f7-a789-6bb7bcdcf072'::uuid, '187'),  -- 183 → 187  Love Secret
    ('fe4d7064-8a95-4e52-82a8-ae5eda0422ea'::uuid, '188'),  -- 184 → 188  Dragonov
    ('beb63144-89c1-47d4-87d4-ffcdc15b00c2'::uuid, '189'),  -- 185 → 189  Fruit Dance
    ('68df88bf-5f44-40a5-be97-2d08c1c751de'::uuid, '190'),  -- 186 → 190  Tropical
    ('2e1d5dd3-a74c-4b90-bd18-1f77168755b8'::uuid, '191'),  -- 216 → 191  Mango Shake
    ('200002eb-c541-4b23-adb5-a528e46862c6'::uuid, '192'),  -- 188 → 192  Strawberry Milkshake
    ('8acc3680-9f08-4d68-8287-5cf3b62b34c3'::uuid, '193'),  -- 217 → 193  Avocado Shake
    ('28959cfc-3344-4c36-9b8d-1ca367a0ba8d'::uuid, '194'),  -- 193 → 194  Banana Milkshake
    ('5781117c-a2a7-4967-9d40-311792210a40'::uuid, '195'),  -- 189 → 195  Lotus Milkshake
    ('3e316c7b-2512-494a-a37e-00c120f34201'::uuid, '196'),  -- 190 → 196  Oreo Milkshake
    ('1f95d96f-f00f-4cb0-bee7-bb18f49e79fb'::uuid, '197'),  -- 192 → 197  Choco Milkshake
    ('7cc2724f-66ac-41aa-a022-7ce674b791b8'::uuid, '198'),  -- 194 → 198  Crazy Milkshake
    ('ea64bb53-a934-4692-b325-6ce30b123227'::uuid, '200'),  -- 196 → 200  Mix Berries Mojito
    ('82fb2493-7561-413b-9b35-4abf9be6fbfc'::uuid, '201'),  -- 197 → 201  Viber Mojito
    ('b584e4bf-1a10-4fbd-9161-4d66a6967de0'::uuid, '203'),  -- 199 → 203  3D Mojito
    ('16a89930-224c-46ed-a890-553c139d0a2d'::uuid, '204'),  -- 200 → 204  Kiwi Mojito
    ('6d07d567-526f-4ae5-becf-59baad466b4c'::uuid, '205'),  -- 201 → 205  Blue Hawaii Mojito
    ('fc00ddcf-e536-4dac-98c4-49b036383ca1'::uuid, '206'),  -- 202 → 206  Pineapple & Orange Juice
    ('bdbe7925-3529-4e6c-9068-a019d802ade9'::uuid, '207'),  -- 203 → 207  Carrots & Orange Juice
    ('33a0faf9-acc8-4f5c-8660-1b251752ca0c'::uuid, '208'),  -- 204 → 208  Lemon & Mint Juice
    ('bfce2c98-988d-4371-a1b5-cffc80387413'::uuid, '209'),  -- 205 → 209  Pineapple Juice
    ('2e087e0a-7dce-46fd-b6ce-067cbe1e19cd'::uuid, '210'),  -- 206 → 210  Watermelon Juice
    ('9803e968-c811-4497-9f81-faef4ea0977e'::uuid, '211'),  -- 207 → 211  Orange Juice
    ('418565e0-2a61-4a6e-bb08-3dd2bdfcb8f9'::uuid, '212'),  -- 208 → 212  Mango Juice
    ('214b824e-6b0b-4b00-a9fd-c664319293e6'::uuid, '213'),  -- 209 → 213  Strawberry Juice
    ('95211027-bd85-4e6a-88c0-17a2b49522bc'::uuid, '214'),  -- 210 → 214  Lemon Juice
    ('b41df0d8-7a90-4ac0-97d1-c45a382f4769'::uuid, '215'),  -- 211 → 215  Kiwi Juice
    ('22348989-0d93-4ff4-a787-71a42f136931'::uuid, '216'),  -- 212 → 216  Carrots Juice
    ('a4b1d542-e842-4f22-b1b8-41f191471fa5'::uuid, '217'),  -- 213 → 217  Apples Juice
    ('d00e24ab-3588-495d-bbeb-7a6be7c666a8'::uuid, '218'),  -- 214 → 218  Melon Juice
    ('b4e8cace-f1b3-41f0-b2ea-7696ad823da2'::uuid, '219'),  -- 215 → 219  Ayran
    ('5713e97c-e0e1-46e9-9647-b3a9a6d10302'::uuid, '220'),  -- 218 → 220  Jack''s Family Juice
    ('794627ba-270d-4236-9c89-b0b65ad8a391'::uuid, '221'),  -- 219 → 221  Fresh Natural Coconut
    ('b6edd3c9-c742-4072-a195-72e61f2a376f'::uuid, '222'),  -- 220 → 222  Mango Passion
    ('909f8f7a-d77b-4545-b9c1-b37852825c26'::uuid, '223'),  -- 221 → 223  Mango Strawberry
    ('6f1d4f2e-b3ad-4aed-9e7c-8da6e4c3e48d'::uuid, '224'),  -- 222 → 224  Mango Dragon
    ('8a933bd4-aacd-454a-bdac-d3b22339246c'::uuid, '226'),  -- 224 → 226  Passion Ice Lemon Tea
    ('7e5c265d-a22c-419c-8ffc-8425611b317b'::uuid, '227'),  -- 225 → 227  Peach Ice Lemon Tea
    ('ab0bd54b-7385-479c-8e07-2139a97ec2c2'::uuid, '228'),  -- 226 → 228  Ice Milo
    ('ee3a727d-55cc-43b1-82b3-036b5d57254f'::uuid, '229'),  -- 227 → 229  Ice Nescafe
    ('d5e7be42-917f-45f9-a225-81dab2abbade'::uuid, '235'),  -- 228 → 235  Barbican
    ('4513f4af-0d21-4ac6-9727-e599f75b4bcc'::uuid, '236'),  -- 229 → 236  Soft Drinks
    ('cfec25d0-fb2d-48ac-b2ac-0f71d0870d10'::uuid, '237'),  -- 230 → 237  Mineral Water
    ('b391aa13-d3eb-4c68-a782-312614d21ded'::uuid, '238'),  -- 231 → 238  Vimto Grape
    ('d015596f-a3fd-44c5-a787-818b065410ec'::uuid, '239'),  -- 232 → 239  Tea O Ice
    ('c3c9e46f-2b47-4681-94a4-550cba656dbd'::uuid, '240'),  -- 233 → 240  Ice Lemon Tea
    ('a98184d2-7f29-4aa0-b276-863e795f8bc3'::uuid, '241'),  -- 234 → 241  Dark Chocolate Frappy
    ('5c3f8c10-267d-46ed-9069-ca6496ab5286'::uuid, '242'),  -- 235 → 242  Mocha Coffee Frappy
    ('bef9d69c-4382-4991-8916-2f3974fb9892'::uuid, '243'),  -- 236 → 243  Caramel Coffee Frappy
    ('4402879d-7074-4b35-a73c-2722f4df0c8d'::uuid, '244'),  -- 237 → 244  Hazelnut Coffee Frappy
    ('dca9e5db-0ba2-4bd7-a08b-06f0b45c0b6b'::uuid, '245'),  -- 238 → 245  Zhourat
    ('518db2ac-d58e-4ec3-ae41-baf366e3c749'::uuid, '246'),  -- 239 → 246  Roselle
    ('cd7160fc-5168-433a-a648-2501232f87f4'::uuid, '247'),  -- 240 → 247  Turkish Coffee
    ('f533945b-287b-423c-a908-c32537ca1e5e'::uuid, '248'),  -- 241 → 248  Hot Milo
    ('d00d50f7-4c27-4616-9b2d-2c25348571d9'::uuid, '249'),  -- 242 → 249  Hot Nescafe
    ('89fbab7b-809a-43f6-82b0-7eebfadb701f'::uuid, '250'),  -- 243 → 250  Mocha
    ('c69646ca-28dd-462a-bd69-8cfd13b7ac37'::uuid, '252'),  -- 244 → 252  Red Tea
    ('a4753ade-2e71-4c42-8018-d8533005c44a'::uuid, '253'),  -- 245 → 253  Green Tea
    ('2299c4f4-0ff4-49ad-b019-c68360ce0fc8'::uuid, '254'),  -- 246 → 254  Cafe Latte
    ('dfe906a4-8b32-4402-a2d4-ded7bdcc5615'::uuid, '255'),  -- 247 → 255  Americano
    ('45e82f61-e4d5-438b-9871-1d3207f38abb'::uuid, '256'),  -- 248 → 256  Fresh Milk
    ('ccb38587-5f86-422d-9484-93fbb1935951'::uuid, '257'),  -- 249 → 257  Espresso Single
    ('165a1423-2f24-4ae8-b68b-d865fdd862fa'::uuid, '258'),  -- 250 → 258  Espresso Double
    ('4e4bfaa8-e9ba-41d0-b1b4-eb9368c67c2e'::uuid, '259'),  -- 251 → 259  Cappuccino
    ('23154607-3c8d-4ceb-b02a-c9f8e70eb586'::uuid, '260'),  -- 252 → 260  Lemon Ginger Honey
    ('37025d2d-b3f2-4a8b-9f0f-b33079aebdf8'::uuid, '261'),  -- 253 → 261  Milk Tea
    ('60a3f80e-cacb-42d8-bee7-48686edc6127'::uuid, '262'),  -- OR-461 → 262  jug ice water
    ('ff12e906-9067-4251-b61a-8655a1600357'::uuid, '263'),  -- OR-458 → 263  ice water
    ('725602c2-ab8c-400a-9da9-8947d63f0e8c'::uuid, '264'),  -- OR-459 → 264  worm water
    ('27bede4a-e64b-4bde-a2ff-eb1bc61670a7'::uuid, '265'),  -- OR-462 → 265  jug ice lemon tea
    ('5a36ad15-822f-43f2-ae28-9d28b15a5920'::uuid, '266'),  -- OR-463 → 266  jug tea o ice
    ('ad220cff-abb9-4500-87c9-d1b481582e7d'::uuid, '267'),  -- OR-465 → 267  1 Bread
    ('3a816363-7ae2-4860-b07b-4383bac8639e'::uuid, '301'),  -- 120 → 301  1/2 Meter Seafood
    ('5c859571-945f-49d0-8241-ee6ffda6083f'::uuid, '302'),  -- 122 → 302  1/2 Meter Grills
    ('b7f69a0b-f955-40a2-9c9d-4a693729da06'::uuid, '303'),  -- 127 → 303  Fried Prawn
    ('3eba22c8-d044-41fb-bc60-3ba319842022'::uuid, '304'),  -- 187 → 304  Vanilla Milkshake
    ('cb28e7cc-9a6e-4ef2-93e0-205949b20dc6'::uuid, '305'),  -- 191 → 305  Cookies
    ('2e4a4fda-a250-4d6a-ad4f-deb4b666f218'::uuid, '306'),  -- 195 → 306  Watermelon Mojito
    ('08585d3c-7e01-43b7-abe1-b301bc2376eb'::uuid, '307'),  -- 198 → 307  Strawberry Mojito
    ('b92edf5b-71c9-4393-87fa-810d84544b64'::uuid, '308'),  -- 256 → 308  Shisha
    ('5c2995f1-4577-4e5b-b257-4d1eaea28ec1'::uuid, '309')  -- 258 → 309  super shisha
  ) as v(id, new_code)
 where m.id = v.id
   and m.branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1';

commit;

notify pgrst, 'reload schema';
