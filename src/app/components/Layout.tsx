'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

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

const menuItems = [
  {
    group: 'الرئيسية',
    items: [
      { label: 'لوحة التحكم', icon: '◉', path: '/dashboard' },
    ]
  },
  {
group: 'إدارة المخزون',
    items: [
      { label: 'المستودعات', icon: '🏭', path: '/dashboard/warehouse' },
      { label: 'المشتريات', icon: '🛒', path: '/dashboard/purchases' },
      { label: 'طلبات الفروع', icon: '📦', path: '/dashboard/branch-requests' },
    ]
  },
{
    group: 'العمليات',
    items: [
      { label: 'المطبخ', icon: '👨‍🍳', path: '/dashboard/kitchen' },
      { label: 'الحلويات', icon: '🍰', path: '/dashboard/desserts' },
      { label: 'البار', icon: '☕', path: '/dashboard/bar' },
      { label: 'الصالة', icon: '🍽️', path: '/dashboard/hall' },
    ]
  },
  {
      group: 'قائمة الطعام',
      items: [
        { label: 'الأصناف (المنيو)', icon: '📖', path: '/dashboard/menu/items' },
        { label: 'التصنيفات', icon: '📁', path: '/dashboard/menu/categories' },
        { label: 'إضافات الأصناف', icon: '➕', path: '/dashboard/menu/modifiers' },
      ]
    },
  {
      group: 'العملاء والبيع',
      items: [
        { label: 'حجوزات العملاء', icon: '📅', path: '/dashboard/bookings' },
        { label: 'قاعدة بيانات العملاء', icon: '👥', path: '/dashboard/customers' },
        { label: 'نقاط الولاء', icon: '🎁', path: '/dashboard/loyalty' },
      ]
    },
    {
      group: 'التسويق والنمو',
      items: [
        { label: 'الحملات الإعلانية', icon: '📢', path: '/dashboard/marketing/campaigns' },
        { label: 'كوبونات الخصم', icon: '🎫', path: '/dashboard/marketing/coupons' },
        { label: 'إرسال الإشعارات', icon: '📲', path: '/dashboard/marketing/notifications' },
        { label: 'تحليل المنافسين', icon: '🔍', path: '/dashboard/marketing/analysis' },
      ]
    },
    {
      group: 'المالية والحسابات',
      items: [
        { label: 'شجرة الحسابات', icon: '🧾', path: '/dashboard/accounting/chart' },
        { label: 'سندات القيد', icon: '💸', path: '/dashboard/accounting/entries' },
        { label: 'الخزينة والبنوك', icon: '🏦', path: '/dashboard/accounting/banks' },
      ]
    },
    {
      group: 'الموارد البشرية',
      items: [
        { label: 'الموظفون', icon: '👷', path: '/dashboard/hr/employees' },
        { label: 'الرواتب والحضور', icon: '📅', path: '/dashboard/hr/payroll' },
      ]
    },
  {
    group: 'التقارير',
    items: [
      { label: 'التقارير اليومية', icon: '📊', path: '/dashboard/reports/daily' },
      { label: 'التقارير الشهرية', icon: '📈', path: '/dashboard/reports/monthly' },
      { label: 'تحليل التكاليف', icon: '💰', path: '/dashboard/reports/costs' },
    ]
  },
  {
    group: 'الإعدادات',
    items: [
      { label: 'الموردون', icon: '🤝', path: '/dashboard/suppliers' },
      { label: 'الإعدادات', icon: '⚙️', path: '/dashboard/settings' },
    ]
  },
  {
    group: 'التقارير',
    items: [
      { label: 'التقارير اليومية', icon: '📊', path: '/dashboard/reports/daily' },
      { label: 'التقارير الشهرية', icon: '📈', path: '/dashboard/reports/monthly' },
      { label: 'تحليل التكاليف', icon: '💰', path: '/dashboard/reports/costs' },
    ]
  },
  {
    group: 'الإعدادات',
    items: [
      { label: 'الموردون', icon: '🤝', path: '/dashboard/suppliers' },
      { label: 'الإعدادات', icon: '⚙️', path: '/dashboard/settings' },
    ]
  },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

// Auto-close on mobile
  const [notifOpen, setNotifOpen] = useState(false)

  const notifications = [
    { text: 'مخزون اللحم البقري منخفض', time: 'منذ 10 دقائق', type: 'warning' },
    { text: 'تم استلام فاتورة جديدة', time: 'منذ 30 دقيقة', type: 'info' },
    { text: 'تقرير اليوم جاهز', time: 'منذ ساعة', type: 'success' },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl',
    }}>

      {/* ══ HEADER ══ */}
      <header style={{
        position: 'fixed', top: 0, right: 0, left: 0, zIndex: 100,
        height: 60, background: S.navy2,
        borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px', gap: 16,
      }}>

        {/* Right: Logo + Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => setSidebarOpen(p => !p)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: S.muted, fontSize: 20, padding: 4, display: 'flex',
              alignItems: 'center', lineHeight: 1,
            }}
            title="قائمة جانبية"
          >☰</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, boxShadow: `0 0 12px ${S.goldB}`,
            }}>🌸</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: S.white, lineHeight: 1.2 }}>
                Orchid House
              </div>
              <div style={{ fontSize: 10, color: S.gold, letterSpacing: 1 }}>
                Restaurant Management
              </div>
            </div>
          </div>
        </div>

        {/* Center: Page Title */}
        <div style={{ fontSize: 14, color: S.muted, flex: 1, textAlign: 'center' }}>
          {menuItems.flatMap(g => g.items).find(i => i.path === pathname)?.label || 'لوحة التحكم'}
        </div>

        {/* Left: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNotifOpen(p => !p)}
              style={{
                background: S.card, border: `1px solid ${S.border}`,
                borderRadius: 10, width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: S.white, fontSize: 16, position: 'relative',
              }}
            >
              🔔
              <span style={{
                position: 'absolute', top: 6, left: 6, width: 8, height: 8,
                borderRadius: '50%', background: S.red,
                border: `1px solid ${S.navy2}`,
              }} />
            </button>

            {notifOpen && (
              <div style={{
                position: 'absolute', top: 44, left: 0,
                width: 280, background: S.navy2,
                border: `1px solid ${S.border}`, borderRadius: 14,
                padding: 8, zIndex: 200,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontSize: 12, color: S.gold, padding: '6px 10px', fontWeight: 700, marginBottom: 4 }}>
                  التنبيهات
                </div>
                {notifications.map((n, i) => (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: i % 2 === 0 ? S.card : 'transparent',
                    marginBottom: 4,
                  }}>
                    <div style={{ fontSize: 12, color: S.white, marginBottom: 3 }}>{n.text}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>{n.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: S.goldB, border: `1px solid ${S.gold3}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: S.gold, cursor: 'pointer',
          }}>
            OR
          </div>
        </div>
      </header>

      {/* ══ BODY ══ */}
      <div style={{ display: 'flex', marginTop: 60, minHeight: 'calc(100vh - 60px)' }}>

        {/* ══ SIDEBAR ══ */}
        <aside style={{
          position: 'fixed', top: 60, right: 0, bottom: 0,
          width: sidebarOpen ? 230 : 0,
          background: S.navy3,
          borderLeft: `1px solid ${S.border}`,
          overflowY: 'auto', overflowX: 'hidden',
          transition: 'width 0.25s ease',
          zIndex: 90,
        }}>
          <div style={{ width: 230, padding: '12px 0' }}>
            {menuItems.map((group, gi) => (
              <div key={gi} style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 10, color: S.muted, fontWeight: 700,
                  padding: '8px 18px 4px', letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>
                  {group.group}
                </div>
                {group.items.map((item, ii) => {
                  const active = pathname === item.path ||
                    (item.path !== '/dashboard' && pathname.startsWith(item.path))
                  return (
                    <button
                      key={ii}
                      onClick={() => { router.push(item.path); if (window.innerWidth < 768) setSidebarOpen(false) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        gap: 10, padding: '10px 18px',
                        background: active ? S.gold3 : 'transparent',
                        border: 'none',
                        borderRight: active ? `3px solid ${S.gold}` : '3px solid transparent',
                        cursor: 'pointer', textAlign: 'right',
                        transition: 'all 0.15s',
                        color: active ? S.gold : S.muted,
                        fontSize: 13, fontFamily: 'Tajawal, sans-serif',
                        fontWeight: active ? 700 : 400,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <span>{item.label}</span>
                      {active && (
                        <span style={{
                          marginRight: 'auto', width: 6, height: 6,
                          borderRadius: '50%', background: S.gold,
                        }} />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}

            {/* Logout */}
            <div style={{ borderTop: `1px solid ${S.border}`, margin: '8px 0', paddingTop: 8 }}>
              <button style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 10, padding: '10px 18px',
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: S.red, fontSize: 13,
                fontFamily: 'Tajawal, sans-serif',
              }}>
                <span>🚪</span>
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ══ MAIN CONTENT ══ */}
        <main style={{
          marginRight: sidebarOpen ? 230 : 0,
          flex: 1, padding: '24px',
          transition: 'margin-right 0.25s ease',
          minHeight: 'calc(100vh - 60px)',
          overflowY: 'auto',
        }}>
          {children}
        </main>
      </div>

<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${S.navy}; }
  aside::-webkit-scrollbar { width: 10px; }
  aside::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 3px; }
  aside::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #C9A84C, #8B6914); border-radius: 3px; box-shadow: 0 0 6px rgba(201,168,76,0.3); }
  aside::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #E8C97A, #C9A84C); }
  button:hover { opacity: 0.85; }
`}</style>
    </div>
  )
}
