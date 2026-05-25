'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.07)',
}

function fmt(n: number) {
  return 'MYR ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(part: number, total: number) {
  if (!total) return '0.0%'
  return ((part / total) * 100).toFixed(1) + '%'
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

type PLData = {
  // Revenue
  gross_sales: number
  discount_total: number
  net_sales: number
  service_charge: number
  sst: number
  total_revenue: number
  // COGS
  purchases: number
  cogs_pct: number
  // Gross Profit
  gross_profit: number
  gross_margin: number
  // Operating Expenses
  payroll: number
  // Net
  net_profit: number
  net_margin: number
  // Extra
  orders_count: number
  avg_order: number
  paid_orders: number
  free_orders: number
  cash_sales: number
  visa_sales: number
  online_sales: number
}

export default function PLReportPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<PLData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPL = useCallback(async () => {
    setLoading(true)

    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    const [ordersRes, purchasesRes, payrollRes] = await Promise.all([
      sb.from('orders')
        .select('total_amount,discount_amount,service_charge,sst_amount,payment_method,status')
        .eq('status', 'paid')
        .gte('paid_at', startDate)
        .lte('paid_at', endDate + 'T23:59:59'),
      sb.from('purchase_invoices')
        .select('total_amount')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate),
      sb.from('payroll_records')
        .select('amount_due, payroll_months!inner(month, year)')
        .eq('payroll_months.month', month)
        .eq('payroll_months.year', year),
    ])

    const orders = ordersRes.data || []
    const purchases = purchasesRes.data || []
    const payrollRecs = payrollRes.data || []

    // Revenue calculations
    const paid_orders = orders.filter(o => o.payment_method !== 'free').length
    const free_orders = orders.filter(o => o.payment_method === 'free').length
    const gross_sales = orders.reduce((s, o) => {
      const sub = (o.total_amount || 0) - (o.service_charge || 0) - (o.sst_amount || 0) + (o.discount_amount || 0)
      return s + sub
    }, 0)
    const discount_total = orders.reduce((s, o) => s + (o.discount_amount || 0), 0)
    const net_sales = gross_sales - discount_total
    const service_charge = orders.reduce((s, o) => s + (o.service_charge || 0), 0)
    const sst = orders.reduce((s, o) => s + (o.sst_amount || 0), 0)
    const total_revenue = net_sales + service_charge + sst
    const cash_sales = orders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount || 0), 0)
    const visa_sales = orders.filter(o => o.payment_method === 'visa').reduce((s, o) => s + (o.total_amount || 0), 0)
    const online_sales = orders.filter(o => o.payment_method === 'online').reduce((s, o) => s + (o.total_amount || 0), 0)

    // COGS
    const purchasesTotal = purchases.reduce((s, p) => s + (p.total_amount || 0), 0)
    const cogs_pct = total_revenue > 0 ? (purchasesTotal / total_revenue) * 100 : 0

    // Gross Profit
    const gross_profit = total_revenue - purchasesTotal
    const gross_margin = total_revenue > 0 ? (gross_profit / total_revenue) * 100 : 0

    // Payroll
    const payroll = payrollRecs.reduce((s: number, p: any) => s + (p.amount_due || 0), 0)

    // Net Profit
    const net_profit = gross_profit - payroll
    const net_margin = total_revenue > 0 ? (net_profit / total_revenue) * 100 : 0

    const orders_count = orders.length
    const avg_order = paid_orders > 0 ? total_revenue / paid_orders : 0

    setData({
      gross_sales, discount_total, net_sales, service_charge, sst, total_revenue,
      purchases: purchasesTotal, cogs_pct, gross_profit, gross_margin,
      payroll, net_profit, net_margin,
      orders_count, avg_order, paid_orders, free_orders,
      cash_sales, visa_sales, online_sales,
    })
    setLoading(false)
  }, [sb, month, year])

  useEffect(() => { fetchPL() }, [fetchPL])

  function printReport() {
    if (!data) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>P&L Report — ${MONTHS[month-1]} ${year}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; direction: ltr; }
      h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
      h3 { text-align: center; font-size: 13px; color: #555; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #0A1628; color: #C9A84C; padding: 8px 12px; text-align: left; font-size: 11px; }
      td { padding: 7px 12px; border-bottom: 1px solid #eee; }
      .section { background: #f5f5f5; font-weight: bold; }
      .total { background: #0A1628; color: #fff; font-weight: bold; font-size: 13px; }
      .profit { background: #22C55E; color: #fff; font-weight: bold; font-size: 14px; }
      .loss { background: #EF4444; color: #fff; font-weight: bold; font-size: 14px; }
      .right { text-align: right; }
      @media print { @page { size: A4; margin: 15mm; } }
    </style></head><body>
    <h1>🌸 Orchid Group — Profit & Loss Statement</h1>
    <h3>${MONTHS[month-1]} ${year}</h3>
    <table>
      <tr class="section"><td colspan="3">REVENUE</td></tr>
      <tr><td>Gross Sales</td><td class="right">${fmt(data.gross_sales)}</td><td class="right">100.0%</td></tr>
      <tr><td>Less: Discounts</td><td class="right">(${fmt(data.discount_total)})</td><td class="right">${pct(data.discount_total, data.gross_sales)}</td></tr>
      <tr><td>Net Sales</td><td class="right">${fmt(data.net_sales)}</td><td></td></tr>
      <tr><td>Service Charge (10%)</td><td class="right">${fmt(data.service_charge)}</td><td></td></tr>
      <tr><td>SST (6%)</td><td class="right">${fmt(data.sst)}</td><td></td></tr>
      <tr class="total"><td>TOTAL REVENUE</td><td class="right">${fmt(data.total_revenue)}</td><td class="right">100%</td></tr>
      <tr><td colspan="3"></td></tr>
      <tr class="section"><td colspan="3">COST OF GOODS SOLD (COGS)</td></tr>
      <tr><td>Purchases / Raw Materials</td><td class="right">(${fmt(data.purchases)})</td><td class="right">${pct(data.purchases, data.total_revenue)}</td></tr>
      <tr class="total"><td>GROSS PROFIT</td><td class="right">${fmt(data.gross_profit)}</td><td class="right">${data.gross_margin.toFixed(1)}%</td></tr>
      <tr><td colspan="3"></td></tr>
      <tr class="section"><td colspan="3">OPERATING EXPENSES</td></tr>
      <tr><td>Payroll & Salaries</td><td class="right">(${fmt(data.payroll)})</td><td class="right">${pct(data.payroll, data.total_revenue)}</td></tr>
      <tr class="${data.net_profit >= 0 ? 'profit' : 'loss'}"><td>NET PROFIT / (LOSS)</td><td class="right">${data.net_profit >= 0 ? fmt(data.net_profit) : '(' + fmt(Math.abs(data.net_profit)) + ')'}</td><td class="right">${data.net_margin.toFixed(1)}%</td></tr>
    </table>
    <table>
      <tr class="section"><td colspan="2">OPERATIONAL SUMMARY</td></tr>
      <tr><td>Total Orders</td><td class="right">${data.orders_count}</td></tr>
      <tr><td>Paid Orders</td><td class="right">${data.paid_orders}</td></tr>
      <tr><td>Complimentary</td><td class="right">${data.free_orders}</td></tr>
      <tr><td>Average Order Value</td><td class="right">${fmt(data.avg_order)}</td></tr>
      <tr><td>Cash Sales</td><td class="right">${fmt(data.cash_sales)}</td></tr>
      <tr><td>Visa/Card Sales</td><td class="right">${fmt(data.visa_sales)}</td></tr>
      <tr><td>Online Sales</td><td class="right">${fmt(data.online_sales)}</td></tr>
    </table>
    <p style="text-align:center;font-size:10px;color:#999;margin-top:20px">Generated by Orchid Group RMS · ${new Date().toLocaleString('en-GB')}</p>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white, direction: 'rtl' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>📉 تقرير الأرباح والخسائر</h1>
          <p style={{ fontSize: 13, color: S.muted }}>Profit & Loss Statement</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={month} onChange={e => setMonth(+e.target.value)}
            style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '8px 14px', color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '8px 14px', color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={printReport} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ طباعة</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : !data ? null : (
        <>
          {/* Period */}
          <div style={{ background: S.gold3, border: `1px solid ${S.gold}40`, borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📅</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: S.gold }}>{MONTHS[month-1]} {year}</span>
            <span style={{ fontSize: 12, color: S.muted, marginRight: 'auto' }}>Profit & Loss Statement</span>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'إجمالي الإيرادات', label_en: 'Total Revenue', value: fmt(data.total_revenue), color: S.gold, bg: S.gold3, icon: '💰' },
              { label: 'إجمالي الربح', label_en: 'Gross Profit', value: fmt(data.gross_profit), color: data.gross_profit >= 0 ? S.green : S.red, bg: data.gross_profit >= 0 ? S.greenB : S.redB, icon: '📊' },
              { label: 'صافي الربح', label_en: 'Net Profit', value: fmt(data.net_profit), color: data.net_profit >= 0 ? S.green : S.red, bg: data.net_profit >= 0 ? S.greenB : S.redB, icon: data.net_profit >= 0 ? '✅' : '❌' },
              { label: 'هامش الربح الصافي', label_en: 'Net Margin', value: data.net_margin.toFixed(1) + '%', color: data.net_margin >= 15 ? S.green : data.net_margin >= 5 ? S.amber : S.red, bg: data.net_margin >= 15 ? S.greenB : data.net_margin >= 5 ? S.amberB : S.redB, icon: '📈' },
              { label: 'عدد الطلبات', label_en: 'Orders', value: data.orders_count.toString(), color: S.blue, bg: S.blueB, icon: '🧾' },
              { label: 'متوسط الفاتورة', label_en: 'Avg Order', value: fmt(data.avg_order), color: S.purple, bg: S.purpleB, icon: '🎯' },
            ].map((k, i) => (
              <div key={i} style={{ background: k.bg, border: `1px solid ${k.color}30`, borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: k.color, marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.white }}>{k.label}</div>
                <div style={{ fontSize: 10, color: S.muted }}>{k.label_en}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* P&L Statement */}
            <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, background: S.navy3 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>📋 قائمة الدخل</div>
                <div style={{ fontSize: 11, color: S.muted }}>Income Statement</div>
              </div>

              {/* Revenue Section */}
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, background: 'rgba(201,168,76,0.05)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: S.gold, letterSpacing: 1, marginBottom: 10 }}>REVENUE — الإيرادات</div>
                {[
                  { label: 'المبيعات الإجمالية', en: 'Gross Sales', value: data.gross_sales, color: S.white },
                  { label: 'الخصومات', en: 'Discounts', value: -data.discount_total, color: S.red },
                  { label: 'صافي المبيعات', en: 'Net Sales', value: data.net_sales, color: S.white, bold: true },
                  { label: 'رسوم الخدمة 10%', en: 'Service Charge', value: data.service_charge, color: S.muted },
                  { label: 'SST 6%', en: 'SST', value: data.sst, color: S.muted },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 4 ? `1px solid ${S.border}` : 'none' }}>
                    <div>
                      <div style={{ fontSize: 12, color: r.color, fontWeight: r.bold ? 700 : 400 }}>{r.label}</div>
                      <div style={{ fontSize: 10, color: S.muted }}>{r.en}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: r.bold ? 800 : 400, color: r.value < 0 ? S.red : r.color }}>
                      {r.value < 0 ? `(${fmt(Math.abs(r.value))})` : fmt(r.value)}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 6, borderTop: `2px solid ${S.gold}40` }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: S.gold }}>إجمالي الإيرادات / Total Revenue</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: S.gold }}>{fmt(data.total_revenue)}</div>
                </div>
              </div>

              {/* COGS Section */}
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, background: 'rgba(239,68,68,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: S.red, letterSpacing: 1, marginBottom: 10 }}>COGS — تكلفة البضاعة المباعة</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                  <div>
                    <div style={{ fontSize: 12, color: S.white }}>المشتريات / المواد الخام</div>
                    <div style={{ fontSize: 10, color: S.muted }}>Purchases / Raw Materials</div>
                  </div>
                  <div style={{ fontSize: 13, color: S.red }}>({fmt(data.purchases)})</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 6, borderTop: `2px solid ${S.green}40` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: data.gross_profit >= 0 ? S.green : S.red }}>إجمالي الربح / Gross Profit</div>
                    <div style={{ fontSize: 10, color: S.muted }}>هامش {data.gross_margin.toFixed(1)}%</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: data.gross_profit >= 0 ? S.green : S.red }}>{fmt(data.gross_profit)}</div>
                </div>
              </div>

              {/* OpEx Section */}
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, background: 'rgba(239,68,68,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: S.amber, letterSpacing: 1, marginBottom: 10 }}>OPERATING EXPENSES — مصاريف التشغيل</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                  <div>
                    <div style={{ fontSize: 12, color: S.white }}>الرواتب والأجور</div>
                    <div style={{ fontSize: 10, color: S.muted }}>Payroll & Salaries</div>
                  </div>
                  <div style={{ fontSize: 13, color: S.amber }}>({fmt(data.payroll)})</div>
                </div>
              </div>

              {/* Net Profit */}
              <div style={{ padding: '18px 20px', background: data.net_profit >= 0 ? S.greenB : S.redB }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: data.net_profit >= 0 ? S.green : S.red }}>
                      {data.net_profit >= 0 ? '✅ صافي الربح' : '❌ صافي الخسارة'}
                    </div>
                    <div style={{ fontSize: 11, color: S.muted }}>Net {data.net_profit >= 0 ? 'Profit' : 'Loss'} · {data.net_margin.toFixed(1)}% margin</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: data.net_profit >= 0 ? S.green : S.red }}>
                    {data.net_profit >= 0 ? fmt(data.net_profit) : `(${fmt(Math.abs(data.net_profit))})`}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Payment Breakdown */}
              <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, background: S.navy3 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: S.white }}>💳 تفصيل طرق الدفع</div>
                </div>
                <div style={{ padding: '14px 20px' }}>
                  {[
                    { label: 'نقدي', en: 'Cash', value: data.cash_sales, color: S.green, icon: '💵' },
                    { label: 'فيزا / بطاقة', en: 'Visa / Card', value: data.visa_sales, color: S.blue, icon: '💳' },
                    { label: 'أونلاين', en: 'Online', value: data.online_sales, color: S.purple, icon: '📱' },
                  ].map((p, i) => {
                    const pctVal = data.total_revenue > 0 ? (p.value / data.total_revenue) * 100 : 0
                    return (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: S.white }}>{p.icon} {p.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{fmt(p.value)}</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 20, height: 8 }}>
                          <div style={{ width: `${pctVal}%`, height: '100%', background: p.color, borderRadius: 20, transition: 'width 1s ease' }} />
                        </div>
                        <div style={{ fontSize: 10, color: S.muted, marginTop: 3 }}>{pctVal.toFixed(1)}% من الإيرادات</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Order Summary */}
              <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, background: S.navy3 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: S.white }}>📊 ملخص الطلبات</div>
                </div>
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'إجمالي الطلبات', en: 'Total Orders', value: data.orders_count, color: S.white },
                    { label: 'طلبات مدفوعة', en: 'Paid Orders', value: data.paid_orders, color: S.green },
                    { label: 'مجانية / ضيافة', en: 'Complimentary', value: data.free_orders, color: S.amber },
                    { label: 'متوسط الفاتورة', en: 'Avg Order Value', value: fmt(data.avg_order), color: S.gold },
                    { label: 'إجمالي الخصومات', en: 'Total Discounts', value: fmt(data.discount_total), color: S.red },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${S.border}` : 'none' }}>
                      <div>
                        <div style={{ fontSize: 12, color: S.white }}>{r.label}</div>
                        <div style={{ fontSize: 10, color: S.muted }}>{r.en}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Analysis */}
              <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '18px 20px' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: S.white, marginBottom: 14 }}>🎯 تحليل التكاليف</div>
                {[
                  { label: 'نسبة تكلفة المواد', value: data.cogs_pct, target: 35, unit: '%' },
                  { label: 'نسبة تكلفة العمالة', value: data.total_revenue > 0 ? (data.payroll / data.total_revenue) * 100 : 0, target: 30, unit: '%' },
                  { label: 'هامش الربح الإجمالي', value: data.gross_margin, target: 65, unit: '%', higher: true },
                  { label: 'هامش الربح الصافي', value: data.net_margin, target: 15, unit: '%', higher: true },
                ].map((r, i) => {
                  const good = r.higher ? r.value >= r.target : r.value <= r.target
                  return (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: S.muted }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: good ? S.green : r.value === 0 ? S.muted : S.red }}>{r.value.toFixed(1)}{r.unit}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 20, height: 6 }}>
                        <div style={{ width: `${Math.min(r.value, 100)}%`, height: '100%', background: good ? S.green : S.red, borderRadius: 20 }} />
                      </div>
                      <div style={{ fontSize: 9, color: S.muted, marginTop: 2 }}>المستهدف: {r.target}{r.unit}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
