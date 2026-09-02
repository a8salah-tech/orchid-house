'use client'


import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams } from 'next/navigation'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ══ Orchid House Brand Colors — Light Theme ══
const C = {
  bg:        '#FFFFFF',   // white background
  bg2:       '#FFFFFF',   // card
  bg3:       '#FFFFFF',   // header
  blue1:     '#00FFFF',   // cyan (primary)
  blue2:     '#00A8A8',   // darker cyan (keeps white text readable on top of it)
  blue3:     '#0891B2',   // mid cyan (secondary accent)
  silver:    '#4B4358',   // dark secondary text
  silver2:   '#8A7F97',   // muted text
  white:     '#2A2233',   // primary dark text (on white background)
  white2:    '#3D3348',
  border:    'rgba(0,180,180,0.25)',
  border2:   'rgba(0,180,180,0.45)',
  glow:      'rgba(0,200,200,0.15)',
  glow2:     'rgba(0,200,200,0.35)',
}

type Category = {
  id: string; name: string; name_en: string; destination: string
  available_days?: number[] | null; available_from?: string | null; available_to?: string | null
  time_badge_ar?: string | null; time_badge_en?: string | null
}
type MenuItem  = { id: string; name: string; name_en: string; price: number; discount_percent?: number; description: string; description_en: string; category_id: string; is_available: boolean; image_url?: string; sizes?: { id: string; name: string; name_en: string; price: number; is_active: boolean }[] }
type CartItem  = { item: MenuItem; quantity: number; notes: string; selectedSize?: { id: string; name: string; name_en: string; price: number } | null }
type Phase     = 'language' | 'welcome' | 'rewards' | 'menu' | 'cart' | 'done'

// ══ اللغات المدعومة في واجهة العميل (المرحلة ١: ماليزي / إنجليزي / عربي) ══
type Lang = 'ms' | 'en' | 'ar'
const LANGS: { code: Lang; label: string; native: string; flag: string }[] = [
  { code: 'ms', label: 'Malay',   native: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'en', label: 'English', native: 'English',        flag: '🇬🇧' },
  { code: 'ar', label: 'Arabic',  native: 'العربية',         flag: '🇸🇦' },
]

// كل نصوص واجهة العميل × ٣ لغات. المفاتيح ثابتة، والقيم تُترجم.
// {x} = عنصر نائب يُستبدل وقت العرض. أسماء الأطباق تبقى من قاعدة البيانات (name / name_en).
const TR: Record<Lang, Record<string, string>> = {
  en: {
    lang_pick_title: 'Welcome to Orchid Group', lang_pick_sub: 'Please choose your language',
    loading: 'Loading menu…', table_not_found: 'Table not found',
    order_confirmed: '✨ Order Confirmed', order_being_prepared: 'Your order is being prepared!',
    order_prep_sub: 'Our kitchen team is working on your delicious meal. Sit back and relax! 🍽️',
    your_order_number: 'YOUR ORDER NUMBER', order_summary: 'ORDER SUMMARY',
    served_shortly: 'A team member will serve you shortly 🙏', order_more: '➕ Order More Items',
    restaurant_tag: 'ORCHID RESTAURANT', welcome_title: 'Welcome to Orchid',
    welcome_sub: 'Great food. Unforgettable moments.',
    perk_points_t: 'Earn Points', perk_points_s: 'with every visit',
    perk_offers_t: 'Exclusive Offers', perk_offers_s: 'just for members',
    perk_bday_t: 'Birthday Rewards', perk_bday_s: 'and more surprises',
    join_benefits: 'Join Orchid Rewards and enjoy exclusive benefits.',
    register_50: 'Register today and get 50 welcome points!',
    how_continue: 'How would you like to continue?',
    join_rewards: 'JOIN ORCHID REWARDS', join_rewards_s: 'Sign in or create an account',
    check_points: 'CHECK MY POINTS', check_points_s: 'See your balance & discount progress',
    continue_guest: 'CONTINUE AS GUEST', continue_guest_s: 'Browse menu and place your order',
    guest_note: "You can browse the menu and place an order as a guest, but you won't earn points or enjoy member benefits.",
    back: '‹ Back', rewards_title: 'Orchid Rewards', check_points_title: 'Check My Points',
    rewards_check_sub: 'Enter your mobile number to see your points balance.',
    rewards_join_sub: "Enter your mobile number — new or returning, we've got you covered.",
    mobile_number: 'Mobile number', your_name_new: 'Your name (for new members)',
    checking: 'Checking…', cont: 'Continue',
    welcome_name: 'Welcome, {x}!', welcome_back_name: 'Welcome back, {x}!',
    just_joined: "You've just joined Orchid Rewards", good_to_see: 'Great to see you again',
    points_balance: 'YOUR POINTS BALANCE', welcome_50_added: '🎁 +50 welcome points added!',
    discount_unlocked: "🎉 You've unlocked your discount! Show this to your waiter.",
    progress_discount: 'Progress to discount',
    earn_more_points: 'Earn {x} more points to unlock a special discount! 🎁',
    browse_menu: 'Browse Menu →',
    err_phone: 'Please enter a valid phone number', err_generic: 'Something went wrong, please try again',
    your_order: '🛒 Your Order', each: 'MYR {x} each',
    special_request: 'Special request… e.g. no onion',
    placing_order: '⏳ Placing order…', confirm_order: '✅ Confirm Order — {x} items',
    waiter_coming: '✅ On the way!', call_waiter: '🔔 Call Waiter',
    search_dishes: 'Search dishes…', cat_all: 'All', no_items: 'No items found',
    be_first_rate: '🆕 Be the first to rate', view_order: '🛒 View Order ({x} items)',
    add: 'Add', select_size: 'Select size:', pick_size_first: 'Please select a size first',
    ratings: '⭐ Reviews', rate_this: 'Rate this dish:',
    review_hint: 'Your opinion on taste & quality — shown to guests after we review it. For special requests like "no onion", use the note field when you confirm your order.',
    review_placeholder: 'Share your thoughts on taste & quality… (optional)',
    your_name_opt: 'Your name (optional)', pick_stars_first: 'Please select a star rating first',
    review_thanks: '✅ Thanks! Your review is pending approval and will appear soon.',
    already_reviewed: '✅ You already reviewed this dish — thank you!',
    rate_dishes_t: '🌟 Rate your dishes', rate_dishes_s: 'How was your meal? Your rating helps us (shown after review).',
    kitchen_note_label: '🍳 Note for the kitchen (optional)',
    submitting: 'Submitting…', submit_review: 'Submit Review', no_comments: 'No comments yet',
    guest: 'Guest', n_ratings: '{x} ratings', no_ratings_yet: '🆕 No ratings yet — be the first to rate this dish',
    err_order_send: '⚠️ Something went wrong sending your order. Please try again or call the waiter.',
    game_teaser_t: "While you wait… Who's Paying the Bill?", game_teaser_s: 'Spin the wheel and let fate decide! 🎉',
    game_play: '🎮 Play the Game', game_short_t: "🎲 Who's Paying?", game_bill_goes: 'And the bill goes to…',
    game_share: '📤 Share the result', game_again: '🔄 Play Again', game_people: 'Number of People',
    game_person_n: 'Person {x} name', game_phone: '📱 Mobile number (required) *',
    game_spinning: '🎰 Spinning…', game_spin: '🎰 Spin the Wheel!',
    game_fun_note: '🎉 Just for fun — not a real payment decision!', game_need_phone: 'Please enter a mobile number to play',
    follow_t: 'Did we make your evening special? 🌸', follow_s: 'Follow us & share your experience',
    act_rate: 'Rate us', act_follow: 'Follow', act_like: 'Like', act_review: 'Review', act_visit: 'Visit',
  },
  ms: {
    lang_pick_title: 'Selamat Datang ke Orchid Group', lang_pick_sub: 'Sila pilih bahasa anda',
    loading: 'Memuatkan menu…', table_not_found: 'Meja tidak dijumpai',
    order_confirmed: '✨ Pesanan Disahkan', order_being_prepared: 'Pesanan anda sedang disediakan!',
    order_prep_sub: 'Pasukan dapur kami sedang menyediakan hidangan anda. Duduk dan berehat! 🍽️',
    your_order_number: 'NOMBOR PESANAN ANDA', order_summary: 'RINGKASAN PESANAN',
    served_shortly: 'Ahli pasukan kami akan melayan anda sebentar lagi 🙏', order_more: '➕ Pesan Lagi',
    restaurant_tag: 'RESTORAN ORCHID', welcome_title: 'Selamat Datang ke Orchid',
    welcome_sub: 'Makanan hebat. Detik tidak terlupakan.',
    perk_points_t: 'Kumpul Mata', perk_points_s: 'setiap kunjungan',
    perk_offers_t: 'Tawaran Eksklusif', perk_offers_s: 'untuk ahli sahaja',
    perk_bday_t: 'Ganjaran Hari Jadi', perk_bday_s: 'dan lebih banyak kejutan',
    join_benefits: 'Sertai Orchid Rewards dan nikmati manfaat eksklusif.',
    register_50: 'Daftar hari ini dan dapat 50 mata selamat datang!',
    how_continue: 'Bagaimana anda ingin teruskan?',
    join_rewards: 'SERTAI ORCHID REWARDS', join_rewards_s: 'Log masuk atau cipta akaun',
    check_points: 'SEMAK MATA SAYA', check_points_s: 'Lihat baki & kemajuan diskaun anda',
    continue_guest: 'TERUSKAN SEBAGAI TETAMU', continue_guest_s: 'Lihat menu dan buat pesanan',
    guest_note: 'Anda boleh melihat menu dan membuat pesanan sebagai tetamu, tetapi anda tidak akan mengumpul mata atau menikmati manfaat ahli.',
    back: '‹ Kembali', rewards_title: 'Orchid Rewards', check_points_title: 'Semak Mata Saya',
    rewards_check_sub: 'Masukkan nombor telefon anda untuk melihat baki mata.',
    rewards_join_sub: 'Masukkan nombor telefon anda — baharu atau sedia ada, kami uruskan.',
    mobile_number: 'Nombor telefon', your_name_new: 'Nama anda (untuk ahli baharu)',
    checking: 'Menyemak…', cont: 'Teruskan',
    welcome_name: 'Selamat datang, {x}!', welcome_back_name: 'Selamat kembali, {x}!',
    just_joined: 'Anda baru sahaja menyertai Orchid Rewards', good_to_see: 'Gembira berjumpa anda lagi',
    points_balance: 'BAKI MATA ANDA', welcome_50_added: '🎁 +50 mata selamat datang ditambah!',
    discount_unlocked: '🎉 Anda telah membuka diskaun! Tunjukkan ini kepada pelayan.',
    progress_discount: 'Kemajuan ke diskaun',
    earn_more_points: 'Kumpul {x} mata lagi untuk membuka diskaun istimewa! 🎁',
    browse_menu: 'Lihat Menu →',
    err_phone: 'Sila masukkan nombor telefon yang sah', err_generic: 'Sesuatu tidak kena, sila cuba lagi',
    your_order: '🛒 Pesanan Anda', each: 'MYR {x} seunit',
    special_request: 'Permintaan khas… cth. tanpa bawang',
    placing_order: '⏳ Menghantar pesanan…', confirm_order: '✅ Sahkan Pesanan — {x} item',
    waiter_coming: '✅ Dalam perjalanan!', call_waiter: '🔔 Panggil Pelayan',
    search_dishes: 'Cari hidangan…', cat_all: 'Semua', no_items: 'Tiada item dijumpai',
    be_first_rate: '🆕 Jadi yang pertama menilai', view_order: '🛒 Lihat Pesanan ({x} item)',
    add: 'Tambah', select_size: 'Pilih saiz:', pick_size_first: 'Sila pilih saiz dahulu',
    ratings: '⭐ Ulasan', rate_this: 'Nilai hidangan ini:',
    review_hint: 'Pendapat anda tentang rasa & kualiti — dipaparkan kepada tetamu selepas kami semak. Untuk permintaan khas seperti "tanpa bawang", gunakan ruangan nota semasa mengesahkan pesanan.',
    review_placeholder: 'Kongsi pendapat anda tentang rasa & kualiti… (pilihan)',
    your_name_opt: 'Nama anda (pilihan)', pick_stars_first: 'Sila pilih penilaian bintang dahulu',
    review_thanks: '✅ Terima kasih! Ulasan anda menunggu kelulusan dan akan dipaparkan tidak lama lagi.',
    already_reviewed: '✅ Anda sudah menilai hidangan ini — terima kasih!',
    rate_dishes_t: '🌟 Nilai hidangan anda', rate_dishes_s: 'Bagaimana hidangan anda? Penilaian anda membantu kami (dipaparkan selepas semakan).',
    kitchen_note_label: '🍳 Nota untuk dapur (pilihan)',
    submitting: 'Menghantar…', submit_review: 'Hantar Ulasan', no_comments: 'Tiada komen lagi',
    guest: 'Tetamu', n_ratings: '{x} penilaian', no_ratings_yet: '🆕 Belum ada penilaian — jadi yang pertama menilai hidangan ini',
    err_order_send: '⚠️ Sesuatu tidak kena semasa menghantar pesanan anda. Sila cuba lagi atau panggil pelayan.',
    game_teaser_t: 'Sementara menunggu… Siapa Bayar Bil?', game_teaser_s: 'Pusing roda dan biar takdir menentukan! 🎉',
    game_play: '🎮 Main Permainan', game_short_t: '🎲 Siapa Bayar?', game_bill_goes: 'Dan bil jatuh kepada…',
    game_share: '📤 Kongsi keputusan', game_again: '🔄 Main Lagi', game_people: 'Bilangan Orang',
    game_person_n: 'Nama orang {x}', game_phone: '📱 Nombor telefon (wajib) *',
    game_spinning: '🎰 Berpusing…', game_spin: '🎰 Pusing Roda!',
    game_fun_note: '🎉 Sekadar seronok — bukan keputusan pembayaran sebenar!', game_need_phone: 'Sila masukkan nombor telefon untuk bermain',
    follow_t: 'Adakah kami menjadikan malam anda istimewa? 🌸', follow_s: 'Ikuti kami & kongsi pengalaman anda',
    act_rate: 'Nilai kami', act_follow: 'Ikuti', act_like: 'Suka', act_review: 'Ulas', act_visit: 'Lawati',
  },
  ar: {
    lang_pick_title: 'أهلاً بكم في أوركيد جروب', lang_pick_sub: 'اختر لغتك',
    loading: 'جارٍ تحميل المنيو…', table_not_found: 'الطاولة غير موجودة',
    order_confirmed: '✨ تم تأكيد الطلب', order_being_prepared: 'يتم تجهيز طلبك الآن!',
    order_prep_sub: 'فريق المطبخ يجهّز وجبتك اللذيذة. استرخِ واستمتع بوقتك! 🍽️',
    your_order_number: 'رقم طلبك', order_summary: 'ملخص الطلب',
    served_shortly: 'سيصلك أحد أفراد الفريق خلال لحظات 🙏', order_more: '➕ اطلب المزيد',
    restaurant_tag: 'مطعم أوركيد', welcome_title: 'أهلاً بك في أوركيد',
    welcome_sub: 'طعام رائع. لحظات لا تُنسى.',
    perk_points_t: 'اجمع النقاط', perk_points_s: 'مع كل زيارة',
    perk_offers_t: 'عروض حصرية', perk_offers_s: 'للأعضاء فقط',
    perk_bday_t: 'هدايا عيد الميلاد', perk_bday_s: 'ومفاجآت أخرى',
    join_benefits: 'انضم إلى Orchid Rewards واستمتع بمزايا حصرية.',
    register_50: 'سجّل اليوم واحصل على 50 نقطة ترحيبية!',
    how_continue: 'كيف تحب أن تكمل؟',
    join_rewards: 'انضم إلى ORCHID REWARDS', join_rewards_s: 'سجّل الدخول أو أنشئ حساباً',
    check_points: 'تحقق من نقاطي', check_points_s: 'اطّلع على رصيدك وتقدّمك نحو الخصم',
    continue_guest: 'المتابعة كضيف', continue_guest_s: 'تصفّح المنيو وأرسل طلبك',
    guest_note: 'يمكنك تصفّح المنيو وإرسال طلب كضيف، لكنك لن تجمع نقاطاً ولن تستفيد من مزايا الأعضاء.',
    back: '‹ رجوع', rewards_title: 'Orchid Rewards', check_points_title: 'تحقق من نقاطي',
    rewards_check_sub: 'أدخل رقم جوالك لعرض رصيد نقاطك.',
    rewards_join_sub: 'أدخل رقم جوالك — عضو جديد أو حالي، سنتكفّل بالباقي.',
    mobile_number: 'رقم الجوال', your_name_new: 'اسمك (للأعضاء الجدد)',
    checking: 'جارٍ التحقق…', cont: 'متابعة',
    welcome_name: 'أهلاً، {x}!', welcome_back_name: 'أهلاً بعودتك، {x}!',
    just_joined: 'لقد انضممت للتو إلى Orchid Rewards', good_to_see: 'سعداء برؤيتك مجدداً',
    points_balance: 'رصيد نقاطك', welcome_50_added: '🎁 تمت إضافة 50 نقطة ترحيبية!',
    discount_unlocked: '🎉 لقد فتحت خصمك! أظهر هذا للنادل.',
    progress_discount: 'التقدّم نحو الخصم',
    earn_more_points: 'اجمع {x} نقطة إضافية لفتح خصم خاص! 🎁',
    browse_menu: 'تصفّح المنيو ←',
    err_phone: 'يرجى إدخال رقم جوال صحيح', err_generic: 'حدث خطأ، يرجى المحاولة مرة أخرى',
    your_order: '🛒 طلبك', each: 'MYR {x} للوحدة',
    special_request: 'طلب خاص… مثال: بدون بصل',
    placing_order: '⏳ جارٍ إرسال الطلب…', confirm_order: '✅ تأكيد الطلب — {x} صنف',
    waiter_coming: '✅ في الطريق!', call_waiter: '🔔 نادِ النادل',
    search_dishes: 'ابحث عن الأطباق…', cat_all: 'الكل', no_items: 'لا توجد أصناف',
    be_first_rate: '🆕 كن أول من يقيّم', view_order: '🛒 عرض الطلب ({x} صنف)',
    add: 'إضافة', select_size: 'اختر الحجم:', pick_size_first: 'يرجى اختيار الحجم أولاً',
    ratings: '⭐ آراء الزوّار', rate_this: 'قيّم هذا الطبق:',
    review_hint: 'رأيك في الطعم والجودة — يظهر للزوّار بعد مراجعة الإدارة. للطلبات الخاصة مثل «بدون بصل» استخدم خانة الملاحظات عند تأكيد الطلب.',
    review_placeholder: 'شاركنا رأيك في الطعم والجودة… (اختياري)',
    your_name_opt: 'اسمك (اختياري)', pick_stars_first: 'يرجى اختيار عدد النجوم أولاً',
    review_thanks: '✅ شكراً لك! تقييمك قيد المراجعة وسيظهر قريباً.',
    already_reviewed: '✅ لقد قيّمت هذا الطبق — شكراً لك!',
    rate_dishes_t: '🌟 قيّم أطباقك', rate_dishes_s: 'كيف كانت وجبتك؟ تقييمك يساعدنا (يظهر بعد المراجعة).',
    kitchen_note_label: '🍳 ملاحظة للمطبخ (اختياري)',
    submitting: 'جارٍ الإرسال…', submit_review: 'إرسال التقييم', no_comments: 'لا توجد تعليقات بعد',
    guest: 'ضيف', n_ratings: '{x} تقييم', no_ratings_yet: '🆕 لا توجد تقييمات بعد — كن أول من يقيّم هذا الطبق',
    err_order_send: '⚠️ حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى أو مناداة النادل.',
    game_teaser_t: 'في انتظار طلبك… مَن سيدفع الفاتورة؟', game_teaser_s: 'أدر العجلة ودَع الحظ يقرر! 🎉',
    game_play: '🎮 العب اللعبة', game_short_t: '🎲 مَن سيدفع؟', game_bill_goes: 'والفاتورة على…',
    game_share: '📤 شارك النتيجة', game_again: '🔄 العب مجدداً', game_people: 'عدد الأشخاص',
    game_person_n: 'اسم الشخص {x}', game_phone: '📱 رقم الجوال (مطلوب) *',
    game_spinning: '🎰 تدور…', game_spin: '🎰 أدر العجلة!',
    game_fun_note: '🎉 للمتعة فقط — ليست وسيلة لتحديد من يدفع فعلاً!', game_need_phone: 'يرجى إدخال رقم جوال للعب',
    follow_t: 'هل جعلنا أمسيتك مميزة؟ 🌸', follow_s: 'تابعنا وشاركنا تجربتك',
    act_rate: 'قيّمنا', act_follow: 'تابع', act_like: 'أعجبني', act_review: 'راجعنا', act_visit: 'زيارة',
  },
}
// ✅ New: dish review — star rating (1-5) with an optional written comment and optional reviewer name
type Review    = { id: string; menu_item_id: string; stars: number; review_text: string | null; reviewer_name: string | null; created_at: string }

// ✅ Is this category currently available based on its configured day/time (no restrictions = always available)
function isCategoryAvailableNow(cat: Category): boolean {
  if (!cat.available_days && !cat.available_from && !cat.available_to) return true
  const now = new Date()
  const day = now.getDay() // 0=Sunday ... 6=Saturday
  if (cat.available_days && cat.available_days.length > 0 && !cat.available_days.includes(day)) return false
  if (cat.available_from || cat.available_to) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    if (cat.available_from) {
      const [h, m] = cat.available_from.split(':').map(Number)
      if (nowMinutes < h * 60 + m) return false
    }
    if (cat.available_to) {
      const [h, m] = cat.available_to.split(':').map(Number)
      if (nowMinutes >= h * 60 + m) return false
    }
  }
  return true
}

export default function CustomerMenuPage() {
  const params  = useParams()
  const tableId = params?.tableId as string
  const sbRef   = useRef(createClient())
  const sb      = sbRef.current

  const [table, setTable]           = useState<{ id: string; number: number; name: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems]           = useState<MenuItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [activeCat, setActiveCat]   = useState<string>('all')
  const [search, setSearch]         = useState('')
  const [cart, setCart]             = useState<CartItem[]>([])
  const [phase, setPhase]           = useState<Phase>('language')
  // ✅ لغة واجهة العميل — تُقرأ من localStorage، وشاشة الاختيار تظهر أول مرة فقط
  const [lang, setLangState]        = useState<Lang>('en')
  const t = (key: string, x?: string | number) => {
    const s = (TR[lang] && TR[lang][key]) || TR.en[key] || key
    return x != null ? s.replace('{x}', String(x)) : s
  }
  const isRtl = lang === 'ar'
  const dir: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr'
  function chooseLang(l: Lang) {
    setLangState(l)
    try { localStorage.setItem('orchid_menu_lang', l) } catch {}
    // من شاشة اختيار اللغة → ننتقل للترحيب. من المبدّل داخل الصفحات → نفضل مكاننا
    setPhase(p => (p === 'language' ? 'welcome' : p))
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem('orchid_menu_lang') as Lang | null
      if (saved && (saved === 'ms' || saved === 'en' || saved === 'ar')) {
        setLangState(saved)
        setPhase(p => (p === 'language' ? 'welcome' : p))
      }
    } catch {}
  }, [])
  // اسم الطبق/الوصف حسب اللغة: العربي يعرض الاسم العربي أولاً، غير كده الإنجليزي أولاً
  const dishName = (ar?: string, en?: string) => (lang === 'ar' ? (ar || en) : (en || ar)) || ''
  const [submitting, setSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null)
  // ✅ New: Orchid Rewards system - customer enters just their mobile number (no password); if already registered they see their points,
  // if new, they are registered automatically and earn 50 welcome points
  const [rewardsPhone, setRewardsPhone] = useState('')
  const [rewardsName, setRewardsName] = useState('')
  const [rewardsSubmitting, setRewardsSubmitting] = useState(false)
  const [rewardsError, setRewardsError] = useState('')
  const [rewardsResult, setRewardsResult] = useState<{ customerId: string; name: string; points: number; isNew: boolean } | null>(null)
  const [identifiedCustomerId, setIdentifiedCustomerId] = useState<string | null>(null)
  // ✅ New: whether the customer is here to "join" or just to "check their points" - only changes the displayed text, same lookup mechanism
  const [rewardsIntent, setRewardsIntent] = useState<'join' | 'check'>('join')
  // ✅ Points threshold required to unlock a discount - a single constant so it only needs to change in one place
  const DISCOUNT_POINTS_TARGET = 1000
  // ✅ New: full accumulated order items (all rounds combined) from the database - instead of relying on the local cart, which resets with each new order
  const [liveOrderItems, setLiveOrderItems] = useState<{ id: string; name: string; quantity: number; unit_price: number; size_name?: string | null; menu_item_id?: string | null }[]>([])
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedSize, setSelectedSize]   = useState<{ id: string; name: string; name_en: string; price: number } | null>(null)

  // ✅ New: dish rating system — stars and written comment for each item
  const [reviews, setReviews] = useState<Review[]>([])
  const [newReviewStars, setNewReviewStars] = useState(0)
  const [newReviewText, setNewReviewText] = useState('')
  const [reviewerName, setReviewerName] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  // ✅ تقييم واحد لكل طبق لكل جهاز (يُحفظ محليًا) — + التقييمات الجديدة تروح "قيد المراجعة" وما تظهرش إلا بعد اعتماد الإدارة
  const [reviewedItemIds, setReviewedItemIds] = useState<Set<string>>(new Set())
  // ✅ تقييم شاشة "تم الطلب": اختيار النجوم يفتح خانة تعليق اختيارية قبل الإرسال
  const [doneRating, setDoneRating] = useState<Record<string, { stars: number; text: string }>>({})
  const [doneRatingSending, setDoneRatingSending] = useState<string | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('orchid_reviewed_items')
      if (raw) setReviewedItemIds(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  // ✅ New: floating "+1" animation when adding an item to the cart — the latest trend seen in food apps worldwide
  const [flyingPlusOnes, setFlyingPlusOnes] = useState<{ id: number; x: number; y: number }[]>([])
  function triggerFlyPlusOne(e: { clientX: number; clientY: number }) {
    const id = Date.now() + Math.random()
    setFlyingPlusOnes(p => [...p, { id, x: e.clientX, y: e.clientY }])
    setTimeout(() => setFlyingPlusOnes(p => p.filter(f => f.id !== id)), 900)
  }
  // ✅ New: short visual pulse on the add button itself when tapped
  const [pulseKey, setPulseKey] = useState<string | null>(null)
  function bumpPulse(key: string) {
    setPulseKey(key)
    setTimeout(() => setPulseKey(k => (k === key ? null : k)), 400)
  }

  // ✅ "Who's Paying the Bill?" game - just for fun, no connection to the cashier or actual payment
  const [showPayGame, setShowPayGame] = useState(false)
  const [gamePhone, setGamePhone] = useState('')
  const [gameNames, setGameNames] = useState<string[]>(['', ''])
  const [gameSpinning, setGameSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [gameWinner, setGameWinner] = useState<string | null>(null)
  // ✅ Fix (critical): synchronous lock (not state) preventing confirmOrder from running more than once at the same instant.
  // The (submitting) state update is asynchronous (React batching), so if the customer taps the button more than once quickly
  // (very common on a slow network), confirmOrder() would actually run twice in parallel before the button gets disabled in the UI,
  // causing a conflict: one run succeeds while the other clashes and fails, while the second run is still in progress and the button stays stuck on "Placing order...".
  const isSubmittingRef = useRef(false)
  // ✅ We update "now" every minute so time-restricted categories automatically appear/disappear without the customer needing to refresh the page
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // ✅ زر الرجوع في الموبايل (خاصة سامسونج): بدل ما يخرج العميل من المنيو بالكامل، يقفل تفاصيل الوجبة
  // أو اللعبة، أو يرجّع خطوة داخل التطبيق (سلة → منيو، إلخ). نحتفظ بحالة واحدة في تاريخ المتصفح
  // ونعيد دفعها بعد كل رجوع نتعامل معه.
  const navRef = useRef<{ selectedItem: unknown; showPayGame: boolean; phase: Phase }>({ selectedItem: null, showPayGame: false, phase: 'language' })
  navRef.current = { selectedItem, showPayGame, phase }
  useEffect(() => {
    window.history.pushState({ menuGuard: true }, '')
    const onPop = () => {
      const s = navRef.current
      const rearm = () => window.history.pushState({ menuGuard: true }, '')
      if (s.selectedItem) { setSelectedItem(null); rearm(); return }
      if (s.showPayGame)  { setShowPayGame(false); rearm(); return }
      if (s.phase === 'cart')    { setPhase('menu'); rearm(); return }
      if (s.phase === 'rewards') { setPhase('welcome'); rearm(); return }
      if (s.phase === 'menu')    { setPhase('welcome'); rearm(); return }
      // welcome / language / done → نسمح بالخروج الطبيعي
      window.history.back()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // ✅ New: fetch all items of a given order (all rounds) from the database, so they display in full no matter how many rounds the customer ordered
  async function fetchLiveOrderItems(orderId: string) {
    const { data } = await sb.from('order_items')
      .select('id, menu_item_id, quantity, unit_price, size_name, status, menu_items(name, name_en)')
      .eq('order_id', orderId)
      .neq('status', 'cancelled')
    setLiveOrderItems((data || []).map((i: any) => ({
      id: i.id, menu_item_id: i.menu_item_id, quantity: i.quantity, unit_price: i.unit_price, size_name: i.size_name,
      name: i.menu_items?.name_en || i.menu_items?.name || '',
    })))
  }

  useEffect(() => {
    async function load() {
      const { data: tbl } = await sb.from('tables').select('*').eq('id', tableId).single()
      if (!tbl) { setNotFound(true); setLoading(false); return }
      setTable(tbl)
      const [cats, itms, revs] = await Promise.all([
        sb.from('menu_categories').select('id,name,name_en,destination,available_days,available_from,available_to,time_badge_ar,time_badge_en').eq('is_active', true).order('sort_order'),
        sb.from('menu_items') .select('id,name,name_en,price,discount_percent,description,description_en,category_id,is_available,image_url,sort_order,menu_categories(sort_order),sizes:menu_item_sizes(id,name,name_en,price,is_active)') .eq('is_available', true) .eq('is_active', true) ,
        // ✅ التقييمات المعتمدة فقط — التقييمات الجديدة تظهر بعد مراجعة الإدارة (status='approved')
        sb.from('menu_item_reviews').select('id,menu_item_id,stars,review_text,reviewer_name,created_at').eq('status', 'approved').order('created_at', { ascending: false })
      ])
      setCategories(cats.data || [])
      setItems(itms.data || [])
      setReviews(revs.data || [])
      // ✅ If the table already has an active order (not yet closed at the cashier), show the "Confirmed" screen directly
      // instead of the menu from scratch - the order stays visible to the customer as long as the table is open, even if they close and reopen the page
      const { data: existingOrders } = await sb.from('orders')
        .select('id').eq('table_id', tbl.id).in('status', ['confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: false }).limit(1)
      const existing = existingOrders?.[0]

      // ✅ Fix per user request: removed automatically following a redirect on full page load - the table is now
      // always free for anyone opening the page again after a redirect (even if the same old customer closes and reopens the page).
      // Following a redirected order is now limited to "Order More" only, if the customer still has the same tab open without closing it
      // (see checkAndFollowRedirect) - this fixes the duplicate-order issue without affecting a new customer seated afterward

      if (existing) {
        setConfirmedOrderId(existing.id)
        setOrderNumber(existing.id.slice(-6).toUpperCase())
        await fetchLiveOrderItems(existing.id)
        setPhase('done')
      }
      setLoading(false)
    }
    if (tableId) load()
  }, [tableId, sb])

// ✅ Currently available categories only (a time-restricted category automatically disappears outside its window)
const visibleCategories = categories.filter(isCategoryAvailableNow)
const visibleCategoryIds = new Set(visibleCategories.map(c => c.id))

const filteredItems = items
  .filter(i => visibleCategoryIds.has(i.category_id) || !categories.some(c => c.id === i.category_id))
  .filter(i => {
    const matchCat = activeCat === 'all' || i.category_id === activeCat
    const q = search.trim()
    return matchCat && (!q || i.name.includes(q) || i.name_en.toLowerCase().includes(q.toLowerCase()))
  })
  .sort((a, b) => {
    const aDiscount = (a.discount_percent || 0) > 0 ? 0 : 1
    const bDiscount = (b.discount_percent || 0) > 0 ? 0 : 1
    if (aDiscount !== bDiscount) return aDiscount - bDiscount
    const aCatOrder = (a as any).menu_categories?.sort_order ?? 99
    const bCatOrder = (b as any).menu_categories?.sort_order ?? 99
    if (aCatOrder !== bCatOrder) return aCatOrder - bCatOrder
    const aOrder = (a as any).sort_order ?? 0
    const bOrder = (b as any).sort_order ?? 0
    return aOrder - bOrder
  })

  useEffect(() => {
    if (activeCat !== 'all' && !visibleCategoryIds.has(activeCat)) setActiveCat('all')
  }, [activeCat, visibleCategoryIds])

  // ✅ New: reset the "add your rating" form every time the customer opens a different item
  useEffect(() => {
    setNewReviewStars(0)
    setNewReviewText('')
    setReviewerName('')
    setReviewError('')
    setReviewSubmitted(false)
  }, [selectedItem?.id])

  function addToCart(item: MenuItem, size?: { id: string; name: string; name_en: string; price: number } | null) {
    setCart(p => {
      const ex = p.find(c => c.item.id === item.id && (size ? c.selectedSize?.id === size.id : !c.selectedSize))
      if (ex) return p.map(c => c.item.id === item.id && (size ? c.selectedSize?.id === size.id : !c.selectedSize) ? { ...c, quantity: c.quantity + 1 } : c)
      return [...p, { item, quantity: 1, notes: '', selectedSize: size || null }]
    })
  }

  function removeFromCart(itemId: string, sizeId?: string | null) {
    setCart(p => {
      const ex = p.find(c => c.item.id === itemId && (sizeId ? c.selectedSize?.id === sizeId : !c.selectedSize))
      if (!ex) return p
      if (ex.quantity === 1) return p.filter(c => !(c.item.id === itemId && (sizeId ? c.selectedSize?.id === sizeId : !c.selectedSize)))
      return p.map(c => c.item.id === itemId && (sizeId ? c.selectedSize?.id === sizeId : !c.selectedSize) ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  function getQty(itemId: string, sizeId?: string) { return cart.filter(c => c.item.id === itemId && (sizeId ? c.selectedSize?.id === sizeId : !c.selectedSize)).reduce((s, c) => s + c.quantity, 0) }

  // ✅ New: compute the average stars and rating count for a given item from the preloaded reviews list
  function getItemRating(itemId: string): { avg: number; count: number } {
    const itemReviews = reviews.filter(r => r.menu_item_id === itemId)
    if (itemReviews.length === 0) return { avg: 0, count: 0 }
    const avg = itemReviews.reduce((s, r) => s + r.stars, 0) / itemReviews.length
    return { avg, count: itemReviews.length }
  }

  // ✅ New: submit a rating (stars + optional written comment) for a given item and add it immediately to the displayed reviews list
  // ✅ إرسال تقييم — يُسجَّل بحالة "pending" (لا يظهر للزوّار إلا بعد اعتماد الإدارة)، ويُحفَظ محليًا لمنع التكرار
  async function postReview(itemId: string, stars: number, text?: string, name?: string): Promise<boolean> {
    if (!itemId || stars < 1) return false
    const { error } = await sb.from('menu_item_reviews').insert([{
      menu_item_id: itemId,
      stars,
      review_text: (text || '').trim() || null,
      reviewer_name: (name || '').trim() || null,
      status: 'pending',
    }])
    if (error) {
      console.error('menu_item_reviews insert failed:', error?.message, error?.code, error?.details, error?.hint)
      return false
    }
    setReviewedItemIds(prev => {
      const next = new Set(prev); next.add(itemId)
      try { localStorage.setItem('orchid_reviewed_items', JSON.stringify([...next])) } catch {}
      return next
    })
    return true
  }

  async function submitReview() {
    if (!selectedItem || newReviewStars < 1) { setReviewError(t('pick_stars_first')); return }
    setReviewSubmitting(true)
    setReviewError('')
    const ok = await postReview(selectedItem.id, newReviewStars, newReviewText, reviewerName)
    setReviewSubmitting(false)
    if (!ok) { setReviewError(t('err_generic')); return }
    setNewReviewStars(0)
    setNewReviewText('')
    setReviewerName('')
    setReviewSubmitted(true)
    setTimeout(() => setReviewSubmitted(false), 4000)
  }
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  // ✅ "Who's Paying the Bill?" game - real spinning wheel
  function updateGamePeopleCount(n: number) {
    const count = Math.max(2, n)
    setGameNames(prev => {
      const next = [...prev]
      while (next.length < count) next.push('')
      while (next.length > count) next.pop()
      return next
    })
  }

  // ✅ Save the first person's (organizer's) details in the restaurant customer table, if they entered their mobile number
  // ✅ New: Orchid Rewards - phone-only lookup (no password); if found, shows their points; if new, registers them and gives 50 welcome points
  async function handleRewardsSubmit() {
    const phone = rewardsPhone.trim()
    if (!phone || phone.length < 8) { setRewardsError(t('err_phone')); return }
    setRewardsSubmitting(true)
    setRewardsError('')
    try {
      // ✅ حماية: التسجيل ونقاط الولاء انتقلا إلى /api/menu-rewards — النقاط تُضبط في السيرفر
      const res = await fetch('/api/menu-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', phone, name: rewardsName.trim() || 'Guest' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.customerId) { setRewardsError(t('err_generic')); setRewardsSubmitting(false); return }
      setRewardsResult({ customerId: data.customerId, name: data.name, points: data.points || 0, isNew: !!data.isNew })
      setIdentifiedCustomerId(data.customerId)
    } catch {
      setRewardsError(t('err_generic'))
    }
    setRewardsSubmitting(false)
  }

  async function saveGameOrganizerAsCustomer() {
    const firstName = gameNames[0]?.trim()
    const phone = gamePhone.trim()
    if (!firstName || !phone) return
    // ✅ Silent diagnostic logging in the database (no effect on the customer experience) to help find the cause of any order-linking issue
    async function log(step: string, success: boolean, error_message: string | null, customerId?: string | null) {
      try {
        await sb.from('game_link_debug_log').insert([{
          confirmed_order_id: confirmedOrderId, customer_id: customerId || null, phone, step, success, error_message,
        }])
      } catch { /* ignore - this logging must never break the game itself */ }
    }
    try {
      // ✅ حماية: التسجيل وربط الطلب انتقلا إلى /api/menu-rewards (مفتاح service-role)
      const res = await fetch('/api/menu-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'game', phone, firstName, orderId: confirmedOrderId || null }),
      })
      const data = await res.json().catch(() => null)
      await log(res.ok ? 'server_ok' : 'server_error', !!(res.ok && data?.customerId), data?.error || null, data?.customerId)
    } catch (e: any) {
      await log('exception', false, e?.message || String(e))
    }
  }

  function playPayGame() {
    const validNames = gameNames.map(n => n.trim()).filter(Boolean)
    if (validNames.length < 2 || gameSpinning) return
    if (!gamePhone.trim()) { alert(t('game_need_phone')); return }
    saveGameOrganizerAsCustomer()
    setGameWinner(null)
    setGameSpinning(true)
    const n = validNames.length
    const winnerIdx = Math.floor(Math.random() * n)
    const segAngle = 360 / n
    const centerAngle = winnerIdx * segAngle + segAngle / 2
    const extraSpins = 6 + Math.floor(Math.random() * 3) // 6-8 full spins
    // add a small random offset within the segment bounds so it never stops at exactly the same spot every time (feels more realistic)
    const jitter = (Math.random() - 0.5) * (segAngle * 0.6)
    const target = wheelRotation + extraSpins * 360 + ((360 - centerAngle - wheelRotation % 360 + 360) % 360) + jitter
    setWheelRotation(target)
    // animation duration is 4.2 seconds (matches the CSS transition below)
    setTimeout(() => {
      setGameWinner(validNames[winnerIdx])
      setGameSpinning(false)
    }, 4200)
  }

  function resetPayGame() {
    setGameWinner(null)
    setGameNames(['', ''])
    setGamePhone('')
    setWheelRotation(0)
  }

  // ✅ Share the game result - generates an image with the Orchid logo and the winner's name, and opens the native mobile share sheet
  // (covers WhatsApp, Instagram, and any other installed app) - on desktop it falls back to direct WhatsApp/Facebook/X links
  async function shareGameResult() {
    if (!gameWinner) return
    const shareText = `🎲 We played "Who's Paying the Bill?" at Orchid House and ${gameWinner} is paying! 💸🌸`
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 800
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = C.bg
        ctx.fillRect(0, 0, 800, 800)
        try {
          const logo = new Image()
          logo.crossOrigin = 'anonymous'
          logo.src = '/logo.png'
          await new Promise(res => { logo.onload = res; logo.onerror = res; setTimeout(res, 800) })
          ctx.drawImage(logo, 300, 90, 200, 200)
        } catch {}
        ctx.textAlign = 'center'
        ctx.fillStyle = C.blue1
        ctx.font = 'bold 34px Arial'
        ctx.fillText("🎲 Who's Paying the Bill?", 400, 340)
        ctx.fillStyle = C.white
        ctx.font = 'bold 64px Arial'
        ctx.fillText(gameWinner, 400, 460)
        ctx.font = '30px Arial'
        ctx.fillStyle = C.silver2
        ctx.fillText('💸 pays the bill today!', 400, 510)
        ctx.font = 'bold 26px Arial'
        ctx.fillStyle = C.blue1
        ctx.fillText('🌸 Orchid House Restaurant', 400, 650)
      }
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'))
      if (blob) {
        const file = new File([blob], 'orchid-who-pays.png', { type: 'image/png' })
        const nav = navigator as any
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text: shareText, title: "Who's Paying the Bill?" })
          return
        }
        if (nav.share) {
          await nav.share({ text: shareText })
          return
        }
        // ✅ Desktop fallback: automatically download the image so the user can upload it themselves to any platform
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = 'orchid-who-pays.png'
        link.click()
      }
    } catch {
      // ignore any error generating the image, the user can still use the share links below
    }
  }
  function shareToWhatsApp() {
    const text = `🎲 We played "Who's Paying the Bill?" at 🌸 Orchid House and ${gameWinner} is paying! 💸`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }
  function shareToFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')
  }
  function shareToTwitter() {
    const text = `🎲 We played "Who's Paying the Bill?" at 🌸 Orchid House and ${gameWinner} is paying! 💸`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  // ✅ New: unified function that checks "has the table been redirected elsewhere?" and updates the screen immediately if so - without
  // the customer needing a manual refresh. Used here (when tapping "Order More") and also inside the order confirmation itself
  async function checkAndFollowRedirect() {
    if (!table) return
    const { data: freshTableRow } = await sb.from('tables').select('*').eq('id', table.id).single()
    const isRedirectRecent = freshTableRow?.redirected_at && (Date.now() - new Date(freshTableRow.redirected_at).getTime()) < 4 * 60 * 60 * 1000
    if (freshTableRow?.redirected_to_table_id && isRedirectRecent) {
      const { data: redirectedTableFull } = await sb.from('tables').select('*').eq('id', freshTableRow.redirected_to_table_id).single()
      if (redirectedTableFull) setTable(redirectedTableFull)
    }
  }

  async function confirmOrder() {
    if (!table || cart.length === 0) return
    // ✅ Fix (critical): immediate synchronous check — if a run is already in progress, stop right away with no delay
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setSubmitting(true)

    // ✅ حماية: إنشاء الطلب انتقل بالكامل إلى /api/submit-order. المتصفح يرسل الأصناف والكميات فقط،
    // والسيرفر يجلب الأسعار من قاعدة البيانات ويحسب الإجمالي (لا يوثق بأي سعر من المتصفح).
    // منطق الطلب القائم/الجديد + 3 محاولات إدراج + التراجع + حالة الطاولة كله داخل المسار.
    let orderId: string
    try {
      const res = await fetch('/api/submit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: table.id,
          customerId: identifiedCustomerId || null,
          items: cart.map(c => ({
            menuItemId: c.item.id,
            quantity: c.quantity,
            sizeId: c.selectedSize?.id || null,
            notes: c.notes || null,
          })),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.orderId) {
        isSubmittingRef.current = false
        setSubmitting(false)
        alert(t('err_order_send'))
        return
      }
      orderId = data.orderId
      setOrderNumber(data.orderNumber || orderId.slice(-6).toUpperCase())
      setConfirmedOrderId(orderId)
      // ✅ الكارت يتفرغ بعد نجاح الطلب فقط
      setCart([])
      // ✅ البنود المتراكمة كاملة تجي من رد المسار مباشرة؛ وإلا نقرأها كالمعتاد
      if (Array.isArray(data.items)) setLiveOrderItems(data.items)
      else await fetchLiveOrderItems(orderId)
    } catch {
      isSubmittingRef.current = false
      setSubmitting(false)
      alert(t('err_order_send'))
      return
    }

    // ✅ log IP, user-agent, and device model (if available - Android+Chrome only) for this order - in the background
    ;(async () => {
      let deviceModel: string | null = null
      try {
        const uaData = (navigator as any).userAgentData
        if (uaData?.getHighEntropyValues) {
          const info = await uaData.getHighEntropyValues(['model'])
          deviceModel = info.model || null
        }
      } catch { /* iPhone or another browser that doesn't support this feature - ignore and continue normally */ }
      fetch('/api/log-order-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, user_agent: navigator.userAgent, device_model: deviceModel }),
      }).catch(() => { /* intentionally ignore any error here */ })
    })()
    setPhase('done')
    isSubmittingRef.current = false
    setSubmitting(false)
  }

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{display:none}
    body{background:${C.bg};color:${C.white};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .ar-text{font-family:'Tajawal','Segoe UI',sans-serif}
    @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
    @keyframes chefBounce{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-16px) rotate(6deg)}}
    @keyframes blueGlow{0%,100%{box-shadow:0 0 20px ${C.glow}}50%{box-shadow:0 0 40px ${C.glow2}}}
    @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @keyframes flyPlusOne{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-140px) scale(1)}}
    @keyframes addBounce{0%{transform:scale(1)}35%{transform:scale(1.28)}60%{transform:scale(.92)}100%{transform:scale(1)}}
    .item-card{transition:transform .15s,box-shadow .15s}
    .item-card:active{transform:scale(.97)}
  `

  // ══ Loading ══
  if (loading) return (
    <div style={{ minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{globalStyles}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:C.bg3, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', animation:'spin 2s linear infinite', boxShadow:`0 0 30px ${C.glow2}` }}>
          <img src="/logo.png" alt="Orchid House" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
        <div style={{ color:C.blue2, fontSize:16, fontWeight:700 }}>{t('loading')}</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <style>{globalStyles}</style>
      <div style={{ fontSize:48 }}>❌</div>
      <div style={{ color:C.white, fontSize:18, fontWeight:700 }}>{t('table_not_found')}</div>
    </div>
  )

  // ══ Language selection — أول شاشة يشوفها العميل بعد مسح الكيو آر ══
  if (phase === 'language') return (
    <div dir="ltr" style={{ minHeight:'100dvh', background:`radial-gradient(ellipse at top, ${C.bg3}, ${C.bg} 60%)`, color:C.white, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 22px' }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:380, width:'100%', textAlign:'center', animation:'fadeUp .6s ease' }}>
        <div style={{ width:88, height:88, borderRadius:'50%', overflow:'hidden', background:C.bg3, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', boxShadow:`0 0 40px ${C.glow2}`, border:`1px solid ${C.border2}` }}>
          <img src="/logo.png" alt="Orchid Group" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
        <div style={{ color:C.blue2, fontSize:12, fontWeight:800, letterSpacing:3, marginBottom:8 }}>ORCHID GROUP</div>
        {/* رسالة الترحيب — تظهر بالثلاث لغات معًا لأن العميل لسه ماختارش */}
        <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:20, padding:'18px 16px', marginBottom:24 }}>
          <div style={{ fontSize:16, fontWeight:900, color:C.white, marginBottom:4 }}>{TR.en.lang_pick_title}</div>
          <div style={{ fontSize:14, fontWeight:800, color:C.blue2, marginBottom:2 }}>{TR.ms.lang_pick_title}</div>
          <div className="ar-text" style={{ fontSize:15, fontWeight:800, color:C.white2, direction:'rtl' }}>{TR.ar.lang_pick_title}</div>
        </div>
        <div style={{ fontSize:12.5, color:C.silver2, marginBottom:16 }}>
          {TR.en.lang_pick_sub} · {TR.ms.lang_pick_sub} · <span className="ar-text">{TR.ar.lang_pick_sub}</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => chooseLang(l.code)}
              style={{ width:'100%', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', gap:14, cursor:'pointer', boxShadow:`0 4px 14px ${C.glow}` }}>
              <span style={{ fontSize:26 }}>{l.flag}</span>
              <div style={{ textAlign:'left', flex:1 }}>
                <div style={{ fontSize:15, fontWeight:900, color:C.white }}>{l.native}</div>
                <div style={{ fontSize:11, color:C.silver2 }}>{l.label}</div>
              </div>
              <span style={{ fontSize:20, color:C.blue2 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // ══ Done ══
  if (phase === 'done') return (
    <div dir={dir} style={{ minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:400, width:'100%', textAlign:'center', animation:'fadeUp .6s ease' }}>
        <div style={{ fontSize:90, display:'inline-block', animation:'chefBounce 2s ease-in-out infinite', marginBottom:24, filter:`drop-shadow(0 8px 20px ${C.glow2})` }}>👨‍🍳</div>
        <div style={{ background:C.bg2, borderRadius:28, border:`1px solid ${C.border2}`, padding:'36px 24px', boxShadow:`0 0 40px ${C.glow}` }}>
          <div style={{ color:C.blue2, fontSize:11, fontWeight:700, letterSpacing:4, textTransform:'uppercase', marginBottom:10 }}>{t('order_confirmed')}</div>
          <h2 style={{ color:C.white, fontSize:22, fontWeight:900, marginBottom:10 }}>{t('order_being_prepared')}</h2>
          <p style={{ color:C.silver2, fontSize:13, marginBottom:28, lineHeight:1.7 }}>{t('order_prep_sub')}</p>
          <div style={{ background:`linear-gradient(135deg,rgba(0,200,200,.15),rgba(0,150,150,.15))`, border:`1px solid ${C.border2}`, borderRadius:20, padding:'24px 20px', marginBottom:24, animation:'blueGlow 2s ease infinite' }}>
            <div style={{ color:C.silver2, fontSize:10, letterSpacing:3, marginBottom:8 }}>{t('your_order_number')}</div>
            <div style={{ background:`linear-gradient(135deg,${C.blue1},${C.silver})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize:52, fontWeight:900, letterSpacing:8 }}>#{orderNumber}</div>
            <div className="ar-text" style={{ color:C.silver2, fontSize:12, marginTop:8 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>
          <div style={{ background:`rgba(255,255,255,.03)`, borderRadius:16, padding:16 }}>
            <div style={{ color:C.silver2, fontSize:10, marginBottom:12, letterSpacing:2 }}>{t('order_summary')}</div>
            {liveOrderItems.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                <span style={{ color:C.white2 }}>{c.name}{c.size_name ? ` (${c.size_name})` : ''} <span style={{ color:C.silver2 }}>×{c.quantity}</span></span>
                <span style={{ color:C.blue2, fontWeight:700 }}>MYR {(c.unit_price * c.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p style={{ color:C.silver2, fontSize:12, marginTop:20 }}>{t('served_shortly')}</p>
        </div>

        {/* ✅ New: clear button to go back to the menu and order more - needed since we keep the order visible when the page is reopened */}
        <button onClick={async () => { await checkAndFollowRedirect(); setPhase('menu') }}
          style={{ width:'100%', marginTop:16, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:16, padding:'14px', color:C.white, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:`0 6px 20px ${C.glow2}` }}>
          {t('order_more')}
        </button>

        {/* ✅ تقييم الأطباق — لمسة واضحة بعد الطلب: نجوم سريعة لكل صنف طلبه العميل (تروح "قيد المراجعة") */}
        {(() => {
          const rateable = liveOrderItems.filter(i => i.menu_item_id)
          const uniq = Array.from(new Map(rateable.map(i => [i.menu_item_id, i])).values())
          if (uniq.length === 0) return null
          return (
            <div style={{ marginTop:24, background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:24, padding:'20px 18px' }}>
              <div style={{ fontSize:15, fontWeight:900, color:C.white, marginBottom:4 }}>{t('rate_dishes_t')}</div>
              <div style={{ fontSize:11.5, color:C.silver2, marginBottom:14 }}>{t('rate_dishes_s')}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {uniq.map(it => {
                  const id = it.menu_item_id as string
                  const done = reviewedItemIds.has(id)
                  const sel = doneRating[id]
                  return (
                    <div key={id} style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:'10px 12px' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                        <span style={{ fontSize:12.5, color:C.white, fontWeight:600, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.name}</span>
                        {done ? (
                          <span style={{ fontSize:12, color:'#16A34A', fontWeight:700, flexShrink:0 }}>✅</span>
                        ) : (
                          <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                            {[1,2,3,4,5].map(n => (
                              <button key={n} onClick={() => setDoneRating(p => ({ ...p, [id]: { stars: n, text: p[id]?.text || '' } }))}
                                style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, padding:0, lineHeight:1, filter: sel && n <= sel.stars ? 'none' : 'grayscale(1) opacity(.45)' }}>⭐</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {!done && sel && (
                        <div style={{ marginTop:10 }}>
                          <textarea value={sel.text} onChange={e => setDoneRating(p => ({ ...p, [id]: { ...p[id], text: e.target.value } }))}
                            placeholder={t('review_placeholder')} rows={2}
                            style={{ width:'100%', boxSizing:'border-box', background:'#fff', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', fontSize:12.5, color:C.white, outline:'none', resize:'none', fontFamily:'inherit', marginBottom:6 }} />
                          <button disabled={doneRatingSending === id}
                            onClick={async () => {
                              setDoneRatingSending(id)
                              const ok = await postReview(id, sel.stars, sel.text)
                              setDoneRatingSending(null)
                              if (ok) setDoneRating(p => { const n = { ...p }; delete n[id]; return n })
                            }}
                            style={{ width:'100%', background: doneRatingSending === id ? C.border2 : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:10, padding:'8px', color:C.white, fontWeight:800, fontSize:12, cursor: doneRatingSending === id ? 'not-allowed' : 'pointer' }}>
                            {doneRatingSending === id ? t('submitting') : t('submit_review')}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── 🎲 Who's Paying the Bill? Roulette Game ── */}
        <div style={{ marginTop:24, background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, border:`1px solid ${C.border2}`, borderRadius:28, padding:'24px 20px', boxShadow:`0 0 40px ${C.glow}` }}>
          {!showPayGame ? (
            <>
              <div style={{ fontSize:32, marginBottom:8 }}>🎲</div>
              <div style={{ fontSize:16, fontWeight:900, color:C.white, marginBottom:6 }}>{t('game_teaser_t')}</div>
              <div style={{ fontSize:12, color:C.silver2, marginBottom:14 }}>{t('game_teaser_s')}</div>
              <button onClick={() => setShowPayGame(true)}
                style={{ background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:14, padding:'12px 24px', color:C.white, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:`0 6px 20px ${C.glow2}` }}>
                {t('game_play')}
              </button>
            </>
          ) : (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontSize:15, fontWeight:900, color:C.white }}>{t('game_short_t')}</span>
                <button onClick={() => { setShowPayGame(false); resetPayGame() }} style={{ background:'transparent', border:'none', color:C.silver2, fontSize:20, cursor:'pointer' }}>✕</button>
              </div>

              {gameWinner ? (
                <div>
                  <div style={{ position:'relative', width:220, height:220, margin:'0 auto 18px' }}>
                    <img src="/logo.png" alt="Orchid House" style={{ width:80, height:80, borderRadius:'50%', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', border:`3px solid ${C.blue1}`, boxShadow:`0 0 30px ${C.glow2}`, zIndex:2, objectFit:'cover' }} />
                    <div style={{ fontSize:90, textAlign:'center', animation:'chefBounce 1.4s ease-in-out infinite' }}>🎉</div>
                  </div>
                  <div style={{ fontSize:13, color:C.silver2, marginBottom:6 }}>{t('game_bill_goes')}</div>
                  <div style={{ fontSize:26, fontWeight:900, color:C.blue2, marginBottom:20 }}>{gameWinner}! 💸</div>

                  {/* Share the result */}
                  <div style={{ fontSize:11, color:C.silver2, marginBottom:10 }}>{t('game_share')}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                    <button onClick={shareToWhatsApp} style={{ padding:'10px', borderRadius:12, border:'1px solid rgba(37,211,102,.4)', background:'rgba(37,211,102,.12)', color:'#25D366', fontWeight:700, fontSize:12, cursor:'pointer' }}>💬 WhatsApp</button>
                    <button onClick={shareToFacebook} style={{ padding:'10px', borderRadius:12, border:'1px solid rgba(24,119,242,.4)', background:'rgba(24,119,242,.12)', color:'#1877F2', fontWeight:700, fontSize:12, cursor:'pointer' }}>📘 Facebook</button>
                    <button onClick={shareToTwitter} style={{ padding:'10px', borderRadius:12, border:`1px solid ${C.border2}`, background:C.bg, color:C.white, fontWeight:700, fontSize:12, cursor:'pointer' }}>✖️ X / Twitter</button>
                    <button onClick={shareGameResult} style={{ padding:'10px', borderRadius:12, border:`1px solid ${C.blue1}`, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontWeight:700, fontSize:12, cursor:'pointer' }}>📸 More / Image</button>
                  </div>

                  <button onClick={resetPayGame}
                    style={{ width:'100%', background:'transparent', border:`1px solid ${C.border2}`, borderRadius:12, padding:'10px 20px', color:C.silver2, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {t('game_again')}
                  </button>
                </div>
              ) : (
                <>
                  {gameNames.filter(n => n.trim()).length >= 2 && (
                    /* ── Spinning wheel ── */
                    <div style={{ position:'relative', width:240, height:240, margin:'0 auto 20px' }}>
                      {/* Fixed pointer on top */}
                      <div style={{ position:'absolute', top:-6, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'12px solid transparent', borderRight:'12px solid transparent', borderTop:`22px solid ${C.blue1}`, zIndex:10, filter:`drop-shadow(0 2px 6px ${C.glow2})` }} />
                      {/* The wheel itself */}
                      <div style={{
                        width:'100%', height:'100%', borderRadius:'50%',
                        border:`4px solid ${C.blue1}`,
                        boxShadow:`0 0 30px ${C.glow2}, inset 0 0 20px rgba(0,0,0,.3)`,
                        position:'relative', overflow:'hidden',
                        transform:`rotate(${wheelRotation}deg)`,
                        transition: gameSpinning ? 'transform 4.2s cubic-bezier(0.17,0.67,0.12,0.99)' : 'none',
                        background: (() => {
                          const names = gameNames.map(n => n.trim()).filter(Boolean)
                          const n = names.length
                          const palette = [C.blue1, C.blue3, C.blue2, C.silver2]
                          const stops = names.map((_, i) => `${palette[i % palette.length]} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
                          return `conic-gradient(${stops.join(',')})`
                        })(),
                      }}>
                        {gameNames.map(n => n.trim()).filter(Boolean).map((name, i, arr) => {
                          const segAngle = 360 / arr.length
                          const centerAngle = i * segAngle + segAngle / 2
                          return (
                            <div key={i} style={{ position:'absolute', inset:0, transform:`rotate(${centerAngle}deg)` }}>
                              <div style={{ position:'absolute', top:'10%', left:'50%', transform:'translateX(-50%)', fontSize:10, fontWeight:900, color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,.6)', maxWidth:56, textAlign:'center', lineHeight:1.15, wordBreak:'break-word' }}>
                                {name}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Wheel center */}
                      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:36, height:36, borderRadius:'50%', background:C.bg2, border:`3px solid ${C.blue1}`, zIndex:5 }} />
                    </div>
                  )}

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:14 }}>
                    <span style={{ fontSize:12, color:C.silver2 }}>{t('game_people')}</span>
                    <button onClick={() => updateGamePeopleCount(gameNames.length - 1)} disabled={gameNames.length <= 2 || gameSpinning}
                      style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.border2}`, background:'transparent', color:C.white, cursor:gameNames.length <= 2 ? 'not-allowed':'pointer', fontSize:15, opacity:gameNames.length <= 2 ? 0.4:1 }}>−</button>
                    <span style={{ fontSize:14, fontWeight:800, color:C.blue2, minWidth:18, textAlign:'center' }}>{gameNames.length}</span>
                    <button onClick={() => updateGamePeopleCount(gameNames.length + 1)} disabled={gameSpinning}
                      style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.border2}`, background:'transparent', color:C.white, cursor:'pointer', fontSize:15 }}>+</button>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                    {gameNames.map((name, i) => (
                      <div key={i}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:12, border:`1px solid ${C.border}` }}>
                        <span style={{ fontSize:12, color:C.silver2, minWidth:16 }}>{i + 1}.</span>
                        <input
                          value={name}
                          disabled={gameSpinning}
                          onChange={e => setGameNames(prev => prev.map((n, ni) => ni === i ? e.target.value : n))}
                          placeholder={t('game_person_n', i + 1)}
                          style={{ flex:1, background:'transparent', border:'none', outline:'none', color:C.white, fontSize:13, fontFamily:'inherit' }}
                        />
                      </div>
                    ))}
                  </div>

                  <input
                    value={gamePhone}
                    disabled={gameSpinning}
                    onChange={e => setGamePhone(e.target.value)}
                    placeholder={t('game_phone')}
                    style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:12, border:`1px solid ${gamePhone.trim() ? C.border : 'rgba(239,68,68,.4)'}`, background:C.bg, color:C.white, fontSize:13, marginBottom:14, direction:'ltr', textAlign:'left' }}
                  />

                  <button
                    onClick={playPayGame}
                    disabled={gameSpinning || gameNames.map(n => n.trim()).filter(Boolean).length < 2 || !gamePhone.trim()}
                    style={{
                      width:'100%', padding:'13px', borderRadius:14, border:'none',
                      background: (gameSpinning || !gamePhone.trim()) ? C.border : `linear-gradient(135deg,${C.blue1},${C.blue2})`,
                      color:C.white, fontWeight:900, fontSize:14,
                      cursor: gameSpinning ? 'default' : 'pointer', opacity: gameSpinning ? 0.7 : 1,
                    }}>
                    {gameSpinning ? t('game_spinning') : t('game_spin')}
                  </button>
                  <div style={{ fontSize:10, color:C.silver2, marginTop:10 }}>{t('game_fun_note')}</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── 📱 Follow Us — Social Links ── */}
        <div style={{ marginTop:24, background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, border:`1px solid ${C.border2}`, borderRadius:28, padding:'24px 20px', boxShadow:`0 0 40px ${C.glow}`, textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:900, color:C.white, marginBottom:4 }}>{t('follow_t')}</div>
          <div style={{ fontSize:12, color:C.silver2, marginBottom:18 }}>{t('follow_s')}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[
              { name:'Google', action:t('act_rate'), href:'https://www.google.com/maps/search/Orchid+House+Restaurant+Kuala+Lumpur', color:'#4285F4', type:'google' },
              { name:'Instagram', action:t('act_follow'), href:'https://www.instagram.com/orchidofficial.my/', color:'#E1306C', type:'instagram' },
              { name:'Facebook', action:t('act_like'), href:'https://www.facebook.com/OrchidOfficial.my', color:'#1877F2', type:'facebook' },
              { name:'TripAdvisor', action:t('act_review'), href:'https://www.tripadvisor.com.eg/Restaurant_Review-g298570-d33055605-Reviews-Orchid_House_Restaurant-Kuala_Lumpur_Wilayah_Persekutuan.html', color:'#00AF87', type:'tripadvisor' },
              { name:'TikTok', action:t('act_follow'), href:'https://www.tiktok.com/@orchidofficial.my', color:'#111111', type:'tiktok' },
              { name:'Website', action:t('act_visit'), href:'https://restaurantorchid.com/', color:C.blue1, type:'website' },
            ].map(link => (
              <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'14px 6px', borderRadius:16, background:'rgba(255,255,255,.03)', border:`1px solid ${link.color}40`, textDecoration:'none' }}>
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  {link.type === 'google' && (<>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </>)}
                  {link.type === 'instagram' && (<>
                    <rect x="2" y="2" width="20" height="20" rx="5" stroke={link.color} strokeWidth="1.8"/>
                    <circle cx="12" cy="12" r="4.5" stroke={link.color} strokeWidth="1.8"/>
                    <circle cx="17.5" cy="6.5" r="1.2" fill={link.color}/>
                  </>)}
                  {link.type === 'facebook' && (
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke={link.color} strokeWidth="1.8" strokeLinejoin="round"/>
                  )}
                  {link.type === 'tripadvisor' && (<>
                    <circle cx="7" cy="14" r="4" stroke={link.color} strokeWidth="1.8"/>
                    <circle cx="17" cy="14" r="4" stroke={link.color} strokeWidth="1.8"/>
                    <circle cx="12" cy="5" r="3" stroke={link.color} strokeWidth="1.8"/>
                  </>)}
                  {link.type === 'tiktok' && (
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .59.05.88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V8.66a8.16 8.16 0 0 0 4.77 1.52V6.79a4.85 4.85 0 0 1-1.04-.1z" fill={link.color}/>
                  )}
                  {link.type === 'website' && (<>
                    <circle cx="12" cy="12" r="10" stroke={link.color} strokeWidth="1.8"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={link.color} strokeWidth="1.8"/>
                  </>)}
                </svg>
                <span style={{ fontSize:10, color:C.white, fontWeight:700 }}>{link.name}</span>
                <span style={{ fontSize:9, color:C.silver2 }}>{link.action}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ══ Item Bottom Sheet ══
  const ItemSheet = selectedItem && (
    <div dir={dir} style={{ position:'fixed', inset:0, zIndex:200 }} onClick={() => setSelectedItem(null)}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.75)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:C.bg2, borderRadius:'28px 28px 0 0', maxWidth:520, margin:'0 auto', overflow:'hidden', border:`1px solid ${C.border2}`, borderBottom:'none', animation:'slideUp .3s cubic-bezier(.34,1.56,.64,1)', maxHeight:'88dvh', display:'flex', flexDirection:'column' }}
        onClick={e => e.stopPropagation()}>
        {/* ✅ زر إغلاق واضح فوق البطاقة */}
        <button onClick={() => setSelectedItem(null)} aria-label="Close"
          style={{ position:'absolute', top:12, insetInlineEnd:12, zIndex:6, width:34, height:34, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.55)', color:'#fff', fontSize:18, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', lineHeight:1 }}>
          ✕
        </button>
        <div style={{ overflowY:'auto' }}>
        {selectedItem.image_url && (
          <div style={{ width:'100%', height:260, overflow:'hidden', position:'relative' }}>
            <img src={selectedItem.image_url} alt={selectedItem.name_en} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', inset:0, background:`linear-gradient(to top,${C.bg2},transparent)` }} />
          </div>
        )}
        <div style={{ padding:'24px 24px 40px' }}>
          <div className="ar-text" style={{ fontSize:22, fontWeight:900, color:C.white, marginBottom:4 }}>{dishName(selectedItem.name, selectedItem.name_en)}</div>
          <div className="ar-text" style={{ fontSize:13, color:C.blue2, marginBottom:6, fontWeight:600 }}>{lang === 'ar' ? selectedItem.name_en : selectedItem.name}</div>

          {/* ✅ New: average item rating above the sheet */}
          {(() => {
            const { avg, count } = getItemRating(selectedItem.id)
            return count > 0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14 }}>
                <span style={{ fontSize:14, color:'#B8860B', fontWeight:800 }}>{'⭐'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}</span>
                <span style={{ fontSize:12, color:C.silver2, fontWeight:700 }}>{avg.toFixed(1)} · {t('n_ratings', count)}</span>
              </div>
            ) : (
              <div style={{ fontSize:12, color:C.silver2, marginBottom:14 }}>{t('no_ratings_yet')}</div>
            )
          })()}

          {(selectedItem.description_en || selectedItem.description) && (
            <div style={{ fontSize:14, color:C.silver2, lineHeight:1.7, marginBottom:20 }}>{dishName(selectedItem.description, selectedItem.description_en)}</div>
          )}
          {/* Sizes */}
          {selectedItem.sizes && selectedItem.sizes.filter((s: any) => s.is_active).length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:C.silver2, marginBottom:8, fontWeight:600 }}>{t('select_size')}</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {selectedItem.sizes.filter((s: any) => s.is_active).map((size: any) => (
                  <button key={size.id} onClick={() => setSelectedSize(selectedSize?.id === size.id ? null : size)}
                    style={{ padding:'8px 14px', borderRadius:20, border:`2px solid ${selectedSize?.id === size.id ? C.blue1 : C.border2}`, background: selectedSize?.id === size.id ? 'rgba(0,200,200,0.15)' : 'transparent', color: selectedSize?.id === size.id ? C.blue1 : C.silver2, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }}>
                    {dishName(size.name, size.name_en)} — MYR {size.price.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
            <div>
              <div style={{ fontSize:26, fontWeight:900, color:C.blue2 }}>
                MYR {selectedSize ? selectedSize.price.toFixed(2) : selectedItem.price.toFixed(2)}
              </div>
              {selectedSize && <div style={{ fontSize:11, color:C.silver2, marginTop:2 }}>{dishName(selectedSize.name, selectedSize.name_en)}</div>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              {getQty(selectedItem.id, selectedSize?.id) > 0 && (
                <>
                  <button onClick={() => removeFromCart(selectedItem.id, selectedSize?.id || null)} style={{ width:44, height:44, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.15)', color:'#ef4444', fontSize:24, fontWeight:700, cursor:'pointer' }}>−</button>
                  <span style={{ color:C.white, fontWeight:900, fontSize:20, minWidth:24, textAlign:'center' }}>{getQty(selectedItem.id, selectedSize?.id)}</span>
                </>
              )}
              <button onClick={e => {
                const activeSizes = selectedItem.sizes?.filter((s: any) => s.is_active) || []
                if (activeSizes.length > 0 && !selectedSize) { alert(t('pick_size_first')); return }
                addToCart(selectedItem, selectedSize)
                triggerFlyPlusOne(e)
                bumpPulse(`sheet_${selectedItem.id}`)
              }} style={{ width:44, height:44, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:24, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 16px ${C.glow2}`, animation: pulseKey === `sheet_${selectedItem.id}` ? 'addBounce .4s ease' : undefined }}>+</button>
            </div>
          </div>

          {/* ✅ New: ratings section — star rating with written comment */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:20 }}>
            <div style={{ fontSize:15, fontWeight:900, color:C.white, marginBottom:6 }}>{t('ratings')}</div>
            <div style={{ fontSize:11, color:C.silver2, lineHeight:1.6, marginBottom:14 }}>{t('review_hint')}</div>

            {reviewedItemIds.has(selectedItem.id) || reviewSubmitted ? (
              <div style={{ background:'#F0FDF4', border:`1px solid ${C.border2}`, borderRadius:14, padding:'14px', fontSize:12.5, color:'#16A34A', fontWeight:700, textAlign:'center', marginBottom:18 }}>
                {reviewSubmitted ? t('review_thanks') : t('already_reviewed')}
              </div>
            ) : (
            /* New rating submission form */
            <div style={{ background:'#FAFEFE', border:`1px dashed ${C.border2}`, borderRadius:16, padding:'16px 14px', marginBottom:18 }}>
              <div style={{ fontSize:12, color:C.silver2, marginBottom:8, fontWeight:600 }}>{t('rate_this')}</div>
              <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setNewReviewStars(n)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:26, padding:0, lineHeight:1, filter: n <= newReviewStars ? 'none' : 'grayscale(1) opacity(.4)' }}>
                    ⭐
                  </button>
                ))}
              </div>
              <textarea value={newReviewText} onChange={e => setNewReviewText(e.target.value)}
                placeholder={t('review_placeholder')}
                rows={2}
                style={{ width:'100%', boxSizing:'border-box', background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px', fontSize:13, color:C.white, outline:'none', resize:'none', fontFamily:'inherit', marginBottom:8 }} />
              <input value={reviewerName} onChange={e => setReviewerName(e.target.value)}
                placeholder={t('your_name_opt')}
                style={{ width:'100%', boxSizing:'border-box', background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, padding:'9px 12px', fontSize:13, color:C.white, outline:'none', marginBottom:10 }} />
              {reviewError && <div style={{ color:'#EF4444', fontSize:11.5, marginBottom:8 }}>{reviewError}</div>}
              <button onClick={submitReview} disabled={reviewSubmitting}
                style={{ width:'100%', background: reviewSubmitting ? C.border2 : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:12, padding:'11px', color:C.white, fontWeight:800, fontSize:13, cursor: reviewSubmitting ? 'not-allowed' : 'pointer' }}>
                {reviewSubmitting ? t('submitting') : t('submit_review')}
              </button>
            </div>
            )}

            {/* List of written reviews */}
            {reviews.filter(r => r.menu_item_id === selectedItem.id).length === 0 ? (
              <div style={{ fontSize:12.5, color:C.silver2, textAlign:'center', padding:'10px 0' }}>{t('no_comments')}</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {reviews.filter(r => r.menu_item_id === selectedItem.id).map(r => (
                  <div key={r.id} style={{ border:`1px solid ${C.border}`, borderRadius:14, padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:12.5, fontWeight:800, color:C.white }}>{r.reviewer_name || t('guest')}</span>
                      <span style={{ fontSize:12, color:'#B8860B' }}>{'⭐'.repeat(r.stars)}</span>
                    </div>
                    {r.review_text && <div style={{ fontSize:12.5, color:C.silver2, lineHeight:1.6 }}>{r.review_text}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  )

  // ══ Welcome ══
  if (phase === 'welcome') return (
    <div dir={dir} style={{ minHeight:'100dvh', background:`radial-gradient(ellipse at top, ${C.bg3}, ${C.bg} 60%)`, color:C.white, display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px', position:'relative', overflow:'hidden' }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:420, width:'100%', textAlign:'center', animation:'fadeUp .6s ease', position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ width:90, height:90, borderRadius:'50%', overflow:'hidden', background:C.bg3, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:`0 0 40px ${C.glow2}`, border:`1px solid ${C.border2}` }}>
          <img src="/logo.png" alt="Orchid House" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
        <div style={{ color:C.blue2, fontSize:12, fontWeight:800, letterSpacing:4, marginBottom:4 }}>{t('restaurant_tag')}</div>

        <h1 className={isRtl ? 'ar-text' : ''} style={{ fontSize:32, fontWeight:900, margin:'18px 0 6px', color:C.white }}>{t('welcome_title')}</h1>
        <div style={{ width:60, height:1, background:C.border2, margin:'0 auto 10px' }} />
        <p style={{ color:C.silver2, fontSize:14, marginBottom:26 }}>{t('welcome_sub')}</p>

        {/* اختيار لغة سريع */}
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginBottom:22 }}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => chooseLang(l.code)}
              style={{ padding:'6px 12px', borderRadius:20, border:`1px solid ${lang === l.code ? C.blue1 : C.border2}`, background: lang === l.code ? 'rgba(0,200,200,0.12)' : 'transparent', color: lang === l.code ? C.blue2 : C.silver2, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              {l.flag} {l.native}
            </button>
          ))}
        </div>

        {/* Membership perks */}
        <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:20, padding:'20px 16px', marginBottom:22 }}>
          <div style={{ display:'flex', justifyContent:'space-around', marginBottom:16 }}>
            {[['⭐',t('perk_points_t'),t('perk_points_s')],['🎁',t('perk_offers_t'),t('perk_offers_s')],['🏷️',t('perk_bday_t'),t('perk_bday_s')]].map(([icon,title,sub]) => (
              <div key={title} style={{ flex:1, padding:'0 4px' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, margin:'0 auto 8px' }}>{icon}</div>
                <div style={{ fontSize:11.5, fontWeight:700, color:C.white2 }}>{title}</div>
                <div style={{ fontSize:10, color:C.silver2 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, display:'flex', alignItems:'center', gap:10, textAlign:isRtl ? 'right' : 'left' }}>
            <div style={{ width:34, height:34, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>🎁</div>
            <div style={{ fontSize:12, color:C.silver }}>
              {t('join_benefits')}<br />
              <span style={{ color:C.blue2, fontWeight:800 }}>{t('register_50')}</span>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'0 0 16px' }}>
          <div style={{ flex:1, height:1, background:C.border }} />
          <span style={{ fontSize:12, color:C.silver2 }}>{t('how_continue')}</span>
          <div style={{ flex:1, height:1, background:C.border }} />
        </div>

        {/* Join Rewards button */}
        <button onClick={() => { setPhase('rewards'); setRewardsIntent('join'); setRewardsResult(null); setRewardsError('') }}
          style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10, boxShadow:`0 6px 20px ${C.glow2}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:isRtl ? 'right' : 'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>👤</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>{t('join_rewards')}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.85)' }}>{t('join_rewards_s')}</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.white }}>{isRtl ? '‹' : '›'}</span>
        </button>

        {/* ✅ New: check-points-only button - between the join button and the continue-as-guest button */}
        <button onClick={() => { setPhase('rewards'); setRewardsIntent('check'); setRewardsResult(null); setRewardsError('') }}
          style={{ width:'100%', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:isRtl ? 'right' : 'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>🔍</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>{t('check_points')}</div>
              <div style={{ fontSize:11, color:C.silver2 }}>{t('check_points_s')}</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.silver2 }}>{isRtl ? '‹' : '›'}</span>
        </button>

        {/* Continue as guest button */}
        <button onClick={() => setPhase('menu')}
          style={{ width:'100%', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:isRtl ? 'right' : 'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>👤</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>{t('continue_guest')}</div>
              <div style={{ fontSize:11, color:C.silver2 }}>{t('continue_guest_s')}</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.silver2 }}>{isRtl ? '‹' : '›'}</span>
        </button>

        <div style={{ display:'flex', alignItems:'flex-start', gap:8, textAlign:isRtl ? 'right' : 'left', color:C.silver2, fontSize:11, lineHeight:1.5 }}>
          <span>ⓘ</span>
          <span>{t('guest_note')}</span>
        </div>
      </div>
    </div>
  )

  // ══ Rewards - enter mobile number ══
  if (phase === 'rewards') return (
    <div dir={dir} style={{ minHeight:'100dvh', background:`radial-gradient(ellipse at top, ${C.bg3}, ${C.bg} 60%)`, color:C.white, display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px' }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:380, width:'100%', animation:'fadeUp .5s ease' }}>
        <button onClick={() => setPhase('welcome')} style={{ background:'none', border:'none', color:C.silver2, fontSize:13, cursor:'pointer', marginBottom:20, padding:0 }}>{t('back')}</button>

        {!rewardsResult ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>{rewardsIntent === 'check' ? '🔍' : '🌸'}</div>
            <h2 style={{ fontSize:22, fontWeight:900, marginBottom:6 }}>{rewardsIntent === 'check' ? t('check_points_title') : t('rewards_title')}</h2>
            <p style={{ color:C.silver2, fontSize:13, marginBottom:26 }}>
              {rewardsIntent === 'check' ? t('rewards_check_sub') : t('rewards_join_sub')}
            </p>

            <input type="tel" inputMode="tel" placeholder={t('mobile_number')} value={rewardsPhone}
              onChange={e => setRewardsPhone(e.target.value.replace(/[^\d+]/g, ''))}
              style={{ width:'100%', boxSizing:'border-box', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:14, padding:'14px 16px', color:C.white, fontSize:15, outline:'none', marginBottom:12, textAlign:'center' }} />

            {/* ✅ Optional name - only used if the customer is actually new (ignored if they already exist) */}
            <input type="text" placeholder={t('your_name_new')} value={rewardsName}
              onChange={e => setRewardsName(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box', background:C.bg2, border:`1px solid ${C.border}`, borderRadius:14, padding:'14px 16px', color:C.white, fontSize:14, outline:'none', marginBottom:16, textAlign:'center' }} />

            {rewardsError && <div style={{ color:'#EF4444', fontSize:12, marginBottom:12 }}>{rewardsError}</div>}

            <button onClick={handleRewardsSubmit} disabled={rewardsSubmitting}
              style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:14, padding:'15px', color:C.white, fontSize:14, fontWeight:900, cursor:rewardsSubmitting?'not-allowed':'pointer', opacity:rewardsSubmitting?0.7:1 }}>
              {rewardsSubmitting ? t('checking') : t('cont')}
            </button>
          </div>
        ) : (
          <div style={{ textAlign:'center', animation:'fadeUp .4s ease' }}>
            <div style={{ fontSize:52, marginBottom:14 }}>{rewardsResult.isNew ? '🎉' : '🌸'}</div>
            <h2 style={{ fontSize:20, fontWeight:900, marginBottom:6 }}>
              {rewardsResult.isNew ? t('welcome_name', rewardsResult.name) : t('welcome_back_name', rewardsResult.name)}
            </h2>
            <p style={{ color:C.silver2, fontSize:13, marginBottom:20 }}>
              {rewardsResult.isNew ? t('just_joined') : t('good_to_see')}
            </p>
            <div style={{ background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:18, padding:'22px', marginBottom:24 }}>
              <div style={{ fontSize:11, color:C.silver2, letterSpacing:2, marginBottom:6 }}>{t('points_balance')}</div>
              <div style={{ fontSize:40, fontWeight:900, color:C.blue2 }}>{rewardsResult.points}</div>
              {rewardsResult.isNew && <div style={{ fontSize:12, color:C.blue2, marginTop:6, fontWeight:700 }}>{t('welcome_50_added')}</div>}

              {/* ✅ New: clear progress bar toward 1000 points to unlock a discount */}
              <div style={{ marginTop:20, textAlign:isRtl ? 'right' : 'left' }}>
                {rewardsResult.points >= DISCOUNT_POINTS_TARGET ? (
                  <div style={{ background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.4)', borderRadius:12, padding:'10px 14px', fontSize:12.5, color:'#4ADE80', fontWeight:700, textAlign:'center' }}>
                    {t('discount_unlocked')}
                  </div>
                ) : (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:C.silver2, marginBottom:6 }}>
                      <span>{t('progress_discount')}</span>
                      <span style={{ color:C.blue2, fontWeight:800 }}>{rewardsResult.points} / {DISCOUNT_POINTS_TARGET}</span>
                    </div>
                    <div style={{ width:'100%', height:8, background:'rgba(255,255,255,.08)', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ width:`${Math.min(100, (rewardsResult.points / DISCOUNT_POINTS_TARGET) * 100)}%`, height:'100%', background:`linear-gradient(90deg, ${C.blue2}, ${C.blue1})`, borderRadius:20, transition:'width .6s ease' }} />
                    </div>
                    <div style={{ fontSize:11.5, color:C.silver2, marginTop:8, textAlign:'center' }}>
                      {t('earn_more_points', DISCOUNT_POINTS_TARGET - rewardsResult.points)}
                    </div>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setPhase('menu')}
              style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:14, padding:'15px', color:C.white, fontSize:14, fontWeight:900, cursor:'pointer' }}>
              {t('browse_menu')}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ══ Cart ══
  if (phase === 'cart') return (
    <div dir={dir} style={{ minHeight:'100dvh', background:C.bg, color:C.white }}>
      <style>{globalStyles}</style>
      <div style={{ background:C.bg3, padding:'16px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={() => setPhase('menu')} style={{ background:`rgba(0,200,200,.1)`, border:`1px solid ${C.border}`, color:C.blue2, width:38, height:38, borderRadius:'50%', cursor:'pointer', fontSize:18 }}>{isRtl ? '→' : '←'}</button>
        <h1 style={{ color:C.white, fontSize:17, fontWeight:900, margin:0 }}>{t('your_order')}</h1>
        <div className="ar-text" style={{ marginInlineStart:'auto', color:C.blue2, fontWeight:600, fontSize:13 }}>{table?.name || `Table ${table?.number}`}</div>
      </div>
      <div style={{ padding:20, maxWidth:520, margin:'0 auto' }}>
        {cart.map((c, idx) => {
          const unitPrice = c.selectedSize ? c.selectedSize.price : c.item.price
          return (
          <div key={`${c.item.id}_${c.selectedSize?.id || 'no-size'}_${idx}`} style={{ background:C.bg2, borderRadius:20, padding:16, marginBottom:12, border:`1px solid ${C.border}`, position:'relative' }}>
            {/* Remove item button */}
            <button onClick={() => setCart(p => p.filter((_, i) => i !== idx))}
              style={{ position:'absolute', top:10, left:10, width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.2)', color:'#ef4444', fontSize:16, cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              {c.item.image_url && <img src={c.item.image_url} alt={c.item.name_en} style={{ width:60, height:60, borderRadius:14, objectFit:'cover', flexShrink:0, border:`1px solid ${C.border}` }} />}
              <div style={{ flex:1 }}>
                <div className={isRtl ? 'ar-text' : ''} style={{ fontWeight:800, fontSize:14, color:C.white, marginBottom:2 }}>{dishName(c.item.name, c.item.name_en)}</div>
                {c.selectedSize && <div style={{ fontSize:11, color:C.blue2, marginBottom:2, fontWeight:600 }}>{dishName(c.selectedSize.name, c.selectedSize.name_en)}</div>}
                <div style={{ fontSize:11, color:C.silver2, marginBottom:8 }}>{t('each', unitPrice.toFixed(2))}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <button onClick={() => removeFromCart(c.item.id, c.selectedSize?.id || null)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.15)', color:'#ef4444', fontSize:20, cursor:'pointer', fontWeight:700 }}>−</button>
                    <span style={{ color:C.white, fontWeight:900, fontSize:16 }}>{c.quantity}</span>
                    <button onClick={() => addToCart(c.item, c.selectedSize || null)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:20, cursor:'pointer', fontWeight:700 }}>+</button>
                  </div>
                  <span style={{ color:C.blue2, fontWeight:900, fontSize:16 }}>MYR {(unitPrice * c.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize:10.5, color:C.blue2, fontWeight:700, marginTop:12, marginBottom:4 }}>{t('kitchen_note_label')}</div>
            <input style={{ width:'100%', background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:12, padding:'8px 14px', fontSize:12, color:C.white, outline:'none', boxSizing:'border-box' as const }}
              placeholder={t('special_request')}
              value={c.notes} onChange={e => setCart(p => p.map((ci, i) => i === idx ? { ...ci, notes: e.target.value } : ci))} />
          </div>
          )
        })}
        <button onClick={confirmOrder} disabled={submitting}
          style={{ width:'100%', background: submitting ? '#333' : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:18, padding:'17px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:900, fontSize:16, color:C.white, boxShadow: submitting ? 'none' : `0 8px 32px ${C.glow2}` }}>
          {submitting ? t('placing_order') : t('confirm_order', cartCount)}
        </button>
      </div>
    </div>
  )

  // ══ Menu ══
  return (
    <div dir={dir} style={{ minHeight:'100dvh', background:C.bg, color:C.white, paddingBottom: cartCount > 0 ? 100 : 24 }}>
      <style>{globalStyles}</style>

      {/* ── Header ── */}
      <div style={{ background:C.bg3, padding:'18px 18px 0', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          {/* Logo area */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', background:C.bg3, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 12px ${C.glow}`, flexShrink:0 }}>
              <img src="/logo.png" alt="Orchid House" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:C.white, lineHeight:1 }}>ORCHID <span style={{ color:C.blue2 }}>HOUSE</span></div>
              <div className="ar-text" style={{ display:'inline-block', marginTop:5, padding:'3px 10px', borderRadius:8, border:`1.5px solid ${C.blue1}`, background:'rgba(0,200,200,.1)', fontSize:12, fontWeight:800, color:C.blue2 }}>{table?.name || `Table ${table?.number}`}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {/* مبدّل اللغة */}
            <select value={lang} onChange={e => chooseLang(e.target.value as Lang)}
              style={{ background:'rgba(0,200,200,.1)', border:`1px solid ${C.border}`, borderRadius:12, padding:'8px 6px', fontSize:12, color:C.silver, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.native}</option>)}
            </select>
            <button onClick={() => { setWaiterCalled(true); setTimeout(() => setWaiterCalled(false), 5000) }}
              style={{ background: waiterCalled ? `linear-gradient(135deg,#22C55E,#16A34A)` : `rgba(0,200,200,.1)`, border: waiterCalled ? 'none' : `1px solid ${C.border}`, borderRadius:14, padding:'9px 14px', cursor:'pointer', fontSize:12, color: waiterCalled ? C.white : C.silver, fontWeight:700, transition:'all .3s', whiteSpace:'nowrap' }}>
              {waiterCalled ? t('waiter_coming') : t('call_waiter')}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <input style={{ width:'100%', background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:14, padding: isRtl ? '11px 44px 11px 18px' : '11px 18px 11px 44px', fontSize:14, color:C.white, outline:'none', caretColor:C.blue1 }}
            placeholder={t('search_dishes')} value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ position:'absolute', insetInlineStart:16, top:'50%', transform:'translateY(-50%)', fontSize:16, color:C.silver2 }}>🔍</span>
        </div>

        {/* Categories */}
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:14 }}>
          {[{ id:'all', name_en: t('cat_all'), name: t('cat_all') }, ...visibleCategories].map(c => {
            const timeBadge = (c as Category).time_badge_en || (c as Category).time_badge_ar
            return (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                style={{ padding:'8px 18px', borderRadius:30, border: activeCat === c.id ? 'none' : `1px solid ${C.border}`, background: activeCat === c.id ? `linear-gradient(135deg,${C.blue1},${C.blue2})` : 'rgba(255,255,255,.05)', color: activeCat === c.id ? C.white : C.silver2, cursor:'pointer', fontSize:13, fontWeight: activeCat === c.id ? 800 : 400, whiteSpace:'nowrap', boxShadow: activeCat === c.id ? `0 4px 16px ${C.glow2}` : 'none', transition:'all .2s', display:'flex', alignItems:'center', gap:6 }}>
                {c.id === 'all' ? c.name_en : dishName((c as any).name, (c as any).name_en)}
                {timeBadge && (
                  <span style={{ fontSize:9, background: activeCat === c.id ? 'rgba(255,255,255,.25)' : 'rgba(245,158,11,.15)', color: activeCat === c.id ? C.white : '#F59E0B', border: activeCat === c.id ? 'none' : '1px solid rgba(245,158,11,.4)', borderRadius:8, padding:'2px 6px', fontWeight:800 }}>
                    🍽️ {timeBadge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Items Grid ── */}
      <div style={{ padding:'18px 14px 100px', display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16, maxWidth:560, margin:'0 auto' }}>
        {filteredItems.length === 0 ? (
          <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:60, color:C.silver2 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🍽️</div>
            <div>{t('no_items')}</div>
          </div>
        ) : filteredItems.map(item => {
          const qty = getQty(item.id)
          const hasDiscount = !!(item.discount_percent && item.discount_percent > 0)
          const hasSizes = !!(item.sizes && item.sizes.filter((s: any) => s.is_active).length > 0)
          return (
            <div key={item.id} className="item-card"
              style={{
                background:C.bg2, borderRadius:18, overflow:'hidden',
                border: `2px dashed ${qty > 0 ? C.blue1 : C.border2}`,
                cursor:'pointer', position:'relative', display:'flex', flexDirection:'column',
                boxShadow: qty > 0 ? `0 8px 22px ${C.glow}` : '0 3px 12px rgba(0,180,180,.07)',
                transition:'all .2s'
              }}
              onClick={() => { setSelectedItem(item); setSelectedSize(null) }}>

              {/* ── Image ── */}
              <div style={{ position:'relative', width:'100%', height:190, background:'#EAFDFD', flexShrink:0 }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name_en} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>🍽️</div>
                }

                {/* Discount badge */}
                {hasDiscount && (
                  <div style={{ position:'absolute', top:8, left:8, background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontSize:9, fontWeight:900, padding:'3px 8px', borderRadius:8, boxShadow:'0 3px 8px rgba(239,68,68,.4)' }}>
                    🔥 -{item.discount_percent}%
                  </div>
                )}

                {/* Added quantity badge */}
                {qty > 0 && (
                  <div style={{ position:'absolute', bottom:8, right:8, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, borderRadius:'50%', width:23, height:23, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, boxShadow:`0 2px 8px ${C.glow2}` }}>{qty}</div>
                )}

                {/* Name plate overlapping the bottom of the image */}
                <div style={{ position:'absolute', left:8, right:8, bottom:-12, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, borderRadius:9, padding:'6px 9px', boxShadow:`0 4px 10px ${C.glow2}` }}>
                  <div className="ar-text" style={{ fontSize:11.5, fontWeight:900, color:C.white, lineHeight:1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{dishName(item.name, item.name_en)}</div>
                </div>
              </div>

              {/* ── Content ── */}
              <div style={{ flex:1, padding:'18px 11px 11px', display:'flex', flexDirection:'column', gap:6 }}>
                <div className="ar-text" style={{ fontSize:10, color:C.blue2, fontWeight:600 }}>{lang === 'ar' ? item.name_en : item.name}</div>

                {/* ✅ New: average item rating badge (stars + review count) */}
                {(() => {
                  const { avg, count } = getItemRating(item.id)
                  return count > 0 ? (
                    <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'#B8860B', fontWeight:700 }}>
                      <span>⭐ {avg.toFixed(1)}</span>
                      <span style={{ color:C.silver2, fontWeight:600 }}>({count})</span>
                    </div>
                  ) : (
                    <div style={{ fontSize:9.5, color:C.silver2 }}>{t('be_first_rate')}</div>
                  )
                })()}

                {(item.description_en || item.description) && (
                  <div style={{ fontSize:9.5, color:C.silver2, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{dishName(item.description, item.description_en)}</div>
                )}

                {hasSizes ? (
                  // ✅ Multiple sizes — each size in its own clear row
                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:2 }}>
                    {item.sizes!.filter((s: any) => s.is_active).map((size: any) => {
                      const sizeQty = getQty(item.id, size.id)
                      const key = `${item.id}_${size.id}`
                      return (
                        <div key={size.id}
                          onClick={e => e.stopPropagation()}
                          style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            background: sizeQty > 0 ? `rgba(0,180,180,0.08)` : '#F4FDFD',
                            border: `1px solid ${sizeQty > 0 ? C.blue1 : C.border}`,
                            borderRadius:10, padding:'5px 8px', gap:6,
                          }}>
                          <span style={{ fontSize:9.5, color: sizeQty > 0 ? C.blue1 : C.silver2, fontWeight:700, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dishName(size.name, size.name_en)}</span>
                          <span style={{ fontSize:9.5, fontWeight:900, color:C.white, whiteSpace:'nowrap' }}>MYR {size.price.toFixed(2)}</span>
                          {sizeQty > 0 ? (
                            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                              <button onClick={() => removeFromCart(item.id, size.id)} style={{ width:19, height:19, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.15)', color:'#ef4444', fontSize:12, cursor:'pointer', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                              <span style={{ color:C.white, fontWeight:900, fontSize:10.5, minWidth:12, textAlign:'center' }}>{sizeQty}</span>
                              <button onClick={e => { addToCart(item, size); triggerFlyPlusOne(e); bumpPulse(key) }} style={{ width:19, height:19, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:12, cursor:'pointer', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', animation: pulseKey === key ? 'addBounce .4s ease' : undefined }}>+</button>
                            </div>
                          ) : (
                            <button onClick={e => { addToCart(item, size); triggerFlyPlusOne(e); bumpPulse(key) }} style={{ background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:8, padding:'3px 7px', cursor:'pointer', fontSize:9.5, fontWeight:800, color:C.white, whiteSpace:'nowrap', animation: pulseKey === key ? 'addBounce .4s ease' : undefined }}>+</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // item without sizes — price and add button at the bottom of the card
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginTop:'auto', paddingTop:6 }}>
                    {item.discount_percent && item.discount_percent > 0 ? (
                      <div style={{ display:'flex', flexDirection:'column' }}>
                        <span style={{ fontSize:12, fontWeight:900, color:'#dc2626' }}>MYR {(item.price * (1 - item.discount_percent / 100)).toFixed(2)}</span>
                        <span style={{ fontSize:9, color:C.silver2, textDecoration:'line-through' }}>MYR {item.price.toFixed(2)}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize:13, fontWeight:900, color:C.blue2 }}>MYR {item.price.toFixed(2)}</span>
                    )}
                    <div onClick={e => { e.stopPropagation(); addToCart(item); triggerFlyPlusOne(e); bumpPulse(item.id) }}
                      style={{ background: qty > 0 ? `linear-gradient(135deg,${C.blue1},${C.blue2})` : '#FFFFFF', border: qty > 0 ? 'none' : `2px solid ${C.blue1}`, borderRadius:20, padding:'5px 11px', cursor:'pointer', fontSize:11, fontWeight:800, color: qty > 0 ? C.white : C.blue2, display:'flex', alignItems:'center', gap:3, boxShadow: qty > 0 ? `0 2px 8px ${C.glow}` : `0 2px 6px rgba(0,180,180,.15)`, animation: pulseKey === item.id ? 'addBounce .4s ease' : undefined }}>
                      <span style={{ fontSize:13 }}>+</span>
                      <span>{qty > 0 ? qty : t('add')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ✅ New: floating "+1" animation layer when adding to cart */}
      {flyingPlusOnes.map(f => (
        <div key={f.id} style={{ position:'fixed', left:f.x, top:f.y, zIndex:300, pointerEvents:'none', fontSize:22, fontWeight:900, color:C.blue2, textShadow:'0 2px 6px rgba(0,0,0,.15)', animation:'flyPlusOne .9s ease-out forwards' }}>
          +1 ✨
        </div>
      ))}

      {/* Item Sheet */}
      {ItemSheet}

      {/* ── Cart Bar ── */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 16px 20px', background:`rgba(255,255,255,.97)`, borderTop:`1px solid ${C.border2}`, zIndex:100, backdropFilter:'blur(8px)', boxShadow:'0 -8px 24px rgba(0,180,180,0.1)' }}>
          <div style={{ maxWidth:520, margin:'0 auto' }}>
            <button onClick={() => setPhase('cart')}
              style={{ width:'100%', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:18, padding:'15px 20px', cursor:'pointer', fontWeight:900, fontSize:15, color:C.white, display:'flex', justifyContent:'center', alignItems:'center', boxShadow:`0 8px 28px ${C.glow2}` }}>
              <span>{t('view_order', cartCount)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
