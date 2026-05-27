'use client'


import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
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
  card: 'rgba(255,255,255,0.04)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

function formatMYR(n: number) {
  return 'MYR ' + new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

function Card({ title, value, sub, icon, color, bg }: any) {
  return (
    <div style={{ background: bg, borderRadius: 16, border: `1px solid ${color}30`, padding: '18px 20px' }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: S.muted }}>{sub}</div>}
    </div>
  )
}

export default function MonthlyReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<any>({})

  useEffect(() => { fetchReport() }, [month, year])

  async function fetchReport() {
    setLoading(true)

    const monthStart = `${year}-${String(month+1).padStart(2,'0')}-01`
    const daysInMonth = new Date(year, month+1, 0).getDate()
    const monthEnd = `${year}-${String(month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`
    const monthEndTime = `${monthEnd}T23:59:59`

    const [
      employees,
      purchases,
      branchRequests,
      menuItems,
      warehouseProducts,
      shiftSchedules,
      shiftRequests,
      empRequests,
    ] = await Promise.all([
      supabase.from('employees').select('id,name,role,department,is_active,join_date,branches(name)'),
      supabase.from('purchase_invoices').select('*,purchase_invoice_items(*)').gte('invoice_date', monthStart).lte('invoice_date', monthEnd),
      supabase.from('branch_requests').select('*,branches(name),branch_request_items(*)').gte('created_at', monthStart+'T00:00:00').lte('created_at', monthEndTime),
      supabase.from('menu_items').select('id,name,category_id,is_available,price,menu_categories(name)').eq('is_active', true),
      supabase.from('warehouse_products').select('id,name,category,current_stock,min_stock,last_purchase_price,units(symbol)').eq('is_active', true),
      supabase.from('shift_schedules').select('employee_id,date,shifts(name,color)').gte('date', monthStart).lte('date', monthEnd),
      supabase.from('shift_requests').select('*,employees(name,department),shifts(name)').gte('created_at', monthStart+'T00:00:00').lte('created_at', monthEndTime),
      supabase.from('employee_requests').select('*,employees(name,department)').gte('created_at', monthStart+'T00:00:00').lte('created_at', monthEndTime),
    ])

    const empsData = employees.data || []
    const purchasesData = purchases.data || []
    const branchReqData = branchRequests.data || []
    const menuData = menuItems.data || []
    const warehouseData = warehouseProducts.data || []
    const schedulesData = shiftSchedules.data || []
    const shiftReqData = shiftRequests.data || []
    const empReqData = empRequests.data || []

    // إحصائيات المشتريات
    const totalPurchases = purchasesData.reduce((s, inv) => s + (inv.total_amount || 0), 0)
    const avgPurchasePerInvoice = purchasesData.length ? totalPurchases / purchasesData.length : 0

    // المشتريات بالمورد
    const bySupplier: Record<string, { count: number; total: number }> = {}
    purchasesData.forEach(inv => {
      const sup = inv.supplier_name || 'غير محدد'
      if (!bySupplier[sup]) bySupplier[sup] = { count: 0, total: 0 }
      bySupplier[sup].count++
      bySupplier[sup].total += inv.total_amount || 0
    })
    const topSuppliers = Object.entries(bySupplier).sort((a, b) => b[1].total - a[1].total).slice(0, 5)

    // المشتريات اليومية
    const dailyPurchases: Record<string, number> = {}
    purchasesData.forEach(inv => {
      const d = inv.invoice_date?.slice(0, 10) || ''
      dailyPurchases[d] = (dailyPurchases[d] || 0) + (inv.total_amount || 0)
    })

    // الموظفون
    const activeEmps = empsData.filter(e => e.is_active)
    const newEmps = empsData.filter(e => {
      if (!e.join_date) return false
      return e.join_date >= monthStart && e.join_date <= monthEnd
    })

    // الشيفتات
    const totalShifts = schedulesData.length
    const uniqueShiftEmps = new Set(schedulesData.map(s => s.employee_id)).size
    const shiftsByType: Record<string, number> = {}
    schedulesData.forEach((s: any) => {
      const name = s.shifts?.name || 'غير محدد'
      shiftsByType[name] = (shiftsByType[name] || 0) + 1
    })

    // المخزون
    const lowStock = warehouseData.filter(p => (p.current_stock || 0) <= (p.min_stock || 0) && (p.min_stock || 0) > 0)
    const totalInventoryValue = warehouseData.reduce((s, p) => s + ((p.current_stock || 0) * (p.last_purchase_price || 0)), 0)

    // طلبات الفروع
    const branchReqByStatus = { pending: 0, approved: 0, rejected: 0 }
    branchReqData.forEach(r => { branchReqByStatus[r.status as keyof typeof branchReqByStatus]++ })
    const branchReqByBranch: Record<string, number> = {}
    branchReqData.forEach(r => {
      const b = r.branches?.name || 'غير محدد'
      branchReqByBranch[b] = (branchReqByBranch[b] || 0) + 1
    })

    // طلبات الموظفين
    const empReqByType: Record<string, number> = {}
    empReqData.forEach(r => {
      const t = r.title || r.request_type || 'أخرى'
      empReqByType[t] = (empReqByType[t] || 0) + 1
    })

    setReport({
      month, year, monthStart, monthEnd, daysInMonth,
      employees: { total: empsData.length, active: activeEmps.length, new: newEmps.length, data: newEmps },
      purchases: { total: totalPurchases, count: purchasesData.length, avg: avgPurchasePerInvoice, topSuppliers, dailyPurchases, data: purchasesData },
      branchRequests: { total: branchReqData.length, byStatus: branchReqByStatus, byBranch: branchReqByBranch, data: branchReqData },
      menu: { total: menuData.length, available: menuData.filter(i => i.is_available).length },
      warehouse: { total: warehouseData.length, lowStock: lowStock.length, lowStockItems: lowStock, inventoryValue: totalInventoryValue },
      shifts: { total: totalShifts, uniqueEmps: uniqueShiftEmps, byType: shiftsByType },
      shiftRequests: { total: shiftReqData.length, pending: shiftReqData.filter(r => r.status === 'pending').length, data: shiftReqData },
      empRequests: { total: empReqData.length, pending: empReqData.filter(r => r.status === 'pending').length, byType: empReqByType, data: empReqData },
    })
    setLoading(false)
  }

  function printReport() {
    const monthLabel = `${MONTHS_AR[month]} ${year}`
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>التقرير الشهري — ${monthLabel}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
      body{font-family:'Tajawal',Arial,sans-serif;margin:20px;color:#1a1a1a;direction:rtl}
      .header{text-align:center;padding:20px;background:#0F2040;border-radius:8px;margin-bottom:16px;color:white}
      h1{color:#C9A84C;font-size:20px;margin:0 0 4px}
      .subtitle{color:#8A9BB5;font-size:13px}
      .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
      .stat{border:1px solid #ddd;border-radius:8px;padding:12px;text-align:center}
      .sv{font-size:20px;font-weight:800;color:#C9A84C}
      .sl{font-size:11px;color:#666;margin-top:2px}
      .section{margin-bottom:20px;page-break-inside:avoid}
      .section-title{font-size:14px;font-weight:800;color:#0F2040;border-bottom:2px solid #C9A84C;padding-bottom:6px;margin-bottom:10px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#0F2040;color:white;padding:8px 10px;text-align:right;font-size:11px}
      td{padding:6px 10px;border-bottom:1px solid #eee}
      tr:nth-child(even){background:#f9f9f9}
      .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
      .green{background:#dcfce7;color:#16a34a}
      .red{background:#fee2e2;color:#dc2626}
      .amber{background:#fef3c7;color:#92400e}
      @media print{button{display:none}}
    </style></head><body>
    <div class="header"><div style="font-size:28px;margin-bottom:6px">🌸</div>
    <h1>Orchid House — التقرير الشهري</h1><div class="subtitle">${monthLabel} • ${report.daysInMonth} يوم</div></div>

    <div class="stats">
      <div class="stat"><div class="sv">MYR ${(report.purchases?.total||0).toFixed(0)}</div><div class="sl">إجمالي المشتريات</div></div>
      <div class="stat"><div class="sv">${report.employees?.active||0}</div><div class="sl">الموظفون النشطون</div></div>
      <div class="stat"><div class="sv">${report.shifts?.total||0}</div><div class="sl">إجمالي الشيفتات</div></div>
      <div class="stat"><div class="sv" style="color:${(report.warehouse?.lowStock||0)>0?'#dc2626':'#16a34a'}">${report.warehouse?.lowStock||0}</div><div class="sl">مخزون منخفض</div></div>
    </div>

    <div class="section"><div class="section-title">🛒 ملخص المشتريات</div>
    <div class="stats" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat"><div class="sv">MYR ${(report.purchases?.total||0).toFixed(2)}</div><div class="sl">الإجمالي</div></div>
      <div class="stat"><div class="sv">${report.purchases?.count||0}</div><div class="sl">عدد الفواتير</div></div>
      <div class="stat"><div class="sv">MYR ${(report.purchases?.avg||0).toFixed(2)}</div><div class="sl">متوسط الفاتورة</div></div>
    </div>
    ${report.purchases?.topSuppliers?.length > 0 ? `
    <table><thead><tr><th>المورد</th><th>عدد الفواتير</th><th>الإجمالي</th></tr></thead><tbody>
    ${report.purchases.topSuppliers.map(([name, d]: any) => `<tr><td>${name}</td><td>${d.count}</td><td>MYR ${d.total.toFixed(2)}</td></tr>`).join('')}
    </tbody></table>` : '<p style="color:#666;font-size:12px">لا توجد مشتريات هذا الشهر</p>'}
    </div>

    <div class="section"><div class="section-title">🕐 الشيفتات</div>
    <div class="stats" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat"><div class="sv">${report.shifts?.total||0}</div><div class="sl">إجمالي الشيفتات</div></div>
      <div class="stat"><div class="sv">${report.shifts?.uniqueEmps||0}</div><div class="sl">موظف مجدول</div></div>
    </div>
    ${Object.entries(report.shifts?.byType||{}).length > 0 ? `
    <table><thead><tr><th>نوع الشيفت</th><th>عدد المرات</th></tr></thead><tbody>
    ${Object.entries(report.shifts?.byType||{}).map(([name, count]) => `<tr><td>${name}</td><td>${count}</td></tr>`).join('')}
    </tbody></table>` : ''}
    </div>

    <div class="section"><div class="section-title">📦 طلبات الفروع</div>
    <div class="stats" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat"><div class="sv">${report.branchRequests?.total||0}</div><div class="sl">الإجمالي</div></div>
      <div class="stat"><div class="sv" style="color:#16a34a">${report.branchRequests?.byStatus?.approved||0}</div><div class="sl">موافق</div></div>
      <div class="stat"><div class="sv" style="color:#92400e">${report.branchRequests?.byStatus?.pending||0}</div><div class="sl">معلق</div></div>
    </div>
    ${Object.entries(report.branchRequests?.byBranch||{}).length > 0 ? `
    <table><thead><tr><th>الفرع</th><th>عدد الطلبات</th></tr></thead><tbody>
    ${Object.entries(report.branchRequests?.byBranch||{}).map(([name, count]) => `<tr><td>${name}</td><td>${count}</td></tr>`).join('')}
    </tbody></table>` : ''}
    </div>

    <div class="section"><div class="section-title">📋 طلبات الموظفين</div>
    ${Object.entries(report.empRequests?.byType||{}).length > 0 ? `
    <table><thead><tr><th>نوع الطلب</th><th>العدد</th></tr></thead><tbody>
    ${Object.entries(report.empRequests?.byType||{}).map(([name, count]) => `<tr><td>${name}</td><td>${count}</td></tr>`).join('')}
    </tbody></table>` : '<p style="color:#666;font-size:12px">لا توجد طلبات هذا الشهر</p>'}
    </div>

    ${report.warehouse?.lowStock > 0 ? `
    <div class="section"><div class="section-title">⚠️ المخزون المنخفض</div>
    <table><thead><tr><th>الصنف</th><th>القسم</th><th>الكمية</th><th>الحد الأدنى</th></tr></thead><tbody>
    ${report.warehouse.lowStockItems.map((p: any) => `<tr><td style="color:#dc2626;font-weight:600">${p.name}</td><td>${p.category||''}</td><td style="color:#dc2626;font-weight:700">${p.current_stock||0}</td><td>${p.min_stock||0}</td></tr>`).join('')}
    </tbody></table></div>` : ''}

    <div style="text-align:center;color:#999;font-size:10px;margin-top:20px">
      🌸 Orchid Group Restaurant Management System — ${new Date().toLocaleDateString('ar-SA')}
    </div></body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📈 التقرير الشهري</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{MONTHS_AR[month]} {year} — {report.daysInMonth || 30} يوم</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
            {MONTHS_AR.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchReport} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            🔄 تحديث
          </button>
          <button onClick={printReport} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            🖨️ طباعة
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: S.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 16 }}>جاري تحميل التقرير...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ══ الإحصائيات السريعة ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            <Card title="إجمالي المشتريات" value={formatMYR(report.purchases?.total)} icon="🛒" color={S.purple} bg={S.purpleB} sub={`${report.purchases?.count || 0} فاتورة`} />
            <Card title="متوسط الفاتورة" value={formatMYR(report.purchases?.avg)} icon="💰" color={S.gold} bg={S.gold3} />
            <Card title="الموظفون النشطون" value={report.employees?.active} icon="👷" color={S.blue} bg={S.blueB} sub={`${report.employees?.new || 0} جديد هذا الشهر`} />
            <Card title="إجمالي الشيفتات" value={report.shifts?.total} icon="🕐" color={S.teal} bg={S.tealB} sub={`${report.shifts?.uniqueEmps || 0} موظف مجدول`} />
            <Card title="طلبات الفروع" value={report.branchRequests?.total} icon="📦" color={S.green} bg={S.greenB} sub={`${report.branchRequests?.byStatus?.pending || 0} معلق`} />
            <Card title="طلبات الموظفين" value={report.empRequests?.total} icon="📋" color={S.amber} bg={S.amberB} sub={`${report.empRequests?.pending || 0} معلق`} />
            <Card title="قيمة المخزون" value={formatMYR(report.warehouse?.inventoryValue)} icon="🏭" color={S.teal} bg={S.tealB} />
            <Card title="مخزون منخفض" value={report.warehouse?.lowStock} icon="⚠️" color={report.warehouse?.lowStock > 0 ? S.red : S.green} bg={report.warehouse?.lowStock > 0 ? S.redB : S.greenB} />
          </div>

          {/* ══ المشتريات ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* أكبر الموردين */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>🏆 أكبر الموردين</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>حسب إجمالي المشتريات</div>
              </div>
              {report.purchases?.topSuppliers?.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: S.muted, fontSize: 13 }}>لا توجد مشتريات هذا الشهر</div>
              ) : (
                <div style={{ padding: '12px 0' }}>
                  {report.purchases?.topSuppliers?.map(([name, data]: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: `1px solid ${S.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.gold3, border: `1px solid ${S.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: S.gold }}>{i+1}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{name}</div>
                          <div style={{ fontSize: 11, color: S.muted }}>{data.count} فاتورة</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>{formatMYR(data.total)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* توزيع الشيفتات */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>🕐 توزيع الشيفتات</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>عدد مرات كل شيفت</div>
              </div>
              {Object.keys(report.shifts?.byType || {}).length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: S.muted, fontSize: 13 }}>لا توجد شيفتات هذا الشهر</div>
              ) : (
                <div style={{ padding: '12px 0' }}>
                  {Object.entries(report.shifts?.byType || {}).map(([name, count]: any, i: number) => {
                    const max = Math.max(...Object.values(report.shifts?.byType || {}) as number[])
                    const pct = Math.round((count / max) * 100)
                    const colors = [S.gold, S.blue, S.green, S.purple, S.teal]
                    const color = colors[i % colors.length]
                    return (
                      <div key={i} style={{ padding: '10px 20px', borderBottom: `1px solid ${S.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{name}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color }}>{count} مرة</span>
                        </div>
                        <div style={{ height: 6, background: S.card, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .5s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══ طلبات الفروع ══ */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>📦 طلبات الفروع — {MONTHS_AR[month]}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ background: S.greenB, color: S.green, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>✅ {report.branchRequests?.byStatus?.approved || 0} موافق</span>
                <span style={{ background: S.amberB, color: S.amber, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>⏳ {report.branchRequests?.byStatus?.pending || 0} معلق</span>
                <span style={{ background: S.redB, color: S.red, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>❌ {report.branchRequests?.byStatus?.rejected || 0} مرفوض</span>
              </div>
            </div>
            {Object.keys(report.branchRequests?.byBranch || {}).length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: S.muted, fontSize: 13 }}>لا توجد طلبات فروع هذا الشهر</div>
            ) : (
              <div style={{ padding: '12px 0' }}>
                {Object.entries(report.branchRequests?.byBranch || {}).map(([branch, count]: any, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${S.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>🏪</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: S.white }}>{branch}</span>
                    </div>
                    <span style={{ background: S.tealB, color: S.teal, borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>{count} طلب</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══ طلبات الموظفين ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>📋 طلبات الموظفين</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>توزيع الطلبات بالنوع</div>
              </div>
              {Object.keys(report.empRequests?.byType || {}).length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: S.muted, fontSize: 13 }}>لا توجد طلبات هذا الشهر</div>
              ) : (
                <div style={{ padding: '12px 0' }}>
                  {Object.entries(report.empRequests?.byType || {}).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]: any, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderBottom: `1px solid ${S.border}` }}>
                      <span style={{ fontSize: 13, color: S.white }}>{type}</span>
                      <span style={{ background: S.amberB, color: S.amber, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* الموظفون الجدد */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>👷 الموظفون الجدد</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>انضموا في {MONTHS_AR[month]}</div>
              </div>
              {report.employees?.new === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: S.muted, fontSize: 13 }}>لا يوجد موظفون جدد هذا الشهر</div>
              ) : (
                <div style={{ padding: '12px 0' }}>
                  {report.employees?.data?.map((emp: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${S.border}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: S.greenB, border: `1px solid ${S.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: S.green }}>
                        {emp.name?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{emp.department} • {emp.join_date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ══ المخزون المنخفض ══ */}
          {report.warehouse?.lowStock > 0 && (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.red}40`, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>⚠️ تنبيه — مخزون منخفض</div>
                <span style={{ background: S.redB, color: S.red, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{report.warehouse.lowStock} صنف</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['الصنف', 'القسم', 'الكمية الحالية', 'الحد الأدنى', 'الوحدة', 'آخر سعر'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.warehouse.lowStockItems?.map((p: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: S.red }}>{p.name}</td>
                        <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>{p.category}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 800, color: S.red }}>{p.current_stock || 0}</td>
                        <td style={{ padding: '10px 14px', color: S.muted }}>{p.min_stock || 0}</td>
                        <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>{p.units?.symbol || ''}</td>
                        <td style={{ padding: '10px 14px', color: S.gold, fontSize: 12 }}>{p.last_purchase_price ? formatMYR(p.last_purchase_price) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ ملخص المنيو والمخزون ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: '20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>🍽️ حالة المنيو</div>
              {[
                { label: 'إجمالي الأصناف', value: report.menu?.total, color: S.blue },
                { label: 'متاح للطلب', value: report.menu?.available, color: S.green },
                { label: 'غير متاح', value: (report.menu?.total||0) - (report.menu?.available||0), color: S.red },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: S.card, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: S.muted }}>{item.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value || 0}</span>
                </div>
              ))}
            </div>

            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: '20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>🏭 ملخص المخزون</div>
              {[
                { label: 'إجمالي الأصناف', value: report.warehouse?.total, color: S.blue },
                { label: 'مخزون كافٍ', value: (report.warehouse?.total||0) - (report.warehouse?.lowStock||0), color: S.green },
                { label: 'قيمة المخزون', value: formatMYR(report.warehouse?.inventoryValue), color: S.gold },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: S.card, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: S.muted }}>{item.label}</span>
                  <span style={{ fontSize: typeof item.value === 'string' ? 13 : 16, fontWeight: 800, color: item.color }}>{item.value || 0}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
