'use client'


import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams } from 'next/navigation'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ══ Orchid House Brand Colors ══
const C = {
  bg:        '#0A0F1A',   // خلفية داكنة تبرز الأزرق
  bg2:       '#0F1825',   // كارت
  bg3:       '#141F30',   // header
  blue1:     '#3B9FE5',   // أزرق فاتح (primary)
  blue2:     '#1A6BB5',   // أزرق داكن
  blue3:     '#2280CC',   // أزرق وسط
  silver:    '#B8C5D6',   // فضي فاتح
  silver2:   '#8A9BB5',   // فضي داكن
  white:     '#FFFFFF',
  white2:    '#E8EDF5',
  border:    'rgba(59,159,229,0.15)',
  border2:   'rgba(59,159,229,0.3)',
  glow:      'rgba(59,159,229,0.2)',
  glow2:     'rgba(59,159,229,0.4)',
}

type Category = {
  id: string; name: string; name_en: string; destination: string
  available_days?: number[] | null; available_from?: string | null; available_to?: string | null
  time_badge_ar?: string | null; time_badge_en?: string | null
}
type MenuItem  = { id: string; name: string; name_en: string; price: number; discount_percent?: number; description: string; description_en: string; category_id: string; is_available: boolean; image_url?: string; sizes?: { id: string; name: string; name_en: string; price: number; is_active: boolean }[] }
type CartItem  = { item: MenuItem; quantity: number; notes: string; selectedSize?: { id: string; name: string; name_en: string; price: number } | null }
type Phase     = 'welcome' | 'rewards' | 'menu' | 'cart' | 'done'

// ✅ هل القسم ده متاح دلوقتي حسب اليوم والوقت المحددين له (لو مفيش قيود، يبقى متاح دايمًا)
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
  const [phase, setPhase]           = useState<Phase>('welcome')
  const [submitting, setSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null)
  // ✅ جديد: نظام Orchid Rewards - العميل يدخل رقم موبايله بس (بدون باسورد)، ولو مسجّل قبل كده يشوف نقاطه،
  // ولو عميل جديد يتسجّل تلقائيًا ويكسب 50 نقطة ترحيبية
  const [rewardsPhone, setRewardsPhone] = useState('')
  const [rewardsName, setRewardsName] = useState('')
  const [rewardsSubmitting, setRewardsSubmitting] = useState(false)
  const [rewardsError, setRewardsError] = useState('')
  const [rewardsResult, setRewardsResult] = useState<{ customerId: string; name: string; points: number; isNew: boolean } | null>(null)
  const [identifiedCustomerId, setIdentifiedCustomerId] = useState<string | null>(null)
  // ✅ جديد: هل العميل جاي عشان "ينضم" أو بس "يستعلم عن نقاطه" - بيغيّر النص المعروض بس، نفس آلية البحث
  const [rewardsIntent, setRewardsIntent] = useState<'join' | 'check'>('join')
  // ✅ الحد المطلوب للحصول على خصم - رقم واحد هنا عشان لو اتغيّر يوم نعدّله من مكان واحد بس
  const DISCOUNT_POINTS_TARGET = 1000
  // ✅ جديد: عناصر الطلب الكاملة (كل الجولات مجمّعة) من قاعدة البيانات - بدل الاعتماد على السلة المحلية اللي بتتصفّر مع كل طلب جديد
  const [liveOrderItems, setLiveOrderItems] = useState<{ id: string; name: string; quantity: number; unit_price: number; size_name?: string | null }[]>([])
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedSize, setSelectedSize]   = useState<{ id: string; name: string; name_en: string; price: number } | null>(null)

  // ✅ لعبة "مين هيدفع الحساب؟" - للتسلية بس، مفيش أي ربط بالكاشير أو الدفع الفعلي
  const [showPayGame, setShowPayGame] = useState(false)
  const [gamePhone, setGamePhone] = useState('')
  const [gameNames, setGameNames] = useState<string[]>(['', ''])
  const [gameSpinning, setGameSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [gameWinner, setGameWinner] = useState<string | null>(null)
  // ✅ Fix (جذري): قفل متزامن (مش state) يمنع تنفيذ confirmOrder أكتر من مرة في نفس اللحظة.
  // الـ state (submitting) تحديثها غير متزامن (React batching)، فلو العميل ضغط الزرار أكتر من مرة بسرعة
  // (شائع جدًا مع شبكة بطيئة)، بيتنفذ confirmOrder() مرتين متوازيتين فعليًا قبل ما الزرار يتعطل في الواجهة،
  // فيحصل تضارب: تنفيذ بينجح والتاني بيتعارض ويفشل، بينما التنفيذ التاني لسه شغال فيفضل الزرار عالق "Placing order...".
  const isSubmittingRef = useRef(false)
  // ✅ نحدّث "الآن" كل دقيقة عشان الأقسام المرتبطة بوقت تظهر/تختفي تلقائيًا بدون ما العميل يعمل تحديث للصفحة
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // ✅ جديد: جلب كل أصناف طلب معيّن (كل الجولات) من قاعدة البيانات، عشان نعرضها كاملة مهما كان عدد مرات الطلب
  async function fetchLiveOrderItems(orderId: string) {
    const { data } = await sb.from('order_items')
      .select('id, quantity, unit_price, size_name, status, menu_items(name, name_en)')
      .eq('order_id', orderId)
      .neq('status', 'cancelled')
    setLiveOrderItems((data || []).map((i: any) => ({
      id: i.id, quantity: i.quantity, unit_price: i.unit_price, size_name: i.size_name,
      name: i.menu_items?.name_en || i.menu_items?.name || '',
    })))
  }

  useEffect(() => {
    async function load() {
      const { data: tbl } = await sb.from('tables').select('*').eq('id', tableId).single()
      if (!tbl) { setNotFound(true); setLoading(false); return }
      setTable(tbl)
      const [cats, itms] = await Promise.all([
        sb.from('menu_categories').select('id,name,name_en,destination,available_days,available_from,available_to,time_badge_ar,time_badge_en').eq('is_active', true).order('sort_order'),
        sb.from('menu_items') .select('id,name,name_en,price,discount_percent,description,description_en,category_id,is_available,image_url,sort_order,menu_categories(sort_order),sizes:menu_item_sizes(id,name,name_en,price,is_active)') .eq('is_available', true) .eq('is_active', true) 
      ])
      setCategories(cats.data || [])
      setItems(itms.data || [])
      // ✅ لو الطاولة عندها طلب نشط بالفعل (لسه ما اتقفلش من الكاشير)، نعرض شاشة "تم التأكيد" مباشرة
      // بدل المنيو من الصفر - يفضل الطلب ظاهر للعميل طول ما الطاولة مفتوحة، حتى لو قفل الصفحة وفتحها تاني
      const { data: existingOrders } = await sb.from('orders')
        .select('id').eq('table_id', tbl.id).in('status', ['confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: false }).limit(1)
      const existing = existingOrders?.[0]

      // ✅ Fix حسب طلب المستخدم: شلنا المتابعة التلقائية للتحويل وقت تحميل الصفحة بالكامل - الطاولة دلوقتي
      // تفضى دايمًا لأي حد يفتح الصفحة من جديد بعد التحويل (حتى لو العميل القديم نفسه قفل الصفحة وفتحها تاني).
      // المتابعة للطلب المحوّل بقت مقصورة بس على "طلب المزيد" لو العميل لسه فاتح نفس التاب من غير ما يقفلها
      // (شوف checkAndFollowRedirect) - ده بيحل مشكلة تكرار الطلب من غير ما يأثر على عميل جديد قاعد بعده

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

// ✅ الأقسام المتاحة حاليًا فقط (القسم المرتبط بوقت محدد يختفي تلقائيًا برّه نطاقه)
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
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const cartTotal = cart.reduce((s, c) => {
    const unitPrice = c.selectedSize
      ? c.selectedSize.price
      : c.item.discount_percent && c.item.discount_percent > 0
        ? c.item.price * (1 - c.item.discount_percent / 100)
        : c.item.price
    return s + unitPrice * c.quantity
  }, 0)

  // ✅ لعبة "مين هيدفع الحساب؟" - عجلة دوارة حقيقية
  function updateGamePeopleCount(n: number) {
    const count = Math.max(2, n)
    setGameNames(prev => {
      const next = [...prev]
      while (next.length < count) next.push('')
      while (next.length > count) next.pop()
      return next
    })
  }

  // ✅ نحفظ بيانات أول شخص (المنظم) في قاعدة عملاء المطعم، لو دخل رقم موبايله
  // ✅ جديد: Orchid Rewards - بحث بالهاتف بس (بدون باسورد)، لو موجود يعرض نقاطه، لو جديد يسجّله ويدّيه 50 نقطة ترحيبية
  async function handleRewardsSubmit() {
    const phone = rewardsPhone.trim()
    if (!phone || phone.length < 8) { setRewardsError('Please enter a valid phone number'); return }
    setRewardsSubmitting(true)
    setRewardsError('')
    try {
      const { data: existing, error: findErr } = await sb.from('customers').select('id,name,loyalty_points').eq('phone', phone).maybeSingle()
      if (findErr) { setRewardsError('Something went wrong, please try again'); setRewardsSubmitting(false); return }
      if (existing) {
        // ✅ عميل موجود بالفعل - نعرضله نقاطه الحالية
        setRewardsResult({ customerId: existing.id, name: existing.name, points: existing.loyalty_points || 0, isNew: false })
        setIdentifiedCustomerId(existing.id)
      } else {
        // ✅ عميل جديد - نسجّله بـ50 نقطة ترحيبية
        const name = rewardsName.trim() || 'Guest'
        const { data: created, error: insertErr } = await sb.from('customers').insert([{ name, phone, loyalty_points: 50, notes: '🌸 Joined via Menu Welcome Screen' }]).select('id,name,loyalty_points').single()
        if (insertErr || !created) { setRewardsError('Something went wrong, please try again'); setRewardsSubmitting(false); return }
        setRewardsResult({ customerId: created.id, name: created.name, points: created.loyalty_points || 50, isNew: true })
        setIdentifiedCustomerId(created.id)
      }
    } catch {
      setRewardsError('Something went wrong, please try again')
    }
    setRewardsSubmitting(false)
  }

  async function saveGameOrganizerAsCustomer() {
    const firstName = gameNames[0]?.trim()
    const phone = gamePhone.trim()
    if (!firstName || !phone) return
    // ✅ تسجيل تشخيصي بصمت في قاعدة البيانات (مفيش أي تأثير على تجربة العميل) عشان نلاقي سبب مشكلة عدم ربط الأوردر
    async function log(step: string, success: boolean, error_message: string | null, customerId?: string | null) {
      try {
        await sb.from('game_link_debug_log').insert([{
          confirmed_order_id: confirmedOrderId, customer_id: customerId || null, phone, step, success, error_message,
        }])
      } catch { /* تجاهل - التسجيل نفسه لازم مايعطلش اللعبة */ }
    }
    try {
      const { data: existing, error: findErr } = await sb.from('customers').select('id').eq('phone', phone).maybeSingle()
      await log('find_customer', !findErr, findErr?.message || null, existing?.id)
      let customerId = existing?.id
      if (!customerId) {
        const { data: created, error: insertErr } = await sb.from('customers').insert([{ name: firstName, phone, loyalty_points: 0, notes: '🎲 Added via "Who\'s Paying the Bill?" game' }]).select('id').single()
        await log('insert_customer', !insertErr, insertErr?.message || null, created?.id)
        customerId = created?.id
      }
      if (customerId && confirmedOrderId) {
        const { error: linkErr } = await sb.from('orders').update({ customer_id: customerId }).eq('id', confirmedOrderId)
        await log('link_order', !linkErr, linkErr?.message || null, customerId)
      } else {
        await log('skipped_link', false, `customerId=${customerId || 'null'} confirmedOrderId=${confirmedOrderId || 'null'}`, customerId)
      }
    } catch (e: any) {
      await log('exception', false, e?.message || String(e))
    }
  }

  function playPayGame() {
    const validNames = gameNames.map(n => n.trim()).filter(Boolean)
    if (validNames.length < 2 || gameSpinning) return
    if (!gamePhone.trim()) { alert('Please enter a mobile number to play'); return }
    saveGameOrganizerAsCustomer()
    setGameWinner(null)
    setGameSpinning(true)
    const n = validNames.length
    const winnerIdx = Math.floor(Math.random() * n)
    const segAngle = 360 / n
    const centerAngle = winnerIdx * segAngle + segAngle / 2
    const extraSpins = 6 + Math.floor(Math.random() * 3) // 6-8 لفة كاملة
    // نضيف جزء عشوائي بسيط جوه حدود الشريحة عشان مايوقفش بالظبط في نص كل مرة (إحساس واقعي أكتر)
    const jitter = (Math.random() - 0.5) * (segAngle * 0.6)
    const target = wheelRotation + extraSpins * 360 + ((360 - centerAngle - wheelRotation % 360 + 360) % 360) + jitter
    setWheelRotation(target)
    // مدة الأنيميشن 4.2 ثانية (متطابقة مع CSS transition تحت)
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

  // ✅ مشاركة نتيجة اللعبة - بيولّد صورة فيها لوجو أوركيد واسم الفائز، وبيفتح شاشة المشاركة الأصلية للموبايل
  // (بتغطي واتساب، انستجرام، وأي تطبيق تاني مثبت) - على الديسكتوب بيرجع لروابط واتساب/فيسبوك/إكس مباشرة
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
        ctx.fillStyle = '#FFFFFF'
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
        // ✅ Desktop fallback: نزّل الصورة تلقائيًا عشان يقدر يرفعها هو بنفسه لأي منصة
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = 'orchid-who-pays.png'
        link.click()
      }
    } catch {
      // تجاهل أي خطأ في توليد الصورة، المستخدم لسه يقدر يستخدم روابط المشاركة تحت
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

  // ✅ جديد: دالة موحّدة تتحقق من "هل الطاولة اتحوّلت لمكان تاني؟" وتحدّث الشاشة فورًا لو أيوه - من غير
  // ما العميل يحتاج يعمل Refresh يدوي. بنستخدمها هنا (لما يضغط "طلب المزيد") وكمان جوه تأكيد الطلب نفسه
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
    // ✅ Fix (جذري): فحص فوري متزامن — لو فيه تنفيذ شغال already، نوقف على طول من غير أي تأخير
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setSubmitting(true)
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.destination]))

    // ✅ Fix حرج جدًا: شلنا فحص التحويل من هنا بالكامل - كان بيتنفذ لأي عميل يأكد طلب (حتى لو عميل جديد
    // تمامًا فاتح المنيو فاضي)، فكان بيحوّل طلب العميل الجديد بالغلط لطلب العميل القديم لو الطاولة كانت
    // اتحوّلت مؤخرًا. المتابعة الصحيحة للعميل القديم بقت مقصورة على "طلب المزيد" (checkAndFollowRedirect)
    // اللي بيحدّث حالة الطاولة (table) قبل ما يوصل لشاشة التأكيد أصلًا - فمفيش داعي لفحص تاني هنا يتعارض
    const effectiveTableId = table.id

    // تحقق لو في طلب موجود للطاولة
    const { data: existingOrders } = await sb.from('orders')
      .select('id,total_amount')
      .eq('table_id', effectiveTableId)
      .in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
      .limit(1)

    const existingOrder = existingOrders?.[0] || null
    let orderId: string

    if (existingOrder) {
      // أضف على الطلب الموجود وحدّث الإجمالي
      orderId = existingOrder.id
      await sb.from('orders').update({
        total_amount: (existingOrder.total_amount || 0) + cartTotal
      }).eq('id', orderId)
    } else {
      // أنشئ طلب جديد
      const { data: order, error } = await sb.from('orders').insert([{
        table_id: effectiveTableId, status: 'confirmed',
        total_amount: cartTotal, confirmed_at: new Date().toISOString(),
        // ✅ جديد: نربط العميل المسجّل في نظام Orchid Rewards (لو دخل رقم موبايله في شاشة الترحيب) بالطلب مباشرة
        customer_id: identifiedCustomerId || null,
      }]).select('id').single()
      if (error || !order) { isSubmittingRef.current = false; setSubmitting(false); alert('Error, please try again'); return }
      orderId = order.id
    }

    // ✅ Fix: حساب السعر الفعلي الصحيح المطبق وقت الطلب (الحجم المختار أو الخصم)، بدل سعر الصنف الأساسي دايمًا
    function actualUnitPrice(c: CartItem) {
      if (c.selectedSize) return c.selectedSize.price
      if (c.item.discount_percent && c.item.discount_percent > 0) return c.item.price * (1 - c.item.discount_percent / 100)
      return c.item.price
    }

    const itemsPayload = cart.map(c => ({
      order_id: orderId, menu_item_id: c.item.id,
      quantity: c.quantity, unit_price: actualUnitPrice(c),
      notes: c.notes || null,
      size_name: c.selectedSize ? (c.selectedSize.name_en || c.selectedSize.name) : null,
      destination: catMap[c.item.category_id] || 'kitchen',
      status: 'pending',
    }))

    // ✅ Fix: لازم نتأكد إن الأصناف اتسجلت فعليًا قبل ما نعرض "تم تأكيد الطلب" للعميل.
    // قبل كده كان الكود بيكمل من غير أي تحقق، فلو فشل الإدخال (انقطاع نت لحظي، timeout...)
    // كان الطلب بيتسجل بإجمالي صحيح لكن بدون أصناف خالص، والعميل برضو يشوف "تم التأكيد".
    let itemsError = (await sb.from('order_items').insert(itemsPayload)).error
    let attemptCount = 1
    // ✅ 3 محاولات بدل اتنين، مع فاصل بسيط بينهم (نص ثانية) عشان يدي فرصة للشبكة تتعافى لو الانقطاع لحظي
    while (itemsError && attemptCount < 3) {
      console.error(`order_items insert failed (attempt ${attemptCount}):`, itemsError.message, itemsError.code, itemsError.details, itemsPayload)
      await new Promise(res => setTimeout(res, 500))
      attemptCount++
      itemsError = (await sb.from('order_items').insert(itemsPayload)).error
    }
    if (itemsError) {
      console.error(`order_items insert failed (attempt ${attemptCount}):`, itemsError.message, itemsError.code, itemsError.details, itemsPayload)
      // ✅ نسجل الخطأ الحقيقي في قاعدة البيانات عشان نقدر نشخّصه بعدين (الـ console.error محبوس جوه موبايل العميل ومش وصلنا)
      try {
        await sb.from('order_submission_errors').insert([{
          table_id: effectiveTableId,
          attempt_count: attemptCount,
          error_message: itemsError.message || null,
          error_code: itemsError.code || null,
          error_details: itemsError.details || null,
          items_payload: itemsPayload,
        }])
      } catch (logErr) {
        console.error('Failed to log order_submission_errors:', logErr)
      }
    }
    if (itemsError) {
      // ✅ Fix: التراجع عن تعديل/إنشاء الطلب عشان مانسيبش طلب بإجمالي غلط بدون أصناف
      let rollbackError
      if (existingOrder) {
        rollbackError = (await sb.from('orders').update({ total_amount: existingOrder.total_amount || 0 }).eq('id', orderId)).error
      } else {
        // ✅ Fix: استخدام update لحالة 'cancelled' بدل delete — لأن العميل (anon) غالبًا ملوش صلاحية DELETE في RLS،
        // وكان الـ delete بيفشل بصمت (بدون تحقق من النتيجة) فيسيب الطلب الفاضي موجود بالظبط زي المشكلة الأصلية
        rollbackError = (await sb.from('orders').update({ status: 'cancelled' }).eq('id', orderId)).error
      }
      if (rollbackError) console.error('order rollback failed:', rollbackError.message, rollbackError.code)
      isSubmittingRef.current = false
      setSubmitting(false)
      alert('⚠️ حصل خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى أو طلب المساعدة من النادل.\n⚠️ Something went wrong sending your order. Please try again or call the waiter.')
      return
    }

    // ✅ Fix حرج جدًا: كان بيحدّث حالة الطاولة القديمة (table.id) لـ"مشغولة" بالطلب الجديد، حتى لو الطلب
    // فعليًا اتسجل على الطاولة الصحيحة بعد التحويل (effectiveTableId) - وده كان بالظبط سبب ظهور الطاولة
    // القديمة "مشغولة تاني" بطلب منفصل بعد ما كانت اتفضّت من التحويل
    await sb.from('tables').update({
      status: 'occupied',
      occupied_since: new Date().toISOString(),
      current_order_id: orderId,
    }).eq('id', effectiveTableId)

    setOrderNumber(orderId.slice(-6).toUpperCase())
    setConfirmedOrderId(orderId)
    // ✅ Fix حرج: السلة كانت مبتتصفرش خالص بعد إتمام الطلب، فلو العميل طلب تاني بعد كده،
    // كان بيتبعت محتوى السلة القديم كله تاني مع الجديد، فتتكرر أصناف الجولة الأولى فعليًا في قاعدة البيانات
    setCart([])
    // ✅ جديد: نجيب كل أصناف الطلب المتراكمة (كل الجولات) من قاعدة البيانات، عشان شاشة التأكيد تعرض الطلب كاملاً
    // مش بس الجولة الحالية اللي طلبها العميل دلوقتي - كده ملحقاش تختفي أصناف الجولة الأولى من شاشته
    await fetchLiveOrderItems(orderId)
    // ✅ تسجيل IP وuser-agent وموديل الجهاز (لو متاح - أندرويد+Chrome بس) للأوردر ده - في الخلفية
    ;(async () => {
      let deviceModel: string | null = null
      try {
        const uaData = (navigator as any).userAgentData
        if (uaData?.getHighEntropyValues) {
          const info = await uaData.getHighEntropyValues(['model'])
          deviceModel = info.model || null
        }
      } catch { /* آيفون أو متصفح تاني مبيدعمش الميزة دي - نتجاهل ونكمل عادي */ }
      fetch('/api/log-order-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, user_agent: navigator.userAgent, device_model: deviceModel }),
      }).catch(() => { /* تجاهل أي خطأ هنا عمدًا */ })
    })()
    setPhase('done')
    isSubmittingRef.current = false
    setSubmitting(false)
  }

  const globalStyles = `
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{display:none}
    body{background:${C.bg};color:${C.white};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
    @keyframes chefBounce{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-16px) rotate(6deg)}}
    @keyframes blueGlow{0%,100%{box-shadow:0 0 20px ${C.glow}}50%{box-shadow:0 0 40px ${C.glow2}}}
    @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
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
        <div style={{ color:C.blue1, fontSize:16, fontWeight:700 }}>Loading menu...</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <style>{globalStyles}</style>
      <div style={{ fontSize:48 }}>❌</div>
      <div style={{ color:C.white, fontSize:18, fontWeight:700 }}>Table not found</div>
    </div>
  )

  // ══ Done ══
  if (phase === 'done') return (
    <div style={{ minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:400, width:'100%', textAlign:'center', animation:'fadeUp .6s ease' }}>
        <div style={{ fontSize:90, display:'inline-block', animation:'chefBounce 2s ease-in-out infinite', marginBottom:24, filter:`drop-shadow(0 8px 20px ${C.glow2})` }}>👨‍🍳</div>
        <div style={{ background:C.bg2, borderRadius:28, border:`1px solid ${C.border2}`, padding:'36px 24px', boxShadow:`0 0 40px ${C.glow}` }}>
          <div style={{ color:C.blue1, fontSize:11, fontWeight:700, letterSpacing:4, textTransform:'uppercase', marginBottom:10 }}>✨ Order Confirmed</div>
          <h2 style={{ color:C.white, fontSize:22, fontWeight:900, marginBottom:10 }}>Your order is being prepared!</h2>
          <p style={{ color:C.silver2, fontSize:13, marginBottom:28, lineHeight:1.7 }}>Our kitchen team is working on your delicious meal. Sit back and relax! 🍽️</p>
          <div style={{ background:`linear-gradient(135deg,rgba(59,159,229,.12),rgba(26,107,181,.12))`, border:`1px solid ${C.border2}`, borderRadius:20, padding:'24px 20px', marginBottom:24, animation:'blueGlow 2s ease infinite' }}>
            <div style={{ color:C.silver2, fontSize:10, letterSpacing:3, marginBottom:8 }}>YOUR ORDER NUMBER</div>
            <div style={{ background:`linear-gradient(135deg,${C.blue1},${C.silver})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize:52, fontWeight:900, letterSpacing:8 }}>#{orderNumber}</div>
            <div style={{ color:C.silver2, fontSize:12, marginTop:8 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>
          <div style={{ background:`rgba(255,255,255,.03)`, borderRadius:16, padding:16 }}>
            <div style={{ color:C.silver2, fontSize:10, marginBottom:12, letterSpacing:2 }}>ORDER SUMMARY</div>
            {liveOrderItems.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                <span style={{ color:C.white2 }}>{c.name}{c.size_name ? ` (${c.size_name})` : ''} <span style={{ color:C.silver2 }}>×{c.quantity}</span></span>
                <span style={{ color:C.blue1, fontWeight:700 }}>MYR {(c.unit_price * c.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p style={{ color:C.silver2, fontSize:12, marginTop:20 }}>A team member will serve you shortly 🙏</p>
        </div>

        {/* ✅ جديد: زر واضح للرجوع للمنيو وطلب المزيد - ضروري بعد ما خلينا الطلب يفضل ظاهر عند فتح الصفحة تاني */}
        <button onClick={async () => { await checkAndFollowRedirect(); setPhase('menu') }}
          style={{ width:'100%', marginTop:16, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:16, padding:'14px', color:C.white, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:`0 6px 20px ${C.glow2}` }}>
          ➕ Order More Items
        </button>

        {/* ── 🎲 Who's Paying the Bill? Roulette Game ── */}
        <div style={{ marginTop:24, background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, border:`1px solid ${C.border2}`, borderRadius:28, padding:'24px 20px', boxShadow:`0 0 40px ${C.glow}` }}>
          {!showPayGame ? (
            <>
              <div style={{ fontSize:32, marginBottom:8 }}>🎲</div>
              <div style={{ fontSize:16, fontWeight:900, color:C.white, marginBottom:6 }}>While you wait... Who's Paying the Bill?</div>
              <div style={{ fontSize:12, color:C.silver2, marginBottom:14 }}>Spin the wheel and let fate decide! 🎉</div>
              <button onClick={() => setShowPayGame(true)}
                style={{ background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:14, padding:'12px 24px', color:C.white, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:`0 6px 20px ${C.glow2}` }}>
                🎮 Play the Game
              </button>
            </>
          ) : (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontSize:15, fontWeight:900, color:C.white }}>🎲 Who's Paying?</span>
                <button onClick={() => { setShowPayGame(false); resetPayGame() }} style={{ background:'transparent', border:'none', color:C.silver2, fontSize:20, cursor:'pointer' }}>✕</button>
              </div>

              {gameWinner ? (
                <div>
                  <div style={{ position:'relative', width:220, height:220, margin:'0 auto 18px' }}>
                    <img src="/logo.png" alt="Orchid House" style={{ width:80, height:80, borderRadius:'50%', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', border:`3px solid ${C.blue1}`, boxShadow:`0 0 30px ${C.glow2}`, zIndex:2, objectFit:'cover' }} />
                    <div style={{ fontSize:90, textAlign:'center', animation:'chefBounce 1.4s ease-in-out infinite' }}>🎉</div>
                  </div>
                  <div style={{ fontSize:13, color:C.silver2, marginBottom:6 }}>And the bill goes to...</div>
                  <div style={{ fontSize:26, fontWeight:900, color:C.blue1, marginBottom:20 }}>{gameWinner}! 💸</div>

                  {/* مشاركة النتيجة */}
                  <div style={{ fontSize:11, color:C.silver2, marginBottom:10 }}>📤 Share the result</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                    <button onClick={shareToWhatsApp} style={{ padding:'10px', borderRadius:12, border:'1px solid rgba(37,211,102,.4)', background:'rgba(37,211,102,.12)', color:'#25D366', fontWeight:700, fontSize:12, cursor:'pointer' }}>💬 WhatsApp</button>
                    <button onClick={shareToFacebook} style={{ padding:'10px', borderRadius:12, border:'1px solid rgba(24,119,242,.4)', background:'rgba(24,119,242,.12)', color:'#1877F2', fontWeight:700, fontSize:12, cursor:'pointer' }}>📘 Facebook</button>
                    <button onClick={shareToTwitter} style={{ padding:'10px', borderRadius:12, border:`1px solid ${C.border2}`, background:C.bg, color:C.white, fontWeight:700, fontSize:12, cursor:'pointer' }}>✖️ X / Twitter</button>
                    <button onClick={shareGameResult} style={{ padding:'10px', borderRadius:12, border:`1px solid ${C.blue1}`, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontWeight:700, fontSize:12, cursor:'pointer' }}>📸 More / Image</button>
                  </div>

                  <button onClick={resetPayGame}
                    style={{ width:'100%', background:'transparent', border:`1px solid ${C.border2}`, borderRadius:12, padding:'10px 20px', color:C.silver2, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    🔄 Play Again
                  </button>
                </div>
              ) : (
                <>
                  {gameNames.filter(n => n.trim()).length >= 2 && (
                    /* ── العجلة الدوارة ── */
                    <div style={{ position:'relative', width:240, height:240, margin:'0 auto 20px' }}>
                      {/* المؤشر الثابت فوق */}
                      <div style={{ position:'absolute', top:-6, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'12px solid transparent', borderRight:'12px solid transparent', borderTop:`22px solid ${C.blue1}`, zIndex:10, filter:`drop-shadow(0 2px 6px ${C.glow2})` }} />
                      {/* العجلة نفسها */}
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
                      {/* مركز العجلة */}
                      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:36, height:36, borderRadius:'50%', background:C.bg2, border:`3px solid ${C.blue1}`, zIndex:5 }} />
                    </div>
                  )}

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:14 }}>
                    <span style={{ fontSize:12, color:C.silver2 }}>Number of People</span>
                    <button onClick={() => updateGamePeopleCount(gameNames.length - 1)} disabled={gameNames.length <= 2 || gameSpinning}
                      style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.border2}`, background:'transparent', color:C.white, cursor:gameNames.length <= 2 ? 'not-allowed':'pointer', fontSize:15, opacity:gameNames.length <= 2 ? 0.4:1 }}>−</button>
                    <span style={{ fontSize:14, fontWeight:800, color:C.blue1, minWidth:18, textAlign:'center' }}>{gameNames.length}</span>
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
                          placeholder={`Person ${i + 1} name`}
                          style={{ flex:1, background:'transparent', border:'none', outline:'none', color:C.white, fontSize:13, fontFamily:'inherit' }}
                        />
                      </div>
                    ))}
                  </div>

                  <input
                    value={gamePhone}
                    disabled={gameSpinning}
                    onChange={e => setGamePhone(e.target.value)}
                    placeholder="📱 Mobile number (required) *"
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
                    {gameSpinning ? '🎰 Spinning...' : '🎰 Spin the Wheel!'}
                  </button>
                  <div style={{ fontSize:10, color:C.silver2, marginTop:10 }}>🎉 Just for fun — not a real payment decision!</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── 📱 Follow Us — Social Links ── */}
        <div style={{ marginTop:24, background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, border:`1px solid ${C.border2}`, borderRadius:28, padding:'24px 20px', boxShadow:`0 0 40px ${C.glow}`, textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:900, color:C.white, marginBottom:4 }}>Did we make your evening special? 🌸</div>
          <div style={{ fontSize:12, color:C.silver2, marginBottom:18 }}>Follow us & share your experience</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[
              { name:'Google', action:'Rate us', href:'https://www.google.com/maps/search/Orchid+House+Restaurant+Kuala+Lumpur', color:'#4285F4', type:'google' },
              { name:'Instagram', action:'Follow', href:'https://www.instagram.com/orchidofficial.my/', color:'#E1306C', type:'instagram' },
              { name:'Facebook', action:'Like', href:'https://www.facebook.com/OrchidOfficial.my', color:'#1877F2', type:'facebook' },
              { name:'TripAdvisor', action:'Review', href:'https://www.tripadvisor.com.eg/Restaurant_Review-g298570-d33055605-Reviews-Orchid_House_Restaurant-Kuala_Lumpur_Wilayah_Persekutuan.html', color:'#00AF87', type:'tripadvisor' },
              { name:'TikTok', action:'Follow', href:'https://www.tiktok.com/@orchidofficial.my', color:'#ffffff', type:'tiktok' },
              { name:'Website', action:'Visit', href:'https://restaurantorchid.com/', color:C.blue1, type:'website' },
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
                    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke={link.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
    <div style={{ position:'fixed', inset:0, zIndex:200 }} onClick={() => setSelectedItem(null)}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.75)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:C.bg2, borderRadius:'28px 28px 0 0', maxWidth:520, margin:'0 auto', overflow:'hidden', border:`1px solid ${C.border2}`, borderBottom:'none', animation:'slideUp .3s cubic-bezier(.34,1.56,.64,1)' }}
        onClick={e => e.stopPropagation()}>
        {selectedItem.image_url && (
          <div style={{ width:'100%', height:220, overflow:'hidden', position:'relative' }}>
            <img src={selectedItem.image_url} alt={selectedItem.name_en} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', inset:0, background:`linear-gradient(to top,${C.bg2},transparent)` }} />
          </div>
        )}
        <div style={{ padding:'24px 24px 40px' }}>
          <div style={{ fontSize:22, fontWeight:900, color:C.white, marginBottom:4 }}>{selectedItem.name_en || selectedItem.name}</div>
          <div style={{ fontSize:13, color:C.blue1, marginBottom:12, fontWeight:600 }}>{selectedItem.name}</div>
          {(selectedItem.description_en || selectedItem.description) && (
            <div style={{ fontSize:14, color:C.silver2, lineHeight:1.7, marginBottom:20 }}>{selectedItem.description_en || selectedItem.description}</div>
          )}
          {/* Sizes */}
          {selectedItem.sizes && selectedItem.sizes.filter((s: any) => s.is_active).length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:C.silver2, marginBottom:8, fontWeight:600 }}>اختر الحجم:</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {selectedItem.sizes.filter((s: any) => s.is_active).map((size: any) => (
                  <button key={size.id} onClick={() => setSelectedSize(selectedSize?.id === size.id ? null : size)}
                    style={{ padding:'8px 14px', borderRadius:20, border:`2px solid ${selectedSize?.id === size.id ? C.blue1 : C.border2}`, background: selectedSize?.id === size.id ? 'rgba(59,159,229,0.15)' : 'transparent', color: selectedSize?.id === size.id ? C.blue1 : C.silver2, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }}>
                    {size.name_en || size.name} — MYR {size.price.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:26, fontWeight:900, color:C.blue1 }}>
                MYR {selectedSize ? selectedSize.price.toFixed(2) : selectedItem.price.toFixed(2)}
              </div>
              {selectedSize && <div style={{ fontSize:11, color:C.silver2, marginTop:2 }}>{selectedSize.name_en || selectedSize.name}</div>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              {getQty(selectedItem.id, selectedSize?.id) > 0 && (
                <>
                  <button onClick={() => removeFromCart(selectedItem.id, selectedSize?.id || null)} style={{ width:44, height:44, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.15)', color:'#ef4444', fontSize:24, fontWeight:700, cursor:'pointer' }}>−</button>
                  <span style={{ color:C.white, fontWeight:900, fontSize:20, minWidth:24, textAlign:'center' }}>{getQty(selectedItem.id, selectedSize?.id)}</span>
                </>
              )}
              <button onClick={() => {
                const activeSizes = selectedItem.sizes?.filter((s: any) => s.is_active) || []
                if (activeSizes.length > 0 && !selectedSize) { alert('يرجى اختيار الحجم أولاً'); return }
                addToCart(selectedItem, selectedSize)
              }} style={{ width:44, height:44, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:24, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 16px ${C.glow2}` }}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ══ Welcome ══
  if (phase === 'welcome') return (
    <div style={{ minHeight:'100dvh', background:`radial-gradient(ellipse at top, ${C.bg3}, ${C.bg} 60%)`, color:C.white, display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px', position:'relative', overflow:'hidden' }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:420, width:'100%', textAlign:'center', animation:'fadeUp .6s ease', position:'relative', zIndex:1 }}>
        {/* الشعار */}
        <div style={{ width:90, height:90, borderRadius:'50%', overflow:'hidden', background:C.bg3, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:`0 0 40px ${C.glow2}`, border:`1px solid ${C.border2}` }}>
          <img src="/logo.png" alt="Orchid House" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
        <div style={{ color:C.blue1, fontSize:12, fontWeight:800, letterSpacing:4, marginBottom:4 }}>ORCHID RESTAURANT</div>

        <h1 style={{ fontSize:32, fontWeight:900, margin:'18px 0 6px', color:C.white }}>Welcome to Orchid</h1>
        <div style={{ width:60, height:1, background:C.border2, margin:'0 auto 10px' }} />
        <p style={{ color:C.silver2, fontSize:14, marginBottom:26 }}>Great food. Unforgettable moments.</p>

        {/* مميزات الاشتراك */}
        <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:20, padding:'20px 16px', marginBottom:22 }}>
          <div style={{ display:'flex', justifyContent:'space-around', marginBottom:16 }}>
            {[['⭐','Earn Points','with every visit'],['🎁','Exclusive Offers','just for members'],['🏷️','Birthday Rewards','and more surprises']].map(([icon,title,sub]) => (
              <div key={title} style={{ flex:1, padding:'0 4px' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, margin:'0 auto 8px' }}>{icon}</div>
                <div style={{ fontSize:11.5, fontWeight:700, color:C.white2 }}>{title}</div>
                <div style={{ fontSize:10, color:C.silver2 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
            <div style={{ width:34, height:34, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>🎁</div>
            <div style={{ fontSize:12, color:C.silver }}>
              Join Orchid Rewards and enjoy exclusive benefits.<br />
              <span style={{ color:C.blue1, fontWeight:800 }}>Register today and get 50 welcome points!</span>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'0 0 16px' }}>
          <div style={{ flex:1, height:1, background:C.border }} />
          <span style={{ fontSize:12, color:C.silver2 }}>How would you like to continue?</span>
          <div style={{ flex:1, height:1, background:C.border }} />
        </div>

        {/* زر الانضمام للرواردز */}
        <button onClick={() => { setPhase('rewards'); setRewardsIntent('join'); setRewardsResult(null); setRewardsError('') }}
          style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10, boxShadow:`0 6px 20px ${C.glow2}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>👤</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>JOIN ORCHID REWARDS</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.85)' }}>Sign in or create an account</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.white }}>›</span>
        </button>

        {/* ✅ جديد: زر استعلام عن النقاط بس - بين زر الانضمام وزر المتابعة كضيف */}
        <button onClick={() => { setPhase('rewards'); setRewardsIntent('check'); setRewardsResult(null); setRewardsError('') }}
          style={{ width:'100%', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>🔍</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>CHECK MY POINTS</div>
              <div style={{ fontSize:11, color:C.silver2 }}>See your balance & discount progress</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.silver2 }}>›</span>
        </button>

        {/* زر المتابعة كضيف */}
        <button onClick={() => setPhase('menu')}
          style={{ width:'100%', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>👤</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>CONTINUE AS GUEST</div>
              <div style={{ fontSize:11, color:C.silver2 }}>Browse menu and place your order</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.silver2 }}>›</span>
        </button>

        <div style={{ display:'flex', alignItems:'flex-start', gap:8, textAlign:'left', color:C.silver2, fontSize:11, lineHeight:1.5 }}>
          <span>ⓘ</span>
          <span>You can browse the menu and place an order as a guest, but you won't earn points or enjoy member benefits.</span>
        </div>
      </div>
    </div>
  )

  // ══ Rewards - إدخال رقم الموبايل ══
  if (phase === 'rewards') return (
    <div style={{ minHeight:'100dvh', background:`radial-gradient(ellipse at top, ${C.bg3}, ${C.bg} 60%)`, color:C.white, display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px' }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:380, width:'100%', animation:'fadeUp .5s ease' }}>
        <button onClick={() => setPhase('welcome')} style={{ background:'none', border:'none', color:C.silver2, fontSize:13, cursor:'pointer', marginBottom:20, padding:0 }}>‹ Back</button>

        {!rewardsResult ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>{rewardsIntent === 'check' ? '🔍' : '🌸'}</div>
            <h2 style={{ fontSize:22, fontWeight:900, marginBottom:6 }}>{rewardsIntent === 'check' ? 'Check My Points' : 'Orchid Rewards'}</h2>
            <p style={{ color:C.silver2, fontSize:13, marginBottom:26 }}>
              {rewardsIntent === 'check' ? 'Enter your mobile number to see your points balance.' : "Enter your mobile number — new or returning, we've got you covered."}
            </p>

            <input type="tel" inputMode="tel" placeholder="Mobile number" value={rewardsPhone}
              onChange={e => setRewardsPhone(e.target.value.replace(/[^\d+]/g, ''))}
              style={{ width:'100%', boxSizing:'border-box', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:14, padding:'14px 16px', color:C.white, fontSize:15, outline:'none', marginBottom:12, textAlign:'center' }} />

            {/* ✅ اسم اختياري - بيتاخد بس لو العميل جديد فعلاً (هيتجاهل لو كان موجود بالفعل) */}
            <input type="text" placeholder="Your name (for new members)" value={rewardsName}
              onChange={e => setRewardsName(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box', background:C.bg2, border:`1px solid ${C.border}`, borderRadius:14, padding:'14px 16px', color:C.white, fontSize:14, outline:'none', marginBottom:16, textAlign:'center' }} />

            {rewardsError && <div style={{ color:'#EF4444', fontSize:12, marginBottom:12 }}>{rewardsError}</div>}

            <button onClick={handleRewardsSubmit} disabled={rewardsSubmitting}
              style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:14, padding:'15px', color:C.white, fontSize:14, fontWeight:900, cursor:rewardsSubmitting?'not-allowed':'pointer', opacity:rewardsSubmitting?0.7:1 }}>
              {rewardsSubmitting ? 'Checking...' : 'Continue'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign:'center', animation:'fadeUp .4s ease' }}>
            <div style={{ fontSize:52, marginBottom:14 }}>{rewardsResult.isNew ? '🎉' : '🌸'}</div>
            <h2 style={{ fontSize:20, fontWeight:900, marginBottom:6 }}>
              {rewardsResult.isNew ? `Welcome, ${rewardsResult.name}!` : `Welcome back, ${rewardsResult.name}!`}
            </h2>
            <p style={{ color:C.silver2, fontSize:13, marginBottom:20 }}>
              {rewardsResult.isNew ? "You've just joined Orchid Rewards" : "Great to see you again"}
            </p>
            <div style={{ background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:18, padding:'22px', marginBottom:24 }}>
              <div style={{ fontSize:11, color:C.silver2, letterSpacing:2, marginBottom:6 }}>YOUR POINTS BALANCE</div>
              <div style={{ fontSize:40, fontWeight:900, color:C.blue1 }}>{rewardsResult.points}</div>
              {rewardsResult.isNew && <div style={{ fontSize:12, color:C.blue1, marginTop:6, fontWeight:700 }}>🎁 +50 welcome points added!</div>}

              {/* ✅ جديد: شريط تقدم واضح نحو 1000 نقطة عشان يستحق خصم */}
              <div style={{ marginTop:20, textAlign:'left' }}>
                {rewardsResult.points >= DISCOUNT_POINTS_TARGET ? (
                  <div style={{ background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.4)', borderRadius:12, padding:'10px 14px', fontSize:12.5, color:'#4ADE80', fontWeight:700, textAlign:'center' }}>
                    🎉 You've unlocked your discount! Show this to your waiter.
                  </div>
                ) : (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:C.silver2, marginBottom:6 }}>
                      <span>Progress to discount</span>
                      <span style={{ color:C.blue1, fontWeight:800 }}>{rewardsResult.points} / {DISCOUNT_POINTS_TARGET}</span>
                    </div>
                    <div style={{ width:'100%', height:8, background:'rgba(255,255,255,.08)', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ width:`${Math.min(100, (rewardsResult.points / DISCOUNT_POINTS_TARGET) * 100)}%`, height:'100%', background:`linear-gradient(90deg, ${C.blue2}, ${C.blue1})`, borderRadius:20, transition:'width .6s ease' }} />
                    </div>
                    <div style={{ fontSize:11.5, color:C.silver2, marginTop:8, textAlign:'center' }}>
                      Earn <span style={{ color:C.blue1, fontWeight:800 }}>{DISCOUNT_POINTS_TARGET - rewardsResult.points}</span> more points to unlock a special discount! 🎁
                    </div>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setPhase('menu')}
              style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:14, padding:'15px', color:C.white, fontSize:14, fontWeight:900, cursor:'pointer' }}>
              Browse Menu →
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ══ Cart ══
  if (phase === 'cart') return (
    <div style={{ minHeight:'100dvh', background:C.bg, color:C.white }}>
      <style>{globalStyles}</style>
      <div style={{ background:C.bg3, padding:'16px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={() => setPhase('menu')} style={{ background:`rgba(59,159,229,.1)`, border:`1px solid ${C.border}`, color:C.blue1, width:38, height:38, borderRadius:'50%', cursor:'pointer', fontSize:18 }}>←</button>
        <h1 style={{ color:C.white, fontSize:17, fontWeight:900, margin:0 }}>🛒 Your Order</h1>
        <div style={{ marginLeft:'auto', color:C.blue1, fontWeight:600, fontSize:13 }}>{table?.name || `Table ${table?.number}`}</div>
      </div>
      <div style={{ padding:20, maxWidth:520, margin:'0 auto' }}>
        {cart.map((c, idx) => {
          const unitPrice = c.selectedSize ? c.selectedSize.price : c.item.price
          return (
          <div key={`${c.item.id}_${c.selectedSize?.id || 'no-size'}_${idx}`} style={{ background:C.bg2, borderRadius:20, padding:16, marginBottom:12, border:`1px solid ${C.border}`, position:'relative' }}>
            {/* زر إلغاء الطلب */}
            <button onClick={() => setCart(p => p.filter((_, i) => i !== idx))}
              style={{ position:'absolute', top:10, left:10, width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.2)', color:'#ef4444', fontSize:16, cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              {c.item.image_url && <img src={c.item.image_url} alt={c.item.name_en} style={{ width:60, height:60, borderRadius:14, objectFit:'cover', flexShrink:0, border:`1px solid ${C.border}` }} />}
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:14, color:C.white, marginBottom:2 }}>{c.item.name_en || c.item.name}</div>
                {c.selectedSize && <div style={{ fontSize:11, color:C.blue1, marginBottom:2, fontWeight:600 }}>{c.selectedSize.name_en || c.selectedSize.name}</div>}
                <div style={{ fontSize:11, color:C.silver2, marginBottom:8 }}>MYR {unitPrice.toFixed(2)} each</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <button onClick={() => removeFromCart(c.item.id, c.selectedSize?.id || null)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.15)', color:'#ef4444', fontSize:20, cursor:'pointer', fontWeight:700 }}>−</button>
                    <span style={{ color:C.white, fontWeight:900, fontSize:16 }}>{c.quantity}</span>
                    <button onClick={() => addToCart(c.item, c.selectedSize || null)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:20, cursor:'pointer', fontWeight:700 }}>+</button>
                  </div>
                  <span style={{ color:C.blue1, fontWeight:900, fontSize:16 }}>MYR {(unitPrice * c.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <input style={{ width:'100%', background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:12, padding:'8px 14px', fontSize:12, color:C.white, outline:'none', marginTop:12, boxSizing:'border-box' as const }}
              placeholder="Special request... e.g. no onion"
              value={c.notes} onChange={e => setCart(p => p.map((ci, i) => i === idx ? { ...ci, notes: e.target.value } : ci))} />
          </div>
          )
        })}
        <button onClick={confirmOrder} disabled={submitting}
          style={{ width:'100%', background: submitting ? '#333' : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:18, padding:'17px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:900, fontSize:16, color:C.white, boxShadow: submitting ? 'none' : `0 8px 32px ${C.glow2}` }}>
          {submitting ? '⏳ Placing order...' : `✅ Confirm Order — ${cartCount} items`}
        </button>
      </div>
    </div>
  )

  // ══ Menu ══
  return (
    <div style={{ minHeight:'100dvh', background:C.bg, color:C.white, paddingBottom: cartCount > 0 ? 100 : 24 }}>
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
              <div style={{ fontSize:16, fontWeight:900, color:C.white, lineHeight:1 }}>ORCHID <span style={{ color:C.blue1 }}>HOUSE</span></div>
              <div style={{ display:'inline-block', marginTop:5, padding:'3px 10px', borderRadius:8, border:`1.5px solid ${C.blue1}`, background:'rgba(59,159,229,.1)', fontSize:12, fontWeight:800, color:C.blue1 }}>{table?.name || `Table ${table?.number}`}</div>
            </div>
          </div>
          <button onClick={() => { setWaiterCalled(true); setTimeout(() => setWaiterCalled(false), 5000) }}
            style={{ background: waiterCalled ? `linear-gradient(135deg,#22C55E,#16A34A)` : `rgba(59,159,229,.1)`, border: waiterCalled ? 'none' : `1px solid ${C.border}`, borderRadius:14, padding:'9px 16px', cursor:'pointer', fontSize:12, color: waiterCalled ? C.white : C.silver, fontWeight:700, transition:'all .3s' }}>
            {waiterCalled ? '✅ On the way!' : '🔔 Call Waiter'}
          </button>
        </div>

        {/* Search */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <input style={{ width:'100%', background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:14, padding:'11px 18px 11px 44px', fontSize:14, color:C.white, outline:'none', caretColor:C.blue1 }}
            placeholder="Search dishes..." value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:16, color:C.silver2 }}>🔍</span>
        </div>

        {/* Categories */}
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:14 }}>
          {[{ id:'all', name_en:'All', name:'All' }, ...visibleCategories].map(c => {
            const timeBadge = (c as Category).time_badge_en || (c as Category).time_badge_ar
            return (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                style={{ padding:'8px 18px', borderRadius:30, border: activeCat === c.id ? 'none' : `1px solid ${C.border}`, background: activeCat === c.id ? `linear-gradient(135deg,${C.blue1},${C.blue2})` : 'rgba(255,255,255,.05)', color: activeCat === c.id ? C.white : C.silver2, cursor:'pointer', fontSize:13, fontWeight: activeCat === c.id ? 800 : 400, whiteSpace:'nowrap', boxShadow: activeCat === c.id ? `0 4px 16px ${C.glow2}` : 'none', transition:'all .2s', display:'flex', alignItems:'center', gap:6 }}>
                {c.name_en || c.name}
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

      {/* ── Items List ── */}
      <div style={{ padding:'14px 14px 100px', display:'flex', flexDirection:'column', gap:36, maxWidth:560, margin:'0 auto' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:C.silver2 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🍽️</div>
            <div>No items found</div>
          </div>
        ) : filteredItems.map(item => {
          const qty = getQty(item.id)
          const hasDiscount = !!(item.discount_percent && item.discount_percent > 0)
          return (
            <div key={item.id} className="item-card"
              style={{
                background: hasDiscount ? 'linear-gradient(135deg, rgba(239,68,68,.08), rgba(220,38,38,.04))' : C.bg2,
                borderRadius:20, overflow:'visible',
                border: hasDiscount ? '1.5px solid #ef4444' : `1px solid ${qty > 0 ? C.blue1 : C.border}`,
                cursor:'pointer', position:'relative', display:'flex', alignItems:'center', minHeight:140,
                boxShadow: hasDiscount ? '0 8px 28px rgba(239,68,68,.25)' : (qty > 0 ? `0 8px 28px ${C.glow}` : `0 4px 16px rgba(0,0,0,.3)`),
                transition:'all .2s'
              }}
              onClick={() => { setSelectedItem(item); setSelectedSize(null) }}>

              {/* ── Discount ribbon (only visible if item has an active discount) ── */}
              {hasDiscount && (
                <div style={{ position:'absolute', top:-12, left:140, background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontSize:10, fontWeight:900, padding:'3px 10px', borderRadius:10, boxShadow:'0 4px 10px rgba(239,68,68,.4)', zIndex:12, display:'flex', alignItems:'center', gap:3 }}>
                  🔥 OFFER -{item.discount_percent}%
                </div>
              )}

              {/* Content (right side) */}
              <div style={{ flex:1, minWidth:0, marginLeft:156, padding:'14px 16px 14px 0', textAlign:'left', position:'relative', zIndex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.white, marginBottom:3, lineHeight:1.3 }}>{item.name_en || item.name}</div>
                <div style={{ fontSize:11, color:C.blue1, marginBottom:6, fontWeight:600 }}>{item.name}</div>
                {item.description_en && (
                  <div style={{ fontSize:10, color:C.silver2, lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{item.description_en}</div>
                )}
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  {item.sizes && item.sizes.filter((s: any) => s.is_active).length > 0 ? (
                    // ✅ أحجام متعددة — كل حجم في بطاقة مستقلة واضحة
                    <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%' }}>
                      {item.sizes.filter((s: any) => s.is_active).map((size: any) => {
                        const sizeQty = getQty(item.id, size.id)
                        return (
                          <div key={size.id}
                            onClick={e => e.stopPropagation()}
                            style={{
                              display:'flex', alignItems:'center', justifyContent:'space-between',
                              background: sizeQty > 0 ? `rgba(59,159,229,0.1)` : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${sizeQty > 0 ? C.blue1 : C.border}`,
                              borderRadius:12, padding:'6px 10px', gap:8,
                            }}>
                            <span style={{ fontSize:11, color: sizeQty > 0 ? C.blue1 : C.silver2, fontWeight:700, flex:1, minWidth:0 }}>{size.name_en || size.name}</span>
                            <span style={{ fontSize:11, fontWeight:900, color:C.white, whiteSpace:'nowrap' }}>MYR {size.price.toFixed(2)}</span>
                            {sizeQty > 0 ? (
                              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                <button onClick={() => removeFromCart(item.id, size.id)} style={{ width:22, height:22, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.2)', color:'#ef4444', fontSize:15, cursor:'pointer', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                                <span style={{ color:C.white, fontWeight:900, fontSize:13, minWidth:16, textAlign:'center' }}>{sizeQty}</span>
                                <button onClick={() => addToCart(item, size)} style={{ width:22, height:22, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:15, cursor:'pointer', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                              </div>
                            ) : (
                              <button onClick={() => addToCart(item, size)} style={{ background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:10, padding:'4px 10px', cursor:'pointer', fontSize:11, fontWeight:800, color:'#fff', whiteSpace:'nowrap' }}>+ Add</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    // صنف بدون أحجام — العرض العادي
                    <>
                      {item.discount_percent && item.discount_percent > 0 ? (
                        <>
                          <div style={{ background:'linear-gradient(135deg,#ef4444,#dc2626)', borderRadius:20, padding:'4px 10px', fontSize:12, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap' }}>
                            <span>MYR {(item.price * (1 - item.discount_percent / 100)).toFixed(2)}</span>
                            <span style={{ fontSize:9, background:'rgba(255,255,255,0.25)', borderRadius:10, padding:'1px 4px' }}>-{item.discount_percent}%</span>
                          </div>
                          <div style={{ fontSize:9, color:'#aaa', textDecoration:'line-through', whiteSpace:'nowrap' }}>MYR {item.price.toFixed(2)}</div>
                        </>
                      ) : (
                        <div style={{ background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, borderRadius:20, padding:'5px 10px', fontSize:12, fontWeight:900, color:C.white, boxShadow:`0 2px 8px ${C.glow}` }}>
                          MYR {item.price.toFixed(2)}
                        </div>
                      )}
                      <div onClick={e => { e.stopPropagation(); addToCart(item) }}
                        style={{ background: qty > 0 ? `linear-gradient(135deg,${C.blue1},${C.blue2})` : `rgba(59,159,229,.1)`, border: qty > 0 ? 'none' : `1px solid ${C.border}`, borderRadius:20, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:800, color: qty > 0 ? C.white : C.blue1, display:'flex', alignItems:'center', gap:4, boxShadow: qty > 0 ? `0 2px 8px ${C.glow}` : 'none' }}>
                        <span style={{ fontSize:15 }}>+</span>
                        <span>{qty > 0 ? qty : 'Add'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Tall Image (left side, bleeds outside card) ── */}
              <div style={{ position:'absolute', top:-14, bottom:-14, left:-14, width:150, borderRadius:20, overflow:'hidden', border: qty > 0 ? `3px solid ${C.blue1}` : `2px solid ${C.border2}`, boxShadow: qty > 0 ? `0 0 20px ${C.glow2}` : `0 6px 20px rgba(0,0,0,.5)`, background:C.bg3, zIndex:10, flexShrink:0 }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name_en} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>🍽️</div>
                }
              </div>

              {/* qty badge */}
              {qty > 0 && (
                <div style={{ position:'absolute', top:-10, right:-6, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, borderRadius:'50%', width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, zIndex:11, boxShadow:`0 2px 8px ${C.glow2}` }}>{qty}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Item Sheet */}
      {ItemSheet}

      {/* ── Cart Bar ── */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 16px 20px', background:`rgba(10,15,26,.96)`, borderTop:`1px solid ${C.border}`, zIndex:100, backdropFilter:'blur(8px)' }}>
          <div style={{ maxWidth:520, margin:'0 auto' }}>
            <button onClick={() => setPhase('cart')}
              style={{ width:'100%', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:18, padding:'15px 20px', cursor:'pointer', fontWeight:900, fontSize:15, color:C.white, display:'flex', justifyContent:'center', alignItems:'center', boxShadow:`0 8px 28px ${C.glow2}` }}>
              <span>🛒 View Order ({cartCount} items)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
