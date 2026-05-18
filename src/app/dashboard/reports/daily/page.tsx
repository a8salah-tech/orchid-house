'use client'
export const dynamic = 'force-dynamic'

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

function ld(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatMYR(n: number) {
  return 'MYR ' + new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

function Card({ title, value, sub, icon, color, bg }: { title: string; value: any; sub?: string; icon: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 16, border: `1px solid ${color}30`, padding: '18px 20px' }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: S.muted }}>{sub}</div>}
    </div>
  )
}

export default function DailyReportPage() {
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(ld(new Date()))
  const [report, setReport] = useState<any>({})

  useEffect(() => { fetchReport() }, [date])

  async function fetchReport() {
    setLoading(true)
    const today = date
    const tomorrow = (() => { const d = new Date(date); d.setDate(d.getDate()+1); return ld(d) })()

    const [
      employees,
      shifts,
      schedules,
      purchases,
      branchRequests,
      menuItems,
      warehouseProducts,
      shiftRequests,
      empRequests,
    ] = await Promise.all([
      supabase.from('employees').select('id,name,role,department,is_active,branches(name)'),
      supabase.from('shifts').select('*').eq('is_active', true),
      supabase.from('shift_schedules').select('*,employees(name,department,branches(name)),shifts(name,start_time,end_time,color)').eq('date', today),
      supabase.from('purchase_invoices').select('*,purchase_invoice_items(*)').gte('invoice_date', today).lt('invoice_date', tomorrow),
      supabase.from('branch_requests').select('*,branches(name),branch_request_items(*)').gte('created_at', today+'T00:00:00').lt('created_at', tomorrow+'T00:00:00'),
      supabase.from('menu_items').select('id,name,category_id,is_available,price,menu_categories(name)').eq('is_active', true),
      supabase.from('warehouse_products').select('id,name,category,current_stock,min_stock,units(symbol)').eq('is_active', true),
      supabase.from('shift_requests').select('*,employees(name,department),shifts(name)').gte('created_at', today+'T00:00:00').lt('created_at', tomorrow+'T00:00:00'),
      supabase.from('employee_requests').select('*,employees(name,department)').gte('created_at', today+'T00:00:00').lt('created_at', tomorrow+'T00:00:00'),
    ])

    const allEmps = employees.data || []
    const activeEmps = allEmps.filter(e => e.is_active)
    const scheduledToday = schedules.data || []
    const purchasesData = purchases.data || []
    const branchReqData = branchRequests.data || []
    const menuData = menuItems.data || []
    const warehouseData = warehouseProducts.data || []
    const shiftReqData = shiftRequests.data || []
    const empReqData = empRequests.data || []

    // إحصائيات المشتريات
    const totalPurchases = purchasesData.reduce((s, inv) => s + (inv.total_amount || 0), 0)
    const totalItems = purchasesData.reduce((s, inv) => s + (inv.purchase_invoice_items?.length || 0), 0)

    // المخزون المنخفض
    const lowStock = warehouseData.filter(p => (p.current_stock || 0) <= (p.min_stock || 0) && (p.min_stock || 0) > 0)

    // الموظفون العاملون الآن
    const nowMins = new Date().getHours()*60 + new Date().getMinutes()
    const workingNow = scheduledToday.filter((s: any) => {
      if (!s.shifts?.start_time || !s.shifts?.end_time) return false
      const [sh,sm] = s.shifts.start_time.split(':').map(Number)
      const [eh,em] = s.shifts.end_time.split(':').map(Number)
      let end = eh*60+em; if(end < sh*60+sm) end += 24*60
      return nowMins >= sh*60+sm && nowMins <= end
    })

    // الفروع
    const branches = [...new Set(activeEmps.map((e: any) => Array.isArray(e.branches) ? e.branches[0]?.name : e.branches?.name).filter(Boolean))]

    // الأصناف المتاحة وغير المتاحة
    const availableItems = menuData.filter(i => i.is_available)
    const unavailableItems = menuData.filter(i => !i.is_available)

    // طلبات الفروع
    const pendingBranchReq = branchReqData.filter(r => r.status === 'pending')
    const approvedBranchReq = branchReqData.filter(r => r.status === 'approved')

    setReport({
      date, today,
      employees: { total: allEmps.length, active: activeEmps.length, scheduled: scheduledToday.length, workingNow: workingNow.length },
      branches,
      scheduledToday,
      workingNow,
      purchases: { total: totalPurchases, count: purchasesData.length, items: totalItems, data: purchasesData },
      branchRequests: { total: branchReqData.length, pending: pendingBranchReq.length, approved: approvedBranchReq.length, data: branchReqData },
      menu: { total: menuData.length, available: availableItems.length, unavailable: unavailableItems.length },
      warehouse: { total: warehouseData.length, lowStock: lowStock.length, lowStockItems: lowStock },
      shifts: { total: shifts.data?.length || 0, scheduled: scheduledToday.length },
      shiftRequests: { total: shiftReqData.length, pending: shiftReqData.filter(r => r.status === 'pending').length, data: shiftReqData },
      empRequests: { total: empReqData.length, pending: empReqData.filter(r => r.status === 'pending').length, data: empReqData },
    })
    setLoading(false)
  }

  function printReport() {
    const d = new Date(date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>التقرير اليومي — ${d}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
      body{font-family:'Tajawal',Arial,sans-serif;margin:20px;color:#1a1a1a;direction:rtl}
      .header{text-align:center;padding:20px;background:#0F2040;border-radius:8px;margin-bottom:16px;color:white}
      h1{color:#C9A84C;font-size:20px;margin:0 0 4px}
      .date{color:#8A9BB5;font-size:13px}
      .section{margin-bottom:20px}
      .section-title{font-size:15px;font-weight:800;color:#0F2040;border-bottom:2px solid #C9A84C;padding-bottom:6px;margin-bottom:10px}
      .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
      .stat{border:1px solid #ddd;border-radius:8px;padding:12px;text-align:center}
      .sv{font-size:20px;font-weight:800;color:#C9A84C}
      .sl{font-size:11px;color:#666;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
      th{background:#0F2040;color:white;padding:8px 10px;text-align:right;font-size:11px}
      td{padding:6px 10px;border-bottom:1px solid #eee}
      tr:nth-child(even){background:#f9f9f9}
      .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
      .badge-green{background:#dcfce7;color:#16a34a}
      .badge-red{background:#fee2e2;color:#dc2626}
      .badge-amber{background:#fef3c7;color:#92400e}
      @media print{button{display:none}}
    </style></head><body>
    <div class="header"><div style="font-size:28px;margin-bottom:6px">🌸</div>
    <h1>Orchid House — التقرير اليومي</h1><div class="date">${d}</div></div>

    <!-- إحصائيات سريعة -->
    <div class="stats">
      <div class="stat"><div class="sv">${report.employees?.active||0}</div><div class="sl">الموظفون النشطون</div></div>
      <div class="stat"><div class="sv">${report.employees?.scheduled||0}</div><div class="sl">مجدولون اليوم</div></div>
      <div class="stat"><div class="sv">${report.employees?.workingNow||0}</div><div class="sl">يعملون الآن</div></div>
      <div class="stat"><div class="sv" style="color:${report.warehouse?.lowStock>0?'#dc2626':'#16a34a'}">${report.warehouse?.lowStock||0}</div><div class="sl">مخزون منخفض</div></div>
    </div>

    <!-- الشيفتات اليوم -->
    <div class="section"><div class="section-title">🕐 الشيفتات اليوم</div>
    ${report.scheduledToday?.length > 0 ? `
    <table><thead><tr><th>الموظف</th><th>القسم</th><th>الشيفت</th><th>من</th><th>إلى</th></tr></thead><tbody>
    ${report.scheduledToday.map((s: any) => `<tr>
      <td>${s.employees?.name||''}</td>
      <td>${s.employees?.department||''}</td>
      <td>${s.shifts?.name||''}</td>
      <td>${s.shifts?.start_time?.slice(0,5)||''}</td>
      <td>${s.shifts?.end_time?.slice(0,5)||''}</td>
    </tr>`).join('')}</tbody></table>` : '<p style="color:#666;font-size:12px">لا يوجد شيفتات مجدولة اليوم</p>'}
    </div>

    <!-- المشتريات -->
    <div class="section"><div class="section-title">🛒 المشتريات اليوم</div>
    ${report.purchases?.count > 0 ? `
    <table><thead><tr><th>المورد</th><th>رقم الفاتورة</th><th>الأصناف</th><th>الإجمالي</th></tr></thead><tbody>
    ${report.purchases.data.map((inv: any) => `<tr>
      <td>${inv.supplier_name||'—'}</td>
      <td>${inv.invoice_number||'—'}</td>
      <td>${inv.purchase_invoice_items?.length||0} صنف</td>
      <td>MYR ${(inv.total_amount||0).toFixed(2)}</td>
    </tr>`).join('')}
    <tr style="background:#f0e8d0;font-weight:700"><td colspan="3">الإجمالي</td><td>MYR ${(report.purchases?.total||0).toFixed(2)}</td></tr>
    </tbody></table>` : '<p style="color:#666;font-size:12px">لا توجد مشتريات اليوم</p>'}
    </div>

    <!-- طلبات الفروع -->
    <div class="section"><div class="section-title">📦 طلبات الفروع اليوم</div>
    ${report.branchRequests?.total > 0 ? `
    <table><thead><tr><th>الفرع</th><th>الحالة</th><th>الأصناف</th></tr></thead><tbody>
    ${report.branchRequests.data.map((req: any) => `<tr>
      <td>${req.branches?.name||'—'}</td>
      <td><span class="badge ${req.status==='approved'?'badge-green':req.status==='pending'?'badge-amber':'badge-red'}">${req.status==='approved'?'موافق':req.status==='pending'?'معلق':'مرفوض'}</span></td>
      <td>${req.branch_request_items?.length||0} صنف</td>
    </tr>`).join('')}</tbody></table>` : '<p style="color:#666;font-size:12px">لا توجد طلبات فروع اليوم</p>'}
    </div>

    <!-- المخزون المنخفض -->
    ${report.warehouse?.lowStock > 0 ? `
    <div class="section"><div class="section-title">⚠️ المخزون المنخفض</div>
    <table><thead><tr><th>الصنف</th><th>القسم</th><th>الكمية الحالية</th><th>الحد الأدنى</th><th>الوحدة</th></tr></thead><tbody>
    ${report.warehouse.lowStockItems.map((p: any) => `<tr>
      <td style="color:#dc2626;font-weight:600">${p.name}</td>
      <td>${p.category||''}</td>
      <td style="color:#dc2626;font-weight:700">${p.current_stock||0}</td>
      <td>${p.min_stock||0}</td>
      <td>${p.units?.symbol||''}</td>
    </tr>`).join('')}</tbody></table></div>` : ''}

    <!-- طلبات الموظفين -->
    ${report.empRequests?.total > 0 ? `
    <div class="section"><div class="section-title">📋 طلبات الموظفين اليوم</div>
    <table><thead><tr><th>الموظف</th><th>نوع الطلب</th><th>الحالة</th></tr></thead><tbody>
    ${report.empRequests.data.map((req: any) => `<tr>
      <td>${req.employees?.name||'—'}</td>
      <td>${req.title||req.request_type||'—'}</td>
      <td><span class="badge ${req.status==='approved'?'badge-green':req.status==='pending'?'badge-amber':'badge-red'}">${req.status==='approved'?'موافق':req.status==='pending'?'معلق':'مرفوض'}</span></td>
    </tr>`).join('')}</tbody></table></div>` : ''}

    <div style="text-align:center;color:#999;font-size:10px;margin-top:20px">
      🌸 Orchid Group Restaurant Management System — ${new Date().toLocaleTimeString('ar-SA')}
    </div>
    </body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  const d = new Date(date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(1)}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📊 التقرير اليومي</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{d}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'ltr' }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
            <Card title="الموظفون النشطون" value={report.employees?.active} icon="👷" color={S.blue} bg={S.blueB} />
            <Card title="مجدولون اليوم" value={report.employees?.scheduled} icon="📅" color={S.gold} bg={S.gold3} />
            <Card title="يعملون الآن" value={report.employees?.workingNow} icon="🟢" color={S.green} bg={S.greenB} />
            <Card title="مشتريات اليوم" value={formatMYR(report.purchases?.total)} icon="🛒" color={S.purple} bg={S.purpleB} sub={`${report.purchases?.count || 0} فاتورة`} />
            <Card title="طلبات الفروع" value={report.branchRequests?.total} icon="📦" color={S.teal} bg={S.tealB} sub={`${report.branchRequests?.pending || 0} معلق`} />
            <Card title="مخزون منخفض" value={report.warehouse?.lowStock} icon="⚠️" color={report.warehouse?.lowStock > 0 ? S.red : S.green} bg={report.warehouse?.lowStock > 0 ? S.redB : S.greenB} />
            <Card title="طلبات الموظفين" value={report.empRequests?.total} icon="📋" color={S.amber} bg={S.amberB} sub={`${report.empRequests?.pending || 0} معلق`} />
            <Card title="أصناف المنيو" value={report.menu?.available} icon="🍽️" color={S.gold} bg={S.gold3} sub={`${report.menu?.unavailable || 0} غير متاح`} />
          </div>

          {/* ══ الشيفتات اليوم ══ */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>🕐 الشيفتات اليوم</div>
              <span style={{ background: S.gold3, color: S.gold, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{report.scheduledToday?.length || 0} موظف</span>
            </div>
            {report.scheduledToday?.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: S.muted, fontSize: 13 }}>لا يوجد شيفتات مجدولة اليوم</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['الموظف', 'القسم', 'الفرع', 'الشيفت', 'من', 'إلى', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.scheduledToday?.map((s: any, i: number) => {
                      const nowMins = new Date().getHours()*60 + new Date().getMinutes()
                      const [sh,sm] = (s.shifts?.start_time||'00:00').split(':').map(Number)
                      const [eh,em] = (s.shifts?.end_time||'00:00').split(':').map(Number)
                      let end = eh*60+em; if(end<sh*60+sm) end+=24*60
                      const isWorking = nowMins >= sh*60+sm && nowMins <= end
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: S.white }}>{s.employees?.name}</td>
                          <td style={{ padding: '10px 14px', color: S.muted }}>{s.employees?.department}</td>
                          <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>
                            {Array.isArray(s.employees?.branches) ? s.employees.branches[0]?.name : s.employees?.branches?.name || '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: (s.shifts?.color||S.gold)+'20', color: s.shifts?.color||S.gold, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{s.shifts?.name}</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>{s.shifts?.start_time?.slice(0,5)}</td>
                          <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>{s.shifts?.end_time?.slice(0,5)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: isWorking?S.greenB:S.card, color: isWorking?S.green:S.muted, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                              {isWorking ? '🟢 يعمل الآن' : '⏰ مجدول'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══ المشتريات اليوم ══ */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>🛒 المشتريات اليوم</div>
              <span style={{ background: S.purpleB, color: S.purple, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{formatMYR(report.purchases?.total)}</span>
            </div>
            {report.purchases?.count === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: S.muted, fontSize: 13 }}>لا توجد مشتريات اليوم</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['المورد', 'رقم الفاتورة', 'التاريخ', 'الأصناف', 'الإجمالي', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.purchases?.data?.map((inv: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: S.white }}>{inv.supplier_name || '—'}</td>
                        <td style={{ padding: '10px 14px', color: S.gold, fontSize: 12 }}>{inv.invoice_number || '—'}</td>
                        <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>{inv.invoice_date}</td>
                        <td style={{ padding: '10px 14px', color: S.muted }}>{inv.purchase_invoice_items?.length || 0} صنف</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: S.green }}>{formatMYR(inv.total_amount)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: inv.status==='approved'?S.greenB:S.amberB, color: inv.status==='approved'?S.green:S.amber, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                            {inv.status === 'approved' ? '✅ موافق' : '⏳ معلق'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══ طلبات الفروع ══ */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>📦 طلبات الفروع اليوم</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ background: S.amberB, color: S.amber, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{report.branchRequests?.pending || 0} معلق</span>
                <span style={{ background: S.greenB, color: S.green, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{report.branchRequests?.approved || 0} موافق</span>
              </div>
            </div>
            {report.branchRequests?.total === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: S.muted, fontSize: 13 }}>لا توجد طلبات فروع اليوم</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['الفرع', 'الأصناف', 'الملاحظات', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.branchRequests?.data?.map((req: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: S.white }}>{req.branches?.name || '—'}</td>
                        <td style={{ padding: '10px 14px', color: S.muted }}>{req.branch_request_items?.length || 0} صنف</td>
                        <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>{req.notes || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: req.status==='approved'?S.greenB:req.status==='pending'?S.amberB:S.redB, color: req.status==='approved'?S.green:req.status==='pending'?S.amber:S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                            {req.status === 'approved' ? '✅ موافق' : req.status === 'pending' ? '⏳ معلق' : '❌ مرفوض'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                      {['الصنف', 'القسم', 'الكمية الحالية', 'الحد الأدنى', 'الوحدة'].map(h => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ طلبات الموظفين ══ */}
          {report.empRequests?.total > 0 && (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>📋 طلبات الموظفين اليوم</div>
                <span style={{ background: S.amberB, color: S.amber, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{report.empRequests.pending} معلق</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['الموظف', 'القسم', 'نوع الطلب', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.empRequests.data?.map((req: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: S.white }}>{req.employees?.name || '—'}</td>
                        <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>{req.employees?.department || '—'}</td>
                        <td style={{ padding: '10px 14px', color: S.muted }}>{req.title || req.request_type || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: req.status==='approved'?S.greenB:req.status==='pending'?S.amberB:S.redB, color: req.status==='approved'?S.green:req.status==='pending'?S.amber:S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                            {req.status === 'approved' ? '✅ موافق' : req.status === 'pending' ? '⏳ معلق' : '❌ مرفوض'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ ملخص المنيو ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: '20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>🍽️ حالة المنيو</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'إجمالي الأصناف', value: report.menu?.total, color: S.blue },
                  { label: 'متاح للطلب', value: report.menu?.available, color: S.green },
                  { label: 'غير متاح', value: report.menu?.unavailable, color: S.red },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 13, color: S.muted }}>{item.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: '20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>🏭 ملخص المخزون</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'إجمالي الأصناف', value: report.warehouse?.total, color: S.blue },
                  { label: 'مخزون كافٍ', value: (report.warehouse?.total||0) - (report.warehouse?.lowStock||0), color: S.green },
                  { label: 'مخزون منخفض', value: report.warehouse?.lowStock, color: S.red },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 13, color: S.muted }}>{item.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
