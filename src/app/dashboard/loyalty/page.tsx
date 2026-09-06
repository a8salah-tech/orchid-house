'use client'


import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type Customer = {
  id: string; name: string; email?: string; phone?: string
  total_visits: number; total_spent: number; loyalty_points: number
  created_at: string
}

// ══════════════════════════════════════════════════════════════════════════════
//  نموذج النقاط (2026-09-06)
//  كل 100 رينغيت (MYR) يصرفها العميل = نقطة ولاء واحدة، تُحتسب مباشرةً من إجمالي
//  صرفه المسجَّل فعلاً في جدول customers (total_spent) — بدون أي خطوة يدوية ولا حفظ منفصل.
//  (كل مئة كاملة تُحتسب نقطة — الكسر الأقل من 100 لا يُحتسب.)
//  عمود loyalty_points بقى مخصَّصاً للنقاط الإضافية اليدوية فقط:
//  نقاط الترحيب، هدايا أعياد الميلاد، تعويضات، عروض... إلخ.
//  رصيد العميل الظاهر = (المكتسبة من الصرف) + (الإضافية اليدوية)، والمستوى يُحسب منه.
// ══════════════════════════════════════════════════════════════════════════════
const MYR_PER_POINT   = 100
const earnedPoints    = (c: Customer) => Math.floor((c.total_spent || 0) / MYR_PER_POINT)
const bonusPoints     = (c: Customer) => c.loyalty_points || 0
const effectivePoints = (c: Customer) => earnedPoints(c) + bonusPoints(c)
// نقاط فاتورة واحدة (للعرض في سجل الزيارات)
const orderPoints = (amount: number) => Math.floor((amount || 0) / MYR_PER_POINT)

// تنسيق الأرقام: فواصل آلاف إنجليزية موحّدة في كل الصفحة
const nf = (n: number) => (n || 0).toLocaleString('en-GB')
const money0 = (n: number) => 'MYR ' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const money2 = (n: number) => 'MYR ' + (n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dt = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Loyalty tiers — الحدود بالنقاط (نقطة = 100 MYR صرف)
const TIERS = [
  { name: 'Bronze',   min: 0,   max: 24,       color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',  icon: '🥉', perks: ['خصم 5% في عيد الميلاد', 'هدية ترحيب'] },
  { name: 'Silver',   min: 25,  max: 74,       color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)', icon: '🥈', perks: ['خصم 10%', 'أولوية الحجز', 'حلوى مجانية في عيد الميلاد'] },
  { name: 'Gold',     min: 75,  max: 149,      color: S.gold,    bg: S.gold3,                  icon: '🥇', perks: ['خصم 15%', 'مقبّلات مجانية', 'طاولة VIP', 'هدية شهرية'] },
  { name: 'Platinum', min: 150, max: Infinity, color: S.blue,    bg: S.blueB,                  icon: '💎', perks: ['خصم 20%', 'خدمة خاصة', 'طاولة الشيف', 'دعوات حصرية'] },
]

function getTier(points: number) {
  return TIERS.find(t => points >= t.min && points <= t.max) || TIERS[0]
}

function getNextTier(points: number) {
  const idx = TIERS.findIndex(t => points >= t.min && points <= t.max)
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null
}

// ══ سجل زيارات/فواتير العميل — كل فاتورة في بطاقة قابلة للطي، الأحدث فوق ══
function CustomerVisitsModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    sb.from('orders')
      .select('id,total_amount,discount_amount,discount_type,service_charge,sst_amount,payment_method,status,shift,created_at,paid_at,tables(number,name,section),order_items(id,quantity,unit_price,size_name,notes,status,menu_items(name,name_en))')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = data || []
        setOrders(rows)
        setOpenId(rows[0]?.id || null)   // أول (أحدث) فاتورة مفتوحة تلقائياً
        setLoading(false)
      })
  }, [customer.id])

  // إحصاءات مشتقّة من الفواتير المدفوعة
  const paid = orders.filter(o => o.status === 'paid')
  const paidTotal = paid.reduce((s, o) => s + (o.total_amount || 0), 0)

  const earned = earnedPoints(customer)
  const bonus = bonusPoints(customer)
  const tier = getTier(earned + bonus)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 620, padding: 26, margin: 'auto' }}>

        {/* الترويسة */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>👤 {customer.name}</h2>
            <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{customer.phone || customer.email || '—'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* بطاقات ملخّص */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { l: 'المستوى', v: `${tier.icon} ${tier.name}`, c: tier.color },
            { l: 'الرصيد', v: `${nf(earned + bonus)}`, c: S.gold },
            { l: 'إجمالي الصرف', v: money0(customer.total_spent), c: S.green },
            { l: 'عدد الزيارات', v: nf(customer.total_visits), c: S.blue },
          ].map((x, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 12, padding: '12px 8px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: x.c }}>{x.v}</div>
              <div style={{ fontSize: 10, color: S.muted, marginTop: 3 }}>{x.l}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, lineHeight: 1.6 }}>
          الرصيد = {nf(earned)} نقطة من الصرف (كل {MYR_PER_POINT} MYR = نقطة) + {nf(bonus)} نقطة إضافية يدوية.
        </div>

        {/* سجل الفواتير */}
        <div style={{ fontSize: 13, color: S.white, fontWeight: 800, marginBottom: 10 }}>
          🧾 سجل الزيارات والفواتير {orders.length > 0 && <span style={{ color: S.muted, fontWeight: 400 }}>({nf(orders.length)})</span>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جارٍ التحميل...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: S.muted, background: S.card, borderRadius: 12 }}>
            لا توجد فواتير مرتبطة بهذا العميل بعد
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map((o, idx) => {
              const open = openId === o.id
              const items = (o.order_items || []).filter((it: any) => it.status !== 'cancelled')
              const isPaid = o.status === 'paid'
              const badgeC = isPaid ? S.green : o.status === 'cancelled' ? S.red : S.amber
              const badgeB = isPaid ? S.greenB : o.status === 'cancelled' ? S.redB : S.amberB
              const tableLabel = o.tables?.name || (o.tables?.number ? `طاولة ${o.tables.number}` : '—')
              return (
                <div key={o.id} style={{ background: S.navy3, borderRadius: 12, border: `1px solid ${open ? S.gold + '55' : S.border}`, overflow: 'hidden' }}>

                  {/* رأس البطاقة — اضغط للفتح/الطي */}
                  <button onClick={() => setOpenId(open ? null : o.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'right', fontFamily: 'Tajawal, sans-serif' }}>
                    <span style={{ fontSize: 12, color: S.muted, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: S.white }}>
                        زيارة #{orders.length - idx} · {dt(o.created_at)}
                      </div>
                      <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                        {tableLabel}{o.tables?.section ? ` · ${o.tables.section}` : ''} · {o.payment_method || '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>{money2(o.total_amount)}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 }}>
                        <span style={{ background: badgeB, color: badgeC, borderRadius: 20, padding: '1px 7px', fontSize: 9, fontWeight: 700 }}>{o.status}</span>
                        {isPaid && <span style={{ fontSize: 9, color: S.green }}>+{nf(orderPoints(o.total_amount))} نقطة</span>}
                      </div>
                    </div>
                  </button>

                  {/* تفاصيل الفاتورة */}
                  {open && (
                    <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${S.border}` }}>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 12, color: S.muted, padding: '10px 0' }}>لا توجد أصناف في هذه الفاتورة</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                          <tbody>
                            {items.map((it: any) => (
                              <tr key={it.id}>
                                <td style={{ padding: '5px 0', fontSize: 12, color: S.white }}>
                                  <span style={{ color: S.gold, fontWeight: 700 }}>{it.quantity}×</span>{' '}
                                  {it.menu_items?.name || it.menu_items?.name_en || 'صنف'}
                                  {it.size_name ? <span style={{ color: S.muted }}> · {it.size_name}</span> : ''}
                                </td>
                                <td style={{ padding: '5px 0', fontSize: 12, color: S.muted, textAlign: 'left', whiteSpace: 'nowrap' }}>
                                  {money2((it.unit_price || 0) * (it.quantity || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* تفكيك المبلغ */}
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${S.border}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {o.discount_amount > 0 && (
                          <Row l={`الخصم${o.discount_type ? ` (${o.discount_type})` : ''}`} v={`- ${money2(o.discount_amount)}`} c={S.red} />
                        )}
                        {o.service_charge > 0 && <Row l="رسوم الخدمة" v={money2(o.service_charge)} />}
                        {o.sst_amount > 0 && <Row l="ضريبة SST" v={money2(o.sst_amount)} />}
                        <Row l="الإجمالي" v={money2(o.total_amount)} c={S.gold} bold />
                        {isPaid && <Row l="نقاط مكتسبة من هذه الفاتورة" v={`+ ${nf(orderPoints(o.total_amount))}`} c={S.green} />}
                        {o.paid_at && <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>دُفعت: {dt(o.paid_at)}</div>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {paid.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.muted, padding: '8px 4px 0' }}>
                <span>إجمالي {nf(paid.length)} فاتورة مدفوعة</span>
                <span style={{ color: S.gold, fontWeight: 700 }}>{money2(paidTotal)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ l, v, c, bold }: { l: string; v: string; c?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: S.muted }}>{l}</span>
      <span style={{ color: c || S.white, fontWeight: bold ? 800 : 600 }}>{v}</span>
    </div>
  )
}

// Points adjustment modal — يعدّل النقاط الإضافية اليدوية فقط (loyalty_points)
function AdjustPointsModal({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [action, setAction] = useState<'add' | 'deduct' | 'set'>('add')
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const earned = earnedPoints(customer)
  const currentBonus = bonusPoints(customer)

  async function save() {
    const pts = parseInt(points) || 0
    if (!pts) { alert('أدخل عدد النقاط'); return }
    setSaving(true)
    let newBonus = currentBonus
    if (action === 'add') newBonus += pts
    else if (action === 'deduct') newBonus = Math.max(0, newBonus - pts)
    else newBonus = pts
    await sb.from('customers').update({ loyalty_points: newBonus }).eq('id', customer.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  const nextBonus = action === 'add' ? currentBonus + (parseInt(points) || 0)
    : action === 'deduct' ? Math.max(0, currentBonus - (parseInt(points) || 0))
    : parseInt(points) || 0
  const tier = getTier(earned + currentBonus)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>🎁 نقاط إضافية — {customer.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.muted, marginBottom: 6 }}>
            <span>مكتسبة من الصرف (تلقائية)</span><span style={{ color: S.white }}>{nf(earned)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.muted, marginBottom: 8 }}>
            <span>نقاط إضافية يدوية</span><span style={{ color: S.gold }}>{nf(currentBonus)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, borderTop: `1px solid ${S.border}`, paddingTop: 8 }}>
            <span style={{ color: S.muted }}>الرصيد الإجمالي</span>
            <span style={{ color: tier.color }}>{nf(earned + currentBonus)} · {tier.icon} {tier.name}</span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, lineHeight: 1.6 }}>
          المكتسبة من الصرف بتتحدّث تلقائياً من فواتير العميل ولا يمكن تعديلها هنا. الأزرار التالية تعدّل النقاط الإضافية اليدوية فقط.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {[{ k: 'add', l: '➕ إضافة', c: S.green }, { k: 'deduct', l: '➖ خصم', c: S.red }, { k: 'set', l: '⚙️ تعيين', c: S.blue }].map(a => (
            <button key={a.k} onClick={() => setAction(a.k as any)} style={{ padding: '10px', borderRadius: 10, border: `1px solid ${action === a.k ? a.c : S.border}`, background: action === a.k ? a.c + '20' : 'transparent', color: action === a.k ? a.c : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: action === a.k ? 700 : 400 }}>
              {a.l}
            </button>
          ))}
        </div>

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[5, 10, 25, 50].map(p => (
            <button key={p} onClick={() => setPoints(p.toString())} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.border}`, background: points === p.toString() ? S.gold3 : 'transparent', color: points === p.toString() ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
              {p}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>عدد النقاط</label>
          <input type="number" style={inp} value={points} onChange={e => setPoints(e.target.value)} placeholder="أدخل العدد..." />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>السبب (اختياري)</label>
          <input style={inp} value={reason} onChange={e => setReason(e.target.value)} placeholder="هدية عيد ميلاد، تعويض، عرض..." />
        </div>

        {points && (
          <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: S.muted }}>
            الرصيد الجديد: <span style={{ color: S.white, fontWeight: 700 }}>
              {nf(earned + nextBonus)} نقطة
            </span>
            <span style={{ fontSize: 11 }}> ({nf(earned)} صرف + {nf(nextBonus)} إضافية)</span>
          </div>
        )}

        <button onClick={save} disabled={saving} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${S.gold},${S.gold2})`, color: S.navy, cursor: 'pointer', fontWeight: 800, fontSize: 15, fontFamily: 'Tajawal, sans-serif' }}>
          {saving ? '⏳...' : '✅ تأكيد'}
        </button>
      </div>
    </div>
  )
}

const SORTS: { k: string; l: string }[] = [
  { k: 'points', l: '🎁 النقاط (الأعلى أولاً)' },
  { k: 'spent',  l: '💰 إجمالي الصرف' },
  { k: 'visits', l: '🍽️ عدد الزيارات' },
  { k: 'newest', l: '🆕 الأحدث تسجيلاً' },
  { k: 'name',   l: '🔤 الاسم (أ–ي)' },
]

// ══ Main ══
export default function LoyaltyPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'points' | 'spent' | 'visits' | 'newest' | 'name'>('points')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 100
  const [adjustCustomer, setAdjustCustomer] = useState<Customer | null>(null)
  const [visitsCustomer, setVisitsCustomer] = useState<Customer | null>(null)

  // ✅ Fix: من غير .range() بيرجّع Supabase أول 1000 صف بس افتراضياً — فوق كده كانت الأعداد
  // والمستويات بتتجمّد عند 1000 عميل. دلوقتي بنجيب الكل على دفعات 1000.
  const fetchCustomers = useCallback(async () => {
    const PAGE = 1000
    const all: Customer[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('customers')
        .select('id,name,email,phone,total_visits,total_spent,loyalty_points,created_at')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error || !data) break
      all.push(...(data as Customer[]))
      if (data.length < PAGE) break
    }
    setCustomers(all)
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const tier = getTier(effectivePoints(c))
    const matchTier = tierFilter === 'all' || tier.name.toLowerCase() === tierFilter
    return matchSearch && matchTier
  })

  // ✅ الترتيب: افتراضياً بالنقاط (الرصيد الإجمالي) من الأعلى للأقل — مع إمكانية التغيير من القائمة
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'points') return effectivePoints(b) - effectivePoints(a)
    if (sortBy === 'spent') return (b.total_spent || 0) - (a.total_spent || 0)
    if (sortBy === 'visits') return (b.total_visits || 0) - (a.total_visits || 0)
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar')
    return 0
  })

  // ✅ إعادة الصفحة لأول واحدة لما البحث/الفلتر/الترتيب يتغيّر
  useEffect(() => { setPage(1) }, [search, tierFilter, sortBy])
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = {
    total: customers.length,
    totalPoints: customers.reduce((s, c) => s + effectivePoints(c), 0),
    platinum: customers.filter(c => effectivePoints(c) >= 150).length,
    gold: customers.filter(c => effectivePoints(c) >= 75 && effectivePoints(c) < 150).length,
    silver: customers.filter(c => effectivePoints(c) >= 25 && effectivePoints(c) < 75).length,
    bronze: customers.filter(c => effectivePoints(c) < 25).length,
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🎁 برنامج الولاء</h1>
        <p style={{ fontSize: 13, color: S.muted }}>
          كل {MYR_PER_POINT} MYR يصرفها العميل = نقطة · الرصيد = المكتسب من الصرف + نقاط إضافية يدوية · اضغط على أي عميل لعرض فواتيره
        </p>
      </div>

      {/* Tier Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
        {TIERS.map((tier, i) => {
          const count = [stats.bronze, stats.silver, stats.gold, stats.platinum][i]
          return (
            <div key={tier.name} style={{ background: tier.bg, border: `1px solid ${tier.color}40`, borderRadius: 18, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 22 }}>{tier.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: tier.color, marginTop: 4 }}>{tier.name}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{nf(tier.min)}+ نقطة ({money0(tier.min * MYR_PER_POINT)})</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: tier.color }}>{nf(count)}</div>
              </div>
              <div style={{ borderTop: `1px solid ${tier.color}30`, paddingTop: 10 }}>
                {tier.perks.slice(0, 2).map((p, j) => (
                  <div key={j} style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>✓ {p}</div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Stats bar */}
      <div style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 11, color: S.muted }}>إجمالي الأعضاء</div><div style={{ fontSize: 20, fontWeight: 800 }}>{nf(stats.total)}</div></div>
        <div><div style={{ fontSize: 11, color: S.muted }}>إجمالي النقاط</div><div style={{ fontSize: 20, fontWeight: 800, color: S.gold }}>{nf(stats.totalPoints)}</div></div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="🔍 ابحث عن عميل..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...inp, width: 'auto', cursor: 'pointer' }} value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
          <option value="all">كل المستويات</option>
          <option value="bronze">🥉 Bronze</option>
          <option value="silver">🥈 Silver</option>
          <option value="gold">🥇 Gold</option>
          <option value="platinum">💎 Platinum</option>
        </select>
        <select style={{ ...inp, width: 'auto', cursor: 'pointer' }} value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          {SORTS.map(s => <option key={s.k} value={s.k}>ترتيب: {s.l}</option>)}
        </select>
      </div>

      {/* Customers list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جارٍ التحميل...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا يوجد عملاء</div>
      ) : (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paginated.map(c => {
            const pts = effectivePoints(c)
            const tier = getTier(pts)
            const next = getNextTier(pts)
            const progress = next ? ((pts - tier.min) / (next.min - tier.min)) * 100 : 100
            return (
              <div key={c.id} onClick={() => setVisitsCustomer(c)}
                title="اضغط لعرض فواتير العميل"
                style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', cursor: 'pointer' }}>

                {/* Avatar */}
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: tier.bg, border: `2px solid ${tier.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {tier.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: S.white, marginBottom: 2 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{c.phone || c.email || '—'}</div>
                  <div style={{ fontSize: 11, color: tier.color, fontWeight: 600, marginTop: 2 }}>{tier.icon} {tier.name}</div>
                </div>

                {/* Points + Progress */}
                <div style={{ flex: 2, minWidth: 180 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: S.white, fontWeight: 700 }}>{nf(pts)} نقطة</span>
                    {next && <span style={{ fontSize: 11, color: S.muted }}>باقي {nf(next.min - pts)} لـ {next.name}</span>}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, progress)}%`, height: '100%', background: `linear-gradient(90deg,${tier.color},${next?.color || tier.color})`, borderRadius: 20, transition: 'width .5s' }} />
                  </div>
                  {bonusPoints(c) > 0 && (
                    <div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>
                      {nf(earnedPoints(c))} من الصرف + {nf(bonusPoints(c))} إضافية
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.blue }}>{nf(c.total_visits)}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>زيارات</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>{money0(c.total_spent)}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>إجمالي الصرف</div>
                  </div>
                </div>

                {/* Actions */}
                <button onClick={e => { e.stopPropagation(); setAdjustCustomer(c) }}
                  style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, flexShrink: 0 }}>
                  🎁 نقاط
                </button>
              </div>
            )
          })}
        </div>

        {/* ✅ تنقّل بين الصفحات — 100 عميل في كل صفحة */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '18px 16px' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: page === 1 ? S.muted : S.white, cursor: page === 1 ? 'default' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', opacity: page === 1 ? 0.5 : 1 }}>
              ← السابق
            </button>
            <span style={{ fontSize: 12, color: S.muted }}>
              صفحة {nf(page)} من {nf(totalPages)} · {nf(sorted.length)} عميل
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: page === totalPages ? S.muted : S.white, cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', opacity: page === totalPages ? 0.5 : 1 }}>
              التالي →
            </button>
          </div>
        )}
        </>
      )}

      {visitsCustomer && (
        <CustomerVisitsModal customer={visitsCustomer} onClose={() => setVisitsCustomer(null)} />
      )}
      {adjustCustomer && (
        <AdjustPointsModal customer={adjustCustomer} onClose={() => setAdjustCustomer(null)} onSaved={fetchCustomers} />
      )}
    </div>
  )
}
