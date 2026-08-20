'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'
import { useLang } from '../../components/LanguageContext'

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
  orange: '#F97316', orangeB: 'rgba(249,115,22,0.12)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const DEPARTMENTS = ['المطبخ', 'البار', 'الصالة', 'الحلويات', 'النظافة', 'الإدارة', 'أخرى']
const SUPERVISOR_ROLES = ['kitchen_supervisor', 'hall_supervisor', 'bar_supervisor']
const MANAGER_ROLES = ['kitchen_manager', 'hall_manager', 'bar_manager']
const SENIOR_ROLES = ['admin', 'branch_manager']
// ✅ أدوار المستودع - أمين المستودع (فرع/عملية) ومدير المستودعات (يشوف ويعالج الفرعين مع بعض)
const WAREHOUSE_ROLES = ['warehouse_keeper', 'warehouse_manager']

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

// ✅ Fix: تطبيع نص البحث العربي — يوحّد أشكال الحروف المختلفة (أ/إ/آ/ا، ة/ه، ى/ي) ويشيل التشكيل والمسافات الزائدة،
// عشان البحث يلاقي الصنف حتى لو المستخدم كتب الهمزة بشكل مختلف عن المخزّن في قاعدة البيانات
// (مثال: مستخدم يكتب "ارز" بينما الصنف مخزّن "أرز" — كان البحث القديم بيفشل في الحالة دي رغم إن النص متطابق منطقيًا)
function normalizeSearchText(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
function matchesSearch(text: string | null | undefined, query: string): boolean {
  if (!query) return true
  return normalizeSearchText(text).includes(normalizeSearchText(query))
}

interface BranchRequest {
  id: string; created_at: string; request_number: number
  branch_id: string; department: string; status: string
  notes?: string; requested_by: string
  manager_approved_by?: string; manager_approved_at?: string
  warehouse_received_by?: string; warehouse_received_at?: string
  supervisor_received_by?: string; supervisor_received_at?: string
  manager_received_by?: string; manager_received_at?: string
  receive_image_url?: string
  branches?: { name: string }
  branch_request_items?: {
    id: string; quantity_requested: number; quantity_approved: number
    quantity_received?: number; quantity_returned?: number
    return_reason?: string; return_image_url?: string; notes?: string
    warehouse_products?: { name: string; name_en?: string }
    units?: { symbol: string }
  }[]
}

// ══ New Request Modal ══
function NewRequestModal({ onClose, onSaved, currentEmployee }: { onClose: () => void; onSaved: () => void; currentEmployee: any }) {
  const sb = createClient()
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [items, setItems] = useState([{ product_id: '', qty: '', unit_id: '', notes: '' }])
  const [search, setSearch] = useState('')
  const [deptProducts, setDeptProducts] = useState<string[]>([])
  const [activeDeptTab, setActiveDeptTab] = useState('المطبخ')
  const [monthlyConsumption, setMonthlyConsumption] = useState<Record<string, number>>({})
  const role = currentEmployee?.role || ''
  const autoDept = role.includes('kitchen') ? 'المطبخ' : role.includes('hall') ? 'الصالة' : role.includes('bar') ? 'البار' : currentEmployee?.department || ''
  const fullName = [currentEmployee?.name, currentEmployee?.name_en].filter(Boolean).join(' ').trim()
  const [form, setForm] = useState({ branch_id: currentEmployee?.branch_id || '', department: autoDept, requested_by: fullName || currentEmployee?.name || '', notes: '' })

  useEffect(() => {
    sb.from('department_products').select('product_id').eq('department', activeDeptTab)
      .then(({ data }) => setDeptProducts((data||[]).map((d:any) => d.product_id)))
  }, [activeDeptTab])

  useEffect(() => {
    // load initial dept products on mount
    sb.from('department_products').select('product_id').eq('department', 'المطبخ')
      .then(({ data }) => setDeptProducts((data||[]).map((d:any) => d.product_id)))
    sb.from('warehouse_products').select('id,name,name_en,product_code,current_stock,units(symbol)').eq('is_active', true)
      .eq('warehouse_id', 'adcb9ca3-56a7-4c9e-94b8-55fec4fcc0a8') // المستودع الرئيسي فقط — منع تكرار الصنف من مستودعات متعددة
      .order('name')
      .then(({ data }) => setProducts(data || []))
    sb.from('units').select('*').order('name').then(({ data }) => setUnits(data || []))
    sb.from('branches').select('*').order('name').then(({ data }) => setBranches(data || []))
    // متوسط الاستهلاك الشهري لكل صنف من حركات الصرف (out) خلال آخر 30 يوم
    const since = new Date(); since.setDate(since.getDate() - 30)
    sb.from('stock_movements').select('product_id, quantity').eq('movement_type', 'out').gte('movement_date', since.toISOString().slice(0,10))
      .then(({ data }) => {
        const totals: Record<string, number> = {}
        for (const m of (data || [])) {
          totals[m.product_id] = (totals[m.product_id] || 0) + (m.quantity || 0)
        }
        setMonthlyConsumption(totals)
      })
  }, [])

  async function save() {
    if (!form.branch_id || !form.department || !form.requested_by) { alert('يرجى إكمال البيانات'); return }
    if (items.some(i => !i.product_id || !i.qty)) { alert('يرجى إكمال الأصناف'); return }
    setSaving(true)
    const { data: req, error } = await sb.from('branch_requests').insert([{ ...form, status: 'pending' }]).select().single()
    if (error) { alert('خطأ: ' + error.message); setSaving(false); return }
    for (const item of items) {
      await sb.from('branch_request_items').insert([{ request_id: req.id, product_id: item.product_id, quantity_requested: parseFloat(item.qty), unit_id: item.unit_id || null, notes: item.notes || null }])
    }
    setSaving(false); onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 680, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>📦 طلب مستلزمات جديد</h2>
            <p style={{ fontSize: 12, color: S.muted }}>سيُرسل الطلب لمدير القسم للاعتماد</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>الفرع *</label>
            <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
              <option value="">-- اختر --</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>القسم *</label>
            <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">-- اختر --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>مقدم الطلب</label>
            <input style={{ ...inp, opacity: 0.7, cursor: 'not-allowed' }} value={form.requested_by} readOnly />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
        </div>
        {/* تابات الأقسام */}
        <div style={{ background: S.navy3, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 12 }}>📦 اختر الأصناف</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {['المطبخ','البار','الصالة'].map(dept => (
              <button key={dept} onClick={() => {
                setActiveDeptTab(dept)
                sb.from('department_products').select('product_id').eq('department', dept)
                  .then(({ data }) => setDeptProducts((data||[]).map((d:any) => d.product_id)))
              }}
                style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${activeDeptTab===dept ? S.gold : S.border}`, background: activeDeptTab===dept ? S.gold3 : 'transparent', color: activeDeptTab===dept ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: activeDeptTab===dept ? 700 : 400 }}>
                {dept==='المطبخ'?'🍳':dept==='البار'?'🍹':'🪑'} {dept}
              </button>
            ))}
          </div>
          <input style={{ ...inp, marginBottom: 12, fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم أو الكود (مثال: OR001)..." />
          {/* ✅ Fix: لو فيه نص بحث، نبحث في كل أصناف المستودع الرئيسي (مش بس أصناف القسم المحدد)
              عشان لو الصنف مش مربوط بالقسم في جدول department_products، البحث برضو يلاقيه.
              من غير نص بحث، نرجع لعرض أصناف القسم بس (تصفح سريع) زي الأصل */}
          {!search && deptProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: S.muted, fontSize: 12 }}>لا توجد أصناف محددة لهذا القسم</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {products.filter(p => (search ? matchesSearch(p.name, search) || matchesSearch(p.name_en, search) || matchesSearch(p.product_code, search) : deptProducts.includes(p.id))).map(p => {
                const isSelected = items.some(it => it.product_id === p.id)
                return (
                  <div key={p.id} onClick={() => {
                    if (isSelected) setItems(prev => prev.filter(it => it.product_id !== p.id))
                    else { const unitId = p.units ? units.find((u:any) => u.symbol === p.units?.symbol)?.id||'' : ''; setItems(prev => [...prev.filter(it => it.product_id !== ''), { product_id: p.id, qty: '', unit_id: unitId, notes: '' }]) }
                  }} style={{ background: isSelected ? S.gold3 : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${isSelected ? S.gold : S.border}`, padding: '10px 12px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ flex: 1 }}>
                        {p.product_code && (
                          <span style={{ display: 'inline-block', background: S.gold3, color: S.gold, borderRadius: 6, padding: '1px 6px', fontSize: 9, fontWeight: 700, fontFamily: 'system-ui', marginBottom: 3 }}>{p.product_code}</span>
                        )}
                        <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? S.gold : S.white }}>{p.name}</div>
                      </div>
                      {isSelected && <span style={{ color: S.gold, fontSize: 13 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 10, color: S.muted }}>📊 استهلاك شهري: {(monthlyConsumption[p.id] || 0).toFixed(0)} {p.units?.symbol}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {items.filter(it => it.product_id).length > 0 && (
          <div style={{ background: S.navy3, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.blue, marginBottom: 12 }}>📋 الأصناف المختارة ({items.filter(it => it.product_id).length})</div>
            {items.map((item, i) => {
              if (!item.product_id) return null
              const prod = products.find(p => p.id === item.product_id)
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.white }}>{prod?.name}</div>
                    <button onClick={() => setItems(p => p.filter((_,idx) => idx!==i))} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input type="number" style={{ ...inp, direction: 'ltr', fontSize: 12 }} value={item.qty} onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, qty: e.target.value } : it))} placeholder="الكمية" />
                    <select style={{ ...inp, cursor: 'pointer', background: S.navy3, fontSize: 12 }} value={item.unit_id} onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, unit_id: e.target.value } : it))}>
                      <option value="">الوحدة</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <input style={{ ...inp, fontSize: 11, marginTop: 6 }} value={item.notes} onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, notes: e.target.value } : it))} placeholder="📝 ملاحظات للصنف..." />
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '📤 إرسال الطلب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Request Card ══
function RequestCard({ req, role, onOpen }: { req: BranchRequest; role: string; onOpen: () => void }) {
  const statusColors: Record<string,{color:string;bg:string;icon:string;label:string}> = {
    pending:              { color: S.amber,  bg: S.amberB,  icon: '⏳', label: 'قيد الانتظار' },
    manager_approved:     { color: S.blue,   bg: S.blueB,   icon: '👨‍💼', label: 'معتمد من مدير القسم' },
    branch_approved:      { color: S.blue,   bg: S.blueB,   icon: '👨‍💼', label: 'معتمد - جاهز للمستودع' },
    warehouse_processing: { color: S.orange, bg: S.orangeB, icon: '🏭', label: 'قيد التجهيز' },
    supervisor_received:  { color: S.green,  bg: S.greenB,  icon: '🎉', label: 'استلم المشرف' },
    // ✅ جديد: حالة "معلّق" - لما يتم استلام جزء من الطلب فقط بسبب نقص كمية في المستودع
    partial:              { color: S.orange, bg: S.orangeB, icon: '⏸️', label: 'معلّق (استلام جزئي)' },
    manager_received:     { color: S.teal,   bg: S.tealB,   icon: '✅', label: 'مكتمل' },
    rejected:             { color: S.red,    bg: S.redB,    icon: '❌', label: 'مرفوض' },
    cancelled:            { color: S.muted,  bg: S.card,    icon: '🚫', label: 'ملغي' },
  }
  const st = statusColors[req.status] || statusColors.pending
  const needsAction =
    ([...MANAGER_ROLES,...SENIOR_ROLES].includes(role) && req.status === 'pending') ||
    (WAREHOUSE_ROLES.includes(role) && ['manager_approved','branch_approved'].includes(req.status)) ||
    ([...SUPERVISOR_ROLES,...MANAGER_ROLES,...SENIOR_ROLES].includes(role) && req.status === 'warehouse_processing')

  return (
    <div onClick={onOpen} style={{ background: needsAction ? 'rgba(245,158,11,0.05)' : S.card2, border: `1px solid ${needsAction ? S.amber+'50' : S.border}`, borderRadius: 14, padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: st.bg, border: `1px solid ${st.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{st.icon}</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: S.white }}>طلب #{req.request_number}</span>
            <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
            {needsAction && <span style={{ background: S.amberB, color: S.amber, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>⚡ يحتاج إجراء</span>}
          </div>
          <div style={{ fontSize: 12, color: S.muted }}>{req.branches?.name} · {req.department} · {req.requested_by}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.blue }}>{req.branch_request_items?.length || 0}</div>
          <div style={{ fontSize: 10, color: S.muted }}>صنف</div>
        </div>
        <div style={{ fontSize: 11, color: S.muted }}>{new Date(req.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</div>
        <div style={{ fontSize: 16, color: S.muted }}>←</div>
      </div>
    </div>
  )
}

// ══ Request Detail Modal ══
function AddItemSearch({ products, editedItems, onAdd }: { products: {id:string;name:string;product_code?:string}[]; editedItems: any[]; onAdd: (p:{id:string;name:string}) => void }) {
  const [search, setSearch] = useState('')
  const available = products.filter(p => !editedItems.some(i => i.product_id === p.id && !i._delete))
  const filtered = available.filter(p => matchesSearch(p.name, search) || matchesSearch(p.product_code, search))
  return (
    <div style={{ position: 'relative' }}>
      <input style={{ ...inp }} placeholder="🔍 ابحث بالاسم أو الكود (مثال: OR001)..." value={search} onChange={e => setSearch(e.target.value)} />
      {search && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: '#0C1A32', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, zIndex: 50, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginTop: 4 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => { onAdd(p); setSearch('') }}
              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: '#FAFAF8', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              {p.product_code && (
                <span style={{ background: 'rgba(201,168,76,0.12)', color: S.gold, borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700, fontFamily: 'system-ui', flexShrink: 0 }}>{p.product_code}</span>
              )}
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      )}
      {search && filtered.length === 0 && (
        <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: '#0C1A32', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, zIndex: 50, padding: '10px 14px', fontSize: 12, color: '#8A9BB5', marginTop: 4 }}>
          لا توجد نتائج
        </div>
      )}
    </div>
  )
}

function RequestDetailModal({ request, currentEmployee, onClose, onUpdate }: { request: BranchRequest; currentEmployee: any; onClose: () => void; onUpdate: () => void }) {
  const sb = createClient()
  const { isAr } = useLang()
  const [updating, setUpdating] = useState(false)
  const actionByFullName = [currentEmployee?.name, currentEmployee?.name_en].filter(Boolean).join(' ').trim() || currentEmployee?.name || ''
  const [actionBy, setActionBy] = useState(actionByFullName)
  const [showReceive, setShowReceive] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [receiveImg, setReceiveImg] = useState<File|null>(null)
  const [receiveImgPreview, setReceiveImgPreview] = useState('')
  const [receiveItems, setReceiveItems] = useState<Record<string,{received:number;returned:number;reason:string;imgFile?:File;imgPreview:string}>>({})
  const [editingItems, setEditingItems] = useState(false)
  const [editedItems, setEditedItems] = useState<{id:string;product_id:string;product_name:string;quantity_requested:number;unit_id:string;unit_symbol:string;_delete?:boolean}[]>([])
  const [deptProducts, setDeptProducts] = useState<{id:string;name:string;product_code?:string}[]>([])
  const [savingItems, setSavingItems] = useState(false)
  const role = currentEmployee?.role || ''
  // ✅ جديد: التحقق من توفر الكمية قبل الاستلام الفعلي + إمكانية استبعاد صنف واحد بعينه من الطلب
  const [shortfalls, setShortfalls] = useState<{ itemId: string; name: string; requestedInBase: number; available: number; unitSymbol: string }[] | null>(null)
  const [cancelledItems, setCancelledItems] = useState<Set<string>>(new Set())

  async function doAction(status: string, extra: Record<string,string> = {}) {
    if (!actionBy.trim()) { alert('يرجى إدخال اسمك'); return }
    setUpdating(true)
    await sb.from('branch_requests').update({ status, ...extra }).eq('id', request.id)
    setUpdating(false); onUpdate()
  }

  async function confirmReceive() {
    if (!actionBy.trim()) { alert('يرجى إدخال اسمك'); return }
    setUpdating(true)
    // المستودع الرئيسي — منه يتم الخصم لحظة تأكيد الفرع استلامه فعليًا
    const MAIN_WAREHOUSE_ID = 'adcb9ca3-56a7-4c9e-94b8-55fec4fcc0a8'

    // ✅ Fix (جذري - مرحلة ١): نتحقق من كل الأصناف أولاً (توفر الكمية + معامل التحويل) من غير أي كتابة أو رفع صور خالص
    // (كل شيء أو ولا حاجة - عشان مانرفعش صور ونحدّث بيانات لأصناف قبل ما نكتشف نقص في صنف تاني)
    const failedItems: string[] = []
    const newShortfalls: { itemId: string; name: string; requestedInBase: number; available: number; unitSymbol: string }[] = []
    const plannedItems: { item: any; ri: any; wp: any; qty: number }[] = []

    for (const item of (request.branch_request_items || [])) {
      // ✅ جديد: تجاهل أي صنف تم استبعاده يدويًا
      if (cancelledItems.has(item.id)) continue

      const ri = receiveItems[item.id] || { received: item.quantity_approved||item.quantity_requested, returned: 0, reason: '', imgPreview: '' }
      // ✅ Fix (نهائي وبسيط): ندور على الصنف بالاسم في مستودع الفرع اللي طالب
      // بدل الاعتماد على product_id المحفوظ (ممكن يكون لفرع تاني)
      const receivedQty = parseFloat(String(ri.received)) || 0
      const productId = (item as any).product_id
      if (receivedQty <= 0 || !productId) { plannedItems.push({ item, ri, wp: null, qty: 0 }); continue }

      // نجيب اسم الصنف الأول
      const { data: srcWp } = await sb.from('warehouse_products')
        .select('name').eq('id', productId).maybeSingle()
      const itemName = srcWp?.name || ''

      // ندور على نسخة الصنف في مستودع الفرع الطالب بالاسم
      const { data: branchWh } = await sb.from('warehouses')
        .select('id').eq('branch_id', request.branch_id).maybeSingle()
      const branchWhId = branchWh?.id

      let wp: any = null
      if (itemName && branchWhId) {
        // ✅ Fix: مطابقة الأسماء بعد تنظيفها من المسافات الزايدة في الطرفين
        // (كان فيه أصناف متسجلة بمسافة زايدة في آخر الاسم، فالمطابقة الدقيقة .ilike كانت بتفشل)
        const { data: candidates } = await sb.from('warehouse_products')
          .select('id, unit_id, warehouse_id, name, current_stock, units(symbol)')
          .eq('warehouse_id', branchWhId)
        wp = (candidates || []).find((c: any) => c.name.trim().toLowerCase() === itemName.trim().toLowerCase()) || null
      }
      // fallback: نسخة المستودع الرئيسي لو الفرع ما عندوش نسخة
      if (!wp) {
        const { data: candidates } = await sb.from('warehouse_products')
          .select('id, unit_id, warehouse_id, name, current_stock, units(symbol)')
          .eq('warehouse_id', MAIN_WAREHOUSE_ID)
        wp = (candidates || []).find((c: any) => c.name.trim().toLowerCase() === itemName.trim().toLowerCase()) || null
      }
      if (!wp) {
        failedItems.push(`${itemName || productId} — لم يتم العثور على هذا الصنف في أي مستودع`)
        continue
      }

      let qty = receivedQty
      const itemUnitId = (item as any).unit_id
      if (itemUnitId && wp.unit_id && itemUnitId !== wp.unit_id) {
        const { data: conv } = await sb.from('unit_conversions')
          .select('from_unit_id, to_unit_id, factor')
          .eq('product_id', wp.id)
          .or(`and(from_unit_id.eq.${itemUnitId},to_unit_id.eq.${wp.unit_id}),and(from_unit_id.eq.${wp.unit_id},to_unit_id.eq.${itemUnitId})`)
          .maybeSingle()
        if (conv) {
          if (conv.from_unit_id === itemUnitId && conv.to_unit_id === wp.unit_id) {
            qty = receivedQty * conv.factor
          } else if (conv.to_unit_id === itemUnitId && conv.from_unit_id === wp.unit_id) {
            qty = receivedQty / conv.factor
          }
        } else {
          // ✅ Fix حرج: لو مفيش معامل تحويل مسجل بأي اتجاه، نوقف خصم الصنف ده تمامًا
          // بدل ما نخصم الرقم الخام غلط (نفس سبب كارثة الموز والبطيخ في طلبات المستودع الداخلي)
          failedItems.push(`${wp.name} — لا يوجد معامل تحويل مسجّل بين الوحدة المطلوبة ووحدة التخزين الأساسية. من فضلك سجّل معامل التحويل أولاً ثم أعد تأكيد الاستلام`)
          continue
        }
      }

      // ✅ جديد: التحقق من توفر الكمية فعليًا في المخزون قبل أي خصم - عشان نتجنب الأرصدة السالبة تمامًا
      if (qty > (wp.current_stock || 0)) {
        newShortfalls.push({
          itemId: item.id, name: wp.name,
          requestedInBase: qty, available: wp.current_stock || 0,
          unitSymbol: wp.units?.symbol || '',
        })
        continue
      }

      plannedItems.push({ item, ri, wp, qty })
    }

    // ✅ Fix (جذري): لو فيه أي صنف فشل، نوقف العملية بالكامل من غير ما نكتب أو نرفع أي حاجة خالص
    if (failedItems.length > 0) {
      setUpdating(false)
      alert('⚠️ تعذّر تأكيد الاستلام بسبب مشاكل في الأصناف التالية:\n\n' + failedItems.join('\n') + '\n\nلم يتم خصم أي كمية ولم يتم تأكيد الاستلام.')
      return
    }

    // ✅ جديد: لو فيه أصناف كميتها غير متاحة بالكامل، نوقف ونعرض تنبيه تفاعلي في المنتصف
    if (newShortfalls.length > 0) {
      setShortfalls(newShortfalls)
      setUpdating(false)
      return
    }

    // ✅ مرحلة ٢: كل الأصناف سليمة - دلوقتي بس نرفع الصور ونحدّث البيانات ونخصم فعليًا
    // رفع صورة الاستلام
    let mainImg = ''
    if (receiveImg) {
      setUploadingImg(true)
      const { data: upD } = await sb.storage.from('employees').upload(`branch-requests/recv-${Date.now()}.jpg`, receiveImg, { upsert: true })
      if (upD) { const { data: urlD } = sb.storage.from('employees').getPublicUrl(upD.path); mainImg = urlD.publicUrl }
      setUploadingImg(false)
    }

    for (const { item, ri, wp, qty } of plannedItems) {
      let retImg = ''
      if (ri.imgFile) {
        const { data: upD2 } = await sb.storage.from('employees').upload(`branch-requests/ret-${Date.now()}-${item.id}.jpg`, ri.imgFile, { upsert: true })
        if (upD2) { const { data: urlD2 } = sb.storage.from('employees').getPublicUrl(upD2.path); retImg = urlD2.publicUrl }
      }
      await sb.from('branch_request_items').update({
        quantity_received: ri.received,
        quantity_returned: ri.returned,
        return_reason: ri.reason || null,
        return_image_url: retImg || null,
      }).eq('id', item.id)

      if (wp) {
        await sb.from('stock_movements').insert([{
          product_id: wp.id,
          warehouse_id: wp.warehouse_id,
          movement_type: 'out',
          quantity: qty,
          movement_date: new Date().toISOString().slice(0, 10),
          notes: `طلب فرع #${request.request_number} — ${request.branches?.name || ''} — استلام`,
        }])
      }
    }
    // ✅ جديد: تعليم الأصناف المستبعدة في قاعدة البيانات
    for (const itemId of cancelledItems) {
      await sb.from('branch_request_items').update({ is_cancelled: true }).eq('id', itemId)
    }

    // ✅ جديد: الحالة تبقى "معلّق" لو تم استبعاد صنف واحد على الأقل، وإلا "استلم المشرف" زي ما كان بالظبط
    const finalStatus = cancelledItems.size > 0 ? 'partial' : 'supervisor_received'
    await sb.from('branch_requests').update({
      status: finalStatus,
      supervisor_received_by: actionBy,
      supervisor_received_at: new Date().toISOString(),
      receive_image_url: mainImg || null,
    }).eq('id', request.id)
    setShowReceive(false); setUpdating(false); onUpdate()
  }

  // ✅ جديد: تعديل الكمية المستلمة تلقائيًا للحد المتاح فعليًا، عشان يقدر يأكد الاستلام فورًا بعد التعديل
  function adjustToAvailable(itemId: string, requestedInBase: number, available: number) {
    const item = (request.branch_request_items || []).find((i: any) => i.id === itemId)
    if (!item) return
    const current = receiveItems[itemId] || { received: (item as any).quantity_approved || (item as any).quantity_requested, returned: 0, reason: '', imgPreview: '' }
    // نحسب الكمية الجديدة بنفس وحدة الاستلام الأصلية (مش وحدة المخزون الأساسية بالضرورة)
    const ratio = requestedInBase > 0 ? available / requestedInBase : 0
    const newReceived = Math.max(0, Math.floor(current.received * ratio * 100) / 100)
    setReceiveItems(p => ({ ...p, [itemId]: { ...current, received: newReceived } }))
    setShortfalls(null)
  }

  // ✅ جديد: استبعاد صنف بعينه من الاستلام بالكامل (يبقى الطلب "معلّق" ويُستلم باقي الأصناف)
  function excludeItem(itemId: string) {
    setCancelledItems(prev => new Set(prev).add(itemId))
    setShortfalls(null)
  }

  const canApprove = [...MANAGER_ROLES,...SENIOR_ROLES].includes(role) && request.status === 'pending'
  const canEditItems = MANAGER_ROLES.includes(role) && request.status === 'pending'
  const canWarehouse = (WAREHOUSE_ROLES.includes(role) || SENIOR_ROLES.includes(role)) && ['manager_approved','branch_approved'].includes(request.status)

  async function startEditItems() {
    setEditedItems((request.branch_request_items || []).map(i => ({
      id: i.id, product_id: (i as any).product_id || '',
      product_name: i.warehouse_products?.name || '',
      quantity_requested: i.quantity_requested,
      unit_id: (i as any).unit_id || '',
      unit_symbol: i.units?.symbol || '',
    })))
    // جيب منتجات القسم
    const dept = request.department
    const { data } = await sb.from('department_products')
      .select('product_id, warehouse_products!inner(id,name,product_code,warehouse_id)')
      .eq('department', dept)
      .eq('warehouse_products.warehouse_id', 'adcb9ca3-56a7-4c9e-94b8-55fec4fcc0a8') // المستودع الرئيسي فقط
    setDeptProducts((data || []).map((d: any) => ({ id: d.warehouse_products?.id, name: d.warehouse_products?.name, product_code: d.warehouse_products?.product_code })).filter(Boolean))
    setEditingItems(true)
  }

  async function saveEditedItems() {
    setSavingItems(true)
    const toDelete = editedItems.filter(i => i._delete && i.id)
    const toUpdate = editedItems.filter(i => !i._delete && i.id)
    const toAdd    = editedItems.filter(i => !i._delete && !i.id)
    for (const i of toDelete) await sb.from('branch_request_items').delete().eq('id', i.id)
    for (const i of toUpdate) await sb.from('branch_request_items').update({ quantity_requested: i.quantity_requested }).eq('id', i.id)
    if (toAdd.length > 0) await sb.from('branch_request_items').insert(toAdd.map(i => ({ request_id: request.id, product_id: i.product_id, quantity_requested: i.quantity_requested, unit_id: i.unit_id || null })))
    setSavingItems(false)
    setEditingItems(false)
    onUpdate()
  }
  const canReceive = ([...SUPERVISOR_ROLES,...MANAGER_ROLES,...SENIOR_ROLES].includes(role)) && request.status === 'warehouse_processing'
  const canConfirmManager = [...MANAGER_ROLES,...SENIOR_ROLES].includes(role) && request.status === 'supervisor_received'
  const canReject = [...MANAGER_ROLES,...SENIOR_ROLES].includes(role) && ['pending','manager_approved'].includes(request.status)
  const canCancel = ([...SUPERVISOR_ROLES,...MANAGER_ROLES,...SENIOR_ROLES].includes(role)) && ['pending','manager_approved'].includes(request.status)
  const hasAction = canApprove || canWarehouse || canReceive || canConfirmManager

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 620, padding: 24, margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ color: S.gold, fontSize: 16, fontWeight: 800 }}>طلب #{request.request_number}</h3>
            </div>
            <div style={{ fontSize: 11, color: S.muted }}>
              {new Date(request.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { icon: '🏪', label: 'الفرع', value: request.branches?.name },
            { icon: '🏷️', label: 'القسم', value: request.department },
            { icon: '👷', label: 'مقدم الطلب', value: request.requested_by },
            { icon: '📝', label: 'ملاحظات', value: request.notes || '—' },
          ].map((row, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 2 }}>{row.icon} {row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{row.value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Items */}
        <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.gold, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>الأصناف ({request.branch_request_items?.length || 0})</span>
            {canEditItems && !editingItems && (
              <button onClick={startEditItems} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                ✏️ تعديل الأصناف
              </button>
            )}
          </div>

          {/* وضع التعديل */}
          {editingItems ? (
            <div style={{ padding: 14 }}>
              {editedItems.map((item, i) => !item._delete && (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: 13, color: S.white, background: S.card, borderRadius: 8, padding: '8px 12px' }}>{item.product_name}</div>
                  <input type="number" min="0" value={item.quantity_requested}
                    onChange={e => setEditedItems(p => p.map((it, idx) => idx === i ? { ...it, quantity_requested: parseFloat(e.target.value) || 0 } : it))}
                    style={{ ...inp, width: 80, textAlign: 'center' }} />
                  <span style={{ fontSize: 11, color: S.muted, width: 30 }}>{item.unit_symbol}</span>
                  <button onClick={() => setEditedItems(p => p.map((it, idx) => idx === i ? { ...it, _delete: true } : it))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                </div>
              ))}

              {/* إضافة صنف جديد */}
              <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 12, marginTop: 8 }}>
                <div style={{ fontSize: 12, color: S.gold, marginBottom: 8, fontWeight: 700 }}>➕ إضافة صنف</div>
                <AddItemSearch products={deptProducts} editedItems={editedItems} onAdd={p => setEditedItems(prev => [...prev, { id: '', product_id: p.id, product_name: p.name, quantity_requested: 1, unit_id: '', unit_symbol: '' }])} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingItems(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
                <button onClick={saveEditedItems} disabled={savingItems} style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {savingItems ? '⏳...' : '💾 حفظ التعديلات'}
                </button>
              </div>
            </div>
          ) : (
            (request.branch_request_items || []).map((item, i) => (
              <div key={i} style={{ padding: '12px 14px', borderBottom: i < (request.branch_request_items?.length||0)-1 ? `1px solid ${S.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{item.warehouse_products?.name}</div>
                    {item.warehouse_products?.name_en && <div style={{ fontSize: 11, color: S.muted }}>{item.warehouse_products.name_en}</div>}
                    {item.notes && <div style={{ fontSize: 11, color: S.amber, marginTop: 3 }}>📝 {item.notes}</div>}
                  </div>
                  <div style={{ textAlign: 'left', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.blue }}>{item.quantity_requested} {item.units?.symbol}</div>
                    {(item.quantity_approved||0) > 0 && <div style={{ fontSize: 11, color: S.green }}>معتمد: {item.quantity_approved}</div>}
                    {(item.quantity_received||0) > 0 && <div style={{ fontSize: 11, color: S.teal }}>مستلم: {item.quantity_received}</div>}
                    {(item.quantity_returned||0) > 0 && <div style={{ fontSize: 11, color: S.red }}>مرجع: {item.quantity_returned}</div>}
                  </div>
                </div>
                {item.return_reason && (
                  <div style={{ marginTop: 6, fontSize: 11, color: S.red, background: S.redB, borderRadius: 6, padding: '4px 8px' }}>
                    ↩️ سبب الإرجاع: {item.return_reason}
                    {item.return_image_url && <a href={item.return_image_url} target="_blank" rel="noreferrer" style={{ color: S.blue, marginRight: 8 }}>📎 صورة</a>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* صورة الاستلام لو موجودة */}
        {request.receive_image_url && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>📸 صورة الاستلام</div>
            <img src={request.receive_image_url} alt="استلام" style={{ maxHeight: 120, borderRadius: 10, border: `1px solid ${S.green}40` }} />
          </div>
        )}

        {/* Actions */}
        {hasAction && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>اسمك</label>
            <input style={{ ...inp, marginBottom: 12, opacity: 0.7, cursor: 'not-allowed' }} value={actionBy} readOnly />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canApprove && (
                <button onClick={() => doAction('manager_approved', { manager_approved_by: actionBy, manager_approved_at: new Date().toISOString() })} disabled={updating}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  👨‍💼 اعتماد مدير القسم
                </button>
              )}
              {canWarehouse && (
                <button onClick={() => doAction('warehouse_processing', { warehouse_received_by: actionBy, warehouse_received_at: new Date().toISOString() })} disabled={updating}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.orange}`, background: S.orangeB, color: S.orange, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🏭 بدء التجهيز
                </button>
              )}
              {canReceive && (
                <button onClick={() => setShowReceive(true)} disabled={updating}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🎉 تأكيد الاستلام
                </button>
              )}
              {canConfirmManager && (
                <button onClick={() => doAction('manager_received', { manager_received_by: actionBy, manager_received_at: new Date().toISOString() })} disabled={updating}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  ✅ استلام مدير القسم
                </button>
              )}
              {canReject && (
                <button onClick={() => doAction('rejected')} disabled={updating}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  ❌ رفض
                </button>
              )}
              {canCancel && (
                <button onClick={async () => { if (!confirm('إلغاء الطلب؟')) return; await doAction('cancelled') }} disabled={updating}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🚫 إلغاء
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
        </div>
      </div>

      {/* ══ Receive Modal ══ */}
      {showReceive && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.green}40`, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ color: S.green, fontSize: 16, fontWeight: 800, marginBottom: 2 }}>🎉 تأكيد الاستلام</h3>
                <p style={{ fontSize: 11, color: S.muted }}>حدد الكميات المستلمة — يمكن إرجاع منتجات مع سبب وصورة</p>
              </div>
              <button onClick={() => setShowReceive(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {/* ✅ جديد: تنبيه واضح في المنتصف لو فيه أصناف كميتها غير متاحة بالكامل */}
            {shortfalls && shortfalls.length > 0 && (
              <div style={{ background: S.amberB, border: `1.5px solid ${S.amber}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: S.amber, marginBottom: 10 }}>⚠️ الكمية غير متاحة بالكامل في المستودع</div>
                {shortfalls.map(s => (
                  <div key={s.itemId} style={{ background: S.navy2, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>
                      المطلوب: <span style={{ color: S.red, fontWeight: 700 }}>{s.requestedInBase.toFixed(2)} {s.unitSymbol}</span>
                      {' '}— المتاح فعليًا: <span style={{ color: S.green, fontWeight: 700 }}>{s.available.toFixed(2)} {s.unitSymbol}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => adjustToAvailable(s.itemId, s.requestedInBase, s.available)}
                        style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        ✏️ تعديل للمتاح ({s.available.toFixed(2)})
                      </button>
                      <button onClick={() => excludeItem(s.itemId)}
                        style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        🚫 استبعاد هذا الصنف
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>بعد التعديل أو الاستبعاد، اضغط "تأكيد الاستلام" مرة أخرى.</div>
              </div>
            )}

            {/* صورة الاستلام الرئيسية */}
            <div style={{ background: S.navy3, borderRadius: 10, padding: 12, marginBottom: 14, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: S.gold, marginBottom: 8 }}>📸 صورة إثبات الاستلام (اختياري)</div>
              <input type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0]
                if (file) { setReceiveImg(file); setReceiveImgPreview(URL.createObjectURL(file)) }
              }} style={{ fontSize: 12, color: S.muted, marginBottom: 6, display: 'block' }} />
              {receiveImgPreview && <img src={receiveImgPreview} alt="استلام" style={{ maxHeight: 100, borderRadius: 8, border: `1px solid ${S.green}40` }} />}
            </div>

            {/* الأصناف */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(request.branch_request_items || []).map((item: any) => {
                const approved = item.quantity_approved || item.quantity_requested
                const ri = receiveItems[item.id] || { received: approved, returned: 0, reason: '', imgPreview: '' }
                const isExcluded = cancelledItems.has(item.id)
                return (
                  <div key={item.id} style={{ background: S.navy3, borderRadius: 12, padding: 12, border: `1px solid ${isExcluded ? S.red + '60' : S.border}`, opacity: isExcluded ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: S.white, textDecoration: isExcluded ? 'line-through' : 'none' }}>
                        {item.warehouse_products?.name}
                        <span style={{ fontSize: 11, color: S.muted, marginRight: 6 }}>المعتمد: {approved} {item.units?.symbol}</span>
                      </div>
                      {/* ✅ جديد: استبعاد هذا الصنف بعينه من الاستلام */}
                      {isExcluded ? (
                        <button onClick={() => setCancelledItems(prev => { const next = new Set(prev); next.delete(item.id); return next })}
                          style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 6, color: S.muted, cursor: 'pointer', fontSize: 10, padding: '3px 8px', fontFamily: 'Tajawal, sans-serif' }}>
                          ↩️ تراجع
                        </button>
                      ) : (
                        <button onClick={() => excludeItem(item.id)} title="استبعاد هذا الصنف من الاستلام"
                          style={{ background: 'transparent', border: `1px solid ${S.red}40`, borderRadius: 6, color: S.red, cursor: 'pointer', fontSize: 10, padding: '3px 8px' }}>
                          🚫
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: ri.returned > 0 ? 8 : 0 }}>
                      <div>
                        <label style={{ fontSize: 11, color: S.green, display: 'block', marginBottom: 3 }}>✅ المستلم فعلاً</label>
                        <input type="number" min="0" value={ri.received}
                          onChange={e => setReceiveItems(p => ({ ...p, [item.id]: { ...ri, received: Number(e.target.value) } }))}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.green}40`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'ltr', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: S.red, display: 'block', marginBottom: 3 }}>↩️ المرجع (لو ناقص)</label>
                        <input type="number" min="0" value={ri.returned}
                          onChange={e => setReceiveItems(p => ({ ...p, [item.id]: { ...ri, returned: Number(e.target.value) } }))}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.red}40`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'ltr', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    {ri.returned > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input placeholder="سبب الإرجاع أو النقص..." value={ri.reason}
                          onChange={e => setReceiveItems(p => ({ ...p, [item.id]: { ...ri, reason: e.target.value } }))}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.amber}40`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'rtl', boxSizing: 'border-box' }} />
                        <div style={{ fontSize: 11, color: S.muted }}>📎 صورة دليل الإرجاع (اختياري)</div>
                        <input type="file" accept="image/*" onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) setReceiveItems(p => ({ ...p, [item.id]: { ...ri, imgFile: file, imgPreview: URL.createObjectURL(file) } }))
                        }} style={{ fontSize: 11, color: S.muted }} />
                        {ri.imgPreview && <img src={ri.imgPreview} alt="إرجاع" style={{ maxHeight: 70, borderRadius: 8, border: `1px solid ${S.amber}40` }} />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReceive(false)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button onClick={confirmReceive} disabled={updating || uploadingImg}
                style={{ padding: '10px 22px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {updating || uploadingImg ? '⏳ جاري الحفظ...' : '✅ تأكيد الاستلام'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══ الصفحة الرئيسية ══
// ✅ جديد: مكون "التبادل بين الفروع" - طلبات أصناف حرة بين مشرفين/مدراء الأقسام في فروع مختلفة (بدون ربط بمخزون)
const EX_STATUS_INFO: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'بانتظار الموافقة', color: S.amber, bg: S.amberB, icon: '⏳' },
  accepted:  { label: 'جاري التجهيز',     color: S.blue,  bg: S.blueB,  icon: '📦' },
  completed: { label: 'تم الاستلام',       color: S.green, bg: S.greenB, icon: '✅' },
  cancelled: { label: 'ملغي',              color: S.red,   bg: S.redB,   icon: '❌' },
}
type ExItem = { id?: string; item_name: string; quantity: string; unit: string; notes: string }
function exFullName(p: { name?: string; name_en?: string } | null | undefined) {
  if (!p) return ''
  return [p.name, p.name_en].filter(Boolean).join(' ')
}

function ExchangeTab({ employee, branches, sb, isAr, isAdmin }: { employee: any; branches: { id: string; name: string }[]; sb: any; isAr: boolean; isAdmin: boolean }) {
  const role = employee?.role || ''
  const myBranchId = employee?.branch_id || ''
  // ✅ Fix: إضافة أمين المستودع ومدير المستودعات لقائمة المسموح لهم بالتبادل بين الفروع
  const ALLOWED_EX_ROLES = [...SUPERVISOR_ROLES, ...MANAGER_ROLES, 'warehouse_keeper', 'warehouse_manager']

  // ✅ جديد: قائمة أصناف مستودع الفرع الحالي - لدعم البحث الذكي عند إضافة صنف، بنفس منطق مشتريات السوق
  const [branchProducts, setBranchProducts] = useState<{ id: string; name: string; name_en?: string; unit_symbol?: string }[]>([])
  const [suggestionsForRow, setSuggestionsForRow] = useState<number | null>(null)
  useEffect(() => {
    if (!myBranchId) return
    sb.from('warehouses').select('id').eq('branch_id', myBranchId).maybeSingle().then(({ data: wh }: any) => {
      if (!wh?.id) return
      sb.from('warehouse_products').select('id, name, name_en, units(symbol)').eq('warehouse_id', wh.id).eq('is_active', true).order('name')
        .then(({ data }: any) => setBranchProducts((data || []).map((p: any) => ({ id: p.id, name: p.name, name_en: p.name_en, unit_symbol: p.units?.symbol }))))
    })
  }, [sb, myBranchId])

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [employees, setEmployees] = useState<any[]>([])
  const [exchanges, setExchanges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'sent' | 'received' | 'all'>(isAdmin ? 'all' : 'received')
  // ✅ جديد: ترقيم صفحات - 20 طلب في كل صفحة
  const EX_PAGE_SIZE = 20
  const [exPage, setExPage] = useState(1)
  useEffect(() => { setExPage(1) }, [tab])

  // ✅ جديد: إحصائية شهرية - تجميع أصناف التبادل حسب (الفرع المرسل → الفرع المستقبل → اسم الصنف بعد التطبيع)
  const [showMonthlyStats, setShowMonthlyStats] = useState(false)
  const [statsMonth, setStatsMonth] = useState(() => new Date().toISOString().slice(0, 7)) // 'YYYY-MM'

  // ✅ تطبيع اسم الصنف عشان "طبق" و"الطبق" و" طبق " يتحسبوا كصنف واحد بدل ما يتفرقوا في الإحصائية
  function normalizeItemName(name: string): string {
    return (name || '')
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
      .replace(/^ال/, '') // إزالة "أل" التعريف من بداية الاسم
      .replace(/\s+/g, ' ')
  }

  const monthlyStatsRows = useMemo(() => {
    if (!showMonthlyStats) return []
    const [y, m] = statsMonth.split('-').map(Number)
    const monthStart = new Date(y, m - 1, 1)
    const monthEnd = new Date(y, m, 1)
    const filtered = exchanges.filter(ex => {
      const d = new Date(ex.created_at)
      return d >= monthStart && d < monthEnd
    })
    const groups: Record<string, { from: string; to: string; itemName: string; unit: string; qty: number; requesters: Set<string> }> = {}
    for (const ex of filtered) {
      const fromName = ex.from_branch?.name || '—'
      const toName = ex.to_branch?.name || '—'
      const requesterName = [ex.requester?.name, ex.requester?.name_en].filter(Boolean).join(' ') || '—'
      for (const it of (ex.items || [])) {
        const norm = normalizeItemName(it.item_name)
        const key = `${fromName}|${toName}|${norm}`
        if (!groups[key]) groups[key] = { from: fromName, to: toName, itemName: it.item_name, unit: it.unit || '', qty: 0, requesters: new Set() }
        groups[key].qty += Number(it.quantity) || 0
        groups[key].requesters.add(requesterName)
      }
    }
    return Object.values(groups).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.itemName.localeCompare(b.itemName))
  }, [exchanges, statsMonth, showMonthlyStats])

  // ✅ جديد: طباعة تقرير الإحصائية الشهرية
  function printMonthlyStats() {
    const win = window.open('', '_blank')
    if (!win) return
    const rowsHtml = monthlyStatsRows.map((row, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${row.from}</td>
        <td>${row.to}</td>
        <td>${row.itemName}</td>
        <td style="text-align:center">${row.qty} ${row.unit}</td>
        <td>${Array.from(row.requesters).join('، ')}</td>
      </tr>`).join('')
    win.document.write(`
      <html><head><title>إحصائية شهرية - تبادل الفروع - ${statsMonth}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #1a1a1a; direction: rtl; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .sub { font-size: 12px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #C9A84C80; padding: 7px 9px; text-align: right; }
        th { background: #C9A84C30; }
        @media print { body { padding: 10px; } }
      </style></head>
      <body>
        <h1>📊 إحصائية شهرية — تبادل الفروع</h1>
        <div class="sub">الشهر: ${statsMonth} — إجمالي ${monthlyStatsRows.length} صنف مجمَّع</div>
        <table>
          <thead><tr><th>#</th><th>من فرع</th><th>إلى فرع</th><th>الصنف</th><th>الكمية الإجمالية</th><th>طلب بواسطة</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  const [showNew, setShowNew] = useState(false)
  const [newTargetBranch, setNewTargetBranch] = useState('')
  const [newTargetPerson, setNewTargetPerson] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newItems, setNewItems] = useState<ExItem[]>([{ item_name: '', quantity: '', unit: '', notes: '' }])
  const [saving, setSaving] = useState(false)
  // ✅ جديد: لوحة تعديل الكمية المستلمة فعليًا قبل تأكيد الاستلام - عشان الطرف المستلم يقدر
  // يصحّح الكمية لو استلم أقل أو أكثر من المطلوب، بدل ما يتأكد الاستلام بنفس الكمية دايمًا
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({})
  const [completingSaving, setCompletingSaving] = useState(false)

  // ✅ جديد: دالة مساعدة لإرسال إشعار لموظف محدد عند أي حركة في التبادل بين الفروع
  async function sendNotification(targetEmployeeId: string, title: string, body: string) {
    if (!targetEmployeeId) return
    await sb.from('notifications').insert([{
      type: 'request',
      title,
      body,
      link: '/dashboard/warehouse/branch-requests',
      target_employee_id: targetEmployeeId,
      // ✅ Fix حرج: عمود target_role له قيمة افتراضية "all" في قاعدة البيانات، فلو ما حددناهوش صراحةً
      // بـ null، الإشعار الشخصي ده كان بيوصل لكل الموظفين (بما فيهم الكاشير) بدل الشخص المقصود بس
      target_role: null,
    }])
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    // ✅ مدير النظام يشوف كل الطلبات في كل الفروع، مش بس اللي بعتها أو اتوجهت له
    let exQuery = sb.from('inter_branch_exchanges')
      .select('*, from_branch:branches!inter_branch_exchanges_from_branch_id_fkey(name), to_branch:branches!inter_branch_exchanges_to_branch_id_fkey(name), requester:employees!inter_branch_exchanges_requested_by_fkey(name,name_en), assignee:employees!inter_branch_exchanges_assigned_to_fkey(name,name_en), items:inter_branch_exchange_items(*)')
      .order('created_at', { ascending: false })
    if (!isAdmin) exQuery = exQuery.or(`requested_by.eq.${employee?.id},assigned_to.eq.${employee?.id}`)
    const [empRes, exRes] = await Promise.all([
      sb.from('employees').select('id,name,name_en,role,branch_id').eq('is_active', true).in('role', ALLOWED_EX_ROLES),
      exQuery,
    ])
    setEmployees(empRes.data || [])
    setExchanges(exRes.data || [])
    setLoading(false)
  }, [sb, employee?.id, isAdmin])

  useEffect(() => { if (employee?.id) fetchAll() }, [employee?.id, fetchAll])

  const sentRequests = exchanges.filter(e => e.requested_by === employee?.id)
  const receivedRequests = exchanges.filter(e => e.assigned_to === employee?.id)
  const pendingReceivedCount = receivedRequests.filter(e => e.status === 'pending').length
  const pendingSentCount = sentRequests.filter(e => e.status === 'accepted').length
  const targetBranchPeople = employees.filter(e => e.branch_id === newTargetBranch)

  function addItemRow() { setNewItems(p => [...p, { item_name: '', quantity: '', unit: '', notes: '' }]) }
  function removeItemRow(i: number) { setNewItems(p => p.filter((_, idx) => idx !== i)) }
  function updateItemRow(i: number, key: keyof ExItem, val: string) { setNewItems(p => p.map((it, idx) => idx === i ? { ...it, [key]: val } : it)) }
  function resetNewForm() {
    setNewTargetBranch(''); setNewTargetPerson(''); setNewNotes('')
    setNewItems([{ item_name: '', quantity: '', unit: '', notes: '' }])
  }
  function repeatRequest(ex: any) {
    setNewTargetBranch(ex.to_branch_id)
    setNewTargetPerson(ex.assigned_to)
    setNewNotes('')
    setNewItems((ex.items || []).map((it: any) => ({ item_name: it.item_name, quantity: String(it.quantity), unit: it.unit || '', notes: it.notes || '' })))
    setShowNew(true)
  }

  async function sendRequest() {
    if (!newTargetBranch) { alert('من فضلك اختر الفرع'); return }
    if (!newTargetPerson) { alert('من فضلك اختر الشخص المطلوب منه'); return }
    const validItems = newItems.filter(it => it.item_name.trim() && parseFloat(it.quantity) > 0)
    if (validItems.length === 0) { alert('من فضلك أضف صنف واحد على الأقل بكمية صحيحة'); return }
    setSaving(true)
    const { data: created, error } = await sb.from('inter_branch_exchanges').insert([{
      from_branch_id: myBranchId, to_branch_id: newTargetBranch,
      requested_by: employee?.id, assigned_to: newTargetPerson,
      status: 'pending', notes: newNotes.trim() || null,
    }]).select().single()
    if (error || !created) { alert('حصل خطأ: ' + (error?.message || '')); setSaving(false); return }
    await sb.from('inter_branch_exchange_items').insert(
      validItems.map(it => ({ exchange_id: created.id, item_name: it.item_name.trim(), quantity: parseFloat(it.quantity), unit: it.unit.trim() || null, notes: it.notes.trim() || null }))
    )
    // ✅ جديد: إشعار للشخص المطلوب منه التبادل بوصول طلب جديد
    const fromBranchName = branches.find(b => b.id === myBranchId)?.name || ''
    const senderName = [employee?.name, employee?.name_en].filter(Boolean).join(' ') || 'موظف'
    await sendNotification(newTargetPerson, '🔄 طلب تبادل جديد', `${senderName} من فرع ${fromBranchName} أرسل لك طلب تبادل جديد (${validItems.length} صنف)`)
    setSaving(false); setShowNew(false); resetNewForm(); fetchAll()
  }

  async function acceptRequest(id: string) {
    await sb.from('inter_branch_exchanges').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', id)
    // ✅ جديد: إشعار لمن أرسل الطلب بأنه تم قبوله وجاري التجهيز
    const ex = exchanges.find(e => e.id === id)
    if (ex) await sendNotification(ex.requested_by, '✅ تم قبول طلب التبادل', 'تم قبول طلب التبادل الذي أرسلته، وجاري تجهيزه الآن')
    fetchAll()
  }
  async function completeRequest(id: string) {
    await sb.from('inter_branch_exchanges').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    // ✅ جديد: إشعار لمن أرسل الطلب بأنه تم إتمام واستلام التبادل
    const ex = exchanges.find(e => e.id === id)
    if (ex) await sendNotification(ex.requested_by, '🎉 تم إتمام طلب التبادل', 'تم إتمام واستلام طلب التبادل الذي أرسلته بالكامل')
    fetchAll()
  }
  // ✅ جديد: فتح لوحة تعديل الكمية المستلمة لكل صنف قبل تأكيد الاستلام النهائي
  function startCompleting(ex: any) {
    setCompletingId(ex.id)
    setReceivedQtys(Object.fromEntries((ex.items || []).map((it: any) => [it.id, it.quantity_received ?? it.quantity])))
  }
  function cancelCompleting() {
    setCompletingId(null)
    setReceivedQtys({})
  }
  // ✅ جديد: تأكيد الاستلام بعد تعديل الكميات - بيحفظ الكمية المستلمة فعليًا لكل صنف
  // (بدل الاعتماد على الكمية المطلوبة الأصلية دايمًا)، وبعدين يكمل نفس منطق completeRequest
  async function confirmComplete(ex: any) {
    setCompletingSaving(true)
    for (const it of (ex.items || [])) {
      const receivedQty = receivedQtys[it.id] ?? it.quantity
      await sb.from('inter_branch_exchange_items').update({ quantity_received: receivedQty }).eq('id', it.id)
    }
    await sb.from('inter_branch_exchanges').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', ex.id)
    // ✅ جديد: لو فيه فرق بين المطلوب والمستلم في أي صنف، نوضّح ده في نص الإشعار
    const discrepancies = (ex.items || []).filter((it: any) => (receivedQtys[it.id] ?? it.quantity) !== it.quantity)
    await sendNotification(
      ex.requested_by,
      discrepancies.length > 0 ? '⚠️ تم إتمام طلب التبادل مع وجود فرق في الكمية' : '🎉 تم إتمام طلب التبادل',
      discrepancies.length > 0
        ? `تم إتمام واستلام طلب التبادل، لكن ${discrepancies.length} صنف اختلفت كميته المستلمة عن المطلوبة`
        : 'تم إتمام واستلام طلب التبادل الذي أرسلته بالكامل'
    )
    setCompletingSaving(false)
    setCompletingId(null)
    setReceivedQtys({})
    fetchAll()
  }
  async function cancelRequest(id: string) {
    if (!confirm('إلغاء هذا الطلب؟')) return
    await sb.from('inter_branch_exchanges').update({ status: 'cancelled' }).eq('id', id)
    // ✅ جديد: إشعار لمن أرسل الطلب بأنه تم إلغاؤه
    const ex = exchanges.find(e => e.id === id)
    if (ex) await sendNotification(ex.requested_by, '❌ تم إلغاء طلب التبادل', 'تم إلغاء طلب التبادل الذي أرسلته')
    fetchAll()
  }

  if (!ALLOWED_EX_ROLES.includes(role) && role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 14, color: S.muted }}>هذا القسم مخصص للمشرفين ومدراء الأقسام فقط</div>
      </div>
    )
  }

  const list = tab === 'all' ? exchanges : tab === 'sent' ? sentRequests : receivedRequests
  // ✅ جديد: تقسيم القائمة لصفحات، 20 طلب في كل صفحة
  const exTotalPages = Math.max(1, Math.ceil(list.length / EX_PAGE_SIZE))
  const pagedList = list.slice((exPage - 1) * EX_PAGE_SIZE, exPage * EX_PAGE_SIZE)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={() => setTab('all')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'all' ? S.gold : S.border}`, background: tab === 'all' ? S.gold3 : 'transparent', color: tab === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'all' ? 700 : 400 }}>
              🗂️ كل الطلبات
            </button>
          )}
          <button onClick={() => setTab('received')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'received' ? S.gold : S.border}`, background: tab === 'received' ? S.gold3 : 'transparent', color: tab === 'received' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'received' ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
            📥 طلبات موجهة لي
            {pendingReceivedCount > 0 && <span style={{ background: S.red, color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{pendingReceivedCount}</span>}
          </button>
          <button onClick={() => setTab('sent')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'sent' ? S.gold : S.border}`, background: tab === 'sent' ? S.gold3 : 'transparent', color: tab === 'sent' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'sent' ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
            📤 طلباتي
            {pendingSentCount > 0 && <span style={{ background: S.blue, color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{pendingSentCount}</span>}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* ✅ جديد: الإحصائية الشهرية - للأدمن بس، لأنها بتغطي كل الفروع */}
          {isAdmin && (
            <button onClick={() => setShowMonthlyStats(true)}
              style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.blue}`, background: 'rgba(75,158,240,0.12)', color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              📊 إحصائية شهرية
            </button>
          )}
          <button onClick={() => { resetNewForm(); setShowNew(true) }}
            style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: S.gold, color: S.navy, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>
            ➕ طلب جديد
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{tab === 'all' ? '🗂️' : tab === 'received' ? '📥' : '📤'}</div>
          <div style={{ fontSize: 14, color: S.muted }}>{tab === 'all' ? 'لا توجد أي طلبات تبادل حتى الآن' : tab === 'received' ? 'لا توجد طلبات موجهة إليك حاليًا' : 'لم تقم بإرسال أي طلب بعد'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {pagedList.map(ex => {
            const st = EX_STATUS_INFO[ex.status] || EX_STATUS_INFO.pending
            const isRecipient = ex.assigned_to === employee?.id
            const isSender = ex.requested_by === employee?.id
            return (
              <div key={ex.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${st.color}40`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S.white }}>
                      {tab === 'all'
                        ? `${ex.from_branch?.name} (${exFullName(ex.requester)}) ← ${ex.to_branch?.name} (${exFullName(ex.assignee)})`
                        : tab === 'received' ? `من: ${ex.from_branch?.name} (${exFullName(ex.requester)})` : `إلى: ${ex.to_branch?.name} (${exFullName(ex.assignee)})`}
                    </div>
                    <div style={{ fontSize: 11, color: S.muted }}>{new Date(ex.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                  </div>
                  <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.icon} {st.label}</span>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {(ex.items || []).map((it: any) => {
                    // ✅ جديد: لما تكون لوحة تعديل الاستلام مفتوحة لهذا الطلب، نعرض حقل رقمي
                    // قابل للتعديل بدل الرقم الثابت، بحيث المستلم يقدر يصحّح الكمية الفعلية
                    if (completingId === ex.id) {
                      return (
                        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13, gap: 8 }}>
                          <span style={{ color: S.white, flex: 1 }}>{it.item_name}</span>
                          <span style={{ color: S.muted, fontSize: 11 }}>المطلوب: {it.quantity} {it.unit}</span>
                          <input type="number" min="0" value={receivedQtys[it.id] ?? it.quantity}
                            onChange={e => setReceivedQtys(p => ({ ...p, [it.id]: parseFloat(e.target.value) || 0 }))}
                            style={{ width: 70, textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${S.green}60`, borderRadius: 8, padding: '5px 6px', fontSize: 12, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'ltr' }} />
                        </div>
                      )
                    }
                    // ✅ جديد: بعد اكتمال الطلب، لو الكمية المستلمة تختلف عن المطلوبة، نعرض شارة واضحة
                    // (نقص بالأحمر أو زيادة بالأخضر) بدل عرض الكمية المطلوبة فقط وكأن كل حاجة وصلت كاملة
                    const hasReceivedInfo = ex.status === 'completed' && it.quantity_received !== null && it.quantity_received !== undefined
                    const diff = hasReceivedInfo ? (it.quantity_received - it.quantity) : 0
                    return (
                      <div key={it.id} style={{ padding: '4px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: S.white }}>{it.item_name}</span>
                          <span style={{ color: S.gold, fontWeight: 700 }}>{it.quantity} {it.unit}</span>
                        </div>
                        {hasReceivedInfo && diff !== 0 && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: diff < 0 ? S.red : S.green, marginTop: 2 }}>
                            {diff < 0 ? `⚠️ ناقص ${Math.abs(diff)} ${it.unit || ''} — استُلم ${it.quantity_received} فقط` : `🔺 زيادة ${diff} ${it.unit || ''} — استُلم ${it.quantity_received}`}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {ex.notes && <div style={{ fontSize: 11, color: S.amber, marginTop: 6 }}>📝 {ex.notes}</div>}
                </div>
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {isRecipient && ex.status === 'pending' && (
                    <button onClick={() => acceptRequest(ex.id)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: S.blue, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      ✅ استلمت الطلب وسأقوم بتجهيزه
                    </button>
                  )}
                  {/* ✅ جديد: بدل التنفيذ المباشر، الزر بيفتح لوحة تعديل الكمية المستلمة أولًا */}
                  {isSender && ex.status === 'accepted' && completingId !== ex.id && (
                    <button onClick={() => startCompleting(ex)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: S.green, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      ✅ استلمت الصنف
                    </button>
                  )}
                  {isSender && ex.status === 'accepted' && completingId === ex.id && (
                    <>
                      <button onClick={() => confirmComplete(ex)} disabled={completingSaving} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: S.green, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        {completingSaving ? '⏳...' : '💾 تأكيد الكميات المستلمة'}
                      </button>
                      <button onClick={cancelCompleting} disabled={completingSaving} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                        إلغاء
                      </button>
                    </>
                  )}
                  {isSender && ex.status === 'pending' && (
                    <button onClick={() => cancelRequest(ex.id)} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: 'transparent', color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      ✕ إلغاء
                    </button>
                  )}
                  {isSender && (
                    <button onClick={() => repeatRequest(ex)} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.purple}`, background: 'transparent', color: S.purple, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      🔁 كرر الطلب
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ✅ جديد: أزرار التنقل بين الصفحات - تظهر بس لو عدد الطلبات أكبر من صفحة واحدة */}
      {!loading && list.length > EX_PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
          <button onClick={() => setExPage(p => Math.max(1, p - 1))} disabled={exPage === 1}
            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: exPage === 1 ? S.muted : S.white, cursor: exPage === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
            ‹ السابق
          </button>
          <span style={{ fontSize: 12, color: S.muted }}>صفحة {exPage} من {exTotalPages} ({list.length} طلب)</span>
          <button onClick={() => setExPage(p => Math.min(exTotalPages, p + 1))} disabled={exPage === exTotalPages}
            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: exPage === exTotalPages ? S.muted : S.white, cursor: exPage === exTotalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>
            التالي ›
          </button>
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: isMobile ? 18 : 26 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: S.white }}>➕ طلب تبادل جديد</div>
              <button onClick={() => setShowNew(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>🏪 الفرع اللي هتطلب منه</label>
              <select value={newTargetBranch} onChange={e => { setNewTargetBranch(e.target.value); setNewTargetPerson('') }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 14, fontFamily: 'Tajawal, sans-serif' }}>
                <option value="">-- اختر الفرع --</option>
                {branches.filter(b => b.id !== myBranchId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>👤 الشخص المطلوب منه</label>
              <select value={newTargetPerson} onChange={e => setNewTargetPerson(e.target.value)} disabled={!newTargetBranch}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 14, fontFamily: 'Tajawal, sans-serif', opacity: newTargetBranch ? 1 : 0.5 }}>
                <option value="">{newTargetBranch ? '-- اختر الشخص --' : '-- اختر الفرع أولاً --'}</option>
                {targetBranchPeople.map(p => <option key={p.id} value={p.id}>{exFullName(p)}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>📦 الأصناف</label>
              {newItems.map((it, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 6, marginBottom: 10, alignItems: 'flex-start',
                  // ✅ Fix: على الموبايل، الحقول كانت متزاحمة جدًا في صف واحد ضيق - أصبحت ترتّب عموديًا بدل كده
                  flexDirection: isMobile ? 'column' : 'row',
                  background: isMobile ? S.card : 'transparent', borderRadius: isMobile ? 10 : 0, padding: isMobile ? 10 : 0,
                }}>
                  {/* ✅ Fix: بحث ذكي في أصناف مستودع الفرع بنفس منطق مشتريات السوق، مع إمكانية كتابة صنف حر جديد لو مش موجود */}
                  <div style={{ flex: isMobile ? undefined : 2, width: isMobile ? '100%' : undefined, position: 'relative' }}>
                    <input value={it.item_name}
                      onChange={e => { updateItemRow(i, 'item_name', e.target.value); setSuggestionsForRow(i) }}
                      onFocus={() => setSuggestionsForRow(i)}
                      onBlur={() => setTimeout(() => setSuggestionsForRow(null), 150)}
                      placeholder="اسم الصنف"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }} />
                    {suggestionsForRow === i && it.item_name.trim().length > 0 && (() => {
                      const q = it.item_name.trim().toLowerCase()
                      const matches = branchProducts.filter(p => p.name.toLowerCase().includes(q) || (p.name_en || '').toLowerCase().includes(q)).slice(0, 8)
                      if (matches.length === 0) return null
                      return (
                        <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, marginTop: 4, background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 8, maxHeight: 180, overflowY: 'auto', zIndex: 50, boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
                          {matches.map(p => (
                            <div key={p.id} onMouseDown={() => {
                              updateItemRow(i, 'item_name', p.name)
                              if (p.unit_symbol) updateItemRow(i, 'unit', p.unit_symbol)
                              setSuggestionsForRow(null)
                            }}
                              style={{ padding: '9px 10px', cursor: 'pointer', fontSize: 12, color: S.white, borderBottom: `1px solid ${S.border}` }}>
                              📦 {p.name} {p.name_en && <span style={{ color: S.muted }}>({p.name_en})</span>}
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                  {/* ✅ الكمية والوحدة وزرار الحذف في صف فرعي واحد على الموبايل، بدل ما يتزاحموا مع اسم الصنف */}
                  <div style={{ display: 'flex', gap: 6, width: isMobile ? '100%' : undefined }}>
                    <input type="number" value={it.quantity} onChange={e => updateItemRow(i, 'quantity', e.target.value)} placeholder="الكمية"
                      style={{ flex: 1, boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }} />
                    {/* ✅ Fix: توضيح إن الوحدة اختيارية (كانت اختيارية فعليًا في الحفظ، لكن مش واضح في الواجهة) */}
                    <input value={it.unit} onChange={e => updateItemRow(i, 'unit', e.target.value)} placeholder="الوحدة (اختياري)"
                      style={{ flex: 1, boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }} />
                    {newItems.length > 1 && (
                      <button onClick={() => removeItemRow(i)} style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', padding: '9px 12px', fontSize: 13, flexShrink: 0 }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addItemRow} style={{ padding: '7px 14px', borderRadius: 8, border: `1px dashed ${S.gold}`, background: 'transparent', color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                ➕ إضافة صنف آخر
              </button>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📝 ملاحظات (اختياري)</label>
              <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                إلغاء
              </button>
              <button onClick={sendRequest} disabled={saving}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: S.gold, color: S.navy, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
                {saving ? '⏳ جاري الإرسال...' : '📤 إرسال الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ جديد: نافذة الإحصائية الشهرية - جدول من فرع → إلى فرع، الأصناف مجمّعة، ومين طلب */}
      {showMonthlyStats && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 820, maxHeight: '88vh', overflowY: 'auto', padding: isMobile ? 18 : 26 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: S.white }}>📊 إحصائية شهرية — تبادل الفروع</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* ✅ جديد: زر طباعة تقرير الإحصائية الشهرية */}
                <button onClick={printMonthlyStats} disabled={monthlyStatsRows.length === 0}
                  style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: monthlyStatsRows.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: monthlyStatsRows.length === 0 ? 0.5 : 1 }}>
                  🖨️ طباعة
                </button>
                <button onClick={() => setShowMonthlyStats(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: S.muted, marginBottom: 14 }}>الأصناف المتشابهة الاسم مُجمَّعة تلقائيًا في كمية واحدة لكل مسار (من فرع → إلى فرع) خلال الشهر المختار.</p>
            <div style={{ marginBottom: 18 }}>
              <input type="month" value={statsMonth} onChange={e => setStatsMonth(e.target.value)}
                style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', outline: 'none' }} />
            </div>
            {monthlyStatsRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد عمليات تبادل مسجَّلة في هذا الشهر</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['من فرع', 'إلى فرع', 'الصنف', 'الكمية الإجمالية', 'طلب بواسطة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyStatsRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: S.white }}>🏪 {row.from}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: S.white }}>🏪 {row.to}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: S.gold, fontWeight: 700 }}>{row.itemName}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: S.white, fontWeight: 700 }}>{row.qty} {row.unit}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>{Array.from(row.requesters).join('، ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button onClick={() => setShowMonthlyStats(false)} style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BranchRequestsPage() {
  const sb = createClient()
  const { employee } = useAuth()
  const { isAr } = useLang()
  const [requests, setRequests] = useState<BranchRequest[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showRepeat, setShowRepeat] = useState(false)
  const [repeatRequests, setRepeatRequests] = useState<BranchRequest[]>([])
  const [selected, setSelected] = useState<BranchRequest|null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [activeBranch, setActiveBranch] = useState<string>('') // '' = الإجمالي (admin فقط)، أو branch_id محدد
  const [showReport, setShowReport] = useState(false)
  const [search, setSearch] = useState('')
  // ✅ جديد: تبديل بين "طلبات الفروع" العادية و"التبادل بين الفروع" كتاب داخلي في نفس الصفحة
  const [mainView, setMainView] = useState<'requests' | 'exchange'>('requests')

  const role = employee?.role || ''
  const myBranchId = employee?.branch_id || ''
  const myDept = employee?.department || ''

  const isAdmin = role === 'admin'
  const isBranchManager = role === 'branch_manager'
  const isDeptManager = MANAGER_ROLES.includes(role)
  const isSupervisor = SUPERVISOR_ROLES.includes(role)
  const isWarehouse = role === 'warehouse_keeper'
  // ✅ دور جديد: مدير المستودعات - يشوف طلبات كل الفروع مع بعض (زي الأدمن في موضوع رؤية الفروع بس)
  const isWarehouseManager = role === 'warehouse_manager'
  const canSeeAllBranches = isAdmin || isWarehouseManager

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('branch_requests')
      .select('*, branches(name), branch_request_items(id,product_id,quantity_requested,quantity_approved,quantity_received,quantity_returned,return_reason,return_image_url,notes,unit_id,warehouse_products(name,name_en),units(symbol))')
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    sb.from('branches').select('id,name').eq('is_active', true).then(({ data }) => setBranches(data || []))
  }, [])
  useEffect(() => {
    // الأدوار غير admin/مدير المستودعات تتقفل على فرعها تلقائيًا
    if (!canSeeAllBranches && myBranchId) setActiveBranch(myBranchId)
  }, [canSeeAllBranches, myBranchId])

  // طلبات الفرع النشط (أو كل الفروع لو activeBranch فاضي و admin/مدير المستودعات)
  const branchRequests = activeBranch ? requests.filter(r => r.branch_id === activeBranch) : requests
  // الأدوار غير admin/مدير المستودعات تشوف بس تاب فرعها
  const visibleBranches = canSeeAllBranches ? branches : branches.filter(b => b.id === myBranchId)

  // فلترة إضافية حسب القسم لمديري ومشرفي الأقسام (بعد فلترة الفرع)
  const deptScopedRequests = (() => {
    if (isDeptManager || isSupervisor) {
      const myDeptNormalized = normalizeDept(myDept) ||
        (role.includes('kitchen') ? 'المطبخ' : role.includes('hall') ? 'الصالة' : role.includes('bar') ? 'البار' : '')
      return branchRequests.filter(r => normalizeDept(r.department) === myDeptNormalized)
    }
    return branchRequests
  })()

  // تعريف التابات حسب الدور
  const allTabs = [
    {
      label: isAr ? 'طلبات المشرفين' : 'Requests',
      icon: '👷',
      statuses: ['pending'],
      show: true,
      filter: (r: BranchRequest) => ['pending'].includes(r.status)
    },
    {
      label: isAr ? 'معتمد - للمستودع' : 'Approved',
      icon: '👨‍💼',
      statuses: ['manager_approved','branch_approved'],
      show: isAdmin || isBranchManager || isDeptManager || isWarehouse,
      filter: (r: BranchRequest) => ['manager_approved','branch_approved'].includes(r.status)
    },
    {
      label: isAr ? 'تجهيز المستودع' : 'Warehouse',
      icon: '🏭',
      statuses: ['warehouse_processing'],
      show: isAdmin || isBranchManager || isDeptManager || isSupervisor || isWarehouse,
      filter: (r: BranchRequest) => r.status === 'warehouse_processing'
    },
    {
      label: isAr ? 'الاستلام والتسليم' : 'Delivery',
      icon: '🎉',
      // ✅ جديد: أضفنا "partial" (معلّق) هنا كمان - استلام جزئي بسبب نقص كمية في المستودع
      statuses: ['supervisor_received','manager_received','partial'],
      show: true,
      filter: (r: BranchRequest) => ['supervisor_received','manager_received','partial'].includes(r.status)
    },
  ]

  const visibleTabs = allTabs.filter(t => t.show)
  const currentTab = visibleTabs[activeTab] || visibleTabs[0]

  const filtered = deptScopedRequests.filter(r => {
    const tabMatch = currentTab?.filter(r) || false
    const searchMatch = !search || r.requested_by?.includes(search) || String(r.request_number).includes(search) || r.department?.includes(search)
    return tabMatch && searchMatch
  })

  const canCreate = [...SUPERVISOR_ROLES,...MANAGER_ROLES,...SENIOR_ROLES].includes(role)
  const canSeeDeptProducts = isAdmin || isWarehouse || isWarehouseManager

  // تقرير مقارن لكل فرع (admin فقط)
  const comparisonReport = branches.map(b => {
    const brReqs = requests.filter(r => r.branch_id === b.id)
    return {
      id: b.id, name: b.name,
      total: brReqs.length,
      pending: brReqs.filter(r => r.status === 'pending').length,
      processing: brReqs.filter(r => ['manager_approved','branch_approved','warehouse_processing'].includes(r.status)).length,
      done: brReqs.filter(r => ['supervisor_received','manager_received'].includes(r.status)).length,
    }
  })

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}} select option{background:#0F2040}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📦 طلبات الفروع</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'نظام طلب المستلزمات من المستودع' : 'Branch supply request system'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canSeeAllBranches && (
            <button onClick={() => setShowReport(true)} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              📊 {isAr ? 'تقرير مقارن' : 'Comparison Report'}
            </button>
          )}
          {canSeeDeptProducts && (
            <button onClick={() => window.open('/dashboard/settings/department-products', '_blank')} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              🏷️ {isAr ? 'مواد الأقسام' : 'Dept Products'}
            </button>
          )}
          {canCreate && (
            <button onClick={async () => {
              const fullName = [employee?.name, employee?.name_en].filter(Boolean).join(' ').trim() || employee?.name || ''
              const { data } = await sb.from('branch_requests')
                .select('*, branch_request_items(*, warehouse_products(name,name_en), units(symbol))')
                .eq('requested_by', fullName)
                .order('created_at', { ascending: false })
                .limit(10)
              setRepeatRequests(data || [])
              setShowRepeat(true)
            }} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              🔁 {isAr ? 'طلب متكرر' : 'Repeat'}
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowNew(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              ➕ {isAr ? 'طلب جديد' : 'New Request'}
            </button>
          )}
        </div>
      </div>

      {/* ✅ جديد: تبديل بين طلبات الفروع والتبادل بين الفروع */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setMainView('requests')}
          style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${mainView === 'requests' ? S.gold : S.border}`, background: mainView === 'requests' ? S.gold3 : 'transparent', color: mainView === 'requests' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: mainView === 'requests' ? 700 : 400 }}>
          📦 {isAr ? 'طلبات الفروع' : 'Branch Requests'}
        </button>
        {(SUPERVISOR_ROLES.includes(role) || MANAGER_ROLES.includes(role) || ['warehouse_keeper', 'warehouse_manager'].includes(role) || isAdmin) && (
          <button onClick={() => setMainView('exchange')}
            style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${mainView === 'exchange' ? S.gold : S.border}`, background: mainView === 'exchange' ? S.gold3 : 'transparent', color: mainView === 'exchange' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: mainView === 'exchange' ? 700 : 400 }}>
            🔄 {isAr ? 'التبادل بين الفروع' : 'Inter-Branch Exchange'}
          </button>
        )}
      </div>

      {mainView === 'requests' && (
      <>

      {/* Branch Tabs */}
      {visibleBranches.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {canSeeAllBranches && (
            <button onClick={() => setActiveBranch('')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${activeBranch === '' ? S.gold : S.border}`, background: activeBranch === '' ? S.gold3 : 'transparent', color: activeBranch === '' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === '' ? 700 : 400 }}>
              🌐 {isAr ? 'الإجمالي (الكل)' : 'All Branches'}
            </button>
          )}
          {visibleBranches.map(b => (
            <button key={b.id} onClick={() => setActiveBranch(b.id)}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${activeBranch === b.id ? S.gold : S.border}`, background: activeBranch === b.id ? S.gold3 : 'transparent', color: activeBranch === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === b.id ? 700 : 400 }}>
              🏪 {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: isAr ? 'قيد الانتظار' : 'Pending', count: deptScopedRequests.filter(r=>r.status==='pending').length, color: S.amber, bg: S.amberB, icon: '⏳' },
          { label: isAr ? 'معتمدة' : 'Approved', count: deptScopedRequests.filter(r=>['manager_approved','branch_approved'].includes(r.status)).length, color: S.blue, bg: S.blueB, icon: '👨‍💼' },
          { label: isAr ? 'بالمستودع' : 'In Warehouse', count: deptScopedRequests.filter(r=>r.status==='warehouse_processing').length, color: S.orange, bg: S.orangeB, icon: '🏭' },
          { label: isAr ? 'مكتملة' : 'Done', count: deptScopedRequests.filter(r=>['supervisor_received','manager_received'].includes(r.status)).length, color: S.green, bg: S.greenB, icon: '✅' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {visibleTabs.map((tab, i) => {
          const count = deptScopedRequests.filter(tab.filter).length
          return (
            <button key={i} onClick={() => setActiveTab(i)}
              style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${activeTab===i ? S.gold : S.border}`, background: activeTab===i ? S.gold3 : 'transparent', color: activeTab===i ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab===i ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.icon} {tab.label}
              {count > 0 && <span style={{ background: activeTab===i ? S.gold : S.amber, color: activeTab===i ? S.navy : S.navy, borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input style={{ ...inp, maxWidth: 400 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم أو رقم الطلب أو القسم..." />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 14, color: S.muted }}>{isAr ? 'لا توجد طلبات في هذا التاب' : 'No requests in this tab'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(req => (
            <RequestCard key={req.id} req={req} role={role} onOpen={() => setSelected(req)} />
          ))}
        </div>
      )}

      </>
      )}

      {mainView === 'exchange' && (
        <ExchangeTab employee={employee} branches={branches} sb={sb} isAr={isAr} isAdmin={isAdmin} />
      )}

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} currentEmployee={employee} />}
      {selected && <RequestDetailModal request={selected} currentEmployee={employee} onClose={() => setSelected(null)} onUpdate={() => { setSelected(null); fetchAll() }} />}

      {/* Repeat Request Modal */}
      {showRepeat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.teal}40`, width: '100%', maxWidth: 500, maxHeight: '85vh', overflow: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ color: S.teal, fontSize: 16, fontWeight: 800 }}>🔁 {isAr ? 'طلباتي السابقة' : 'Previous Requests'}</h2>
              <button onClick={() => setShowRepeat(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: S.muted, marginBottom: 16 }}>{isAr ? 'اضغط على أي طلب لإعادة إرساله بنفس المنتجات' : 'Tap any request to resubmit with the same items'}</p>
            {repeatRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: S.muted }}>لا توجد طلبات سابقة</div>
            ) : repeatRequests.map(r => (
              <div key={r.id} style={{ background: S.navy3, borderRadius: 12, border: `1px solid ${S.border}`, padding: 14, marginBottom: 10, cursor: 'pointer', transition: 'border .2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = `1px solid ${S.teal}`}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = `1px solid ${S.border}`}
                onClick={async () => {
                  if (!r.branch_request_items?.length) { alert('الطلب لا يحتوي على منتجات'); return }
                  const fullName = [employee?.name, employee?.name_en].filter(Boolean).join(' ').trim() || employee?.name || ''
                  const { data: newReq, error } = await sb.from('branch_requests').insert([{
                    branch_id: r.branch_id,
                    department: r.department,
                    requested_by: fullName,
                    status: 'pending',
                    notes: r.notes,
                  }]).select('id').single()
                  if (error || !newReq) { alert('خطأ: ' + error?.message); return }
                  await sb.from('branch_request_items').insert(
                    r.branch_request_items!.map(item => ({
                      request_id: newReq.id,
                      product_id: item.warehouse_products ? (item as any).product_id : undefined,
                      quantity_requested: item.quantity_requested,
                      unit_id: (item as any).unit_id || undefined,
                    }))
                  )
                  setShowRepeat(false)
                  fetchAll()
                  alert('✅ تم إنشاء الطلب بنجاح')
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: S.white, fontSize: 13 }}>طلب #{r.request_number} · {r.department}</span>
                  <span style={{ fontSize: 11, color: S.muted }}>{new Date(r.created_at).toLocaleDateString('ar-SA')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {r.branch_request_items?.slice(0, 3).map((item, i) => (
                    <div key={i} style={{ fontSize: 12, color: S.muted }}>
                      • {item.warehouse_products?.name} — {item.quantity_requested} {item.units?.symbol || ''}
                    </div>
                  ))}
                  {(r.branch_request_items?.length || 0) > 3 && (
                    <div style={{ fontSize: 11, color: S.muted }}>+ {(r.branch_request_items?.length || 0) - 3} منتج آخر</div>
                  )}
                </div>
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: S.teal, fontWeight: 700 }}>🔁 إعادة إرسال هذا الطلب</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Report Modal */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 600, padding: 28, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>📊 {isAr ? 'تقرير مقارن — كل الفروع' : 'Comparison Report — All Branches'}</h2>
              <button onClick={() => setShowReport(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: S.navy3, borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: S.card2 }}>
                    {[isAr ? 'الفرع' : 'Branch', isAr ? 'الإجمالي' : 'Total', isAr ? 'قيد الانتظار' : 'Pending', isAr ? 'قيد التنفيذ' : 'Processing', isAr ? 'مكتملة' : 'Done'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonReport.map(r => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.white, fontWeight: 700 }}>🏪 {r.name}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.blue, fontWeight: 700 }}>{r.total}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.amber }}>{r.pending}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.orange }}>{r.processing}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.green }}>{r.done}</td>
                    </tr>
                  ))}
                  <tr style={{ background: S.gold3 }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>🌐 {isAr ? 'الإجمالي الكلي' : 'Grand Total'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 14, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.total,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.pending,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.processing,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.done,0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button onClick={() => setShowReport(false)} style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إغلاق' : 'Close'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
