-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة أسماء أحجام الأصناف (menu_item_sizes) إلى الماليزية
--  شغّل بعد db/menu_i18n_ms.sql (الأعمدة). آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

-- ساخن / بارد
update menu_item_sizes set name_ms = 'Panas'  where id in ('e90e4b4a-8fce-4c41-9522-a2076049bb50','76e79aaa-8957-40ba-99a6-9385fc457b7e','cf3c1a0e-c286-4300-97c4-9592df80dbf2');
update menu_item_sizes set name_ms = 'Sejuk'  where id in ('f059f77a-e194-4264-8e6d-e8d0f2b3d826','e80efdbf-ca7d-4bc1-bb54-8d3b647f8d63','fc22aa08-e50c-4006-98c0-98047c031c86');

-- نصف / ربع (حصص الأرز)
update menu_item_sizes set name_ms = 'Setengah' where id in (
  '1cdb0d3a-35f4-4eb8-a053-bf64f3c19ae2','c2335053-2cef-4afd-9b8b-0b907ae019ee','6c892db6-e92e-42d5-a56e-d77732b0a4ee',
  '043b5aaf-41c3-44b8-aea5-d2b9f2a06362','44c11fdb-6c99-44a8-b70a-dbe61fa87afe','5553e32f-e757-4d7d-97fc-aab7608f658d',
  '8f437bed-b502-4155-881c-75d6906f5a82');
update menu_item_sizes set name_ms = 'Suku' where id in (
  '4c2090ec-bf17-4f7e-be0e-c1c32707108f','a7ef49d4-b1cc-42f5-989e-171db92c5407','2af96889-33a8-49de-b972-2b047651f633',
  '39943c6d-4cb6-4c5e-ad26-ef5d1658323e','508836c0-3a45-4111-bfb8-7b7f9849cad7','fe971aa0-0c18-4a18-bc09-de67319335e0',
  '406faf77-569a-4484-bbf7-a743b7eecd45');

-- كاسة / إبريق (المشروبات الساخنة)
update menu_item_sizes set name_ms = 'Cawan' where id in (
  '2afb6d22-7387-465c-9bd2-8b3a2fde802f','e6ff5294-5459-4fe5-95b6-fcb505f51a73','f66b167c-39f5-41be-bbf0-38a943738ee0',
  'a7c78cdb-fd38-4020-8f68-5b59830146e8');
update menu_item_sizes set name_ms = 'Teko' where id in (
  '5e352dc9-4302-407d-baec-7e06a86b8356','b19a984f-0eb5-4ba4-9d85-3057870f8bd4','895335a5-0f5b-4181-bfa8-a4ccf8859179',
  'c8b1e8c5-a5e6-4057-bea2-5b1979513121');

-- قطعيات اللحم
update menu_item_sizes set name_ms = 'Betis' where id in (
  'd07e2ad5-5c26-4afb-8d68-33376fc7d47f','63839295-f664-49fd-9fde-fd8b084efb33','755bc22d-4d87-4ef9-96de-0e320e45dafe',
  '0515f3d9-a332-4b92-80ed-a362231794ea','d775622f-4555-4019-a104-29e25fd59098','dd235fab-d09f-4de8-b334-95e5033e53fb',
  '0f560d1b-94de-461b-9a60-ed15620c92f7');
update menu_item_sizes set name_ms = 'Bahu' where id in (
  '57c0bf67-1d6e-4d35-8b0b-116bc1ec16a4','4476ba65-055f-4693-ba8a-30a1f771fac1','e5fee82d-1d67-4b88-855a-4485ed989a7a',
  '3b9be24d-4daf-4d7b-985c-d82c866a94c5','08035db3-ec90-459a-b4b1-39bd8233762c','1c0799f9-abc3-4ab2-bf1e-f61eb97ef177',
  'bda62e61-dd6c-4806-85dd-b8fba8bfd3b3');
update menu_item_sizes set name_ms = 'Rusuk'   where id = 'fd622732-3b00-42ad-a6a9-8bc0631c4b9e';

-- منسف: لحم / دجاج
update menu_item_sizes set name_ms = 'Kambing' where id = '04345187-4611-47eb-8c1c-2c0869138f5e';
update menu_item_sizes set name_ms = 'Ayam'    where id = 'dfb72253-c9d2-468d-96d4-8545260b457a';

-- سبرينغ رول
update menu_item_sizes set name_ms = 'Daging' where id = '29ef1ab5-7394-481a-8d8f-0e37b6b3c3a9';
update menu_item_sizes set name_ms = 'Sayur'  where id = 'e7e30865-8d76-4e0e-8d8f-99dcf8fd16f1';
update menu_item_sizes set name_ms = 'Keju'   where id = '92fd2094-fd0b-4366-a735-d5c13ab59df6';

-- مشروبات غازية (أسماء تجارية تبقى كما هي)
update menu_item_sizes set name_ms = 'Pepsi Zero' where id = 'bf5eb1dd-2aed-49ab-b1eb-3634925bc1e6';
update menu_item_sizes set name_ms = 'Pepsi'      where id = '9e702413-c682-429b-a1cb-c9ad4ba6d085';
update menu_item_sizes set name_ms = 'Cola Zero'  where id = '88069b14-c09f-4ce9-a9e5-6f467aa4994d';
update menu_item_sizes set name_ms = 'Cola'       where id = '3100b14a-2836-4cf0-879d-a33f51146311';
update menu_item_sizes set name_ms = 'DEW'        where id = 'b15ad842-0795-4e44-a39a-c31943e3dc7c';
update menu_item_sizes set name_ms = 'Sprite'     where id = '18e0e7ec-8404-4a09-84be-042f6618dd06';
update menu_item_sizes set name_ms = '100 Plus'   where id = 'b5bd339e-ca18-453c-850c-f53cc1a5be33';
update menu_item_sizes set name_ms = '7UP'        where id = '88ad68ed-17c3-4576-abf0-97a42cdf1967';

-- الشيشة
update menu_item_sizes set name_ms = 'Gula-gula Getah Pudina'                             where id = '0d371e93-3a8c-416e-8519-d55e60e0d077';
update menu_item_sizes set name_ms = 'Maksimum 2 perisa dibenarkan — sila nyatakan dalam nota' where id = '8c1904a5-a469-4e10-b00b-43080901dfa2';
update menu_item_sizes set name_ms = 'Tembikai'   where id = '2e22819d-66d5-4fc0-bdea-87bad654dfd3';
update menu_item_sizes set name_ms = 'Strawberi'  where id = '621ab25f-633d-4b08-8b9a-6cdd477838d0';
update menu_item_sizes set name_ms = 'Bluberi'    where id = 'd0ebf92d-ecf2-40cf-984a-ab62d312e8d7';
update menu_item_sizes set name_ms = 'Beri'       where id = 'a01c146c-dd4a-4468-b57f-eb9c632e89e7';
update menu_item_sizes set name_ms = 'Redbull'    where id = 'bc091a77-b221-4d8f-b81c-a3b00f70ca90';
update menu_item_sizes set name_ms = 'Mangga'     where id = 'a4f51696-abd2-48ab-9ab8-d5612fa5bc6c';
update menu_item_sizes set name_ms = 'Vanila'     where id = '894dda62-eea7-4ae2-be97-f9a54392ba28';
update menu_item_sizes set name_ms = 'Honeydew'   where id = 'fc45c3aa-9c7d-4d35-a75c-1d25460821cc';
update menu_item_sizes set name_ms = 'Pic'        where id = 'a5e65229-0a87-4b0e-8ba5-8f11da45f88c';
update menu_item_sizes set name_ms = 'Anggur'     where id = 'ad5cdd6c-d478-4037-9ecb-e7941ee09762';
update menu_item_sizes set name_ms = 'Laici'      where id = '4caf398c-900e-4b6c-8101-b32f91cd5b62';
update menu_item_sizes set name_ms = 'Love 66'    where id = '7b30b1fe-c30c-4aff-ad1b-c1e635c9b437';
update menu_item_sizes set name_ms = 'M Love'     where id = 'eca982ce-f44b-409c-aaf6-7db70c8f8d33';
update menu_item_sizes set name_ms = 'Kiwi'       where id = '86cfcafb-f4dc-4387-b123-713b8d6caa4f';
update menu_item_sizes set name_ms = 'Lemon'      where id = '6d3ca0ea-cf09-4b38-a613-2ba0a578d1d7';
update menu_item_sizes set name_ms = 'Oren'       where id = 'fd736e2c-c465-4039-b1b0-7c7b4cb3c182';
update menu_item_sizes set name_ms = 'Tukar Kepala' where id = 'ed86200c-0914-4ea3-850d-1a6df3da2f23';
update menu_item_sizes set name_ms = 'Pudina'     where id = '2a8fe155-4193-4489-b6ad-23fd3d906945';
update menu_item_sizes set name_ms = 'Dua Epal'   where id = '141aaec8-8fab-4115-bf83-f782a0c37601';

notify pgrst, 'reload schema';
