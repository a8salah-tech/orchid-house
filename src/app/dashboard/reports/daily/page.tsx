'use client'

export const dynamic = 'force-dynamic'

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
      if (!form.report_date) return
      const { data } = await sb.from('daily_reports')
        .select('*').eq('report_date', form.report_date).single()
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
  }, [form.report_date, sb])

  function setShift(n: 1 | 2, field: string, val: string) {
    setForm(p => ({ ...p, [`shift${n}`]: { ...p[`shift${n}` as 'shift1' | 'shift2'], [field]: val } }))
  }

  function n(v: string) { return parseFloat(v) || 0 }

  async function saveReport() {
    setSaving(true)
    const payload = {
      report_date: form.report_date,
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
      <h2>ORCHID HOUSE RESTAURANT – Daily Report<br><small>${form.report_date}</small></h2>

      <table>
        <tr>
          <td colspan="4" class="section-header">Shift 1 – Date: ${s.date}</td>
        </tr>
        <tr>
          <td class="label">Cashier Name</td><td>${s.cashier_name}</td>
          <td class="label">Cashier Bills Details</td><td></td>
        </tr>
        <tr>
          <td class="label">Received Balance (RM)</td><td>${s.received_balance}</td>
          <td rowspan="2"><b>Paid:</b><br>${s.bills_paid}</td>
          <td rowspan="2"><b>Pending:</b><br>${s.bills_pending}</td>
        </tr>
        <tr>
          <td class="label">Paid Expenses (RM)</td><td>${s.paid_expenses}</td>
        </tr>
        <tr>
          <td class="label">Pending Expenses (RM)</td><td>${s.pending_expenses}</td>
          <td rowspan="2"><b>Discounts:</b><br>${s.bills_discounts}</td>
          <td rowspan="2"><b>Online:</b><br>${s.bills_online}</td>
        </tr>
        <tr><td class="label">Visa MAYBANK (RM)</td><td>${s.visa_maybank}</td></tr>
        <tr><td class="label">Visa BSN (RM)</td><td>${s.visa_bsn}</td><td colspan="2"></td></tr>
        <tr><td class="label">KababOnline Banking (RM)</td><td>${s.kabab_online}</td><td colspan="2"></td></tr>
        <tr><td class="label">G Online Banking (RM)</td><td>${s.g_online}</td><td colspan="2"></td></tr>
        <tr><td class="label">Discounts (RM)</td><td>${s.discounts}</td><td colspan="2"></td></tr>
        <tr class="total-row"><td class="label">Total Balance (RM)</td><td>${s.total_balance}</td><td colspan="2"></td></tr>
        <tr><td class="label"><b>Manager Note</b></td><td colspan="3">${s.manager_note}</td></tr>
      </table>

      <table>
        <tr><td colspan="4" class="section-header">Shift 2 – Date: ${s2.date}</td></tr>
        <tr>
          <td class="label">Cashier Name</td><td>${s2.cashier_name}</td>
          <td class="label">Cashier Bills Details</td><td></td>
        </tr>
        <tr>
          <td class="label">Received Balance (RM)</td><td>${s2.received_balance}</td>
          <td rowspan="2"><b>Paid:</b><br>${s2.bills_paid}</td>
          <td rowspan="2"><b>Pending:</b><br>${s2.bills_pending}</td>
        </tr>
        <tr><td class="label">Paid Expenses (RM)</td><td>${s2.paid_expenses}</td></tr>
        <tr>
          <td class="label">Pending Expenses (RM)</td><td>${s2.pending_expenses}</td>
          <td rowspan="2"><b>Discounts:</b><br>${s2.bills_discounts}</td>
          <td rowspan="2"><b>Online:</b><br>${s2.bills_online}</td>
        </tr>
        <tr><td class="label">Visa MAYBANK (RM)</td><td>${s2.visa_maybank}</td></tr>
        <tr><td class="label">Visa BSN (RM)</td><td>${s2.visa_bsn}</td><td colspan="2"></td></tr>
        <tr><td class="label">KababOnline Banking (RM)</td><td>${s2.kabab_online}</td><td colspan="2"></td></tr>
        <tr><td class="label">G Online Banking (RM)</td><td>${s2.g_online}</td><td colspan="2"></td></tr>
        <tr><td class="label">Discounts (RM)</td><td>${s2.discounts}</td><td colspan="2"></td></tr>
        <tr class="total-row"><td class="label">Total Balance (RM)</td><td>${s2.total_balance}</td><td colspan="2"></td></tr>
        <tr><td class="label"><b>Manager Note</b></td><td colspan="3">${s2.manager_note}</td></tr>
      </table>

      <table>
        <tr>
          <td class="label">Total Sales Report</td><td>${form.total_sales_report}</td>
          <td class="label">Notes</td><td rowspan="4">${form.notes}</td>
        </tr>
        <tr>
          <td class="label">Total Paid Expenses (RM)</td><td>${form.total_paid_expenses}</td>
          <td class="label">Total Purchased Bills – Shopping (RM)</td>
        </tr>
        <tr>
          <td class="label">Total Pending Expenses (RM)</td><td>${form.total_pending_expenses}</td>
          <td>${form.total_purchased_bills}</td>
        </tr>
        <tr>
          <td class="label">Total Visa MAYBANK (RM)</td><td>${form.total_visa_maybank}</td>
          <td class="label">Grab: ${form.grab} &nbsp;&nbsp; Foodpanda: ${form.foodpanda}</td>
        </tr>
        <tr>
          <td class="label">Total Visa BSN</td><td>${form.total_visa_bsn}</td>
          <td class="label">Treasurer Name and Signature</td>
          <td rowspan="4">${form.treasurer_name}</td>
        </tr>
        <tr><td class="label">Total KababOnline Banking (RM)</td><td>${form.total_kabab_online}</td><td></td></tr>
        <tr><td class="label">Total G Online Banking (RM)</td><td>${form.total_g_online}</td><td></td></tr>
        <tr><td class="label">Total Discounts</td><td>${form.total_discounts}</td><td></td></tr>
        <tr class="total-row"><td class="label">Total amount</td><td>${form.total_amount}</td><td colspan="2"></td></tr>
      </table>

      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`)
    win.document.close()
  }

const label = (text: string) => (
  <label style={{ fontSize: 11, color: '#FAFAF8', display: 'block', marginBottom: 4 }}>{text}</label>
)

  function ShiftSection({ num, shift }: { num: 1 | 2; shift: ReturnType<typeof emptyShift> }) {
    return (
      <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ background: num === 1 ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)', padding: '12px 20px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: num === 1 ? S.blue : '#8B5CF6' }}>
            {num === 1 ? '🌅' : '🌙'} Shift {num}
          </div>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'ltr' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }`}</style>

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ color: S.gold, fontSize: 18, fontWeight: 900 }}>📊 Daily Report</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setView(v => v === 'form' ? 'history' : 'form')}
            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
            {view === 'form' ? '📋 History' : '📝 Form'}
          </button>
          <button onClick={printReport}
            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            🖨️ Print
          </button>
          <button onClick={saveReport} disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Report'}
          </button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

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
            {/* Date Selector */}
            <div style={{ background: S.navy2, borderRadius: 14, padding: '16px 20px', marginBottom: 20, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>📅 Report Date:</div>
              <input style={{ ...inp, width: 'auto', fontSize: 15, fontWeight: 700 }} type="date"
                value={form.report_date}
                onChange={e => setForm(p => ({ ...p, report_date: e.target.value }))} />
              {existingId && <div style={{ fontSize: 12, color: S.green, fontWeight: 700 }}>✅ Report exists — editing</div>}
              {!existingId && <div style={{ fontSize: 12, color: S.muted }}>New report</div>}
            </div>

            {/* Shifts */}
            <ShiftSection num={1} shift={form.shift1} />
            <ShiftSection num={2} shift={form.shift2} />

            {/* Totals */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: 'rgba(201,168,76,0.15)', padding: '12px 20px', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.gold }}>📊 Totals & Summary</div>
              </div>
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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
