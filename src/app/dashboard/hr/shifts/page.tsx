'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'

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

const DEPARTMENTS = ['الكل', 'المطبخ', 'البار', 'الصالة', 'الحلويات', 'الكاشير', 'الإدارة', 'التوصيل', 'النظافة']
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const SHIFT_COLORS = ['#C9A84C', '#22C55E', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#14B8A6', '#EC4899']

interface Shift {
  id: string; name: string; start_time: string; end_time: string
  department: string; color: string; is_active: boolean
}
interface Employee {
  id: string; name: string; role: string; department: string; photo_url?: string
}
interface ShiftSchedule {
  id: string; employee_id: string; shift_id: string; date: string
  status: string; notes: string; assigned_by: string
  employees?: { name: string; department: string }
  shifts?: { name: string; start_time: string; end_time: string; color: string }
}
interface ShiftRequest {
  id: string; employee_id: string; shift_id: string; date: string
  reason: string; status: string; reviewed_by: string; rejection_reason: string
  employees?: { name: string; department: string }
  shifts?: { name: string; start_time: string; end_time: string; color: string }
}

// ══ Shift Modal ══
function ShiftModal({ shift, onClose, onSaved }: {
  shift?: Shift | null; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: shift?.name || '',
    start_time: shift?.start_time || '08:00',
    end_time: shift?.end_time || '16:00',
    department: shift?.department || '',
    color: shift?.color || '#C9A84C',
    is_active: shift?.is_active !== false,
  })

  async function save() {
    if (!form.name) { alert('يرجى إدخال اسم الشيفت'); return }
    setSaving(true)
    const { error } = shift
      ? await supabase.from('shifts').update(form).eq('id', shift.id)
      : await supabase.from('shifts').insert([form])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  // حساب مدة الشيفت
  const duration = (() => {
    const [sh, sm] = form.start_time.split(':').map(Number)
    const [eh, em] = form.end_time.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h} ساعة${m > 0 ? ` و ${m} دقيقة` : ''}`
  })()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
              {shift ? '✏️ تعديل الشيفت' : '➕ شيفت جديد'}
            </h2>
            <p style={{ fontSize: 12, color: S.muted }}>تحديد اسم ووقت الشيفت</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>اسم الشيفت *</label>
            <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: صباحي / مسائي / ليلي" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وقت البداية</label>
              <input style={{ ...inp, direction: 'ltr', textAlign: 'center' }} type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وقت النهاية</label>
              <input style={{ ...inp, direction: 'ltr', textAlign: 'center' }} type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
            </div>
          </div>

          {/* مدة الشيفت */}
          <div style={{ background: S.blueB, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: S.muted }}>⏱️ مدة الشيفت</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: S.blue }}>{duration}</span>
          </div>

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>القسم (اختياري)</label>
            <select style={inp} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">كل الأقسام</option>
              {DEPARTMENTS.slice(1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>لون الشيفت</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SHIFT_COLORS.map(color => (
                <button key={color} onClick={() => setForm(p => ({ ...p, color }))}
                  style={{ width: 32, height: 32, borderRadius: 8, background: color, border: form.color === color ? `3px solid ${S.white}` : '3px solid transparent', cursor: 'pointer', transition: 'all .15s' }} />
              ))}
            </div>
          </div>

          {/* معاينة */}
          <div style={{ background: form.color + '20', border: `1px solid ${form.color}50`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 40, borderRadius: 5, background: form.color }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>{form.name || 'اسم الشيفت'}</div>
              <div style={{ fontSize: 12, color: S.muted }}>{form.start_time} — {form.end_time} • {form.department || 'كل الأقسام'}</div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: S.green, width: 16, height: 16 }} />
            <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>شيفت نشط</div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : shift ? '💾 حفظ' : '✅ إضافة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Assign Schedule Modal ══
function AssignModal({ employees, shifts, onClose, onSaved }: {
  employees: Employee[]; shifts: Shift[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: '',
    shift_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  async function save() {
    if (!form.employee_id || !form.shift_id || !form.date) { alert('يرجى إكمال البيانات'); return }
    setSaving(true)
    // حذف الجدول القديم لنفس الموظف في نفس اليوم
    await supabase.from('shift_schedules').delete()
      .eq('employee_id', form.employee_id).eq('date', form.date)
    const { error } = await supabase.from('shift_schedules').insert([{ ...form, status: 'confirmed' }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  const selectedShift = shifts.find(s => s.id === form.shift_id)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 460, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>📅 تعيين شيفت لموظف</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الموظف *</label>
            <select style={inp} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
              <option value="">اختر الموظف</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.department}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الشيفت *</label>
            <select style={inp} value={form.shift_id} onChange={e => setForm(p => ({ ...p, shift_id: e.target.value }))}>
              <option value="">اختر الشيفت</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time} — {s.end_time}) {s.department ? `• ${s.department}` : ''}</option>)}
            </select>
          </div>

          {selectedShift && (
            <div style={{ background: selectedShift.color + '20', border: `1px solid ${selectedShift.color}50`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 32, borderRadius: 4, background: selectedShift.color }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{selectedShift.name}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{selectedShift.start_time} — {selectedShift.end_time}</div>
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التاريخ *</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '✅ تعيين الشيفت'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══ Request Shift Modal (للموظف العادي) ══
function RequestShiftModal({ shifts, employeeId, onClose, onSaved }: {
  shifts: Shift[]; employeeId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    shift_id: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
  })

  async function save() {
    if (!form.shift_id || !form.date) { alert('يرجى اختيار الشيفت والتاريخ'); return }
    setSaving(true)
    const { error } = await supabase.from('shift_requests').insert([{
      employee_id: employeeId,
      shift_id: form.shift_id,
      date: form.date,
      reason: form.reason,
      status: 'pending',
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  const selectedShift = shifts.find(s => s.id === form.shift_id)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 440, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🔄 طلب تغيير شيفت</h2>
            <p style={{ fontSize: 12, color: S.muted }}>سيتم إرسال طلبك لمدير القسم</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الشيفت المطلوب *</label>
            <select style={inp} value={form.shift_id} onChange={e => setForm(p => ({ ...p, shift_id: e.target.value }))}>
              <option value="">اختر الشيفت</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0,5)} — {s.end_time.slice(0,5)})</option>)}
            </select>
          </div>
          {selectedShift && (
            <div style={{ background: selectedShift.color + '20', border: `1px solid ${selectedShift.color}50`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 32, borderRadius: 4, background: selectedShift.color }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{selectedShift.name}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{selectedShift.start_time.slice(0,5)} — {selectedShift.end_time.slice(0,5)}</div>
              </div>
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التاريخ المطلوب *</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>سبب الطلب</label>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' } as React.CSSProperties}
              value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="اشرح سبب طلب تغيير الشيفت..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '📤 إرسال الطلب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function ShiftsPage() {
  const supabase = createClient()
  const { employee, hasPermission, permissions } = useAuth()

  // تحديد دور المستخدم
  const isAdmin = permissions?.all === true
  const isManager = isAdmin || ['branch_manager','kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(employee?.role || '')
  const isEmployee = !isManager

  const [activeTab, setActiveTab] = useState<'shifts' | 'schedule' | 'requests' | 'my_schedule' | 'my_requests'>('schedule')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([])
  const [requests, setRequests] = useState<ShiftRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddShift, setShowAddShift] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [showRequestShift, setShowRequestShift] = useState(false)
  const [mySchedules, setMySchedules] = useState<ShiftSchedule[]>([])
  const [myRequests, setMyRequests] = useState<ShiftRequest[]>([])
  const [filterDept, setFilterDept] = useState('الكل')
  const [weekOffset, setWeekOffset] = useState(0)

  // الأسبوع الحالي
  const weekStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7 - d.getDay())
    return d
  })()

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [sh, emp, sch, req] = await Promise.all([
      supabase.from('shifts').select('*').eq('is_active', true).order('start_time'),
      supabase.from('employees').select('id,name,role,department,photo_url').eq('is_active', true).order('name'),
      supabase.from('shift_schedules').select('*, employees(name,department), shifts(name,start_time,end_time,color)')
        .gte('date', weekDays[0].toISOString().split('T')[0])
        .lte('date', weekDays[6].toISOString().split('T')[0])
        .order('date'),
      supabase.from('shift_requests').select('*, employees(name,department), shifts(name,start_time,end_time,color)')
        .eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setShifts(sh.data || [])
    setEmployees(emp.data || [])
    setSchedules(sch.data || [])

    // طلبات حسب الدور
    if (isAdmin) {
      // مدير النظام يشوف الكل
      setRequests(req.data || [])
    } else if (isManager) {
      // مدير القسم يشوف طلبات قسمه + طلباته الشخصية ترفع لمدير النظام
      setRequests((req.data || []).filter((r: ShiftRequest) =>
        r.employees?.department === employee?.department
      ))
    }

    // شيفتات الموظف الحالي
    if (employee?.id) {
      const mySchedule = (sch.data || []).filter((s: ShiftSchedule) => s.employee_id === employee.id)
      setMySchedules(mySchedule)
      const { data: myReq } = await supabase.from('shift_requests')
        .select('*, shifts(name,start_time,end_time,color)')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setMyRequests(myReq || [])
    }

    setLoading(false)
  }, [weekOffset, employee?.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function approveRequest(req: ShiftRequest) {
    // أضيف الشيفت للجدول
    await supabase.from('shift_schedules').delete()
      .eq('employee_id', req.employee_id).eq('date', req.date)
    await supabase.from('shift_schedules').insert([{
      employee_id: req.employee_id, shift_id: req.shift_id,
      date: req.date, status: 'confirmed', notes: 'تم بناءً على طلب الموظف'
    }])
    await supabase.from('shift_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id)
    fetchAll()
  }

  async function rejectRequest(req: ShiftRequest, reason: string) {
    await supabase.from('shift_requests').update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() }).eq('id', req.id)
    fetchAll()
  }

  const filteredEmployees = (() => {
    let emps = employees
    // مدير القسم يشوف موظفيه بس
    if (!isAdmin && isManager && employee?.department) {
      emps = emps.filter(e => e.department === employee.department)
    }
    // فلتر القسم
    if (filterDept !== 'الكل') {
      emps = emps.filter(e => e.department === filterDept)
    }
    return emps
  })()

  const getEmployeeShift = (empId: string, date: string) =>
    schedules.find(s => s.employee_id === empId && s.date === date)

  // Tabs حسب الدور
  const tabs = isEmployee ? [
    { key: 'my_schedule', label: 'شيفتاتي', icon: '📅' },
    { key: 'my_requests', label: 'طلباتي', icon: '🔄', badge: myRequests.filter(r => r.status === 'pending').length },
  ] : isAdmin ? [
    { key: 'schedule', label: 'جدول الأسبوع', icon: '📅' },
    { key: 'shifts', label: 'الشيفتات', icon: '⏰' },
    { key: 'requests', label: 'طلبات التغيير', icon: '🔄', badge: requests.length },
  ] : [
    { key: 'schedule', label: 'جدول قسمي', icon: '📅' },
    { key: 'shifts', label: 'الشيفتات', icon: '⏰' },
    { key: 'requests', label: 'طلبات قسمي', icon: '🔄', badge: requests.length },
  ]

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .shift-cell:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🕐 إدارة الشيفتات</h1>
          <p style={{ fontSize: 13, color: S.muted }}>جدول العمل الأسبوعي وطلبات تغيير الشيفت</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isEmployee ? (
            <button onClick={() => setShowRequestShift(true)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              🔄 طلب تغيير شيفت
            </button>
          ) : (
            <>
              {isAdmin && (
                <button onClick={() => setShowAddShift(true)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  ⏰ شيفت جديد
                </button>
              )}
              <button onClick={() => setShowAssign(true)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                📅 تعيين شيفت
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'الشيفتات المعرّفة', value: shifts.length, icon: '⏰', color: S.purple, bg: S.purpleB },
          { label: 'الموظفون النشطون', value: employees.length, icon: '👷', color: S.blue, bg: S.blueB },
          { label: 'مجدولون هذا الأسبوع', value: new Set(schedules.map(s => s.employee_id)).size, icon: '📅', color: S.green, bg: S.greenB },
          { label: 'طلبات معلقة', value: requests.length, icon: '🔄', color: S.amber, bg: S.amberB },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 14, border: `1px solid ${s.color}30`, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${activeTab === tab.key ? S.gold : S.border}`, background: activeTab === tab.key ? S.gold3 : 'transparent', color: activeTab === tab.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab === tab.key ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
            {tab.icon} {tab.label}
            {tab.badge ? (
              <span style={{ background: S.amber, color: S.navy, borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══ Tab: جدول الأسبوع ══ */}
      {activeTab === 'schedule' && (
        <div>
          {/* Week Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setWeekOffset(p => p - 1)} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>← السابق</button>
              <span style={{ fontSize: 14, fontWeight: 700, color: S.white }}>
                {weekDays[0].toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' })} — {weekDays[6].toLocaleDateString('ar-SA', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <button onClick={() => setWeekOffset(p => p + 1)} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>التالي →</button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>هذا الأسبوع</button>
              )}
            </div>

            {/* Filter by department */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEPARTMENTS.map(d => (
                <button key={d} onClick={() => setFilterDept(d)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${filterDept === d ? S.gold : S.border}`, background: filterDept === d ? S.gold3 : 'transparent', color: filterDept === d ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: filterDept === d ? 700 : 400 }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Roster Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
          ) : (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, minWidth: 150, position: 'sticky', right: 0, background: S.navy3 }}>الموظف</th>
                      {weekDays.map((d, i) => {
                        const isToday = d.toDateString() === new Date().toDateString()
                        return (
                          <th key={i} style={{ padding: '12px 10px', textAlign: 'center', fontSize: 11, color: isToday ? S.gold : S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, minWidth: 110, background: isToday ? S.gold3 : 'transparent' }}>
                            <div>{DAYS_AR[d.getDay()]}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: isToday ? S.gold : S.white, marginTop: 2 }}>{d.getDate()}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا يوجد موظفون في هذا القسم</td></tr>
                    ) : filteredEmployees.map((emp, ei) => (
                      <tr key={emp.id} style={{ borderBottom: `1px solid ${S.border}`, background: ei % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '10px 16px', position: 'sticky', right: 0, background: ei % 2 === 0 ? S.navy2 : '#0d1b35', borderLeft: `1px solid ${S.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: S.gold3, border: `1px solid ${S.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: S.gold, flexShrink: 0 }}>
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: S.white }}>{emp.name}</div>
                              <div style={{ fontSize: 10, color: S.muted }}>{emp.department}</div>
                            </div>
                          </div>
                        </td>
                        {weekDays.map((d, di) => {
                          const dateStr = d.toISOString().split('T')[0]
                          const schedule = getEmployeeShift(emp.id, dateStr)
                          const isToday = d.toDateString() === new Date().toDateString()
                          return (
                            <td key={di} style={{ padding: '6px 8px', textAlign: 'center', background: isToday ? 'rgba(201,168,76,0.03)' : 'transparent' }}>
                              {schedule ? (
                                <div className="shift-cell" style={{ background: (schedule.shifts?.color || S.gold) + '25', border: `1px solid ${(schedule.shifts?.color || S.gold)}50`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: schedule.shifts?.color || S.gold }}>{schedule.shifts?.name}</div>
                                  <div style={{ fontSize: 9, color: S.muted, marginTop: 2 }}>{schedule.shifts?.start_time?.slice(0, 5)} - {schedule.shifts?.end_time?.slice(0, 5)}</div>
                                </div>
                              ) : (
                                <div onClick={() => setShowAssign(true)} style={{ color: S.border, fontSize: 18, cursor: 'pointer', opacity: 0.5 }}>—</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Tab: الشيفتات ══ */}
      {activeTab === 'shifts' && (
        <div>
          {shifts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد شيفتات بعد</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>اضغط "شيفت جديد" لإضافة أول شيفت</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {shifts.map(shift => {
                const [sh, sm] = shift.start_time.split(':').map(Number)
                const [eh, em] = shift.end_time.split(':').map(Number)
                let mins = (eh * 60 + em) - (sh * 60 + sm)
                if (mins < 0) mins += 24 * 60
                const hours = Math.floor(mins / 60)
                const empCount = schedules.filter(s => s.shift_id === shift.id).length

                return (
                  <div key={shift.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${shift.color}30`, overflow: 'hidden' }}>
                    <div style={{ height: 6, background: shift.color }} />
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: S.white, marginBottom: 4 }}>{shift.name}</div>
                          {shift.department && <span style={{ fontSize: 11, color: shift.color, background: shift.color + '20', borderRadius: 20, padding: '2px 10px' }}>{shift.department}</span>}
                        </div>
                        <button onClick={() => setEditShift(shift)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12 }}>✏️</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ background: S.card, borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ fontSize: 10, color: S.muted, marginBottom: 2 }}>🕐 البداية</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{shift.start_time.slice(0, 5)}</div>
                        </div>
                        <div style={{ background: S.card, borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ fontSize: 10, color: S.muted, marginBottom: 2 }}>🕕 النهاية</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{shift.end_time.slice(0, 5)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                        <span style={{ fontSize: 12, color: S.muted }}>⏱️ {hours} ساعة</span>
                        <span style={{ fontSize: 12, color: S.blue }}>👷 {empCount} موظف هذا الأسبوع</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ Tab: طلبات التغيير ══ */}
      {activeTab === 'requests' && (
        <div>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔄</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد طلبات معلقة</div>
              <div style={{ fontSize: 13 }}>كل الطلبات تمت مراجعتها</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {requests.map(req => (
                <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: S.amberB, border: `1px solid ${S.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {req.employees?.name?.charAt(0) || '؟'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>{req.employees?.name}</div>
                        <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>{req.employees?.department}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ background: (req.shifts?.color || S.gold) + '20', color: req.shifts?.color || S.gold, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                            {req.shifts?.name}
                          </span>
                          <span style={{ fontSize: 12, color: S.muted }}>
                            📅 {new Date(req.date).toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                        {req.reason && (
                          <div style={{ fontSize: 12, color: S.muted, marginTop: 8, background: S.card, borderRadius: 8, padding: '6px 10px' }}>
                            💬 {req.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => approveRequest(req)}
                        style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        ✅ موافقة
                      </button>
                      <button onClick={() => {
                        const reason = prompt('سبب الرفض:')
                        if (reason !== null) rejectRequest(req, reason)
                      }}
                        style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        ❌ رفض
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ Tab: شيفتاتي (للموظف) ══ */}
      {activeTab === 'my_schedule' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: S.muted, fontWeight: 700, marginBottom: 14 }}>شيفتاتك هذا الأسبوع</div>
            {mySchedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 14, color: S.white, marginBottom: 6 }}>لا يوجد شيفت مجدول لك هذا الأسبوع</div>
                <div style={{ fontSize: 12 }}>تواصل مع مديرك لتعيين شيفتك</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mySchedules.map(sch => (
                  <div key={sch.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${(sch.shifts?.color || S.gold)}30`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 8, height: 50, borderRadius: 4, background: sch.shifts?.color || S.gold, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 4 }}>{sch.shifts?.name}</div>
                      <div style={{ fontSize: 12, color: S.muted }}>
                        🕐 {sch.shifts?.start_time?.slice(0,5)} — {sch.shifts?.end_time?.slice(0,5)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: S.white }}>{new Date(sch.date).getDate()}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{DAYS_AR[new Date(sch.date).getDay()]}</div>
                    </div>
                    <span style={{ background: S.greenB, color: S.green, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✅ مؤكد</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Tab: طلباتي (للموظف) ══ */}
      {activeTab === 'my_requests' && (
        <div>
          {myRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
              <div style={{ fontSize: 14, color: S.white, marginBottom: 6 }}>لا توجد طلبات سابقة</div>
              <div style={{ fontSize: 12 }}>اضغط "طلب تغيير شيفت" لتقديم طلب جديد</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myRequests.map(req => {
                const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                  pending:  { label: '⏳ قيد المراجعة', color: S.amber, bg: S.amberB },
                  approved: { label: '✅ موافق عليه',   color: S.green, bg: S.greenB },
                  rejected: { label: '❌ مرفوض',        color: S.red,   bg: S.redB },
                }
                const st = statusMap[req.status] || statusMap.pending
                return (
                  <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 8, height: 40, borderRadius: 4, background: req.shifts?.color || S.gold, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>{req.shifts?.name}</div>
                          <div style={{ fontSize: 12, color: S.muted }}>
                            📅 {new Date(req.date).toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{st.label}</span>
                    </div>
                    {req.rejection_reason && (
                      <div style={{ marginTop: 10, background: S.redB, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: S.red }}>
                        سبب الرفض: {req.rejection_reason}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {(showAddShift || editShift) && (
        <ShiftModal shift={editShift}
          onClose={() => { setShowAddShift(false); setEditShift(null) }}
          onSaved={() => { setShowAddShift(false); setEditShift(null); fetchAll() }} />
      )}
      {showAssign && (
        <AssignModal employees={employees} shifts={shifts}
          onClose={() => setShowAssign(false)}
          onSaved={() => { setShowAssign(false); fetchAll() }} />
      )}
      {showRequestShift && employee?.id && (
        <RequestShiftModal
          shifts={shifts}
          employeeId={employee.id}
          onClose={() => setShowRequestShift(false)}
          onSaved={() => { setShowRequestShift(false); fetchAll() }} />
      )}
    </div>
  )
}
