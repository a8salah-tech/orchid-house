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
  warehouse_manager:  { label: 'مدير المستودعات', label_en: 'Warehouse Manager', icon: '🏭' },
  employee:           { label: 'موظف',          label_en: 'Employee',           icon: '👤' },
}

function EmployeeDashboard({ employee }: { employee: any }) {
  const router = useRouter()
  const { isAr } = useLang()
  const roleLabel = ROLE_LABELS[employee?.role || 'employee'] || ROLE_LABELS.employee
  const hour = new Date().getHours()
  const greeting = isAr ? (hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور') : (hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening')

  // ✅ اسم الفرع الفعلي للموظف — يُجلب مباشرة من قاعدة البيانات بناءً على branch_id الخاص به،
  // لأن useAuth() لا يوفر حالياً اسم الفرع (branches relation)، فكانت رسالة الترحيب مكتوبة بشكل ثابت
  // "Orchid House" دائماً بغض النظر عن الفرع الحقيقي للموظف (KLCC أو غيره)
  const [branchName, setBranchName] = useState<string | null>(null)
  useEffect(() => {
    if (!employee?.branch_id) { setBranchName(null); return }
    const sb = createClient()
    sb.from('branches').select('name').eq('id', employee.branch_id).maybeSingle()
      .then(({ data }) => setBranchName(data?.name || null))
  }, [employee?.branch_id])

  const role = employee?.role || 'employee'
  // ✅ أضفنا hall_worker (عامل صالة) هنا — بدونها ما كانوا يقدروا يشوفوا حتى صفحاتهم الشخصية الأساسية
  // (دوامي، الحضور، طلباتي، راتبي)، مش بس الطاولات والكاشير
  // ✅ أضفنا branch_manager هنا كمان — كان مفقوداً تماماً من كل الروابط في هذه الصفحة (لا شخصية ولا إدارية)،
  // فكانت شاشة "وصول سريع" تظهر فارغة تماماً لمدير الفرع رغم أنه دور حقيقي معرَّف في النظام
  const ALL_NON_ADMIN = ['branch_manager','kitchen_manager','hall_manager','bar_manager','kitchen_supervisor','hall_supervisor','bar_supervisor','cashier','assistant_cashier','employee','warehouse_keeper','warehouse_manager','hall_cleaner','kitchen_cleaner','hall_worker']
  const KITCHEN_ROLES = ['kitchen_manager','kitchen_supervisor']
  const HALL_ROLES = ['hall_manager','hall_supervisor']
  const BAR_ROLES = ['bar_manager','bar_supervisor']
  const SUPERVISOR_ROLES = ['kitchen_supervisor','hall_supervisor','bar_supervisor']
  // ✅ مدير الفرع يشرف على الفرع بالكامل، فمن المنطقي يكون له نفس صلاحيات الوصول الإدارية
  // (الموظفون، الشيفتات، طلبات الفروع) المتاحة لمديري الأقسام الفرعية
  const MANAGER_ROLES = ['branch_manager','kitchen_manager','hall_manager','bar_manager']

  const MY_LINKS = [
    // ── العمل ──
    { icon: '👨‍🍳', label: isAr ? 'المطبخ' : 'Kitchen',              path: '/dashboard/kitchen',           show: [...KITCHEN_ROLES] },
    { icon: '🍰', label: isAr ? 'الحلويات' : 'Desserts',              path: '/dashboard/desserts',          show: ['kitchen_manager','kitchen_supervisor'] },
    { icon: '☕', label: isAr ? 'البار' : 'Bar',                       path: '/dashboard/bar',               show: [...BAR_ROLES] },
    // ✅ عامل الصالة (hall_worker) أضيف هنا وفي الكاشير — يقدر يشوف الطاولات ويضيف طلبات
    { icon: '🪑', label: isAr ? 'الطاولات' : 'Tables',                path: '/dashboard/tables',            show: [...HALL_ROLES,'cashier','assistant_cashier','hall_worker'] },
    { icon: '🏧', label: isAr ? 'الكاشير' : 'Cashier',                path: '/dashboard/cashier',           show: ['cashier','assistant_cashier','hall_worker'] },
    { icon: '🏭', label: isAr ? 'المستودع' : 'Warehouse',             path: '/dashboard/warehouse',         show: ['warehouse_keeper','warehouse_manager'] },
    // ── الإدارة (مديرين فقط) ──
    { icon: '👷', label: isAr ? 'الموظفون' : 'Employees',             path: '/dashboard/hr/employees',      show: [...MANAGER_ROLES] },
    { icon: '📅', label: isAr ? 'الشيفتات' : 'Shifts',                path: '/dashboard/hr/shifts',         show: [...MANAGER_ROLES] },
    { icon: '📦', label: isAr ? 'طلبات الفروع' : 'Branch Requests',  path: '/dashboard/branch-requests',   show: [...SUPERVISOR_ROLES,...MANAGER_ROLES,'warehouse_keeper','warehouse_manager'] },
    // ── الشخصي (للجميع) ──
    { icon: '🗓️', label: isAr ? 'دوامي' : 'My Schedule',             path: '/dashboard/hr/my-schedule',    show: [...ALL_NON_ADMIN] },
    { icon: '⏰', label: isAr ? 'الحضور' : 'Attendance',              path: '/dashboard/hr/attendance',     show: [...ALL_NON_ADMIN] },
    { icon: '📋', label: isAr ? 'طلباتي' : 'My Requests',            path: '/dashboard/hr/requests',       show: [...ALL_NON_ADMIN] },
    { icon: '💰', label: isAr ? 'راتبي' : 'My Salary',                path: '/dashboard/hr/my-salary',      show: [...ALL_NON_ADMIN] },
  // ✅ Fix: الأدمن يشوف كل الروابط دايمًا - بدل ما نضطر نضيف 'admin' يدويًا لكل عنصر في القائمة فوق
  ].filter(l => l.show.includes(role) || role === 'admin')

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Greeting */}
      <div style={{ background: `linear-gradient(135deg,${S.navy2},${S.navy3})`, borderRadius: 20, border: `1px solid ${S.border}`, padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', animation: 'fadeUp .4s ease' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg,${S.gold},${S.gold2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>
          {roleLabel.icon}
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: S.gold, marginBottom: 4 }}>{greeting}، {employee?.name}!</h1>
          <div style={{ fontSize: 14, color: S.muted }}>{isAr ? roleLabel.label : roleLabel.label_en}{employee?.department ? ` · ${employee.department}` : ''}</div>
          {/* ✅ رقم الموظف، القسم، وإيميل النظام: إطار واضح، خط أبيض، ومتجاوب مع الموبايل (flexWrap) */}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {employee?.employee_number && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: S.white, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                🪪 {isAr ? 'رقم الموظف' : 'Employee ID'}: {employee.employee_number}
              </span>
            )}
            {employee?.department && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: S.white, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                🏷️ {employee.department}
              </span>
            )}
            {employee?.email_account && (
              <span
                title={isAr ? 'هذا إيميل النظام الخاص بك (لتسجيل الدخول)، وليس بريدك الشخصي' : "This is your system login email, not your personal email"}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: S.white, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '5px 12px', whiteSpace: 'nowrap' }}
              >
                ✉️ {employee.email_account}
                <span style={{ fontSize: 10, fontWeight: 700, color: S.gold, background: S.gold3, border: `1px solid ${S.gold}40`, borderRadius: 5, padding: '1px 6px', marginRight: 2 }}>
                  {isAr ? 'إيميل النظام' : 'System Email'}
                </span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: S.muted, marginTop: 6 }}>
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
          {/* ✅ اسم الفرع بقى ديناميكياً حسب فرع الموظف الفعلي (branchName)، بدل النص الثابت "Orchid House"
              مهما كان الموظف في أي فرع. نستخدم اسم الشركة العام ("Orchid Group") كاحتياط لحد ما يتم جلب اسم الفرع */}
          <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 2 }}>
            {isAr ? `مرحباً بك في ${branchName || 'Orchid Group'}` : `Welcome to ${branchName || 'Orchid Group'}`}
          </div>
          <div style={{ fontSize: 12, color: S.muted }}>{isAr ? 'لديك أي استفسار؟ تواصل مع المدير المباشر. نتمنى لك يوم عمل موفق!' : 'Any questions? Contact your manager. Have a great shift!'}</div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { employee } = useAuth()
  return <EmployeeDashboard employee={employee} />
}
