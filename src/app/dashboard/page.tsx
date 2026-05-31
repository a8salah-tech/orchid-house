'use client'


import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useAuth } from '../components/AuthProvider'
import { useLang } from '../components/LanguageContext'

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
  total_customers: number; bookings_today: number
  revenue_week: number; revenue_month: number
  top_items: { name: string; name_en: string; count: number }[]
  recent_orders: { id: string; table_name: string; status: string; total: number; time: string }[]
  waiter_calls: number; pending_bookings: number; low_stock: number
  paid_today: number; cancelled_today: number
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

const ROLE_LABELS: Record<string, { label: string; label_en: string; icon: string }> = {
  admin:              { label: 'مدير النظام',  label_en: 'System Admin',       icon: '👑' },
  branch_manager:     { label: 'مدير الفرع',   label_en: 'Branch Manager',     icon: '🏪' },
  kitchen_manager:    { label: 'مدير المطبخ',  label_en: 'Kitchen Manager',    icon: '🍳' },
  hall_manager:       { label: 'مدير الصالة',  label_en: 'Hall Manager',       icon: '🏛️' },
  kitchen_supervisor: { label: 'مشرف المطبخ',  label_en: 'Kitchen Supervisor', icon: '👨‍🍳' },
  hall_supervisor:    { label: 'مشرف الصالة',  label_en: 'Hall Supervisor',    icon: '🍽️' },
  bar_supervisor:     { label: 'مشرف البار',   label_en: 'Bar Supervisor',     icon: '☕' },
  cashier:            { label: 'كاشير',         label_en: 'Cashier',            icon: '💰' },
  employee:           { label: 'موظف',          label_en: 'Employee',           icon: '👤' },
}

function EmployeeDashboard({ employee }: { employee: any }) {
  const router = useRouter()
  const { isAr } = useLang()
  const role = ROLE_LABELS[employee?.role || 'employee'] || ROLE_LABELS.employee
  const hour = new Date().getHours()
  const greeting = isAr ? (hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور') : (hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening')

  const MY_LINKS = [
    { icon: '🏧', label: isAr ? 'الكاشير' : 'Cashier',     path: '/dashboard/cashier',          show: ['cashier','admin','branch_manager'] },
    { icon: '👨‍🍳', label: isAr ? 'المطبخ' : 'Kitchen',    path: '/dashboard/kitchen',           show: ['kitchen_supervisor','admin'] },
    { icon: '🍰', label: isAr ? 'الحلويات' : 'Desserts',    path: '/dashboard/desserts',          show: ['employee','admin'] },
    { icon: '☕', label: isAr ? 'البار' : 'Bar',       path: '/dashboard/bar',              show: ['bar_supervisor','admin'] },
    { icon: '🪑', label: isAr ? 'الطاولات' : 'Tables',   path: '/dashboard/tables',           show: ['hall_supervisor','cashier','admin'] },
    { icon: '💰', label: isAr ? 'راتبي' : 'My Salary',       path: '/dashboard/hr/payroll',       show: ['employee','cashier','kitchen_supervisor','hall_supervisor','bar_supervisor','admin'] },
    { icon: '⏰', label: isAr ? 'حضوري' : 'Attendance',       path: '/dashboard/hr/attendance',    show: ['employee','cashier','kitchen_supervisor','hall_supervisor','bar_supervisor','admin'] },
    { icon: '📋', label: isAr ? 'طلباتي' : 'My Requests',      path: '/dashboard/hr/requests',      show: ['employee','cashier','kitchen_supervisor','hall_supervisor','bar_supervisor','admin'] },
    { icon: '🕐', label: isAr ? 'الشيفتات' : 'Shifts',   path: '/dashboard/hr/shifts',        show: ['employee','cashier','kitchen_supervisor','hall_supervisor','bar_supervisor','admin'] },
  ].filter(l => l.show.includes(employee?.role || 'employee'))

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Greeting */}
      <div style={{ background: `linear-gradient(135deg,${S.navy2},${S.navy3})`, borderRadius: 20, border: `1px solid ${S.border}`, padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, animation: 'fadeUp .4s ease' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg,${S.gold},${S.gold2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>
          {role.icon}
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: S.gold, marginBottom: 4 }}>{greeting}، {employee?.name}!</h1>
          <div style={{ fontSize: 14, color: S.muted }}>{isAr ? role.label : role.label_en}{employee?.department ? ` · ${employee.department}` : ''}</div>
          <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>
            {new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ marginRight: 'auto', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: S.white, fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleTimeString(isAr ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'الوقت الحالي' : 'Current Time'}</div>
        </div>
      </div>

      {/* Quick Links for employee */}
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '20px 22px', marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>⚡ {isAr ? 'وصول سريع' : 'Quick Access'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 12 }}>
          {MY_LINKS.map((link, i) => (
            <div key={i} onClick={() => router.push(link.path)}
              style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 14, padding: '16px 10px', cursor: 'pointer', textAlign: 'center', transition: 'all .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.gold3; (e.currentTarget as HTMLElement).style.borderColor = S.gold + '50' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = S.card2; (e.currentTarget as HTMLElement).style.borderColor = S.border }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{link.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: S.white }}>{link.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Announcement box */}
      <div style={{ background: S.gold3, border: `1px solid ${S.gold}40`, borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 28 }}>🌸</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 2 }}>{isAr ? 'مرحباً بك في Orchid House' : 'Welcome to Orchid House'}</div>
          <div style={{ fontSize: 12, color: S.muted }}>{isAr ? 'لديك أي استفسار؟ تواصل مع المدير المباشر. نتمنى لك يوم عمل موفق!' : 'Any questions? Contact your manager. Have a great shift!'}</div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { employee } = useAuth()
  const isAdmin = employee?.role === 'admin' || employee?.role === 'branch_manager'
  if (!isAdmin) return <EmployeeDashboard employee={employee} />
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

  const fetchStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    const [mainRes, topItemsRes, recentRes, waiterRes, bookingsRes, stockRes] = await Promise.all([
      Promise.resolve(null),
      sb.from('order_items')
        .select('menu_items(name,name_en)', { count: 'exact' })
        .gte('created_at', weekAgo)
        .limit(100),
      sb.from('orders')
        .select('id,table_id,status,total_amount,created_at,tables(name,number)')
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
      revenueWeek, revenueMonth
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
    ])

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
      time: new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }))

    setStats({
      orders_today: ordersToday, revenue_today: revenueToday,
      active_orders: activeOrders, occupied_tables: occupiedTables,
      total_tables: totalTables, total_employees: totalEmployees,
      total_customers: totalCustomers, bookings_today: 0,
      revenue_week: revenueWeek, revenue_month: revenueMonth,
      top_items: topItems, recent_orders: recentOrders,
      waiter_calls: waiterRes.count || 0,
      pending_bookings: bookingsRes.count || 0,
      low_stock: stockRes.count || 0,
      paid_today: paidToday, cancelled_today: cancelledToday,
    })
    setLoading(false)
  }, [sb])

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Active Orders */}
        <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>📋 {isAr ? 'الطلبات النشطة' : 'Active Orders'}</div>
            <button onClick={() => router.push('/dashboard/cashier')} style={{ fontSize: 12, color: S.gold, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>{isAr ? "عرض الكل ←" : "View All →"}</button>
          </div>
          <div style={{ padding: '8px 0', maxHeight: 320, overflowY: 'auto' }}>
            {stats!.recent_orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: S.muted, fontSize: 13 }}>✅ {isAr ? 'لا توجد طلبات نشطة' : 'No active orders'}</div>
            ) : stats!.recent_orders.map(order => {
              const st = STATUS_CFG[order.status] || STATUS_CFG.confirmed
              return (
                <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, flexShrink: 0, animation: order.status === 'preparing' ? 'pulse 1.5s ease infinite' : 'none' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{order.table_name}</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Occupancy Gauge */}
          <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: '20px 22px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.white, marginBottom: 16 }}>🪑 {isAr ? 'إشغال الطاولات' : 'Table Occupancy'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 20, height: 12, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${occupancyPct}%`, height: '100%', background: occupancyPct > 70 ? `linear-gradient(90deg,${S.amber},${S.red})` : `linear-gradient(90deg,${S.green},${S.teal})`, borderRadius: 20, transition: 'width 1s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: S.muted }}>
                  <span>0</span><span>{stats!.total_tables} {isAr ? 'طاولة' : 'tables'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 70 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: occupancyPct > 70 ? S.red : S.green }}>{occupancyPct}%</div>
                <div style={{ fontSize: 11, color: S.muted }}>{stats!.occupied_tables} {isAr ? 'مشغول' : 'occupied'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
              {[
                { label: isAr ? 'مشغول' : 'Occupied', value: stats!.occupied_tables, color: S.red },
                { label: isAr ? 'متاح' : 'Available', value: stats!.total_tables - stats!.occupied_tables, color: S.green },
                { label: isAr ? 'إجمالي' : 'Total', value: stats!.total_tables, color: S.muted },
              ].map((t, i) => (
                <div key={i} style={{ textAlign: 'center', background: S.card, borderRadius: 10, padding: '8px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: t.color }}>{t.value}</div>
                  <div style={{ fontSize: 10, color: S.muted }}>{t.label}</div>
                </div>
              ))}
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
    </div>
  )
}
