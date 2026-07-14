'use client'

import { useEffect, useState, useCallback } from 'react'
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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
}

const ROLES_INFO: Record<string, { label: string; icon: string; color: string; bg: string; desc: string }> = {
  admin:               { label: 'مدير النظام',    icon: '👑', color: S.gold,    bg: S.gold3,                        desc: 'صلاحية كاملة على كل النظام' },
  branch_manager:      { label: 'مدير الفرع',     icon: '🏪', color: S.purple,  bg: S.purpleB,                      desc: 'إدارة الفرع والتقارير والموظفين' },
  kitchen_manager:     { label: 'مدير المطبخ',    icon: '🍳', color: '#F97316', bg: 'rgba(249,115,22,0.12)',         desc: 'المطبخ والبار والحلويات والموظفين' },
  hall_manager:        { label: 'مدير الصالة',    icon: '🏛️', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)',          desc: 'الصالة والحجوزات والعملاء' },
  bar_manager:         { label: 'مدير البار',     icon: '🍹', color: '#6366F1', bg: 'rgba(99,102,241,0.12)',         desc: 'البار والمشروبات والموظفين' },
  kitchen_supervisor:  { label: 'مشرف المطبخ',    icon: '👨‍🍳', color: S.red,     bg: S.redB,                         desc: 'المطبخ والمخزون وطلبات الفروع' },
  hall_supervisor:     { label: 'مشرف الصالة',    icon: '🍽️', color: S.blue,    bg: S.blueB,                        desc: 'الصالة والحجوزات وخدمة العملاء' },
  bar_supervisor:      { label: 'مشرف البار',     icon: '☕', color: S.teal,    bg: S.tealB,                        desc: 'البار والمشروبات والمخزون' },
  cashier:             { label: 'كاشير',           icon: '💰', color: S.green,   bg: S.greenB,                       desc: 'المبيعات والفواتير والدفع' },
  warehouse_keeper:    { label: 'أمين المستودع',  icon: '🏭', color: '#F97316', bg: 'rgba(249,115,22,0.12)',         desc: 'إدارة المخزون والمشتريات وطلبات الفروع' },
  warehouse_manager:   { label: 'مدير المستودعات', icon: '🏭', color: '#EA580C', bg: 'rgba(234,88,12,0.12)',         desc: 'إدارة المستودعات لكل الفروع والموظفين' },
  employee:            { label: 'موظف',            icon: '👤', color: S.muted,   bg: S.card2,                        desc: 'طلباته الشخصية فقط' },
}

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin:              { all: true },
  branch_manager:     { warehouse: true, purchases: true, branch_requests: true, internal_warehouse_requests: true, reports: true, hr: true, payroll: true, suppliers: true, accounting: true, kitchen: true, bar: true, desserts: true, hall: true, prep_warehouse: true, bookings: true, customers: true, loyalty: true, menu: true, attendance: true, my_requests: true, salary_increase_requests: true, salary_advance_requests: true, notifications: true, marketing: true },
  kitchen_manager:    { kitchen: true, bar: true, desserts: true, branch_requests: true, internal_warehouse_requests: true, prep_warehouse: true, hr: true, my_requests: true, attendance: true, notifications: true, marketing: true },
  hall_manager:       { hall: true, bookings: true, customers: true, loyalty: true, hr: true, my_requests: true, attendance: true, notifications: true, marketing: true },
  bar_manager:        { bar: true, branch_requests: true, internal_warehouse_requests: true, prep_warehouse: true, hr: true, my_requests: true, attendance: true, notifications: true, marketing: true },
  kitchen_supervisor: { kitchen: true, branch_requests: true, internal_warehouse_requests: true, prep_warehouse: true, my_requests: true, attendance: true, marketing: true },
  hall_supervisor:    { hall: true, bookings: true, my_requests: true, attendance: true, marketing: true },
  bar_supervisor:     { bar: true, internal_warehouse_requests: true, prep_warehouse: true, my_requests: true, attendance: true, marketing: true },
  cashier:            { sales: true, invoices: true, my_requests: true, attendance: true, marketing: true },
  warehouse_keeper:   { warehouse: true, purchases: true, branch_requests: true, internal_warehouse_requests: true, suppliers: true, my_requests: true, attendance: true, notifications: true, marketing: true },
  warehouse_manager:  { warehouse: true, purchases: true, branch_requests: true, internal_warehouse_requests: true, suppliers: true, hr: true, my_requests: true, attendance: true, notifications: true, marketing: true },
  employee:           { my_requests: true, attendance: true, menu: true, my_payroll: true, marketing: true },
}

const ALL_PERMISSIONS = [
  { key: 'all',              label: 'كل الصلاحيات',        group: 'عام',           icon: '🔓' },
  { key: 'warehouse',        label: 'المستودعات',           group: 'إدارة المخزون', icon: '🏭' },
  { key: 'purchases',        label: 'المشتريات',            group: 'إدارة المخزون', icon: '🛒' },
  { key: 'branch_requests',  label: 'طلبات الفروع',        group: 'إدارة المخزون', icon: '📦' },
  { key: 'internal_warehouse_requests', label: 'طلبات المستودع الداخلي', group: 'إدارة المخزون', icon: '🏭' },
  { key: 'suppliers',        label: 'الموردون',             group: 'إدارة المخزون', icon: '🤝' },
  { key: 'kitchen',          label: 'المطبخ',               group: 'العمليات',      icon: '👨‍🍳' },
  { key: 'hall',             label: 'الصالة',               group: 'العمليات',      icon: '🍽️' },
  { key: 'bar',              label: 'البار',                group: 'العمليات',      icon: '☕' },
  { key: 'desserts',         label: 'الحلويات',             group: 'العمليات',      icon: '🍰' },
  { key: 'prep_warehouse',   label: 'مستودع التجهيزات',     group: 'العمليات',      icon: '🏭' },
  { key: 'sales',            label: 'المبيعات / الكاشير',  group: 'العمليات',      icon: '💳' },
  { key: 'menu',             label: 'قائمة الطعام',         group: 'المنيو',        icon: '📖' },
  { key: 'bookings',         label: 'الحجوزات',             group: 'العملاء',       icon: '📅' },
  { key: 'customers',        label: 'قاعدة العملاء',        group: 'العملاء',       icon: '👥' },
  { key: 'loyalty',          label: 'نقاط الولاء',          group: 'العملاء',       icon: '🎁' },
  { key: 'invoices',         label: 'الفواتير',             group: 'المالية',       icon: '🧾' },
  { key: 'accounting',       label: 'المحاسبة',             group: 'المالية',       icon: '💸' },
  { key: 'reports',          label: 'التقارير',             group: 'المالية',       icon: '📊' },
  { key: 'payroll',          label: 'الرواتب والأجور',       group: 'المالية',       icon: '💰' },
  { key: 'hr',               label: 'الموارد البشرية',      group: 'الموارد',       icon: '👷' },
  { key: 'my_requests',      label: 'طلباتي الشخصية',       group: 'الموارد',       icon: '📋' },
  { key: 'salary_increase_requests', label: '📈 طلبات زيادة الراتب', group: 'الموارد', icon: '📈' },
  { key: 'salary_advance_requests',  label: '💸 طلبات سلفة الراتب',  group: 'الموارد', icon: '💸' },
  { key: 'attendance',       label: 'الحضور والانصراف',     group: 'الموارد',       icon: '⏰' },
  { key: 'my_payroll',       label: 'راتبي',                group: 'الموارد',       icon: '💵' },
  { key: 'marketing',        label: 'التسويق',              group: 'التسويق',       icon: '📢' },
  { key: 'notifications',    label: 'الإشعارات',            group: 'الإعدادات',     icon: '🔔' },
  { key: 'settings',         label: 'الإعدادات',            group: 'الإعدادات',     icon: '⚙️' },
  { key: 'violations',       label: 'المخالفات',             group: 'الموارد',       icon: '⚠️' },
  { key: 'evaluations',      label: 'تقييم الموظفين',        group: 'الموارد',       icon: '⭐' },
  { key: 'absences',         label: 'الغياب بدون عذر',       group: 'الموارد',       icon: '🚫' },
  { key: 'assign_shifts',    label: 'تعيين الشيفتات',        group: 'الموارد',       icon: '📅' },
  { key: 'permissions',      label: 'إدارة الصلاحيات',      group: 'الإعدادات',     icon: '🔐' },
]

const GROUPS = [...new Set(ALL_PERMISSIONS.map(p => p.group))]

interface RolePermission {
  id: string; role: string; role_name_ar: string
  permissions: Record<string, boolean>; is_active: boolean
}

export default function PermissionsPage() {
  const supabase = createClient()
  const [roles, setRoles] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('admin')
  const [localPerms, setLocalPerms] = useState<Record<string, Record<string, boolean>>>({})
  const [saved, setSaved] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('roles_permissions').select('*').order('role')
    setRoles(data || [])
    const permsMap: Record<string, Record<string, boolean>> = {}
    ;(data || []).forEach((r: RolePermission) => { permsMap[r.role] = r.permissions || {} })
    Object.keys(ROLES_INFO).forEach(role => {
      if (!permsMap[role]) permsMap[role] = DEFAULT_PERMISSIONS[role] || {}
    })
    setLocalPerms(permsMap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function togglePerm(role: string, perm: string) {
    setLocalPerms(prev => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role]?.[perm] }
    }))
  }

  async function saveRole(role: string) {
    setSaving(role)
    const existing = roles.find(r => r.role === role)
    let error
    if (existing) {
      ;({ error } = await supabase.from('roles_permissions').update({ permissions: localPerms[role] }).eq('role', role))
    } else {
      ;({ error } = await supabase.from('roles_permissions').insert([{ role, role_name_ar: ROLES_INFO[role]?.label || role, permissions: localPerms[role], is_active: true }]))
    }
    setSaving(null)
    if (error) { alert('خطأ: ' + error.message); return }
    setSaved(role)
    setTimeout(() => setSaved(null), 2000)
    fetchAll()
  }

  async function resetToDefault(role: string) {
    if (!confirm(`إعادة صلاحيات "${ROLES_INFO[role]?.label}" للافتراضي؟`)) return
    setLocalPerms(prev => ({ ...prev, [role]: DEFAULT_PERMISSIONS[role] || {} }))
  }

  const currentPerms = localPerms[selectedRole] || {}
  const roleInfo = ROLES_INFO[selectedRole] || { label: selectedRole, icon: '👤', color: S.muted, bg: S.card2, desc: '' }
  const isAdmin = selectedRole === 'admin'
  const enabledCount = Object.values(currentPerms).filter(Boolean).length

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🔐 إدارة الصلاحيات</h1>
        <p style={{ fontSize: 13, color: S.muted }}>تحديد صلاحيات الوصول لكل دور وظيفي</p>
      </div>

      <div style={{ background: S.amberB, border: `1px solid ${S.amber}`, borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div style={{ fontSize: 13, color: S.amber }}>هذه الصفحة خاصة بمدير النظام فقط. أي تغيير في الصلاحيات سيؤثر فوراً على وصول الموظفين للنظام.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: S.muted, fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>الأدوار الوظيفية</div>
          {Object.entries(ROLES_INFO).map(([key, info]) => {
            const permCount = Object.values(localPerms[key] || {}).filter(Boolean).length
            const isSelected = selectedRole === key
            return (
              <button key={key} onClick={() => setSelectedRole(key)}
                style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${isSelected ? info.color : S.border}`, background: isSelected ? info.bg : 'transparent', cursor: 'pointer', textAlign: 'right', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{info.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? info.color : S.white, marginBottom: 2 }}>{info.label}</div>
                  <div style={{ fontSize: 10, color: S.muted }}>{key === 'admin' ? 'كل الصلاحيات' : `${permCount} صلاحية`}</div>
                </div>
                {saved === key && <span style={{ color: S.green, fontSize: 14 }}>✓</span>}
              </button>
            )
          })}
        </div>

        <div>
          {loading ? <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div> : (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: roleInfo.bg, border: `2px solid ${roleInfo.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{roleInfo.icon}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: S.white, marginBottom: 4 }}>{roleInfo.label}</div>
                    <div style={{ fontSize: 12, color: S.muted }}>{roleInfo.desc}</div>
                  </div>
                </div>
                {!isAdmin && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => resetToDefault(selectedRole)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🔄 إعادة للافتراضي</button>
                    <button onClick={() => saveRole(selectedRole)} disabled={saving === selectedRole} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      {saving === selectedRole ? '⏳ جاري الحفظ...' : saved === selectedRole ? '✅ تم الحفظ' : '💾 حفظ التغييرات'}
                    </button>
                  </div>
                )}
              </div>

              {isAdmin ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>👑</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: S.gold, marginBottom: 8 }}>مدير النظام</div>
                  <div style={{ fontSize: 13, color: S.muted }}>لديه صلاحية كاملة على جميع أجزاء النظام بدون قيود</div>
                </div>
              ) : (
                <div style={{ padding: 20 }}>
                  <div style={{ background: S.navy3, borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: S.muted }}>الصلاحيات المفعّلة: <strong style={{ color: S.gold }}>{enabledCount}</strong> / {ALL_PERMISSIONS.length - 1}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { const all: Record<string, boolean> = {}; ALL_PERMISSIONS.filter(p => p.key !== 'all').forEach(p => { all[p.key] = true }); setLocalPerms(prev => ({ ...prev, [selectedRole]: all })) }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>تفعيل الكل</button>
                      <button onClick={() => setLocalPerms(prev => ({ ...prev, [selectedRole]: {} }))} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>إلغاء الكل</button>
                    </div>
                  </div>
                  {GROUPS.filter(g => g !== 'عام').map(group => {
                    const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group)
                    const enabledInGroup = groupPerms.filter(p => currentPerms[p.key]).length
                    const allEnabled = enabledInGroup === groupPerms.length
                    return (
                      <div key={group} style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 13, color: S.gold, fontWeight: 700 }}>{group}</div>
                            <div style={{ fontSize: 11, color: S.muted, background: S.card, borderRadius: 20, padding: '2px 8px' }}>{enabledInGroup}/{groupPerms.length}</div>
                          </div>
                          <button onClick={() => { const newVal = !allEnabled; setLocalPerms(prev => ({ ...prev, [selectedRole]: { ...prev[selectedRole], ...groupPerms.reduce((acc, p) => ({ ...acc, [p.key]: newVal }), {}) } })) }} style={{ fontSize: 11, color: allEnabled ? S.red : S.green, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>
                            {allEnabled ? 'إلغاء الكل' : 'تفعيل الكل'}
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                          {groupPerms.map(perm => {
                            const enabled = !!currentPerms[perm.key]
                            return (
                              <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${enabled ? S.green + '50' : S.border}`, background: enabled ? S.greenB : S.card, cursor: 'pointer', transition: 'all .15s' }}>
                                <input type="checkbox" checked={enabled} onChange={() => togglePerm(selectedRole, perm.key)} style={{ accentColor: S.green, width: 16, height: 16, flexShrink: 0 }} />
                                <span style={{ fontSize: 16 }}>{perm.icon}</span>
                                <div><div style={{ fontSize: 12, fontWeight: 600, color: enabled ? S.white : S.muted }}>{perm.label}</div></div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
