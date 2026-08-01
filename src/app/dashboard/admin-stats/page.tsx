'use client'


import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthProvider'
import { useLang } from '../../components/LanguageContext'

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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.06)',
}

type Stats = {
  orders_today: number; revenue_today: number; active_orders: number
  occupied_tables: number; total_tables: number; total_employees: number
  branch_occupancy: { branch_name: string; occupied: number; total: number }[]
  total_customers: number; bookings_today: number
  revenue_week: number; revenue_month: number
  top_items: { name: string; name_en: string; count: number }[]
  recent_orders: { id: string; table_name: string; branch_name: string; status: string; total: number; time: string }[]
  waiter_calls: number; pending_bookings: number; low_stock: number
  paid_today: number; cancelled_today: number
  // ✅ جديد: المشتريات (يوم/أسبوع/شهر)
  purchases_today: number; purchases_week: number; purchases_month: number
  // ✅ جديد: الطاولة الأكثر طلبًا ومبلغها في كل فترة
  top_tables: { name: string; branch_name: string; table_id: string; orders_count: number; amount_today: number; amount_week: number; amount_month: number }[]
}

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const duration = 1200
    const startVal = 0
    const animate = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(startVal + (value - startVal) * ease)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value])
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:  { label: 'Confirmed',  color: S.blue,   bg: S.blueB   },
  preparing:  { label: 'Preparing',  color: S.amber,  bg: S.amberB  },
  ready:      { label: 'Ready',      color: S.green,  bg: S.greenB  },
  paid:       { label: 'Paid',       color: S.muted,  bg: S.card    },
  cancelled:  { label: 'Cancelled',  color: S.red,    bg: S.redB    },
}

// ✅ جديد: حارس صفحة - الأدمن بس يقدر يشوف الإحصائيات الكاملة دي
function AccessDenied() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: S.muted, fontFamily: 'Tajawal, sans-serif', gap: 10 }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <div style={{ fontSize: 15 }}>هذه الصفحة مخصصة لمدير النظام فقط</div>
    </div>
  )
}

export default function AdminStatsPage() {
  const { employee } = useAuth()
  const isAdmin = employee?.role === 'admin'
  if (!isAdmin) return <AccessDenied />
  return <AdminDashboard />
}

function AdminDashboard() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const router = useRouter()
  const { isAr } = useLang()

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(new Date())
  // ✅ جديد: بحث بتاريخ محدد لتفاصيل طلبات الطاولة الأكثر طلبًا في يوم بعينه
  const [dateSearchValue, setDateSearchValue] = useState(() => new Date().toISOString().split('T')[0])
  const [dateSearchResult, setDateSearchResult] = useState<{ count: number; amount: number; orders: { time: string; amount: number }[] } | null>(null)
  const [dateSearchLoading, setDateSearchLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    // ✅ Fix حرج: كل حدود التاريخ ("اليوم") بقت تُحسب بدقة بتوقيت ماليزيا (UTC+8) بدل توقيت السيرفر -
    // عشان "اليوم" يعني فعليًا 24 ساعة حقيقية من نص الليل بتوقيت ماليزيا، مش أي توقيت تاني ممكن يلخبط الحدود
    const nowMY = new Date(Date.now() + 8 * 60 * 60 * 1000)
    const todayDateStr = nowMY.toISOString().split('T')[0]
    const today = new Date(`${todayDateStr}T00:00:00+08:00`).toISOString()
    const weekAgo = new Date(Date.now() - 7 * 86400000 + 8 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00+08:00'
    const monthAgo = new Date(Date.now() - 30 * 86400000 + 8 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00+08:00'
    // ✅ حدود تقويمية حقيقية بتوقيت ماليزيا - "الأسبوع" من يوم الاثنين، و"الشهر" من أول يوم في الشهر
    const daysSinceMonday = (nowMY.getUTCDay() + 6) % 7
    const calMonthStartStr = `${nowMY.getUTCFullYear()}-${String(nowMY.getUTCMonth() + 1).padStart(2, '0')}-01`
    const calMonthStart = new Date(`${calMonthStartStr}T00:00:00+08:00`).toISOString()
    const calWeekStartDateStr = new Date(nowMY.getTime() - daysSinceMonday * 86400000).toISOString().split('T')[0]
    const calWeekStart = new Date(`${calWeekStartDateStr}T00:00:00+08:00`).toISOString()

    const [mainRes, topItemsRes, recentRes, waiterRes, bookingsRes, stockRes] = await Promise.all([
      Promise.resolve(null),
      sb.from('order_items')
        .select('menu_items(name,name_en)', { count: 'exact' })
        .gte('created_at', weekAgo)
        .limit(100),
      sb.from('orders')
        .select('id,table_id,status,total_amount,created_at,tables(name,number,branches(name))')
        .in('status', ['confirmed','preparing','ready'])
        .order('created_at', { ascending: false })
        .limit(8),
      sb.from('waiter_calls')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()),
      sb.from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      sb.from('warehouse_products')
        .select('id', { count: 'exact', head: true })
        .lt('quantity', 10),
    ])

    const [
      ordersToday, revenueToday, activeOrders, occupiedTables,
      totalTables, totalEmployees, totalCustomers, paidToday, cancelledToday,
      revenueWeek, revenueMonth,
      purchasesTodayRes, purchasesWeekRes, purchasesMonthRes, monthOrdersForTopTableRes,
      tablesWithBranchRes,
    ] = await Promise.all([
      sb.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today).then(r => r.count || 0),
      sb.from('orders').select('total_amount').eq('status', 'paid').gte('paid_at', today).then(r => (r.data || []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0)),
      sb.from('orders').select('id', { count: 'exact', head: true }).in('status', ['confirmed','preparing','ready']).then(r => r.count || 0),
      sb.from('tables').select('id', { count: 'exact', head: true }).eq('status', 'occupied').then(r => r.count || 0),
      sb.from('tables').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
      sb.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true).then(r => r.count || 0),
      sb.from('customers').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid').gte('paid_at', today).then(r => r.count || 0),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'cancelled').gte('created_at', today).then(r => r.count || 0),
      sb.from('orders').select('total_amount').eq('status', 'paid').gte('paid_at', weekAgo).then(r => (r.data || []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0)),
      sb.from('orders').select('total_amount').eq('status', 'paid').gte('paid_at', monthAgo).then(r => (r.data || []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0)),
      // ✅ جديد: المشتريات (يوم/أسبوع/شهر) - من فواتير المشتريات الفعلية
      sb.from('purchase_invoices').select('total_amount').gte('created_at', today).then(r => (r.data || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0)),
      sb.from('purchase_invoices').select('total_amount').gte('created_at', weekAgo).then(r => (r.data || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0)),
      sb.from('purchase_invoices').select('total_amount').gte('created_at', monthAgo).then(r => (r.data || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0)),
      // ✅ جديد: كل الطلبات المدفوعة لآخر شهر - نستخدمها لتحديد أكتر طاولة طلبت، ومبلغها في كل فترة
      sb.from('orders').select('table_id, total_amount, paid_at, tables(name,number,branches(name))').eq('status', 'paid').gte('paid_at', calMonthStart),
      // ✅ جديد: كل الطاولات مع فرعها وحالتها - لحساب الإشغال منفصل لكل فرع بدل رقم مجمّع
      sb.from('tables').select('status, branches(name)'),
    ])

    // ✅ جديد: تجميع إشغال الطاولات حسب الفرع - كل فرع رقمه لوحده مش مجمّع مع التاني
    const branchOccupancyMap: Record<string, { branch_name: string; occupied: number; total: number }> = {}
    for (const t of (tablesWithBranchRes.data || []) as any[]) {
      const bname = t.branches?.name || '—'
      if (!branchOccupancyMap[bname]) branchOccupancyMap[bname] = { branch_name: bname, occupied: 0, total: 0 }
      branchOccupancyMap[bname].total++
      if (t.status === 'occupied') branchOccupancyMap[bname].occupied++
    }
    const branchOccupancy = Object.values(branchOccupancyMap)

    // Top items
    const itemCounts: Record<string, { name: string; name_en: string; count: number }> = {}
    ;(topItemsRes.data || []).forEach((row: any) => {
      const mi = row.menu_items
      if (mi?.name) {
        if (!itemCounts[mi.name]) itemCounts[mi.name] = { name: mi.name, name_en: mi.name_en || mi.name, count: 0 }
        itemCounts[mi.name].count++
      }
    })
    const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5)

    // Recent orders
    const recentOrders = (recentRes.data || []).map((o: any) => ({
      id: o.id, status: o.status, total: o.total_amount || 0,
      table_name: o.tables?.name || `Table ${o.tables?.number || '?'}`,
      branch_name: o.tables?.branches?.name || '—',
      time: new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }))

    // ✅ Fix حرج: التجميع كان بيتم بالاسم (name) مش بمعرف الطاولة الفريد (table_id) - فلو طاولة برقم
    // متشابه موجودة في فرعين مختلفين (زي Table 5 في أوركيد هاوس وTable 5 في KLCC)، كان بيتم جمعهم
    // مع بعض غلط وكأنهم نفس الطاولة! دلوقتي التجميع بمعرف الطاولة الفريد + عرض اسم الفرع للتوضيح
    const monthOrders = (monthOrdersForTopTableRes.data || []) as any[]
    const tableAgg: Record<string, { name: string; branchName: string; tableId: string; count: number; amountToday: number; amountWeek: number; amountMonth: number }> = {}
    for (const o of monthOrders) {
      const tname = o.tables?.name || `Table ${o.tables?.number || '?'}`
      const bname = o.tables?.branches?.name || '—'
      const key = o.table_id // ✅ مفتاح فريد حقيقي، مش الاسم
      if (!tableAgg[key]) tableAgg[key] = { name: tname, branchName: bname, tableId: o.table_id, count: 0, amountToday: 0, amountWeek: 0, amountMonth: 0 }
      tableAgg[key].count++
      tableAgg[key].amountMonth += o.total_amount || 0
      if (o.paid_at >= calWeekStart) tableAgg[key].amountWeek += o.total_amount || 0
      if (o.paid_at >= today) tableAgg[key].amountToday += o.total_amount || 0
    }
    // ✅ جديد: أعلى 3 طاولات بدل واحدة بس
    const topTables = Object.values(tableAgg).sort((a, b) => b.count - a.count).slice(0, 3).map(t => ({
      name: t.name, branch_name: t.branchName, table_id: t.tableId, orders_count: t.count,
      amount_today: t.amountToday, amount_week: t.amountWeek, amount_month: t.amountMonth,
    }))

    setStats({
      orders_today: ordersToday, revenue_today: revenueToday,
      active_orders: activeOrders, occupied_tables: occupiedTables,
      branch_occupancy: branchOccupancy,
      total_tables: totalTables, total_employees: totalEmployees,
      total_customers: totalCustomers, bookings_today: 0,
      revenue_week: revenueWeek, revenue_month: revenueMonth,
      top_items: topItems, recent_orders: recentOrders,
      waiter_calls: waiterRes.count || 0,
      pending_bookings: bookingsRes.count || 0,
      low_stock: stockRes.count || 0,
      paid_today: paidToday, cancelled_today: cancelledToday,
      purchases_today: purchasesTodayRes, purchases_week: purchasesWeekRes, purchases_month: purchasesMonthRes,
      top_tables: topTables,
    })
    setLoading(false)
  }, [sb])

  // ✅ جديد: طاولة مختارة للبحث بالتاريخ - افتراضيًا الأولى في الترتيب، وتقدر تختار أي من التلاتة
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  // ✅ جديد: عرض كل الطلبات اللي تمت في أي يوم تختاره - نافذة منفصلة (Tab/Modal)
  const [showAllOrdersModal, setShowAllOrdersModal] = useState(false)
  const [allOrdersDate, setAllOrdersDate] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [allOrdersResult, setAllOrdersResult] = useState<{ count: number; total: number; orders: { table: string; branch: string; time: string; amount: number; status: string }[] } | null>(null)
  const [allOrdersLoading, setAllOrdersLoading] = useState(false)

  const searchAllOrdersByDate = useCallback(async (dateStr: string) => {
    setAllOrdersLoading(true)
    // ✅ حدود اليوم بتوقيت ماليزيا (UTC+8) بالظبط - 24 ساعة حقيقية من نص الليل بتوقيت ماليزيا
    const dayStart = `${dateStr}T00:00:00+08:00`
    const dayEnd = `${dateStr}T23:59:59.999+08:00`
    const { data } = await sb.from('orders').select('status, total_amount, paid_at, created_at, tables(name,number,branches(name))')
      .gte('created_at', dayStart).lte('created_at', dayEnd)
      .order('created_at', { ascending: false })
    const orders = (data || []).map((o: any) => ({
      table: o.tables?.name || `Table ${o.tables?.number || '?'}`,
      branch: o.tables?.branches?.name || '—',
      time: new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      amount: o.total_amount || 0,
      status: o.status,
    }))
    setAllOrdersResult({
      count: orders.length,
      total: orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.amount, 0),
      orders,
    })
    setAllOrdersLoading(false)
  }, [sb])

  useEffect(() => { if (stats?.top_tables?.[0] && !selectedTableId) setSelectedTableId(stats.top_tables[0].table_id) }, [stats?.top_tables])

  // ✅ جديد: البحث بتاريخ محدد - يجيب كل طلبات الطاولة المختارة في اليوم المختار بالتفصيل
  const searchTopTableByDate = useCallback(async (dateStr: string, tableId: string) => {
    if (!tableId) return
    setDateSearchLoading(true)
    // ✅ Fix: حدود اليوم بتوقيت ماليزيا (UTC+8) بالظبط - عشان اليوم المختار يعني 24 ساعة حقيقية بتوقيت ماليزيا
    const dayStart = `${dateStr}T00:00:00+08:00`
    const dayEnd = `${dateStr}T23:59:59.999+08:00`
    const { data } = await sb.from('orders').select('total_amount, paid_at')
      .eq('table_id', tableId).eq('status', 'paid')
      .gte('paid_at', dayStart).lte('paid_at', dayEnd)
      .order('paid_at', { ascending: false })
    const orders = (data || []).map((o: any) => ({
      time: new Date(o.paid_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      amount: o.total_amount || 0,
    }))
    setDateSearchResult({
      count: orders.length,
      amount: orders.reduce((s, o) => s + o.amount, 0),
      orders,
    })
    setDateSearchLoading(false)
  }, [sb])

  // ✅ نبحث تلقائيًا كل ما التاريخ أو الطاولة المختارة تتغيّر
  useEffect(() => { if (selectedTableId) searchTopTableByDate(dateSearchValue, selectedTableId) }, [selectedTableId, dateSearchValue])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => {
    const t = setInterval(() => { setTick(p => p + 1); setNow(new Date()) }, 30000)
    return () => clearInterval(t)
  }, [])

  const occupancyPct = stats ? Math.round((stats.occupied_tables / Math.max(stats.total_tables, 1)) * 100) : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🌸</div>
      <div style={{ color: S.muted, fontSize: 14 }}>Loading dashboard...</div>
    </div>
  )

  const QUICK_LINKS = [
    { icon: '🏧', label: isAr ? 'الكاشير' : 'Cashier', path: '/dashboard/cashier', color: S.gold, bg: S.gold3 },
    { icon: '👨‍🍳', label: isAr ? 'المطبخ' : 'Kitchen', path: '/dashboard/kitchen', color: S.amber, bg: S.amberB },
    { icon: '🪑', label: isAr ? 'الطاولات' : 'Tables', path: '/dashboard/tables', color: S.blue, bg: S.blueB },
    { icon: '📖', label: isAr ? 'المنيو' : 'Menu', path: '/dashboard/menu/items', color: S.teal, bg: S.tealB },
    { icon: '🏭', label: isAr ? 'المستودع' : 'Warehouse', path: '/dashboard/warehouse', color: S.purple, bg: S.purpleB },
    { icon: '🛒', label: isAr ? 'المشتريات' : 'Purchases', path: '/dashboard/purchases', color: S.green, bg: S.greenB },
    { icon: '👥', label: isAr ? 'العملاء' : 'Customers', path: '/dashboard/customers', color: S.blue, bg: S.blueB },
    { icon: '📅', label: isAr ? 'الحجوزات' : 'Bookings', path: '/dashboard/bookings', color: S.purple, bg: S.purpleB },
    { icon: '🤝', label: isAr ? 'الموردون' : 'Suppliers', path: '/dashboard/suppliers', color: S.amber, bg: S.amberB },
    { icon: '🎫', label: isAr ? 'الكوبونات' : 'Coupons', path: '/dashboard/coupons', color: S.red, bg: S.redB },
    { icon: '🎁', label: isAr ? 'الولاء' : 'Loyalty', path: '/dashboard/loyalty', color: S.gold, bg: S.gold3 },
    { icon: '👷', label: isAr ? 'الموظفون' : 'Employees', path: '/dashboard/hr/employees', color: S.teal, bg: S.tealB },
    { icon: '📊', label: isAr ? 'التقارير اليومية' : 'Daily Reports', path: '/dashboard/reports/daily', color: S.green, bg: S.greenB },
    { icon: '📈', label: isAr ? 'تحليل التكاليف' : 'Cost Analysis', path: '/dashboard/reports/costs', color: S.purple, bg: S.purpleB },
    { icon: '📋', label: isAr ? 'شجرة الحسابات' : 'Chart of Accounts', path: '/dashboard/accounting/chart', color: S.blue, bg: S.blueB },
    { icon: '💸', label: isAr ? 'سندات القيد' : 'Journal Entries', path: '/dashboard/accounting/entries', color: S.amber, bg: S.amberB },
    { icon: '📲', label: isAr ? 'الإشعارات' : 'Notifications', path: '/dashboard/notifications', color: S.teal, bg: S.tealB },
    { icon: '🔐', label: isAr ? 'الصلاحيات' : 'Permissions', path: '/dashboard/settings/permissions', color: S.muted, bg: S.card },
  ]

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white, direction: isAr ? 'rtl' : 'ltr' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ fontSize: 32 }}>🌸</div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: S.white, marginBottom: 2 }}>{isAr ? 'لوحة التحكم الرئيسية' : 'Main Dashboard'}</h1>
              <div style={{ fontSize: 13, color: S.muted }}>{now.toLocaleDateString(isAr ? 'ar-SA' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {now.toLocaleTimeString(isAr ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {stats!.waiter_calls > 0 && (
            <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, animation: 'pulse 1.5s ease infinite' }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              <span style={{ color: S.red, fontWeight: 700, fontSize: 13 }}>{stats!.waiter_calls} {isAr ? 'طلب ويتر' : 'Waiter Calls'}</span>
            </div>
          )}
          {stats!.pending_bookings > 0 && (
            <div style={{ background: S.amberB, border: `1px solid ${S.amber}`, borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📅</span>
              <span style={{ color: S.amber, fontWeight: 700, fontSize: 13 }}>{stats!.pending_bookings} {isAr ? 'حجز معلق' : 'Pending Bookings'}</span>
            </div>
          )}
          {stats!.low_stock > 0 && (
            <div style={{ background: S.purpleB, border: `1px solid ${S.purple}`, borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span style={{ color: S.purple, fontWeight: 700, fontSize: 13 }}>{stats!.low_stock} {isAr ? 'منتج منخفض' : 'Low Stock'}</span>
            </div>
          )}
          <button onClick={fetchStats} style={{ padding: '8px 16px', borderRadius: 12, border: `1px solid ${S.border}`, background: S.card, color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? '🔄 تحديث' : '🔄 Refresh'}</button>
          {/* ✅ جديد: زر فتح نافذة "كل الطلبات في يوم" */}
          <button onClick={() => { setShowAllOrdersModal(true); searchAllOrdersByDate(allOrdersDate) }}
            style={{ padding: '8px 16px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {isAr ? '📋 كل طلبات يوم معين' : '📋 All Orders on a Day'}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '💰', label: isAr ? 'إيرادات اليوم' : "Today's Revenue", value: stats!.revenue_today, prefix: 'MYR ', decimals: 2, color: S.gold, bg: S.gold3, sub: `${stats!.paid_today} ${isAr ? 'طلب مدفوع' : 'paid orders'}`, path: '/dashboard/reports/daily' },
          { icon: '📋', label: isAr ? 'طلبات نشطة' : 'Active Orders', value: stats!.active_orders, color: S.amber, bg: S.amberB, sub: `${stats!.orders_today} ${isAr ? 'طلب اليوم' : "today's orders"}`, path: '/dashboard/cashier' },
          { icon: '🪑', label: isAr ? 'الطاولات المشغولة' : 'Occupied Tables', value: occupancyPct, suffix: '%', color: occupancyPct > 70 ? S.red : S.green, bg: occupancyPct > 70 ? S.redB : S.greenB, sub: `${stats!.occupied_tables} ${isAr ? 'من' : 'of'} ${stats!.total_tables} ${isAr ? 'طاولة' : 'tables'}`, path: '/dashboard/tables' },
          { icon: '📅', label: isAr ? 'حجوزات اليوم' : "Today's Bookings", value: stats!.bookings_today, color: S.purple, bg: S.purpleB, sub: `${stats!.pending_bookings} ${isAr ? 'معلق' : 'pending'}`, path: '/dashboard/bookings' },
          { icon: '👥', label: isAr ? 'إجمالي العملاء' : 'Total Customers', value: stats!.total_customers, color: S.blue, bg: S.blueB, sub: `${stats!.total_employees} ${isAr ? 'موظف نشط' : 'active staff'}`, path: '/dashboard/customers' },
          { icon: '📈', label: isAr ? 'إيرادات الأسبوع' : 'Weekly Revenue', value: stats!.revenue_week, prefix: 'MYR ', decimals: 0, color: S.teal, bg: S.tealB, sub: `${isAr ? 'الشهر' : 'Month'}: MYR ${stats!.revenue_month.toFixed(0)}`, path: '/dashboard/reports/monthly' },
        ].map((kpi, i) => (
          <div key={i} onClick={() => router.push(kpi.path)}
            style={{ background: kpi.bg, border: `1px solid ${kpi.color}30`, borderRadius: 18, padding: '20px 22px', cursor: 'pointer', animation: `fadeUp .4s ease ${i * 0.06}s both`, transition: 'transform .2s, box-shadow .2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px ${kpi.color}25` }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontSize: 28 }}>{kpi.icon}</div>
              <div style={{ fontSize: 11, color: kpi.color, background: `${kpi.color}20`, borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>{isAr ? 'مباشر' : 'Live'}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: kpi.color, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
              <AnimatedNumber value={kpi.value} prefix={kpi.prefix} suffix={kpi.suffix} decimals={kpi.decimals || 0} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, alignItems: 'stretch' }}>

        {/* Active Orders */}
        {/* ✅ Fix: العمود ده بقى flex بارتفاع كامل عشان يتمدد بنفس ارتفاع العمود التاني جنبه - كان بيوقف عند
            ارتفاع محتواه بس، فيبان "مش مضبوط" مقارنة بالعمود التاني اللي فيه بطاقتين مكدّسين */}
        <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>📋 {isAr ? 'الطلبات النشطة' : 'Active Orders'}</div>
            <button onClick={() => router.push('/dashboard/cashier')} style={{ fontSize: 12, color: S.gold, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>{isAr ? "عرض الكل ←" : "View All →"}</button>
          </div>
          <div style={{ padding: '8px 0', flex: 1, overflowY: 'auto' }}>
            {stats!.recent_orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: S.muted, fontSize: 13 }}>✅ {isAr ? 'لا توجد طلبات نشطة' : 'No active orders'}</div>
            ) : stats!.recent_orders.map(order => {
              const st = STATUS_CFG[order.status] || STATUS_CFG.confirmed
              return (
                <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, flexShrink: 0, animation: order.status === 'preparing' ? 'pulse 1.5s ease infinite' : 'none' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{order.table_name}</div>
                    {/* ✅ جديد: اسم الفرع - عشان طاولات بنفس الاسم بين فرعين متلخبطش مع بعض بصريًا */}
                    <div style={{ fontSize: 10, color: S.purple }}>🏪 {order.branch_name}</div>
                    <div style={{ fontSize: 11, color: S.muted }}>{order.time}</div>
                  </div>
                  <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{st.label}</span>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: S.gold }}>MYR {order.total.toFixed(2)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Items + Occupancy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
          {/* Occupancy Gauge - ✅ Fix: كل فرع بمقياسه المنفصل بدل رقم مجمّع بين الفروع */}
          <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '20px 22px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.white, marginBottom: 16 }}>🪑 {isAr ? 'إشغال الطاولات' : 'Table Occupancy'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {stats!.branch_occupancy.map((b, bi) => {
                const bPct = b.total > 0 ? Math.round((b.occupied / b.total) * 100) : 0
                return (
                  <div key={bi}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>🏪 {b.branch_name}</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: bPct > 70 ? S.red : S.green }}>{bPct}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 20, height: 10, overflow: 'hidden' }}>
                          <div style={{ width: `${bPct}%`, height: '100%', background: bPct > 70 ? `linear-gradient(90deg,${S.amber},${S.red})` : `linear-gradient(90deg,${S.green},${S.teal})`, borderRadius: 20, transition: 'width 1s ease' }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: S.muted, whiteSpace: 'nowrap' }}>{b.occupied} / {b.total} {isAr ? 'طاولة' : 'tables'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Items */}
          <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '20px 22px', flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.white, marginBottom: 14 }}>🔥 {isAr ? 'أكثر الأصناف طلباً (أسبوع)' : 'Top Items (Week)'}</div>
            {stats!.top_items.length === 0 ? (
              <div style={{ textAlign: 'center', color: S.muted, fontSize: 13, padding: 20 }}>{isAr ? 'لا توجد بيانات' : 'No data'}</div>
            ) : stats!.top_items.map((item, i) => {
              const max = stats!.top_items[0].count
              const pct = (item.count / max) * 100
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: S.white, fontWeight: i === 0 ? 700 : 400 }}>{item.name_en || item.name}</span>
                    <span style={{ fontSize: 12, color: S.gold, fontWeight: 700 }}>{item.count}×</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 20, height: 6 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: i === 0 ? `linear-gradient(90deg,${S.gold},${S.amber})` : `linear-gradient(90deg,${S.blue},${S.teal})`, borderRadius: 20 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Revenue Week Bar */}
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '20px 22px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>💰 {isAr ? 'ملخص الإيرادات' : 'Revenue Summary'}</div>
          <button onClick={() => router.push('/dashboard/reports/monthly')} style={{ fontSize: 12, color: S.gold, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>{isAr ? "التقرير الشهري ←" : "Monthly Report →"}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {[
            { label: isAr ? 'اليوم' : 'Today', value: stats!.revenue_today, color: S.gold },
            { label: isAr ? 'الأسبوع' : 'Week', value: stats!.revenue_week, color: S.green },
            { label: isAr ? 'الشهر' : 'Month', value: stats!.revenue_month, color: S.blue },
          ].map((r, i) => (
            <div key={i} style={{ background: S.card2, borderRadius: 14, padding: '16px 20px', textAlign: 'center', border: `1px solid ${r.color}20` }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>{r.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: r.color }}>MYR {r.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ جديد: ملخص المشتريات - بنفس شكل ملخص الإيرادات بالظبط */}
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '20px 22px', marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 20 }}>📦 {isAr ? 'ملخص المشتريات' : 'Purchases Summary'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {[
            { label: isAr ? 'اليوم' : 'Today', value: stats!.purchases_today, color: S.gold },
            { label: isAr ? 'الأسبوع' : 'Week', value: stats!.purchases_week, color: S.green },
            { label: isAr ? 'الشهر' : 'Month', value: stats!.purchases_month, color: S.blue },
          ].map((r, i) => (
            <div key={i} style={{ background: S.card2, borderRadius: 14, padding: '16px 20px', textAlign: 'center', border: `1px solid ${r.color}20` }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>{r.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: r.color }}>MYR {r.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ جديد: أعلى 3 طاولات (بمعرف فريد لكل طاولة، ما بيختلطش بين الفروع) - كل واحدة باسم فرعها */}
      {stats!.top_tables.length > 0 && (
        <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>🏆 {isAr ? 'أعلى 3 طاولات طلباً' : 'Top 3 Tables by Orders'}</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {stats!.top_tables.map((t, i) => (
              <div key={t.table_id} onClick={() => setSelectedTableId(t.table_id)}
                style={{ background: selectedTableId === t.table_id ? S.gold3 : S.card, border: `1px solid ${selectedTableId === t.table_id ? S.gold : S.border}`, borderRadius: 14, padding: '14px 12px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>#{i + 1}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: S.gold }}>{t.name}</div>
                <div style={{ fontSize: 11, color: S.purple, marginTop: 2 }}>🏪 {t.branch_name}</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{t.orders_count} {isAr ? 'طلب' : 'orders'}</div>
                <div style={{ fontSize: 13, color: S.blue, fontWeight: 800, marginTop: 4 }}>MYR {t.amount_month.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
            ))}
          </div>

          {/* ✅ منتقي التاريخ - بيشتغل على الطاولة المختارة من التلاتة فوق (الافتراضي: صاحبة الترتيب الأول) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, background: S.card, borderRadius: 12, padding: '10px 14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: S.muted }}>📅 {isAr ? `تفاصيل يوم لـ ${stats!.top_tables.find(t => t.table_id === selectedTableId)?.name || ''}:` : `Day details for ${stats!.top_tables.find(t => t.table_id === selectedTableId)?.name || ''}:`}</span>
            <input type="date" value={dateSearchValue} onChange={e => setDateSearchValue(e.target.value)}
              style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', color: S.white, fontSize: 13, outline: 'none', fontFamily: 'Tajawal, sans-serif' }} />
          </div>

          {dateSearchLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: S.muted, fontSize: 13 }}>⏳ {isAr ? 'جاري البحث...' : 'Searching...'}</div>
          ) : dateSearchResult && (
            <div style={{ background: S.card, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: dateSearchResult.orders.length > 0 ? 10 : 0 }}>
                <span style={{ fontSize: 13, color: S.white, fontWeight: 700 }}>{dateSearchResult.count} {isAr ? 'طلب في هذا اليوم' : 'orders this day'}</span>
                <span style={{ fontSize: 15, color: S.gold, fontWeight: 900 }}>MYR {dateSearchResult.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {dateSearchResult.orders.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {dateSearchResult.orders.map((o, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.muted, borderTop: `1px solid ${S.border}`, paddingTop: 6 }}>
                      <span>{o.time}</span>
                      <span style={{ color: S.white }}>MYR {o.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Access */}
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '20px 22px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 18 }}>⚡ {isAr ? 'الوصول السريع' : 'Quick Access'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 10 }}>
          {QUICK_LINKS.map((link, i) => (
            <div key={i} onClick={() => router.push(link.path)}
              style={{ background: link.bg, border: `1px solid ${link.color}30`, borderRadius: 14, padding: '14px 10px', cursor: 'pointer', textAlign: 'center', transition: 'transform .2s, box-shadow .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 20px ${link.color}25` }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{link.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: link.color, lineHeight: 1.3 }}>{link.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ جديد: نافذة كل الطلبات في يوم محدد - قابلة للفتح بضغطة واحدة، بتوقيت ماليزيا الدقيق */}
      {showAllOrdersModal && (
        <div onClick={() => setShowAllOrdersModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.gold}60`, padding: 20, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: S.gold, fontSize: 16, fontWeight: 800 }}>📋 {isAr ? 'كل الطلبات في يوم' : 'All Orders on a Day'}</h3>
              <button onClick={() => setShowAllOrdersModal(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: S.muted }}>📅</span>
              <input type="date" value={allOrdersDate} onChange={e => { setAllOrdersDate(e.target.value); searchAllOrdersByDate(e.target.value) }}
                style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 10px', color: S.white, fontSize: 13, outline: 'none', fontFamily: 'Tajawal, sans-serif' }} />
              <span style={{ fontSize: 10, color: S.muted }}>({isAr ? 'توقيت ماليزيا' : 'Malaysia time'})</span>
            </div>

            {allOrdersLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: S.muted, fontSize: 13 }}>⏳ {isAr ? 'جاري البحث...' : 'Searching...'}</div>
            ) : allOrdersResult && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: S.card, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: S.white, fontWeight: 700 }}>{allOrdersResult.count} {isAr ? 'طلب إجمالي' : 'total orders'}</span>
                  <span style={{ fontSize: 15, color: S.gold, fontWeight: 900 }}>MYR {allOrdersResult.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 10, color: S.muted, fontWeight: 400 }}>({isAr ? 'مدفوع' : 'paid'})</span></span>
                </div>
                {allOrdersResult.orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: S.muted, fontSize: 13 }}>{isAr ? 'لا توجد طلبات في هذا اليوم' : 'No orders on this day'}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {allOrdersResult.orders.map((o, i) => {
                      const st = STATUS_CFG[o.status] || { label: o.status, color: S.muted, bg: S.card }
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{o.table}</div>
                            <div style={{ fontSize: 10, color: S.purple }}>🏪 {o.branch} · {o.time}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>{st.label}</span>
                            <span style={{ fontSize: 13, color: S.gold, fontWeight: 800 }}>MYR {o.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
