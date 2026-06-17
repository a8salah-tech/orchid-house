'use client'


import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../../components/AuthProvider'
import { useLang } from '../../../components/LanguageContext'
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

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const REQUEST_TYPES: Record<string, { label: string; label_en: string; icon: string; color: string; bg: string; hasAmount?: boolean; hasDates?: boolean }> = {
  leave_sick:    { label: 'إجازة مرضية', label_en: 'Sick Leave',     icon: '🏥', color: S.red,    bg: S.redB,    hasDates: true },
  leave_emergency:{ label: 'إجازة طارئة', label_en: 'Emergency Leave',    icon: '🚨', color: S.amber,  bg: S.amberB,  hasDates: true },
  overtime:      { label: 'طلب أوفر تايم', label_en: 'Overtime Request',   icon: '⏰', color: S.purple, bg: S.purpleB, hasDates: true },
  extra_meal:    { label: 'وجبة إضافية', label_en: 'Extra Meal',     icon: '🍽️', color: S.teal,  bg: S.tealB },
  complaint:     { label: 'شكوى / مشكلة', label_en: 'Complaint / Issue',    icon: '⚠️', color: S.red,   bg: S.redB },
  suggestion:    { label: 'اقتراح', label_en: 'Suggestion',           icon: '💡', color: S.green,  bg: S.greenB },
  other:           { label: 'طلب آخر', label_en: 'Other Request',               icon: '📋', color: S.muted,  bg: S.card2 },
  attendance_correction: { label: 'تصحيح حضور', label_en: 'Attendance Correction', icon: '🕐', color: S.teal, bg: S.tealB, hasDates: true },
  salary_increase: { label: 'زيادة راتب', label_en: 'Salary Increase', icon: '📈', color: S.green, bg: S.greenB, hasAmount: true },
  salary_advance:  { label: 'سلفة راتب', label_en: 'Salary Advance',   icon: '💸', color: S.gold,  bg: S.gold3,  hasAmount: true },
  shift_assigned:  { label: 'تعيين شيفت', label_en: 'Shift Assigned',  icon: '🗓️', color: S.blue,  bg: S.blueB },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: 'قيد الانتظار', color: S.amber,  bg: S.amberB,  icon: '⏳' },
  approved: { label: 'موافق عليه',   color: S.green,  bg: S.greenB,  icon: '✅' },
  rejected: { label: 'مرفوض',        color: S.red,    bg: S.redB,    icon: '❌' },
  completed:{ label: 'مكتمل',        color: S.teal,   bg: S.tealB,   icon: '🏁' },
}

interface Employee { id: string; name: string; name_en?: string; employee_number?: string; role: string; department: string; salary?: number; join_date?: string; branch_id?: string }
interface EmployeeRequest {
  id: string; created_at: string; request_number: number
  employee_id: string; request_type: string; status: string
  title: string; description: string; amount: number
  start_date: string; end_date: string; days_count: number
  approved_by: string; approved_at: string; rejection_reason: string
  employees?: { name: string; name_en?: string; role: string; department: string; employee_number?: string; branch_id?: string; branches?: { name: string } }
}

// ══ Salary Increase Request Modal ══
function SalaryIncreaseModal({ employee, onClose, onSaved }: {
  employee: Employee; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    current_salary: employee.salary?.toString() || '',
    requested_salary: '',
    reason: '',
    achievements: '',
    date_of_request: new Date().toISOString().split('T')[0],
  })

  const inp2: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
    color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
    boxSizing: 'border-box', direction: 'ltr',
  }

  async function save() {
    if (!form.requested_salary || !form.reason) { alert('Please fill in all required fields'); return }
    setSaving(true)
    const description = `SALARY INCREASE REQUEST

Employee: ${employee.name} ${employee.name_en || ''}
Employee ID: ${employee.employee_number || '—'}
Position: ${employee.role}
Department: ${employee.department || '—'}
Years of Service: ${employee.join_date ? Math.floor((Date.now() - new Date(employee.join_date).getTime()) / (365.25*24*60*60*1000)) : '—'}
Date of Request: ${form.date_of_request}

Current Salary: MYR ${form.current_salary || '—'}
Requested Salary: MYR ${form.requested_salary}
Increase Amount: MYR ${form.current_salary && form.requested_salary ? (parseFloat(form.requested_salary) - parseFloat(form.current_salary)).toFixed(2) : '—'}

Reason: ${form.reason}

Key Achievements: ${form.achievements || '—'}`

    const { error } = await supabase.from('employee_requests').insert([{
      employee_id: employee.id,
      request_type: 'salary_increase',
      title: 'Salary Increase Request',
      description,
      amount: parseFloat(form.requested_salary) || null,
      status: 'pending',
    }])
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSaved()
  }

  const increase = form.current_salary && form.requested_salary
    ? (parseFloat(form.requested_salary) - parseFloat(form.current_salary)).toFixed(2)
    : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 620, padding: 32, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📈 Salary Increase Request</h2>
            <p style={{ fontSize: 12, color: S.muted }}>Fill in your details and submit to management</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Employee Info — read only */}
        <div style={{ background: S.card, borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 10 }}>👤 Employee Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Employee Name', value: `${employee.name}${employee.name_en ? ' ' + employee.name_en : ''}` },
              { label: 'Employee ID', value: employee.employee_number || '—' },
              { label: 'Position / Job Title', value: employee.role },
              { label: 'Department', value: employee.department || '—' },
              { label: 'Years of Service', value: employee.join_date ? `${Math.floor((Date.now() - new Date(employee.join_date).getTime()) / (365.25*24*60*60*1000))} year(s)` : '—' },
              { label: 'Date of Request', value: form.date_of_request },
            ].map((r, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: S.muted, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Salary Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Current Salary (MYR)</label>
              <input style={inp2} type="number" value={form.current_salary} onChange={e => setForm(p => ({ ...p, current_salary: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Requested Salary (MYR) *</label>
              <input style={inp2} type="number" value={form.requested_salary} onChange={e => setForm(p => ({ ...p, requested_salary: e.target.value }))} placeholder="0.00" />
            </div>
          </div>

          {increase && (
            <div style={{ background: parseFloat(increase) > 0 ? S.greenB : S.redB, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: S.muted }}>Requested Increase</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: parseFloat(increase) > 0 ? S.green : S.red }}>MYR {increase}</span>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Reason for Salary Increase Request *</label>
            <textarea style={{ ...inp2, minHeight: 90, resize: 'vertical', direction: 'ltr' } as React.CSSProperties}
              value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Explain why you are requesting a salary increase..." />
          </div>

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Key Achievements / Contributions (Optional)</label>
            <textarea style={{ ...inp2, minHeight: 70, resize: 'vertical', direction: 'ltr' } as React.CSSProperties}
              value={form.achievements} onChange={e => setForm(p => ({ ...p, achievements: e.target.value }))}
              placeholder="List your key achievements..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ Submitting...' : '📤 Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Salary Advance Request Modal ══
function SalaryAdvanceModal({ employee, onClose, onSaved }: {
  employee: Employee; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    amount_requested: '',
    repayment_months: '1',
    reason: '',
    date_of_request: new Date().toISOString().split('T')[0],
  })

  const inp2: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
    color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
    boxSizing: 'border-box', direction: 'ltr',
  }

  const monthlyDeduction = form.amount_requested && form.repayment_months
    ? (parseFloat(form.amount_requested) / parseInt(form.repayment_months)).toFixed(2)
    : null

  async function save() {
    if (!form.amount_requested || !form.reason) { alert('Please fill in all required fields'); return }
    setSaving(true)
    const description = `SALARY ADVANCE REQUEST

Employee: ${employee.name} ${employee.name_en || ''}
Employee ID: ${employee.employee_number || '—'}
Position: ${employee.role}
Department: ${employee.department || '—'}
Date of Request: ${form.date_of_request}

Amount Requested: MYR ${form.amount_requested}
Repayment Period: ${form.repayment_months} month(s)
Monthly Deduction: MYR ${monthlyDeduction || '—'}

Reason: ${form.reason}`

    const { error } = await supabase.from('employee_requests').insert([{
      employee_id: employee.id,
      request_type: 'salary_advance',
      title: 'Salary Advance Request',
      description,
      amount: parseFloat(form.amount_requested) || null,
      status: 'pending',
    }])
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 580, padding: 32, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>💸 Salary Advance Request</h2>
            <p style={{ fontSize: 12, color: S.muted }}>Submit a request for salary advance</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Employee Info — read only */}
        <div style={{ background: S.card, borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 10 }}>👤 Employee Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Employee Name', value: `${employee.name}${employee.name_en ? ' ' + employee.name_en : ''}` },
              { label: 'Employee ID', value: employee.employee_number || '—' },
              { label: 'Position', value: employee.role },
              { label: 'Department', value: employee.department || '—' },
            ].map((r, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: S.muted, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Amount Requested (MYR) *</label>
              <input style={inp2} type="number" value={form.amount_requested} onChange={e => setForm(p => ({ ...p, amount_requested: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Repayment Period (Months)</label>
              <select style={{ ...inp2, cursor: 'pointer' }} value={form.repayment_months} onChange={e => setForm(p => ({ ...p, repayment_months: e.target.value }))}>
                {[1,2,3,4,5,6].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>

          {monthlyDeduction && (
            <div style={{ background: S.gold3, border: `1px solid rgba(201,168,76,0.3)`, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: S.muted }}>Monthly Deduction</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>MYR {monthlyDeduction} / month</span>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Reason for Request *</label>
            <textarea style={{ ...inp2, minHeight: 90, resize: 'vertical', direction: 'ltr' } as React.CSSProperties}
              value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Explain why you need a salary advance..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ Submitting...' : '📤 Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ New Request Modal ══
function NewRequestModal({ employees, onClose, onSaved, currentEmployeeId, initialType, canRequestSalary }: {
  employees: Employee[]; onClose: () => void; onSaved: () => void; currentEmployeeId?: string; initialType?: string; canRequestSalary?: boolean
}) {
  const supabase = createClient()
  const { isAr } = useLang()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: currentEmployeeId || '', request_type: initialType || 'leave_sick',
    title: '', description: '', amount: '',
    start_date: '', end_date: '',
    correct_checkin: '', correct_checkout: '',
  })

  const reqType = REQUEST_TYPES[form.request_type]

  const daysCount = form.start_date && form.end_date
    ? Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  async function save() {
    if (!form.employee_id || !form.request_type) { alert('يرجى اختيار الموظف ونوع الطلب'); return }
    if (!form.description) { alert('يرجى إدخال تفاصيل الطلب'); return }
    if (form.request_type === 'attendance_correction' && !form.start_date) { alert('يرجى تحديد تاريخ الحضور المراد تصحيحه'); return }
    setSaving(true)

    // إضافة معلومات تصحيح الحضور للوصف
    const correctionInfo = form.request_type === 'attendance_correction'
      ? `\n\nتاريخ الحضور: ${form.start_date}\nوقت الدخول الصح: ${form.correct_checkin || '—'}\nوقت الخروج الصح: ${form.correct_checkout || '—'}`
      : ''

    const { error } = await supabase.from('employee_requests').insert([{
      employee_id: form.employee_id,
      request_type: form.request_type,
      title: form.title || reqType.label,
      description: form.description + correctionInfo,
      amount: form.amount ? parseFloat(form.amount) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      days_count: daysCount || null,
      status: 'pending',
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 620, padding: 32, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{isAr ? '📋 طلب جديد' : '📋 New Request'}</h2>
            <p style={{ fontSize: 12, color: S.muted }}>{isAr ? 'تقديم طلب جديد للإدارة' : 'Submit a new request to management'}</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* نوع الطلب */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 10 }}>نوع الطلب *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {Object.entries(REQUEST_TYPES).map(([key, cfg]) => (
              <button key={key} onClick={() => setForm(p => ({ ...p, request_type: key }))}
                style={{ padding: '10px 8px', borderRadius: 10, border: `1px solid ${form.request_type === key ? cfg.color : S.border}`, background: form.request_type === key ? cfg.bg : 'transparent', color: form.request_type === key ? cfg.color : S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: form.request_type === key ? 700 : 400, textAlign: 'center', transition: 'all .2s' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{cfg.icon}</div>
                {isAr ? cfg.label : cfg.label_en}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* الموظف */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الموظف *</label>
{currentEmployeeId ? (
  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FAFAF8' }}>
    👤 {employees.find(e => e.id === currentEmployeeId)?.name || 'أنت'} — {employees.find(e => e.id === currentEmployeeId)?.employee_number || ''}
  </div>
) : (
  <select style={{ ...inp }} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
    <option value="">اختر الموظف</option>
    {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.department || e.role}</option>)}
  </select>
)}
          </div>

          {/* العنوان */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>عنوان الطلب</label>
            <input style={inp} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={reqType.label} />
          </div>

          {/* التفاصيل */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>تفاصيل الطلب *</label>
            <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' } as React.CSSProperties}
              value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="اشرح طلبك بالتفصيل..." />
          </div>

          {/* المبلغ - للسلفة والمعدات */}
          {reqType.hasAmount && (
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المبلغ المطلوب (MYR)</label>
              <input style={inp} type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </div>
          )}

          {/* التواريخ - للإجازات */}
          {reqType.hasDates && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>
                  {form.request_type === 'attendance_correction' ? 'تاريخ الحضور *' : 'من تاريخ'}
                </label>
                <input style={inp} type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              {form.request_type !== 'attendance_correction' && (
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>إلى تاريخ</label>
                  <input style={inp} type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              )}
              {daysCount > 0 && form.request_type !== 'attendance_correction' && (
                <div style={{ gridColumn: '1/-1', background: S.blueB, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: S.muted }}>عدد الأيام</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: S.blue }}>{daysCount} يوم</span>
                </div>
              )}
            </div>
          )}

          {/* حقول تصحيح الحضور */}
          {form.request_type === 'attendance_correction' && (
            <div style={{ background: S.tealB, border: `1px solid ${S.teal}30`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: S.teal, fontWeight: 700, marginBottom: 12 }}>🕐 أوقات الحضور الصحيحة</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وقت الدخول الصح</label>
                  <input style={{ ...inp, direction: 'ltr' }} type="time" value={form.correct_checkin}
                    onChange={e => setForm(p => ({ ...p, correct_checkin: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وقت الخروج الصح</label>
                  <input style={{ ...inp, direction: 'ltr' }} type="time" value={form.correct_checkout}
                    onChange={e => setForm(p => ({ ...p, correct_checkout: e.target.value }))} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: S.muted, marginTop: 8 }}>
                Leave empty if you only want to correct one time
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? (isAr ? '⏳ جاري الإرسال...' : '⏳ Submitting...') : (isAr ? '📤 إرسال الطلب' : '📤 Submit Request')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Request Detail Modal ══
function RequestDetailModal({ request, currentUser, onClose, onUpdate, onDelete }: {
  request: EmployeeRequest; currentUser?: { name?: string; name_en?: string }; onClose: () => void; onUpdate: () => void; onDelete: () => void
}) {
  const supabase = createClient()
  const { isAr } = useLang()
  const [updating, setUpdating] = useState(false)
  const approvedBy = currentUser?.name ? `${currentUser.name}${currentUser.name_en ? ' (' + currentUser.name_en + ')' : ''}` : ''
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  async function deleteRequest() {
    if (!confirm('Are you sure you want to delete this request? This cannot be undone.')) return
    await supabase.from('employee_requests').delete().eq('id', request.id)
    onDelete()
  }

  const reqType = REQUEST_TYPES[request.request_type] || REQUEST_TYPES.other
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending

  async function updateStatus(newStatus: string) {
    if (newStatus === 'approved' && !approvedBy) { alert('يرجى إدخال اسم المعتمد'); return }
    if (newStatus === 'rejected' && !rejectionReason) { alert('يرجى إدخال سبب الرفض'); return }
    setUpdating(true)
    await supabase.from('employee_requests').update({
      status: newStatus,
      approved_by: approvedBy || null,
      approved_at: ['approved', 'completed'].includes(newStatus) ? new Date().toISOString() : null,
      rejection_reason: newStatus === 'rejected' ? rejectionReason : null,
    }).eq('id', request.id)

    // ✅ تطبيق تصحيح الحضور تلقائياً عند الموافقة
    if (newStatus === 'approved' && request.request_type === 'attendance_correction' && request.start_date) {
      const desc = request.description || ''
      const checkinMatch  = desc.match(/وقت الدخول الصح:\s*(\d{2}:\d{2})/)
      const checkoutMatch = desc.match(/وقت الخروج الصح:\s*(\d{2}:\d{2})/)
      const updateData: any = {}
      if (checkinMatch?.[1])  updateData.check_in_time  = `${request.start_date}T${checkinMatch[1]}:00`
      if (checkoutMatch?.[1]) updateData.check_out_time = `${request.start_date}T${checkoutMatch[1]}:00`
      updateData.is_manual = true
      updateData.notes = `تم تصحيحه بموافقة ${approvedBy}`
      if (Object.keys(updateData).length > 2) {
        await supabase.from('attendance')
          .update(updateData)
          .eq('employee_id', request.employee_id)
          .eq('date', request.start_date)
      }
    }

    setUpdating(false)
    onUpdate()
  }
function printRequest() {
  const win = window.open('', '_blank')
  if (!win) return
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Request #${request.request_number}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; font-size: 13px; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 3px solid #C9A84C; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 22px; font-weight: 900; color: #1a1a1a; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #C9A84C; font-weight: 700; }
  .req-number { font-size: 12px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  td { padding: 10px 14px; border-bottom: 1px solid #e5e5e5; font-size: 13px; vertical-align: top; }
  td:first-child { font-weight: 700; color: #444; width: 200px; background: #fafafa; }
  .section-title { background: #f0f0f0; font-weight: 700; color: #333; padding: 8px 14px; margin-top: 20px; margin-bottom: 0; border-right: 4px solid #C9A84C; }
  .description { white-space: pre-line; line-height: 1.8; }
  .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #e5e5e5; padding-top: 12px; }
  @media print { @page { margin: 15mm; } }
</style>
</head><body>
<div class="header">
  <div class="logo">Orchid Group</div>
  <div class="subtitle">${request.title || 'Employee Request'}</div>
  <div class="req-number">Request #${request.request_number} · ${new Date(request.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</div>
<p class="section-title">Employee Information</p>
<table>
  <tr><td>Employee Name</td><td>${request.employees?.name || '—'}${request.employees?.name_en ? ' (' + request.employees.name_en + ')' : ''}</td></tr>
  <tr><td>Employee ID</td><td>${request.employees?.employee_number || '—'}</td></tr>
  <tr><td>Branch</td><td>${request.employees?.branches?.name || '—'}</td></tr>
  <tr><td>Department</td><td>${request.employees?.department || '—'}</td></tr>
  <tr><td>Status</td><td>${request.status.toUpperCase()}</td></tr>
  <tr><td>Date Submitted</td><td>${new Date(request.created_at).toLocaleDateString('en-GB')}</td></tr>
  ${request.amount ? '<tr><td>Amount Requested</td><td>MYR ' + request.amount.toFixed(2) + '</td></tr>' : ''}
  ${request.start_date ? '<tr><td>From Date</td><td>' + request.start_date + '</td></tr>' : ''}
  ${request.end_date ? '<tr><td>To Date</td><td>' + request.end_date + '</td></tr>' : ''}
  ${request.days_count ? '<tr><td>Number of Days</td><td>' + request.days_count + '</td></tr>' : ''}
</table>
<p class="section-title">Request Details</p>
<table><tr><td colspan="2"><div class="description">${request.description}</div></td></tr></table>
${request.approved_by ? '<p class="section-title">Approval</p><table><tr><td>Approved By</td><td>' + request.approved_by + '</td></tr></table>' : ''}
${request.rejection_reason ? '<p class="section-title">Rejection Reason</p><table><tr><td colspan="2">' + request.rejection_reason + '</td></tr></table>' : ''}
<div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
  <div style="border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:12px;color:#666;">Employee Signature</div>
  <div style="border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:12px;color:#666;">Manager Signature</div>
</div>
<div class="footer">Orchid House Restaurant Management System</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`
  win.document.write(html)
  win.document.close()
}
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, padding: 28, margin: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>{reqType.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: S.white }}>طلب #{request.request_number}</div>
                <div style={{ fontSize: 13, color: reqType.color, fontWeight: 600 }}>{reqType.label}</div>
              </div>
              <span style={{ background: status.bg, color: status.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                {status.icon} {status.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: S.muted }}>
              {new Date(request.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'الموظف', value: `${request.employees?.name || '—'}${request.employees?.name_en ? ' (' + request.employees.name_en + ')' : ''}`, icon: '👤' },
            { label: 'رقم الموظف', value: request.employees?.employee_number || '—', icon: '🆔' },
            { label: 'الفرع', value: request.employees?.branches?.name || '—', icon: '🏪' },
            { label: 'القسم', value: request.employees?.department || '—', icon: '🏷️' },
            { label: 'عنوان الطلب', value: request.title || '—', icon: '📋' },
            request.amount ? { label: 'المبلغ المطلوب', value: `MYR ${request.amount.toFixed(2)}`, icon: '💰' } : null,
            request.start_date ? { label: 'من تاريخ', value: request.start_date, icon: '📅' } : null,
            request.end_date ? { label: 'إلى تاريخ', value: request.end_date, icon: '📅' } : null,
            request.days_count ? { label: 'عدد الأيام', value: `${request.days_count} يوم`, icon: '⏳' } : null,
            request.approved_by ? { label: 'تمت الموافقة بواسطة', value: request.approved_by, icon: '✅' } : null,
          ].filter(Boolean).map((row: any, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>{row.icon} {row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* تصحيح الحضور — عرض التفاصيل */}
        {request.request_type === 'attendance_correction' && (
          <div style={{ background: S.tealB, border: `1px solid ${S.teal}30`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.teal, fontWeight: 700, marginBottom: 8 }}>🕐 تفاصيل تصحيح الحضور</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'تاريخ الحضور', value: request.start_date || '—' },
                { label: 'وقت الدخول الصح', value: request.description?.match(/وقت الدخول الصح:\s*([^\n]+)/)?.[1] || '—' },
                { label: 'وقت الخروج الصح', value: request.description?.match(/وقت الخروج الصح:\s*([^\n]+)/)?.[1] || '—' },
              ].map((r, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: S.muted, marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{r.value}</div>
                </div>
              ))}
            </div>
            {request.status === 'approved' && (
              <div style={{ marginTop: 8, fontSize: 11, color: S.green }}>✅ تم تطبيق التصحيح على سجل الحضور تلقائياً</div>
            )}
          </div>
        )}

        {/* Description */}
        <div style={{ background: S.card, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>📝 تفاصيل الطلب</div>
          <div style={{ fontSize: 13, color: S.white, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{request.description}</div>
        </div>

        {/* Rejection reason */}
        {request.rejection_reason && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: S.red, marginBottom: 6, fontWeight: 700 }}>❌ سبب الرفض</div>
            <div style={{ fontSize: 13, color: S.white }}>{request.rejection_reason}</div>
          </div>
        )}
        {/* Actions */}
        {request.status === 'pending' && (
          <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            {!showReject ? (
              <>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>اسم المعتمد</div>
                <input style={{ ...inp, marginBottom: 12, opacity: 0.8, cursor: 'not-allowed' }} value={approvedBy} readOnly placeholder="..." />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateStatus('approved')} disabled={updating}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    ✅ موافقة
                  </button>
                  <button onClick={() => updateStatus('completed')} disabled={updating}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    🏁 اكتمل
                  </button>
                  <button onClick={() => setShowReject(true)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    ❌ رفض
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: S.red, marginBottom: 6, fontWeight: 700 }}>سبب الرفض *</div>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', marginBottom: 10 } as React.CSSProperties}
                  value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="اشرح سبب الرفض..." />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowReject(false)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                  <button onClick={() => updateStatus('rejected')} disabled={updating}
                    style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    ❌ تأكيد الرفض
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {request.status === 'approved' && (
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => updateStatus('completed')} disabled={updating}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              🏁 تأكيد الاكتمال
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={deleteRequest}
            style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            🗑️ حذف الطلب
          </button>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function EmployeeRequestsPage() {
  const supabase = createClient()
  const { employee: currentUser, permissions } = useAuth()
  const { isAr } = useLang()
  const isAdmin = permissions?.all === true
  const isBranchManager = currentUser?.role === 'branch_manager'
  const isDeptManager = ['kitchen_manager','hall_manager','bar_manager'].includes(currentUser?.role || '')
  const isManager = isAdmin
  const isEmployee = !isAdmin

  const [requests, setRequests] = useState<EmployeeRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showNewType, setShowNewType] = useState('leave_sick')
  const [showSalaryIncrease, setShowSalaryIncrease] = useState(false)
  const [showSalaryAdvance, setShowSalaryAdvance] = useState(false)
  const [selected, setSelected] = useState<EmployeeRequest | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterEmp, setFilterEmp] = useState('all')
  const [filterBranch, setFilterBranch] = useState('all')
  const [branches, setBranches] = useState<{id:string;name:string}[]>([])
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    let reqQuery = supabase.from('employee_requests')
      .select('*, employees(name, name_en, role, department, employee_number, branch_id, branches(name))')
      .order('created_at', { ascending: false })

    const myId = currentUser?.id || ''

    if (isAdmin) {
      // admin يشوف كل شيء
    } else {
      // كل الباقيين يشوفوا طلباتهم فقط
      reqQuery = reqQuery.eq('employee_id', myId)
    }

    const [req, emp, br] = await Promise.all([
      reqQuery,
      supabase.from('employees').select('id,name,name_en,employee_number,role,department,salary,join_date,branch_id').eq('is_active', true).order('name'),
      supabase.from('branches').select('id,name').order('name'),
    ])
    setRequests(req.data || [])
    setEmployees(emp.data || [])
    setBranches(br.data || [])
    setLoading(false)
  }, [isEmployee, currentUser?.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Stats — تُحسب بناءً على الفرع المختار فقط
  const branchScopedRequests = filterBranch === 'all' ? requests : requests.filter(r => r.employees?.branch_id === filterBranch)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthReqs = branchScopedRequests.filter(r => r.created_at?.startsWith(thisMonth))
  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = branchScopedRequests.filter(r => r.status === s).length
    return acc
  }, {} as Record<string, number>)

  // Filter
  const canSeeSalaryRequests = isAdmin || isBranchManager
  const filtered = branchScopedRequests.filter(r => {
    if (!canSeeSalaryRequests && (r.request_type === 'salary_increase' || r.request_type === 'salary_advance')) return false
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    const matchType = filterType === 'all' || r.request_type === filterType
    const matchEmp = filterEmp === 'all' || r.employee_id === filterEmp
    const matchSearch = !search || r.employees?.name?.includes(search) || r.employees?.name_en?.toLowerCase().includes(search.toLowerCase()) || r.employees?.employee_number?.includes(search) || String(r.request_number).includes(search)
    return matchStatus && matchType && matchEmp && matchSearch
  })

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .req-row:hover td { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>
            {isEmployee ? (isAr ? '📋 طلباتي' : '📋 My Requests') : (isAr ? '📋 طلبات الموظفين' : '📋 Employee Requests')}
          </h1>
          <p style={{ fontSize: 13, color: S.muted }}>
            {isEmployee ? (isAr ? 'طلباتك الشخصية — إجازات، سلف، ومقترحات' : 'Your personal requests — leaves, advances & suggestions') : (isAr ? 'إدارة طلبات الإجازات والسلف والمقترحات' : 'Manage employee requests — leaves, advances & suggestions')}
          </p>
        </div>
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
  <button onClick={() => setShowNew(true)} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{isAr ? '➕ طلب جديد' : '➕ New Request'}</button>
  <button onClick={() => { setShowNewType('attendance_correction'); setShowNew(true); }} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{isAr ? '🕐 تصحيح الحضور' : '🕐 Attendance Correction'}</button>
  <button onClick={() => setShowSalaryIncrease(true)} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{isAr ? '📈 زيادة راتب' : '📈 Salary Increase'}</button>
  <button onClick={() => setShowSalaryAdvance(true)} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{isAr ? '💸 سلفة راتب' : '💸 Salary Advance'}</button>
</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📊</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 2 }}>{requests.length}</div>
          <div style={{ fontSize: 12, color: S.muted }}>{isAr ? 'إجمالي الطلبات' : 'Total Requests'}</div>
        </div>
        <div style={{ background: S.gold3, borderRadius: 14, border: `1px solid rgba(201,168,76,0.2)`, padding: '16px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📅</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.gold, marginBottom: 2 }}>{monthReqs.length}</div>
          <div style={{ fontSize: 12, color: S.muted }}>{isAr ? 'هذا الشهر' : 'This Month'}</div>
        </div>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            style={{ background: filterStatus === key ? cfg.bg : S.card2, borderRadius: 14, border: `1px solid ${filterStatus === key ? cfg.color + '50' : S.border}`, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{cfg.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, marginBottom: 2 }}>{statusCounts[key] || 0}</div>
            <div style={{ fontSize: 12, color: S.muted }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFilterType('all')} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterType === 'all' ? S.gold : S.border}`, background: filterType === 'all' ? S.gold3 : 'transparent', color: filterType === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
          الكل ({branchScopedRequests.filter(r => canSeeSalaryRequests || (r.request_type !== 'salary_increase' && r.request_type !== 'salary_advance')).length})
        </button>
        {Object.entries(REQUEST_TYPES).filter(([key]) => canSeeSalaryRequests || (key !== 'salary_increase' && key !== 'salary_advance')).map(([key, cfg]) => {
          const count = branchScopedRequests.filter(r => r.request_type === key).length
          if (count === 0) return null
          return (
            <button key={key} onClick={() => setFilterType(filterType === key ? 'all' : key)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterType === key ? cfg.color : S.border}`, background: filterType === key ? cfg.bg : 'transparent', color: filterType === key ? cfg.color : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
              {cfg.icon} {isAr ? cfg.label : cfg.label_en} ({count})
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={isAr ? "🔍 بحث بالاسم أو رقم الطلب..." : "🔍 Search by name or request number..."} />
        {!isEmployee && (
          <select style={{ ...inp, width: 'auto', minWidth: 150 }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
            <option value="all">🏪 كل الفروع</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {!isEmployee && (
          <select style={{ ...inp, width: 'auto', minWidth: 160 }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
            <option value="all">كل الموظفين</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        {(search || filterStatus !== 'all' || filterType !== 'all' || filterEmp !== 'all' || filterBranch !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterType('all'); setFilterEmp('all'); setFilterBranch('all') }}
            style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
            ✕ مسح
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: S.white }}>{isAr ? 'سجل الطلبات' : 'Requests Log'}</span>
            <span style={{ fontSize: 12, color: S.muted }}>{filtered.length} طلب</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {[isAr ? '#' : '#', isAr ? 'نوع الطلب' : 'Type', isAr ? 'الموظف' : 'Employee', isAr ? 'التفاصيل' : 'Details', isAr ? 'المبلغ/الأيام' : 'Amount/Days', isAr ? 'الحالة' : 'Status', isAr ? 'التاريخ' : 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 60, color: S.muted }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد طلبات</div>
                  </td></tr>
                ) : filtered.map(req => {
                  const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
                  const rt = REQUEST_TYPES[req.request_type] || REQUEST_TYPES.other
                  return (
                    <tr key={req.id} className="req-row" onClick={() => setSelected(req)} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }}>
                      <td style={{ padding: '14px 16px', color: S.gold, fontWeight: 800 }}>#{req.request_number}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: rt.bg, color: rt.color, borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                          {rt.icon} {isAr ? rt.label : rt.label_en}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.blueB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: S.blue, fontWeight: 700, flexShrink: 0 }}>
                            {req.employees?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>
                              {req.employees?.name || '—'}{req.employees?.name_en ? ` (${req.employees.name_en})` : ''}
                            </div>
                            <div style={{ fontSize: 11, color: S.muted }}>{req.employees?.department || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: S.muted, maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.title || req.description?.slice(0, 50)}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {req.amount ? <span style={{ color: S.gold, fontWeight: 700, fontSize: 13 }}>MYR {req.amount.toFixed(2)}</span>
                          : req.days_count ? <span style={{ color: S.blue, fontWeight: 700, fontSize: 13 }}>{req.days_count} يوم</span>
                          : <span style={{ color: S.muted }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: S.muted }}>
                        {new Date(req.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '14px 16px', color: S.muted, fontSize: 18 }}>←</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

     {showNew && <NewRequestModal employees={employees} initialType={showNewType} onClose={() => { setShowNew(false); setShowNewType('leave_sick') }} onSaved={() => { setShowNew(false); setShowNewType('leave_sick'); fetchAll() }} currentEmployeeId={currentUser?.id} canRequestSalary={isAdmin || isBranchManager} />}
      {showSalaryIncrease && employees.find(e => e.id === currentUser?.id) && (
  <SalaryIncreaseModal employee={employees.find(e => e.id === currentUser?.id)!} onClose={() => setShowSalaryIncrease(false)} onSaved={() => { setShowSalaryIncrease(false); fetchAll() }} />
)}
{showSalaryAdvance && employees.find(e => e.id === currentUser?.id) && (
  <SalaryAdvanceModal employee={employees.find(e => e.id === currentUser?.id)!} onClose={() => setShowSalaryAdvance(false)} onSaved={() => { setShowSalaryAdvance(false); fetchAll() }} />
)}
      {selected && <RequestDetailModal request={selected} currentUser={currentUser || undefined} onClose={() => setSelected(null)} onUpdate={() => { setSelected(null); fetchAll() }} onDelete={() => { setSelected(null); fetchAll() }} />}
    </div>
  )
}
