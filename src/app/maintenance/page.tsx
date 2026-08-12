'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../components/AuthProvider'

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
}

// ⚠️ لو اسم عمود فرع الموظف في جدول employees مختلف عن branch_id، غيّر السطر ده بس
function employeeBranchId(e: any): string {
  return e?.branch_id || ''
}

// ⚠️ لو عندك دالة صلاحيات إدارة مركزية، استبدل هذا الشرط بيها. حاليًا: الأدمن بس يشوف كل الفروع
const ADMIN_ROLES = ['admin', 'general_manager', 'super_admin']

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
interface MaintenanceRequest {
  id: string; branch_id: string; item_name: string; description: string | null
  image_url: string | null; status: string
  requested_by: string; assigned_to: string | null
  last_followup_at: string | null; last_followup_note: string | null
  completed_at: string | null; created_at: string; updated_at: string
  branches?: { name: string }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '⏳ بانتظار التعيين', color: S.amber, bg: S.amberB },
  in_progress: { label: '🔧 جارٍ التنفيذ', color: S.blue, bg: S.blueB },
  completed: { label: '✅ تم التنفيذ', color: S.green, bg: S.greenB },
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const inp: React.CSSProperties = {
  width: '100%', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10,
  padding: '10px 12px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
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
            {isAdmin ? (
              <select style={inp} value={branchId} onChange={e => setBranchId(e.target.value)}>
                <option value="">اختر الفرع</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : (
              <div style={{ ...inp, color: S.muted }}>{branches.find(b => b.id === myBranchId)?.name || '—'}</div>
            )}
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
function DetailModal({ req, currentEmployee, onClose, onUpdate }: {
  req: MaintenanceRequest; currentEmployee: any; onClose: () => void; onUpdate: () => void
}) {
  const sb = createClient()
  const [assignedTo, setAssignedTo] = useState(req.assigned_to || '')
  const [followupNote, setFollowupNote] = useState('')
  const [saving, setSaving] = useState(false)
  const status = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending

  async function saveAssignment() {
    if (!assignedTo.trim()) { alert('يرجى كتابة اسم فني الصيانة'); return }
    setSaving(true)
    const { error } = await sb.from('maintenance_requests').update({
      assigned_to: assignedTo.trim(),
      status: req.status === 'pending' ? 'in_progress' : req.status,
    }).eq('id', req.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onUpdate()
  }

  async function addFollowup() {
    if (!followupNote.trim()) { alert('يرجى كتابة ملاحظة المتابعة'); return }
    setSaving(true)
    const { error } = await sb.from('maintenance_requests').update({
      last_followup_at: new Date().toISOString(), last_followup_note: followupNote.trim(),
    }).eq('id', req.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    setFollowupNote('')
    onUpdate()
  }

  async function markCompleted() {
    if (!confirm('تأكيد إتمام الصيانة؟')) return
    setSaving(true)
    const { error } = await sb.from('maintenance_requests').update({
      status: 'completed', completed_at: new Date().toISOString(),
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>🔧 {req.item_name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
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
          <div><span style={{ color: S.muted }}>👷 طلب بواسطة: </span><span style={{ color: S.white, fontWeight: 700 }}>{req.requested_by}</span></div>
          <div><span style={{ color: S.muted }}>🕐 تاريخ الطلب: </span><span style={{ color: S.white }}>{fmtDate(req.created_at)}</span></div>
          <div><span style={{ color: S.muted }}>🔄 آخر تحديث: </span><span style={{ color: S.white }}>{fmtDate(req.updated_at)}</span></div>
        </div>

        {req.last_followup_at && (
          <div style={{ background: S.blueB, border: `1px solid ${S.blue}40`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12 }}>
            <div style={{ color: S.blue, fontWeight: 700, marginBottom: 4 }}>📋 آخر متابعة — {fmtDate(req.last_followup_at)}</div>
            <div style={{ color: S.white }}>{req.last_followup_note}</div>
          </div>
        )}

        {req.status !== 'completed' && (
          <>
            <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>👷‍♂️ فني الصيانة المسؤول</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inp, flex: 1 }} value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="اسم الفني..." />
                <button onClick={saveAssignment} disabled={saving}
                  style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  💾 حفظ
                </button>
              </div>
            </div>

            <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>📋 تسجيل متابعة جديدة</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inp, flex: 1 }} value={followupNote} onChange={e => setFollowupNote(e.target.value)} placeholder="مثال: تم طلب قطعة الغيار وبانتظار وصولها" />
                <button onClick={addFollowup} disabled={saving}
                  style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  💾 حفظ
                </button>
              </div>
            </div>

            <button onClick={markCompleted} disabled={saving}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              ✅ تم تنفيذ الصيانة
            </button>
          </>
        )}

        {req.status === 'completed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: S.muted }}>✅ تم الإتمام في: {fmtDate(req.completed_at)}</div>
            <button onClick={reopen} disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
              ↩️ إعادة فتح الطلب
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══ Card ══
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
        <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>👷 طلب بواسطة: {req.requested_by}</div>
        <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>👷‍♂️ الفني: {req.assigned_to || '— لم يُعيَّن بعد'}</div>
        <div style={{ fontSize: 10, color: S.muted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}` }}>🔄 آخر تحديث: {fmtDate(req.updated_at)}</div>
        {req.last_followup_at && <div style={{ fontSize: 10, color: S.blue, marginTop: 3 }}>📋 آخر متابعة: {fmtDate(req.last_followup_at)}</div>}
      </div>
    </div>
  )
}

// ══ Main Page ══
export default function MaintenancePage() {
  const sb = createClient()
  const { employee } = useAuth() as any
  const role = employee?.role || ''
  const isAdmin = ADMIN_ROLES.includes(role)
  const myBranchId = employeeBranchId(employee)

  const [branches, setBranches] = useState<Branch[]>([])
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [branchFilter, setBranchFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [openReq, setOpenReq] = useState<MaintenanceRequest | null>(null)

  async function fetchAll() {
    setLoading(true)
    const [branchesRes, requestsRes] = await Promise.all([
      sb.from('branches').select('id, name').order('name'),
      sb.from('maintenance_requests')
        .select('*, branches(name)')
        // ✅ الفلترة الأساسية: كل فرع يشوف صيانة فرعه بس، والأدمن يشوف كل الفروع
        .order('created_at', { ascending: false }),
    ])
    setBranches(branchesRes.data || [])
    let rows = requestsRes.data || []
    if (!isAdmin && myBranchId) rows = rows.filter((r: any) => r.branch_id === myBranchId)
    setRequests(rows as MaintenanceRequest[])
    setLoading(false)
  }

  useEffect(() => { if (employee) fetchAll() }, [employee?.id])

  const filtered = requests.filter(r => {
    if (tab !== 'all' && r.status !== tab) return false
    if (isAdmin && branchFilter && r.branch_id !== branchFilter) return false
    if (!matchesSearch(r.item_name, search) && !matchesSearch(r.requested_by, search) && !matchesSearch(r.assigned_to, search)) return false
    return true
  })

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: S.navy, padding: 20, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, display: 'flex', alignItems: 'center', gap: 8 }}>🔧 الصيانة</h1>
          <p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{isAdmin ? 'عرض طلبات الصيانة لكل الفروع' : 'طلبات صيانة فرعك'}</p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ padding: '11px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          + طلب صيانة جديد
        </button>
      </div>

      {/* Tabs */}
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, maxWidth: 320 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ابحث بالاسم أو مقدّم الطلب أو الفني..." />
        {isAdmin && (
          <select style={{ ...inp, maxWidth: 220 }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="">كل الفروع</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا توجد طلبات صيانة{tab !== 'all' ? ' في هذا التصنيف' : ''}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map(r => <MaintenanceCard key={r.id} req={r} onOpen={() => setOpenReq(r)} />)}
        </div>
      )}

      {showNew && (
        <NewMaintenanceModal branches={branches} currentEmployee={employee} isAdmin={isAdmin}
          onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} />
      )}
      {openReq && (
        <DetailModal req={openReq} currentEmployee={employee}
          onClose={() => setOpenReq(null)} onUpdate={() => { fetchAll(); setOpenReq(null) }} />
      )}
    </div>
  )
}
