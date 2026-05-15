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

const REQUEST_TYPES: Record<string, { label: string; icon: string; color: string; bg: string; hasAmount?: boolean; hasDates?: boolean }> = {
  leave_annual:  { label: 'إجازة سنوية',     icon: '🏖️', color: S.blue,   bg: S.blueB,   hasDates: true },
  leave_sick:    { label: 'إجازة مرضية',     icon: '🏥', color: S.red,    bg: S.redB,    hasDates: true },
  leave_emergency:{ label: 'إجازة طارئة',    icon: '🚨', color: S.amber,  bg: S.amberB,  hasDates: true },
  advance:       { label: 'سلفة راتب',        icon: '💰', color: S.gold,   bg: S.gold3,   hasAmount: true },
  overtime:      { label: 'طلب أوفر تايم',   icon: '⏰', color: S.purple, bg: S.purpleB, hasDates: true },
  extra_meal:    { label: 'وجبة إضافية',     icon: '🍽️', color: S.teal,  bg: S.tealB },
  complaint:     { label: 'شكوى / مشكلة',    icon: '⚠️', color: S.red,   bg: S.redB },
  suggestion:    { label: 'اقتراح',           icon: '💡', color: S.green,  bg: S.greenB },
  training:      { label: 'طلب تدريب',        icon: '📚', color: S.blue,   bg: S.blueB },
  equipment:     { label: 'طلب معدات/أدوات', icon: '🔧', color: S.purple, bg: S.purpleB, hasAmount: true },
  uniform:       { label: 'طلب زي رسمي',     icon: '👔', color: S.muted,  bg: S.card2 },
  other:         { label: 'طلب آخر',          icon: '📋', color: S.muted,  bg: S.card2 },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: 'قيد الانتظار', color: S.amber,  bg: S.amberB,  icon: '⏳' },
  approved: { label: 'موافق عليه',   color: S.green,  bg: S.greenB,  icon: '✅' },
  rejected: { label: 'مرفوض',        color: S.red,    bg: S.redB,    icon: '❌' },
  completed:{ label: 'مكتمل',        color: S.teal,   bg: S.tealB,   icon: '🏁' },
}

interface Employee { id: string; name: string; role: string; department: string }
interface EmployeeRequest {
  id: string; created_at: string; request_number: number
  employee_id: string; request_type: string; status: string
  title: string; description: string; amount: number
  start_date: string; end_date: string; days_count: number
  approved_by: string; approved_at: string; rejection_reason: string
  employees?: { name: string; role: string; department: string }
}

// ══ New Request Modal ══
function NewRequestModal({ employees, onClose, onSaved }: {
  employees: Employee[]; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: '', request_type: 'leave_annual',
    title: '', description: '', amount: '',
    start_date: '', end_date: '',
  })

  const reqType = REQUEST_TYPES[form.request_type]

  const daysCount = form.start_date && form.end_date
    ? Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  async function save() {
    if (!form.employee_id || !form.request_type) { alert('يرجى اختيار الموظف ونوع الطلب'); return }
    if (!form.description) { alert('يرجى إدخال تفاصيل الطلب'); return }
    setSaving(true)
    const { error } = await supabase.from('employee_requests').insert([{
      employee_id: form.employee_id,
      request_type: form.request_type,
      title: form.title || reqType.label,
      description: form.description,
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
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📋 طلب جديد</h2>
            <p style={{ fontSize: 12, color: S.muted }}>تقديم طلب جديد للإدارة</p>
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
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* الموظف */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الموظف *</label>
            <select style={{ ...inp }} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
              <option value="">اختر الموظف</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.department || e.role}</option>)}
            </select>
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
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>من تاريخ</label>
                <input style={inp} type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>إلى تاريخ</label>
                <input style={inp} type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
              {daysCount > 0 && (
                <div style={{ gridColumn: '1/-1', background: S.blueB, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: S.muted }}>عدد الأيام</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: S.blue }}>{daysCount} يوم</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الإرسال...' : '📤 إرسال الطلب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Request Detail Modal ══
function RequestDetailModal({ request, onClose, onUpdate }: {
  request: EmployeeRequest; onClose: () => void; onUpdate: () => void
}) {
  const supabase = createClient()
  const [updating, setUpdating] = useState(false)
  const [approvedBy, setApprovedBy] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject] = useState(false)

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
    setUpdating(false)
    onUpdate()
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
            { label: 'الموظف', value: request.employees?.name || '—', icon: '👤' },
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

        {/* Description */}
        <div style={{ background: S.card, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>📝 تفاصيل الطلب</div>
          <div style={{ fontSize: 13, color: S.white, lineHeight: 1.6 }}>{request.description}</div>
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
                <input style={{ ...inp, marginBottom: 12 }} value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder="أدخل اسمك..." />
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
                  <button onClick={() => setShowReject(false)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function EmployeeRequestsPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<EmployeeRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<EmployeeRequest | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterEmp, setFilterEmp] = useState('all')
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [req, emp] = await Promise.all([
      supabase.from('employee_requests')
        .select('*, employees(name, role, department)')
        .order('created_at', { ascending: false }),
      supabase.from('employees').select('id,name,role,department').eq('is_active', true).order('name'),
    ])
    setRequests(req.data || [])
    setEmployees(emp.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Stats
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthReqs = requests.filter(r => r.created_at?.startsWith(thisMonth))
  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = requests.filter(r => r.status === s).length
    return acc
  }, {} as Record<string, number>)

  // Filter
  const filtered = requests.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    const matchType = filterType === 'all' || r.request_type === filterType
    const matchEmp = filterEmp === 'all' || r.employee_id === filterEmp
    const matchSearch = !search || r.employees?.name?.includes(search) || String(r.request_number).includes(search)
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
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📋 طلبات الموظفين</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة طلبات الإجازات والسلف والمقترحات</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          ➕ طلب جديد
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📊</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 2 }}>{requests.length}</div>
          <div style={{ fontSize: 12, color: S.muted }}>إجمالي الطلبات</div>
        </div>
        <div style={{ background: S.gold3, borderRadius: 14, border: `1px solid rgba(201,168,76,0.2)`, padding: '16px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📅</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.gold, marginBottom: 2 }}>{monthReqs.length}</div>
          <div style={{ fontSize: 12, color: S.muted }}>هذا الشهر</div>
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
          الكل ({requests.length})
        </button>
        {Object.entries(REQUEST_TYPES).map(([key, cfg]) => {
          const count = requests.filter(r => r.request_type === key).length
          if (count === 0) return null
          return (
            <button key={key} onClick={() => setFilterType(filterType === key ? 'all' : key)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterType === key ? cfg.color : S.border}`, background: filterType === key ? cfg.bg : 'transparent', color: filterType === key ? cfg.color : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
              {cfg.icon} {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم أو رقم الطلب..." />
        <select style={{ ...inp, width: 'auto', minWidth: 160 }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="all">كل الموظفين</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {(search || filterStatus !== 'all' || filterType !== 'all' || filterEmp !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterType('all'); setFilterEmp('all') }}
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
            <span style={{ fontWeight: 700, fontSize: 14, color: S.white }}>سجل الطلبات</span>
            <span style={{ fontSize: 12, color: S.muted }}>{filtered.length} طلب</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['#', 'نوع الطلب', 'الموظف', 'التفاصيل', 'المبلغ/الأيام', 'الحالة', 'التاريخ', ''].map(h => (
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
                          {rt.icon} {rt.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.blueB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: S.blue, fontWeight: 700, flexShrink: 0 }}>
                            {req.employees?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>{req.employees?.name || '—'}</div>
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

      {showNew && <NewRequestModal employees={employees} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} />}
      {selected && <RequestDetailModal request={selected} onClose={() => setSelected(null)} onUpdate={() => { setSelected(null); fetchAll() }} />}
    </div>
  )
}
