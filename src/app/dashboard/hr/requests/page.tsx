'use client'


import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../../components/AuthProvider'
import { useLang } from '../../../components/LanguageContext'
import { createBrowserClient } from '@supabase/ssr'
// ✅ نفس دوال حساب التأخير/الخروج المبكر المستخدمة في صفحة الحضور — عشان اعتماد "تصحيح الحضور"
// يثبّت في جدول الحضور نفس القيم اللي كانت هتطلع لو الموظف بصم بالأوقات الصحيحة من الأساس
import { computeLateInfo, computeEarlyInfo } from '../../../../lib/attendanceCalc'

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
  // ✅ يخلي متصفح Chrome/Edge يرسم عناصر التقويم الأصلية (النص والأيقونة) بألوان مناسبة للخلفية الداكنة —
  // بدون هذا، بعض المتصفحات كانت ترسم نص حقول type="date"/"month" بلون أسود على خلفية داكنة فيصبح غير مقروء
  colorScheme: 'dark',
}

const REQUEST_TYPES: Record<string, { label: string; label_en: string; icon: string; color: string; bg: string; hasAmount?: boolean; hasDates?: boolean }> = {
  leave_sick:    { label: 'إجازة مرضية', label_en: 'Sick Leave',     icon: '🏥', color: S.red,    bg: S.redB,    hasDates: true },
  leave_emergency:{ label: 'إجازة طارئة', label_en: 'Emergency Leave',    icon: '🚨', color: S.amber,  bg: S.amberB,  hasDates: true },
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

// ✅ بعض الموظفين مسجل قسمهم بالإنجليزي (Hall/Kitchen/Bar) بدل العربي (الصالة/المطبخ/البار)
// هذه الدالة توحّد القيمتين كمتساويتين عند المقارنة
function normalizeDept(dept: string | null | undefined): string {
  const map: Record<string, string> = {
    'hall': 'الصالة', 'kitchen': 'المطبخ', 'bar': 'البار',
    'desserts': 'الحلويات', 'cleaning': 'النظافة', 'admin': 'الإدارة',
  }
  const key = (dept || '').trim().toLowerCase()
  return map[key] || (dept || '').trim()
}
interface EmployeeRequest {
  id: string; created_at: string; request_number: number
  employee_id: string; request_type: string; status: string
  title: string; description: string; amount: number
  start_date: string; end_date: string; days_count: number
  approved_by: string; approved_at: string; rejection_reason: string
  // ✅ جديد: رابط التقرير الطبي المرفق (إجباري للإجازة المرضية فقط)
  attachment_url?: string | null
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
Repayment: Full amount deducted from next month's salary

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
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Amount Requested (MYR) *</label>
            <input style={inp2} type="number" value={form.amount_requested} onChange={e => setForm(p => ({ ...p, amount_requested: e.target.value }))} placeholder="0.00" />
          </div>

          <div style={{ background: S.gold3, border: `1px solid rgba(201,168,76,0.3)`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: S.gold }}>
            ℹ️ سيتم خصم المبلغ بالكامل من راتب الشهر القادم
          </div>

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
function NewRequestModal({ employees, onClose, onSaved, currentEmployeeId, initialType, canSeeSalaryIncrease, canSeeSalaryAdvance }: {
  employees: Employee[]; onClose: () => void; onSaved: () => void; currentEmployeeId?: string; initialType?: string; canSeeSalaryIncrease?: boolean; canSeeSalaryAdvance?: boolean
}) {
  const supabase = createClient()
  const { isAr } = useLang()
  const [saving, setSaving] = useState(false)
  // ✅ جديد: التقرير الطبي المرفق - إجباري للإجازة المرضية فقط
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [form, setForm] = useState({
    employee_id: currentEmployeeId || '', request_type: initialType || 'leave_sick',
    title: '', description: '', amount: '',
    // ✅ لو المودال اتفتح مباشرة بنوع "تصحيح حضور"، لازم تاريخ اليوم يتظبط من البداية بدون انتظار اختيار يدوي
    start_date: initialType === 'attendance_correction' ? new Date().toISOString().slice(0, 10) : '',
    end_date: '',
    correct_checkin: '', correct_checkout: '',
  })

  const reqType = REQUEST_TYPES[form.request_type]
  // ✅ تاريخ اليوم بصيغة YYYY-MM-DD — نستخدمه كحد أدنى/أقصى في خانات التاريخ، وفي التحقق وقت الحفظ
  const todayStr = new Date().toISOString().slice(0, 10)
  // ✅ لتصحيح الحضور: أقصى مدى مسموح للرجوع هو الأمس بس
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const daysCount = form.start_date && form.end_date
    ? Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  async function save() {
    if (!form.employee_id || !form.request_type) { alert('يرجى اختيار الموظف ونوع الطلب'); return }
    if (!form.description) { alert('يرجى إدخال تفاصيل الطلب'); return }
    if (form.request_type === 'attendance_correction' && !form.start_date) { alert('يرجى تحديد تاريخ الحضور المراد تصحيحه'); return }
    // ✅ جديد: إرفاق التقرير الطبي إجباري للإجازة المرضية فقط
    if (form.request_type === 'leave_sick' && !attachment) { alert('يرجى إرفاق تقرير طبي من الطبيب أو المستشفى'); return }
    // ✅ تحقق فعلي وقت الحفظ (مش بس قيد الواجهة min/max اللي ممكن يتلف بالتعديل المباشر على الصفحة) —
    // تصحيح الحضور: لازم يكون اليوم أو الأمس بس. باقي الطلبات ذات التواريخ (الإجازات): لازم اليوم أو بعده
    if (reqType?.hasDates && form.start_date) {
      if (form.request_type === 'attendance_correction' && form.start_date !== todayStr && form.start_date !== yesterdayStr) {
        alert('تصحيح الحضور متاح لليوم الحالي أو الأمس فقط')
        return
      }
      if (form.request_type !== 'attendance_correction' && form.start_date < todayStr) {
        alert('لا يمكن تقديم طلب بتاريخ سابق — التاريخ يجب أن يكون اليوم أو بعده')
        return
      }
    }
    setSaving(true)

    // ✅ جديد: رفع التقرير الطبي (لو مُرفق) قبل إدراج الطلب
    let attachmentUrl = ''
    if (attachment) {
      const fileName = `employee-requests/${Date.now()}-${attachment.name}`
      const { data: upData } = await supabase.storage.from('employees').upload(fileName, attachment, { upsert: true })
      if (upData) { const { data: urlData } = supabase.storage.from('employees').getPublicUrl(upData.path); attachmentUrl = urlData.publicUrl }
      if (!attachmentUrl) { setSaving(false); alert('تعذّر رفع الملف، يرجى المحاولة مرة أخرى'); return }
    }

    // إضافة معلومات تصحيح الحضور للوصف
    const correctionInfo = form.request_type === 'attendance_correction'
      ? `\n\nتاريخ الحضور: ${form.start_date}\nوقت الدخول الصحيح: ${form.correct_checkin || '—'}\nوقت الخروج الصحيح: ${form.correct_checkout || '—'}`
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
      // ✅ جديد: حفظ رابط التقرير الطبي (فارغ لو الطلب مش إجازة مرضية)
      attachment_url: attachmentUrl || null,
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
            {Object.entries(REQUEST_TYPES)
              .filter(([key]) => key !== 'salary_increase' && key !== 'salary_advance')
              .map(([key, cfg]) => (
              <button key={key} onClick={() => setForm(p => ({
                ...p,
                request_type: key,
                // ✅ تصحيح الحضور دائماً بتاريخ اليوم تلقائياً (بلا تقويم يدوي) — نضبطها هنا فور اختيار النوع
                start_date: key === 'attendance_correction' ? todayStr : p.start_date,
              }))}
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
                {form.request_type === 'attendance_correction' ? (
                  // ✅ تصحيح الحضور: يسمح باختيار اليوم الحالي أو الأمس فقط (min/max بنفس القيمة تقريباً) —
                  // يمنع المتصفح تلقائياً من فتح أي تاريخ أبعد من كده في التقويم
                  <input
                    style={inp} type="date" value={form.start_date}
                    min={yesterdayStr} max={todayStr}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  />
                ) : (
                  <input
                    style={inp} type="date" value={form.start_date}
                    min={todayStr}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  />
                )}
              </div>
              {form.request_type !== 'attendance_correction' && (
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>إلى تاريخ</label>
                  <input
                    style={inp} type="date" value={form.end_date}
                    min={form.start_date || todayStr}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  />
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
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وقت الدخول الصحيح</label>
                  <input style={{ ...inp, direction: 'ltr' }} type="time" value={form.correct_checkin}
                    onChange={e => setForm(p => ({ ...p, correct_checkin: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وقت الخروج الصحيح</label>
                  <input style={{ ...inp, direction: 'ltr' }} type="time" value={form.correct_checkout}
                    onChange={e => setForm(p => ({ ...p, correct_checkout: e.target.value }))} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: S.muted, marginTop: 8 }}>
                Leave empty if you only want to correct one time
              </div>
            </div>
          )}

          {/* ✅ جديد: التقرير الطبي - إجباري للإجازة المرضية فقط */}
          {form.request_type === 'leave_sick' && (
            <div style={{ background: S.redB, border: `1px solid ${S.red}30`, borderRadius: 12, padding: 14 }}>
              <label style={{ fontSize: 12, color: S.red, fontWeight: 700, display: 'block', marginBottom: 8 }}>🏥 التقرير الطبي (من الطبيب أو المستشفى) *</label>
              <input type="file" accept="image/*,application/pdf" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                setAttachment(file)
                if (file.type.startsWith('image/')) {
                  const reader = new FileReader()
                  reader.onload = () => setAttachmentPreview(reader.result as string)
                  reader.readAsDataURL(file)
                } else {
                  setAttachmentPreview('')
                }
              }} style={{ fontSize: 12, color: S.white }} />
              {attachment && !attachmentPreview && <div style={{ fontSize: 11, color: S.muted, marginTop: 6 }}>📎 {attachment.name}</div>}
              {attachmentPreview && <img src={attachmentPreview} alt="التقرير الطبي" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
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
function RequestDetailModal({ request, currentUser, isAdmin, isDeptManager, isSupervisor, isBranchManager, onClose, onUpdate, onDelete }: {
  request: EmployeeRequest; currentUser?: { id?: string; name?: string; name_en?: string }; isAdmin?: boolean; isDeptManager?: boolean; isSupervisor?: boolean; isBranchManager?: boolean; onClose: () => void; onUpdate: () => void; onDelete: () => void
}) {
  const supabase = createClient()
  const { isAr } = useLang()
  const [updating, setUpdating] = useState(false)
  const approvedBy = currentUser?.name ? `${currentUser.name}${currentUser.name_en ? ' (' + currentUser.name_en + ')' : ''}` : ''
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  // ✅ الموظف لا يقدر يعتمد/يرفض طلبه الخاص (لأي نوع طلب)
  const isOwnRequest = currentUser?.id === request.employee_id
  // ✅ سلفة الراتب: التأكيد والاعتماد لـ admin فقط - مثل ما هي بالظبط، من غير أي تغيير
  const isSalaryAdvance = request.request_type === 'salary_advance'
  // ✅ مدير الفرع أصبح مخوَّلاً باعتماد طلبات سلفة الراتب لموظفي فرعه (لم يكن مضمَّناً هنا أبداً من قبل رغم
  // أن الاستعلام الأساسي في fetchAll() كان أصلاً يجلب له طلبات فرعه بس بشكل صحيح)
  const canTakeAction = !isOwnRequest && (
    isSalaryAdvance ? (isAdmin || isBranchManager) : (isAdmin || isDeptManager)
  )

  // ✅ دالة مشتركة لعكس أثر سلفة "completed" على الرواتب — تُستخدم عند تغيير الحالة بعيداً عن "completed"،
  // وكذلك عند حذف الطلب نهائياً (الحالتان لهما نفس الأثر: المبلغ يجب ألا يبقى "عالقاً" في الرواتب)
  async function reverseAdvanceFromPayroll() {
    if (request.request_type !== 'salary_advance' || request.status !== 'completed' || !request.amount) return
    const now = new Date()
    const targetMonth = now.getMonth() + 1
    const targetYear = now.getFullYear()
    const { data: payrollMonth } = await supabase.from('payroll_months')
      .select('id, status').eq('month', targetMonth).eq('year', targetYear).maybeSingle()
    if (!payrollMonth) return
    if (payrollMonth.status === 'finalized') {
      alert('⚠️ تنبيه: شهر الرواتب المرتبط بهذا الطلب مُعتمَد (Finalized) بالفعل — لم يُطرح المبلغ تلقائياً. راجع حقل "سلفة" لهذا الموظف يدوياً.')
      return
    }
    const { data: existingRecord } = await supabase.from('payroll_records')
      .select('id, advance').eq('payroll_month_id', payrollMonth.id).eq('employee_id', request.employee_id).maybeSingle()
    if (existingRecord) {
      await supabase.from('payroll_records').update({
        advance: Math.max(0, (existingRecord.advance || 0) - request.amount),
      }).eq('id', existingRecord.id)
    }
  }

  // ✅ بعد ما اعتماد "تصحيح الحضور" يعدّل صف الحضور — نُحدِّث فورًا ساعات التأخير/الخروج المبكر في كشف
  // راتب نفس الشهر (لو لسه مش معتمد)، بنفس معادلة صفحة الرواتب بالضبط: إجمالي دقائق الشهر ÷ 60 مقرَّبة
  // لخانتين. كده المدير ما يحتاجش يفتح صفحة الرواتب ويعيد التوليد عشان الخصم يتظبط.
  async function syncCorrectionToPayroll(employeeId: string, dateStr: string): Promise<'updated' | 'finalized' | 'skipped'> {
    const [y, m] = dateStr.split('-').map(Number)
    const { data: pm } = await supabase.from('payroll_months')
      .select('id, status').eq('month', m).eq('year', y).maybeSingle()
    if (!pm) return 'skipped'
    if (pm.status === 'finalized') return 'finalized'
    const { data: rec } = await supabase.from('payroll_records')
      .select('id').eq('payroll_month_id', pm.id).eq('employee_id', employeeId).maybeSingle()
    if (!rec) return 'skipped'
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    const { data: att } = await supabase.from('attendance')
      .select('late_minutes, early_minutes').eq('employee_id', employeeId)
      .gte('date', monthStart).lte('date', monthEnd)
    const totalLate = (att || []).reduce((s: number, a: any) => s + (a.late_minutes || 0), 0)
    const totalEarly = (att || []).reduce((s: number, a: any) => s + (a.early_minutes || 0), 0)
    await supabase.from('payroll_records').update({
      late_hours: parseFloat((totalLate / 60).toFixed(2)),
      early_exit_hours: parseFloat((totalEarly / 60).toFixed(2)),
    }).eq('id', rec.id)
    return 'updated'
  }

  async function deleteRequest() {
    if (!confirm('Are you sure you want to delete this request? This cannot be undone.')) return
    // ✅ لو الطلب كان "completed" (أي أن مبلغ السلفة أُضيف بالفعل للرواتب)، لازم نعكس الأثر قبل الحذف النهائي —
    // وإلا يبقى المبلغ عالقاً في الرواتب للأبد رغم اختفاء الطلب نفسه من السجل
    await reverseAdvanceFromPayroll()
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

    // ✅ تطبيق تصحيح الحضور تلقائياً عند الموافقة — يُثبَّت في جدول الحضور، وتُعاد فيه قيم التأخير/الخروج
    // المبكر بحسابها من الأوقات المصحَّحة مقابل الشيفت المجدول (نفس دوال صفحة الحضور)، ثم يتحدَّث كشف الراتب
    if (newStatus === 'approved' && request.request_type === 'attendance_correction' && request.start_date) {
      const desc = request.description || ''
      const checkinMatch  = desc.match(/وقت الدخول الصحيح:\s*(\d{2}:\d{2})/)
      const checkoutMatch = desc.match(/وقت الخروج الصحيح:\s*(\d{2}:\d{2})/)

      if (checkinMatch?.[1] || checkoutMatch?.[1]) {
        // ✅ Fix حرج: كان يستخدم .update() فقط، وهذا يعمل فقط لو يوجد سجل حضور بالفعل. لكن "تصحيح حضور" غالباً
        // يعني أن الموظف نسي التسجيل من الأساس (لا سجل إطلاقاً) — فكان التحديث يفشل بصمت. نجيب السجل الحالي
        // (لو موجود) أول حاجة: نحتاج id لتحديثه، ونحتاج أوقاته لملء الطرف اللي التصحيح ماغطّاهوش.
        const { data: existingAttendance } = await supabase.from('attendance')
          .select('id, check_in_time, check_out_time')
          .eq('employee_id', request.employee_id).eq('date', request.start_date).maybeSingle()

        // ✅ إزاحة توقيت ماليزيا (+08:00) صراحة، وإلا الوقت يُخزَّن كأنه UTC مباشرة (فرق 8 ساعات)
        const correctedCheckIn = checkinMatch?.[1]
          ? `${request.start_date}T${checkinMatch[1]}:00+08:00`
          : null
        let correctedCheckOut: string | null = null
        if (checkoutMatch?.[1]) {
          // ✅ شيفت ليلي: لو الخروج أصغر من الدخول رقميًا، فالخروج في اليوم التالي
          let checkoutDate = request.start_date
          if (checkinMatch?.[1] && checkoutMatch[1] <= checkinMatch[1]) {
            const nextDay = new Date(request.start_date + 'T00:00:00')
            nextDay.setDate(nextDay.getDate() + 1)
            checkoutDate = nextDay.toISOString().split('T')[0]
          }
          correctedCheckOut = `${checkoutDate}T${checkoutMatch[1]}:00+08:00`
        }

        // الأوقات النهائية = المصحَّح إن وُجد، وإلا الموجود مسبقًا في السجل
        const finalCheckIn  = correctedCheckIn  || existingAttendance?.check_in_time  || null
        const finalCheckOut = correctedCheckOut || existingAttendance?.check_out_time || null

        const updateData: any = { is_manual: true, notes: `تم تصحيحه بموافقة ${approvedBy}` }
        if (correctedCheckIn)  updateData.check_in_time  = correctedCheckIn
        if (correctedCheckOut) updateData.check_out_time = correctedCheckOut

        // ✅ إعادة حساب التأخير/الخروج المبكر من الأوقات النهائية مقابل الشيفت المجدول — لو الموظف فعلاً
        // جه متأخر بعد التصحيح، يُحتسب عليه تأخير؛ ولو خرج مبكرًا يُحتسب خروج مبكر (بنفس سماح الـ10 دقائق)
        if (finalCheckIn) {
          const { status, late_minutes } = await computeLateInfo(supabase, request.employee_id, request.start_date, finalCheckIn)
          updateData.status = status
          updateData.late_minutes = late_minutes
        }
        if (finalCheckOut) {
          const { early_minutes } = await computeEarlyInfo(supabase, request.employee_id, request.start_date, finalCheckOut, finalCheckIn)
          updateData.early_minutes = early_minutes
        }

        if (existingAttendance?.id) {
          await supabase.from('attendance').update(updateData).eq('id', existingAttendance.id)
        } else {
          await supabase.from('attendance').insert([{
            employee_id: request.employee_id, date: request.start_date, ...updateData,
          }])
        }

        // ✅ يحدّث ساعات التأخير/الخروج المبكر في كشف راتب نفس الشهر تلقائيًا (لو لسه مش معتمد)
        const syncResult = await syncCorrectionToPayroll(request.employee_id, request.start_date)
        if (syncResult === 'finalized') {
          alert('⚠️ تم تصحيح الحضور وتثبيته، لكن كشف راتب هذا الشهر مُعتمَد (Finalized) — لن تتحدث ساعات التأخير/الخروج المبكر فيه تلقائيًا. يُرجى مراجعتها يدويًا في صفحة الرواتب.')
        }
      }
    }

    // ✅ خصم سلفة الراتب تلقائيًا من راتب شهر الاعتماد نفسه (وليس شهر السداد الفعلي)
    // مثال: السلفة تُعتمد 25 مايو → تُخصم من راتب شهر مايو (الذي يُسلَّم فعليًا في يونيو)
    // ✅ نحمي من الإضافة المزدوجة: لا نضيف المبلغ إلا إذا لم تكن حالة الطلب "completed" من قبل هذا التحديث
    if (newStatus === 'completed' && request.status !== 'completed' && request.request_type === 'salary_advance' && request.amount) {
      const now = new Date()
      const targetMonth = now.getMonth() + 1
      const targetYear = now.getFullYear()

      // 1) إيجاد شهر الرواتب المطابق، أو إنشاؤه لو لم يكن موجودًا بعد
      let { data: payrollMonth } = await supabase.from('payroll_months')
        .select('id').eq('month', targetMonth).eq('year', targetYear).maybeSingle()
      if (!payrollMonth) {
        const { data: newMonth } = await supabase.from('payroll_months')
          .insert([{ month: targetMonth, year: targetYear, status: 'draft' }])
          .select('id').single()
        payrollMonth = newMonth
      }

      if (payrollMonth) {
        // 2) إيجاد سجل راتب الموظف لهذا الشهر، أو إنشاؤه لو لم يكن موجودًا بعد
        const { data: existingRecord } = await supabase.from('payroll_records')
          .select('id, advance').eq('payroll_month_id', payrollMonth.id).eq('employee_id', request.employee_id).maybeSingle()

        if (existingRecord) {
          // ✅ نزيد على القيمة الحالية (لا نستبدلها) لحماية أي سلفة سابقة معتمدة لنفس الشهر
          await supabase.from('payroll_records').update({
            advance: (existingRecord.advance || 0) + request.amount,
          }).eq('id', existingRecord.id)
        } else {
          // جلب الراتب الأساسي والتأمين من بيانات الموظف نفسه لتعبئة السجل الجديد
          const { data: empData } = await supabase.from('employees')
            .select('salary, insurance, work_insurance').eq('id', request.employee_id).maybeSingle()
          await supabase.from('payroll_records').insert([{
            payroll_month_id: payrollMonth.id, employee_id: request.employee_id,
            basic_salary: empData?.salary || 0, insurance: empData?.insurance || 0,
            working_days: 30, days_worked: 30,
            overtime_days: 0, overtime_hours: 0,
            allowance_1: 0, allowance_1_label: 'Allowance 1',
            allowance_2: 0, allowance_2_label: 'Allowance 2',
            allowance_3: 0, allowance_3_label: 'Allowance 3',
            absence_days: 0, late_hours: 0, early_exit_hours: 0,
            tax: 0,
            deduction_1: 0, deduction_1_label: 'Deduction 1',
            deduction_2: 0, deduction_2_label: 'Deduction 2',
            deduction_3: 0, deduction_3_label: 'Deduction 3',
            advance: request.amount, advance_balance: 0, carried_forward: 0,
            amount_due: 0, amount_paid: 0,
            work_insurance: empData?.work_insurance || 0,
          }])
        }
      }
    }

    // ✅ عكس أثر السلفة: لو الطلب كان "completed" من قبل (أي أن مبلغه أُضيف بالفعل للرواتب)
    // وتم الآن تغيير حالته لأي حالة أخرى (رفض، إلغاء، تصحيح خطأ إداري)، لازم نطرح المبلغ من الرواتب
    // مرة أخرى — وإلا يبقى المبلغ "عالقاً" في الرواتب رغم أن الطلب لم يعد معتمداً
    if (newStatus !== 'completed') {
      await reverseAdvanceFromPayroll()
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
  body { font-family: Arial, sans-serif; padding: 18px; font-size: 12.5px; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 3px solid #C9A84C; padding-bottom: 10px; margin-bottom: 16px; }
  .logo { font-size: 20px; font-weight: 900; color: #1a1a1a; margin-bottom: 3px; }
  .subtitle { font-size: 13px; color: #C9A84C; font-weight: 700; }
  .req-number { font-size: 11px; color: #666; margin-top: 3px; }
  .employee-card { background: #FAF7ED; border: 2px solid #C9A84C; border-radius: 8px; padding: 12px 18px; margin-bottom: 14px; }
  .employee-card .name { font-size: 16px; font-weight: 900; color: #1a1a1a; }
  .employee-card .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .employee-card .field-label { font-size: 10px; color: #888; }
  .employee-card .field-value { font-size: 13px; font-weight: 700; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td { padding: 7px 14px; border-bottom: 1px solid #e5e5e5; font-size: 12.5px; vertical-align: top; }
  td:first-child { font-weight: 700; color: #444; width: 200px; background: #fafafa; }
  .section-title { background: #f0f0f0; font-weight: 700; color: #333; padding: 6px 14px; margin-top: 12px; margin-bottom: 0; border-right: 4px solid #C9A84C; page-break-after: avoid; }
  .description { white-space: pre-line; line-height: 1.6; }
  .footer { text-align: center; margin-top: 20px; font-size: 10.5px; color: #999; border-top: 1px solid #e5e5e5; padding-top: 8px; }
  @media print { @page { size: A4; margin: 10mm; } }
</style>
</head><body>
<div class="header">
  <div class="logo">Orchid Group</div>
  <div class="subtitle">${request.title || 'Employee Request'}</div>
  <div class="req-number">Request #${request.request_number} · ${new Date(request.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</div>
<div class="employee-card">
  <div class="name">${request.employees?.name || '—'}${request.employees?.name_en ? ' ' + request.employees.name_en : ''}</div>
  <div class="grid">
    <div><div class="field-label">Employee ID / رقم الموظف</div><div class="field-value">${request.employees?.employee_number || '—'}</div></div>
    <div><div class="field-label">Department / القسم</div><div class="field-value">${request.employees?.department || '—'}</div></div>
    <div><div class="field-label">Branch / الفرع</div><div class="field-value">${request.employees?.branches?.name || '—'}</div></div>
    <div><div class="field-label">Position / الوظيفة</div><div class="field-value">${request.employees?.role || '—'}</div></div>
  </div>
</div>
<p class="section-title">Request Information</p>
<table>
  <tr><td>Status</td><td>${request.status.toUpperCase()}</td></tr>
  <tr><td>Date Submitted</td><td>${new Date(request.created_at).toLocaleDateString('en-GB')}</td></tr>
  ${request.amount ? '<tr><td>Amount</td><td style="font-size:16px;font-weight:900;color:#C9A84C;">MYR ' + request.amount.toFixed(2) + '</td></tr>' : ''}
  ${request.start_date ? '<tr><td>From Date</td><td>' + request.start_date + '</td></tr>' : ''}
  ${request.end_date ? '<tr><td>To Date</td><td>' + request.end_date + '</td></tr>' : ''}
  ${request.days_count ? '<tr><td>Number of Days</td><td>' + request.days_count + '</td></tr>' : ''}
</table>
<p class="section-title">Request Details</p>
<table><tr><td colspan="2"><div class="description">${request.description}</div></td></tr></table>
${request.approved_by ? '<p class="section-title">Approval</p><table><tr><td>Approved By</td><td>' + request.approved_by + '</td></tr></table>' : ''}
${request.rejection_reason ? '<p class="section-title">Rejection Reason</p><table><tr><td colspan="2">' + request.rejection_reason + '</td></tr></table>' : ''}
<div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
  <div style="border-top:1px solid #ccc;padding-top:6px;text-align:center;font-size:11px;color:#666;">Employee Signature</div>
  <div style="border-top:1px solid #ccc;padding-top:6px;text-align:center;font-size:11px;color:#666;">Manager Signature</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={printRequest} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.gold, fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, cursor: 'pointer', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              🖨️ طباعة
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
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
                { label: 'وقت الدخول الصحيح', value: request.description?.match(/وقت الدخول الصحيح:\s*([^\n]+)/)?.[1] || '—' },
                { label: 'وقت الخروج الصحيح', value: request.description?.match(/وقت الخروج الصحيح:\s*([^\n]+)/)?.[1] || '—' },
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

        {/* ✅ جديد: عرض التقرير الطبي المرفق (للإجازة المرضية) */}
        {request.attachment_url && (
          <div style={{ background: S.card, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>🏥 التقرير الطبي المرفق</div>
            <a href={request.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
              {/\.(jpe?g|png|webp|gif)$/i.test(request.attachment_url)
                ? <img src={request.attachment_url} alt="التقرير الطبي" style={{ maxWidth: 220, maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: `1px solid ${S.border}` }} />
                : <span style={{ fontSize: 13, color: S.blue, textDecoration: 'underline' }}>📎 عرض الملف المرفق</span>}
            </a>
          </div>
        )}

        {/* Rejection reason */}
        {request.rejection_reason && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: S.red, marginBottom: 6, fontWeight: 700 }}>❌ سبب الرفض</div>
            <div style={{ fontSize: 13, color: S.white }}>{request.rejection_reason}</div>
          </div>
        )}
        {/* Actions */}
        {request.status === 'pending' && (
          canTakeAction ? (
            <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              {!showReject ? (
                <>
                  <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>اسم المعتمد</div>
                  <input style={{ ...inp, marginBottom: 12, opacity: 0.8, cursor: 'not-allowed' }} value={approvedBy} readOnly placeholder="..." />
                  {isSalaryAdvance ? (
                    // ✅ سلفة الراتب: مرحلة واحدة مدمجة "تأكيد واعتماد التسليم" — تُسجَّل مباشرة كـ completed
                    // لتمثيل لحظة تسليم السلفة فعليًا للموظف، والتي بعدها تُخصم من الراتب
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => updateStatus('completed')} disabled={updating}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        ✅ تأكيد واعتماد التسليم (تُخصم من الراتب)
                      </button>
                      <button onClick={() => setShowReject(true)}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        ❌ رفض
                      </button>
                    </div>
                  ) : (
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
                  )}
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
          ) : (
            // ✅ صاحب الطلب نفسه، أو طلب سلفة راتب لمستخدم غير admin — لا تظهر أزرار الاعتماد على الإطلاق
            <div style={{ background: S.amberB, border: `1px solid ${S.amber}30`, borderRadius: 12, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: S.amber, fontWeight: 700 }}>
                {isOwnRequest ? '⏳ طلبك قيد المراجعة من الإدارة' : (isSalaryAdvance ? '🔒 هذا الطلب يحتاج اعتماد مدير النظام أو مدير الفرع' : '🔒 هذا الطلب يحتاج اعتماد مدير القسم أو مدير النظام')}
              </div>
            </div>
          )
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
  // ✅ جديد: تعريف المشرف - كان مفقود تمامًا، وده سبب عدم رؤيته لطلبات فريقه على الإطلاق من الأساس
  const isSupervisor = ['kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(currentUser?.role || '')
  const isManager = isAdmin
  const isEmployee = !isAdmin && !isBranchManager && !isDeptManager && !isSupervisor
  // ✅ الرؤية وتقديم الطلب: تعتمد على صلاحية ديناميكية من صفحة "إدارة الصلاحيات" + admin دائمًا
  // (الاعتماد الفعلي/الموافقة يبقى مقصورًا على admin فقط بدون استثناء — داخل RequestDetailModal)
  const canSeeSalaryIncrease = isAdmin || permissions?.salary_increase_requests === true
  const canSeeSalaryAdvance  = isAdmin || permissions?.salary_advance_requests === true

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
  // ✅ جديد: اختيار شهر محدد لطباعة تقرير سلف الراتب - فاضي معناه كل الشهور (السلوك القديم)
  const [printAdvancesMonth, setPrintAdvancesMonth] = useState('')
  // ✅ جديد: فرع محدد + شهر محدد لطباعة "استمارات" السلفة الفردية دفعة واحدة (كل موظف في صفحة مستقلة)
  const [bulkAppBranch, setBulkAppBranch] = useState('')
  const [bulkAppMonth, setBulkAppMonth] = useState('')

  // ══ طباعة استمارات طلب السلفة الفردية دفعة واحدة — لكل الموظفين اللي طلبوا سلفة في فرع وشهر محددين ══
  // نفس تصميم استمارة الطلب الفردي (بطاقة الموظف + الحقول + خانات التوقيع)، لكن متكررة لكل موظف على حدة
  // بدل الاستدعاء اليدوي لكل موظف لوحده — أفضل من جدول ملخّص عادي لأنها استمارة كاملة جاهزة للتوقيع فوراً
  function printBulkApplications() {
    if (!bulkAppBranch) { alert('يرجى اختيار الفرع أولاً'); return }
    if (!bulkAppMonth) { alert('يرجى اختيار الشهر أولاً'); return }
    const matching = requests
      .filter(r => r.request_type === 'salary_advance')
      .filter(r => r.employees?.branches?.name === bulkAppBranch)
      .filter(r => r.created_at?.slice(0, 7) === bulkAppMonth)
    if (matching.length === 0) { alert('لا توجد طلبات سلفة راتب لهذا الفرع في هذا الشهر'); return }

    const applicationsHtml = matching.map((request, i) => `
      <div class="app-page" ${i > 0 ? 'style="page-break-before: always;"' : ''}>
        <div class="header">
          <div class="logo">Orchid Group</div>
          <div class="subtitle">${request.title || 'Salary Advance Application'}</div>
          <div class="req-number">Request #${request.request_number} · ${new Date(request.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div class="employee-card">
          <div class="name">${request.employees?.name || '—'}${request.employees?.name_en ? ' ' + request.employees.name_en : ''}</div>
          <div class="grid">
            <div><div class="field-label">Employee ID / رقم الموظف</div><div class="field-value">${request.employees?.employee_number || '—'}</div></div>
            <div><div class="field-label">Department / القسم</div><div class="field-value">${request.employees?.department || '—'}</div></div>
            <div><div class="field-label">Branch / الفرع</div><div class="field-value">${request.employees?.branches?.name || '—'}</div></div>
            <div><div class="field-label">Position / الوظيفة</div><div class="field-value">${request.employees?.role || '—'}</div></div>
          </div>
        </div>
        <p class="section-title">Request Information</p>
        <table>
          <tr><td>Status</td><td>${STATUS_CONFIG[request.status]?.label || request.status}</td></tr>
          <tr><td>Date Submitted</td><td>${new Date(request.created_at).toLocaleDateString('en-GB')}</td></tr>
          ${request.amount ? '<tr><td>Amount</td><td style="font-size:16px;font-weight:900;color:#C9A84C;">MYR ' + request.amount.toFixed(2) + '</td></tr>' : ''}
        </table>
        <p class="section-title">Request Details</p>
        <table><tr><td colspan="2"><div class="description">${request.description || '—'}</div></td></tr></table>
        <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
          <div style="border-top:1px solid #ccc;padding-top:6px;text-align:center;font-size:11px;color:#666;">Employee Signature</div>
          <div style="border-top:1px solid #ccc;padding-top:6px;text-align:center;font-size:11px;color:#666;">Manager Signature</div>
        </div>
      </div>`).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>استمارات سلفة راتب — ${bulkAppBranch} — ${new Date(bulkAppMonth + '-01').toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 18px; font-size: 12.5px; color: #1a1a1a; }
        .header { text-align: center; border-bottom: 3px solid #C9A84C; padding-bottom: 10px; margin-bottom: 16px; }
        .logo { font-size: 20px; font-weight: 900; color: #1a1a1a; margin-bottom: 3px; }
        .subtitle { font-size: 13px; color: #C9A84C; font-weight: 700; }
        .req-number { font-size: 11px; color: #666; margin-top: 3px; }
        .employee-card { background: #FAF7ED; border: 2px solid #C9A84C; border-radius: 8px; padding: 12px 18px; margin-bottom: 14px; }
        .employee-card .name { font-size: 16px; font-weight: 900; color: #1a1a1a; }
        .employee-card .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        .employee-card .field-label { font-size: 10px; color: #888; }
        .employee-card .field-value { font-size: 13px; font-weight: 700; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        td { padding: 7px 14px; border-bottom: 1px solid #e5e5e5; font-size: 12.5px; vertical-align: top; }
        td:first-child { font-weight: 700; color: #444; width: 200px; background: #fafafa; }
        .section-title { background: #f0f0f0; font-weight: 700; color: #333; padding: 6px 14px; margin-top: 12px; margin-bottom: 0; border-right: 4px solid #C9A84C; page-break-after: avoid; }
        .description { white-space: pre-line; line-height: 1.6; }
        @media print { @page { size: A4; margin: 10mm; } }
      </style>
      </head><body>
      ${applicationsHtml}
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`)
    win.document.close()
  }

  // ══ تقرير سلف الراتب الشامل: مجمّع بالشهر ثم الفرع، مع إجماليات وتقسيم صفحات كل 20 صف ══
  function printAllSalaryAdvances() {
    // ✅ Fix: تصفية بالشهر المختار قبل أي تجميع - كان بيطبع كل الشهور مع بعض دايمًا بدون خيار تحديد شهر واحد
    const advances = requests
      .filter(r => r.request_type === 'salary_advance')
      .filter(r => !printAdvancesMonth || r.created_at?.slice(0, 7) === printAdvancesMonth)
    if (advances.length === 0) { alert(printAdvancesMonth ? 'لا توجد طلبات سلفة راتب في هذا الشهر' : 'لا توجد طلبات سلفة راتب لطباعتها'); return }

    // تجميع حسب الشهر (YYYY-MM) أولاً
    const byMonth: Record<string, EmployeeRequest[]> = {}
    advances.forEach(r => {
      const monthKey = r.created_at.slice(0, 7) // "2026-06"
      if (!byMonth[monthKey]) byMonth[monthKey] = []
      byMonth[monthKey].push(r)
    })
    const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a)) // الأحدث أولاً

    const PAGE_SIZE = 20
    let grandTotal = 0
    const monthsHtml = sortedMonths.map((monthKey, monthIndex) => {
      const monthRequests = byMonth[monthKey]
      const monthName = new Date(monthKey + '-01').toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })

      // تجميع حسب الفرع داخل هذا الشهر
      const byBranch: Record<string, EmployeeRequest[]> = {}
      monthRequests.forEach(r => {
        const branchName = r.employees?.branches?.name || 'بدون فرع'
        if (!byBranch[branchName]) byBranch[branchName] = []
        byBranch[branchName].push(r)
      })

      let monthTotal = 0
      const branchesHtml = Object.entries(byBranch).map(([branchName, branchRequests]) => {
        const branchTotal = branchRequests.reduce((s, r) => s + (r.amount || 0), 0)
        monthTotal += branchTotal
        grandTotal += branchTotal

        // تقسيم صفوف هذا الفرع كل 20 صف (page-break بينهم)
        const chunks: EmployeeRequest[][] = []
        for (let i = 0; i < branchRequests.length; i += PAGE_SIZE) chunks.push(branchRequests.slice(i, i + PAGE_SIZE))

        const chunksHtml = chunks.map((chunk, ci) => `
          <table class="advances-table" ${ci > 0 ? 'style="page-break-before: always;"' : ''}>
            <thead><tr><th>#</th><th>رقم الموظف</th><th>الاسم الكامل</th><th>القسم</th><th>المبلغ (MYR)</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>
              ${chunk.map(r => `<tr>
                <td>#${r.request_number}</td>
                <td>${r.employees?.employee_number || '—'}</td>
                <td>${r.employees?.name || '—'}${r.employees?.name_en ? ' ' + r.employees.name_en : ''}</td>
                <td>${r.employees?.department || '—'}</td>
                <td>${(r.amount || 0).toFixed(2)}</td>
                <td>${STATUS_CONFIG[r.status]?.label || r.status}</td>
                <td>${new Date(r.created_at).toLocaleDateString('ar-SA')}</td>
              </tr>`).join('')}
            </tbody>
          </table>`).join('')

        return `
          <div class="branch-section">
            <div class="branch-title">🏪 ${branchName}</div>
            ${chunksHtml}
            <div class="branch-total">إجمالي ${branchName}: ${branchTotal.toFixed(2)} MYR (${branchRequests.length} طلب)</div>
          </div>`
      }).join('')

      return `
        <div class="month-section" ${monthIndex > 0 ? 'style="page-break-before: always;"' : ''}>
          <div class="month-title">📅 ${monthName}</div>
          ${branchesHtml}
          <div class="month-total">💰 إجمالي شهر ${monthName} كاملاً: ${monthTotal.toFixed(2)} MYR (${monthRequests.length} طلب)</div>
        </div>`
    }).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
      <title>تقرير سلف الراتب الشامل</title>
      <style>
        body { font-family: Tajawal, Arial, sans-serif; padding: 24px; color: #1a1a1a; }
        .report-header { text-align: center; border-bottom: 3px solid #C9A84C; padding-bottom: 16px; margin-bottom: 24px; }
        .report-header .logo { font-size: 22px; font-weight: 900; }
        .report-header .subtitle { font-size: 14px; color: #C9A84C; font-weight: 700; }
        .month-title { background: #0F2040; color: #C9A84C; font-size: 16px; font-weight: 800; padding: 10px 16px; border-radius: 6px; margin-bottom: 14px; }
        .branch-section { margin-bottom: 18px; }
        .branch-title { font-size: 13px; font-weight: 700; color: #444; margin-bottom: 6px; }
        table.advances-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
        table.advances-table th, table.advances-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
        table.advances-table th { background: #f3f3f3; }
        .branch-total { text-align: left; font-size: 12px; font-weight: 700; color: #C9A84C; margin-bottom: 14px; }
        .month-total { text-align: center; font-size: 14px; font-weight: 900; color: #1a1a1a; background: #FAF0D8; border: 1px solid #C9A84C; border-radius: 6px; padding: 10px; margin-top: 10px; }
        .grand-total { text-align: center; font-size: 18px; font-weight: 900; color: #fff; background: #0F2040; border-radius: 8px; padding: 16px; margin-top: 30px; }
        @media print { @page { margin: 12mm; } }
      </style>
      </head><body>
        <div class="report-header">
          <div class="logo">Orchid Group</div>
          <div class="subtitle">تقرير سلف الراتب الشامل — ${isAdmin ? 'كل الفروع' : `فرع ${branches.find(b => b.id === currentUser?.branch_id)?.name || ''}`}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</div>
        </div>
        ${monthsHtml}
        <div class="grand-total">💰 الإجمالي الكلي النهائي لكل السلف: ${grandTotal.toFixed(2)} MYR</div>
        <script>window.onload = function(){ window.print() }</script>
      </body></html>`)
    win.document.close()
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    let reqQuery = supabase.from('employee_requests')
      .select('*, employees(name, name_en, role, department, employee_number, branch_id, branches(name))')
      .order('created_at', { ascending: false })

    const myId = currentUser?.id || ''
    const myBranchId = currentUser?.branch_id || ''
    const myDept = currentUser?.department || ''

    if (isAdmin) {
      // admin يشوف كل شيء
    } else if (isBranchManager) {
      // مدير الفرع يشوف كل طلبات موظفي فرعه (بما في ذلك نفسه)
      const { data: branchEmployees } = await supabase.from('employees').select('id').eq('branch_id', myBranchId)
      const ids = (branchEmployees || []).map(e => e.id)
      reqQuery = reqQuery.in('employee_id', ids.length > 0 ? ids : [myId])
    } else if (isDeptManager) {
      // مدير القسم يشوف طلبات موظفي قسمه في فرعه فقط (بما في ذلك نفسه) - هو المعتمد الوحيد لكل طلبات الموظفين
      // نجيب كل موظفي الفرع، ونفلتر بالقسم بعد توحيد الاسم (عربي/إنجليزي) لتجنب اختلاف الصيغة
      const { data: branchEmployees } = await supabase.from('employees').select('id, department').eq('branch_id', myBranchId)
      const myDeptNormalized = normalizeDept(myDept)
      const ids = (branchEmployees || [])
        .filter(e => normalizeDept(e.department) === myDeptNormalized)
        .map(e => e.id)
      reqQuery = reqQuery.in('employee_id', ids.length > 0 ? ids : [myId])
    } else {
      // ✅ الموظف العادي والمشرف يشوفوا طلباتهم الشخصية فقط - المشرف ليس له اعتماد، مدير القسم فقط
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
  }, [isAdmin, isBranchManager, isDeptManager, isSupervisor, currentUser?.id, currentUser?.branch_id, currentUser?.department])

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
  const filtered = branchScopedRequests.filter(r => {
    // 📈 زيادة الراتب: تظهر فقط لمن يملك الصلاحية من صفحة إدارة الصلاحيات
    if (!canSeeSalaryIncrease && r.request_type === 'salary_increase') return false
    // 💸 سلفة الراتب: مقصورة على صاحبها شخصياً، إلا للأدمن أو مدير الفرع (طلبات فرعه فقط — الاستعلام الأساسي
    // في fetchAll() أصلاً محصور على موظفي فرعه، فلا داعي لتقييد إضافي يمنعه من رؤية طلبات فرعه بعد جلبها بنجاح)
    if (r.request_type === 'salary_advance' && !isAdmin && !isBranchManager && r.employee_id !== currentUser?.id) return false
    // 📈 زيادة الراتب: تبقى مقصورة على الأدمن فقط (أو صاحبها شخصياً) كما كانت — لم يُطلب توسيعها هنا
    if (r.request_type === 'salary_increase' && !isAdmin && r.employee_id !== currentUser?.id) return false
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
        input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); }
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
  {canSeeSalaryIncrease && (
    <button onClick={() => setShowSalaryIncrease(true)} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{isAr ? '📈 زيادة راتب' : '📈 Salary Increase'}</button>
  )}
  <button onClick={() => setShowSalaryAdvance(true)} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{isAr ? '💸 سلفة راتب' : '💸 Salary Advance'}</button>
  {(isAdmin || isBranchManager) && (
    <>
      {/* ✅ جديد: اختيار شهر محدد قبل الطباعة - فاضي معناه كل الشهور مع بعض مثل القديم */}
      <input type="month" value={printAdvancesMonth} onChange={e => setPrintAdvancesMonth(e.target.value)}
        title="اختر شهرًا لطباعته فقط (اتركه فاضيًا لكل الشهور)"
        style={{ padding: '9px 12px', borderRadius: 12, border: `1px solid ${S.border}`, background: S.card, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', colorScheme: 'dark' }} />
      <button onClick={printAllSalaryAdvances} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>{isAr ? '🖨️ تقرير السلف الشامل' : '🖨️ Full Advances Report'}</button>
    </>
  )}
  {/* ✅ جديد: طباعة استمارات السلفة الفردية دفعة واحدة لكل موظفي فرع ما في شهر محدد */}
  {(isAdmin || isBranchManager) && (
    <>
      <select value={bulkAppBranch} onChange={e => setBulkAppBranch(e.target.value)}
        style={{ padding: '9px 12px', borderRadius: 12, border: `1px solid ${S.border}`, background: S.card, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
        <option value="" style={{ background: S.navy2 }}>-- اختر الفرع --</option>
        {branches.map(b => <option key={b.id} value={b.name} style={{ background: S.navy2 }}>{b.name}</option>)}
      </select>
      <input type="month" value={bulkAppMonth} onChange={e => setBulkAppMonth(e.target.value)}
        title="اختر شهر الطلبات المراد طباعة استماراتها"
        style={{ padding: '9px 12px', borderRadius: 12, border: `1px solid ${S.border}`, background: S.card, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', colorScheme: 'dark' }} />
      <button onClick={printBulkApplications} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ طباعة استمارات السلف</button>
    </>
  )}
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
          الكل ({branchScopedRequests.filter(r =>
            (canSeeSalaryIncrease || r.request_type !== 'salary_increase') &&
            !(r.request_type === 'salary_advance' && !isAdmin && !isBranchManager && r.employee_id !== currentUser?.id) &&
            !(r.request_type === 'salary_increase' && !isAdmin && r.employee_id !== currentUser?.id)
          ).length})
        </button>
        {Object.entries(REQUEST_TYPES).filter(([key]) => key !== 'salary_increase' || canSeeSalaryIncrease).map(([key, cfg]) => {
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

     {showNew && <NewRequestModal employees={employees} initialType={showNewType} onClose={() => { setShowNew(false); setShowNewType('leave_sick') }} onSaved={() => { setShowNew(false); setShowNewType('leave_sick'); fetchAll() }} currentEmployeeId={currentUser?.id} canSeeSalaryIncrease={canSeeSalaryIncrease} canSeeSalaryAdvance={canSeeSalaryAdvance} />}
      {showSalaryIncrease && employees.find(e => e.id === currentUser?.id) && (
  <SalaryIncreaseModal employee={employees.find(e => e.id === currentUser?.id)!} onClose={() => setShowSalaryIncrease(false)} onSaved={() => { setShowSalaryIncrease(false); fetchAll() }} />
)}
{showSalaryAdvance && employees.find(e => e.id === currentUser?.id) && (
  <SalaryAdvanceModal employee={employees.find(e => e.id === currentUser?.id)!} onClose={() => setShowSalaryAdvance(false)} onSaved={() => { setShowSalaryAdvance(false); fetchAll() }} />
)}
      {selected && <RequestDetailModal request={selected} currentUser={currentUser || undefined} isAdmin={isAdmin} isDeptManager={isDeptManager} isSupervisor={isSupervisor} isBranchManager={isBranchManager} onClose={() => setSelected(null)} onUpdate={() => { setSelected(null); fetchAll() }} onDelete={() => { setSelected(null); fetchAll() }} />}
    </div>
  )
} 
    