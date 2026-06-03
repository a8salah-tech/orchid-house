'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'
import { useLang } from '../../../components/LanguageContext'

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
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

export default function ViolationsPage() {
  const sb = createClient()
  const { employee, permissions } = useAuth()
  const { isAr } = useLang()
  const isAdmin = permissions?.all === true
  const role = employee?.role || ''
  const isBranchManager = role === 'branch_manager'
  const isDeptManager = ['kitchen_manager','hall_manager','bar_manager'].includes(role)
  const canAdd = isAdmin || isBranchManager || isDeptManager || permissions?.violations === true

  const [violations, setViolations] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filterEmp, setFilterEmp] = useState('all')
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20
  const [form, setForm] = useState({ employee_id: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] })
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentUrl, setAttachmentUrl] = useState('')

  async function fetchAll() {
    setLoading(true)
    // جيب الموظفين
    let empQ = sb.from('employees').select('id,name,name_en,department,role,branch_id').eq('is_active', true).order('name')
    if (!isAdmin) {
      if (isBranchManager) empQ = empQ.eq('branch_id', employee?.branch_id || '')
      else if (role === 'kitchen_manager') empQ = empQ.in('department', ['المطبخ','Kitchen','البار','Bar','الحلويات'])
      else if (role === 'hall_manager') empQ = empQ.in('department', ['الصالة','Hall'])
      else if (role === 'bar_manager') empQ = empQ.in('department', ['البار','Bar'])
    }
    const { data: empData } = await empQ
    setEmployees(empData || [])

    // جيب المخالفات — فلتر حسب قسم المدير
    const [year, month] = filterMonth.split('-').map(Number)
    const monthStart = new Date(year, month-1, 1).toISOString().split('T')[0]
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]
    // فلتر المخالفات حسب الموظفين المسموح لهم
    let vQ = sb.from('violations')
      .select('*')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('created_at', { ascending: false })

    // مدير القسم يشوف مخالفات قسمه فقط
    if (!isAdmin && !isBranchManager && isDeptManager) {
      const empIds = (empData || []).map((e: any) => e.id)
      if (empIds.length > 0) vQ = vQ.in('employee_id', empIds)
    } else if (isBranchManager) {
      const empIds = (empData || []).map((e: any) => e.id)
      if (empIds.length > 0) vQ = vQ.in('employee_id', empIds)
    }

    const { data: vData, error } = await vQ

    if (error) { console.error('violations error:', error.message); setLoading(false); return }

    // جيب أسماء الموظفين يدوياً
    if (vData && vData.length > 0) {
      const empIds = [...new Set(vData.map(v => v.employee_id).concat(vData.map(v => v.created_by)).filter(Boolean))]
      const { data: empNames } = await sb.from('employees').select('id,name,name_en,department').in('id', empIds)
      const empMap = Object.fromEntries((empNames || []).map(e => [e.id, e]))
      setViolations(vData.map(v => ({
        ...v,
        empName: empMap[v.employee_id]?.name || '—',
        empNameEn: empMap[v.employee_id]?.name_en || '',
        empDept: empMap[v.employee_id]?.department || '',
        creatorName: empMap[v.created_by]?.name || '—',
      })))
    } else {
      setViolations([])
    }
    setLoading(false)
  }

  useEffect(() => { if (employee?.id) { setPage(0); fetchAll() } }, [employee?.id, filterMonth])

  async function save() {
    if (!form.employee_id || !form.amount || !form.reason) { alert('يرجى إكمال جميع الحقول'); return }
    setSaving(true)

    // رفع المرفق لو موجود
    let finalAttachment = attachmentUrl
    if (attachmentFile) {
      const ext = attachmentFile.name.split('.').pop()
      const path = `violations/${Date.now()}.${ext}`
      const { data: upData } = await sb.storage.from('employees').upload(path, attachmentFile, { upsert: true })
      if (upData) {
        const { data: urlData } = sb.storage.from('employees').getPublicUrl(upData.path)
        finalAttachment = urlData.publicUrl
      }
    }

    const { error } = await sb.from('violations').insert([{
      employee_id: form.employee_id,
      amount: parseFloat(form.amount),
      reason: form.reason,
      date: form.date,
      created_by: employee?.id,
      status: 'active',
      attachment_url: finalAttachment || null,
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    setShowAdd(false)
    setForm({ employee_id: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] })
    setAttachmentFile(null)
    setAttachmentUrl('')
    fetchAll()
  }

  async function cancelViolation(id: string) {
    if (!confirm('إلغاء هذه المخالفة؟')) return
    await sb.from('violations').update({ status: 'cancelled' }).eq('id', id)
    fetchAll()
  }

  if (employee && !canAdd) return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>غير مصرح بالوصول</div>
    </div>
  )

  const filtered = violations.filter(v => filterEmp === 'all' || v.employee_id === filterEmp)
  const totalAmount = filtered.filter(v => v.status === 'active').reduce((s, v) => s + (v.amount || 0), 0)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>⚠️ {isAr ? 'المخالفات' : 'Violations'}</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'إدارة مخالفات الموظفين' : 'Manage employee violations'}</p>
        </div>
        {canAdd && (
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ➕ {isAr ? 'إضافة مخالفة' : 'Add Violation'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: isAr ? 'إجمالي المخالفات' : 'Total', value: filtered.length, color: S.red, bg: S.redB },
          { label: isAr ? 'إجمالي الخصم' : 'Total Deductions', value: `MYR ${totalAmount.toFixed(2)}`, color: S.amber, bg: S.amberB },
          { label: isAr ? 'نشطة' : 'Active', value: filtered.filter(v => v.status === 'active').length, color: S.green, bg: S.greenB },
          { label: isAr ? 'ملغاة' : 'Cancelled', value: filtered.filter(v => v.status === 'cancelled').length, color: S.muted, bg: S.card },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: 'auto' }} type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        <select style={{ ...inp, width: 'auto', minWidth: 160, cursor: 'pointer', background: S.navy2 }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="all">{isAr ? 'كل الموظفين' : 'All Employees'}</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.name_en || ''}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ color: S.muted }}>{isAr ? 'لا توجد مخالفات في هذه الفترة' : 'No violations in this period'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paginated.map(v => (
            <div key={v.id} style={{ background: v.status === 'cancelled' ? S.card : S.navy2, borderRadius: 14, border: `1px solid ${v.status === 'cancelled' ? S.border : S.red+'30'}`, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, opacity: v.status === 'cancelled' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: S.redB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>{v.empName} {v.empNameEn} — {v.empDept}</div>
                  <div style={{ fontSize: 12, color: S.muted, marginBottom: 4 }}>{v.reason}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>📅 {v.date} · {isAr ? 'بواسطة' : 'by'}: {v.creatorName}</div>
                  {v.attachment_url && (
                    <div style={{ marginTop: 8 }}>
                      {v.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={v.attachment_url} alt="مرفق" style={{ maxWidth: 200, maxHeight: 120, borderRadius: 8, border: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => window.open(v.attachment_url, '_blank')} />
                      ) : (
                        <a href={v.attachment_url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: S.blue, display: 'inline-flex', alignItems: 'center', gap: 4, background: S.blueB, borderRadius: 8, padding: '4px 10px' }}>
                          📎 {isAr ? 'عرض المرفق' : 'View Attachment'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: v.status === 'cancelled' ? S.muted : S.red }}>MYR {(v.amount || 0).toFixed(2)}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: v.status === 'active' ? S.red : S.muted, background: v.status === 'active' ? S.redB : S.card, borderRadius: 20, padding: '2px 10px' }}>
                    {v.status === 'active' ? (isAr ? 'نشطة' : 'Active') : (isAr ? 'ملغاة' : 'Cancelled')}
                  </span>
                </div>
                {isAdmin && v.status === 'active' && (
                  <button onClick={() => cancelViolation(v.id)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: page === 0 ? 'transparent' : S.card2, color: page === 0 ? S.muted : S.white, cursor: page === 0 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
            {isAr ? '← السابق' : '← Prev'}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i).map(i => (
            <button key={i} onClick={() => setPage(i)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${i === page ? S.gold : S.border}`, background: i === page ? S.gold3 : 'transparent', color: i === page ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: i === page ? 800 : 400 }}>
              {i + 1}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: page >= totalPages-1 ? 'transparent' : S.card2, color: page >= totalPages-1 ? S.muted : S.white, cursor: page >= totalPages-1 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
            {isAr ? 'التالي →' : 'Next →'}
          </button>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.red}40`, width: '100%', maxWidth: 480, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ color: S.red, fontSize: 17, fontWeight: 800 }}>⚠️ {isAr ? 'إضافة مخالفة' : 'Add Violation'}</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'الموظف *' : 'Employee *'}</label>
                <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
                  <option value="">{isAr ? '-- اختر الموظف --' : '-- Select Employee --'}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.name_en || ''} — {e.department || e.role}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'المبلغ (MYR) *' : 'Amount (MYR) *'}</label>
                  <input style={{ ...inp, direction: 'ltr' }} type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'التاريخ *' : 'Date *'}</label>
                  <input style={inp} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'سبب المخالفة *' : 'Reason *'}</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'none' } as React.CSSProperties} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder={isAr ? 'اشرح سبب المخالفة...' : 'Explain the violation reason...'} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'مرفق (صورة أو PDF)' : 'Attachment (image or PDF)'}</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                  style={{ ...inp, cursor: 'pointer', fontSize: 12 }} />
                {attachmentFile && <div style={{ fontSize: 11, color: S.green, marginTop: 4 }}>✅ {attachmentFile.name}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳' : (isAr ? '⚠️ إضافة المخالفة' : '⚠️ Add Violation')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
