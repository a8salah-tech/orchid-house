'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../../../components/AuthProvider'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
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
  admin:                { label: 'مدير النظام',   color: S.gold,    bg: 'rgba(201,168,76,0.12)',   icon: '👑' },
  branch_manager:       { label: 'مدير الفرع',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',   icon: '🏪' },
  kitchen_manager:      { label: 'مدير المطبخ',   color: '#F97316', bg: 'rgba(249,115,22,0.12)',   icon: '🍳' },
  hall_manager:         { label: 'مدير الصالة',   color: '#06B6D4', bg: 'rgba(6,182,212,0.12)',    icon: '🏛️' },
  bar_manager:          { label: 'مدير البار',    color: '#6366F1', bg: 'rgba(99,102,241,0.12)',   icon: '🍹' },
  kitchen_supervisor:   { label: 'مشرف المطبخ',   color: S.red,     bg: S.redB,                   icon: '👨‍🍳' },
  hall_supervisor:      { label: 'مشرف الصالة',   color: S.blue,    bg: S.blueB,                  icon: '🍽️' },
  bar_supervisor:       { label: 'مشرف البار',    color: S.teal,    bg: S.tealB,                  icon: '☕' },
  assistant_supervisor: { label: 'مساعد مشرف',    color: '#A78BFA', bg: 'rgba(167,139,250,0.12)',  icon: '🤝' },
  cashier:              { label: 'كاشير',          color: S.green,   bg: S.greenB,                 icon: '💰' },
  assistant_cashier:    { label: 'مساعد كاشير',   color: '#34D399', bg: 'rgba(52,211,153,0.12)',   icon: '💳' },
  chef:                 { label: 'طباخ',           color: '#FB923C', bg: 'rgba(251,146,60,0.12)',   icon: '🧑‍🍳' },
  assistant_chef:       { label: 'مساعد طباخ',    color: '#FCA5A5', bg: 'rgba(252,165,165,0.12)',  icon: '🥘' },
  kitchen_worker:       { label: 'عامل مطبخ',     color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',   icon: '🔪' },
  bar_assistant:        { label: 'مساعد بار',     color: '#5EEAD4', bg: 'rgba(94,234,212,0.12)',   icon: '🧃' },
  hall_worker:          { label: 'عامل صالة',     color: '#93C5FD', bg: 'rgba(147,197,253,0.12)',  icon: '🪑' },
  kitchen_cleaner:      { label: 'عامل نظافة مطبخ', color: '#86EFAC', bg: 'rgba(134,239,172,0.12)', icon: '🧹' },
  hall_cleaner:         { label: 'عامل نظافة صالة', color: '#6EE7B7', bg: 'rgba(110,231,183,0.12)', icon: '🧽' },
  warehouse_keeper: { label: 'أمين المستودع', color: '#F97316', bg: 'rgba(249,115,22,0.12)', icon: '🏭' },
  employee:             { label: 'موظف',           color: S.muted,   bg: S.card2,                  icon: '👤' },
}

const DEPARTMENTS = ['المطبخ', 'البار', 'الصالة', 'الحلويات', 'الكاشير', 'الإدارة', 'التوصيل', 'النظافة']

interface Employee {
  id: string; name: string; name_en: string; employee_number: string
  role: string; department: string; branch_id: string; phone: string
  email: string; email_account?: string  // ① إيميل شخصي + إيميل النظام
  join_date: string; salary: number; is_active: boolean
  notes: string; photo_url?: string; national_id_url?: string
  auth_user_id?: string; branches?: { name: string }
  created_at?: string
}
interface Branch { id: string; name: string }
interface Registration {
  id: string; created_at: string; name: string; name_en: string
  phone: string; email: string; email_account: string; password_hint: string
  department: string; role: string
  notes: string; photo_url: string; national_id_url: string; status: string
  rejection_reason?: string
}

// ══ Upload image ══
async function uploadImage(supabase: ReturnType<typeof createClient>, file: File, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('employees').upload(path, file, { upsert: true })
  if (error) { console.error(error); return null }
  const { data: urlData } = supabase.storage.from('employees').getPublicUrl(data.path)
  return urlData.publicUrl
}

// ══ Parse notes from registration ══
function parseRegNotes(notes: string | null) {
  if (!notes) return { employee_number: null, branch_name: null, salary: null, join_date: null, extra_notes: null }
  const empMatch    = notes.match(/Employee #:\s*([^\|]+)/)
  const branchMatch = notes.match(/Branch:\s*([^\|]+)/)
  const salaryMatch = notes.match(/Salary:\s*([^\|]+)/)
  const dateMatch   = notes.match(/Joining Date:\s*([^\|]+)/)
  const extra = notes
    .replace(/Employee #:[^\|]+\|?/g, '').replace(/Branch:[^\|]+\|?/g, '')
    .replace(/Salary:[^\|]+\|?/g, '').replace(/Joining Date:[^\|]+\|?/g, '')
    .trim().replace(/^\|/, '').trim()
  return {
    employee_number: empMatch?.[1]?.trim() || null,
    branch_name:     branchMatch?.[1]?.trim() || null,
    salary:          salaryMatch ? parseFloat(salaryMatch[1].trim()) || null : null,
    join_date:       dateMatch?.[1]?.trim() || null,
    extra_notes:     extra || null,
  }
}

// ══ ② Export to CSV ══
function exportToCSV(employees: Employee[]) {
  const headers = ['الاسم', 'الاسم بالإنجليزية', 'رقم الموظف', 'الدور', 'القسم', 'الفرع', 'الهاتف', 'البريد الشخصي', 'بريد النظام', 'الراتب', 'تاريخ الانضمام', 'الحالة']
  const rows = employees.map(e => [
    e.name, e.name_en || '', e.employee_number || '',
    ROLES[e.role]?.label || e.role,
    e.department || '', e.branches?.name || '',
    e.phone || '', e.email || '', e.email_account || '',
    e.salary || '', e.join_date || '',
    e.is_active ? 'نشط' : 'موقف',
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// ══ Create Account Modal ══
function CreateAccountModal({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState(employee.email_account || employee.email || '')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!email || !password) { setError('يرجى إدخال الإيميل وكلمة المرور'); return }
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/create-employee-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: employee.id, email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'حدث خطأ'); setSaving(false); return }
      onSaved()
    } catch { setError('خطأ في الاتصال'); setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div><h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>🔑 إنشاء حساب دخول</h3><p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{employee.name}</p></div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: S.red }}>❌ {error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>البريد الإلكتروني للنظام *</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@orchid.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>كلمة المرور *</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, direction: 'ltr', textAlign: 'left', paddingLeft: 40 }} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 14 }}>{showPass ? '🙈' : '👁️'}</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={create} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{saving ? '⏳...' : '✅ إنشاء الحساب'}</button>
        </div>
      </div>
    </div>
  )
}

// ══ Change Password Modal ══
function ChangePasswordModal({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  async function change() {
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/create-employee-auth', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_user_id: employee.auth_user_id, new_password: password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'حدث خطأ'); setSaving(false); return }
      onSaved()
    } catch { setError('خطأ في الاتصال'); setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 380, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div><h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>🔄 تغيير كلمة المرور</h3><p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{employee.name}</p></div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: S.red }}>❌ {error}</div>}
        <div>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>كلمة المرور الجديدة *</label>
          <div style={{ position: 'relative' }}>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left', paddingLeft: 40 }} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 14 }}>{showPass ? '🙈' : '👁️'}</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={change} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{saving ? '⏳...' : '🔄 تغيير'}</button>
        </div>
      </div>
    </div>
  )
}

// ══ Add/Edit Employee Modal ══
function EmployeeModal({ employee, branches, onClose, onSaved }: { employee?: Employee | null; branches: Branch[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const photoRef = useRef<HTMLInputElement>(null)
  const idRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string>(employee?.photo_url || '')
  const [idPreview, setIdPreview] = useState<string>(employee?.national_id_url || '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [idFile, setIdFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    name: employee?.name || '',
    name_en: employee?.name_en || '',
    employee_number: employee?.employee_number || '',
    role: employee?.role || 'employee',
    department: employee?.department || '',
    branch_id: employee?.branch_id || '',
    phone: employee?.phone || '',
    email: employee?.email || '',           // ③ البريد الشخصي
    email_account: employee?.email_account || '', // ③ بريد النظام
    join_date: employee?.join_date || new Date().toISOString().split('T')[0],
    salary: employee?.salary?.toString() || '',
    notes: employee?.notes || '',
    is_active: employee?.is_active !== false,
  })

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)) }
  function handleId(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; setIdFile(file); setIdPreview(URL.createObjectURL(file)) }

  async function save() {
    if (!form.name || !form.role) { alert('يرجى إدخال الاسم والدور'); return }
    setSaving(true)
    let photo_url = employee?.photo_url || null
    let national_id_url = employee?.national_id_url || null
    if (photoFile) { const url = await uploadImage(supabase, photoFile, `photos/${employee?.id || Date.now()}_${Date.now()}.jpg`); if (url) photo_url = url }
    if (idFile) { const url = await uploadImage(supabase, idFile, `ids/${employee?.id || Date.now()}_${Date.now()}.jpg`); if (url) national_id_url = url }
    const payload = { ...form, salary: parseFloat(form.salary) || 0, photo_url, national_id_url, branch_id: form.branch_id || null, }    
    const { error } = employee ? await supabase.from('employees').update(payload).eq('id', employee.id) : await supabase.from('employees').insert([payload])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 720, padding: 32, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{employee ? '✏️ تعديل بيانات الموظف' : '➕ إضافة موظف جديد'}</h2>
            <p style={{ fontSize: 12, color: S.muted }}>أدخل بيانات الموظف والدور الوظيفي</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* صور */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20, padding: 16, background: S.card, borderRadius: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 10 }}>📸 صورة الموظف</div>
            <div onClick={() => photoRef.current?.click()} style={{ width: 100, height: 100, borderRadius: '50%', border: `2px dashed ${photoPreview ? S.green : S.border}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.navy3, margin: '0 auto 10px' }}>
              {photoPreview ? <img src={photoPreview} alt="صورة" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 28 }}>👤</div><div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>اضغط لرفع</div></div>}
            </div>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            {photoPreview && <button onClick={() => { setPhotoPreview(''); setPhotoFile(null) }} style={{ display: 'block', margin: '0 auto', padding: '4px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>🗑️ حذف</button>}
          </div>
          <div>
            <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 10 }}>🪪 صورة الهوية</div>
            <div onClick={() => idRef.current?.click()} style={{ width: '100%', height: 100, borderRadius: 12, border: `2px dashed ${idPreview ? S.green : S.border}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.navy3, marginBottom: 10 }}>
              {idPreview ? <img src={idPreview} alt="هوية" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 28 }}>🪪</div><div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>اضغط لرفع صورة الهوية</div></div>}
            </div>
            <input ref={idRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleId} />
            {idPreview && <button onClick={() => { setIdPreview(''); setIdFile(null) }} style={{ display: 'block', margin: '0 auto', padding: '4px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>🗑️ حذف</button>}
          </div>
        </div>

        {/* البيانات */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>First Name  *</label><input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الموظف" /></div>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Last Name * </label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="Employee Name" /></div>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>رقم الموظف</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.employee_number} onChange={e => setForm(p => ({ ...p, employee_number: e.target.value }))} placeholder="ORH-001" /></div>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الدور الوظيفي *</label><select style={inp} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>{Object.entries(ROLES).map(([key, val]) => <option key={key} value={key}>{val.icon} {val.label}</option>)}</select></div>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>القسم</label><select style={inp} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}><option value="">اختر القسم</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الفرع</label><select style={inp} value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}><option value="">اختر الفرع</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>رقم الهاتف</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+60 12-345 6789" /></div>
          {/* ③ البريد الشخصي */}
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📧 البريد الشخصي</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="personal@gmail.com" /></div>
          {/* ③ بريد النظام */}
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>🔑 بريد النظام (للدخول)</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.email_account} onChange={e => setForm(p => ({ ...p, email_account: e.target.value }))} placeholder="emp@orchid.com" /></div>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>تاريخ الانضمام</label><input style={inp} type="date" value={form.join_date} onChange={e => setForm(p => ({ ...p, join_date: e.target.value }))} /></div>
          <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الراتب الأساسي (MYR)</label><input style={inp} type="number" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} placeholder="0.00" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label><input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." /></div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: S.green }} />
            <label htmlFor="is_active" style={{ fontSize: 13, color: S.white, cursor: 'pointer' }}>موظف نشط — يظهر في النظام</label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 28px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{saving ? '⏳ جاري الحفظ...' : '✅ حفظ'}</button>
        </div>
      </div>
    </div>
  )
}

// ══ Employee Detail Modal ══
function EmployeeDetailModal({ employee, onClose, onEdit, onCreateAccount, onChangePassword }: {
  employee: Employee; onClose: () => void; onEdit: () => void; onCreateAccount: () => void; onChangePassword: () => void
}) {
  const role = ROLES[employee.role] || ROLES.employee
  const yearsInService = employee.join_date ? Math.floor((Date.now() - new Date(employee.join_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0
  const monthsInService = employee.join_date ? Math.floor((Date.now() - new Date(employee.join_date).getTime()) / (30.44 * 24 * 60 * 60 * 1000)) : 0
  const [photoModal, setPhotoModal] = useState<string | null>(null)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, padding: 28, margin: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', border: `2px solid ${role.color}`, overflow: 'hidden', background: role.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              {employee.photo_url ? <img src={employee.photo_url} alt={employee.name} onClick={() => setPhotoModal(employee.photo_url!)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} /> : role.icon}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: S.white, marginBottom: 2 }}>{employee.name} {employee.name_en}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: S.gold, marginBottom: 6 }}>{employee.employee_number || '—'}</div>
              <span style={{ background: role.bg, color: role.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{role.icon} {role.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'القسم', value: employee.department || '—', icon: '🏷️' },
            { label: 'الفرع', value: employee.branches?.name || '—', icon: '🏪' },
            { label: 'تاريخ الانضمام', value: employee.join_date || '—', icon: '📅' },
            { label: 'مدة الخدمة', value: yearsInService > 0 ? `${yearsInService} سنة` : `${monthsInService} شهر`, icon: '⏳' },
            { label: 'الراتب', value: employee.salary ? `MYR ${employee.salary.toLocaleString()}` : '—', icon: '💰' },
            { label: 'الهاتف', value: employee.phone || '—', icon: '📞' },
          ].map((row, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>{row.icon} {row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* ③ البريد الشخصي vs بريد النظام */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>📧 البريد الشخصي</div>
            <div style={{ fontSize: 12, color: S.white, wordBreak: 'break-all' }}>{employee.email || '—'}</div>
          </div>
          <div style={{ background: S.blueB, border: `1px solid ${S.blue}30`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: S.blue, marginBottom: 3 }}>🔑 بريد النظام</div>
            <div style={{ fontSize: 12, color: S.white, wordBreak: 'break-all' }}>{employee.email_account || '—'}</div>
          </div>
        </div>

        {/* صورة الهوية */}
        {employee.national_id_url && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 8 }}>🪪 صورة الهوية</div>
            <img src={employee.national_id_url} alt="هوية" style={{ width: '100%', maxHeight: 160, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', border: `1px solid ${S.border}` }} onClick={() => setPhotoModal(employee.national_id_url!)} />
          </div>
        )}

        {/* حساب الدخول */}
        <div style={{ background: S.card, borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>🔑 حساب الدخول</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: employee.auth_user_id ? S.green : S.red }}>{employee.auth_user_id ? '✅ حساب نشط' : '❌ لا يوجد حساب'}</div>
          </div>
          {employee.auth_user_id
            ? <button onClick={onChangePassword} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>🔄 تغيير كلمة المرور</button>
            : <button onClick={onCreateAccount} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>🔑 إنشاء حساب</button>
          }
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

      {/* Photo Viewer Modal */}
      {photoModal && (
        <div onClick={() => setPhotoModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={photoModal} alt="صورة" style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />
            <button onClick={() => setPhotoModal(null)}
              style={{ position: 'absolute', top: -14, left: -14, width: 34, height: 34, borderRadius: '50%', background: '#EF4444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              ✕
            </button>
            <a href={photoModal} download target="_blank" rel="noreferrer"
              onClick={async e => { e.preventDefault(); const r = await fetch(photoModal); const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'photo'; a.click(); URL.revokeObjectURL(u) }}
              style={{ position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)', padding: '6px 16px', borderRadius: 20, background: '#C9A84C', color: '#0A1628', fontSize: 12, fontWeight: 700, textDecoration: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>
              ⬇️ تحميل
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ══ أنواع الطلبات ══
const EMP_REQUEST_TYPES = [
  { key: 'leave_annual',    label: 'إجازة سنوية',     icon: '🏖️' },
  { key: 'leave_sick',      label: 'إجازة مرضية',     icon: '🏥' },
  { key: 'leave_emergency', label: 'إجازة طارئة',     icon: '🚨' },
  { key: 'advance',         label: 'سلفة راتب',        icon: '💰' },
  { key: 'extra_meal',      label: 'وجبة إضافية',     icon: '🍽️' },
  { key: 'complaint',       label: 'شكوى / مشكلة',    icon: '⚠️' },
  { key: 'suggestion',      label: 'اقتراح',           icon: '💡' },
  { key: 'other',           label: 'طلب آخر',          icon: '📋' },
]

// ══ Modal طلب الموظف ══
function EmployeeRequestModal({ employeeId, onClose, onSaved }: { employeeId: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ request_type: 'leave_annual', title: '', description: '', amount: '', start_date: '', end_date: '' })
  const reqType = EMP_REQUEST_TYPES.find(r => r.key === form.request_type)
  const hasDates = ['leave_annual','leave_sick','leave_emergency'].includes(form.request_type)
  const hasAmount = form.request_type === 'advance'
  const daysCount = form.start_date && form.end_date ? Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000*60*60*24)) + 1 : 0
  const inp2: React.CSSProperties = { ...inp, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }

  async function save() {
    if (!form.description) { alert('يرجى إدخال تفاصيل الطلب'); return }
    setSaving(true)
    const { error } = await supabase.from('employee_requests').insert([{ employee_id: employeeId, request_type: form.request_type, title: form.title || reqType?.label, description: form.description, amount: form.amount ? parseFloat(form.amount) : null, start_date: form.start_date || null, end_date: form.end_date || null, days_count: daysCount || null, status: 'pending' }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>📤 تقديم طلب جديد</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>نوع الطلب</label>
            <select style={inp2} value={form.request_type} onChange={e => setForm(p => ({ ...p, request_type: e.target.value }))}>
              {EMP_REQUEST_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>العنوان (اختياري)</label>
            <input style={inp2} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان مختصر..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التفاصيل *</label>
            <textarea style={{ ...inp2, minHeight: 80, resize: 'vertical' } as React.CSSProperties} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="اشرح طلبك بالتفصيل..." />
          </div>
          {hasAmount && (
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المبلغ (MYR)</label>
              <input style={inp2} type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </div>
          )}
          {hasDates && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>من تاريخ</label><input style={inp2} type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>إلى تاريخ</label><input style={inp2} type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></div>
              {daysCount > 0 && (
                <div style={{ gridColumn: '1/-1', background: S.blueB, borderRadius: 10, padding: '8px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: S.muted }}>عدد الأيام</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: S.blue }}>{daysCount} يوم</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{saving ? '⏳...' : '📤 إرسال الطلب'}</button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function EmployeesPage() {
  const supabase = createClient()
  const { employee: currentUser, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  const isManager = isAdmin || ['branch_manager','kitchen_manager','hall_manager','bar_manager','kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(currentUser?.role || '')
  const isEmployee = !isManager

  const [myRequests, setMyRequests] = useState<any[]>([])
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null)
  const [createAccountEmp, setCreateAccountEmp] = useState<Employee | null>(null)
  const [changePassEmp, setChangePassEmp] = useState<Employee | null>(null)
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [filterBranch, setFilterBranch] = useState('all')    // ④ فلتر الفرع
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterHasAccount, setFilterHasAccount] = useState('all') // ⑤ فلتر الحساب
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'name' | 'join_date' | 'salary'>('name') // ⑥ ترتيب
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [showRegistrations, setShowRegistrations] = useState(false)
  const [showBirthdays, setShowBirthdays] = useState(false)   // ⑦ تنبيهات
  const [page, setPage] = useState(1)
  const PER_PAGE = 20
  const statsRef = useRef<HTMLDivElement>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [emp, br, reg] = await Promise.all([
      supabase.from('employees').select('*, branches(name)').order('name'),
      supabase.from('branches').select('id,name').eq('is_active', true),
      supabase.from('employee_registrations').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setEmployees(emp.data || [])
    setBranches(br.data || [])
    setRegistrations(reg.data || [])
    if (currentUser?.id) {
      const { data: myReq } = await supabase.from('employee_requests').select('*').eq('employee_id', currentUser.id).order('created_at', { ascending: false }).limit(20)
      setMyRequests(myReq || [])
    }
    setLoading(false)
  }, [currentUser?.id])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { setPage(1) }, [search, filterRole, filterDept, filterBranch, filterStatus, filterHasAccount, sortBy])

  async function activateRegistration(reg: Registration) {
    const parsed = parseRegNotes(reg.notes)
    // ⑧ البحث عن الفرع بالاسم
const branchMap: Record<string, string> = {
  'Orchid House KLCC': 'اوركيد فرع KLCC',
  'Orchid House':      'اوركيد هاوس',
}
const mappedName = branchMap[parsed.branch_name || ''] || parsed.branch_name
const matchedBranch = branches.find(b => b.name === mappedName)
 
const { data: newEmp, error } = await supabase.from('employees').insert([{
      name: reg.name, name_en: reg.name_en || null, phone: reg.phone || null,
      email: reg.email || null,           // البريد الشخصي
      email_account: reg.email_account || null, // بريد النظام
      department: reg.department || null, role: reg.role || 'employee',
      photo_url: reg.photo_url || null, national_id_url: reg.national_id_url || null,
      notes: parsed.extra_notes || null,
      employee_number: parsed.employee_number || null,
      salary: parsed.salary || null,
      join_date: parsed.join_date || new Date().toISOString().split('T')[0],
      branch_id: matchedBranch?.id || null,
      is_active: true,
    }]).select().single()
    if (error) { alert('خطأ: ' + error.message); return }
    if (reg.email_account && reg.password_hint && newEmp?.id) {
      try {
        const res = await fetch('/api/create-employee-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: newEmp.id, email: reg.email_account, password: reg.password_hint }) })
        const result = await res.json()
        if (!res.ok) alert('✅ تم إضافة الموظف لكن فشل إنشاء الحساب: ' + result.error)
        else alert('✅ تم تفعيل الموظف ' + reg.name + ' وإنشاء حسابه بنجاح!')
      } catch { alert('✅ تم إضافة الموظف لكن فشل إنشاء الحساب') }
    } else { alert('✅ تم تفعيل الموظف ' + reg.name + ' بنجاح!') }
    await supabase.from('employee_registrations').update({ status: 'approved' }).eq('id', reg.id)
    fetchAll()
  }

  const [rejectModal, setRejectModal] = useState<Registration | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  async function rejectRegistration(reg: Registration) {
    setRejectModal(reg)
    setRejectReason('')
  }

  async function confirmReject() {
    if (!rejectModal) return
    setRejecting(true)
    await supabase.from('employee_registrations').update({
      status: 'rejected',
      rejection_reason: rejectReason || null,
    }).eq('id', rejectModal.id)

    // Send rejection email via API
    if (rejectModal.email) {
      try {
        await fetch('/api/send-rejection-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: rejectModal.name,
            email: rejectModal.email,
            reason: rejectReason,
          })
        })
      } catch (e) { console.error('Email send failed:', e) }
    }

    setRejecting(false)
    setRejectModal(null)
    fetchAll()
  }

  async function toggleActive(emp: Employee) {
    await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id)
    fetchAll()
  }

  async function deleteEmployee(emp: Employee) {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${emp.name}" نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.`)) return
    await supabase.from('employee_requests').delete().eq('employee_id', emp.id)
    await supabase.from('shift_schedules').delete().eq('employee_id', emp.id)
    await supabase.from('shift_requests').delete().eq('employee_id', emp.id)
    const { error } = await supabase.from('employees').delete().eq('id', emp.id)
    if (error) { alert('حدث خطأ أثناء الحذف: ' + error.message); return }
    fetchAll()
  }

  // ══ إحصائيات ══
  const activeCount  = employees.filter(e => e.is_active).length
  const inactiveCount = employees.filter(e => !e.is_active).length
  const withAccount  = employees.filter(e => e.auth_user_id).length
  const totalSalary  = employees.filter(e => e.is_active).reduce((s, e) => s + (e.salary || 0), 0)
  const roleCounts   = Object.keys(ROLES).reduce((acc, r) => { acc[r] = employees.filter(e => e.role === r).length; return acc }, {} as Record<string, number>)
  const deptCounts   = DEPARTMENTS.reduce((acc, d) => { acc[d] = employees.filter(e => e.department === d).length; return acc }, {} as Record<string, number>)

  // ⑥ فلترة وترتيب
  const filtered = useMemo(() => {
    let list = employees.filter(e => {
      const matchSearch = !search || e.name.includes(search) || (e.name_en || '').toLowerCase().includes(search.toLowerCase()) || (e.employee_number || '').includes(search) || (e.phone || '').includes(search)
      const matchRole   = filterRole === 'all'   || e.role === filterRole
      const matchDept   = filterDept === 'all'   || e.department === filterDept
      const matchBranch = filterBranch === 'all' || e.branch_id === filterBranch
      const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? e.is_active : !e.is_active)
      const matchAcct   = filterHasAccount === 'all' || (filterHasAccount === 'yes' ? !!e.auth_user_id : !e.auth_user_id)
      return matchSearch && matchRole && matchDept && matchBranch && matchStatus && matchAcct
    })
    if (sortBy === 'join_date') list = list.sort((a, b) => (b.join_date || '').localeCompare(a.join_date || ''))
    else if (sortBy === 'salary') list = list.sort((a, b) => (b.salary || 0) - (a.salary || 0))
    else list = list.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    return list
  }, [employees, search, filterRole, filterDept, filterBranch, filterStatus, filterHasAccount, sortBy])

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  // ══ شاشة الموظف العادي ══
  if (isEmployee && currentUser) {
    const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
      pending:   { label: '⏳ قيد المراجعة', color: S.amber, bg: S.amberB },
      approved:  { label: '✅ موافق عليه',   color: S.green, bg: S.greenB },
      rejected:  { label: '❌ مرفوض',        color: S.red,   bg: S.redB },
      completed: { label: '🏁 مكتمل',        color: S.teal,  bg: S.tealB },
    }
    const EMP_REQUEST_LABELS: Record<string, string> = {
      leave_annual: '🏖️ إجازة سنوية', leave_sick: '🏥 إجازة مرضية',
      leave_emergency: '🚨 إجازة طارئة', advance: '💰 سلفة راتب',
      extra_meal: '🍽️ وجبة إضافية', complaint: '⚠️ شكوى',
      suggestion: '💡 اقتراح', other: '📋 طلب آخر',
    }
    return (
      <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); select option { background: #0F2040; color: #FAFAF8; } input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`}</style>
        <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: S.gold3, border: `2px solid ${S.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{currentUser.name?.charAt(0) || '👤'}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: S.white, marginBottom: 4 }}>{currentUser.name}</div>
                <div style={{ fontSize: 13, color: S.muted }}>{currentUser.department && `🏷️ ${currentUser.department}`}</div>
              </div>
            </div>
            <button onClick={() => setShowNewRequest(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ طلب جديد</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: S.white, marginBottom: 16 }}>📋 طلباتي</div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          : myRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد طلبات بعد</div>
              <button onClick={() => setShowNewRequest(true)} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ طلب جديد</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myRequests.map((req: any) => {
                const st = STATUS_MAP[req.status] || STATUS_MAP.pending
                return (
                  <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 4 }}>{EMP_REQUEST_LABELS[req.request_type] || req.request_type}</div>
                        <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>{req.description?.slice(0, 80)}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {req.amount && <span style={{ fontSize: 11, color: S.gold }}>💰 MYR {req.amount}</span>}
                          {req.days_count && <span style={{ fontSize: 11, color: S.blue }}>📅 {req.days_count} يوم</span>}
                          <span style={{ fontSize: 11, color: S.muted }}>{new Date(req.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{st.label}</span>
                    </div>
                    {req.rejection_reason && <div style={{ marginTop: 8, background: S.redB, borderRadius: 8, padding: '6px 12px', fontSize: 12, color: S.red }}>سبب الرفض: {req.rejection_reason}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {showNewRequest && currentUser.id && <EmployeeRequestModal employeeId={currentUser.id} onClose={() => setShowNewRequest(false)} onSaved={() => { setShowNewRequest(false); fetchAll() }} />}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .emp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .emp-card { transition: all .2s; }
        .stats-scroll::-webkit-scrollbar { height: 4px; }
        .stats-scroll::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>👷 الموظفون</h1>
          {/* ⑨ ملخص سريع */}
          <p style={{ fontSize: 13, color: S.white }}>{employees.length} موظف · {activeCount} نشط · {withAccount} لديهم حسابات · إجمالي الرواتب MYR {totalSalary.toLocaleString()}</p>
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
          {/* ② زر تصدير */}
          <button onClick={() => exportToCSV(filtered)} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📥 تصدير</button>
          <button onClick={() => setShowAdd(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ موظف جديد</button>
        </div>
      </div>

      {/* ══ طلبات التسجيل ══ */}
      {registrations.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: S.amberB, border: `1px solid ${S.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📋</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>طلبات التسجيل الجديدة</div>
                <div style={{ fontSize: 12, color: S.muted }}>{registrations.length} طلب في انتظار المراجعة</div>
              </div>
            </div>
            <button onClick={() => setShowRegistrations(p => !p)} style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {showRegistrations ? 'إخفاء' : 'عرض الطلبات'}
            </button>
          </div>
          {showRegistrations && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {registrations.map(reg => {
                const parsed = parseRegNotes(reg.notes)
                // ⑩ تحقق من التكرار
                const isDuplicateEmail = reg.email_account && employees.some(e => e.email_account === reg.email_account || e.email === reg.email_account)
                return (
                  <div key={reg.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${isDuplicateEmail ? S.red + '60' : S.amber + '30'}`, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {reg.photo_url ? <img src={reg.photo_url} alt={reg.name} onClick={() => setPhotoModal(reg.photo_url)} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${S.gold}`, cursor: 'pointer' }} /> : <div style={{ width: 48, height: 48, borderRadius: '50%', background: S.gold3, border: `2px solid ${S.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>}
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: S.white, marginBottom: 2 }}>
                            {reg.name} {reg.name_en && <span style={{ fontSize: 12, color: S.muted, fontStyle: 'italic' }}>{reg.name_en}</span>}
                            {isDuplicateEmail && <span style={{ marginRight: 8, background: S.redB, color: S.red, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>⚠️ إيميل مكرر</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            {reg.role && <span style={{ background: S.gold3, color: S.gold, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{ROLES[reg.role]?.label || reg.role}</span>}
                            {reg.department && <span style={{ background: S.blueB, color: S.blue, borderRadius: 20, padding: '2px 10px', fontSize: 11 }}>{reg.department}</span>}
                          </div>
                          {/* ⑧ عرض البيانات المستخرجة من notes */}
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: S.muted }}>
                            {parsed.employee_number && <span>🔢 {parsed.employee_number}</span>}
                            {parsed.branch_name && <span>🏪 {parsed.branch_name}</span>}
                            {parsed.salary && <span>💰 MYR {parsed.salary}</span>}
                            {parsed.join_date && <span>📅 {parsed.join_date}</span>}
                          </div>
                          {/* ③ إيميلين */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, fontSize: 11 }}>
                            {reg.email && <span style={{ color: S.muted }}>📧 {reg.email}</span>}
                            {reg.email_account && <span style={{ background: S.greenB, color: S.green, borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>🔑 {reg.email_account}</span>}
                            {reg.phone && <span style={{ color: S.muted }}>📞 {reg.phone}</span>}
                          </div>
                          {reg.national_id_url && (
                            <button onClick={() => window.open(reg.national_id_url, '_blank')} style={{ marginTop: 6, padding: '3px 10px', borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>🪪 عرض الهوية</button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => activateRegistration(reg)} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ تفعيل</button>
                        <button onClick={() => rejectRegistration(reg)} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>❌ رفض</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 10, color: S.muted }}>⏰ {new Date(reg.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ height: 1, background: S.border, marginBottom: 8 }} />
        </div>
      )}

      {/* ④ Stats مع scroll أفقي لعرض كل الأقسام */}
      <div ref={statsRef} className="stats-scroll" style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
        {/* الإجمالي */}
        <div style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px', flexShrink: 0, minWidth: 120, cursor: 'pointer' }} onClick={() => setFilterStatus('all')}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>👥</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 2 }}>{employees.length}</div>
          <div style={{ fontSize: 12, color: S.muted }}>إجمالي الموظفين</div>
        </div>
        {/* نشط */}
        <div style={{ background: S.greenB, borderRadius: 14, border: `1px solid rgba(34,197,94,0.2)`, padding: '16px 18px', flexShrink: 0, minWidth: 120, cursor: 'pointer' }} onClick={() => setFilterStatus('active')}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.green, marginBottom: 2 }}>{activeCount}</div>
          <div style={{ fontSize: 12, color: S.muted }}>نشط</div>
        </div>
        {/* موقف */}
        <div style={{ background: S.redB, borderRadius: 14, border: `1px solid rgba(239,68,68,0.2)`, padding: '16px 18px', flexShrink: 0, minWidth: 120, cursor: 'pointer' }} onClick={() => setFilterStatus('inactive')}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>⏸</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.red, marginBottom: 2 }}>{inactiveCount}</div>
          <div style={{ fontSize: 12, color: S.muted }}>موقف</div>
        </div>
        {/* لديهم حسابات */}
        <div style={{ background: S.blueB, borderRadius: 14, border: `1px solid rgba(59,130,246,0.2)`, padding: '16px 18px', flexShrink: 0, minWidth: 120, cursor: 'pointer' }} onClick={() => setFilterHasAccount(filterHasAccount === 'yes' ? 'all' : 'yes')}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🔑</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.blue, marginBottom: 2 }}>{withAccount}</div>
          <div style={{ fontSize: 12, color: S.muted }}>لديهم حسابات</div>
        </div>
        {/* ⑤ كل الأدوار — scroll */}
        {Object.entries(ROLES).map(([key, cfg]) => (
          <div key={key} style={{ background: filterRole === key ? cfg.bg : S.card, borderRadius: 14, border: `1px solid ${filterRole === key ? cfg.color + '60' : S.border}`, padding: '16px 18px', cursor: 'pointer', flexShrink: 0, minWidth: 120, opacity: roleCounts[key] === 0 ? 0.5 : 1 }}
            onClick={() => setFilterRole(filterRole === key ? 'all' : key)}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{cfg.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, marginBottom: 2 }}>{roleCounts[key] || 0}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{cfg.label}</div>
          </div>
        ))}
        {/* ⑤ كل الأقسام */}
        {DEPARTMENTS.map(dept => (
          <div key={dept} style={{ background: filterDept === dept ? S.purpleB : S.card, borderRadius: 14, border: `1px solid ${filterDept === dept ? S.purple + '60' : S.border}`, padding: '16px 18px', cursor: 'pointer', flexShrink: 0, minWidth: 120 }}
            onClick={() => setFilterDept(filterDept === dept ? 'all' : dept)}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🏷️</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: S.purple, marginBottom: 2 }}>{deptCounts[dept] || 0}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{dept}</div>
          </div>
        ))}
      </div>

      {/* ⑥ Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم، رقم الموظف، أو الهاتف..." />
        <select style={{ ...inp, width: 'auto', minWidth: 130 }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
          <option value="all">كل الفروع</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select style={{ ...inp, width: 'auto', minWidth: 130 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">موقف</option>
        </select>
        <select style={{ ...inp, width: 'auto', minWidth: 130 }} value={filterHasAccount} onChange={e => setFilterHasAccount(e.target.value)}>
          <option value="all">كل الحسابات</option>
          <option value="yes">لديهم حساب</option>
          <option value="no">بدون حساب</option>
        </select>
        {/* ⑥ ترتيب */}
        <select style={{ ...inp, width: 'auto', minWidth: 130 }} value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="name">ترتيب: الاسم</option>
          <option value="join_date">ترتيب: تاريخ الانضمام</option>
          <option value="salary">ترتيب: الراتب</option>
        </select>
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          <button onClick={() => setView('grid')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'grid' ? S.gold3 : 'transparent', color: view === 'grid' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>⊞</button>
          <button onClick={() => setView('list')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'list' ? S.gold3 : 'transparent', color: view === 'list' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>☰</button>
        </div>
        <div style={{ fontSize: 12, color: S.muted }}>{filtered.length} موظف</div>
        {/* ⑪ زر مسح الفلاتر */}
        {(filterRole !== 'all' || filterDept !== 'all' || filterBranch !== 'all' || filterStatus !== 'all' || filterHasAccount !== 'all' || search) && (
          <button onClick={() => { setFilterRole('all'); setFilterDept('all'); setFilterBranch('all'); setFilterStatus('all'); setFilterHasAccount('all'); setSearch('') }}
            style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
            ✕ مسح الفلاتر
          </button>
        )}
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
          {paginated.map(emp => {
            const role = ROLES[emp.role] || ROLES.employee
            const yearsService = emp.join_date && emp.join_date !== '—'
  ? Math.floor((Date.now() - new Date(emp.join_date).getTime()) / (365.25*24*60*60*1000))
  : -1            
  return (
              <div key={emp.id} className="emp-card" onClick={() => setDetailEmp(emp)}
                style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${emp.is_active ? S.border : S.redB}`, padding: 20, cursor: 'pointer', opacity: emp.is_active ? 1 : 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${role.color}`, overflow: 'hidden', background: role.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {emp.photo_url ? <img src={emp.photo_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : role.icon}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ background: emp.is_active ? S.greenB : S.redB, color: emp.is_active ? S.green : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{emp.is_active ? '✅ نشط' : '⏸ موقف'}</span>
                    {emp.auth_user_id && <span style={{ fontSize: 10, color: S.blue }}>🔑 حساب نشط</span>}
                    {/* ⑫ شارة مدة الخدمة */}
                    {yearsService >= 1 && emp.join_date && <span style={{ fontSize: 10, color: S.gold }}>⭐ {yearsService} سنة</span>}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: S.white, marginBottom: 2 }}>
                     {emp.name}{emp.name_en ? ` ${emp.name_en}` : ''}
</div>                <div style={{ fontSize: 13, fontWeight: 800, color: S.gold, letterSpacing: 1, marginBottom: 6 }}>{emp.employee_number || '—'}</div>
                <span style={{ background: role.bg, color: role.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{role.label}</span>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 12, color: S.muted }}>🏷️ {emp.department || '—'}</div>
                  <div style={{ fontSize: 12, color: S.muted }}>🏪 {emp.branches?.name || '—'}</div>
                  <div style={{ fontSize: 12, color: S.muted }}>📞 {emp.phone || '—'}</div>
                 <div style={{ fontSize: 11, color: S.muted }}>📧 {emp.email || emp.email_account || '—'}</div>
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditEmp(emp); setDetailEmp(null) }} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>✏️ تعديل</button>
                  <button onClick={() => toggleActive(emp)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${emp.is_active ? S.red : S.green}`, background: emp.is_active ? S.redB : S.greenB, color: emp.is_active ? S.red : S.green, cursor: 'pointer', fontSize: 12 }}>{emp.is_active ? '⏸' : '▶'}</button>
                  <button onClick={() => deleteEmployee(emp)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['الموظف', 'الدور', 'القسم', 'الفرع', 'الراتب', 'تاريخ الانضمام', 'البريد الشخصي', 'بريد النظام', 'الحساب', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(emp => {
                  const role = ROLES[emp.role] || ROLES.employee
                  return (
                    <tr key={emp.id} onClick={() => setDetailEmp(emp)} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer', opacity: emp.is_active ? 1 : 0.6 }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${role.color}`, overflow: 'hidden', background: role.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            {emp.photo_url ? <img src={emp.photo_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : role.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{emp.name} {emp.name_en && <span style={{ fontSize: 11, color: S.muted }}>{emp.name_en}</span>}</div>
                            <div style={{ fontSize: 11, color: S.gold }}>{emp.employee_number || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: role.bg, color: role.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{role.label}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{emp.department || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{emp.branches?.name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: S.gold }}>{emp.salary ? `MYR ${emp.salary.toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted, whiteSpace: 'nowrap' }}>{emp.join_date || '—'}</td>
                      {/* ③ عمودين للإيميل */}
                      <td style={{ padding: '12px 16px', fontSize: 11, color: S.muted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: S.blue, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email_account || '—'}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, color: emp.auth_user_id ? S.green : S.muted }}>{emp.auth_user_id ? '🔑 نشط' : '—'}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: emp.is_active ? S.greenB : S.redB, color: emp.is_active ? S.green : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{emp.is_active ? '✅ نشط' : '⏸ موقف'}</span></td>
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditEmp(emp)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12 }}>✏️</button>
                          <button onClick={() => toggleActive(emp)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${emp.is_active ? S.red : S.green}`, background: emp.is_active ? S.redB : S.greenB, color: emp.is_active ? S.red : S.green, cursor: 'pointer', fontSize: 12 }}>{emp.is_active ? '⏸' : '▶'}</button>
                          <button onClick={() => deleteEmployee(emp)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 }}>
          <button onClick={() => setPage(1)} disabled={page === 1}
            style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: page === 1 ? S.muted : S.white, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
            ««
          </button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: page === 1 ? S.muted : S.white, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
            ← السابق
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: S.muted, fontSize: 12 }}>...</span>}
                <button onClick={() => setPage(p)}
                  style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${p === page ? S.gold : S.border}`, background: p === page ? S.gold3 : S.card, color: p === page ? S.gold : S.white, cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 700 : 400, fontFamily: 'Tajawal, sans-serif' }}>
                  {p}
                </button>
              </span>
            ))}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: page >= totalPages ? S.muted : S.white, cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
            التالي →
          </button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
            style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: page === totalPages ? S.muted : S.white, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
            »»
          </button>
          <span style={{ fontSize: 12, color: S.muted, marginRight: 8 }}>
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} من {filtered.length}
          </span>
        </div>
      )}

      {/* Modals */}
      {(showAdd || editEmp) && <EmployeeModal employee={editEmp} branches={branches} onClose={() => { setShowAdd(false); setEditEmp(null) }} onSaved={() => { setShowAdd(false); setEditEmp(null); fetchAll() }} />}
      {detailEmp && <EmployeeDetailModal employee={detailEmp} onClose={() => setDetailEmp(null)} onEdit={() => { setEditEmp(detailEmp); setDetailEmp(null) }} onCreateAccount={() => { setCreateAccountEmp(detailEmp); setDetailEmp(null) }} onChangePassword={() => { setChangePassEmp(detailEmp); setDetailEmp(null) }} />}
      {createAccountEmp && <CreateAccountModal employee={createAccountEmp} onClose={() => setCreateAccountEmp(null)} onSaved={() => { setCreateAccountEmp(null); fetchAll() }} />}
      {changePassEmp && <ChangePasswordModal employee={changePassEmp} onClose={() => setChangePassEmp(null)} onSaved={() => { setChangePassEmp(null); fetchAll() }} />}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 440, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ color: S.red, fontSize: 16, fontWeight: 700 }}>❌ رفض طلب التسجيل</h3>
                <p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{rejectModal.name}</p>
              </div>
              <button onClick={() => setRejectModal(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>سبب الرفض (اختياري)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="مثال: البيانات غير مكتملة، يرجى إعادة التسجيل مع صورة الهوية..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.10)`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box', minHeight: 100, resize: 'vertical', direction: 'rtl' }}
              />
              {rejectModal.email && (
                <div style={{ fontSize: 11, color: S.muted, marginTop: 6 }}>
                  📧 سيتم إرسال إيميل للموظف على: <strong style={{ color: S.white }}>{rejectModal.email}</strong>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal(null)} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button onClick={confirmReject} disabled={rejecting} style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {rejecting ? '⏳...' : '❌ رفض وإرسال إيميل'}
              </button>
            </div>
          </div>
        </div>
      )}
      {photoModal && (
        <div onClick={() => setPhotoModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={photoModal} alt="صورة الموظف" style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: 20, objectFit: 'contain', boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />
            <button onClick={() => setPhotoModal(null)} style={{ position: 'absolute', top: -16, left: -16, width: 36, height: 36, borderRadius: '50%', background: S.red, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
