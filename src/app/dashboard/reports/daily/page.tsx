'use client'



import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  // ✅ جديد: مضافين عشان مودال تفاصيل الفاتورة (رسوم الخدمة/SST) اللي بيستخدمهم
  amber: '#F59E0B', teal: '#14B8A6',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 8, padding: '8px 12px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'ltr',
}

const numInp: React.CSSProperties = {
  ...inp, textAlign: 'right',
}

// ✅ جديد: نمط لعرض القيم المحسوبة تلقائيًا من النظام (مش قابلة للتعديل اليدوي)
const roInp: React.CSSProperties = {
  ...numInp, background: 'rgba(255,255,255,0.02)', color: S.gold, cursor: 'default', fontWeight: 700,
}
// ✅ جديد: عرض رقم محسوب تلقائيًا بنفس شكل حقل الإدخال، بس للقراءة فقط
function ReadOnlyAmount({ value }: { value: string }) {
  const num = parseFloat(value) || 0
  return (
    <div style={roInp}>
      {num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', color: S.gold, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', color: S.white, whiteSpace: 'nowrap',
}

// Fix: HTML type="number" inputs can never display thousand separators (a browser
// limitation). Instead we use a text input with a numeric keypad (inputMode="decimal"),
// show the value formatted with commas while unfocused (blur), and show the raw
// value while focused so typing stays natural.
function formatWithCommas(raw: string): string {
  if (raw === '' || raw === null || raw === undefined) return ''
  const negative = raw.trim().startsWith('-')
  const parts = raw.replace(/-/g, '').split('.')
  const intPart = (parts[0] || '').replace(/\D/g, '')
  if (intPart === '' && (!parts[1] || parts[1] === '')) return raw
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0'
  const result = parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt
  return negative ? `-${result}` : result
}

function stripCommas(val: string): string {
  return val.replace(/,/g, '')
}

// ✅ Single source of truth for "what counts as this day" across the whole page.
// Malaysia has no DST, so +08:00 is always correct. We build the boundary with
// the offset in JS (Date parses "+08:00" fine locally) then convert to a
// "Z"-suffixed UTC string before it's sent as a filter value — sending a raw
// "+08:00" string as a query param can get corrupted (the "+" is read as a
// space during URL encoding), which silently returns zero/wrong rows instead
// of an error.
function getMYDayBounds(reportDate: string) {
  return {
    dayStart: new Date(`${reportDate}T00:00:00+08:00`).toISOString(),
    dayEnd: new Date(`${reportDate}T23:59:59.999+08:00`).toISOString(),
  }
}

// Fixed Malaysia timezone (Asia/Kuala_Lumpur = UTC+8 year-round, no DST)
function fmtTimeMY(ts: string | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

// Date + time together (Malaysia time) — used anywhere the DATE matters, e.g.
// overnight shifts that cross midnight, where showing time alone hides
// whether the date rolled over correctly.
function fmtDateTimeMY(ts: string | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts)
  const datePart = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  return `${datePart} ${fmtTimeMY(ts)}`
}

// ✅ Manual shift time entry (for backfilling past days, e.g. "yesterday").
// datetime-local inputs have no timezone concept — we treat the value the
// user types as Malaysia wall-clock time and convert it ourselves.
function isoToMYInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
function myInputToISO(value: string): string {
  if (!value) return ''
  return new Date(`${value}:00+08:00`).toISOString()
}

function NumInput({ value, onChange, style, placeholder }: {
  value: string
  onChange: (v: string) => void
  style?: React.CSSProperties
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      style={style}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={focused ? value : formatWithCommas(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => {
        const raw = stripCommas(e.target.value)
        // Allow only digits, a single decimal point, and an optional leading minus sign
        if (/^-?\d*\.?\d*$/.test(raw)) onChange(raw)
      }}
    />
  )
}

type ReportSummary = { id: string; report_date: string; total_amount: number }

const label = (text: string) => (
  <label style={{ fontSize: 11, color: '#FAFAF8', display: 'block', marginBottom: 4 }}>{text}</label>
)

function emptyShift() {
  return {
    date: '', cashier_name: '', received_balance: '', paid_expenses: '',
    pending_expenses: '', visa_maybank: '', visa_bsn: '', kabab_online: '',
    // ✅ جديد: مبالغ "Credit" - طلبات Grab/Foodpanda اللي بتتحصّل من المنصة لاحقًا مش كاش وقت الفاتورة
    g_online: '', credit: '', discounts: '', total_balance: '', manager_note: '',
    bills_paid: '', bills_pending: '', bills_discounts: '', bills_online: '',
    start_time: '', end_time: '', // ✅ new: shift claim/handover timestamps (ISO strings)
  }
}

function emptyForm() {
  return {
    report_date: new Date().toISOString().split('T')[0],
    shift1: emptyShift(),
    shift2: emptyShift(),
    shift3: emptyShift(),
    total_sales_report: '', total_paid_expenses: '', total_pending_expenses: '',
    total_visa_maybank: '', total_visa_bsn: '', total_kabab_online: '',
    // ✅ جديد: إجمالي Credit ليوم كامل
    total_g_online: '', total_credit: '', total_discounts: '', total_amount: '',
    notes: '', total_purchased_bills: '', grab: '', foodpanda: '',
    treasurer_name: '',
  }
}

function ShiftSection({
  num, shift, isMobile, branchFilter, form, sb,
  setShift, onDataChanged,
}: {
  num: 1 | 2 | 3
  shift: ReturnType<typeof emptyShift>
  isMobile: boolean
  branchFilter: string
  form: ReturnType<typeof emptyForm>
  sb: ReturnType<typeof createClient>
  setShift: (n: 1 | 2 | 3, field: string, val: string) => void
  // ✅ بعد إضافة مصروف أو طلب توصيل خارجي، بنطلب من الصفحة الأم تسحب كل الأرقام تاني تلقائيًا
  onDataChanged: () => void
}) {
    const shiftKey = `shift${num}`
    const [expDesc, setExpDesc] = useState('')
    const [expAmount, setExpAmount] = useState('')
    const [expStatus, setExpStatus] = useState<'paid' | 'pending'>('paid')
    const [expSaving, setExpSaving] = useState(false)

    const [delPlatform, setDelPlatform] = useState<'kabab_online' | 'g_online' | 'grab' | 'foodpanda'>('kabab_online')
    const [delAmount, setDelAmount] = useState('')
    const [delSaving, setDelSaving] = useState(false)

    async function addExpense() {
      if (!branchFilter) { alert('Please select a branch first'); return }
      if (!expDesc.trim() || !(parseFloat(expAmount) > 0)) { alert('Please enter a valid description and amount'); return }
      if (!shift.cashier_name.trim()) { alert('No cashier is on this shift yet — start the shift from the Cashier screen first'); return }
      setExpSaving(true)
      await sb.from('daily_cash_expenses').insert([{
        branch_id: branchFilter, expense_date: form.report_date, shift: shiftKey,
        cashier_name: shift.cashier_name, description: expDesc.trim(),
        amount: parseFloat(expAmount), status: expStatus,
      }])
      setExpSaving(false)
      setExpDesc(''); setExpAmount('')
      onDataChanged()
    }

    async function addDelivery() {
      if (!branchFilter) { alert('Please select a branch first'); return }
      if (!(parseFloat(delAmount) > 0)) { alert('Please enter a valid amount'); return }
      if (!shift.cashier_name.trim()) { alert('No cashier is on this shift yet — start the shift from the Cashier screen first'); return }
      setDelSaving(true)
      await sb.from('delivery_platform_orders').insert([{
        branch_id: branchFilter, order_date: form.report_date, shift: shiftKey,
        cashier_name: shift.cashier_name, platform: delPlatform, amount: parseFloat(delAmount),
      }])
      setDelSaving(false)
      setDelAmount('')
      onDataChanged()
    }

    return (
      <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ background: num === 1 ? 'rgba(59,130,246,0.15)' : num === 2 ? 'rgba(139,92,246,0.15)' : 'rgba(34,197,94,0.15)', padding: '12px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: num === 1 ? S.blue : num === 2 ? '#8B5CF6' : S.green }}>
            {num === 1 ? '🌅' : num === 2 ? '🌙' : '🌃'} Shift {num}
          </div>
          {/* ✅ جديد: بيانات الكاشير وأوقات الشيفت بتيجي تلقائيًا 100% من نفس نظام "Start/End Shift" بتاع شاشة الكاشير - مفيش أي إدخال يدوي هنا خالص */}
          {!shift.cashier_name && !shift.start_time ? (
            <div style={{ fontSize: 12, color: S.muted, fontWeight: 700 }}>⏳ Shift not started yet</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: S.white }}>🧑‍💼 {shift.cashier_name || '—'}</span>
              <span style={{ fontSize: 11, color: S.muted }}>
                {shift.start_time ? `Started ${fmtDateTimeMY(shift.start_time)}` : ''}
                {shift.start_time && (shift.end_time ? ` · Ended ${fmtDateTimeMY(shift.end_time)}` : ' · 🟢 Still Active')}
              </span>
            </div>
          )}
        </div>
        <div style={{ padding: isMobile ? 14 : 20, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {/* Left column — كل الأرقام هنا للقراءة فقط (محسوبة تلقائيًا)، ما عدا "Received Balance" و"Manager Note" */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Received Balance (RM)')}<NumInput style={numInp} value={shift.received_balance} onChange={v => setShift(num, 'received_balance', v)} placeholder="0.00" /></div>
              <div>{label('Paid Expenses (RM) — auto')}<ReadOnlyAmount value={shift.paid_expenses} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Pending Expenses (RM) — auto')}<ReadOnlyAmount value={shift.pending_expenses} /></div>
              <div>{label('Visa MAYBANK (RM) — auto')}<ReadOnlyAmount value={shift.visa_maybank} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Visa BSN (RM) — auto')}<ReadOnlyAmount value={shift.visa_bsn} /></div>
              <div>{label('KababOnline Banking (RM)')}<ReadOnlyAmount value={shift.kabab_online} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('G Online Banking (RM)')}<ReadOnlyAmount value={shift.g_online} /></div>
              <div>{label('Credit — Grab/Foodpanda (RM) — auto')}<ReadOnlyAmount value={shift.credit} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Discounts (RM) — auto')}<ReadOnlyAmount value={shift.discounts} /></div>
              <div>{label('Manager Note')}<input style={inp} value={shift.manager_note} onChange={e => setShift(num, 'manager_note', e.target.value)} placeholder="Note..." /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Total Sales (RM) — auto')}<div style={{ ...roInp, fontSize: 15 }}>{(parseFloat(shift.total_balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
            </div>
          </div>

          {/* Right column — Bills Details */}
          <div style={{ background: S.card, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: S.gold, marginBottom: 4 }}>📋 Cashier Bills Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                {label('Paid')}
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={shift.bills_paid} onChange={e => setShift(num, 'bills_paid', e.target.value)} placeholder="Paid bills..." />
              </div>
              <div>
                {label('Pending')}
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={shift.bills_pending} onChange={e => setShift(num, 'bills_pending', e.target.value)} placeholder="Pending bills..." />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                {label('Discounts')}
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={shift.bills_discounts} onChange={e => setShift(num, 'bills_discounts', e.target.value)} placeholder="Discounts..." />
              </div>
              <div>
                {label('Online')}
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={shift.bills_online} onChange={e => setShift(num, 'bills_online', e.target.value)} placeholder="Online..." />
              </div>
            </div>
          </div>
        </div>

        {/* Quick-add an expense or a delivery order — saved instantly and calculated automatically */}
        <div style={{ padding: isMobile ? '0 14px 14px' : '0 20px 20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={{ background: S.card, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: S.red, marginBottom: 10 }}>💸 Add Cash Expense</div>
            <input style={{ ...inp, marginBottom: 8 }} placeholder="Description" value={expDesc} onChange={e => setExpDesc(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <NumInput style={numInp} placeholder="Amount" value={expAmount} onChange={v => setExpAmount(v)} />
              <select style={inp} value={expStatus} onChange={e => setExpStatus(e.target.value as any)}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <button onClick={addExpense} disabled={expSaving}
              style={{ width: '100%', padding: 9, borderRadius: 8, border: 'none', background: S.red, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: expSaving ? 0.6 : 1 }}>
              {expSaving ? '⏳...' : '➕ Add Expense'}
            </button>
          </div>

          <div style={{ background: S.card, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: S.blue, marginBottom: 10 }}>🛵 Add Delivery Order</div>
            <select style={{ ...inp, marginBottom: 8 }} value={delPlatform} onChange={e => setDelPlatform(e.target.value as any)}>
              <option value="kabab_online">Kabab Online</option>
              <option value="g_online">G Online</option>
              <option value="grab">Grab</option>
              <option value="foodpanda">Foodpanda</option>
            </select>
            <NumInput style={{ ...numInp, marginBottom: 8, width: '100%', boxSizing: 'border-box' }} placeholder="Amount" value={delAmount} onChange={v => setDelAmount(v)} />
            <button onClick={addDelivery} disabled={delSaving}
              style={{ width: '100%', padding: 9, borderRadius: 8, border: 'none', background: S.blue, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: delSaving ? 0.6 : 1 }}>
              {delSaving ? '⏳...' : '➕ Add Order'}
            </button>
          </div>
        </div>
      </div>
    )
  }

export default function DailyReportPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const printRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState(emptyForm())
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [view, setView] = useState<'form' | 'history' | 'orders'>('form')
  // Branch — required, and the basis for auto-pulling numbers from the system
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchFilter, setBranchFilter] = useState('')
  // ✅ مؤشر بسيط للعرض بس ("🔄 Updating...") - مفيش زرار يدوي بيتحكم فيه، بيتفعل تلقائيًا وقت السحب
  const [refreshing, setRefreshing] = useState(false)

  const [isMobile, setIsMobile] = useState(false)

  // Order details (separate tab) — every order with its time in Malaysia timezone, 24h format
  const [orderDetails, setOrderDetails] = useState<any[]>([])
  // ✅ جديد: تفاصيل الطلب المختار من جدول Sales Details - بيظهر في مودال بمنتصف الشاشة
  const [orderDetailModal, setOrderDetailModal] = useState<any | null>(null)
  // Which shift to show in Sales Details — 'all' = whole day, or one specific shift
  // (based on its real start/end time, not the calendar day)
  const [shiftFilter, setShiftFilter] = useState<'all' | 'Shift 1' | 'Shift 2' | 'Shift 3' | 'Unassigned'>('all')
  const [loadingOrders, setLoadingOrders] = useState(false)

  // ✅ Figure out which shift an order actually belongs to using ONLY the
  // REAL claimed start/end times for this report's shifts. We deliberately do
  // NOT fall back to the old orders.shift text label (e.g. 'shift1') — that
  // label comes from the POS and has no relation to the actual flexible
  // shift windows now in use, and using it as a fallback was silently
  // mis-attributing orders (e.g. an order paid just after midnight showing
  // up as "Shift 1" even though it falls outside shift 1's real hours).
  // An order with no matching time window is honestly "Unassigned" instead.
  function resolveShiftLabel(order: any): 'Shift 1' | 'Shift 2' | 'Shift 3' | 'Unassigned' {
    const paidAt = order.paid_at ? new Date(order.paid_at).getTime() : null
    if (paidAt !== null) {
      for (const n of [1, 2, 3] as const) {
        const sh = (form as any)[`shift${n}`]
        if (!sh.start_time) continue
        const start = new Date(sh.start_time).getTime()
        const end = sh.end_time ? new Date(sh.end_time).getTime() : Date.now()
        if (paidAt >= start && paidAt <= end) return (`Shift ${n}`) as any
      }
    }
    return 'Unassigned'
  }

  const [ordersError, setOrdersError] = useState<string | null>(null)

  const fetchOrderDetails = useCallback(async () => {
    if (!branchFilter || !form.report_date) { setOrderDetails([]); return }
    setLoadingOrders(true)
    setOrdersError(null)
    const { dayStart, dayEnd } = getMYDayBounds(form.report_date)
    const { data, error } = await sb.from('orders')
      .select('id, total_amount, discount_amount, discount_type, service_charge, sst_amount, payment_method, card_bank, paid_by_name, shift, notes, created_at, paid_at, tables!inner(branch_id, name), order_items(id,quantity,unit_price,notes,size_name,status,cancel_reason,menu_items(name,name_en,or_code))')
      .eq('status', 'paid').eq('tables.branch_id', branchFilter)
      .gte('paid_at', dayStart).lte('paid_at', dayEnd)
      .order('paid_at', { ascending: true })
    if (error) {
      console.error('fetchOrderDetails error:', error)
      setOrdersError(error.message)
    }
    setOrderDetails(data || [])
    setLoadingOrders(false)
  }, [sb, branchFilter, form.report_date])

  useEffect(() => {
    if (view === 'orders') fetchOrderDetails()
  }, [view, fetchOrderDetails])
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    sb.from('branches').select('id,name').eq('is_active', true).order('name')
      .then(({ data }) => setBranches(data || []))
  }, [sb])

  // ✅ Cashier employees for the selected branch, for the "Cashier Name" dropdown.
  // Confirmed: employees.name, employees.branch_id, employees.is_active,
  // employees.role = 'cashier' (currently 2 people). If you later add an
  // "assistant cashier" role, just add its exact value to the array below,
  // e.g. ['cashier', 'cashier_assistant'].
  const [cashiers, setCashiers] = useState<{ id: string; name: string }[]>([])
  const [cashiersError, setCashiersError] = useState<string | null>(null)
  useEffect(() => {
    if (!branchFilter) { setCashiers([]); return }
    setCashiersError(null)
    sb.from('employees').select('id, name')
      .eq('branch_id', branchFilter).in('role', ['cashier']).eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load cashiers:', error)
          setCashiersError(error.message)
          setCashiers([])
        } else {
          setCashiers((data || []).map((e: any) => ({ id: e.id, name: e.name })))
        }
      })
  }, [sb, branchFilter])

  const fetchReports = useCallback(async () => {
    const { data } = await sb.from('daily_reports')
      .select('id, report_date, total_amount')
      .order('report_date', { ascending: false })
      .limit(30)
    setReports(data || [])
  }, [sb])

  useEffect(() => { fetchReports() }, [fetchReports])

  // When the date changes, fetch the report if it exists
  // ✅ جديد: formLoaded بيبقى true بس بعد ما التحميل الأولي (سواء تقرير محفوظ أو فورم فاضي) يخلص تمامًا،
  // عشان الحفظ التلقائي ميشتغلش قبل ما البيانات المحمّلة فعليًا من قاعدة البيانات توصل، فما نفقدش أي بيانات قديمة
  const [formLoaded, setFormLoaded] = useState(false)
  useEffect(() => {
    async function loadReport() {
      setFormLoaded(false)
      if (!form.report_date || !branchFilter) return
      const { data } = await sb.from('daily_reports')
        .select('*').eq('report_date', form.report_date).eq('branch_id', branchFilter).maybeSingle()
      if (data) {
        setExistingId(data.id)
        setForm({
          report_date: data.report_date,
          shift1: {
            date: data.shift1_date || '', cashier_name: data.shift1_cashier_name || '',
            received_balance: data.shift1_received_balance?.toString() || '',
            paid_expenses: data.shift1_paid_expenses?.toString() || '',
            pending_expenses: data.shift1_pending_expenses?.toString() || '',
            visa_maybank: data.shift1_visa_maybank?.toString() || '',
            visa_bsn: data.shift1_visa_bsn?.toString() || '',
            kabab_online: data.shift1_kabab_online?.toString() || '',
            g_online: data.shift1_g_online?.toString() || '',
            credit: data.shift1_credit?.toString() || '',
            discounts: data.shift1_discounts?.toString() || '',
            total_balance: data.shift1_total_balance?.toString() || '',
            manager_note: data.shift1_manager_note || '',
            bills_paid: data.shift1_bills_paid || '',
            bills_pending: data.shift1_bills_pending || '',
            bills_discounts: data.shift1_bills_discounts || '',
            bills_online: data.shift1_bills_online || '',
            start_time: data.shift1_start_time || '', end_time: data.shift1_end_time || '',
          },
          shift2: {
            date: data.shift2_date || '', cashier_name: data.shift2_cashier_name || '',
            received_balance: data.shift2_received_balance?.toString() || '',
            paid_expenses: data.shift2_paid_expenses?.toString() || '',
            pending_expenses: data.shift2_pending_expenses?.toString() || '',
            visa_maybank: data.shift2_visa_maybank?.toString() || '',
            visa_bsn: data.shift2_visa_bsn?.toString() || '',
            kabab_online: data.shift2_kabab_online?.toString() || '',
            g_online: data.shift2_g_online?.toString() || '',
            credit: data.shift2_credit?.toString() || '',
            discounts: data.shift2_discounts?.toString() || '',
            total_balance: data.shift2_total_balance?.toString() || '',
            manager_note: data.shift2_manager_note || '',
            bills_paid: data.shift2_bills_paid || '',
            bills_pending: data.shift2_bills_pending || '',
            bills_discounts: data.shift2_bills_discounts || '',
            bills_online: data.shift2_bills_online || '',
            start_time: data.shift2_start_time || '', end_time: data.shift2_end_time || '',
          },
          shift3: {
            date: data.shift3_date || '', cashier_name: data.shift3_cashier_name || '',
            received_balance: data.shift3_received_balance?.toString() || '',
            paid_expenses: data.shift3_paid_expenses?.toString() || '',
            pending_expenses: data.shift3_pending_expenses?.toString() || '',
            visa_maybank: data.shift3_visa_maybank?.toString() || '',
            visa_bsn: data.shift3_visa_bsn?.toString() || '',
            kabab_online: data.shift3_kabab_online?.toString() || '',
            g_online: data.shift3_g_online?.toString() || '',
            credit: data.shift3_credit?.toString() || '',
            discounts: data.shift3_discounts?.toString() || '',
            total_balance: data.shift3_total_balance?.toString() || '',
            manager_note: data.shift3_manager_note || '',
            bills_paid: data.shift3_bills_paid || '',
            bills_pending: data.shift3_bills_pending || '',
            bills_discounts: data.shift3_bills_discounts || '',
            bills_online: data.shift3_bills_online || '',
            start_time: data.shift3_start_time || '', end_time: data.shift3_end_time || '',
          },
          total_sales_report: data.total_sales_report?.toString() || '',
          total_paid_expenses: data.total_paid_expenses?.toString() || '',
          total_pending_expenses: data.total_pending_expenses?.toString() || '',
          total_visa_maybank: data.total_visa_maybank?.toString() || '',
          total_visa_bsn: data.total_visa_bsn?.toString() || '',
          total_kabab_online: data.total_kabab_online?.toString() || '',
          total_g_online: data.total_g_online?.toString() || '',
          total_credit: data.total_credit?.toString() || '',
          total_discounts: data.total_discounts?.toString() || '',
          total_amount: data.total_amount?.toString() || '',
          notes: data.notes || '',
          total_purchased_bills: data.total_purchased_bills?.toString() || '',
          grab: data.grab?.toString() || '',
          foodpanda: data.foodpanda?.toString() || '',
          treasurer_name: data.treasurer_name || '',
        })
      } else {
        setExistingId(null)
        setForm(p => ({ ...emptyForm(), report_date: p.report_date }))
      }
      setFormLoaded(true)
    }
    loadReport()
  }, [form.report_date, branchFilter, sb])

  // ✅ جديد: دالة موحّدة تسحب كل حاجة تلقائيًا - جلسات الشيفتات الحقيقية + كل الأرقام المالية لكل شيفت + إجمالي اليوم
  // بتشتغل تلقائيًا (مفيش زرار "Pull" يدوي خالص) سواء وانت فاتح تقرير اليوم أو تقرير يوم قديم
  async function refreshAll() {
    if (!branchFilter || !form.report_date) return
    setRefreshing(true)
    const sessions = await fetchShiftSessions()
    await Promise.all([
      pullShiftFromSystem(1, sessions[1]),
      pullShiftFromSystem(2, sessions[2]),
      pullShiftFromSystem(3, sessions[3]),
      pullDayTotalsFromSystem(),
    ])
    setRefreshing(false)
  }

  // ✅ يشتغل أول ما التقرير يخلص تحميله (سواء تقرير محفوظ قبل كده أو فاضي) لأي تاريخ/فرع - بديل كامل لزرار "Pull from System"
  useEffect(() => {
    if (!formLoaded) return
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formLoaded, branchFilter, form.report_date])

  // ✅ حفظ تلقائي (Auto-Save) - أي تغيير في الفورم (سواء محسوب تلقائيًا أو مدخل يدوي زي العهدة/الملاحظات)
  // بيتحفظ لوحده بعد ثانية ونص من آخر تغيير - بديل كامل لزرار "Save Report" اليدوي
  useEffect(() => {
    if (!formLoaded || !branchFilter) return
    const t = setTimeout(() => { saveReport() }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, formLoaded, branchFilter])

  // Live auto-refresh (Realtime) without needing a manual page refresh.
  // As soon as a new order / expense / delivery order / purchase invoice / shift session
  // is recorded in the database for any branch, the app listens via Supabase Realtime and,
  // after a short debounce (to avoid firing dozens of requests if many changes happen at
  // once), automatically re-pulls everything — but only when the currently selected
  // branch and date match today (past reports don't change live).
  const [liveSync, setLiveSync] = useState(false)
  useEffect(() => {
    if (!branchFilter || !form.report_date) { setLiveSync(false); return }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const isToday = form.report_date === new Date().toISOString().split('T')[0]

    const triggerAutoPull = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => { refreshAll() }, 1500)
    }

    // Only enable live sync for today's report (past reports don't need live updates)
    if (!isToday) { setLiveSync(false); return }

    const channel = sb
      .channel(`daily-report-live-${branchFilter}-${form.report_date}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, triggerAutoPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_cash_expenses' }, triggerAutoPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_platform_orders' }, triggerAutoPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_invoices' }, triggerAutoPull)
      // ✅ جديد: أي تحديث في جلسات الشيفت الحقيقية (بدء/إنهاء شيفت من شاشة الكاشير) يحدّث التقرير فورًا
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashier_shift_sessions' }, triggerAutoPull)
      .subscribe(status => setLiveSync(status === 'SUBSCRIBED'))

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      setLiveSync(false)
      sb.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, form.report_date, sb])

  function setShift(n: 1 | 2 | 3, field: string, val: string) {
    setForm(p => ({ ...p, [`shift${n}`]: { ...p[`shift${n}` as 'shift1' | 'shift2' | 'shift3'], [field]: val } }))
  }

  // ✅ جديد: نفس مصدر الحقيقة الوحيد لأوقات وأسماء الشيفتات المستخدم في شاشة الكاشير (تاب Closed) —
  // بدل نظام "Start/End Shift" اليدوي المنفصل اللي كان في التقرير ده، بقينا نجيب البيانات الحقيقية
  // من نفس الجدول اللي بيتسجل فيه الكاشير شيفته فعليًا وهو بيبدأ شغله على الكاشير
  //
  // ✅ Fix حرج: التوزيع بقى حسب **الترتيب الزمني الفعلي** لكل جلسة في اليوم، مش حسب قيمة عمود "shift"
  // المسجّلة في نظام الكاشير. يعني أول كاشير يبدأ شغله في اليوم بياخد صندوق "Shift 1"، وثاني كاشير (حتى
  // لو هو نفسه سجّل تحت نفس label الشيفت في نظام الكاشير) بياخد صندوق "Shift 2" تلقائيًا، وهكذا. ده بالظبط
  // اللي بيخلّي "End Shift" بتاع بشار يظهر منتهي في صندوقه، ومجد يبان في صندوق منفصل تمامًا رقم 2.
  // لو حصل (نادرًا) أكتر من 3 جلسات حقيقية في يوم واحد، أي جلسة زيادة بتتضاف لصندوق Shift 3 الأخير.
  // ✅ Fix حرج جدًا: المطعم شغال 24 ساعة، فكاشير زي مجد ممكن يبدأ شيفته الساعة 7 مساءً ويكمّل لحد 5 الفجر
  // اليوم اللي بعده. الجلسة دي بتتسجّل بـ session_date = تاريخ يوم أمس (يوم البداية)، فكانت بتختفي تمامًا
  // من تقرير اليوم التالي حتى لو نص الشيفت (من نص الليل لحد 5 الفجر) بيخص اليوم ده فعليًا. دلوقتي بنجيب
  // أي جلسة: تاريخها يطابق اليوم المطلوب، أو اتقفلت خلال اليوم ده (حتى لو بدأت أمس)، أو لسه شغالة فعليًا
  async function fetchShiftSessions(): Promise<Record<number, { cashier_name: string; started_at: string; ended_at: string | null }[]>> {
    const map: Record<number, { cashier_name: string; started_at: string; ended_at: string | null }[]> = { 1: [], 2: [], 3: [] }
    if (!branchFilter || !form.report_date) return map
    const { dayStart, dayEnd } = getMYDayBounds(form.report_date)
    // ✅ Fix حرج جدًا: أي جلسة "عابرة لمنتصف الليل" أو "لسه مفتوحة" لازم تكون بدأت خلال آخر 24 ساعة بس قبل
    // بداية اليوم المطلوب - وإلا شيفتات قديمة جدًا اتنسيت مفتوحة (زي من أسابيع فاتت) أو اتقفلت بالغلط في وقت
    // متأخر (زي باج قفل الشيفت اللي كان بيقفل كل الجلسات المفتوحة مش بس الحالية) كانت بتظهر غلط في تقرير اليوم
    const recentThreshold = new Date(new Date(dayStart).getTime() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await sb.from('cashier_shift_sessions')
      .select('cashier_name, started_at, ended_at')
      .eq('branch_id', branchFilter)
      .or(`session_date.eq.${form.report_date},and(ended_at.gte.${dayStart},ended_at.lte.${dayEnd},started_at.gte.${recentThreshold}),and(ended_at.is.null,started_at.gte.${recentThreshold})`)
      .order('started_at', { ascending: true })
    const rowsFiltered = (data as any[]) || []
    rowsFiltered.forEach((row, idx) => {
      const box = Math.min(idx + 1, 3) // بالترتيب: أول جلسة → 1، تانية → 2، تالتة وأي حاجة زيادة → 3
      map[box].push({ cashier_name: row.cashier_name, started_at: row.started_at, ended_at: row.ended_at })
    })

    // ✅ جديد: لو فيه فجوة حقيقية (مفيش كاشير مسجّل خلالها) بين شيفتين، وصندوق Shift 3 لسه فاضي (يعني
    // مفيش جلسة تالتة حقيقية أصلاً)، بنحط الفجوة دي في Shift 3 بنفسها - بدل ما تختفي في "Unassigned" العام.
    // كده بيبقى واضح "مفيش حد كان ماسك الشيفت من الساعة كذا للساعة كذا" بدل ما يتوه وسط أرقام عامة.
    // الحد الأدنى للفجوة عشان تستاهل صندوق مستقل = 15 دقيقة (أقل من كده مش مستاهلة نعرضها كشيفت منفصل)
    const GAP_THRESHOLD_MS = 15 * 60 * 1000
    if (map[3].length === 0 && rowsFiltered.length >= 1) {
      let gapStart: number | null = null
      let gapEnd: number | null = null
      // بندوّر على أكبر فجوة بين نهاية جلسة وبداية اللي بعدها
      for (let i = 0; i < rowsFiltered.length - 1; i++) {
        const prevEnd = rowsFiltered[i].ended_at ? new Date(rowsFiltered[i].ended_at as string).getTime() : null
        const nextStart = new Date(rowsFiltered[i + 1].started_at).getTime()
        if (prevEnd && nextStart > prevEnd) {
          const gapLen = nextStart - prevEnd
          if (gapLen >= GAP_THRESHOLD_MS && (gapStart === null || gapLen > (gapEnd! - gapStart!))) {
            gapStart = prevEnd
            gapEnd = nextStart
          }
        }
      }
      // ولو مفيش فجوة بين جلستين، بنشوف هل فيه فجوة قبل أول جلسة في اليوم (من نص الليل لحد ما حد بدأ شيفته)
      if (gapStart === null) {
        const firstStart = new Date(rowsFiltered[0].started_at).getTime()
        const dayStartMs = new Date(dayStart).getTime()
        if (firstStart - dayStartMs >= GAP_THRESHOLD_MS) {
          gapStart = dayStartMs
          gapEnd = firstStart
        }
      }
      if (gapStart !== null && gapEnd !== null) {
        map[3].push({
          cashier_name: '⚠️ No Cashier (Gap)',
          started_at: new Date(gapStart).toISOString(),
          ended_at: new Date(gapEnd).toISOString(),
        })
      }
    }

    return map
  }


  function n(v: string) { return parseFloat(v) || 0 }
  // Round totals to prevent JavaScript's famous floating-point issue
  // (e.g. 0.1 + 0.2 can produce 0.30000000000000004 instead of 0.3)
  function round2(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100 }
  // Display formatter: thousand separators + 2 decimals, for read-only numbers (tables, totals)
  function fmtMoney(v: number) { return (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  // Find the most frequent name among a set of orders (to auto-detect who ran the shift)
  function mostFrequentName(names: (string | null | undefined)[]): string {
    const counts: Record<string, number> = {}
    for (const nm of names) {
      if (!nm) continue
      counts[nm] = (counts[nm] || 0) + 1
    }
    let best = ''; let bestCount = 0
    for (const [nm, c] of Object.entries(counts)) {
      if (c > bestCount) { best = nm; bestCount = c }
    }
    return best
  }

  // Pull shift numbers from real data (paid orders + expenses + recorded delivery orders)
  // ✅ sessions: كل جلسات الشيفت ده الحقيقية من cashier_shift_sessions (ممكن تكون أكتر من واحدة - تسليم/استلام بين كاشيرين)
  async function pullShiftFromSystem(num: 1 | 2 | 3, sessions?: { cashier_name: string; started_at: string; ended_at: string | null }[]) {
    if (!branchFilter || !form.report_date) return
    const shiftKey = `shift${num}` as 'shift1' | 'shift2' | 'shift3'
    const { dayStart, dayEnd } = getMYDayBounds(form.report_date)

    // ✅ لو الشيفت له جلسة أو أكتر مسجّلة فعليًا (من شاشة الكاشير)، بنستخدم كل نافذة زمنية منهم (بداية → نهاية، أو بداية → دلوقتي لو لسه شغالة)
    // بدل يوم كامل. لو مفيش أي جلسة، بنرجع لسلوك احتياطي (يوم كامل + label الشيفت القديم من نظام الكاشير)
    //
    // ✅ Fix حرج: لو الشيفت لسه شغال (مفيش end_time)، نهايته المؤقتة بتتحسب "دلوقتي" - لكن لازم متتعديش نهاية
    // يوم التقرير نفسه. من غير الحد ده، لو حد فتح/حدّث التقرير بعد نص الليل (والمطعم شغال 24 ساعة)، الشيفت
    // اللي لسه شغال كان بيسحب معاه كمان كل مبيعات اليوم الجديد، فيطلع الإجمالي أكبر من الحقيقي وأكبر حتى من
    // إجمالي اليوم نفسه (Total Sales Report) اللي بيفضل محصور صح جوه حدود اليوم.
    const nowISO = new Date().toISOString()
    const cappedNow = nowISO < dayEnd ? nowISO : dayEnd
    const validSessions = (sessions || []).filter(s => !!s.started_at)
    const useTimeWindow = validSessions.length > 0
    // ✅ Fix حرج: لو الجلسة بدأت *قبل* منتصف ليل يوم التقرير (شيفت زي مجد بدأ الساعة 7 مساءً امبارح واستمر
    // لحد الفجر النهاردة)، بنحسب بس الجزء اللي بيخص يوم التقرير ده (من منتصف الليل) - مش كل الجلسة من بدايتها
    // الحقيقية، وإلا مبيعات يوم أمس بالكامل كانت هتتحسب غلط جوه تقرير اليوم ده. وقت العرض (Started HH:MM) لسه
    // بيوري الوقت الحقيقي اللي الكاشير بدأ فيه فعليًا، بس حساب المبيعات بس بيتقصّر على جزء اليوم الحالي
    const windows = useTimeWindow
      ? validSessions.map(s => ({ start: new Date(s.started_at).getTime() < new Date(dayStart).getTime() ? dayStart : s.started_at, end: s.ended_at || cappedNow }))
      : [{ start: dayStart, end: dayEnd }]
    // أوسع مدى زمني يغطي كل الجلسات، عشان نجيب الأوردرات في استعلام واحد ثم نفلترها بدقة على كل نافذة
    // ✅ Fix حرج: نفس باج المقارنة النصية - لازم نقارن بالتوقيت الحقيقي (getTime) مش كنصوص، وإلا اختلاف صيغة
    // المنطقة الزمنية بين قيم قاعدة البيانات (+00:00) والقيم المحسوبة يدويًا (+08:00) بيدي نتيجة غلط
    const rangeStart = windows.reduce((m, w) => (new Date(w.start).getTime() < new Date(m).getTime() ? w.start : m), windows[0].start)
    const rangeEnd = windows.reduce((m, w) => (new Date(w.end).getTime() > new Date(m).getTime() ? w.end : m), windows[0].end)

    let ordersQuery = sb.from('orders')
      .select('total_amount, discount_amount, payment_method, card_bank, shift, paid_at, paid_by_name, tables!inner(branch_id)')
      .eq('status', 'paid').eq('tables.branch_id', branchFilter)
      .gte('paid_at', rangeStart).lte('paid_at', rangeEnd)
    if (!useTimeWindow) ordersQuery = ordersQuery.eq('shift', shiftKey)

    const [ordersRes, expRes, delRes] = await Promise.all([
      ordersQuery,
      sb.from('daily_cash_expenses').select('amount,status')
        .eq('branch_id', branchFilter).eq('shift', shiftKey).eq('expense_date', form.report_date),
      sb.from('delivery_platform_orders').select('amount,platform')
        .eq('branch_id', branchFilter).eq('shift', shiftKey).eq('order_date', form.report_date),
    ])

    // ✅ فلترة دقيقة: نستبعد أي طلب وقع في فجوة بين جلستين (مثلاً لو فيه وقت فاصل حقيقي بين ما بشار سلّم ومجد استلم)
    const rawOrders = ordersRes.data || []
    const orders = useTimeWindow
      ? rawOrders.filter(o => windows.some(w => o.paid_at! >= w.start && o.paid_at! <= w.end))
      : rawOrders
    const expenses = expRes.data || []
    const delivery = delRes.data || []

    const salesTotal = round2(orders.reduce((s, o) => s + (o.total_amount || 0), 0))
    const discountsTotal = round2(orders.reduce((s, o) => s + (o.discount_amount || 0), 0))
    const visaMaybank = round2(orders.filter(o => o.payment_method === 'visa' && o.card_bank === 'maybank').reduce((s, o) => s + (o.total_amount || 0), 0))
    const visaBsn = round2(orders.filter(o => o.payment_method === 'visa' && o.card_bank === 'bsn').reduce((s, o) => s + (o.total_amount || 0), 0))
    // ✅ جديد: إجمالي Credit لهذا الشيفت - طلبات Grab/Foodpanda اللي اتقفلت بـ"Ajil/Credit" في شاشة الكاشير
    const creditTotal = round2(orders.filter(o => o.payment_method === 'credit').reduce((s, o) => s + (o.total_amount || 0), 0))
    const kababOnline = round2(delivery.filter(d => d.platform === 'kabab_online').reduce((s, d) => s + (d.amount || 0), 0))
    const gOnline = round2(delivery.filter(d => d.platform === 'g_online').reduce((s, d) => s + (d.amount || 0), 0))
    const paidExpenses = round2(expenses.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0))
    const pendingExpenses = round2(expenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount || 0), 0))
    // Auto-detect cashier name from the most frequent name in paid orders during this shift (احتياطي لو مفيش جلسة مسجّلة أصلًا)
    const detectedCashier = mostFrequentName(orders.map(o => (o as any).paid_by_name))

    // ✅ لو أكتر من كاشير اشتغلوا في نفس رقم الشيفت (تسليم/استلام)، بنعرض كل الأسماء مرتبة زمنيًا زي "Bashar → Majd"
    const uniqueNames = [...new Set(validSessions.map(s => s.cashier_name).filter(Boolean))]
    const combinedCashierName = uniqueNames.length ? uniqueNames.join(' → ') : detectedCashier
    const firstStart = validSessions.length ? validSessions[0].started_at : ''
    const lastSession = validSessions.length ? validSessions[validSessions.length - 1] : null
    const lastEnd = lastSession ? (lastSession.ended_at || '') : '' // فاضي = لسه في شيفت شغالة دلوقتي

    setForm(p => ({
      ...p,
      [shiftKey]: {
        ...(p as any)[shiftKey],
        // ✅ اسم الكاشير (أو الأسماء) ووقت البداية/النهاية بيجوا 100% من الجلسات الحقيقية بتاعة نظام الكاشير
        cashier_name: combinedCashierName || '',
        start_time: firstStart,
        end_time: lastEnd,
        date: firstStart
          ? new Date(firstStart).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
          : form.report_date,
        paid_expenses: String(paidExpenses),
        pending_expenses: String(pendingExpenses),
        visa_maybank: String(visaMaybank),
        visa_bsn: String(visaBsn),
        kabab_online: String(kababOnline),
        g_online: String(gOnline),
        credit: String(creditTotal),
        discounts: String(discountsTotal),
        total_balance: String(salesTotal),
      },
    }))
  }

  // Pull the whole day's totals (top level: sales, Grab, Foodpanda, purchase invoices)
  async function pullDayTotalsFromSystem() {
    if (!branchFilter || !form.report_date) return
    const { dayStart, dayEnd } = getMYDayBounds(form.report_date)

    const [ordersRes, delRes, purchasesRes, expRes] = await Promise.all([
      sb.from('orders')
        .select('total_amount, discount_amount, payment_method, card_bank, tables!inner(branch_id)')
        .eq('status', 'paid').eq('tables.branch_id', branchFilter)
        .gte('paid_at', dayStart).lte('paid_at', dayEnd),
      sb.from('delivery_platform_orders').select('amount,platform')
        .eq('branch_id', branchFilter).eq('order_date', form.report_date),
      sb.from('purchase_invoices')
        .select('total_amount, warehouses!inner(branch_id)')
        .eq('warehouses.branch_id', branchFilter).eq('invoice_date', form.report_date),
      sb.from('daily_cash_expenses').select('amount,status')
        .eq('branch_id', branchFilter).eq('expense_date', form.report_date),
    ])

    const orders = ordersRes.data || []
    const delivery = delRes.data || []
    const purchases = purchasesRes.data || []
    const expenses = expRes.data || []
    const paidExpensesTotal = round2(expenses.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0))
    const pendingExpensesTotal = round2(expenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount || 0), 0))

    const salesTotal = round2(orders.reduce((s, o) => s + (o.total_amount || 0), 0))
    const discountsTotal = round2(orders.reduce((s, o) => s + (o.discount_amount || 0), 0))
    const visaMaybank = round2(orders.filter(o => o.payment_method === 'visa' && o.card_bank === 'maybank').reduce((s, o) => s + (o.total_amount || 0), 0))
    const visaBsn = round2(orders.filter(o => o.payment_method === 'visa' && o.card_bank === 'bsn').reduce((s, o) => s + (o.total_amount || 0), 0))
    // ✅ جديد: إجمالي Credit ليوم كامل - طلبات Grab/Foodpanda اللي اتقفلت بـ"Ajil/Credit"
    const creditTotalDay = round2(orders.filter(o => o.payment_method === 'credit').reduce((s, o) => s + (o.total_amount || 0), 0))
    const kababOnline = round2(delivery.filter(d => d.platform === 'kabab_online').reduce((s, d) => s + (d.amount || 0), 0))
    const gOnline = round2(delivery.filter(d => d.platform === 'g_online').reduce((s, d) => s + (d.amount || 0), 0))
    const grabTotal = round2(delivery.filter(d => d.platform === 'grab').reduce((s, d) => s + (d.amount || 0), 0))
    const foodpandaTotal = round2(delivery.filter(d => d.platform === 'foodpanda').reduce((s, d) => s + (d.amount || 0), 0))
    const purchasesTotal = round2(purchases.reduce((s, pInv) => s + (pInv.total_amount || 0), 0))

    setForm(p => ({
      ...p,
      total_sales_report: String(salesTotal),
      total_paid_expenses: String(paidExpensesTotal),
      total_pending_expenses: String(pendingExpensesTotal),
      total_visa_maybank: String(visaMaybank),
      total_visa_bsn: String(visaBsn),
      total_kabab_online: String(kababOnline),
      total_g_online: String(gOnline),
      total_credit: String(creditTotalDay),
      total_discounts: String(discountsTotal),
      grab: String(grabTotal),
      foodpanda: String(foodpandaTotal),
      total_purchased_bills: String(purchasesTotal),
    }))
  }

  async function saveReport() {
    if (!branchFilter) { alert('Please select a branch first'); return }
    setSaving(true)
    const payload = {
      report_date: form.report_date,
      branch_id: branchFilter,
      shift1_date: form.shift1.date || null,
      shift1_cashier_name: form.shift1.cashier_name || null,
      shift1_received_balance: n(form.shift1.received_balance),
      shift1_paid_expenses: n(form.shift1.paid_expenses),
      shift1_pending_expenses: n(form.shift1.pending_expenses),
      shift1_visa_maybank: n(form.shift1.visa_maybank),
      shift1_visa_bsn: n(form.shift1.visa_bsn),
      shift1_kabab_online: n(form.shift1.kabab_online),
      shift1_g_online: n(form.shift1.g_online),
      shift1_credit: n(form.shift1.credit),
      shift1_discounts: n(form.shift1.discounts),
      shift1_total_balance: n(form.shift1.total_balance),
      shift1_manager_note: form.shift1.manager_note || null,
      shift1_bills_paid: form.shift1.bills_paid || null,
      shift1_bills_pending: form.shift1.bills_pending || null,
      shift1_bills_discounts: form.shift1.bills_discounts || null,
      shift1_bills_online: form.shift1.bills_online || null,
      shift1_start_time: form.shift1.start_time || null,
      shift1_end_time: form.shift1.end_time || null,
      shift2_date: form.shift2.date || null,
      shift2_cashier_name: form.shift2.cashier_name || null,
      shift2_received_balance: n(form.shift2.received_balance),
      shift2_paid_expenses: n(form.shift2.paid_expenses),
      shift2_pending_expenses: n(form.shift2.pending_expenses),
      shift2_visa_maybank: n(form.shift2.visa_maybank),
      shift2_visa_bsn: n(form.shift2.visa_bsn),
      shift2_kabab_online: n(form.shift2.kabab_online),
      shift2_g_online: n(form.shift2.g_online),
      shift2_credit: n(form.shift2.credit),
      shift2_discounts: n(form.shift2.discounts),
      shift2_total_balance: n(form.shift2.total_balance),
      shift2_manager_note: form.shift2.manager_note || null,
      shift2_bills_paid: form.shift2.bills_paid || null,
      shift2_bills_pending: form.shift2.bills_pending || null,
      shift2_bills_discounts: form.shift2.bills_discounts || null,
      shift2_bills_online: form.shift2.bills_online || null,
      shift2_start_time: form.shift2.start_time || null,
      shift2_end_time: form.shift2.end_time || null,
      shift3_date: form.shift3.date || null,
      shift3_cashier_name: form.shift3.cashier_name || null,
      shift3_received_balance: n(form.shift3.received_balance),
      shift3_paid_expenses: n(form.shift3.paid_expenses),
      shift3_pending_expenses: n(form.shift3.pending_expenses),
      shift3_visa_maybank: n(form.shift3.visa_maybank),
      shift3_visa_bsn: n(form.shift3.visa_bsn),
      shift3_kabab_online: n(form.shift3.kabab_online),
      shift3_g_online: n(form.shift3.g_online),
      shift3_credit: n(form.shift3.credit),
      shift3_discounts: n(form.shift3.discounts),
      shift3_total_balance: n(form.shift3.total_balance),
      shift3_manager_note: form.shift3.manager_note || null,
      shift3_bills_paid: form.shift3.bills_paid || null,
      shift3_bills_pending: form.shift3.bills_pending || null,
      shift3_bills_discounts: form.shift3.bills_discounts || null,
      shift3_bills_online: form.shift3.bills_online || null,
      shift3_start_time: form.shift3.start_time || null,
      shift3_end_time: form.shift3.end_time || null,
      total_sales_report: n(form.total_sales_report),
      total_paid_expenses: n(form.total_paid_expenses),
      total_pending_expenses: n(form.total_pending_expenses),
      total_visa_maybank: n(form.total_visa_maybank),
      total_visa_bsn: n(form.total_visa_bsn),
      total_kabab_online: n(form.total_kabab_online),
      total_g_online: n(form.total_g_online),
      total_credit: n(form.total_credit),
      total_discounts: n(form.total_discounts),
      total_amount: n(form.total_amount),
      notes: form.notes || null,
      total_purchased_bills: n(form.total_purchased_bills),
      grab: n(form.grab),
      foodpanda: n(form.foodpanda),
      treasurer_name: form.treasurer_name || null,
      updated_at: new Date().toISOString(),
    }

    let saveError = null
    if (existingId) {
      const { error } = await sb.from('daily_reports').update(payload).eq('id', existingId)
      saveError = error
    } else {
      const { data, error } = await sb.from('daily_reports').insert([payload]).select('id').single()
      saveError = error
      if (data) setExistingId(data.id)
    }

    setSaving(false)
    if (saveError) {
      // ⚠️ Critical: never silently pretend a save succeeded. If this fires, the
      // data was NOT written to the database — most likely a missing column
      // (e.g. a migration that hasn't been run yet). Show the real error so
      // nothing looks "saved" when it wasn't.
      console.error('saveReport failed:', saveError)
      alert('⚠️ SAVE FAILED — nothing was written to the database.\n\n' + saveError.message + '\n\nYour changes are still in the form, but you must fix this before leaving the page or they will be lost.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    fetchReports()
  }

  function printReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const s = form.shift1
    const s2 = form.shift2
    const s3 = form.shift3
    // Format numbers with thousand separators for readability in the printed report (e.g. 2,494.52)
    const fmt = (v: string | number) => {
      const num = typeof v === 'string' ? parseFloat(v) : v
      if (isNaN(num as number)) return v
      return (num as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Daily Report - ${form.report_date}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        h2 { text-align: center; font-size: 14px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        td, th { border: 1px solid #000; padding: 5px 8px; font-size: 11px; }
        .label { font-weight: bold; width: 180px; }
        .section-header { background: #eee; font-weight: bold; font-size: 12px; }
        .total-row { font-weight: bold; background: #f5f5f5; }
        @media print { @page { margin: 10mm; } }
      </style>
    </head><body>
      <h2>ORCHID HOUSE RESTAURANT – Daily Report<br><small>${form.report_date} — ${branches.find(b => b.id === branchFilter)?.name || ''}</small></h2>

      <table>
        <tr>
          <td colspan="4" class="section-header">Shift 1 – Date: ${s.date}</td>
        </tr>
        <tr>
          <td class="label">Cashier Name</td><td>${s.cashier_name}</td>
          <td class="label">Shift Time (MY)</td><td>${fmtTimeMY(s.start_time)} – ${fmtTimeMY(s.end_time)}</td>
        </tr>
        <tr>
          <td class="label"></td><td></td>
          <td class="label">Cashier Bills Details</td><td></td>
        </tr>
        <tr>
          <td class="label">Received Balance (RM)</td><td>${fmt(s.received_balance)}</td>
          <td rowspan="2"><b>Paid:</b><br>${s.bills_paid}</td>
          <td rowspan="2"><b>Pending:</b><br>${s.bills_pending}</td>
        </tr>
        <tr>
          <td class="label">Paid Expenses (RM)</td><td>${fmt(s.paid_expenses)}</td>
        </tr>
        <tr>
          <td class="label">Pending Expenses (RM)</td><td>${fmt(s.pending_expenses)}</td>
          <td rowspan="2"><b>Discounts:</b><br>${s.bills_discounts}</td>
          <td rowspan="2"><b>Online:</b><br>${s.bills_online}</td>
        </tr>
        <tr><td class="label">Visa MAYBANK (RM)</td><td>${fmt(s.visa_maybank)}</td></tr>
        <tr><td class="label">Visa BSN (RM)</td><td>${fmt(s.visa_bsn)}</td><td colspan="2"></td></tr>
        <tr><td class="label">KababOnline Banking (RM)</td><td>${fmt(s.kabab_online)}</td><td colspan="2"></td></tr>
        <tr><td class="label">G Online Banking (RM)</td><td>${fmt(s.g_online)}</td><td colspan="2"></td></tr>
        <tr><td class="label">Discounts (RM)</td><td>${fmt(s.discounts)}</td><td colspan="2"></td></tr>
        <tr class="total-row"><td class="label">Total Balance (RM)</td><td>${fmt(s.total_balance)}</td><td colspan="2"></td></tr>
        <tr><td class="label"><b>Manager Note</b></td><td colspan="3">${s.manager_note}</td></tr>
      </table>

      <table>
        <tr><td colspan="4" class="section-header">Shift 2 – Date: ${s2.date}</td></tr>
        <tr>
          <td class="label">Cashier Name</td><td>${s2.cashier_name}</td>
          <td class="label">Shift Time (MY)</td><td>${fmtTimeMY(s2.start_time)} – ${fmtTimeMY(s2.end_time)}</td>
        </tr>
        <tr>
          <td class="label"></td><td></td>
          <td class="label">Cashier Bills Details</td><td></td>
        </tr>
        <tr>
          <td class="label">Received Balance (RM)</td><td>${fmt(s2.received_balance)}</td>
          <td rowspan="2"><b>Paid:</b><br>${s2.bills_paid}</td>
          <td rowspan="2"><b>Pending:</b><br>${s2.bills_pending}</td>
        </tr>
        <tr><td class="label">Paid Expenses (RM)</td><td>${fmt(s2.paid_expenses)}</td></tr>
        <tr>
          <td class="label">Pending Expenses (RM)</td><td>${fmt(s2.pending_expenses)}</td>
          <td rowspan="2"><b>Discounts:</b><br>${s2.bills_discounts}</td>
          <td rowspan="2"><b>Online:</b><br>${s2.bills_online}</td>
        </tr>
        <tr><td class="label">Visa MAYBANK (RM)</td><td>${fmt(s2.visa_maybank)}</td></tr>
        <tr><td class="label">Visa BSN (RM)</td><td>${fmt(s2.visa_bsn)}</td><td colspan="2"></td></tr>
        <tr><td class="label">KababOnline Banking (RM)</td><td>${fmt(s2.kabab_online)}</td><td colspan="2"></td></tr>
        <tr><td class="label">G Online Banking (RM)</td><td>${fmt(s2.g_online)}</td><td colspan="2"></td></tr>
        <tr><td class="label">Discounts (RM)</td><td>${fmt(s2.discounts)}</td><td colspan="2"></td></tr>
        <tr class="total-row"><td class="label">Total Balance (RM)</td><td>${fmt(s2.total_balance)}</td><td colspan="2"></td></tr>
        <tr><td class="label"><b>Manager Note</b></td><td colspan="3">${s2.manager_note}</td></tr>
      </table>

      <table>
        <tr><td colspan="4" class="section-header">Shift 3 – Date: ${s3.date}</td></tr>
        <tr>
          <td class="label">Cashier Name</td><td>${s3.cashier_name}</td>
          <td class="label">Shift Time (MY)</td><td>${fmtTimeMY(s3.start_time)} – ${fmtTimeMY(s3.end_time)}</td>
        </tr>
        <tr>
          <td class="label"></td><td></td>
          <td class="label">Cashier Bills Details</td><td></td>
        </tr>
        <tr>
          <td class="label">Received Balance (RM)</td><td>${fmt(s3.received_balance)}</td>
          <td rowspan="2"><b>Paid:</b><br>${s3.bills_paid}</td>
          <td rowspan="2"><b>Pending:</b><br>${s3.bills_pending}</td>
        </tr>
        <tr><td class="label">Paid Expenses (RM)</td><td>${fmt(s3.paid_expenses)}</td></tr>
        <tr>
          <td class="label">Pending Expenses (RM)</td><td>${fmt(s3.pending_expenses)}</td>
          <td rowspan="2"><b>Discounts:</b><br>${s3.bills_discounts}</td>
          <td rowspan="2"><b>Online:</b><br>${s3.bills_online}</td>
        </tr>
        <tr><td class="label">Visa MAYBANK (RM)</td><td>${fmt(s3.visa_maybank)}</td></tr>
        <tr><td class="label">Visa BSN (RM)</td><td>${fmt(s3.visa_bsn)}</td><td colspan="2"></td></tr>
        <tr><td class="label">KababOnline Banking (RM)</td><td>${fmt(s3.kabab_online)}</td><td colspan="2"></td></tr>
        <tr><td class="label">G Online Banking (RM)</td><td>${fmt(s3.g_online)}</td><td colspan="2"></td></tr>
        <tr><td class="label">Discounts (RM)</td><td>${fmt(s3.discounts)}</td><td colspan="2"></td></tr>
        <tr class="total-row"><td class="label">Total Balance (RM)</td><td>${fmt(s3.total_balance)}</td><td colspan="2"></td></tr>
        <tr><td class="label"><b>Manager Note</b></td><td colspan="3">${s3.manager_note}</td></tr>
      </table>

      <table>
        <tr>
          <td class="label">Total Sales Report</td><td>${fmt(form.total_sales_report)}</td>
          <td class="label">Notes</td><td rowspan="4">${form.notes}</td>
        </tr>
        <tr>
          <td class="label">Total Paid Expenses (RM)</td><td>${fmt(form.total_paid_expenses)}</td>
          <td class="label">Total Purchased Bills – Shopping (RM)</td>
        </tr>
        <tr>
          <td class="label">Total Pending Expenses (RM)</td><td>${fmt(form.total_pending_expenses)}</td>
          <td>${fmt(form.total_purchased_bills)}</td>
        </tr>
        <tr>
          <td class="label">Total Visa MAYBANK (RM)</td><td>${fmt(form.total_visa_maybank)}</td>
          <td class="label">Grab: ${fmt(form.grab)} &nbsp;&nbsp; Foodpanda: ${fmt(form.foodpanda)}</td>
        </tr>
        <tr>
          <td class="label">Total Visa BSN</td><td>${fmt(form.total_visa_bsn)}</td>
          <td class="label">Treasurer Name and Signature</td>
          <td rowspan="4">${form.treasurer_name}</td>
        </tr>
        <tr><td class="label">Total KababOnline Banking (RM)</td><td>${fmt(form.total_kabab_online)}</td><td></td></tr>
        <tr><td class="label">Total G Online Banking (RM)</td><td>${fmt(form.total_g_online)}</td><td></td></tr>
        <tr><td class="label">Total Discounts</td><td>${fmt(form.total_discounts)}</td><td></td></tr>
        <tr class="total-row"><td class="label">Total amount</td><td>${fmt(form.total_amount)}</td><td colspan="2"></td></tr>
      </table>

      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`)
    win.document.close()
  }

  // Print the Sales Details tab — every paid order with its opening/payment
  // time in Malaysia timezone (24h), plus a grand total footer.
  function printOrderDetails() {
    const win = window.open('', '_blank')
    if (!win) return
    const branchName = branches.find(b => b.id === branchFilter)?.name || ''
    const filtered = orderDetails.filter(o => shiftFilter === 'all' || resolveShiftLabel(o) === shiftFilter)
    const grandTotal = round2(filtered.reduce((s, o) => s + (o.total_amount || 0), 0))
    const fmt = (v: number) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const rows = filtered.map((o, i) => {
      const lbl = resolveShiftLabel(o)
      const shiftColor = lbl === 'Shift 1' ? '#3B82F6' : lbl === 'Shift 2' ? '#8B5CF6' : lbl === 'Shift 3' ? '#22C55E' : '#999'
      return `
        <tr style="border-left: 3px solid ${shiftColor};">
          <td>${i + 1}</td>
          <td>${o.tables?.name || o.id?.slice(0, 8) || '—'}</td>
          <td style="color:${shiftColor}; font-weight:bold;">${lbl}</td>
          <td>${fmtTimeMY(o.created_at)}</td>
          <td>${fmtTimeMY(o.paid_at)}</td>
          <td>${o.paid_by_name || '—'}</td>
          <td>${o.payment_method || '—'}${o.card_bank ? ` (${o.card_bank})` : ''}</td>
          <td>${fmt(o.discount_amount || 0)}</td>
          <td><b>${fmt(o.total_amount || 0)}</b></td>
        </tr>`
    }).join('')

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Sales Details - ${form.report_date}${shiftFilter !== 'all' ? ' - ' + shiftFilter : ''}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        h2 { text-align: center; font-size: 14px; margin-bottom: 4px; }
        h4 { text-align: center; font-weight: normal; color: #555; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        td, th { border: 1px solid #000; padding: 5px 8px; font-size: 11px; text-align: left; }
        th { background: #eee; }
        .total-row td { font-weight: bold; background: #f5f5f5; font-size: 13px; }
        @media print { @page { margin: 10mm; } }
      </style>
    </head><body>
      <h2>ORCHID HOUSE RESTAURANT – Sales Details</h2>
      <h4>${form.report_date} — ${branchName}${shiftFilter !== 'all' ? ' — ' + shiftFilter + ' only' : ' — Whole Day'} — Times shown in Malaysia time (24h)</h4>

      <table>
        <thead>
          <tr>
            <th>#</th><th>Table</th><th>Shift</th><th>From (Opened)</th><th>To (Paid)</th>
            <th>Cashier</th><th>Payment Method</th><th>Discount</th><th>Net (RM)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="8">Total — ${filtered.length} orders</td>
            <td>RM ${fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`)
    win.document.close()
  }


  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'ltr' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } input[type=number]::-webkit-inner-spin-button { opacity: 0.3; } select option { background: #0F2040; color: #FAFAF8; }`}</style>

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: isMobile ? '10px 14px' : '0 24px', display: 'flex', alignItems: 'center', height: isMobile ? 'auto' : 60, gap: isMobile ? 8 : 16, position: 'sticky', top: 0, zIndex: 100, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <h1 style={{ color: S.gold, fontSize: isMobile ? 15 : 18, fontWeight: 900 }}>📊 Daily Report</h1>
        <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', gap: isMobile ? 6 : 10, alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : undefined }}>
          <button onClick={() => setView(v => v === 'form' ? 'history' : 'form')}
            style={{ padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: S.muted, cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontFamily: 'Tajawal, sans-serif', flex: isMobile ? 1 : undefined }}>
            {view === 'form' ? '📋 History' : '📝 Form'}
          </button>
          <button onClick={() => setView('orders')}
            style={{ padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 10, border: `1px solid ${view === 'orders' ? S.gold : S.border}`, background: view === 'orders' ? S.gold3 : S.card, color: view === 'orders' ? S.gold : S.muted, cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontFamily: 'Tajawal, sans-serif', fontWeight: view === 'orders' ? 700 : 400, flex: isMobile ? 1 : undefined }}>
            🧾 Sales Details
          </button>
          <button onClick={printReport}
            style={{ padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, flex: isMobile ? 1 : undefined }}>
            🖨️ Print
          </button>
          {/* ✅ جديد: مفيش زرار حفظ يدوي خالص - التقرير بيتحدث وبيتحفظ لوحده أول بأول */}
          <div style={{ padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, fontSize: isMobile ? 11 : 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, color: refreshing ? S.blue : saving ? S.gold : S.green, display: 'flex', alignItems: 'center', gap: 6, flex: isMobile ? 1 : undefined, justifyContent: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: refreshing ? S.blue : saving ? S.gold : S.green, display: 'inline-block' }} />
            {refreshing ? 'Updating...' : saving ? 'Saving...' : '✅ Up to date'}
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? 14 : 24, maxWidth: 1200, margin: '0 auto' }}>

        {view === 'orders' ? (
          /* Order Details View — every order's time span, Malaysia timezone, 24h format */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>
                🧾 Sales Details — {form.report_date} ({branches.find(b => b.id === branchFilter)?.name || 'Select a branch'})
              </h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={printOrderDetails} disabled={loadingOrders || orderDetails.filter(o => shiftFilter === 'all' || resolveShiftLabel(o) === shiftFilter).length === 0}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: (loadingOrders || orderDetails.filter(o => shiftFilter === 'all' || resolveShiftLabel(o) === shiftFilter).length === 0) ? 0.5 : 1 }}>
                  🖨️ Print
                </button>
                <button onClick={fetchOrderDetails} disabled={loadingOrders}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: loadingOrders ? 0.6 : 1 }}>
                  {loadingOrders ? '⏳ Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            {!branchFilter || !form.report_date ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>Select a branch and date first from the Form tab</div>
            ) : ordersError ? (
              <div style={{ textAlign: 'center', padding: 40, color: S.red, background: S.redB, borderRadius: 12, border: `1px solid ${S.red}` }}>
                ⚠️ Query error: {ordersError}
              </div>
            ) : loadingOrders ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
            ) : orderDetails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>No paid orders found for this day and branch</div>
            ) : (
              <>
                {/* Per-shift breakdown, based on each shift's real claimed start/end time.
                    Click a card to filter the table below to just that shift. */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div onClick={() => setShiftFilter('all')}
                    style={{ background: shiftFilter === 'all' ? S.gold3 : S.navy2, borderRadius: 12, border: `1px solid ${shiftFilter === 'all' ? S.gold : S.border}`, padding: '12px 16px', cursor: 'pointer' }}>
                    <div style={{ fontSize: 12, color: S.muted, marginBottom: 4 }}>Whole Day</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: S.gold }}>RM {fmtMoney(round2(orderDetails.reduce((s, o) => s + (o.total_amount || 0), 0)))}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{orderDetails.length} orders</div>
                  </div>
                  {(['Shift 1', 'Shift 2', 'Shift 3', 'Unassigned'] as const).map(labelKey => {
                    const group = orderDetails.filter(o => resolveShiftLabel(o) === labelKey)
                    if (group.length === 0) return null
                    const total = round2(group.reduce((s, o) => s + (o.total_amount || 0), 0))
                    const active = shiftFilter === labelKey
                    return (
                      <div key={labelKey} onClick={() => setShiftFilter(labelKey)}
                        style={{ background: active ? S.gold3 : S.navy2, borderRadius: 12, border: `1px solid ${active ? S.gold : S.border}`, padding: '12px 16px', cursor: 'pointer' }}>
                        <div style={{ fontSize: 12, color: S.muted, marginBottom: 4 }}>{labelKey}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: S.gold }}>RM {fmtMoney(total)}</div>
                        <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{group.length} orders</div>
                      </div>
                    )
                  })}
                </div>

                {orderDetails.some(o => resolveShiftLabel(o) === 'Unassigned') && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: S.muted, lineHeight: 1.6 }}>
                    ℹ️ <b style={{ color: S.white }}>Unassigned</b> = طلبات اتدفعت قبل ما أي كاشير يضغط "Start Shift" في اليوم ده (أو في فجوة بين شيفتين محدش فيها بدأ شيفت رسمي).
                    مش خطأ في الحساب — دي طلبات حقيقية، وتقدر تشوف مين قفلها بالظبط من عمود "Cashier" في الجدول تحت (فلتر على "Unassigned" فوق عشان تشوفها لوحدها).
                  </div>
                )}

                {shiftFilter !== 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, color: S.gold }}>
                    Showing {shiftFilter} only (its actual claimed time window)
                    <button onClick={() => setShiftFilter('all')}
                      style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                      ✖️ Clear filter
                    </button>
                  </div>
                )}

                <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'ltr', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: 'rgba(201,168,76,0.12)' }}>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>Table</th>
                          <th style={thStyle}>Shift</th>
                          <th style={thStyle}>From (Opened)</th>
                          <th style={thStyle}>To (Paid)</th>
                          <th style={thStyle}>Cashier</th>
                          <th style={thStyle}>Payment Method</th>
                          <th style={thStyle}>Discount</th>
                          <th style={thStyle}>Net (RM)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderDetails.filter(o => shiftFilter === 'all' || resolveShiftLabel(o) === shiftFilter).map((o, i) => {
                          const lbl = resolveShiftLabel(o)
                          const shiftColor = lbl === 'Shift 1' ? S.blue : lbl === 'Shift 2' ? '#8B5CF6' : lbl === 'Shift 3' ? S.green : S.muted
                          const shiftBg = lbl === 'Shift 1' ? 'rgba(59,130,246,0.06)' : lbl === 'Shift 2' ? 'rgba(139,92,246,0.06)' : lbl === 'Shift 3' ? 'rgba(34,197,94,0.06)' : 'transparent'
                          return (
                            <tr key={o.id} onClick={() => setOrderDetailModal(o)} style={{ borderTop: `1px solid ${S.border}`, borderLeft: `3px solid ${shiftColor}`, background: shiftBg, cursor: 'pointer' }}>
                              <td style={tdStyle}>{i + 1}</td>
                              <td style={tdStyle}>{o.tables?.name || o.id?.slice(0, 8) || '—'}</td>
                              <td style={{ ...tdStyle, color: shiftColor, fontWeight: 700 }}>{lbl}</td>
                              <td style={tdStyle}>{fmtTimeMY(o.created_at)}</td>
                              <td style={tdStyle}>{fmtTimeMY(o.paid_at)}</td>
                              <td style={tdStyle}>{o.paid_by_name || '—'}</td>
                              <td style={tdStyle}>{o.payment_method || '—'}{o.card_bank ? ` (${o.card_bank})` : ''}</td>
                              <td style={tdStyle}>{fmtMoney(o.discount_amount || 0)}</td>
                              <td style={{ ...tdStyle, color: S.gold, fontWeight: 700 }}>{fmtMoney(o.total_amount || 0)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', background: S.navy2, borderRadius: 14, border: `1px solid ${S.goldB}`, padding: '14px 20px' }}>
                  {(() => {
                    const filtered = orderDetails.filter(o => shiftFilter === 'all' || resolveShiftLabel(o) === shiftFilter)
                    return (
                      <>
                        <div style={{ color: S.muted, fontSize: 13 }}>Order count: {filtered.length.toLocaleString('en-US')}</div>
                        <div style={{ color: S.gold, fontSize: 16, fontWeight: 800 }}>
                          Total: RM {fmtMoney(round2(filtered.reduce((s, o) => s + (o.total_amount || 0), 0)))}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </>
            )}
          </div>
        ) : view === 'history' ? (
          /* History View */
          <div>
            <h2 style={{ color: S.white, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📋 Report History</h2>
            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>No reports yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reports.map(r => (
                  <div key={r.id} onClick={() => { setForm(p => ({ ...p, report_date: r.report_date })); setView('form') }}
                    style={{ background: S.navy2, borderRadius: 12, padding: '14px 20px', border: `1px solid ${S.border}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: S.white, fontWeight: 700, fontSize: 15 }}>📅 {r.report_date}</div>
                      <div style={{ color: S.muted, fontSize: 12, marginTop: 2 }}>Click to edit</div>
                    </div>
                    <div style={{ color: S.gold, fontWeight: 800, fontSize: 16 }}>MYR {(r.total_amount || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Form View */
          <>
            {/* Date & Branch Selector */}
            <div style={{ background: S.navy2, borderRadius: 14, padding: '16px 20px', marginBottom: 20, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>📅 Report Date:</div>
              <input style={{ ...inp, width: 'auto', fontSize: 15, fontWeight: 700 }} type="date"
                value={form.report_date}
                onChange={e => setForm(p => ({ ...p, report_date: e.target.value }))} />
              <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>🏪 Branch:</div>
              <select style={{ ...inp, width: 'auto', minWidth: 160, borderColor: !branchFilter ? S.red : undefined }}
                value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                <option value="">-- Select Branch --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {existingId && <div style={{ fontSize: 12, color: S.green, fontWeight: 700 }}>✅ Report exists — editing</div>}
              {!existingId && <div style={{ fontSize: 12, color: S.muted }}>New report</div>}
              {liveSync && (
                <div style={{ fontSize: 11, color: S.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: S.green, display: 'inline-block' }} />
                  Live — auto-updating
                </div>
              )}
              {cashiersError && (
                <div style={{ fontSize: 11, color: S.red, fontWeight: 700 }}>
                  ⚠️ Cashier list error: {cashiersError}
                </div>
              )}
              {!cashiersError && branchFilter && cashiers.length === 0 && (
                <div style={{ fontSize: 11, color: S.muted }}>
                  ⚠️ No employees found with role "cashier" for this branch — check the role value
                </div>
              )}
            </div>

            {/* Shifts — كل حاجة هنا تلقائية 100% (كاشير/أوقات/مبيعات/فيزا) ما عدا العهدة والملاحظات وفورمي الإضافة السريعة */}
            <ShiftSection num={1} shift={form.shift1} isMobile={isMobile} branchFilter={branchFilter} form={form} sb={sb} setShift={setShift} onDataChanged={refreshAll} />
            <ShiftSection num={2} shift={form.shift2} isMobile={isMobile} branchFilter={branchFilter} form={form} sb={sb} setShift={setShift} onDataChanged={refreshAll} />
            <ShiftSection num={3} shift={form.shift3} isMobile={isMobile} branchFilter={branchFilter} form={form} sb={sb} setShift={setShift} onDataChanged={refreshAll} />

            {/* Totals */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: 'rgba(201,168,76,0.15)', padding: '12px 20px', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.gold }}>📊 Totals & Summary</div>
              </div>
              <div style={{ padding: isMobile ? 14 : 20, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                {/* Left totals — كلها محسوبة تلقائيًا من النظام (Read-only) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total Sales Report — auto')}<ReadOnlyAmount value={form.total_sales_report} /></div>
                    <div>{label('Total Paid Expenses (RM) — auto')}<ReadOnlyAmount value={form.total_paid_expenses} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total Pending Expenses (RM) — auto')}<ReadOnlyAmount value={form.total_pending_expenses} /></div>
                    <div>{label('Total Visa MAYBANK (RM) — auto')}<ReadOnlyAmount value={form.total_visa_maybank} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total Visa BSN — auto')}<ReadOnlyAmount value={form.total_visa_bsn} /></div>
                    <div>{label('Total KababOnline Banking (RM) — auto')}<ReadOnlyAmount value={form.total_kabab_online} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total G Online Banking (RM) — auto')}<ReadOnlyAmount value={form.total_g_online} /></div>
                    <div>{label('Total Credit — Grab/Foodpanda (RM) — auto')}<ReadOnlyAmount value={form.total_credit} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total Discounts — auto')}<ReadOnlyAmount value={form.total_discounts} /></div>
                  </div>
                  <div>{label('Total Amount (RM)')}
                    <NumInput style={{ ...numInp, color: S.gold, fontWeight: 800, fontSize: 16 }} value={form.total_amount} onChange={v => setForm(p => ({ ...p, total_amount: v }))} placeholder="0.00" />
                  </div>
                </div>

                {/* Right notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>{label('Notes')}
                    <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' } as React.CSSProperties} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes..." />
                  </div>
                  <div>{label('Total Purchased Bills – Shopping (RM) — auto')}
                    <ReadOnlyAmount value={form.total_purchased_bills} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Grab (RM) — auto')}<ReadOnlyAmount value={form.grab} /></div>
                    <div>{label('Foodpanda (RM) — auto')}<ReadOnlyAmount value={form.foodpanda} /></div>
                  </div>
                  <div>{label('Treasurer Name and Signature')}
                    <input style={inp} value={form.treasurer_name} onChange={e => setForm(p => ({ ...p, treasurer_name: e.target.value }))} placeholder="Treasurer name..." />
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ جديد: مفيش زرار حفظ يدوي - التقرير محفوظ أول بأول تلقائيًا (شوف مؤشر الحالة فوق في الهيدر) */}
          </>
        )}
      </div>

      {/* ✅ جديد: مودال تفاصيل الفاتورة - يظهر بمنتصف الشاشة عند الضغط على أي صف في جدول Sales Details */}
      {orderDetailModal && (
        <div onClick={() => setOrderDetailModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 28, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>🧾 Invoice Details</h2>
              <button onClick={() => setOrderDetailModal(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: S.muted }}>
                  {orderDetailModal.tables?.name || `Order #${orderDetailModal.id?.slice(-6).toUpperCase()}`}
                </span>
                <span style={{ background: S.goldB, color: S.gold, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {resolveShiftLabel(orderDetailModal)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 10 }}>
                Opened {fmtDateTimeMY(orderDetailModal.created_at)} · Paid {fmtDateTimeMY(orderDetailModal.paid_at)}
              </div>

              {(orderDetailModal.order_items || []).map((i: any) => (
                <div key={i.id} style={{ padding: '5px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: i.status === 'cancelled' ? S.muted : S.white, textDecoration: i.status === 'cancelled' ? 'line-through' : 'none' }}>
                      {i.menu_items?.or_code && <span style={{ fontWeight: 700, color: S.gold }}>#{i.menu_items.or_code}</span>}
                      <span>{i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item'}{i.size_name ? ` (${i.size_name})` : ''} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
                    </span>
                    <span style={{ color: i.status === 'cancelled' ? S.muted : S.gold, textDecoration: i.status === 'cancelled' ? 'line-through' : 'none' }}>MYR {(i.unit_price * i.quantity).toFixed(2)}</span>
                  </div>
                  {i.notes && <div style={{ fontSize: 11, color: S.gold, marginTop: 2 }}>📝 {i.notes}</div>}
                  {i.status === 'cancelled' && i.cancel_reason && <div style={{ fontSize: 11, color: S.red, marginTop: 2 }}>❌ Cancelled: {i.cancel_reason}</div>}
                </div>
              ))}

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.muted, marginBottom: 4 }}>
                  <span>Subtotal</span>
                  <span>MYR {(orderDetailModal.order_items || []).filter((i: any) => i.status !== 'cancelled').reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0).toFixed(2)}</span>
                </div>
                {orderDetailModal.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.red, marginBottom: 4 }}>
                    <span>Discount {orderDetailModal.discount_type ? `(${orderDetailModal.discount_type})` : ''}</span>
                    <span>- MYR {orderDetailModal.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                {orderDetailModal.service_charge > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.amber, marginBottom: 4 }}>
                    <span>Service Charge</span>
                    <span>MYR {orderDetailModal.service_charge.toFixed(2)}</span>
                  </div>
                )}
                {orderDetailModal.sst_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.teal, marginBottom: 4 }}>
                    <span>SST</span>
                    <span>MYR {orderDetailModal.sst_amount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: S.gold, marginTop: 8 }}>
                  <span>Total</span>
                  <span>MYR {(orderDetailModal.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {orderDetailModal.payment_method && (
                <div style={{ fontSize: 12, color: S.teal, marginTop: 10 }}>
                  {orderDetailModal.payment_method === 'cash' ? '💵' : orderDetailModal.payment_method === 'visa' ? '💳' : orderDetailModal.payment_method === 'credit' ? '🧾' : '📱'} {orderDetailModal.payment_method}
                  {orderDetailModal.card_bank ? ` (${orderDetailModal.card_bank})` : ''}
                </div>
              )}
              {orderDetailModal.paid_by_name && <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>👤 {orderDetailModal.paid_by_name}</div>}
              {orderDetailModal.notes && <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>📝 {orderDetailModal.notes}</div>}
            </div>

            <button onClick={() => setOrderDetailModal(null)} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
