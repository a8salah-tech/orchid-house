'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthProvider'

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
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  purple: '#A855F7', purpleB: 'rgba(168,85,247,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

// ✅ أيقونة مناسبة لكل نوع حساب حسب اسمه
function iconFor(name: string) {
  if (name.includes('Foodpanda')) return { icon: '🛵', color: '#D91C6E' }
  if (name.includes('Grab')) return { icon: '🚗', color: '#00B14F' }
  if (name.includes('Other')) return { icon: '📦', color: S.amber }
  return { icon: '👤', color: S.blue } // Customer 1-5
}

type TakeawayTable = {
  id: string; name: string; status: string; current_order_id: string | null
  current_total: number; occupied_since: string | null; items_count: number
}

export default function TakeAwayPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const router = useRouter()
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 800)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ✅ فرع العمل - من بيانات الموظف، أو منتقي يدوي لو أدمن بدون فرع محدد
  const [branchId, setBranchId] = useState(employee?.branch_id || '')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (isAdmin) sb.from('branches').select('id,name').eq('is_active', true).order('name').then(({ data }) => setBranches(data || []))
  }, [isAdmin, sb])
  useEffect(() => { if (employee?.branch_id) setBranchId(employee.branch_id) }, [employee?.branch_id])

  // ✅ Fix جذري: الصفحة دلوقتي مش بتفتح منيو وسلة خالص - الطلب بيتسجل من الكاشير العادي على "طاولة" التيك
  // أواي المناسبة زي أي طاولة تانية. الصفحة دي بقت شاشة متابعة حية بس توري حالة كل حساب لحظيًا
  const [tables, setTables] = useState<TakeawayTable[]>([])
  // ✅ جديد: نافذة تفاصيل حساب معيّن - تفتح لما تضغط على أي بطاقة
  const [selectedAccount, setSelectedAccount] = useState<TakeawayTable | null>(null)
  const [accountOrderItems, setAccountOrderItems] = useState<{ name: string; qty: number; price: number }[]>([])
  const [accountPaymentReceived, setAccountPaymentReceived] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  // ✅ جديد: فتح تفاصيل حساب - يجيب أصنافه الحالية وحالة استلام المبلغ (لفودباندا/جراب اللي بيدفعوا آجل)
  async function openAccountDetails(t: TakeawayTable) {
    setSelectedAccount(t)
    setAccountOrderItems([])
    if (t.current_order_id) {
      const { data: order } = await sb.from('orders').select('payment_received').eq('id', t.current_order_id).maybeSingle()
      setAccountPaymentReceived(order?.payment_received || false)
      const { data: items } = await sb.from('order_items').select('quantity, unit_price, status, menu_items(name,name_en)')
        .eq('order_id', t.current_order_id).neq('status', 'cancelled')
      setAccountOrderItems((items || []).map((i: any) => ({ name: i.menu_items?.name_en || i.menu_items?.name || '—', qty: i.quantity, price: i.unit_price })))
    }
  }

  // ✅ جديد: تعليم إن المبلغ استُلم فعليًا من المنصة (فودباندا/جراب بيدفعوا آجل، مش وقت الطلب)
  async function togglePaymentReceived() {
    if (!selectedAccount?.current_order_id) return
    setSavingPayment(true)
    const newValue = !accountPaymentReceived
    await sb.from('orders').update({ payment_received: newValue }).eq('id', selectedAccount.current_order_id)
    setAccountPaymentReceived(newValue)
    setSavingPayment(false)
  }
  const [loading, setLoading] = useState(true)

  const fetchTakeawayTables = useCallback(async () => {
    if (!branchId) { setLoading(false); return }
    setLoading(true)
    const { data } = await sb.from('tables').select('id,name,status,current_order_id,occupied_since')
      .eq('branch_id', branchId).eq('section', 'takeaway').order('number')
    const withTotals: TakeawayTable[] = []
    for (const t of (data as any[]) || []) {
      let total = 0
      let itemsCount = 0
      if (t.current_order_id) {
        const { data: items } = await sb.from('order_items').select('unit_price,quantity,status').eq('order_id', t.current_order_id)
        const activeItems = (items || []).filter((i: any) => i.status !== 'cancelled')
        total = activeItems.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
        itemsCount = activeItems.length
      }
      withTotals.push({ id: t.id, name: t.name, status: t.status, current_order_id: t.current_order_id, current_total: total, occupied_since: t.occupied_since, items_count: itemsCount })
    }
    setTables(withTotals)
    setLoading(false)
  }, [sb, branchId])

  useEffect(() => { fetchTakeawayTables() }, [fetchTakeawayTables])
  useEffect(() => {
    const ch = sb.channel('takeaway-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchTakeawayTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchTakeawayTables)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchTakeawayTables])

  // ✅ جديد: البحث بيوم واحد أو بشهر كامل - إجمالي كل حساب تيك أواي في الفترة المختارة
  const [searchMode, setSearchMode] = useState<'day' | 'month'>('day')
  const [searchDate, setSearchDate] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [searchMonth, setSearchMonth] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7))
  const [searchResult, setSearchResult] = useState<{ perChannel: { name: string; count: number; total: number }[]; grandTotal: number; grandCount: number } | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const runSearch = useCallback(async () => {
    if (!branchId) return
    setSearchLoading(true)
    let dayStart: string, dayEnd: string
    if (searchMode === 'day') {
      dayStart = `${searchDate}T00:00:00+08:00`
      dayEnd = `${searchDate}T23:59:59.999+08:00`
    } else {
      const [y, m] = searchMonth.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      dayStart = `${searchMonth}-01T00:00:00+08:00`
      dayEnd = `${searchMonth}-${String(lastDay).padStart(2, '0')}T23:59:59.999+08:00`
    }
    const { data } = await sb.from('orders').select('total_amount, status, tables!inner(name, section, branch_id)')
      .eq('tables.section', 'takeaway').eq('tables.branch_id', branchId)
      .eq('status', 'paid').gte('paid_at', dayStart).lte('paid_at', dayEnd)
    const byChannel: Record<string, { name: string; count: number; total: number }> = {}
    for (const o of (data as any[]) || []) {
      const tname = o.tables?.name || '—'
      if (!byChannel[tname]) byChannel[tname] = { name: tname, count: 0, total: 0 }
      byChannel[tname].count++
      byChannel[tname].total += o.total_amount || 0
    }
    const perChannel = Object.values(byChannel).sort((a, b) => b.total - a.total)
    setSearchResult({
      perChannel,
      grandTotal: perChannel.reduce((s, c) => s + c.total, 0),
      grandCount: perChannel.reduce((s, c) => s + c.count, 0),
    })
    setSearchLoading(false)
  }, [sb, branchId, searchMode, searchDate, searchMonth])

  useEffect(() => { runSearch() }, [runSearch])

  const inp: React.CSSProperties = { background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif' }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, minHeight: '100vh', padding: isMobile ? 14 : 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} select option{background:#0F2040;color:#FAFAF8}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>🥡 Take Away</h1>
        <button onClick={() => router.push('/dashboard/cashier')}
          style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          🏧 فتح الكاشير لتسجيل طلب
        </button>
      </div>

      {isAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>🏪 اختر الفرع</label>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} style={{ ...inp, width: '100%', maxWidth: 300, boxSizing: 'border-box' }}>
            <option value="">-- اختر الفرع --</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {!branchId ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>من فضلك اختر الفرع أولًا</div>
      ) : (
        <>
          {/* ✅ جديد: شاشة متابعة حية لحالة كل حساب تيك أواي - بدل شاشة الطلب القديمة */}
          <div style={{ fontSize: 14, fontWeight: 700, color: S.muted, marginBottom: 12 }}>📡 الحالة اللحظية</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill, minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
              {tables.map(t => {
                const { icon, color } = iconFor(t.name)
                const isOccupied = t.status === 'occupied'
                return (
                  // ✅ Fix: الضغط بقى يفتح تفاصيل الحساب نفسه بدل ما يوديك للكاشير مباشرة
                  <div key={t.id} onClick={() => openAccountDetails(t)}
                    style={{ background: isOccupied ? color + '15' : S.card, border: `1.5px solid ${isOccupied ? color + '70' : S.border}`, borderRadius: 16, padding: '16px 14px', cursor: 'pointer', textAlign: 'center', position: 'relative' }}>
                    {isOccupied && <div style={{ position: 'absolute', top: 10, left: 10, width: 8, height: 8, borderRadius: '50%', background: S.green, animation: 'pulse 1.5s ease infinite' }} />}
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S.white, marginBottom: 4 }}>{t.name}</div>
                    {/* ✅ جديد: عدد الأصناف جنب الحالة - "Customer 1 · 3 طلب" */}
                    <div style={{ fontSize: 11, color: isOccupied ? color : S.muted, fontWeight: 700, marginBottom: 6 }}>
                      {isOccupied ? `🟢 مشغول · ${t.items_count} طلب` : '⚪ متاح'}
                    </div>
                    {isOccupied && <div style={{ fontSize: 14, fontWeight: 900, color: color }}>MYR {t.current_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {/* ✅ جديد: بحث بيوم واحد أو بشهر كامل */}
          <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: isMobile ? 16 : '20px 22px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>📊 بحث بالتاريخ</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setSearchMode('day')}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${searchMode === 'day' ? S.gold : S.border}`, background: searchMode === 'day' ? S.gold3 : 'transparent', color: searchMode === 'day' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                📅 يوم محدد
              </button>
              <button onClick={() => setSearchMode('month')}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${searchMode === 'month' ? S.gold : S.border}`, background: searchMode === 'month' ? S.gold3 : 'transparent', color: searchMode === 'month' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                🗓️ شهر كامل
              </button>
            </div>

            {searchMode === 'day' ? (
              <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} style={{ ...inp, marginBottom: 18 }} />
            ) : (
              <input type="month" value={searchMonth} onChange={e => setSearchMonth(e.target.value)} style={{ ...inp, marginBottom: 18 }} />
            )}

            {searchLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: S.muted, fontSize: 13 }}>⏳ جاري البحث...</div>
            ) : searchResult && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: S.card, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: S.white, fontWeight: 700 }}>{searchResult.grandCount} طلب إجمالي</span>
                  <span style={{ fontSize: 16, color: S.gold, fontWeight: 900 }}>MYR {searchResult.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {searchResult.perChannel.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: S.muted, fontSize: 13 }}>لا توجد طلبات في هذه الفترة</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {searchResult.perChannel.map((c, i) => {
                      const { icon, color } = iconFor(c.name)
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
                          <span style={{ fontSize: 13, color: S.white, fontWeight: 700 }}>{icon} {c.name} <span style={{ color: S.muted, fontWeight: 400 }}>· {c.count} طلب</span></span>
                          <span style={{ fontSize: 13, color: color, fontWeight: 800 }}>MYR {c.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ✅ جديد: نافذة تفاصيل الحساب - تفتح عند الضغط على أي بطاقة */}
      {selectedAccount && (() => {
        const { icon, color } = iconFor(selectedAccount.name)
        // ✅ فودباندا وجراب بيدفعوا آجل (تسوية لاحقة من المنصة) - فقط هما محتاجين تتبع "استُلم المبلغ ولا لسه"
        const isDeferredPayment = selectedAccount.name.includes('Foodpanda') || selectedAccount.name.includes('Grab')
        return (
          <div onClick={() => setSelectedAccount(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${color}60`, padding: 20, maxWidth: 420, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color, fontSize: 16, fontWeight: 800 }}>{icon} {selectedAccount.name}</h3>
                <button onClick={() => setSelectedAccount(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>

              {!selectedAccount.current_order_id ? (
                <div style={{ textAlign: 'center', padding: 30, color: S.muted, fontSize: 13 }}>⚪ لا يوجد طلب مفتوح حاليًا على هذا الحساب</div>
              ) : (
                <>
                  {accountOrderItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: S.muted, fontSize: 13 }}>⏳ جاري التحميل...</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {accountOrderItems.map((it, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: S.card, borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                          <span style={{ color: S.white }}>{it.name} ×{it.qty}</span>
                          <span style={{ color: S.gold, fontWeight: 700 }}>MYR {(it.price * it.qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${S.border}`, paddingTop: 12, marginBottom: isDeferredPayment ? 16 : 0 }}>
                    <span style={{ fontSize: 14, color: S.white, fontWeight: 700 }}>الإجمالي</span>
                    <span style={{ fontSize: 17, color, fontWeight: 900 }}>MYR {selectedAccount.current_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {/* ✅ جديد: تتبع استلام المبلغ فعليًا - خاص بفودباندا وجراب بس، لأنهم بيدفعوا آجل مش وقت الطلب */}
                  {isDeferredPayment && (
                    <div style={{ background: accountPaymentReceived ? S.greenB : S.amberB, border: `1px solid ${accountPaymentReceived ? S.green : S.amber}60`, borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: accountPaymentReceived ? S.green : S.amber }}>
                            {accountPaymentReceived ? '✅ تم استلام المبلغ' : '⏳ لم يُستلم المبلغ بعد'}
                          </div>
                          <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>هذه المنصة تدفع آجلاً (تسوية لاحقة)</div>
                        </div>
                        <button onClick={togglePaymentReceived} disabled={savingPayment}
                          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${accountPaymentReceived ? S.amber : S.green}`, background: 'transparent', color: accountPaymentReceived ? S.amber : S.green, cursor: savingPayment ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {savingPayment ? '⏳...' : accountPaymentReceived ? 'إلغاء الاستلام' : '✅ تعليم كمُستلم'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <button onClick={() => { setSelectedAccount(null); router.push('/dashboard/cashier') }}
                style={{ width: '100%', marginTop: 16, padding: '10px 0', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                🏧 فتح في الكاشير
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
