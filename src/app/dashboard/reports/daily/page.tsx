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

type ReportSummary = { id: string; report_date: string; total_amount: number }

function emptyShift() {
  return {
    date: '', cashier_name: '', received_balance: '', paid_expenses: '',
    pending_expenses: '', visa_maybank: '', visa_bsn: '', kabab_online: '',
    g_online: '', discounts: '', total_balance: '', manager_note: '',
    bills_paid: '', bills_pending: '', bills_discounts: '', bills_online: '',
  }
}

function emptyForm() {
  return {
    report_date: new Date().toISOString().split('T')[0],
    shift1: emptyShift(),
    shift2: emptyShift(),
    total_sales_report: '', total_paid_expenses: '', total_pending_expenses: '',
    total_visa_maybank: '', total_visa_bsn: '', total_kabab_online: '',
    total_g_online: '', total_discounts: '', total_amount: '',
    notes: '', total_purchased_bills: '', grab: '', foodpanda: '',
    treasurer_name: '',
  }
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
  const [view, setView] = useState<'form' | 'history'>('form')
  // ✅ جديد: الفرع - إجباري، وأساس سحب الأرقام تلقائيًا من النظام
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchFilter, setBranchFilter] = useState('')
  const [pulling, setPulling] = useState<1 | 2 | 'top' | null>(null)

  const [isMobile, setIsMobile] = useState(false)
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

  const fetchReports = useCallback(async () => {
    const { data } = await sb.from('daily_reports')
      .select('id, report_date, total_amount')
      .order('report_date', { ascending: false })
      .limit(30)
    setReports(data || [])
  }, [sb])

  useEffect(() => { fetchReports() }, [fetchReports])

  // لما يغير التاريخ يجيب التقرير لو موجود
  useEffect(() => {
    async function loadReport() {
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
            discounts: data.shift1_discounts?.toString() || '',
            total_balance: data.shift1_total_balance?.toString() || '',
            manager_note: data.shift1_manager_note || '',
            bills_paid: data.shift1_bills_paid || '',
            bills_pending: data.shift1_bills_pending || '',
            bills_discounts: data.shift1_bills_discounts || '',
            bills_online: data.shift1_bills_online || '',
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
            discounts: data.shift2_discounts?.toString() || '',
            total_balance: data.shift2_total_balance?.toString() || '',
            manager_note: data.shift2_manager_note || '',
            bills_paid: data.shift2_bills_paid || '',
            bills_pending: data.shift2_bills_pending || '',
            bills_discounts: data.shift2_bills_discounts || '',
            bills_online: data.shift2_bills_online || '',
          },
          total_sales_report: data.total_sales_report?.toString() || '',
          total_paid_expenses: data.total_paid_expenses?.toString() || '',
          total_pending_expenses: data.total_pending_expenses?.toString() || '',
          total_visa_maybank: data.total_visa_maybank?.toString() || '',
          total_visa_bsn: data.total_visa_bsn?.toString() || '',
          total_kabab_online: data.total_kabab_online?.toString() || '',
          total_g_online: data.total_g_online?.toString() || '',
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
    }
    loadReport()
  }, [form.report_date, branchFilter, sb])

  function setShift(n: 1 | 2, field: string, val: string) {
    setForm(p => ({ ...p, [`shift${n}`]: { ...p[`shift${n}` as 'shift1' | 'shift2'], [field]: val } }))
  }

  function n(v: string) { return parseFloat(v) || 0 }
  // ✅ إصلاح جوهري: تقريب المجاميع لمنع مشكلة الفاصلة العائمة الشهيرة في جافاسكريبت
  // (مثال: 0.1 + 0.2 قد تُنتج 0.30000000000000004 بدلًا من 0.3)
  function round2(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100 }
  // ✅ جديد: تحديد الاسم الأكثر تكرارًا بين مجموعة أوردرات (لمعرفة من كان يمسك الشيفت تلقائيًا)
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

  // ✅ جديد: سحب أرقام الشيفت من بيانات حقيقية (الأوردرات المدفوعة + المصروفات + طلبات التوصيل المسجّلة)
  async function pullShiftFromSystem(num: 1 | 2) {
    if (!branchFilter) { alert('من فضلك اختر الفرع أولاً'); return }
    if (!form.report_date) { alert('من فضلك اختر التاريخ أولاً'); return }
    setPulling(num)
    const shiftKey = `shift${num}`
    const dayStart = `${form.report_date}T00:00:00`
    const dayEnd = `${form.report_date}T23:59:59.999`

    const [ordersRes, expRes, delRes] = await Promise.all([
      sb.from('orders')
        .select('total_amount, discount_amount, payment_method, card_bank, shift, paid_by_name, tables!inner(branch_id)')
        .eq('status', 'paid').eq('shift', shiftKey)
        .eq('tables.branch_id', branchFilter)
        .gte('paid_at', dayStart).lte('paid_at', dayEnd),
      sb.from('daily_cash_expenses').select('amount,status')
        .eq('branch_id', branchFilter).eq('shift', shiftKey).eq('expense_date', form.report_date),
      sb.from('delivery_platform_orders').select('amount,platform')
        .eq('branch_id', branchFilter).eq('shift', shiftKey).eq('order_date', form.report_date),
    ])

    const orders = ordersRes.data || []
    const expenses = expRes.data || []
    const delivery = delRes.data || []

    const salesTotal = round2(orders.reduce((s, o) => s + (o.total_amount || 0), 0))
    const discountsTotal = round2(orders.reduce((s, o) => s + (o.discount_amount || 0), 0))
    const visaMaybank = round2(orders.filter(o => o.payment_method === 'visa' && o.card_bank === 'maybank').reduce((s, o) => s + (o.total_amount || 0), 0))
    const visaBsn = round2(orders.filter(o => o.payment_method === 'visa' && o.card_bank === 'bsn').reduce((s, o) => s + (o.total_amount || 0), 0))
    const kababOnline = round2(delivery.filter(d => d.platform === 'kabab_online').reduce((s, d) => s + (d.amount || 0), 0))
    const gOnline = round2(delivery.filter(d => d.platform === 'g_online').reduce((s, d) => s + (d.amount || 0), 0))
    const paidExpenses = round2(expenses.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0))
    const pendingExpenses = round2(expenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount || 0), 0))
    // ✅ جديد: تحديد اسم الكاشير تلقائيًا من أكثر اسم تكرر في الأوردرات المدفوعة خلال هذا الشيفت
    const detectedCashier = mostFrequentName(orders.map(o => (o as any).paid_by_name))

    setForm(p => ({
      ...p,
      [shiftKey]: {
        ...(p as any)[shiftKey],
        // ✅ نملأ اسم الكاشير تلقائيًا فقط إذا كان الحقل فارغًا، حتى لا نستبدل اسمًا أدخله المستخدم يدويًا
        cashier_name: (p as any)[shiftKey]?.cashier_name || detectedCashier || '',
        paid_expenses: String(paidExpenses),
        pending_expenses: String(pendingExpenses),
        visa_maybank: String(visaMaybank),
        visa_bsn: String(visaBsn),
        kabab_online: String(kababOnline),
        g_online: String(gOnline),
        discounts: String(discountsTotal),
        total_balance: String(salesTotal),
      },
    }))
    setPulling(null)
  }

  // ✅ سحب إجماليات اليوم كله (المستوى العلوي: المبيعات، جراب، فودباندا، فواتير المشتريات)
  async function pullDayTotalsFromSystem() {
    if (!branchFilter) { alert('من فضلك اختر الفرع أولاً'); return }
    if (!form.report_date) { alert('من فضلك اختر التاريخ أولاً'); return }
    setPulling('top')
    const dayStart = `${form.report_date}T00:00:00`
    const dayEnd = `${form.report_date}T23:59:59.999`

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
      total_discounts: String(discountsTotal),
      grab: String(grabTotal),
      foodpanda: String(foodpandaTotal),
      total_purchased_bills: String(purchasesTotal),
    }))
    setPulling(null)
  }

  async function saveReport() {
    if (!branchFilter) { alert('من فضلك اختر الفرع أولاً'); return }
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
      shift1_discounts: n(form.shift1.discounts),
      shift1_total_balance: n(form.shift1.total_balance),
      shift1_manager_note: form.shift1.manager_note || null,
      shift1_bills_paid: form.shift1.bills_paid || null,
      shift1_bills_pending: form.shift1.bills_pending || null,
      shift1_bills_discounts: form.shift1.bills_discounts || null,
      shift1_bills_online: form.shift1.bills_online || null,
      shift2_date: form.shift2.date || null,
      shift2_cashier_name: form.shift2.cashier_name || null,
      shift2_received_balance: n(form.shift2.received_balance),
      shift2_paid_expenses: n(form.shift2.paid_expenses),
      shift2_pending_expenses: n(form.shift2.pending_expenses),
      shift2_visa_maybank: n(form.shift2.visa_maybank),
      shift2_visa_bsn: n(form.shift2.visa_bsn),
      shift2_kabab_online: n(form.shift2.kabab_online),
      shift2_g_online: n(form.shift2.g_online),
      shift2_discounts: n(form.shift2.discounts),
      shift2_total_balance: n(form.shift2.total_balance),
      shift2_manager_note: form.shift2.manager_note || null,
      shift2_bills_paid: form.shift2.bills_paid || null,
      shift2_bills_pending: form.shift2.bills_pending || null,
      shift2_bills_discounts: form.shift2.bills_discounts || null,
      shift2_bills_online: form.shift2.bills_online || null,
      total_sales_report: n(form.total_sales_report),
      total_paid_expenses: n(form.total_paid_expenses),
      total_pending_expenses: n(form.total_pending_expenses),
      total_visa_maybank: n(form.total_visa_maybank),
      total_visa_bsn: n(form.total_visa_bsn),
      total_kabab_online: n(form.total_kabab_online),
      total_g_online: n(form.total_g_online),
      total_discounts: n(form.total_discounts),
      total_amount: n(form.total_amount),
      notes: form.notes || null,
      total_purchased_bills: n(form.total_purchased_bills),
      grab: n(form.grab),
      foodpanda: n(form.foodpanda),
      treasurer_name: form.treasurer_name || null,
      updated_at: new Date().toISOString(),
    }

    if (existingId) {
      await sb.from('daily_reports').update(payload).eq('id', existingId)
    } else {
      const { data } = await sb.from('daily_reports').insert([payload]).select('id').single()
      if (data) setExistingId(data.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    fetchReports()
  }

  function printReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const s = form.shift1
    const s2 = form.shift2
    // ✅ جديد: تنسيق الأرقام بفواصل الآلاف لسهولة القراءة في التقرير المطبوع (مثال: 2,494.52)
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

const label = (text: string) => (
  <label style={{ fontSize: 11, color: '#FAFAF8', display: 'block', marginBottom: 4 }}>{text}</label>
)

  function ShiftSection({ num, shift }: { num: 1 | 2; shift: ReturnType<typeof emptyShift> }) {
    const shiftKey = `shift${num}`
    const [expDesc, setExpDesc] = useState('')
    const [expAmount, setExpAmount] = useState('')
    const [expStatus, setExpStatus] = useState<'paid' | 'pending'>('paid')
    const [expSaving, setExpSaving] = useState(false)

    const [delPlatform, setDelPlatform] = useState<'kabab_online' | 'g_online' | 'grab' | 'foodpanda'>('kabab_online')
    const [delAmount, setDelAmount] = useState('')
    const [delSaving, setDelSaving] = useState(false)

    async function addExpense() {
      if (!branchFilter) { alert('من فضلك اختر الفرع أولاً'); return }
      if (!expDesc.trim() || !(parseFloat(expAmount) > 0)) { alert('من فضلك أدخل الوصف والمبلغ صح'); return }
      if (!shift.cashier_name.trim()) { alert('من فضلك أدخل اسم الكاشير للشيفت ده أولاً'); return }
      setExpSaving(true)
      await sb.from('daily_cash_expenses').insert([{
        branch_id: branchFilter, expense_date: form.report_date, shift: shiftKey,
        cashier_name: shift.cashier_name, description: expDesc.trim(),
        amount: parseFloat(expAmount), status: expStatus,
      }])
      setExpSaving(false)
      setExpDesc(''); setExpAmount('')
      pullShiftFromSystem(num)
    }

    async function addDelivery() {
      if (!branchFilter) { alert('من فضلك اختر الفرع أولاً'); return }
      if (!(parseFloat(delAmount) > 0)) { alert('من فضلك أدخل المبلغ صح'); return }
      if (!shift.cashier_name.trim()) { alert('من فضلك أدخل اسم الكاشير للشيفت ده أولاً'); return }
      setDelSaving(true)
      await sb.from('delivery_platform_orders').insert([{
        branch_id: branchFilter, order_date: form.report_date, shift: shiftKey,
        cashier_name: shift.cashier_name, platform: delPlatform, amount: parseFloat(delAmount),
      }])
      setDelSaving(false)
      setDelAmount('')
      pullShiftFromSystem(num)
    }

    return (
      <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ background: num === 1 ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)', padding: '12px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: num === 1 ? S.blue : '#8B5CF6' }}>
            {num === 1 ? '🌅' : '🌙'} Shift {num}
          </div>
          <button onClick={() => pullShiftFromSystem(num)} disabled={pulling === num}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: pulling === num ? 0.6 : 1 }}>
            {pulling === num ? '⏳ Pulling...' : '🔄 Pull from System'}
          </button>
        </div>
        <div style={{ padding: isMobile ? 14 : 20, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Date')}<input style={inp} type="date" value={shift.date} onChange={e => setShift(num, 'date', e.target.value)} /></div>
              <div>{label('Cashier Name')}<input style={inp} value={shift.cashier_name} onChange={e => setShift(num, 'cashier_name', e.target.value)} placeholder="Name" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Received Balance (RM)')}<input style={numInp} type="number" value={shift.received_balance} onChange={e => setShift(num, 'received_balance', e.target.value)} placeholder="0.00" /></div>
              <div>{label('Paid Expenses (RM)')}<input style={numInp} type="number" value={shift.paid_expenses} onChange={e => setShift(num, 'paid_expenses', e.target.value)} placeholder="0.00" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Pending Expenses (RM)')}<input style={numInp} type="number" value={shift.pending_expenses} onChange={e => setShift(num, 'pending_expenses', e.target.value)} placeholder="0.00" /></div>
              <div>{label('Visa MAYBANK (RM)')}<input style={numInp} type="number" value={shift.visa_maybank} onChange={e => setShift(num, 'visa_maybank', e.target.value)} placeholder="0.00" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Visa BSN (RM)')}<input style={numInp} type="number" value={shift.visa_bsn} onChange={e => setShift(num, 'visa_bsn', e.target.value)} placeholder="0.00" /></div>
              <div>{label('KababOnline Banking (RM)')}<input style={numInp} type="number" value={shift.kabab_online} onChange={e => setShift(num, 'kabab_online', e.target.value)} placeholder="0.00" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('G Online Banking (RM)')}<input style={numInp} type="number" value={shift.g_online} onChange={e => setShift(num, 'g_online', e.target.value)} placeholder="0.00" /></div>
              <div>{label('Discounts (RM)')}<input style={numInp} type="number" value={shift.discounts} onChange={e => setShift(num, 'discounts', e.target.value)} placeholder="0.00" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>{label('Total Balance (RM)')}<input style={{ ...numInp, color: S.gold, fontWeight: 700 }} type="number" value={shift.total_balance} onChange={e => setShift(num, 'total_balance', e.target.value)} placeholder="0.00" /></div>
              <div>{label('Manager Note')}<input style={inp} value={shift.manager_note} onChange={e => setShift(num, 'manager_note', e.target.value)} placeholder="Note..." /></div>
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

        {/* ✅ جديد: إضافة سريعة لمصروف أو طلب توصيل - بيتسجلوا فورًا ويتحسبوا تلقائيًا */}
        <div style={{ padding: isMobile ? '0 14px 14px' : '0 20px 20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={{ background: S.card, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: S.red, marginBottom: 10 }}>💸 إضافة مصروف نقدي</div>
            <input style={{ ...inp, marginBottom: 8 }} placeholder="الوصف" value={expDesc} onChange={e => setExpDesc(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input style={numInp} type="number" placeholder="المبلغ" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
              <select style={inp} value={expStatus} onChange={e => setExpStatus(e.target.value as any)}>
                <option value="paid">مدفوع</option>
                <option value="pending">معلق</option>
              </select>
            </div>
            <button onClick={addExpense} disabled={expSaving}
              style={{ width: '100%', padding: 9, borderRadius: 8, border: 'none', background: S.red, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: expSaving ? 0.6 : 1 }}>
              {expSaving ? '⏳...' : '➕ إضافة المصروف'}
            </button>
          </div>

          <div style={{ background: S.card, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: S.blue, marginBottom: 10 }}>🛵 إضافة طلب توصيل</div>
            <select style={{ ...inp, marginBottom: 8 }} value={delPlatform} onChange={e => setDelPlatform(e.target.value as any)}>
              <option value="kabab_online">Kabab Online</option>
              <option value="g_online">G Online</option>
              <option value="grab">Grab</option>
              <option value="foodpanda">Foodpanda</option>
            </select>
            <input style={{ ...numInp, marginBottom: 8, width: '100%', boxSizing: 'border-box' }} type="number" placeholder="المبلغ" value={delAmount} onChange={e => setDelAmount(e.target.value)} />
            <button onClick={addDelivery} disabled={delSaving}
              style={{ width: '100%', padding: 9, borderRadius: 8, border: 'none', background: S.blue, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: delSaving ? 0.6 : 1 }}>
              {delSaving ? '⏳...' : '➕ إضافة الطلب'}
            </button>
          </div>
        </div>
      </div>
    )
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
          <button onClick={printReport}
            style={{ padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, flex: isMobile ? 1 : undefined }}>
            🖨️ Print
          </button>
          <button onClick={saveReport} disabled={saving}
            style={{ padding: isMobile ? '7px 14px' : '8px 20px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: saving ? 0.7 : 1, flex: isMobile ? 1 : undefined }}>
            {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Report'}
          </button>
        </div>
      </div>

      <div style={{ padding: isMobile ? 14 : 24, maxWidth: 1200, margin: '0 auto' }}>

        {view === 'history' ? (
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
            </div>

            {/* Shifts */}
            <ShiftSection num={1} shift={form.shift1} />
            <ShiftSection num={2} shift={form.shift2} />

            {/* Totals */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: 'rgba(201,168,76,0.15)', padding: '12px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.gold }}>📊 Totals & Summary</div>
                <button onClick={pullDayTotalsFromSystem} disabled={pulling === 'top'}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.gold}`, background: 'rgba(255,255,255,0.06)', color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: pulling === 'top' ? 0.6 : 1 }}>
                  {pulling === 'top' ? '⏳ Pulling...' : '🔄 Pull Day Totals from System'}
                </button>
              </div>
              <div style={{ padding: isMobile ? 14 : 20, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                {/* Left totals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total Sales Report')}<input style={numInp} type="number" value={form.total_sales_report} onChange={e => setForm(p => ({ ...p, total_sales_report: e.target.value }))} placeholder="0.00" /></div>
                    <div>{label('Total Paid Expenses (RM)')}<input style={numInp} type="number" value={form.total_paid_expenses} onChange={e => setForm(p => ({ ...p, total_paid_expenses: e.target.value }))} placeholder="0.00" /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total Pending Expenses (RM)')}<input style={numInp} type="number" value={form.total_pending_expenses} onChange={e => setForm(p => ({ ...p, total_pending_expenses: e.target.value }))} placeholder="0.00" /></div>
                    <div>{label('Total Visa MAYBANK (RM)')}<input style={numInp} type="number" value={form.total_visa_maybank} onChange={e => setForm(p => ({ ...p, total_visa_maybank: e.target.value }))} placeholder="0.00" /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total Visa BSN')}<input style={numInp} type="number" value={form.total_visa_bsn} onChange={e => setForm(p => ({ ...p, total_visa_bsn: e.target.value }))} placeholder="0.00" /></div>
                    <div>{label('Total KababOnline Banking (RM)')}<input style={numInp} type="number" value={form.total_kabab_online} onChange={e => setForm(p => ({ ...p, total_kabab_online: e.target.value }))} placeholder="0.00" /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Total G Online Banking (RM)')}<input style={numInp} type="number" value={form.total_g_online} onChange={e => setForm(p => ({ ...p, total_g_online: e.target.value }))} placeholder="0.00" /></div>
                    <div>{label('Total Discounts')}<input style={numInp} type="number" value={form.total_discounts} onChange={e => setForm(p => ({ ...p, total_discounts: e.target.value }))} placeholder="0.00" /></div>
                  </div>
                  <div>{label('Total Amount (RM)')}
                    <input style={{ ...numInp, color: S.gold, fontWeight: 800, fontSize: 16 }} type="number" value={form.total_amount} onChange={e => setForm(p => ({ ...p, total_amount: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>

                {/* Right notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>{label('Notes')}
                    <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' } as React.CSSProperties} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes..." />
                  </div>
                  <div>{label('Total Purchased Bills – Shopping (RM)')}
                    <input style={numInp} type="number" value={form.total_purchased_bills} onChange={e => setForm(p => ({ ...p, total_purchased_bills: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>{label('Grab (RM)')}<input style={numInp} type="number" value={form.grab} onChange={e => setForm(p => ({ ...p, grab: e.target.value }))} placeholder="0.00" /></div>
                    <div>{label('Foodpanda (RM)')}<input style={numInp} type="number" value={form.foodpanda} onChange={e => setForm(p => ({ ...p, foodpanda: e.target.value }))} placeholder="0.00" /></div>
                  </div>
                  <div>{label('Treasurer Name and Signature')}
                    <input style={inp} value={form.treasurer_name} onChange={e => setForm(p => ({ ...p, treasurer_name: e.target.value }))} placeholder="Treasurer name..." />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button onClick={saveReport} disabled={saving}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${S.gold}`, background: saved ? S.greenB : S.gold3, color: saved ? S.green : S.gold, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: saving ? 0.7 : 1, transition: 'all .2s' }}>
              {saving ? '⏳ Saving...' : saved ? '✅ Report Saved Successfully!' : '💾 Save Report'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
