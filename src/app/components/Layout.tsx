'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import NotificationBell from './NotificationBell'
import { LanguageContext } from './LanguageContext'

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

const T = {
  ar: {
    loading: 'جاري التحميل...', signOut: 'تسجيل الخروج', dashboard: 'لوحة التحكم',
    groups: {
      'الرئيسية': 'الرئيسية', 'إدارة المخزون': 'إدارة المخزون', 'العمليات': 'العمليات',
      'قائمة الطعام': 'قائمة الطعام', 'العملاء والبيع': 'العملاء والبيع',
      'التسويق والنمو': 'التسويق والنمو', 'المالية والحسابات': 'المالية والحسابات',
      'الموارد البشرية': 'الموارد البشرية', 'التقارير': 'التقارير', 'الإعدادات': 'الإعدادات',
    },
  },
  en: {
    loading: 'Loading...', signOut: 'Sign Out', dashboard: 'Dashboard',
    groups: {
      'الرئيسية': 'Main', 'إدارة المخزون': 'Inventory', 'العمليات': 'Operations',
      'قائمة الطعام': 'Menu', 'العملاء والبيع': 'Customers & Sales',
      'التسويق والنمو': 'Marketing', 'المالية والحسابات': 'Finance',
      'الموارد البشرية': 'HR', 'التقارير': 'Reports', 'الإعدادات': 'Settings',
    },
  },
}

const ROLE_LABELS: Record<string, { ar: string; en: string; icon: string; color: string }> = {
  admin:               { ar: 'مدير النظام',   en: 'System Admin',       icon: '👑', color: S.gold },
  branch_manager:      { ar: 'مدير الفرع',    en: 'Branch Manager',     icon: '🏪', color: '#8B5CF6' },
  kitchen_manager:     { ar: 'مدير المطبخ',   en: 'Kitchen Manager',    icon: '🍳', color: '#F97316' },
  hall_manager:        { ar: 'مدير الصالة',   en: 'Hall Manager',       icon: '🏛️', color: '#06B6D4' },
  kitchen_supervisor:  { ar: 'مشرف المطبخ',   en: 'Kitchen Supervisor', icon: '👨‍🍳', color: S.red },
  hall_supervisor:     { ar: 'مشرف الصالة',   en: 'Hall Supervisor',    icon: '🍽️', color: S.blue },
  bar_supervisor:      { ar: 'مشرف البار',    en: 'Bar Supervisor',     icon: '☕', color: '#14B8A6' },
  assistant_supervisor:{ ar: 'مساعد مشرف',    en: 'Asst. Supervisor',   icon: '🤝', color: '#A78BFA' },
  cashier:             { ar: 'كاشير',         en: 'Cashier',            icon: '💰', color: S.green },
  assistant_cashier:   { ar: 'مساعد كاشير',   en: 'Asst. Cashier',      icon: '💳', color: '#34D399' },
  chef:                { ar: 'طباخ',          en: 'Chef',               icon: '🧑‍🍳', color: '#FB923C' },
  assistant_chef:      { ar: 'مساعد طباخ',    en: 'Asst. Chef',         icon: '🥘', color: '#FCA5A5' },
  kitchen_worker:      { ar: 'عامل مطبخ',     en: 'Kitchen Worker',     icon: '🔪', color: '#FCD34D' },
  bar_assistant:       { ar: 'مساعد بار',     en: 'Bar Assistant',      icon: '🧃', color: '#5EEAD4' },
  hall_worker:         { ar: 'عامل صالة',     en: 'Hall Worker',        icon: '🪑', color: '#93C5FD' },
  warehouse_keeper:    { ar: 'أمين المستودع', en: 'Warehouse Keeper',   icon: '🏭', color: '#F97316' },
  employee:            { ar: 'موظف',          en: 'Employee',           icon: '👤', color: S.muted },
}

interface MenuItemType { label: string; label_en: string; icon: string; path: string; permission: string | null }
interface MenuGroup { group: string; items: MenuItemType[] }

const ALL_MENU: MenuGroup[] = [
  { group: 'الرئيسية', items: [
    { label: 'لوحة التحكم', label_en: 'Dashboard', icon: '◉', path: '/dashboard', permission: null },
  ]},
{ group: 'إدارة المخزون', items: [
    { label: 'المستودعات',   label_en: 'Warehouses',      icon: '🏭', path: '/dashboard/warehouse',       permission: 'warehouse' },
    { label: 'تقارير الجرد', label_en: 'Inventory Reports', icon: '📋', path: '/dashboard/inventory-reports', permission: 'inventory_reports' },
    { label: 'المشتريات',    label_en: 'Purchases',       icon: '🛒', path: '/dashboard/purchases',       permission: 'purchases' },
    { label: 'طلبات الفروع', label_en: 'Branch Requests', icon: '📦', path: '/dashboard/branch-requests', permission: 'branch_requests' },
    { label: 'طلبات المستودع الداخلي', label_en: 'Internal Warehouse Requests', icon: '🏭', path: '/dashboard/internal-warehouse-requests', permission: 'internal_warehouse_requests' },
    { label: 'سجل الهدر',   label_en: 'Waste Log',       icon: '🗑️', path: '/dashboard/waste',           permission: 'waste' },
]},
  { group: 'العمليات', items: [
    { label: 'المطبخ',   label_en: 'Kitchen',  icon: '👨‍🍳', path: '/dashboard/kitchen',  permission: 'kitchen' },
    { label: 'الحلويات', label_en: 'Desserts', icon: '🍰',  path: '/dashboard/desserts', permission: 'desserts' },
    { label: 'البار',    label_en: 'Bar',      icon: '☕',  path: '/dashboard/bar',      permission: 'bar' },
    { label: 'مستودع التجهيزات', label_en: 'Prep Warehouse', icon: '🏭', path: '/dashboard/prep-warehouse', permission: 'prep_warehouse' },
    { label: 'الكاشير',  label_en: 'Cashier',  icon: '🏧',  path: '/dashboard/cashier',  permission: 'cashier' },
    { label: 'الطاولات', label_en: 'Tables',   icon: '🪑',  path: '/dashboard/tables',   permission: 'tables' },
  ]},
  { group: 'قائمة الطعام', items: [
    { label: 'الأصناف (المنيو)', label_en: 'Menu Items', icon: '📖', path: '/dashboard/menu/items', permission: 'menu' },
  ]},
  { group: 'العملاء والبيع', items: [
    { label: 'حجوزات العملاء',       label_en: 'Reservations',     icon: '📅', path: '/dashboard/bookings',  permission: 'bookings' },
    { label: 'قاعدة بيانات العملاء', label_en: 'Customer Database', icon: '👥', path: '/dashboard/customers', permission: 'customers' },
    { label: 'نقاط الولاء',          label_en: 'Loyalty Points',    icon: '🎁', path: '/dashboard/loyalty',   permission: 'loyalty' },
  ]},
  { group: 'التسويق والنمو', items: [
    { label: 'كوبونات الخصم', label_en: 'Coupons',       icon: '🎫', path: '/dashboard/coupons',       permission: 'marketing' },
    { label: 'الإشعارات',     label_en: 'Notifications', icon: '📲', path: '/dashboard/notifications', permission: 'marketing' },
   { label: 'التسويق', label_en: 'Marketing Hub', icon: '📣', path: '/dashboard/marketing', permission: null },
  ]},
  { group: 'المالية والحسابات', items: [
    { label: 'التقارير اليومية',      label_en: 'Daily Reports',    icon: '📊', path: '/dashboard/reports/daily',       permission: 'reports' },
    { label: 'سندات القيد',           label_en: 'Journal Entries',  icon: '💸', path: '/dashboard/accounting/entries',  permission: 'accounting' },
    { label: 'شجرة الحسابات',         label_en: 'Chart of Accounts',icon: '🧾', path: '/dashboard/accounting/chart',   permission: 'accounting' },
    { label: 'تقرير الأرباح والخسائر',label_en: 'P&L Report',       icon: '📉', path: '/dashboard/reports/pl',         permission: 'reports' },
  ]},
  { group: 'الموارد البشرية', items: [
    { label: 'سياسات العمل',    label_en: 'Work Policies', icon: '📜', path: '/dashboard/hr/policies',  permission: 'my_requests' },
    { label: 'راتبي', label_en: 'My Salary', icon: '💰', path: '/dashboard/hr/my-salary', permission: 'my_requests' },
    { label: 'دوامي', label_en: 'My Schedule', icon: '📅', path: '/dashboard/hr/my-schedule', permission: 'my_requests' },
    { label: 'الموظفون',        label_en: 'Employees',     icon: '👷', path: '/dashboard/hr/employees', permission: 'hr' },
    { label: 'المخالفات', label_en: 'Violations', icon: '⚠️', path: '/dashboard/hr/violations', permission: 'violations' },
    { label: 'طلبات الموظفين',  label_en: 'Staff Requests',icon: '📋', path: '/dashboard/hr/requests',  permission: 'my_requests' },
    { label: 'إدارة الشيفتات',  label_en: 'Shifts',        icon: '🕐', path: '/dashboard/hr/shifts',    permission: 'my_requests' },
    { label: 'الرواتب والأجور', label_en: 'Payroll', icon: '💰', path: '/dashboard/hr/payroll', permission: 'payroll' },
    { label: 'الحضور والانصراف',label_en: 'Attendance',    icon: '⏰', path: '/dashboard/hr/attendance', permission: 'attendance' },
  ]},
  { group: 'التقارير', items: [
    { label: 'التقارير الشهرية', label_en: 'Monthly Reports', icon: '📈', path: '/dashboard/reports/monthly', permission: 'reports' },
    { label: 'تحليل التكاليف',  label_en: 'Cost Analysis',   icon: '💰', path: '/dashboard/reports/costs',   permission: 'reports' },
  ]},
  { group: 'الإعدادات', items: [
    { label: 'الموردون',         label_en: 'Suppliers',   icon: '🤝', path: '/dashboard/suppliers',            permission: 'suppliers' },
    { label: 'إدارة الصلاحيات', label_en: 'Permissions', icon: '🔐', path: '/dashboard/settings/permissions', permission: 'permissions' },
  ]},
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { employee, permissions, hasPermission, signOut, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function checkMobile() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  const [lang, setLang] = useState<'ar' | 'en'>('en')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = sessionStorage.getItem('sidebar-collapsed')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('sidebar-scroll')
    if (saved && sidebarRef.current) sidebarRef.current.scrollTop = parseInt(saved)
    const savedLang = localStorage.getItem('dashboard-lang')
    setLang((savedLang === 'en' || savedLang === 'ar') ? savedLang : 'en')
  }, [])

  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    const h = () => sessionStorage.setItem('sidebar-scroll', String(el.scrollTop))
    el.addEventListener('scroll', h)
    return () => el.removeEventListener('scroll', h)
  }, [])

  function toggleLang() {
    const next = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    localStorage.setItem('dashboard-lang', next)
  }

  function toggleGroup(group: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(group) ? next.delete(group) : next.add(group)
      sessionStorage.setItem('sidebar-collapsed', JSON.stringify([...next]))
      return next
    })
  }

  const t = T[lang]
  const isAr = lang === 'ar'
  const roleInfo = ROLE_LABELS[employee?.role || 'employee'] || ROLE_LABELS.employee
  const isAdmin = permissions?.all === true

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontFamily: 'Tajawal, sans-serif', fontSize: 18 }}>
      🌸 {t.loading}
    </div>
  )

  const visibleMenu = useMemo(() =>
    ALL_MENU.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.permission === null || item.permission === 'all_employees' || isAdmin || hasPermission(item.permission)
      )
    })).filter(group => group.items.length > 0)
  , [permissions, employee])

  const currentPageLabel = ALL_MENU.flatMap(g => g.items).find(i =>
    i.path === pathname || (i.path !== '/dashboard' && pathname.startsWith(i.path))
  )

  return (
    <LanguageContext.Provider value={{ lang, isAr }}>
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr' }}>

      {/* ══ HEADER ══ */}
      <header style={{ position: 'fixed', top: 0, right: 0, left: 0, zIndex: 100, height: 60, background: S.navy2, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 20, padding: 4 }}>☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="Orchid" style={{ width: 100, height: 100, borderRadius: 12, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: S.white, lineHeight: 1.2 }}>Orchid Group</div>
              <div style={{ fontSize: 10, color: S.gold, letterSpacing: 1 }}>Restaurant Management</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 14, color: S.muted, flex: 1, textAlign: 'center' }}>
          {currentPageLabel ? (isAr ? currentPageLabel.label : currentPageLabel.label_en) : t.dashboard}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggleLang} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.card, color: S.gold, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Tajawal, sans-serif', letterSpacing: 1 }}>
            {lang === 'ar' ? 'EN' : 'عر'}
          </button>
          <NotificationBell />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: S.card, borderRadius: 10, padding: '6px 12px', border: `1px solid ${S.border}` }}>
            <div style={{ textAlign: isAr ? 'right' : 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: S.white, lineHeight: 1.2 }}>{employee?.name || 'User'}</div>
              <div style={{ fontSize: 10, color: roleInfo.color }}>{roleInfo.icon} {isAr ? roleInfo.ar : roleInfo.en}</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: S.goldB, border: `1px solid ${S.gold3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: S.gold }}>
              {employee?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </div>
        </div>
      </header>

      {/* ══ BODY ══ */}
      <div style={{ display: 'flex', marginTop: 60, minHeight: 'calc(100vh - 60px)' }}>

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 89 }} />
        )}

        {/* ══ SIDEBAR ══ */}
        <aside ref={sidebarRef} style={{ position: 'fixed', top: 60, [isAr ? 'right' : 'left']: 0, bottom: 0, width: sidebarOpen ? 230 : 0, background: S.navy3, [isAr ? 'borderLeft' : 'borderRight']: `1px solid ${S.border}`, overflowY: 'auto', overflowX: 'hidden', transition: 'width 0.25s ease', zIndex: 90 }}>
          <div style={{ width: 230, padding: '12px 0' }}>

            {employee && (
              <div style={{ margin: '0 12px 12px', background: S.card, borderRadius: 12, padding: '12px 14px', border: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 2 }}>{employee.name}</div>
                <div style={{ fontSize: 11, color: roleInfo.color }}>{roleInfo.icon} {isAr ? roleInfo.ar : roleInfo.en}</div>
                {employee.department && <div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>🏷️ {employee.department}</div>}
              </div>
            )}

            {visibleMenu.map((group, gi) => {
              const isCollapsed = collapsedGroups.has(group.group)
              const hasActive = group.items.some(item =>
                pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path))
              )
              return (
                <div key={gi} style={{ marginBottom: 4 }}>
                  {/* Group Header — clickable */}
                  <button onClick={() => toggleGroup(group.group)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 6px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, color: hasActive ? S.gold : S.white, fontWeight: 700 }}>
                      {isAr ? group.group : (t.groups[group.group as keyof typeof t.groups] || group.group)}
                    </span>
                    <span style={{ fontSize: 16, color: hasActive ? S.gold : S.white, display: 'inline-block', transition: 'transform .2s', transform: isCollapsed ? (isAr ? 'rotate(90deg)' : 'rotate(-90deg)') : 'rotate(0deg)' }}>
                      ▾
                    </span>
                  </button>

                  {/* Items */}
                  {!isCollapsed && group.items.map((item, ii) => {
                    const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path))
                    return (
                      <button key={ii} onClick={() => { router.push(item.path); if (isMobile) setSidebarOpen(false) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', background: active ? S.gold3 : 'transparent', border: 'none',
                        borderRight: isAr && active ? `3px solid ${S.gold}` : 'none',
                        borderLeft: !isAr && active ? `3px solid ${S.gold}` : 'none',
                        cursor: 'pointer', textAlign: isAr ? 'right' : 'left', transition: 'all 0.15s', color: active ? S.gold : S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: active ? 700 : 400 }}>
                        <span style={{ fontSize: 16 }}>{item.icon}</span>
                        <span>{isAr ? item.label : item.label_en}</span>
                        {active && <span style={{ [isAr ? 'marginRight' : 'marginLeft']: 'auto', width: 6, height: 6, borderRadius: '50%', background: S.gold }} />}
                      </button>
                    )
                  })}
                </div>
              )
            })}

            <div style={{ borderTop: `1px solid ${S.border}`, margin: '8px 0', paddingTop: 8 }}>
              <button onClick={signOut} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: 'transparent', border: 'none', cursor: 'pointer', color: S.red, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                <span>🚪</span>
                <span>{t.signOut}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ══ MAIN CONTENT ══ */}
        <main style={{ [isAr ? 'marginRight' : 'marginLeft']: sidebarOpen ? 230 : 0, flex: 1, padding: '24px', transition: 'margin 0.25s ease', minHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
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
    </LanguageContext.Provider>
  )
}
