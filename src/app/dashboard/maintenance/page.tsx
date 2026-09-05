'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
  white: '#F5F7FA', muted: '#8A93A6', border: 'rgba(255,255,255,0.08)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  green: '#3DDC84', greenB: 'rgba(61,220,132,0.12)',
  red: '#E5484D', redB: 'rgba(229,72,77,0.12)',
  amber: '#F0A93A', amberB: 'rgba(240,169,58,0.12)',
  blue: '#4B9EF0', blueB: 'rgba(75,158,240,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
}

// ⚠️ لو اسم عمود فرع الموظف في جدول employees مختلف عن branch_id، غيّر السطر ده بس
function employeeBranchId(e: any): string {
  return e?.branch_id || ''
}

function fullEmployeeName(e: { name?: string; name_en?: string } | null | undefined): string {
  if (!e) return ''
  return [e?.name, e?.name_en].filter(Boolean).join(' ')
}

function normalizeSearchText(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase()
}
function matchesSearch(text: string | null | undefined, query: string): boolean {
  if (!query.trim()) return true
  return normalizeSearchText(text).includes(normalizeSearchText(query))
}

interface Branch { id: string; name: string }
interface Employee { id: string; name: string; name_en?: string; role?: string; department?: string; branch_id?: string }

interface MaintenanceRequest {
  id: string; branch_id: string; item_name: string; description: string | null
  image_url: string | null; status: string
  requested_by: string; assigned_to: string | null
  // ✅ جديد: تعدُّد الفنيين المسؤولين
  assigned_to_ids?: string[] | null
  requested_by_number?: string | null; requested_by_department?: string | null
  last_followup_at: string | null; last_followup_note: string | null
  completed_at: string | null; created_at: string; updated_at: string
  paid_amount?: number | null; invoice_url?: string | null; after_image_url?: string | null
  branches?: { name: string }
}

interface Followup {
  id: string; request_id: string; note: string
  created_by_name: string | null; created_at: string
}

interface PeriodicTask {
  id: string; branch_id: string | null; title: string; description: string | null
  interval_days: number; last_done_at: string | null; next_due_at: string
  assigned_to_ids: string[]; assigned_to_names: string | null; is_active: boolean
  created_at: string; branches?: { name: string }
}

interface PeriodicLog {
  id: string; task_id: string; performed_at: string; note: string | null
  performed_by_name: string | null; created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '⏳ بانتظار التعيين', color: S.amber, bg: S.amberB },
  in_progress: { label: '🔧 جارٍ التنفيذ', color: S.blue, bg: S.blueB },
  completed: { label: '✅ تم التنفيذ', color: S.green, bg: S.greenB },
}

const INTERVAL_PRESETS = [
  { days: 7, label: 'أسبوعي' },
  { days: 30, label: 'شهري' },
  { days: 90, label: 'ربع سنوي' },
  { days: 180, label: 'نصف سنوي' },
  { days: 365, label: 'سنوي' },
]
function intervalLabel(days: number) {
  return INTERVAL_PRESETS.find(p => p.days === days)?.label || `كل ${days} يوم`
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function daysUntil(dateStr: string) {
  const target = new Date(dateStr + 'T00:00:00').getTime()
  const today = new Date(todayISO() + 'T00:00:00').getTime()
  return Math.round((target - today) / 86400000)
}
function dueStatus(nextDue: string) {
  const n = daysUntil(nextDue)
  if (n < 0) return { color: S.red, bg: S.redB, label: `متأخرة ${Math.abs(n)} يوم` }
  if (n === 0) return { color: S.amber, bg: S.amberB, label: 'مستحقة اليوم' }
  if (n <= 7) return { color: S.amber, bg: S.amberB, label: `مستحقة خلال ${n} يوم` }
  return { color: S.green, bg: S.greenB, label: `مستحقة بعد ${n} يوم` }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDay(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso + (iso.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
}

// عرض موحّد لمقدّم الطلب - الاسم الكامل + رقم الموظف (إن وجد) + القسم (إن وجد)
function requesterLabel(req: { requested_by: string; requested_by_number?: string | null; requested_by_department?: string | null }) {
  const parts = [req.requested_by]
  if (req.requested_by_number) parts.push(`#${req.requested_by_number}`)
  const base = parts.join(' ')
  return req.requested_by_department ? `${base} — ${req.requested_by_department}` : base
}

// ✅ إرسال إشعار لعدة موظفين دفعة واحدة (طلب صيانة / صيانة دورية جديدة)
async function notifyEmployees(sb: any, ids: (string | null | undefined)[], title: string, body: string) {
  const clean = [...new Set(ids.filter(Boolean) as string[])]
  if (clean.length === 0) return
  const rows = clean.map(id => ({
    type: 'maintenance', title, body,
    link: '/dashboard/maintenance', target_employee_id: id, target_role: null,
  }))
  try { await sb.from('notifications').insert(rows) } catch (_) { /* الإشعار اختياري */ }
}

const inp: React.CSSProperties = {
  width: '100%', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10,
  padding: '10px 12px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box',
}

// ══ منتقي الموظفين (متعدد) ══
function EmployeePicker({ employees, selectedIds, onChange, placeholder }: {
  employees: Employee[]; selectedIds: string[]; onChange: (ids: string[]) => void; placeholder?: string
}) {
  const [q, setQ] = useState('')
  const selected = employees.filter(e => selectedIds.includes(e.id))
  const list = employees
    .filter(e => !selectedIds.includes(e.id))
    .filter(e => matchesSearch(fullEmployeeName(e), q) || matchesSearch(e.department, q))
    .slice(0, 8)

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map(e => (
            <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: S.blueB, border: `1px solid ${S.blue}40`, color: S.blue, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
              {fullEmployeeName(e)}
              <button onClick={() => onChange(selectedIds.filter(x => x !== e.id))}
                style={{ background: 'transparent', border: 'none', color: S.blue, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
      )}
      <input style={inp} value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder || '🔍 ابحث عن موظف لإضافته...'} />
      {q.trim() && (
        <div style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, marginTop: 6, maxHeight: 210, overflowY: 'auto' }}>
          {list.length === 0 ? (
            <div style={{ padding: 10, fontSize: 12, color: S.muted }}>لا توجد نتائج</div>
          ) : list.map(e => (
            <button key={e.id} onClick={() => { onChange([...selectedIds, e.id]); setQ('') }}
              style={{ display: 'block', width: '100%', textAlign: 'right', background: 'transparent', border: 'none', borderBottom: `1px solid ${S.border}`, color: S.white, padding: '9px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
              {fullEmployeeName(e)} <span style={{ color: S.muted }}>— {e.department || e.role || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ══ Modal: طلب صيانة جديد ══
function NewMaintenanceModal({ branches, currentEmployee, isAdmin, onClose, onSaved }: {
  branches: Branch[]; currentEmployee: any; isAdmin: boolean; onClose: () => void; onSaved: () => void
}) {
  const sb = createClient()
  const myBranchId = employeeBranchId(currentEmployee)
  const [branchId, setBranchId] = useState(myBranchId || '')
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [img, setImg] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState('')
  const [saving, setSaving] = useState(false)

  function handleImgSelect(file: File) {
    setImg(file)
    const reader = new FileReader()
    reader.onload = () => setImgPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!itemName.trim()) { alert('يرجى كتابة اسم الشيء المطلوب صيانته'); return }
    if (!branchId) { alert('يرجى اختيار الفرع'); return }
    setSaving(true)
    let imgUrl = ''
    if (img) {
      const fileName = `maintenance/${Date.now()}-${img.name}`
      const { data: upData } = await sb.storage.from('employees').upload(fileName, img, { upsert: true })
      if (upData) { const { data: urlData } = sb.storage.from('employees').getPublicUrl(upData.path); imgUrl = urlData.publicUrl }
    }
    const { error } = await sb.from('maintenance_requests').insert([{
      branch_id: branchId, item_name: itemName.trim(), description: description.trim() || null,
      image_url: imgUrl || null, status: 'pending',
      requested_by: fullEmployeeName(currentEmployee) || 'غير معروف',
      requested_by_id: currentEmployee?.id || null,
      requested_by_number: currentEmployee?.employee_number || null,
      requested_by_department: currentEmployee?.department || null,
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 460, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>🔧 طلب صيانة جديد</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الفرع *</label>
            <select style={inp} value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">اختر الفرع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الشيء المطلوب صيانته *</label>
            <input style={inp} value={itemName} onChange={e => setItemName(e.target.value)} placeholder="مثال: ماكينة الآيس كريم" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وصف المشكلة</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="اختياري..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📷 صورة الشيء المطلوب صيانته</label>
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleImgSelect(e.target.files[0])} style={{ fontSize: 12, color: S.white }} />
            {imgPreview && <img src={imgPreview} alt="معاينة" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />}
          </div>
          <button onClick={save} disabled={saving}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, marginTop: 6 }}>
            {saving ? '⏳ جارٍ الإرسال...' : '📨 إرسال طلب الصيانة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Modal: تفاصيل طلب الصيانة ══
function DetailModal({ req, employees, currentEmployee, isAdmin, onClose, onUpdate, onDeleted }: {
  req: MaintenanceRequest; employees: Employee[]; currentEmployee: any; isAdmin: boolean
  onClose: () => void; onUpdate: () => void; onDeleted: () => void
}) {
  const sb = useRef(createClient()).current
  const [assignedIds, setAssignedIds] = useState<string[]>(req.assigned_to_ids || [])
  const [followupNote, setFollowupNote] = useState('')
  const [followups, setFollowups] = useState<Followup[]>([])
  const [saving, setSaving] = useState(false)
  const status = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending

  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoicePreview, setInvoicePreview] = useState('')
  const [afterFile, setAfterFile] = useState<File | null>(null)
  const [afterPreview, setAfterPreview] = useState('')

  // تحميل قائمة المتابعات لهذا الطلب
  useEffect(() => {
    let alive = true
    sb.from('maintenance_followups').select('*').eq('request_id', req.id).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          // لو الجدول لسه مش موجود — نعرض المتابعة القديمة الوحيدة كبديل مؤقت
          if (req.last_followup_note) {
            setFollowups([{ id: 'legacy', request_id: req.id, note: req.last_followup_note, created_by_name: null, created_at: req.last_followup_at || req.updated_at }])
          }
          return
        }
        setFollowups((data as Followup[]) || [])
      })
    return () => { alive = false }
  }, [sb, req.id])

  function pickImage(file: File, setFile: (f: File) => void, setPreview: (p: string) => void) {
    setFile(file)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function saveAssignment() {
    if (assignedIds.length === 0) { alert('يرجى اختيار فني صيانة واحد على الأقل'); return }
    setSaving(true)
    const names = employees.filter(e => assignedIds.includes(e.id)).map(fullEmployeeName).join('، ')
    const { error } = await sb.from('maintenance_requests').update({
      assigned_to_ids: assignedIds,
      assigned_to: names,
      status: req.status === 'pending' ? 'in_progress' : req.status,
    }).eq('id', req.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    // إشعار للفنيين المُضافين حديثاً فقط
    const newlyAdded = assignedIds.filter(id => !(req.assigned_to_ids || []).includes(id))
    await notifyEmployees(sb, newlyAdded, '🔧 طلب صيانة جديد',
      `تم تعيينك على صيانة: ${req.item_name}${req.branches?.name ? ` — فرع ${req.branches.name}` : ''}`)
    onUpdate()
  }

  async function addFollowup() {
    if (!followupNote.trim()) { alert('يرجى كتابة ملاحظة المتابعة'); return }
    setSaving(true)
    const note = followupNote.trim()
    const { data, error } = await sb.from('maintenance_followups').insert([{
      request_id: req.id, note,
      created_by_id: currentEmployee?.id || null,
      created_by_name: fullEmployeeName(currentEmployee) || null,
    }]).select()
    if (error) { setSaving(false); alert('خطأ: ' + error.message); return }
    // نحدّث كمان "آخر متابعة" على الطلب نفسه لعرضها في الكارت
    await sb.from('maintenance_requests').update({
      last_followup_at: new Date().toISOString(), last_followup_note: note,
    }).eq('id', req.id)
    setSaving(false)
    setFollowupNote('')
    if (data && data[0]) setFollowups(prev => [data[0] as Followup, ...prev])
    onUpdate()
  }

  async function confirmCompletion() {
    if (!paidAmount.trim() || isNaN(parseFloat(paidAmount)) || parseFloat(paidAmount) < 0) { alert('يرجى إدخال المبلغ المدفوع بشكل صحيح'); return }
    if (!invoiceFile) { alert('يرجى إرفاق صورة الفاتورة'); return }
    if (!afterFile) { alert('يرجى إرفاق صورة بعد الصيانة'); return }
    setSaving(true)
    const invoiceFileName = `maintenance/invoice-${req.id}-${Date.now()}.jpg`
    const { data: invoiceUpData } = await sb.storage.from('employees').upload(invoiceFileName, invoiceFile, { upsert: true })
    const afterFileName = `maintenance/after-${req.id}-${Date.now()}.jpg`
    const { data: afterUpData } = await sb.storage.from('employees').upload(afterFileName, afterFile, { upsert: true })
    if (!invoiceUpData || !afterUpData) { setSaving(false); alert('تعذّر رفع الصور، حاول مرة أخرى'); return }
    const invoiceUrl = sb.storage.from('employees').getPublicUrl(invoiceUpData.path).data.publicUrl
    const afterUrl = sb.storage.from('employees').getPublicUrl(afterUpData.path).data.publicUrl
    const { error } = await sb.from('maintenance_requests').update({
      status: 'completed', completed_at: new Date().toISOString(),
      paid_amount: parseFloat(paidAmount), invoice_url: invoiceUrl, after_image_url: afterUrl,
    }).eq('id', req.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onUpdate()
  }

  async function reopen() {
    if (!confirm('إعادة فتح الطلب؟')) return
    setSaving(true)
    const { error } = await sb.from('maintenance_requests').update({
      status: 'in_progress', completed_at: null,
    }).eq('id', req.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onUpdate()
  }

  // حذف الطلب - للأدمن فقط (تحقق داخل الدالة كحماية إضافية)
  async function deleteRequest() {
    if (!isAdmin) return
    if (!confirm(`تأكيد حذف طلب الصيانة "${req.item_name}" نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`)) return
    setSaving(true)
    const { error } = await sb.from('maintenance_requests').delete().eq('id', req.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onDeleted()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>🔧 {req.item_name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 999, background: status.bg, color: status.color, fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
          {status.label}
        </div>

        {req.image_url && (
          <img src={req.image_url} alt={req.item_name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 14, border: `1px solid ${S.border}` }} />
        )}

        {req.description && (
          <div style={{ background: S.card, borderRadius: 10, padding: 12, fontSize: 13, color: S.white, marginBottom: 14 }}>
            📝 {req.description}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12 }}>
          <div><span style={{ color: S.muted }}>🏪 الفرع: </span><span style={{ color: S.white, fontWeight: 700 }}>{req.branches?.name || '—'}</span></div>
          <div><span style={{ color: S.muted }}>👷 طلب بواسطة: </span><span style={{ color: S.white, fontWeight: 700 }}>{requesterLabel(req)}</span></div>
          <div><span style={{ color: S.muted }}>🕐 تاريخ الطلب: </span><span style={{ color: S.white }}>{fmtDate(req.created_at)}</span></div>
          <div><span style={{ color: S.muted }}>🔄 آخر تحديث: </span><span style={{ color: S.white }}>{fmtDate(req.updated_at)}</span></div>
        </div>

        {req.status !== 'completed' && (
          <>
            <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>👷‍♂️ فنيو الصيانة المسؤولون (يمكن اختيار أكثر من واحد)</label>
              <EmployeePicker employees={employees} selectedIds={assignedIds} onChange={setAssignedIds} />
              <button onClick={saveAssignment} disabled={saving}
                style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                💾 حفظ التعيين وإرسال إشعار للفنيين
              </button>
            </div>

            <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>📋 تسجيل متابعة جديدة</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inp, flex: 1 }} value={followupNote} onChange={e => setFollowupNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !saving) addFollowup() }}
                  placeholder="مثال: تم طلب قطعة الغيار وبانتظار وصولها" />
                <button onClick={addFollowup} disabled={saving}
                  style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  ➕ إضافة
                </button>
              </div>

              {followups.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {followups.map(f => (
                    <div key={f.id} style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 12px' }}>
                      <div style={{ fontSize: 12, color: S.white, lineHeight: 1.6 }}>{f.note}</div>
                      <div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>
                        {f.created_by_name ? `${f.created_by_name} — ` : ''}{fmtDate(f.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!showCompleteForm ? (
              <button onClick={() => setShowCompleteForm(true)} disabled={saving}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                ✅ تم تنفيذ الصيانة
              </button>
            ) : (
              <div style={{ background: S.card, borderRadius: 12, padding: 14, border: `1px solid ${S.green}40` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.green, marginBottom: 10 }}>✅ إتمام الصيانة</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>💰 المبلغ المدفوع (RM) *</label>
                  <input type="number" min={0} step="0.01" style={inp} value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>🧾 صورة الفاتورة *</label>
                  <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && pickImage(e.target.files[0], setInvoiceFile, setInvoicePreview)} style={{ fontSize: 12, color: S.white }} />
                  {invoicePreview && <img src={invoicePreview} alt="الفاتورة" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📷 صورة بعد الصيانة *</label>
                  <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && pickImage(e.target.files[0], setAfterFile, setAfterPreview)} style={{ fontSize: 12, color: S.white }} />
                  {afterPreview && <img src={afterPreview} alt="بعد الصيانة" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={confirmCompletion} disabled={saving}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: S.green, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    {saving ? '⏳ جارٍ الحفظ...' : '✅ تأكيد الإتمام'}
                  </button>
                  <button onClick={() => setShowCompleteForm(false)} disabled={saving}
                    style={{ padding: '11px 16px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {req.status === 'completed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: S.muted }}>✅ تم الإتمام في: {fmtDate(req.completed_at)}</div>
            {req.assigned_to && <div style={{ fontSize: 12, color: S.muted }}>👷‍♂️ نُفِّذت بواسطة: <span style={{ color: S.white }}>{req.assigned_to}</span></div>}
            {req.paid_amount !== null && req.paid_amount !== undefined && (
              <div style={{ background: S.card, borderRadius: 10, padding: 12, fontSize: 13 }}>
                <span style={{ color: S.muted }}>💰 المبلغ المدفوع: </span>
                <span style={{ color: S.white, fontWeight: 700 }}>RM {Number(req.paid_amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {(req.invoice_url || req.after_image_url) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {req.invoice_url && (
                  <a href={req.invoice_url} target="_blank" rel="noreferrer">
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🧾 الفاتورة</div>
                    <img src={req.invoice_url} alt="الفاتورة" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, border: `1px solid ${S.border}` }} />
                  </a>
                )}
                {req.after_image_url && (
                  <a href={req.after_image_url} target="_blank" rel="noreferrer">
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>📷 بعد الصيانة</div>
                    <img src={req.after_image_url} alt="بعد الصيانة" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, border: `1px solid ${S.border}` }} />
                  </a>
                )}
              </div>
            )}
            {followups.length > 0 && (
              <div style={{ background: S.card, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>📋 سجل المتابعات</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {followups.map(f => (
                    <div key={f.id} style={{ borderRight: `2px solid ${S.blue}40`, paddingRight: 8 }}>
                      <div style={{ fontSize: 12, color: S.white }}>{f.note}</div>
                      <div style={{ fontSize: 10, color: S.muted }}>{f.created_by_name ? `${f.created_by_name} — ` : ''}{fmtDate(f.created_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={reopen} disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
              ↩️ إعادة فتح الطلب
            </button>
          </div>
        )}

        {/* حذف الطلب — للأدمن فقط، أسفل النافذة ومفصول تمامًا عن زر الإغلاق (✕) */}
        {isAdmin && (
          <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 18, paddingTop: 14 }}>
            <button onClick={deleteRequest} disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.red}40`, background: 'transparent', color: S.red, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              🗑️ حذف طلب الصيانة نهائيًا
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══ Modal: مهمة صيانة دورية (إضافة/تعديل) ══
function PeriodicModal({ task, branches, employees, currentEmployee, isAdmin, onClose, onSaved }: {
  task?: PeriodicTask | null; branches: Branch[]; employees: Employee[]; currentEmployee: any
  isAdmin: boolean; onClose: () => void; onSaved: () => void
}) {
  const sb = useRef(createClient()).current
  const myBranchId = employeeBranchId(currentEmployee)
  const [branchId, setBranchId] = useState(task?.branch_id || myBranchId || '')
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [intervalDays, setIntervalDays] = useState(task?.interval_days || 30)
  const [customInterval, setCustomInterval] = useState(!INTERVAL_PRESETS.some(p => p.days === (task?.interval_days || 30)))
  const [nextDue, setNextDue] = useState(task?.next_due_at || todayISO())
  const [assignedIds, setAssignedIds] = useState<string[]>(task?.assigned_to_ids || [])
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) { alert('يرجى كتابة عنوان المهمة'); return }
    if (!branchId) { alert('يرجى اختيار الفرع'); return }
    if (!nextDue) { alert('يرجى تحديد أول موعد استحقاق'); return }
    setSaving(true)
    const names = employees.filter(e => assignedIds.includes(e.id)).map(fullEmployeeName).join('، ') || null
    const payload = {
      branch_id: branchId, title: title.trim(), description: description.trim() || null,
      interval_days: intervalDays, next_due_at: nextDue,
      assigned_to_ids: assignedIds, assigned_to_names: names,
      updated_at: new Date().toISOString(),
    }
    const res = task
      ? await sb.from('maintenance_periodic_tasks').update(payload).eq('id', task.id)
      : await sb.from('maintenance_periodic_tasks').insert([{ ...payload, is_active: true }])
    setSaving(false)
    if (res.error) { alert('خطأ: ' + res.error.message); return }
    const newlyAdded = assignedIds.filter(id => !(task?.assigned_to_ids || []).includes(id))
    await notifyEmployees(sb, newlyAdded, '🗓️ صيانة دورية',
      `تم تعيينك على مهمة صيانة دورية: ${title.trim()}${branches.find(b => b.id === branchId)?.name ? ` — فرع ${branches.find(b => b.id === branchId)!.name}` : ''}`)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 460, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.purple }}>🗓️ {task ? 'تعديل مهمة دورية' : 'مهمة صيانة دورية جديدة'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الفرع *</label>
            <select style={inp} value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">اختر الفرع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>عنوان المهمة *</label>
            <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: تنظيف فلاتر المكيفات" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>تفاصيل / خطوات</label>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="اختياري..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>التكرار *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {INTERVAL_PRESETS.map(p => (
                <button key={p.days} onClick={() => { setIntervalDays(p.days); setCustomInterval(false) }}
                  style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${!customInterval && intervalDays === p.days ? S.purple : S.border}`, background: !customInterval && intervalDays === p.days ? S.purpleB : 'transparent', color: !customInterval && intervalDays === p.days ? S.purple : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {p.label}
                </button>
              ))}
              <button onClick={() => setCustomInterval(true)}
                style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${customInterval ? S.purple : S.border}`, background: customInterval ? S.purpleB : 'transparent', color: customInterval ? S.purple : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                مخصص
              </button>
            </div>
            {customInterval && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: S.muted }}>كل</span>
                <input type="number" min={1} style={{ ...inp, width: 90 }} value={intervalDays} onChange={e => setIntervalDays(Math.max(1, parseInt(e.target.value) || 1))} />
                <span style={{ fontSize: 12, color: S.muted }}>يوم</span>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>أول موعد استحقاق *</label>
            <input type="date" style={inp} value={nextDue} onChange={e => setNextDue(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>👷‍♂️ الفنيون المسؤولون (تصلهم إشعارات)</label>
            <EmployeePicker employees={employees} selectedIds={assignedIds} onChange={setAssignedIds} />
          </div>
          <button onClick={save} disabled={saving}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, marginTop: 6 }}>
            {saving ? '⏳ جارٍ الحفظ...' : task ? '💾 حفظ التعديلات' : '➕ إضافة المهمة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Modal: تفاصيل مهمة الصيانة الدورية ══
function PeriodicDetailModal({ task, isAdmin, currentEmployee, onClose, onUpdate, onEdit, onDeleted }: {
  task: PeriodicTask; isAdmin: boolean; currentEmployee: any
  onClose: () => void; onUpdate: () => void; onEdit: () => void; onDeleted: () => void
}) {
  const sb = useRef(createClient()).current
  const [logs, setLogs] = useState<PeriodicLog[]>([])
  const [performedAt, setPerformedAt] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const due = dueStatus(task.next_due_at)

  useEffect(() => {
    let alive = true
    sb.from('maintenance_periodic_logs').select('*').eq('task_id', task.id).order('performed_at', { ascending: false })
      .then(({ data }) => { if (alive) setLogs((data as PeriodicLog[]) || []) })
    return () => { alive = false }
  }, [sb, task.id])

  async function registerRun() {
    if (!performedAt) { alert('يرجى تحديد تاريخ التنفيذ'); return }
    setSaving(true)
    const { data, error } = await sb.from('maintenance_periodic_logs').insert([{
      task_id: task.id, performed_at: performedAt, note: note.trim() || null,
      performed_by_id: currentEmployee?.id || null,
      performed_by_name: fullEmployeeName(currentEmployee) || null,
    }]).select()
    if (error) { setSaving(false); alert('خطأ: ' + error.message); return }
    const { error: upErr } = await sb.from('maintenance_periodic_tasks').update({
      last_done_at: performedAt,
      next_due_at: addDays(performedAt, task.interval_days),
      updated_at: new Date().toISOString(),
    }).eq('id', task.id)
    setSaving(false)
    if (upErr) { alert('خطأ: ' + upErr.message); return }
    if (data && data[0]) setLogs(prev => [data[0] as PeriodicLog, ...prev])
    setNote('')
    onUpdate()
  }

  async function toggleActive() {
    setSaving(true)
    const { error } = await sb.from('maintenance_periodic_tasks').update({ is_active: !task.is_active, updated_at: new Date().toISOString() }).eq('id', task.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onUpdate()
  }

  async function deleteTask() {
    if (!isAdmin) return
    if (!confirm(`حذف مهمة الصيانة الدورية "${task.title}" نهائيًا؟`)) return
    setSaving(true)
    const { error } = await sb.from('maintenance_periodic_tasks').delete().eq('id', task.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onDeleted()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.purple }}>🗓️ {task.title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ padding: '5px 12px', borderRadius: 999, background: due.bg, color: due.color, fontSize: 12, fontWeight: 700 }}>{due.label}</span>
          <span style={{ padding: '5px 12px', borderRadius: 999, background: S.card2, color: S.muted, fontSize: 12, fontWeight: 700 }}>🔁 {intervalLabel(task.interval_days)}</span>
          {!task.is_active && <span style={{ padding: '5px 12px', borderRadius: 999, background: S.redB, color: S.red, fontSize: 12, fontWeight: 700 }}>موقوفة</span>}
        </div>

        {task.description && (
          <div style={{ background: S.card, borderRadius: 10, padding: 12, fontSize: 13, color: S.white, marginBottom: 14 }}>📝 {task.description}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12 }}>
          <div><span style={{ color: S.muted }}>🏪 الفرع: </span><span style={{ color: S.white, fontWeight: 700 }}>{task.branches?.name || '—'}</span></div>
          <div><span style={{ color: S.muted }}>👷‍♂️ الفنيون: </span><span style={{ color: S.white, fontWeight: 700 }}>{task.assigned_to_names || '— لم يُعيَّن'}</span></div>
          <div><span style={{ color: S.muted }}>📅 موعد الاستحقاق: </span><span style={{ color: S.white }}>{fmtDay(task.next_due_at)}</span></div>
          <div><span style={{ color: S.muted }}>✅ آخر تنفيذ: </span><span style={{ color: S.white }}>{fmtDay(task.last_done_at)}</span></div>
        </div>

        <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>📋 تسجيل تنفيذ</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input type="date" style={{ ...inp, width: 160 }} value={performedAt} onChange={e => setPerformedAt(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inp, flex: 1 }} value={note} onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !saving) registerRun() }}
              placeholder="ملاحظة (اختياري)" />
            <button onClick={registerRun} disabled={saving}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              ✅ تسجيل
            </button>
          </div>
          <div style={{ fontSize: 10, color: S.muted, marginTop: 6 }}>
            سيُحدَّث موعد الاستحقاق القادم تلقائيًا إلى {fmtDay(addDays(performedAt || todayISO(), task.interval_days))}
          </div>
        </div>

        {logs.length > 0 && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>🗂️ سجل التنفيذ ({logs.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map(l => (
                <div key={l.id} style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 12, color: S.white, fontWeight: 700 }}>✅ {fmtDay(l.performed_at)}</div>
                  {l.note && <div style={{ fontSize: 12, color: S.white, marginTop: 3, lineHeight: 1.6 }}>{l.note}</div>}
                  <div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>{l.performed_by_name ? `${l.performed_by_name} — ` : ''}{fmtDate(l.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onEdit} disabled={saving}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ✏️ تعديل
          </button>
          <button onClick={toggleActive} disabled={saving}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {task.is_active ? '⏸️ إيقاف' : '▶️ تفعيل'}
          </button>
        </div>

        {isAdmin && (
          <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 16, paddingTop: 14 }}>
            <button onClick={deleteTask} disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.red}40`, background: 'transparent', color: S.red, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              🗑️ حذف المهمة الدورية نهائيًا
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══ Card: طلب صيانة ══
function MaintenanceCard({ req, onOpen }: { req: MaintenanceRequest; onOpen: () => void }) {
  const status = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
  return (
    <div onClick={onOpen} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{ width: '100%', height: 140, background: S.navy3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {req.image_url
          ? <img src={req.image_url} alt={req.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 40, opacity: 0.3 }}>🔧</span>}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>{req.item_name}</div>
          <span style={{ padding: '3px 9px', borderRadius: 999, background: status.bg, color: status.color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{status.label}</span>
        </div>
        <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🏪 {req.branches?.name || '—'}</div>
        <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>👷 طلب بواسطة: {requesterLabel(req)}</div>
        <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>👷‍♂️ الفني: {req.assigned_to || '— لم يُعيَّن بعد'}</div>
        <div style={{ fontSize: 10, color: S.muted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}` }}>🔄 آخر تحديث: {fmtDate(req.updated_at)}</div>
        {req.last_followup_at && <div style={{ fontSize: 10, color: S.blue, marginTop: 3 }}>📋 آخر متابعة: {fmtDate(req.last_followup_at)}</div>}
      </div>
    </div>
  )
}

// ══ Card: مهمة صيانة دورية ══
function PeriodicCard({ task, onOpen }: { task: PeriodicTask; onOpen: () => void }) {
  const due = dueStatus(task.next_due_at)
  return (
    <div onClick={onOpen} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${task.is_active ? S.border : S.red + '30'}`, padding: 16, cursor: 'pointer', opacity: task.is_active ? 1 : 0.6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: S.white }}>🗓️ {task.title}</div>
        <span style={{ padding: '3px 9px', borderRadius: 999, background: due.bg, color: due.color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{due.label}</span>
      </div>
      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🏪 {task.branches?.name || '—'}</div>
      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🔁 {intervalLabel(task.interval_days)} — 📅 {fmtDay(task.next_due_at)}</div>
      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>👷‍♂️ {task.assigned_to_names || '— لم يُعيَّن'}</div>
      <div style={{ fontSize: 10, color: S.muted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}` }}>✅ آخر تنفيذ: {fmtDay(task.last_done_at)}</div>
    </div>
  )
}

// ══ Main Page ══
export default function MaintenancePage() {
  const sb = createClient()
  const { employee, permissions } = useAuth() as any
  const isAdmin = permissions?.all === true

  const [section, setSection] = useState<'requests' | 'periodic'>('requests')

  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [periodic, setPeriodic] = useState<PeriodicTask[]>([])
  const [periodicUnavailable, setPeriodicUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [branchFilter, setBranchFilter] = useState('')
  const [search, setSearch] = useState('')

  const [showNew, setShowNew] = useState(false)
  const [openReqId, setOpenReqId] = useState<string | null>(null)
  const openReq = requests.find(r => r.id === openReqId) || null

  const [showPeriodicModal, setShowPeriodicModal] = useState(false)
  const [editingPeriodic, setEditingPeriodic] = useState<PeriodicTask | null>(null)
  const [openPeriodicId, setOpenPeriodicId] = useState<string | null>(null)
  const openPeriodic = periodic.find(t => t.id === openPeriodicId) || null

  async function fetchAll() {
    setLoading(true)
    const [branchesRes, requestsRes, employeesRes] = await Promise.all([
      sb.from('branches').select('id, name').order('name'),
      sb.from('maintenance_requests').select('*, branches(name)').order('created_at', { ascending: false }),
      sb.from('employees').select('id, name, name_en, role, department, branch_id').eq('is_active', true).order('name'),
    ])
    setBranches(branchesRes.data || [])
    setEmployees((employeesRes.data as Employee[]) || [])
    // ✅ أي مستخدم لديه صلاحية دخول صفحة الصيانة يرى ويختار كل الفروع (لم تعد مقيّدة بفرعه)
    setRequests((requestsRes.data || []) as MaintenanceRequest[])
    await fetchPeriodic()
    setLoading(false)
  }

  async function fetchPeriodic() {
    const { data, error } = await sb.from('maintenance_periodic_tasks')
      .select('*, branches(name)').order('next_due_at', { ascending: true })
    if (error) { setPeriodicUnavailable(true); setPeriodic([]); return }
    setPeriodicUnavailable(false)
    setPeriodic((data || []) as PeriodicTask[])
  }

  useEffect(() => { if (employee) fetchAll() }, [employee?.id])
  // ✅ إعادة محاولة تحميل الصيانة الدورية عند فتح تبويبها — يعالج الحالة اللي اتحمّلت فيها الصفحة قبل تفعيل الجداول
  useEffect(() => { if (employee && section === 'periodic') fetchPeriodic() }, [section])

  const filtered = requests.filter(r => {
    if (tab !== 'all' && r.status !== tab) return false
    if (branchFilter && r.branch_id !== branchFilter) return false
    if (!matchesSearch(r.item_name, search) && !matchesSearch(r.requested_by, search) && !matchesSearch(r.assigned_to, search) && !matchesSearch(r.requested_by_number, search) && !matchesSearch(r.requested_by_department, search)) return false
    return true
  })

  const periodicFiltered = periodic.filter(t => {
    if (branchFilter && t.branch_id !== branchFilter) return false
    if (!matchesSearch(t.title, search) && !matchesSearch(t.assigned_to_names, search) && !matchesSearch(t.description, search)) return false
    return true
  })

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  }
  const periodicOverdue = periodic.filter(t => t.is_active && daysUntil(t.next_due_at) < 0).length

  const SECTIONS = [
    { id: 'requests' as const, label: '🔧 صيانة المعدات والماكينات', badge: counts.pending || null },
    { id: 'periodic' as const, label: '🗓️ الصيانة الدورية', badge: periodicOverdue || null },
  ]

  return (
    <div style={{ minHeight: '100vh', background: S.navy, padding: 20, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
      <style>{`select option{background:#0F2040;color:#F5F7FA}`}</style>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, display: 'flex', alignItems: 'center', gap: 8 }}>🔧 الصيانة</h1>
        <p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>إدارة الصيانة لكل الفروع</p>
      </div>

      {/* ══ تبويبان كبيران ══ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{
              padding: '14px 22px', borderRadius: 14, cursor: 'pointer',
              border: `1.5px solid ${section === s.id ? S.gold : S.border}`,
              background: section === s.id ? S.gold3 : 'rgba(255,255,255,0.02)',
              color: section === s.id ? S.gold : S.muted,
              fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
            {s.label}
            {s.badge ? <span style={{ background: S.red, color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>{s.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* شريط الإجراءات */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: S.muted }}>
          {section === 'requests' ? `${filtered.length} طلب` : `${periodicFiltered.length} مهمة دورية`}
        </div>
        {section === 'requests' ? (
          <button onClick={() => setShowNew(true)}
            style={{ padding: '11px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            + طلب صيانة جديد
          </button>
        ) : (
          <button onClick={() => { setEditingPeriodic(null); setShowPeriodicModal(true) }}
            style={{ padding: '11px 20px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            + مهمة دورية جديدة
          </button>
        )}
      </div>

      {/* تبويبات الحالة — لقسم الطلبات فقط */}
      {section === 'requests' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'الكل', count: counts.all },
            { id: 'pending', label: '⏳ بانتظار التعيين', count: counts.pending },
            { id: 'in_progress', label: '🔧 جارٍ التنفيذ', count: counts.in_progress },
            { id: 'completed', label: '✅ تم التنفيذ', count: counts.completed },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{
                padding: '9px 16px', borderRadius: 999,
                border: tab === t.id ? `1px solid ${S.gold}` : `1px solid ${S.border}`,
                background: tab === t.id ? S.gold3 : 'transparent',
                color: tab === t.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12,
                fontFamily: 'Tajawal, sans-serif', fontWeight: tab === t.id ? 700 : 400,
              }}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      )}

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, maxWidth: 320 }} value={search} onChange={e => setSearch(e.target.value)}
          placeholder={section === 'requests' ? '🔍 ابحث بالاسم أو مقدّم الطلب أو الفني...' : '🔍 ابحث بعنوان المهمة أو الفني...'} />
        <select style={{ ...inp, maxWidth: 220 }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="">كل الفروع</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* المحتوى */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جارٍ التحميل...</div>
      ) : section === 'requests' ? (
        filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا توجد طلبات صيانة{tab !== 'all' ? ' في هذا التصنيف' : ''}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {filtered.map(r => <MaintenanceCard key={r.id} req={r} onOpen={() => setOpenReqId(r.id)} />)}
          </div>
        )
      ) : periodicUnavailable ? (
        <div style={{ textAlign: 'center', padding: 50, color: S.muted, background: S.card, borderRadius: 14, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
          <div style={{ color: S.white, fontWeight: 700, marginBottom: 6 }}>ميزة الصيانة الدورية غير مُفعَّلة بعد</div>
          <div style={{ fontSize: 12 }}>يلزم تشغيل ملف <code>db/maintenance_upgrade.sql</code> في قاعدة البيانات مرة واحدة لتفعيلها.</div>
        </div>
      ) : periodicFiltered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا توجد مهام صيانة دورية</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {periodicFiltered.map(t => <PeriodicCard key={t.id} task={t} onOpen={() => setOpenPeriodicId(t.id)} />)}
        </div>
      )}

      {showNew && (
        <NewMaintenanceModal branches={branches} currentEmployee={employee} isAdmin={isAdmin}
          onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} />
      )}
      {openReq && (
        <DetailModal req={openReq} employees={employees} currentEmployee={employee} isAdmin={isAdmin}
          onClose={() => setOpenReqId(null)}
          onUpdate={() => fetchAll()}
          onDeleted={() => { setOpenReqId(null); fetchAll() }} />
      )}
      {showPeriodicModal && (
        <PeriodicModal task={editingPeriodic} branches={branches} employees={employees} currentEmployee={employee} isAdmin={isAdmin}
          onClose={() => { setShowPeriodicModal(false); setEditingPeriodic(null) }}
          onSaved={() => { setShowPeriodicModal(false); setEditingPeriodic(null); fetchPeriodic() }} />
      )}
      {openPeriodic && !showPeriodicModal && (
        <PeriodicDetailModal task={openPeriodic} isAdmin={isAdmin} currentEmployee={employee}
          onClose={() => setOpenPeriodicId(null)}
          onUpdate={() => fetchPeriodic()}
          onEdit={() => { setEditingPeriodic(openPeriodic); setShowPeriodicModal(true) }}
          onDeleted={() => { setOpenPeriodicId(null); fetchPeriodic() }} />
      )}
    </div>
  )
}
