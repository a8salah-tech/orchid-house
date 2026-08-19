'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../components/AuthProvider'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ══ نفس ألوان صفحة الموظفين للحفاظ على تطابق التصميم بين صفحات النظام الإداري ══
const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_confirmation: { label: '⏳ قيد التثبيت',   color: S.amber, bg: S.amberB },
  confirmed:            { label: '✅ مؤكَّد',          color: S.blue,  bg: S.blueB },
  completed:            { label: '🏁 مكتمل',          color: S.green, bg: S.greenB },
  cancelled:            { label: '❌ ملغي',           color: S.red,   bg: S.redB },
}
const SHIFT_LABEL: Record<string, string> = { morning: '☀️ شيفت صباحي', evening: '🌙 شيفت مسائي' }
const PAYMENT_LABEL: Record<string, string> = { cash: '💵 نقدًا', visa: '💳 فيزا', online: '🌐 أونلاين', bank_transfer: '🏦 تحويل بنكي', other: '➕ أخرى' }

// ══ Types ══
interface Branch { id: string; name: string }
interface EmployeeLite { id: string; name: string; role: string; branch_id: string; is_active: boolean }
interface MenuItemLite { id: string; name: string; name_en: string; price: number; category_id: string }
interface BuffetItem { id?: string; menu_item_id: string | null; item_name: string; quantity: number; unit_price: number }
interface BuffetConfirmation {
  id?: string; buffet_order_id: string
  kitchen_manager_id: string | null; kitchen_confirmed_at: string | null
  hall_manager_id: string | null; hall_confirmed_at: string | null
  responsible_employee_id: string | null; assigned_by: string | null; assigned_at: string | null
}
interface BuffetRating { id?: string; buffet_order_id: string; rated_by: string | null; stars: number; issues_notes: string | null; created_at?: string }
interface BuffetOrder {
  id: string; branch_id: string; buffet_date: string; buffet_time: string
  guests_count: number; adults_count: number | null; kids_count: number | null
  shift: string | null; payment_method: string
  total_amount: number; paid_amount: number; status: string; notes: string | null
  created_by: string | null; created_at: string; branches?: { name: string }
}
// ✅ جديد: بند من بنود قائمة تجهيز البوفية
interface PrepItem { id: string; buffet_order_id: string; category: string; item_name: string; quantity_needed: number; is_prepared: boolean; sort_order: number }

// ✅ جديد: القائمة الأساسية الشاملة لتجهيزات أي بوفية (١٠٠ بند مقسّمة على ٨ فئات) — تُستخدم كنموذج افتراضي يُنسخ لكل طلب بوفية جديد
const PREP_CATEGORIES: { category: string; items: string[] }[] = [
  { category: '🍽️ أدوات المائدة والتقديم', items: [
    'صحون كبيرة', 'صحون صغيرة', 'صحون تحلية', 'أطباق تقديم رئيسية', 'ملاعق كبيرة', 'ملاعق صغيرة',
    'شوك', 'سكاكين', 'ملاعق تقديم (سرفس)', 'ملقط تقديم', 'أكواب مياه', 'أكواب شاي', 'أكواب عصير',
    'فناجين قهوة', 'صحون فناجين', 'مناديل ورقية', 'مناديل قماش', 'أطباق سلطة', 'أوعية صوص',
    'سفرية كبيرة (تقديم أرز/مندي)', 'سفرية صغيرة', 'صواني تقديم معدنية', 'أباريق شاي', 'أباريق قهوة',
    'حاملات صحون ساخنة (تحت الصحن)',
  ]},
  { category: '🔥 التسخين والتبريد', items: [
    'سخان ماء', 'سخان شاي', 'سخانات طعام (شافينج ديش)', 'مواقد تسخين احتياطية', 'صناديق تبريد (كولر)',
    'ثلاجة عرض متنقلة', 'ترامس شاي', 'ترامس قهوة', 'أواني حفظ حرارة الأرز', 'سلك/شبكة تسخين احتياطي',
  ]},
  { category: '🥤 المشروبات والمياه', items: [
    'جك مياه كبير', 'جك مياه صغير', 'زجاجات مياه فردية', 'ثلج', 'عصائر جاهزة', 'مشروبات غازية',
    'آلة قهوة/إسبريسو', 'مبرد مشروبات', 'أكياس شاي وقهوة احتياطية', 'سكر وحليب للضيافة',
  ]},
  { category: '🌸 الديكور والتنسيق', items: [
    'ستائر', 'مفارش طاولات', 'مفارش كراسي', 'تنسيق زهور للطاولة المركزية', 'شموع/إضاءة ديكور', 'بالونات',
    'لافتة اسم المناسبة', 'سجادة استقبال', 'حاملات قوائم الطعام (منيو ستاند)', 'لوحة ترحيب',
    'إكسسوارات طاولة البوفية الرئيسية', 'زهور طبيعية أو صناعية للممرات', 'إضاءة خارجية (إن وجدت)',
    'ديكور المدخل', 'عناصر تزيين حسب مناسبة العميل (عيد ميلاد، خطوبة، إلخ)',
  ]},
  { category: '🔊 الصوتيات والمرئيات', items: [
    'شاشات', 'سماعات', 'ميكروفون', 'مضخم صوت', 'كابلات توصيل', 'راوتر إنترنت للفعالية',
    'جهاز عرض بروجكتور', 'كاميرا تصوير للمناسبة (إن طُلبت)', 'مصدر موسيقى/بلاي ليست', 'مصدر كهرباء احتياطي (UPS)',
  ]},
  { category: '🪑 الأثاث', items: [
    'طاولات الضيوف', 'كراسي الضيوف', 'طاولة البوفية الرئيسية', 'طاولة الحلويات', 'طاولة الاستقبال',
    'ستاندات تقديم مرتفعة', 'طاولة أطفال (إن وجدت)', 'كراسي أطفال', 'طاولة هدايا/كروت', 'حواجز تنظيم الطابور',
  ]},
  { category: '🧼 النظافة والسلامة', items: [
    'أكياس قمامة', 'مناديل تنظيف', 'معقم أيدي', 'قفازات تقديم', 'مطهرات أسطح', 'طفاية حريق',
    'صندوق إسعافات أولية', 'لافتات إرشادية (مخرج/دخول)', 'سلال قمامة إضافية', 'ممسحة وأدوات تنظيف سريع',
  ]},
  { category: '👥 الطاقم والتنظيم', items: [
    'عدد الجرسونات المطلوب', 'الشيف المسؤول عن البوفية', 'منسق/مسؤول تنظيم الحفل',
    'جدول أوقات التقديم (البداية/التقديم/الختام)', 'خطة توزيع المهام بين الموظفين', 'زي موحد للطاقم',
    'بطاقات أسماء الموظفين', 'خطة الطوارئ (نقص كمية، تأخير، إلخ)', 'تنسيق موعد الوصول المسبق للتجهيز',
    'مراجعة نهائية قبل بدء الحفل (تشيك ليست ختامي)',
  ]},
]

// ══ جلب الصنف المسؤول والتقييم لطلب بوفية محدد ══
async function fetchOrderExtras(supabase: ReturnType<typeof createClient>, orderId: string) {
  const [conf, items, rating] = await Promise.all([
    supabase.from('buffet_confirmations').select('*').eq('buffet_order_id', orderId).maybeSingle(),
    supabase.from('buffet_order_items').select('*').eq('buffet_order_id', orderId).order('created_at'),
    supabase.from('buffet_ratings').select('*').eq('buffet_order_id', orderId).maybeSingle(),
  ])
  return { confirmation: conf.data as BuffetConfirmation | null, items: (items.data || []) as BuffetItem[], rating: rating.data as BuffetRating | null }
}

// ══════════════════════════════════════════════════════════════
// ══ Modal: طلب بوفية جديد ══
// ══════════════════════════════════════════════════════════════
function NewBuffetModal({ currentUser, isAdmin, branches, menuItems, onClose, onSaved }: {
  currentUser: any; isAdmin: boolean; branches: Branch[]; menuItems: MenuItemLite[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [branchId, setBranchId] = useState(currentUser?.branch_id || '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('12:00')
  const [guests, setGuests] = useState('10')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paidAmount, setPaidAmount] = useState('0')
  const [totalAmount, setTotalAmount] = useState('0')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<BuffetItem[]>([])
  const [menuSearch, setMenuSearch] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredMenu = menuSearch.trim()
    ? menuItems.filter(m => m.name.includes(menuSearch) || m.name_en?.toLowerCase().includes(menuSearch.toLowerCase())).slice(0, 8)
    : []

  function addFromMenu(m: MenuItemLite) {
    setItems(p => [...p, { menu_item_id: m.id, item_name: m.name_en || m.name, quantity: 1, unit_price: m.price }])
    setMenuSearch('')
  }
  function addManual() {
    if (!manualName.trim()) return
    setItems(p => [...p, { menu_item_id: null, item_name: manualName.trim(), quantity: 1, unit_price: parseFloat(manualPrice) || 0 }])
    setManualName(''); setManualPrice('')
  }
  function updateItem(idx: number, patch: Partial<BuffetItem>) {
    setItems(p => p.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }
  function removeItem(idx: number) {
    setItems(p => p.filter((_, i) => i !== idx))
  }

  const itemsTotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0)

  // ✅ الإجمالي يُحسب تلقائيًا من مجموع الأصناف، لكن يبقى قابلًا للتعديل اليدوي (لسعر باقة بوفية مخصص مثلًا)
  useEffect(() => { setTotalAmount(itemsTotal.toFixed(2)) }, [itemsTotal])

  const totalNum = parseFloat(totalAmount) || 0
  const paidNum = parseFloat(paidAmount) || 0
  const remaining = Math.max(0, totalNum - paidNum)

  async function save() {
    setError('')
    if (!branchId) { setError('يرجى اختيار الفرع'); return }
    if (!date || !time) { setError('يرجى إدخال التاريخ والوقت'); return }
    if (items.length === 0) { setError('يرجى إضافة صنف واحد على الأقل'); return }
    setSaving(true)

    const { data: order, error: orderErr } = await supabase.from('buffet_orders').insert([{
      branch_id: branchId,
      buffet_date: date,
      buffet_time: time,
      guests_count: parseInt(guests) || 1,
      payment_method: paymentMethod,
      total_amount: totalNum,
      paid_amount: paidNum,
      notes: notes.trim() || null,
      created_by: currentUser?.id || null,
    }]).select('id').single()

    if (orderErr || !order) {
      setError('حدث خطأ أثناء حفظ طلب البوفية: ' + (orderErr?.message || ''))
      setSaving(false)
      return
    }

    const { error: itemsErr } = await supabase.from('buffet_order_items').insert(
      items.map(it => ({ buffet_order_id: order.id, menu_item_id: it.menu_item_id, item_name: it.item_name, quantity: it.quantity, unit_price: it.unit_price }))
    )
    if (itemsErr) {
      setError('تم حفظ الطلب لكن حدث خطأ في حفظ الأصناف: ' + itemsErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>🍽️ طلب بوفية جديد</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: S.red }}>❌ {error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الفرع *</label>
            {isAdmin ? (
              <select style={inp} value={branchId} onChange={e => setBranchId(e.target.value)}>
                <option value="">اختر الفرع</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : (
              <div style={{ ...inp, background: S.card, color: S.muted }}>{branches.find(b => b.id === branchId)?.name || '—'}</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>عدد الأشخاص *</label>
            <input style={inp} type="number" min={1} value={guests} onChange={e => setGuests(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التاريخ *</label>
            <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الوقت *</label>
            <input style={inp} type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        {/* ── اختيار الأصناف ── */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>الوجبات *</label>

          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input style={inp} value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="🔍 ابحث عن صنف من المنيو لإضافته..." />
            {filteredMenu.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, marginTop: 4, zIndex: 10, maxHeight: 220, overflowY: 'auto' }}>
                {filteredMenu.map(m => (
                  <div key={m.id} onClick={() => addFromMenu(m)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: S.white, borderBottom: `1px solid ${S.border}` }}>
                    <span>{m.name}</span>
                    <span style={{ color: S.gold }}>MYR {m.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input style={{ ...inp, flex: 2 }} value={manualName} onChange={e => setManualName(e.target.value)} placeholder="اسم صنف يدوي (غير موجود بالمنيو)" />
            <input style={{ ...inp, flex: 1 }} type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="السعر" />
            <button onClick={addManual} style={{ padding: '0 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>+ إضافة</button>
          </div>

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: S.muted, fontSize: 13, background: S.card, borderRadius: 10 }}>لم تتم إضافة أي وجبات بعد</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: S.card, borderRadius: 10, padding: '8px 10px' }}>
                  <span style={{ flex: 1, fontSize: 13, color: S.white }}>{it.item_name}</span>
                  <input type="number" min={1} value={it.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })} style={{ width: 50, ...inp, padding: '5px 8px', textAlign: 'center' }} />
                  <span style={{ color: S.muted, fontSize: 12 }}>×</span>
                  <input type="number" value={it.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} style={{ width: 70, ...inp, padding: '5px 8px', textAlign: 'center' }} />
                  <span style={{ width: 70, textAlign: 'left', color: S.gold, fontSize: 12, fontWeight: 700 }}>MYR {(it.quantity * it.unit_price).toFixed(2)}</span>
                  <button onClick={() => removeItem(idx)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 16 }}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>طريقة الدفع *</label>
            <select style={inp} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              {Object.entries(PAYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المبلغ المدفوع (MYR)</label>
            <input style={inp} type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الإجمالي (MYR) — قابل للتعديل</label>
            <input style={inp} type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المبلغ المتبقي (محسوب تلقائيًا)</label>
            <div style={{ ...inp, background: S.card, color: remaining > 0 ? S.red : S.green, fontWeight: 700 }}>MYR {remaining.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
          <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي تفاصيل إضافية عن البوفية..." />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 28px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الحفظ...' : '✅ حفظ الطلب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ══ Modal: تفاصيل البوفية — التثبيت، التعيين، التقييم ══
// ══════════════════════════════════════════════════════════════
function BuffetDetailModal({ order, currentUser, isAdmin, isKitchenManager, isHallManager, branchEmployees, onClose, onChanged }: {
  order: BuffetOrder; currentUser: any; isAdmin: boolean; isKitchenManager: boolean; isHallManager: boolean
  branchEmployees: EmployeeLite[]; onClose: () => void; onChanged: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<BuffetItem[]>([])
  const [confirmation, setConfirmation] = useState<BuffetConfirmation | null>(null)
  const [rating, setRating] = useState<BuffetRating | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [assignEmpId, setAssignEmpId] = useState('')
  const [assignShift, setAssignShift] = useState('morning')

  const [ratingStars, setRatingStars] = useState(0)
  const [ratingNotes, setRatingNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const extras = await fetchOrderExtras(supabase, order.id)
    setItems(extras.items)
    setConfirmation(extras.confirmation)
    setRating(extras.rating)
    if (extras.confirmation?.responsible_employee_id) setAssignEmpId(extras.confirmation.responsible_employee_id)
    setLoading(false)
  }, [order.id])

  useEffect(() => { load() }, [load])

  const employeesById = Object.fromEntries(branchEmployees.map(e => [e.id, e]))
  const remaining = Math.max(0, order.total_amount - order.paid_amount)

  // ✅ بعد أي تحديث للتثبيت أو التعيين، نتحقق: إذا اكتمل تثبيت المطبخ + الصالة + تعيين الموظف المسؤول، ينتقل الطلب تلقائيًا لحالة "مؤكَّد"
  async function maybePromoteToConfirmed(conf: BuffetConfirmation) {
    if (conf.kitchen_confirmed_at && conf.hall_confirmed_at && conf.responsible_employee_id && order.status === 'pending_confirmation') {
      await supabase.from('buffet_orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', order.id)
    }
  }

  async function upsertConfirmation(patch: Partial<BuffetConfirmation>) {
    setBusy(true); setError('')
    const base: BuffetConfirmation = confirmation || { buffet_order_id: order.id, kitchen_manager_id: null, kitchen_confirmed_at: null, hall_manager_id: null, hall_confirmed_at: null, responsible_employee_id: null, assigned_by: null, assigned_at: null }
    const merged = { ...base, ...patch }
    const { data, error: err } = await supabase.from('buffet_confirmations')
      .upsert([{ ...merged, updated_at: new Date().toISOString() }], { onConflict: 'buffet_order_id' })
      .select('*').single()
    if (err) { setError('حدث خطأ: ' + err.message); setBusy(false); return }
    setConfirmation(data)
    await maybePromoteToConfirmed(data)
    setBusy(false)
    onChanged()
  }

  async function confirmKitchen() {
    await upsertConfirmation({ kitchen_manager_id: currentUser?.id, kitchen_confirmed_at: new Date().toISOString() })
  }
  async function confirmHall() {
    await upsertConfirmation({ hall_manager_id: currentUser?.id, hall_confirmed_at: new Date().toISOString() })
  }
  async function assignResponsible() {
    if (!assignEmpId) { setError('يرجى اختيار الموظف المسؤول'); return }
    await upsertConfirmation({ responsible_employee_id: assignEmpId, assigned_by: currentUser?.id, assigned_at: new Date().toISOString() })
    await supabase.from('buffet_orders').update({ shift: assignShift }).eq('id', order.id)
  }

  async function submitRating() {
    if (ratingStars < 1) { setError('يرجى اختيار تقييم بالنجوم أولًا'); return }
    setBusy(true); setError('')
    const { data, error: err } = await supabase.from('buffet_ratings').insert([{
      buffet_order_id: order.id, rated_by: currentUser?.id, stars: ratingStars, issues_notes: ratingNotes.trim() || null,
    }]).select('*').single()
    if (err) { setError('حدث خطأ أثناء حفظ التقييم: ' + err.message); setBusy(false); return }
    await supabase.from('buffet_orders').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', order.id)
    setRating(data)
    setBusy(false)
    onChanged()
  }

  async function cancelOrder() {
    if (!confirm('تأكيد إلغاء طلب البوفية؟')) return
    setBusy(true)
    await supabase.from('buffet_orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', order.id)
    setBusy(false)
    onChanged()
    onClose()
  }

  // ✅ جديد: حذف نهائي لطلب البوفية بالكامل من قاعدة البيانات — للأدمن فقط
  async function deleteOrder() {
    if (!confirm('تحذير: سيتم حذف طلب البوفية هذا نهائيًا مع كل بياناته (الأصناف، التثبيتات، التقييم، قائمة التجهيز). هل أنت متأكد؟')) return
    setBusy(true)
    const { error: err } = await supabase.from('buffet_orders').delete().eq('id', order.id)
    setBusy(false)
    if (err) { setError('حدث خطأ أثناء الحذف: ' + err.message); return }
    onChanged()
    onClose()
  }

  const st = STATUS[order.status] || STATUS.pending_confirmation
  const canConfirmKitchen = isKitchenManager && !confirmation?.kitchen_confirmed_at
  const canConfirmHall = isHallManager && !confirmation?.hall_confirmed_at
  const canAssign = (isKitchenManager || isHallManager || isAdmin) && order.status !== 'completed' && order.status !== 'cancelled'
  const isResponsible = confirmation?.responsible_employee_id === currentUser?.id
  const canRate = isResponsible && order.status === 'confirmed'
  const canCancel = (isAdmin || order.created_by === currentUser?.id) && order.status !== 'completed' && order.status !== 'cancelled'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 28, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>🍽️ {order.branches?.name || 'بوفية'}</h3>
            <div style={{ fontSize: 13, color: S.muted }}>{order.buffet_date} — {order.buffet_time} · 👥 {order.guests_count} شخص</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <span style={{ display: 'inline-block', background: st.bg, color: st.color, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, marginBottom: 18 }}>{st.label}</span>
        {error && <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: S.red }}>❌ {error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: S.muted }}>⏳ جاري التحميل...</div>
        ) : (
          <>
            {/* ── الأصناف ── */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: S.muted, marginBottom: 8, fontWeight: 700 }}>الوجبات</div>
              <div style={{ background: S.card, borderRadius: 10, overflow: 'hidden' }}>
                {items.map((it, i) => (
                  <div key={it.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 13, borderBottom: i < items.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                    <span style={{ color: S.white }}>{it.item_name} × {it.quantity}</span>
                    <span style={{ color: S.gold, fontWeight: 700 }}>MYR {(it.quantity * it.unit_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── الدفع ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>الإجمالي</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: S.white }}>MYR {order.total_amount.toFixed(2)}</div>
              </div>
              <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>المدفوع</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: S.green }}>MYR {order.paid_amount.toFixed(2)}</div>
              </div>
              <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>المتبقي</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: remaining > 0 ? S.red : S.green }}>MYR {remaining.toFixed(2)}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 18 }}>طريقة الدفع: {PAYMENT_LABEL[order.payment_method] || order.payment_method}</div>
            {order.notes && <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: S.muted }}>📝 {order.notes}</div>}

            {/* ── تثبيت المسؤولية ── */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: S.muted, marginBottom: 8, fontWeight: 700 }}>تثبيت المسؤولية</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
                  <span style={{ fontSize: 13, color: S.white }}>🍳 مدير المطبخ</span>
                  {confirmation?.kitchen_confirmed_at ? (
                    <span style={{ fontSize: 12, color: S.green, fontWeight: 700 }}>✅ {employeesById[confirmation.kitchen_manager_id || '']?.name || 'تم التثبيت'}</span>
                  ) : canConfirmKitchen ? (
                    <button onClick={confirmKitchen} disabled={busy} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>تثبيت مسؤوليتي</button>
                  ) : (
                    <span style={{ fontSize: 12, color: S.muted }}>لم يُثبَّت بعد</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
                  <span style={{ fontSize: 13, color: S.white }}>🏛️ مدير الصالة</span>
                  {confirmation?.hall_confirmed_at ? (
                    <span style={{ fontSize: 12, color: S.green, fontWeight: 700 }}>✅ {employeesById[confirmation.hall_manager_id || '']?.name || 'تم التثبيت'}</span>
                  ) : canConfirmHall ? (
                    <button onClick={confirmHall} disabled={busy} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>تثبيت مسؤوليتي</button>
                  ) : (
                    <span style={{ fontSize: 12, color: S.muted }}>لم يُثبَّت بعد</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── تعيين الموظف المسؤول والشيفت ── */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: S.muted, marginBottom: 8, fontWeight: 700 }}>الموظف المسؤول عن التنفيذ</div>
              {confirmation?.responsible_employee_id && (
                <div style={{ background: S.greenB, border: `1px solid ${S.green}`, borderRadius: 10, padding: '10px 14px', marginBottom: canAssign ? 10 : 0, fontSize: 13, color: S.white, display: 'flex', justifyContent: 'space-between' }}>
                  <span>👤 {employeesById[confirmation.responsible_employee_id]?.name || 'موظف'}</span>
                  <span style={{ color: S.green, fontWeight: 700 }}>{order.shift ? SHIFT_LABEL[order.shift] : ''}</span>
                </div>
              )}
              {canAssign && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select style={{ ...inp, flex: 2 }} value={assignEmpId} onChange={e => setAssignEmpId(e.target.value)}>
                    <option value="">اختر الموظف المسؤول</option>
                    {branchEmployees.filter(e => e.is_active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <select style={{ ...inp, flex: 1 }} value={assignShift} onChange={e => setAssignShift(e.target.value)}>
                    <option value="morning">☀️ صباحي</option>
                    <option value="evening">🌙 مسائي</option>
                  </select>
                  <button onClick={assignResponsible} disabled={busy} style={{ padding: '0 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>تعيين</button>
                </div>
              )}
            </div>

            {/* ── التقييم ── */}
            {order.status === 'completed' && rating ? (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, color: S.muted, marginBottom: 8, fontWeight: 700 }}>⭐ تقييم تنفيذ البوفية</div>
                <div style={{ background: S.card, borderRadius: 10, padding: '14px' }}>
                  <div style={{ fontSize: 16, color: S.gold, marginBottom: 6 }}>{'⭐'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}</div>
                  {rating.issues_notes && <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.6 }}>{rating.issues_notes}</div>}
                </div>
              </div>
            ) : canRate ? (
              <div style={{ marginBottom: 18, background: S.card, borderRadius: 12, padding: 16, border: `1px dashed ${S.gold}40` }}>
                <div style={{ fontSize: 13, color: S.muted, marginBottom: 8, fontWeight: 700 }}>⭐ إنهاء البوفية وتقييم التنفيذ</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setRatingStars(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, padding: 0, filter: n <= ratingStars ? 'none' : 'grayscale(1) opacity(.4)' }}>⭐</button>
                  ))}
                </div>
                <textarea value={ratingNotes} onChange={e => setRatingNotes(e.target.value)} rows={3}
                  placeholder="هل واجهت أي أخطاء أو مشاكل أثناء تنفيذ هذا البوفية؟ (اختياري) — تدوينها هنا يساعد على تجنبها في البوفيهات القادمة"
                  style={{ ...inp, resize: 'none', marginBottom: 10 }} />
                <button onClick={submitRating} disabled={busy} style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {busy ? '⏳...' : '🏁 إنهاء البوفية وحفظ التقييم'}
                </button>
              </div>
            ) : null}

            {(canCancel || isAdmin) && (
              <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 20, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {canCancel && (
                  <button onClick={cancelOrder} disabled={busy} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>❌ إلغاء طلب البوفية</button>
                )}
                {isAdmin && (
                  <button onClick={deleteOrder} disabled={busy} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${S.red}`, background: 'transparent', color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>🗑️ حذف نهائي (أدمن فقط)</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ══ Modal: تجهيز البوفية — القائمة، التوزيع، الطباعة ══
// ══════════════════════════════════════════════════════════════
function BuffetPrepModal({ order, onClose, onChanged }: { order: BuffetOrder; onClose: () => void; onChanged: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PrepItem[]>([])
  const [adults, setAdults] = useState(String(order.adults_count ?? order.guests_count))
  const [kids, setKids] = useState(String(order.kids_count ?? 0))
  const [savingMeta, setSavingMeta] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('buffet_prep_checklist').select('*').eq('buffet_order_id', order.id).order('sort_order')
    if (!data || data.length === 0) {
      // ✅ أول فتح لهذا الطلب: ننسخ القائمة الأساسية (١٠٠ بند) تلقائيًا كنقطة بداية
      const seedRows: any[] = []
      let sort = 0
      PREP_CATEGORIES.forEach(cat => {
        cat.items.forEach(name => {
          // الأصناف الشخصية (صحون، ملاعق، أكواب...) تُقترح بعدد الضيوف تلقائيًا، والباقي بعدد 1 قابل للتعديل
          const isPersonal = /صحن|ملعق|شوك|سكاكين|كوب|أكواب|فنجان|فناجين|منديل/.test(name)
          seedRows.push({ buffet_order_id: order.id, category: cat.category, item_name: name, quantity_needed: isPersonal ? order.guests_count : 1, is_prepared: false, sort_order: sort++ })
        })
      })
      const { data: inserted } = await supabase.from('buffet_prep_checklist').insert(seedRows).select('*').order('sort_order')
      setRows(inserted || [])
    } else {
      setRows(data)
    }
    setLoading(false)
  }, [order.id])

  useEffect(() => { load() }, [load])

  async function toggleDone(row: PrepItem) {
    setRows(p => p.map(r => r.id === row.id ? { ...r, is_prepared: !r.is_prepared } : r))
    await supabase.from('buffet_prep_checklist').update({ is_prepared: !row.is_prepared, updated_at: new Date().toISOString() }).eq('id', row.id)
  }
  async function updateQty(row: PrepItem, qty: number) {
    setRows(p => p.map(r => r.id === row.id ? { ...r, quantity_needed: qty } : r))
    await supabase.from('buffet_prep_checklist').update({ quantity_needed: qty, updated_at: new Date().toISOString() }).eq('id', row.id)
  }
  async function saveMeta() {
    setSavingMeta(true)
    await supabase.from('buffet_orders').update({ adults_count: parseInt(adults) || 0, kids_count: parseInt(kids) || 0 }).eq('id', order.id)
    setSavingMeta(false)
    onChanged()
  }
  function toggleCategory(cat: string) {
    setCollapsed(p => { const n = new Set(p); n.has(cat) ? n.delete(cat) : n.add(cat); return n })
  }

  const doneCount = rows.filter(r => r.is_prepared).length

  // ✅ فتح نافذة طباعة منفصلة بقائمة تجهيز نظيفة جاهزة للطباعة الورقية
  function printChecklist() {
    const win = window.open('', '_blank')
    if (!win) return
    const bodyRows = PREP_CATEGORIES.map(cat => {
      const catRows = rows.filter(r => r.category === cat.category)
      if (catRows.length === 0) return ''
      return `<tr><td colspan="3" style="background:#222;color:#fff;font-weight:bold;padding:8px 10px;">${cat.category}</td></tr>` +
        catRows.map(r => `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${r.item_name}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:center;width:90px;">${r.quantity_needed}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:center;width:70px;font-size:16px;">${r.is_prepared ? '✔' : '☐'}</td>
          </tr>`).join('')
    }).join('')
    win.document.write(`
      <html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>قائمة تجهيز البوفية</title>
      <style>
        body { font-family: Tajawal, Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 6px; }
        p { color: #444; margin: 2px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 18px; }
        thead th { background: #C9A84C; color: #111; padding: 8px 10px; text-align: right; font-size: 13px; }
        @media print { body { padding: 10px; } }
      </style></head>
      <body>
        <h1>قائمة تجهيز البوفية${order.branches?.name ? ' — ' + order.branches.name : ''}</h1>
        <p>التاريخ: ${order.buffet_date} — الوقت: ${order.buffet_time}</p>
        <p>عدد الأشخاص: ${order.guests_count} (كبار: ${adults || '—'} / صغار: ${kids || '—'})</p>
        <table>
          <thead><tr><th>البند</th><th>العدد المطلوب</th><th>تم التجهيز</th></tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <script>window.onload = function(){ window.print() }</script>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 28, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h3 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>🧺 تجهيز البوفية{order.branches?.name ? ' — ' + order.branches.name : ''}</h3>
            <div style={{ fontSize: 13, color: S.muted }}>{order.buffet_date} — {order.buffet_time} · 👥 {order.guests_count} شخص</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={printChecklist} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ طباعة</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 18, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>عدد الكبار</label>
            <input style={inp} type="number" min={0} value={adults} onChange={e => setAdults(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>عدد الصغار (أطفال)</label>
            <input style={inp} type="number" min={0} value={kids} onChange={e => setKids(e.target.value)} />
          </div>
          <button onClick={saveMeta} disabled={savingMeta} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{savingMeta ? '⏳' : 'حفظ'}</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: S.muted }}>⏳ جاري التحميل...</div>
        ) : (
          <>
            <div style={{ background: S.gold3, border: `1px solid ${S.goldB}`, borderRadius: 10, padding: '8px 14px', marginBottom: 14, fontSize: 13, color: S.gold, fontWeight: 700, textAlign: 'center' }}>
              ✅ تم تجهيز {doneCount} من أصل {rows.length} بند
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PREP_CATEGORIES.map(cat => {
                const catRows = rows.filter(r => r.category === cat.category)
                if (catRows.length === 0) return null
                const catDone = catRows.filter(r => r.is_prepared).length
                const isCollapsed = collapsed.has(cat.category)
                return (
                  <div key={cat.category} style={{ background: S.card, borderRadius: 12, overflow: 'hidden' }}>
                    <button onClick={() => toggleCategory(cat.category)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{cat.category}</span>
                      <span style={{ fontSize: 11, color: catDone === catRows.length ? S.green : S.muted }}>{catDone}/{catRows.length} {isCollapsed ? '▸' : '▾'}</span>
                    </button>
                    {!isCollapsed && (
                      <div>
                        {catRows.map(r => (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderTop: `1px solid ${S.border}` }}>
                            <span style={{ flex: 1, fontSize: 12.5, color: r.is_prepared ? S.muted : S.white, textDecoration: r.is_prepared ? 'line-through' : 'none' }}>{r.item_name}</span>
                            <input type="number" min={0} value={r.quantity_needed} onChange={e => updateQty(r, parseFloat(e.target.value) || 0)} style={{ width: 60, ...inp, padding: '4px 6px', textAlign: 'center', fontSize: 12 }} />
                            <button onClick={() => toggleDone(r)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${r.is_prepared ? S.green : S.border}`, background: r.is_prepared ? S.greenB : 'transparent', color: S.green, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>{r.is_prepared ? '✔' : ''}</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ══ الصفحة الرئيسية ══
// ══════════════════════════════════════════════════════════════
export default function BuffetPage() {
  const supabase = createClient()
  const { employee: currentUser, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  const role = currentUser?.role || ''
  const isKitchenManager = role === 'kitchen_manager'
  const isHallManager = role === 'hall_manager'
  // مدراء المطبخ والصالة يرون كل طلبات البوفية في فرعهم (نفس أسلوب مدير الفرع في صفحة الموظفين)
  const isBranchWideViewer = isAdmin || isKitchenManager || isHallManager

  const [orders, setOrders] = useState<BuffetOrder[]>([])
  const [confirmationsMap, setConfirmationsMap] = useState<Record<string, BuffetConfirmation>>({})
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<EmployeeLite[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [detailOrder, setDetailOrder] = useState<BuffetOrder | null>(null)
  const [prepOrder, setPrepOrder] = useState<BuffetOrder | null>(null)
  const [tab, setTab] = useState<'orders' | 'prep'>('orders')
  const [filterBranch, setFilterBranch] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const fetchAll = useCallback(async () => {
    if (!currentUser?.id) return
    setLoading(true)

    const [br, emp, mi] = await Promise.all([
      supabase.from('branches').select('id,name').eq('is_active', true),
      supabase.from('employees').select('id,name,role,branch_id,is_active'),
      supabase.from('menu_items').select('id,name,name_en,price,category_id').eq('is_active', true).eq('is_available', true),
    ])
    setBranches(br.data || [])
    setEmployees(emp.data || [])
    setMenuItems(mi.data || [])

    let ordersData: BuffetOrder[] = []
    if (isBranchWideViewer) {
      let q = supabase.from('buffet_orders').select('*, branches(name)').order('buffet_date').order('buffet_time')
      if (!isAdmin) q = q.eq('branch_id', currentUser?.branch_id || '')
      const { data } = await q
      ordersData = data || []
    } else {
      // ✅ الموظف العادي يرى فقط طلبات البوفية التي أنشأها أو التي عُيِّن مسؤولًا عنها
      const { data: myConf } = await supabase.from('buffet_confirmations').select('buffet_order_id').eq('responsible_employee_id', currentUser.id)
      const responsibleIds = (myConf || []).map(c => c.buffet_order_id)
      let q = supabase.from('buffet_orders').select('*, branches(name)').order('buffet_date').order('buffet_time')
      if (responsibleIds.length > 0) {
        q = q.or(`created_by.eq.${currentUser.id},id.in.(${responsibleIds.join(',')})`)
      } else {
        q = q.eq('created_by', currentUser.id)
      }
      const { data } = await q
      ordersData = data || []
    }
    setOrders(ordersData)

    if (ordersData.length > 0) {
      const { data: confs } = await supabase.from('buffet_confirmations').select('*').in('buffet_order_id', ordersData.map(o => o.id))
      const map: Record<string, BuffetConfirmation> = {}
      ;(confs || []).forEach(c => { map[c.buffet_order_id] = c })
      setConfirmationsMap(map)
    } else {
      setConfirmationsMap({})
    }

    setLoading(false)
  }, [currentUser?.id, currentUser?.branch_id, isAdmin, isBranchWideViewer])

  useEffect(() => { fetchAll() }, [fetchAll])

  const employeesById = Object.fromEntries(employees.map(e => [e.id, e]))
  const branchEmployeesForOrder = (branchId: string) => employees.filter(e => e.branch_id === branchId)

  // ✅ جديد: ملخص حالة التجهيز لكل طلب — يظهر على البطاقات عند فتح تبويب "تجهيز البوفية"
  const [prepSummary, setPrepSummary] = useState<Record<string, { done: number; total: number }>>({})
  useEffect(() => {
    if (tab !== 'prep' || orders.length === 0) { return }
    ;(async () => {
      const { data } = await supabase.from('buffet_prep_checklist').select('buffet_order_id, is_prepared').in('buffet_order_id', orders.map(o => o.id))
      const map: Record<string, { done: number; total: number }> = {}
      ;(data || []).forEach(r => {
        if (!map[r.buffet_order_id]) map[r.buffet_order_id] = { done: 0, total: 0 }
        map[r.buffet_order_id].total++
        if (r.is_prepared) map[r.buffet_order_id].done++
      })
      setPrepSummary(map)
    })()
  }, [tab, orders])

  // ✅ جديد: حذف نهائي سريع من البطاقة مباشرة — أدمن فقط
  async function deleteOrderQuick(o: BuffetOrder) {
    if (!confirm('تحذير: سيتم حذف طلب البوفية هذا نهائيًا مع كل بياناته. هل أنت متأكد؟')) return
    await supabase.from('buffet_orders').delete().eq('id', o.id)
    fetchAll()
  }

  const visibleOrders = orders.filter(o => {
    if (isAdmin && filterBranch !== 'all' && o.branch_id !== filterBranch) return false
    if (filterStatus !== 'all' && o.status !== filterStatus) return false
    return true
  })

  return (
    <div style={{ padding: 24, fontFamily: 'Tajawal, sans-serif', direction: 'rtl', minHeight: '100vh', background: S.navy }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: S.white, marginBottom: 4 }}>🍽️ قسم البوفية</h1>
          <p style={{ fontSize: 13, color: S.muted }}>تنظيم طلبات البوفية ومسؤولية التنفيذ بين المطبخ والصالة</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* ✅ جديد: مبدّل تبويبات — الطلبات (الافتراضي) أو تجهيز البوفية */}
          <div style={{ display: 'flex', background: S.card, borderRadius: 10, padding: 4, gap: 4 }}>
            <button onClick={() => setTab('orders')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, background: tab === 'orders' ? S.gold3 : 'transparent', color: tab === 'orders' ? S.gold : S.muted }}>📋 الطلبات</button>
            <button onClick={() => setTab('prep')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, background: tab === 'prep' ? S.gold3 : 'transparent', color: tab === 'prep' ? S.gold : S.muted }}>🧺 تجهيز البوفية</button>
          </div>
          <button onClick={() => setShowNew(true)} style={{ padding: '10px 22px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>+ طلب بوفية جديد</button>
        </div>
      </div>

      {/* ── الفلاتر ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {isAdmin && (
          <select style={{ ...inp, width: 180 }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
            <option value="all">كل الفروع</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select style={{ ...inp, width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {tab === 'prep' && (
        <div style={{ background: S.gold3, border: `1px solid ${S.goldB}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: S.gold, fontWeight: 700 }}>
          🧺 اضغط على أي طلب بوفية أدناه لعرض وإدارة قائمة تجهيزه (١٠٠ بند)
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : visibleOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted, background: S.card, borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
          <div>لا توجد طلبات بوفية حاليًا</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {visibleOrders.map(o => {
            const st = STATUS[o.status] || STATUS.pending_confirmation
            const conf = confirmationsMap[o.id]
            const responsible = conf?.responsible_employee_id ? employeesById[conf.responsible_employee_id] : null
            const remaining = Math.max(0, o.total_amount - o.paid_amount)
            return (
              <div key={o.id} onClick={() => tab === 'prep' ? setPrepOrder(o) : setDetailOrder(o)}
                style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 16, padding: 18, cursor: 'pointer', transition: 'border-color .15s', position: 'relative' }}>
                {isAdmin && (
                  <button onClick={e => { e.stopPropagation(); deleteOrderQuick(o) }} title="حذف نهائي (أدمن فقط)"
                    style={{ position: 'absolute', top: 10, left: 10, width: 26, height: 26, borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{o.buffet_date}</div>
                  <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
                  🕐 {o.buffet_time} · 👥 {o.guests_count} شخص {isAdmin && o.branches?.name ? `· 🏪 ${o.branches.name}` : ''}
                </div>
                {tab === 'prep' ? (
                  (() => {
                    const ps = prepSummary[o.id]
                    return ps ? (
                      <div style={{ fontSize: 12, color: ps.done === ps.total ? S.green : S.amber, background: ps.done === ps.total ? S.greenB : S.amberB, borderRadius: 8, padding: '6px 10px', fontWeight: 700 }}>
                        🧺 تم تجهيز {ps.done} من {ps.total} بند
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: S.muted, background: S.card, borderRadius: 8, padding: '6px 10px' }}>🧺 اضغط لعرض/بدء قائمة التجهيز</div>
                    )
                  })()
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
                      <span style={{ color: S.muted }}>الإجمالي: <strong style={{ color: S.white }}>MYR {o.total_amount.toFixed(2)}</strong></span>
                      <span style={{ color: remaining > 0 ? S.red : S.green }}>المتبقي: MYR {remaining.toFixed(2)}</span>
                    </div>
                    {responsible ? (
                      <div style={{ fontSize: 12, color: S.green, background: S.greenB, borderRadius: 8, padding: '6px 10px' }}>
                        👤 {responsible.name} {o.shift ? `· ${SHIFT_LABEL[o.shift]}` : ''}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: S.amber, background: S.amberB, borderRadius: 8, padding: '6px 10px' }}>⏳ بانتظار تعيين الموظف المسؤول</div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <NewBuffetModal currentUser={currentUser} isAdmin={isAdmin} branches={branches} menuItems={menuItems}
          onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} />
      )}
      {detailOrder && (
        <BuffetDetailModal order={detailOrder} currentUser={currentUser} isAdmin={isAdmin}
          isKitchenManager={isKitchenManager} isHallManager={isHallManager}
          branchEmployees={branchEmployeesForOrder(detailOrder.branch_id)}
          onClose={() => setDetailOrder(null)} onChanged={fetchAll} />
      )}
      {prepOrder && (
        <BuffetPrepModal order={prepOrder} onClose={() => setPrepOrder(null)} onChanged={fetchAll} />
      )}
    </div>
  )
}
