'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const ROLES: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  admin:              { label: 'مدير النظام',   color: S.gold,   bg: S.gold3,   icon: '👑' },
  branch_manager:     { label: 'مدير الفرع',    color: S.purple, bg: S.purpleB, icon: '🏪' },
  kitchen_supervisor: { label: 'مشرف المطبخ',   color: S.red,    bg: S.redB,    icon: '👨‍🍳' },
  hall_supervisor:    { label: 'مشرف الصالة',   color: S.blue,   bg: S.blueB,   icon: '🍽️' },
  bar_supervisor:     { label: 'مشرف البار',    color: S.teal,   bg: S.tealB,   icon: '☕' },
  cashier:            { label: 'كاشير',          color: S.green,  bg: S.greenB,  icon: '💰' },
  employee:           { label: 'موظف',           color: S.muted,  bg: S.card2,   icon: '👤' },
}

const DEPARTMENTS = ['المطبخ', 'البار', 'الصالة', 'الحلويات', 'الكاشير', 'الإدارة', 'التوصيل', 'النظافة']

interface Employee {
  id: string; name: string; name_en: string; employee_number: string
  role: string; department: string; branch_id: string; phone: string
  email: string; join_date: string; salary: number; is_active: boolean
  notes: string; branches?: { name: string }
}
interface Branch { id: string; name: string }

// ══ Add/Edit Employee Modal ══
function EmployeeModal({ employee, branches, onClose, onSaved }: {
  employee?: Employee | null; branches: Branch[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: employee?.name || '',
    name_en: employee?.name_en || '',
    employee_number: employee?.employee_number || '',
    role: employee?.role || 'employee',
    department: employee?.department || '',
    branch_id: employee?.branch_id || '',
    phone: employee?.phone || '',
    email: employee?.email || '',
    join_date: employee?.join_date || new Date().toISOString().split('T')[0],
    salary: employee?.salary?.toString() || '',
    notes: employee?.notes || '',
    is_active: employee?.is_active !== false,
  })

  async function save() {
    if (!form.name || !form.role) { alert('يرجى إدخال الاسم والدور'); return }
    setSaving(true)
    const payload = { ...form, salary: parseFloat(form.salary) || 0 }
    const { error } = employee
      ? await supabase.from('employees').update(payload).eq('id', employee.id)
      : await supabase.from('employees').insert([payload])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 680, padding: 32, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {employee ? '✏️ تعديل بيانات الموظف' : '➕ إضافة موظف جديد'}
            </h2>
            <p style={{ fontSize: 12, color: S.muted }}>أدخل بيانات الموظف والدور الوظيفي</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الاسم (عربي) *</label>
            <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الموظف" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Name (English)</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="Employee Name" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>رقم الموظف</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.employee_number} onChange={e => setForm(p => ({ ...p, employee_number: e.target.value }))} placeholder="EMP-001" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الدور الوظيفي *</label>
            <select style={{ ...inp }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              {Object.entries(ROLES).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>القسم</label>
            <select style={{ ...inp }} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">اختر القسم</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الفرع</label>
            <select style={{ ...inp }} value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
              <option value="">اختر الفرع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>رقم الهاتف</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+60 12-345 6789" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>البريد الإلكتروني</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@orchid.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>تاريخ الانضمام</label>
            <input style={inp} type="date" value={form.join_date} onChange={e => setForm(p => ({ ...p, join_date: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الراتب الأساسي (MYR)</label>
            <input style={inp} type="number" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} placeholder="0.00" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 16px' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: S.green, width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>موظف نشط</div>
                <div style={{ fontSize: 11, color: S.muted }}>يظهر في النظام</div>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الحفظ...' : employee ? '💾 حفظ التعديلات' : '✅ إضافة الموظف'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Employee Detail Modal ══
function EmployeeDetailModal({ employee, onClose, onEdit }: {
  employee: Employee; onClose: () => void; onEdit: () => void
}) {
  const role = ROLES[employee.role] || ROLES.employee
  const yearsInService = employee.join_date
    ? Math.floor((new Date().getTime() - new Date(employee.join_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 520, padding: 28, margin: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: role.bg, border: `2px solid ${role.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              {role.icon}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: S.white, marginBottom: 4 }}>{employee.name}</div>
              {employee.name_en && <div style={{ fontSize: 13, color: S.muted, fontStyle: 'italic' }}>{employee.name_en}</div>}
              <span style={{ background: role.bg, color: role.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                {role.icon} {role.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'رقم الموظف', value: employee.employee_number || '—', icon: '🔢' },
            { label: 'القسم', value: employee.department || '—', icon: '🏷️' },
            { label: 'الفرع', value: employee.branches?.name || '—', icon: '🏪' },
            { label: 'تاريخ الانضمام', value: employee.join_date || '—', icon: '📅' },
            { label: 'سنوات الخدمة', value: `${yearsInService} سنة`, icon: '⏳' },
            { label: 'الراتب', value: employee.salary ? `MYR ${employee.salary.toLocaleString()}` : '—', icon: '💰' },
            { label: 'الهاتف', value: employee.phone || '—', icon: '📞' },
            { label: 'البريد', value: employee.email || '—', icon: '📧' },
          ].map((row, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>{row.icon} {row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{row.value}</div>
            </div>
          ))}
        </div>

        {employee.notes && (
          <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>📝 ملاحظات</div>
            <div style={{ fontSize: 13, color: S.white }}>{employee.notes}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
          <button onClick={onEdit} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✏️ تعديل</button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function EmployeesPage() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [emp, br] = await Promise.all([
      supabase.from('employees').select('*, branches(name)').order('name'),
      supabase.from('branches').select('id,name').eq('is_active', true),
    ])
    setEmployees(emp.data || [])
    setBranches(br.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleActive(emp: Employee) {
    await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id)
    fetchAll()
  }

  // Stats
  const activeCount = employees.filter(e => e.is_active).length
  const roleCounts = Object.keys(ROLES).reduce((acc, r) => {
    acc[r] = employees.filter(e => e.role === r).length
    return acc
  }, {} as Record<string, number>)

  // Filter
  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.includes(search) || (e.name_en || '').toLowerCase().includes(search.toLowerCase()) || (e.employee_number || '').includes(search)
    const matchRole = filterRole === 'all' || e.role === filterRole
    const matchDept = filterDept === 'all' || e.department === filterDept
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? e.is_active : !e.is_active)
    return matchSearch && matchRole && matchDept && matchStatus
  })

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .emp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .emp-card { transition: all .2s; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>👷 الموظفون</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة فريق العمل والأدوار الوظيفية</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          ➕ موظف جديد
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>👥</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 2 }}>{employees.length}</div>
          <div style={{ fontSize: 12, color: S.muted }}>إجمالي الموظفين</div>
        </div>
        <div style={{ background: S.greenB, borderRadius: 14, border: `1px solid rgba(34,197,94,0.2)`, padding: '16px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.green, marginBottom: 2 }}>{activeCount}</div>
          <div style={{ fontSize: 12, color: S.muted }}>نشط</div>
        </div>
        {Object.entries(ROLES).slice(0, 5).map(([key, cfg]) => (
          <div key={key} style={{ background: cfg.bg, borderRadius: 14, border: `1px solid ${cfg.color}30`, padding: '16px 18px', cursor: 'pointer' }}
            onClick={() => setFilterRole(filterRole === key ? 'all' : key)}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{cfg.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, marginBottom: 2 }}>{roleCounts[key] || 0}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم أو الرقم..." />
        <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="all">كل الأدوار</option>
          {Object.entries(ROLES).map(([key, val]) => <option key={key} value={key}>{val.icon} {val.label}</option>)}
        </select>
        <select style={{ ...inp, width: 'auto', minWidth: 130 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="all">كل الأقسام</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={{ ...inp, width: 'auto', minWidth: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">موقف</option>
        </select>
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          <button onClick={() => setView('grid')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'grid' ? S.gold3 : 'transparent', color: view === 'grid' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>⊞</button>
          <button onClick={() => setView('list')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'list' ? S.gold3 : 'transparent', color: view === 'list' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>☰</button>
        </div>
        <div style={{ fontSize: 12, color: S.muted }}>{filtered.length} موظف</div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👷</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا يوجد موظفون</div>
          <div style={{ fontSize: 13 }}>اضغط "موظف جديد" لإضافة أول موظف</div>
        </div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(emp => {
            const role = ROLES[emp.role] || ROLES.employee
            return (
              <div key={emp.id} className="emp-card" onClick={() => setDetailEmp(emp)}
                style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${emp.is_active ? S.border : S.redB}`, padding: 20, cursor: 'pointer', opacity: emp.is_active ? 1 : 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: role.bg, border: `2px solid ${role.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {role.icon}
                  </div>
                  <span style={{ background: emp.is_active ? S.greenB : S.redB, color: emp.is_active ? S.green : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    {emp.is_active ? '✅ نشط' : '⏸ موقف'}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: S.white, marginBottom: 2 }}>{emp.name}</div>
                {emp.name_en && <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic', marginBottom: 8 }}>{emp.name_en}</div>}
                <span style={{ background: role.bg, color: role.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                  {role.label}
                </span>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {emp.department && <div style={{ fontSize: 12, color: S.muted }}>🏷️ {emp.department}</div>}
                  {emp.branches?.name && <div style={{ fontSize: 12, color: S.muted }}>🏪 {emp.branches.name}</div>}
                  {emp.phone && <div style={{ fontSize: 12, color: S.muted }}>📞 {emp.phone}</div>}
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditEmp(emp); setDetailEmp(null) }} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>✏️ تعديل</button>
                  <button onClick={() => toggleActive(emp)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${emp.is_active ? S.red : S.green}`, background: emp.is_active ? S.redB : S.greenB, color: emp.is_active ? S.red : S.green, cursor: 'pointer', fontSize: 12 }}>
                    {emp.is_active ? '⏸' : '▶'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['الموظف', 'الدور', 'القسم', 'الفرع', 'الراتب', 'تاريخ الانضمام', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  const role = ROLES[emp.role] || ROLES.employee
                  return (
                    <tr key={emp.id} onClick={() => setDetailEmp(emp)} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer', opacity: emp.is_active ? 1 : 0.6 }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: role.bg, border: `1px solid ${role.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{role.icon}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{emp.name}</div>
                            <div style={{ fontSize: 11, color: S.muted }}>{emp.employee_number || emp.name_en}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: role.bg, color: role.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{role.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{emp.department || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{emp.branches?.name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: S.gold }}>{emp.salary ? `MYR ${emp.salary.toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{emp.join_date || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: emp.is_active ? S.greenB : S.redB, color: emp.is_active ? S.green : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                          {emp.is_active ? '✅ نشط' : '⏸ موقف'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditEmp(emp)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12 }}>✏️</button>
                          <button onClick={() => toggleActive(emp)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${emp.is_active ? S.red : S.green}`, background: emp.is_active ? S.redB : S.greenB, color: emp.is_active ? S.red : S.green, cursor: 'pointer', fontSize: 12 }}>
                            {emp.is_active ? '⏸' : '▶'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {(showAdd || editEmp) && (
        <EmployeeModal employee={editEmp} branches={branches}
          onClose={() => { setShowAdd(false); setEditEmp(null) }}
          onSaved={() => { setShowAdd(false); setEditEmp(null); fetchAll() }} />
      )}
      {detailEmp && (
        <EmployeeDetailModal employee={detailEmp}
          onClose={() => setDetailEmp(null)}
          onEdit={() => { setEditEmp(detailEmp); setDetailEmp(null) }} />
      )}
    </div>
  )
}
