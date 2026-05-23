'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const ROLE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
admin:               { label: 'مدير النظام',      icon: '👑', color: S.gold },
branch_manager:      { label: 'مدير الفرع',       icon: '🏪', color: '#8B5CF6' },
kitchen_manager:     { label: 'مدير المطبخ',      icon: '🍳', color: '#F97316' },
hall_manager:        { label: 'مدير الصالة',      icon: '🏛️', color: '#06B6D4' },
kitchen_supervisor:  { label: 'مشرف المطبخ',      icon: '👨‍🍳', color: S.red },
hall_supervisor:     { label: 'مشرف الصالة',      icon: '🍽️', color: S.blue },
bar_supervisor:      { label: 'مشرف البار',       icon: '☕', color: '#14B8A6' },
assistant_supervisor:{ label: 'مساعد مشرف',       icon: '🤝', color: '#A78BFA' },
cashier:             { label: 'كاشير',            icon: '💰', color: S.green },
assistant_cashier:   { label: 'مساعد كاشير',      icon: '💳', color: '#34D399' },
chef:                { label: 'طباخ',             icon: '🧑‍🍳', color: '#FB923C' },
assistant_chef:      { label: 'مساعد طباخ',       icon: '🥘', color: '#FCA5A5' },
kitchen_worker:      { label: 'عامل مطبخ',        icon: '🔪', color: '#FCD34D' },
bar_assistant:       { label: 'مساعد بار',        icon: '🧃', color: '#5EEAD4' },
hall_worker:         { label: 'عامل صالة',        icon: '🪑', color: '#93C5FD' },
employee:            { label: 'موظف',             icon: '👤', color: S.muted },
}

interface MenuItem {
  label: string; icon: string; path: string; permission: string | null
}
interface MenuGroup {
  group: string; items: MenuItem[]
}

const ALL_MENU: MenuGroup[] = [
  {
    group: 'الرئيسية',
    items: [
      { label: 'لوحة التحكم', icon: '◉', path: '/dashboard', permission: null },
    ]
  },
  {
    group: 'إدارة المخزون',
    items: [
      { label: 'المستودعات',    icon: '🏭', path: '/dashboard/warehouse',       permission: 'warehouse' },
      { label: 'المشتريات',     icon: '🛒', path: '/dashboard/purchases',       permission: 'purchases' },
      { label: 'طلبات الفروع', icon: '📦', path: '/dashboard/branch-requests', permission: 'branch_requests' },
    ]
  },
  {
    group: 'العمليات',
    items: [
      { label: 'المطبخ',   icon: '👨‍🍳', path: '/dashboard/kitchen',  permission: 'kitchen' },
      { label: 'الحلويات', icon: '🍰', path: '/dashboard/desserts', permission: 'desserts' },
      { label: 'البار',    icon: '☕', path: '/dashboard/bar',      permission: 'bar' },
      { label: 'الكاشير',  icon: '🏧', path: '/dashboard/cashier', permission: 'cashier' },
      { label: 'الطاولات', icon: '🪑', path: '/dashboard/tables',  permission: 'tables' },
    ]
  },
  {
    group: 'قائمة الطعام',
    items: [
      { label: 'الأصناف (المنيو)', icon: '📖', path: '/dashboard/menu/items',      permission: 'menu' },
      { label: 'التصنيفات',        icon: '📁', path: '/dashboard/menu/categories', permission: 'menu' },
      { label: 'إضافات الأصناف',  icon: '➕', path: '/dashboard/menu/modifiers',  permission: 'menu' },
    ]
  },
  {
    group: 'العملاء والبيع',
    items: [
      { label: 'حجوزات العملاء',       icon: '📅', path: '/dashboard/bookings',  permission: 'bookings' },
      { label: 'قاعدة بيانات العملاء', icon: '👥', path: '/dashboard/customers', permission: 'customers' },
      { label: 'نقاط الولاء',          icon: '🎁', path: '/dashboard/loyalty',   permission: 'loyalty' },
    ]
  },
  {
    group: 'التسويق والنمو',
    items: [
      { label: 'الحملات الإعلانية', icon: '📢', path: '/dashboard/marketing/campaigns',     permission: 'marketing' },
      { label: 'كوبونات الخصم',    icon: '🎫', path: '/dashboard/coupons',       permission: 'marketing' },
      { label: 'إرسال الإشعارات',  icon: '📲', path: '/dashboard/marketing/notifications', permission: 'marketing' },
    ]
  },
  {
    group: 'المالية والحسابات',
    items: [
      { label: 'التقارير اليومية', icon: '📊', path: '/dashboard/reports/daily',   permission: 'reports' },
      { label: 'شجرة الحسابات',   icon: '🧾', path: '/dashboard/accounting/chart',   permission: 'accounting' },
      { label: 'سندات القيد',     icon: '💸', path: '/dashboard/accounting/entries', permission: 'accounting' },
      { label: 'الخزينة والبنوك', icon: '🏦', path: '/dashboard/accounting/banks',   permission: 'accounting' },
    ]
  },
  {
    group: 'الموارد البشرية',
    items: [
      { label: 'الموظفون',        icon: '👷', path: '/dashboard/hr/employees', permission: 'hr' },
      { label: 'طلبات الموظفين', icon: '📋', path: '/dashboard/hr/requests',  permission: 'my_requests' },
      { label: 'إدارة الشيفتات', icon: '🕐', path: '/dashboard/hr/shifts', permission: 'my_requests' },
      { label: ' الرواتب و الإجور', icon: '💰', path: '/dashboard/hr/payroll',   permission: 'my_payroll' },
      { label: 'الحضور والانصراف', icon: '⏰', path: '/dashboard/hr/attendance', permission: 'attendance' },
    ]
  },
  {
    group: 'التقارير',
    items: [
      { label: 'التقارير الشهرية',icon: '📈', path: '/dashboard/reports/monthly', permission: 'reports' },
      { label: 'تحليل التكاليف', icon: '💰', path: '/dashboard/reports/costs',   permission: 'reports' },
    ]
  },
  {
    group: 'الإعدادات',
    items: [
      { label: 'الموردون',        icon: '🤝', path: '/dashboard/suppliers',            permission: 'suppliers' },
      { label: 'إدارة الصلاحيات',icon: '🔐', path: '/dashboard/settings/permissions', permission: 'permissions' },
      { label: 'الإعدادات',      icon: '⚙️', path: '/dashboard/settings',            permission: 'settings' },
    ]
  },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { employee, permissions, hasPermission, signOut, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  // حفظ موضع السايدبار في localStorage واستعادته عند التحديث
  useEffect(() => {
    const saved = sessionStorage.getItem('sidebar-scroll')
    if (saved && sidebarRef.current) {
      sidebarRef.current.scrollTop = parseInt(saved)
    }
  }, [])

  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    const handleScroll = () => sessionStorage.setItem('sidebar-scroll', String(el.scrollTop))
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const roleInfo = ROLE_LABELS[employee?.role || 'employee'] || ROLE_LABELS.employee
  const isAdmin = permissions?.all === true

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontFamily: 'Tajawal, sans-serif', fontSize: 18 }}>
      🌸 جاري التحميل...
    </div>
  )
  
  // فلتر القائمة بناءً على الصلاحيات
const visibleMenu = useMemo(() => 
  ALL_MENU.map(group => ({
    ...group,
    items: group.items.filter(item =>
      item.permission === null ||
      isAdmin ||
      hasPermission(item.permission)
    )
  })).filter(group => group.items.length > 0)
, [permissions, employee])

  const notifications = [
    { text: 'مخزون اللحم البقري منخفض', time: 'منذ 10 دقائق' },
    { text: 'تم استلام فاتورة جديدة',   time: 'منذ 30 دقيقة' },
    { text: 'تقرير اليوم جاهز',          time: 'منذ ساعة' },
  ]

  const currentPageLabel = ALL_MENU.flatMap(g => g.items).find(i =>
    i.path === pathname || (i.path !== '/dashboard' && pathname.startsWith(i.path))
  )?.label || 'لوحة التحكم'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>

      {/* ══ HEADER ══ */}
      <header style={{ position: 'fixed', top: 0, right: 0, left: 0, zIndex: 100, height: 60, background: S.navy2, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', gap: 16 }}>

        {/* Right: Logo + Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}>☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: `0 0 12px ${S.goldB}` }}>🌸</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: S.white, lineHeight: 1.2 }}>Orchid Group</div>
              <div style={{ fontSize: 10, color: S.gold, letterSpacing: 1 }}>Restaurant Management</div>
            </div>
          </div>
        </div>

        {/* Center: Page Title */}
        <div style={{ fontSize: 14, color: S.muted, flex: 1, textAlign: 'center' }}>{currentPageLabel}</div>

        {/* Left: Notifications + User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setNotifOpen(p => !p)} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
              🔔
              <span style={{ position: 'absolute', top: 6, left: 6, width: 8, height: 8, borderRadius: '50%', background: S.red, border: `1px solid ${S.navy2}` }} />
            </button>
            {notifOpen && (
              <div style={{ position: 'absolute', top: 44, left: 0, width: 280, background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 14, padding: 8, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <div style={{ fontSize: 12, color: S.gold, padding: '6px 10px', fontWeight: 700, marginBottom: 4 }}>التنبيهات</div>
                {notifications.map((n, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: i % 2 === 0 ? S.card : 'transparent', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, color: S.white, marginBottom: 3 }}>{n.text}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>{n.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: S.card, borderRadius: 10, padding: '6px 12px', border: `1px solid ${S.border}` }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: S.white, lineHeight: 1.2 }}>
                {employee?.name || 'المستخدم'}
              </div>
              <div style={{ fontSize: 10, color: roleInfo.color }}>
                {roleInfo.icon} {roleInfo.label}
              </div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: S.goldB, border: `1px solid ${S.gold3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: S.gold }}>
              {employee?.name?.charAt(0) || '؟'}
            </div>
          </div>
        </div>
      </header>

      {/* ══ BODY ══ */}
      <div style={{ display: 'flex', marginTop: 60, minHeight: 'calc(100vh - 60px)' }}>

        {/* ══ SIDEBAR ══ */}
        <aside ref={sidebarRef} style={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: sidebarOpen ? 230 : 0, background: S.navy3, borderLeft: `1px solid ${S.border}`, overflowY: 'auto', overflowX: 'hidden', transition: 'width 0.25s ease', zIndex: 90 }}>
          <div style={{ width: 230, padding: '12px 0' }}>

            {/* بيانات الموظف في السايدبار */}
            {employee && (
              <div style={{ margin: '0 12px 12px', background: S.card, borderRadius: 12, padding: '12px 14px', border: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 2 }}>{employee.name}</div>
                <div style={{ fontSize: 11, color: roleInfo.color, marginBottom: employee.department ? 4 : 0 }}>
                  {roleInfo.icon} {roleInfo.label}
                </div>
                {employee.department && <div style={{ fontSize: 10, color: S.muted }}>🏷️ {employee.department}</div>}
              </div>
            )}

            {/* القائمة — حسب الصلاحيات فقط */}
            {visibleMenu.map((group, gi) => (
              <div key={gi} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: S.muted, fontWeight: 700, padding: '8px 18px 4px', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {group.group}
                </div>
                {group.items.map((item, ii) => {
                  const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path))
                  return (
                    <button key={ii}
                     onClick={() => {
  router.push(item.path)
}}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: active ? S.gold3 : 'transparent', border: 'none', borderRight: active ? `3px solid ${S.gold}` : '3px solid transparent', cursor: 'pointer', textAlign: 'right', transition: 'all 0.15s', color: active ? S.gold : S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: active ? 700 : 400 }}>
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <span>{item.label}</span>
                      {active && <span style={{ marginRight: 'auto', width: 6, height: 6, borderRadius: '50%', background: S.gold }} />}
                    </button>
                  )
                })}
              </div>
            ))}

            {/* تسجيل الخروج */}
            <div style={{ borderTop: `1px solid ${S.border}`, margin: '8px 0', paddingTop: 8 }}>
              <button onClick={signOut} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: 'transparent', border: 'none', cursor: 'pointer', color: S.red, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                <span>🚪</span>
                <span>تسجيل الخروج</span>
              </button>
            </div>

          </div>
        </aside>

        {/* ══ MAIN CONTENT ══ */}
        <main style={{ marginRight: sidebarOpen ? 230 : 0, flex: 1, padding: '24px', transition: 'margin-right 0.25s ease', minHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${S.navy}; }
        aside::-webkit-scrollbar { width: 6px; }
        aside::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        aside::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #C9A84C, #8B6914); border-radius: 3px; }
        aside::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #E8C97A, #C9A84C); }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}
