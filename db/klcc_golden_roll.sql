-- ══════════════════════════════════════════════════════════════════════════════
--  KLCC فقط: كباب بيتي (رقم 120) = "Golden Roll" في المنيو الجديد — تحديث الاسم الإنجليزي والوصف ليطابقا الـPDF
-- ══════════════════════════════════════════════════════════════════════════════
--  • الصنف: 6e7ba62f-dd85-47a8-b026-502a036b0ccf (فرع Orchid KLCC). لا يغيّر الرقم ولا السعر ولا الاسم العربي، ولا يمس فرع Orchid House.
--  • الاسم العربي يبقى «كباب بيتي».
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

update menu_items set
  name_en        = 'Golden Roll',
  description    = 'لحم متبّل مشوي ملفوف بخبز، يُقدَّم مع لبن كريمي على الجانب',
  description_en = 'Grilled spiced meat wrapped in flat bread. Served with a side of creamy yogurt',
  description_ms = 'Daging berempah panggang dibalut roti pipih, dihidang bersama yogurt berkrim',
  description_zh = '香料烤肉卷入薄饼，配奶油酸奶',
  description_ru = 'Жареное пряное мясо, завёрнутое в лепёшку. Подаётся с йогуртом'
 where id = '6e7ba62f-dd85-47a8-b026-502a036b0ccf'
   and branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1';

notify pgrst, 'reload schema';
