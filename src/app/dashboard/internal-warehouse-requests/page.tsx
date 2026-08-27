'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
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

// ✅ بعض الموظفين القدامى مسجل قسمهم بالإنجليزي في قاعدة البيانات (Hall/Kitchen/Bar)
// بدل العربي (الصالة/المطبخ/البار) — هذه الدالة توحّد القيمتين كمتساويتين
// ✅ جديد: بناء الاسم الكامل للموظف (الاسم + الاسم الإنجليزي لو موجود) بدل الاعتماد على الاسم الأول بس،
// بنفس النمط المستخدم في ملف طلبات الفروع (exFullName)
function fullEmployeeName(e: { name?: string; name_en?: string } | null | undefined): string {
  if (!e) return ''
  return [e.name, e.name_en].filter(Boolean).join(' ')
}

function normalizeDept(dept: string | null | undefined): string {
  const map: Record<string, string> = {
    'hall': 'الصالة', 'kitchen': 'المطبخ', 'bar': 'البار',
    'desserts': 'الحلويات', 'cleaning': 'النظافة', 'admin': 'الإدارة',
  }
  const key = (dept || '').trim().toLowerCase()
  return map[key] || (dept || '').trim()
}

// ✅ Fix: تطبيع نص البحث العربي — يوحّد أشكال الحروف المختلفة (أ/إ/آ/ا، ة/ه، ى/ي) ويشيل التشكيل والمسافات الزائدة
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

interface InternalRequest {
  id: string; created_at: string; request_number: number
  branch_id: string; department: string; status: string
  notes?: string; requested_by: string
  approved_by?: string; approved_at?: string
  rejected_by?: string; rejected_at?: string; rejection_reason?: string
  branches?: { name: string }
  internal_warehouse_request_items?: {
    id: string; quantity_requested: number; quantity_approved?: number
    notes?: string; is_cancelled?: boolean
    warehouse_products?: { name: string; name_en?: string }
    units?: { symbol: string }
  }[]
}

// ══ Request Card ══
function RequestCard({ req, role, onOpen }: { req: InternalRequest; role: string; onOpen: () => void }) {
  const statusColors: Record<string,{color:string;bg:string;icon:string;label:string}> = {
    pending:   { color: S.amber, bg: S.amberB, icon: '⏳', label: 'قيد الانتظار' },
    approved:  { color: S.green, bg: S.greenB, icon: '✅', label: 'تمت الموافقة والخصم' },
    rejected:  { color: S.red,   bg: S.redB,   icon: '❌', label: 'مرفوض' },
    partial:   { color: S.orange, bg: S.orangeB, icon: '⏸️', label: 'معلّق' },
  }
  const st = statusColors[req.status] || statusColors.pending
  const needsAction = ['warehouse_keeper','warehouse_manager'].includes(role) && req.status === 'pending'

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
          <div style={{ fontSize: 15, fontWeight: 700, color: S.blue }}>{req.internal_warehouse_request_items?.length || 0}</div>
          <div style={{ fontSize: 10, color: S.muted }}>صنف</div>
        </div>
        <div style={{ fontSize: 11, color: S.muted }}>{new Date(req.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</div>
        <div style={{ fontSize: 16, color: S.muted }}>←</div>
      </div>
    </div>
  )
}

function NewRequestModal({ onClose, onSaved, currentEmployee }: { onClose: () => void; onSaved: () => void; currentEmployee: any }) {
  const sb = createClient()
  const [saving, setSaving] = useState(false)
  const [allDeptProducts, setAllDeptProducts] = useState<Record<string, any[]>>({ المطبخ: [], البار: [], الصالة: [] })
  const [branchWarehouseProductIds, setBranchWarehouseProductIds] = useState<Set<string>>(new Set())
  const [units, setUnits] = useState<any[]>([])
  const [unitConversions, setUnitConversions] = useState<any[]>([])
  const [items, setItems] = useState<{ product_id: string; product_name: string; product_name_en?: string; available_locally: boolean; qty: string; unit_id: string; base_unit_id: string; notes: string }[]>([{ product_id: '', product_name: '', available_locally: true, qty: '', unit_id: '', base_unit_id: '', notes: '' }])
  const [search, setSearch] = useState('')
  const [activeDeptTab, setActiveDeptTab] = useState('المطبخ')
  const [monthlyConsumption, setMonthlyConsumption] = useState<Record<string, number>>({})
  const role = currentEmployee?.role || ''
  const autoDept = role.includes('kitchen') ? 'المطبخ' : role.includes('hall') ? 'الصالة' : role.includes('bar') ? 'البار' : normalizeDept(currentEmployee?.department)
  const [form, setForm] = useState({ department: autoDept, requested_by: fullEmployeeName(currentEmployee) || '', notes: '' })

  // ✅ Fix: الكائن currentEmployee القادم من useAuth() ممكن ميحتويش عمود name_en (حسب الحقول اللي
  // الـ AuthProvider بيجيبها)، حتى لو موجود فعليًا في قاعدة البيانات - فبنجيب بيانات الموظف
  // مباشرة هنا للتأكد من توفر name_en، ونحدّث حقل "مقدم الطلب" تلقائيًا لو لسه ماتغيّرش يدويًا
  useEffect(() => {
    if (!currentEmployee?.id) return
    sb.from('employees').select('name, name_en').eq('id', currentEmployee.id).maybeSingle().then(({ data }) => {
      if (!data) return
      const full = fullEmployeeName(data)
      if (full) setForm(p => (p.requested_by === fullEmployeeName(currentEmployee) || p.requested_by === (currentEmployee?.name || '') || !p.requested_by) ? { ...p, requested_by: full } : p)
    })
  }, [currentEmployee?.id])

  useEffect(() => {
    const branchId = currentEmployee?.branch_id
    if (!branchId) return

    // 1) جلب id مستودع الفرع أولاً (قبل جلب الأصناف، لاستخدامه في اختيار النسخة الصحيحة من كل صنف)
    let branchWarehouseId = ''
    sb.from('warehouses').select('id').eq('branch_id', branchId).maybeSingle()
      .then(({ data: wh }) => {
        if (wh?.id) {
          branchWarehouseId = wh.id
          sb.from('warehouse_products').select('id').eq('is_active', true).eq('warehouse_id', wh.id)
            .then(({ data }) => setBranchWarehouseProductIds(new Set((data || []).map((p: any) => p.id))))
        }
        // 2) جلب كل أصناف كل الأقسام (من أي مستودع)، موحدة بالاسم — مع تفضيل نسخة مستودع الفرع بالذات
        // ✅ Fix: السبب الجذري لفشل الخصم الفعلي عند الموافقة كان أخذ "أول نسخة" بترتيب عشوائي
        // من Promise.all (غالبًا المستودع الرئيسي) بدل نسخة مستودع الفرع الصحيحة، فكان الـ product_id
        // المحفوظ يشاور على مستودع مختلف تمامًا عن مستودع الطالب، فيفشل الخصم بهدوء عند الموافقة.
        return Promise.all(['المطبخ', 'البار', 'الصالة'].map(dept =>
          sb.from('department_products')
            .select('product_id, warehouse_products(id,name,name_en,product_code,current_stock,unit_id,warehouse_id,units(symbol),is_active)')
            .eq('department', dept)
            .then(({ data }) => ({ dept, data: data || [] }))
        ))
      }).then(results => {
      if (!results) return
      const grouped: Record<string, any[]> = { المطبخ: [], البار: [], الصالة: [] }
      for (const { dept, data } of results) {
        const seen = new Map<string, any>() // مفتاح: الاسم بعد التنظيف، قيمة: النسخة المختارة من الصنف
        for (const row of data) {
          const wp = (row as any).warehouse_products
          if (!wp) continue
          // ✅ Fix حرج: تجاهل الأصناف الموقّفة (is_active = false) بالكامل - قبل هذا التعديل
          // كانت الأصناف المحذوفة (حذف ناعم Soft Delete) لسه بتظهر للموظفين وهم بيعملوا طلب جديد
          // رغم إنها مختفية من صفحة المستودع نفسها، لأن هذا الاستعلام مكنش بيفلتر عليها
          if (wp.is_active === false) continue
          const cleanName = (wp.name || '').trim()
          if (!cleanName) continue
          // ✅ Fix: لا نعرض أي صنف غير مسجَّل في مستودع فرع الموظف نفسه، بدل عرض نسخة من مستودع
          // آخر (كان يسبب التباسًا على الموظف بخصوص الوحدة الظاهرة). إن لم يكن الصنف مسجَّلًا
          // في مستودع الفرع، فلا يظهر إطلاقًا بدل الاعتماد على بديل من مستودع آخر
          if (!branchWarehouseId || wp.warehouse_id !== branchWarehouseId) continue
          const existing = seen.get(cleanName)
          if (!existing) {
            seen.set(cleanName, wp)
          }
        }
        grouped[dept] = Array.from(seen.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
      }
      setAllDeptProducts(grouped)
    })

    sb.from('units').select('*').order('name').then(({ data }) => setUnits(data || []))
    // ✅ جديد: جلب كل معاملات التحويل عشان نستخدمها في قفل الوحدة المسموحة لكل صنف
    sb.from('unit_conversions').select('product_id, from_unit_id, to_unit_id, factor').then(({ data }) => setUnitConversions(data || []))

    // ✅ Fix: الاستهلاك الشهري كان بيحسب آخر 30 يوم بالرجوع للخلف من تاريخ اليوم، فكانت الأرقام
    // بتشمل حركات قديمة (بعضها كان متأثر بأخطاء التحويل القديمة قبل الإصلاحات). المطلوب:
    // تصفير العداد والبدء من تاريخ اليوم بالتحديد، مع تراكم الاستهلاك من هذا التاريخ فصاعدًا
    // في الأيام القادمة (تاريخ ثابت مقصود، وليس new Date() متحرّك، عشان العداد يتراكم فعليًا
    // بدل ما يفضل يعرض "اليوم بس" كل مرة يعاد تحميل الصفحة)
    const since = '2026-08-04'
    sb.from('stock_movements').select('product_id, quantity').eq('movement_type', 'out').gte('movement_date', since)
      .then(({ data }) => {
        const totals: Record<string, number> = {}
        for (const m of (data || [])) {
          totals[m.product_id] = (totals[m.product_id] || 0) + (m.quantity || 0)
        }
        setMonthlyConsumption(totals)
      })
  }, [])

  const currentDeptProducts = allDeptProducts[activeDeptTab] || []
  // ✅ جديد: تنسيق الاستهلاك الشهري بالوحدة الأساسية والوحدة الفرعية (زي كرتون + عبوة)
  // بدل رقم عشري طويل غير مقروء (مثال: 0.2454542154515) وبدل عرض المخزون المحلي نهائيًا
  // (تمت إزالة عرض المخزون بناءً على طلب المستخدم - الاستهلاك الشهري بس هو المطلوب هنا)
  function formatConsumption(p: any) {
    const total = monthlyConsumption[p.id] || 0
    const directConv = unitConversions.find((c: any) => c.product_id === p.id && c.from_unit_id === p.unit_id)
    const fallbackConv = unitConversions.find((c: any) => c.product_id === p.id)
    const conv = directConv || fallbackConv
    const baseUnitSymbol = p.units?.symbol || ''
    if (!conv || !conv.factor || conv.factor <= 1) {
      return `${Math.round(total * 100) / 100} ${baseUnitSymbol}`
    }
    const factor = conv.factor
    const storedInBig = conv.from_unit_id === p.unit_id
    let bigQty: number, smallQty: number
    if (storedInBig) {
      bigQty = Math.floor(total)
      smallQty = Math.round((total - bigQty) * factor * 100) / 100
    } else {
      bigQty = Math.floor(total / factor)
      smallQty = Math.round((total % factor) * 100) / 100
    }
    const bigUnitSym = (units.find((u: any) => u.id === conv.from_unit_id) as any)?.symbol || baseUnitSymbol
    const smallUnitSym = (units.find((u: any) => u.id === conv.to_unit_id) as any)?.symbol || baseUnitSymbol
    if (bigQty === 0 && smallQty !== 0) return `${smallQty} ${smallUnitSym}`
    if (smallQty === 0) return `${bigQty} ${bigUnitSym}`
    return `${bigQty} ${bigUnitSym} و ${smallQty} ${smallUnitSym}`
  }
  // ✅ جديد: الوحدات المسموحة لصنف معيّن = وحدته الأساسية + أي وحدة فرعية مسجّل لها معامل تحويل حقيقي لنفس الصنف
  // عشان نمنع مقدّم الطلب من اختيار وحدة عشوائية غلط زي ما كان بيحصل قبل كده
  function validUnitsForProduct(productId: string, baseUnitId?: string) {
    const relevantUnitIds = new Set<string>()
    if (baseUnitId) relevantUnitIds.add(baseUnitId)
    for (const c of unitConversions) {
      if (c.product_id !== productId) continue
      relevantUnitIds.add(c.from_unit_id)
      relevantUnitIds.add(c.to_unit_id)
    }
    return units.filter(u => relevantUnitIds.has(u.id))
  }
  // ✅ Fix: قائمة موحّدة بكل الأصناف من كل الأقسام (بدون تكرار بالاسم) — تُستخدم وقت وجود نص بحث فعلي
  // عشان البحث يلاقي أي صنف حتى لو مش مربوط بالقسم النشط حاليًا، بدل قصر البحث على تبويب واحد فقط
  const allProductsFlat = useMemo(() => {
    const seen = new Map<string, any>()
    for (const list of Object.values(allDeptProducts)) {
      for (const p of list) if (!seen.has(p.id)) seen.set(p.id, p)
    }
    return Array.from(seen.values())
  }, [allDeptProducts])

  async function save() {
    const branchId = currentEmployee?.branch_id
    if (!branchId || !form.department || !form.requested_by) { alert('يرجى إكمال البيانات'); return }
    if (items.some(i => !i.product_id || !i.qty)) { alert('يرجى إكمال الأصناف'); return }
    setSaving(true)
    const { data: req, error } = await sb.from('internal_warehouse_requests').insert([{
      branch_id: branchId, department: form.department, requested_by: form.requested_by, notes: form.notes || null, status: 'pending'
    }]).select().single()
    if (error) { alert('خطأ: ' + error.message); setSaving(false); return }
    for (const item of items) {
      await sb.from('internal_warehouse_request_items').insert([{ request_id: req.id, product_id: item.product_id, quantity_requested: parseFloat(item.qty), unit_id: item.unit_id || null, notes: item.notes || null }])
    }
    setSaving(false); onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 680, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>🏭 طلب من المستودع الداخلي</h2>
            <p style={{ fontSize: 12, color: S.muted }}>سيُرسل الطلب لأمين المستودع في الفرع للاعتماد المباشر</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>القسم *</label>
            <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">-- اختر --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>مقدم الطلب *</label>
            <input style={inp} value={form.requested_by} onChange={e => setForm(p => ({ ...p, requested_by: e.target.value }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
        </div>
        {/* تابات الأقسام */}
        <div style={{ background: S.navy3, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 12 }}>📦 اختر الأصناف من القسم</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {['المطبخ','البار','الصالة'].map(dept => (
              <button key={dept} onClick={() => setActiveDeptTab(dept)}
                style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${activeDeptTab===dept ? S.gold : S.border}`, background: activeDeptTab===dept ? S.gold3 : 'transparent', color: activeDeptTab===dept ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: activeDeptTab===dept ? 700 : 400 }}>
                {dept==='المطبخ'?'🍳':dept==='البار'?'🍹':'🪑'} {dept}
              </button>
            ))}
          </div>
          <input style={{ ...inp, marginBottom: 12, fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم أو الكود (مثال: OR001)..." />
          {!search && currentDeptProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: S.muted, fontSize: 12 }}>لا توجد أصناف محددة لهذا القسم</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {(search ? allProductsFlat : currentDeptProducts)
                .filter(p => matchesSearch(p.name, search) || matchesSearch(p.name_en, search) || matchesSearch(p.product_code, search))
                .map(p => {
                const isSelected = items.some(it => it.product_id === p.id)
                const availableLocally = branchWarehouseProductIds.has(p.id)
                return (
                  <div key={p.id} onClick={() => {
                    if (isSelected) setItems(prev => prev.filter(it => it.product_id !== p.id))
                    else {
                      const unitId = p.unit_id || (p.units ? units.find((u:any) => u.symbol === p.units?.symbol)?.id||'' : '')
                      // ✅ Fix: نحفظ الوحدة الأساسية للصنف ونقفل عليها كقيمة افتراضية، عشان مقدّم الطلب ميختارش وحدة غلط
                      setItems(prev => [...prev.filter(it => it.product_id !== ''), { product_id: p.id, product_name: p.name, product_name_en: p.name_en, available_locally: availableLocally, qty: '', unit_id: unitId, base_unit_id: unitId, notes: '' }])
                    }
                  }} style={{ background: isSelected ? S.gold3 : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${isSelected ? S.gold : !availableLocally ? S.amber+'40' : S.border}`, padding: '10px 12px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ flex: 1 }}>
                        {p.product_code && (
                          <span style={{ display: 'inline-block', background: S.gold3, color: S.gold, borderRadius: 6, padding: '1px 6px', fontSize: 9, fontWeight: 700, fontFamily: 'system-ui', marginBottom: 3 }}>{p.product_code}</span>
                        )}
                        <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? S.gold : S.white }}>{p.name}</div>
                        {p.name_en && <div style={{ fontSize: 10, color: S.muted, direction: 'ltr', textAlign: 'right' }}>{p.name_en}</div>}
                      </div>
                      {isSelected && <span style={{ color: S.gold, fontSize: 13 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 10, color: S.muted }}>
                      📊 استهلاك شهري: {formatConsumption(p)}
                    </div>
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
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: `1px solid ${item.available_locally ? S.border : S.amber+'40'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.white }}>{item.product_name}</div>
                      {item.product_name_en && <div style={{ fontSize: 10, color: S.muted, direction: 'ltr', textAlign: 'right' }}>{item.product_name_en}</div>}
                    </div>
                    <button onClick={() => setItems(p => p.filter((_,idx) => idx!==i))} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input type="number" style={{ ...inp, direction: 'ltr', fontSize: 12 }} value={item.qty} onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, qty: e.target.value } : it))} placeholder="الكمية" />
                    {/* ✅ Fix: الوحدة مقفولة على الوحدات الصحيحة المسجّلة لهذا الصنف فقط (الأساسية + أي وحدة فرعية لها معامل تحويل حقيقي) */}
                    {(() => {
                      const validUnits = validUnitsForProduct(item.product_id, item.base_unit_id)
                      if (validUnits.length <= 1) {
                        return (
                          <div style={{ ...inp, background: S.navy3, display: 'flex', alignItems: 'center', color: S.gold, fontWeight: 700, fontSize: 12 }}>
                            🔒 {validUnits[0]?.name || units.find(u => u.id === item.unit_id)?.name || 'الوحدة'}
                          </div>
                        )
                      }
                      return (
                        <select style={{ ...inp, cursor: 'pointer', background: S.navy3, fontSize: 12 }} value={item.unit_id} onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, unit_id: e.target.value } : it))}>
                          {validUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      )
                    })()}
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

// ══ Request Detail Modal ══
function RequestDetailModal({ request, currentEmployee, onClose, onUpdate }: { request: InternalRequest; currentEmployee: any; onClose: () => void; onUpdate: () => void }) {
  const sb = createClient()
  const { isAr } = useLang()
  const [updating, setUpdating] = useState(false)
  // ✅ جديد: قفل فوري (Ref) بيمنع تنفيذ approve() مرتين متتاليتين بسرعة (Double-click)
  // - حالة setUpdating لوحدها مش كافية لأن تحديثها في React مش فوري، فضغطتين سريعتين جدًا
  // ممكن يعدّوا الاتنين قبل ما الزرار يتقفل فعليًا، ويسببوا خصم الكمية مرتين (زي اللي حصل مع طلب فرع #151)
  const approvingRef = useRef(false)
  const [actionBy, setActionBy] = useState(fullEmployeeName(currentEmployee) || '')
  // ✅ Fix: نفس إصلاح مقدّم الطلب - نجيب name_en مباشرة من قاعدة البيانات لضمان ظهور الاسم الكامل
  // حتى لو الكائن القادم من useAuth() ميحتويش عليه
  useEffect(() => {
    if (!currentEmployee?.id) return
    sb.from('employees').select('name, name_en').eq('id', currentEmployee.id).maybeSingle().then(({ data }) => {
      if (!data) return
      const full = fullEmployeeName(data)
      if (full) setActionBy(prev => (prev === fullEmployeeName(currentEmployee) || prev === (currentEmployee?.name || '') || !prev) ? full : prev)
    })
  }, [currentEmployee?.id])
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>(
    Object.fromEntries((request.internal_warehouse_request_items || []).map(i => [i.id, i.quantity_requested]))
  )
  // ✅ إضافة جديدة: السماح لأمين المستودع بتصحيح الوحدة (لو الموظف مقدّم الطلب أدخل وحدة خاطئة)
  const [units, setUnits] = useState<any[]>([])
  const [editedUnits, setEditedUnits] = useState<Record<string, string>>(
    Object.fromEntries((request.internal_warehouse_request_items || []).map(i => [i.id, (i as any).unit_id || '']))
  )
  // ✅ جديد: التحقق من توفر الكمية قبل الاعتماد الفعلي + إمكانية استبعاد صنف واحد بعينه من الطلب
  const [shortfalls, setShortfalls] = useState<{ itemId: string; name: string; requestedInBase: number; available: number; unitSymbol: string }[] | null>(null)
  const [cancelledItems, setCancelledItems] = useState<Set<string>>(new Set())
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  useEffect(() => {
    sb.from('units').select('*').order('name').then(({ data }) => setUnits(data || []))
  }, [])
  const role = currentEmployee?.role || ''

  const canApprove = ['warehouse_keeper','warehouse_manager'].includes(role) && request.status === 'pending'
  // ✅ جديد: السماح باستكمال طلب "معلّق" (partial) عشان أمين المستودع يحاول يعتمد الأصناف
  // المستبعدة فقط تاني (لو وصل المخزون) - متغيّر منفصل عمدًا عن canApprove عشان مايأثرش
  // على أي مكان تاني بيستخدم canApprove (زي زر الرفض) بدون قصد
  const canResume = ['warehouse_keeper','warehouse_manager'].includes(role) && request.status === 'partial'
  const isResuming = request.status === 'partial'

  async function approve() {
    if (!actionBy.trim()) { alert('يرجى إدخال اسمك'); return }
    // ✅ Fix حرج: قفل فوري يمنع أي تنفيذ تاني لنفس الطلب لو الدالة شغالة بالفعل - يحمي من الضغط المتكرر السريع
    if (approvingRef.current) return
    approvingRef.current = true
    setUpdating(true)
    setCheckingAvailability(true)

    // 1) جلب مستودع الفرع الخاص بهذا الطلب
    const { data: wh, error: whErr } = await sb.from('warehouses').select('id').eq('branch_id', request.branch_id).maybeSingle()
    if (whErr || !wh?.id) { alert('لم يتم العثور على مستودع لهذا الفرع'); approvingRef.current = false; setUpdating(false); setCheckingAvailability(false); return }

    // ✅ Fix (جذري - مرحلة ١): نتحقق من كل الأصناف الأول من غير ما نخصم أي حاجة خالص
    // (كل شيء أو ولا حاجة - عشان مانخصمش لأصناف نجحت ثم نكتشف صنف فشل بعدهم فيفضل المخزون في حالة ناقصة)
    const failedItems: string[] = []
    // ✅ جديد: أصناف اتحذفت نهائيًا (Soft Delete) من مستودع الفرع - بتظهر بس أثناء استكمال طلب
    // معلّق (isResuming)؛ بنستبعدها بشكل دائم من الطلب بدل ما توقف الاستكمال أو تخلي الطلب
    // يفضل "معلّق" للأبد في انتظار صنف مش هيرجع موجود تاني
    const permanentlyGoneItems: { itemId: string; name: string }[] = []
    // ✅ جديد: أصناف الكمية المطلوبة فيها أكبر من المتاح فعليًا في المستودع - نوقف ونعرض تنبيه تفاعلي بدل ما نرفض الطلب كله
    const newShortfalls: { itemId: string; name: string; requestedInBase: number; available: number; unitSymbol: string }[] = []
    const plannedMovements: { product_id: string; warehouse_id: string; movement_type: 'out'; quantity: number; movement_date: string; notes: string }[] = []
    const plannedUpdates: { itemId: string; payload: any }[] = []

    for (const item of (request.internal_warehouse_request_items || [])) {
      // ✅ جديد: تجاهل أي صنف تم استبعاده يدويًا من أمين المستودع بالكامل
      if (cancelledItems.has(item.id)) continue
      // ✅ Fix حرج جدًا: لو الطلب "معلّق" (استكمال بعد استبعاد جزئي)، نتجاهل تمامًا أي صنف
      // ليس مستبعدًا حاليًا في قاعدة البيانات (يعني اتخصم بنجاح في المحاولة السابقة) - عشان
      // لا نعيد خصمه مرة ثانية ونسبب خصمًا مضاعفًا لنفس الصنف. فقط الأصناف اللي لسه
      // is_cancelled = true هي اللي تُعاد محاولتها.
      if (isResuming && (item as any).is_cancelled !== true) continue

      const requestedQty = approvedQtys[item.id] ?? item.quantity_requested
      // ✅ Fix (نهائي وبسيط): ندور على الصنف بالاسم في مستودع الفرع اللي طالب
      // بدل الاعتماد على product_id المحفوظ (ممكن يكون لفرع تاني)
      const { data: srcWp } = await sb.from('warehouse_products')
        .select('name').eq('id', (item as any).product_id).maybeSingle()
      const itemName = srcWp?.name || (item as any).product_name || ''

      let wp: any = null
      if (itemName) {
        // ✅ Fix: نجيب كل أصناف المستودع ونقارن الأسماء بعد تنظيفها من المسافات الزايدة في الطرفين
        // (كان فيه أصناف متسجلة بمسافة زايدة في آخر الاسم، فالمطابقة الدقيقة .ilike كانت بتفشل وتمنع الاعتماد بالغلط)
        // ✅ جديد: نستبعد الأصناف الموقّفة (is_active = false) من المطابقة - صنف محذوف حذفًا ناعمًا
        // لازم يُعامل كأنه "غير موجود" فعليًا، مش يتم الخصم منه وكأنه لسه موجود
        const { data: candidates } = await sb.from('warehouse_products')
          .select('id, unit_id, warehouse_id, name, current_stock, units(symbol), is_active')
          .eq('warehouse_id', wh.id).eq('is_active', true)
        wp = (candidates || []).find((c: any) => c.name.trim().toLowerCase() === itemName.trim().toLowerCase()) || null
      }
      if (!wp) {
        // ✅ جديد: أثناء استكمال طلب معلّق تحديدًا، لو الصنف مش موجود (اتحذف نهائيًا)، نستبعده
        // بشكل دائم من الطلب بدل ما نوقف الاستكمال بالكامل بسببه - عشان الطلب يقدر يترحّل
        // لـ"معتمدة" لو باقي الأصناف تمام، بدل ما يفضل عالق في "معلّق" لصنف مش هيرجع موجود
        if (isResuming) {
          permanentlyGoneItems.push({ itemId: item.id, name: itemName || (item as any).product_id })
          continue
        }
        failedItems.push(`${itemName || (item as any).product_id} — لم يتم العثور على هذا الصنف في مستودع هذا الفرع`)
        continue
      }
      // ✅ Fix: لو وحدة الطلب (item.unit_id) مختلفة عن الوحدة الأساسية للصنف (wp.unit_id)،
      // نحوّل الكمية باستخدام unit_conversions المطابقة تحديدًا لوحدة الطلب
      // (الصنف ممكن يكون له أكثر من معادلة تحويل، مثل كرتون→كيلو وكرتون→غرام، فلازم نحدد المطابق بالذات)
      let qty = requestedQty
      // ✅ إضافة: لو أمين المستودع صحّح الوحدة (لأن مقدّم الطلب أدخلها غلط)، نستخدم الوحدة المصحَّحة بدل الأصلية
      const itemUnitId = editedUnits[item.id] || (item as any).unit_id
      // ✅ Fix: نحتفظ بمعامل التحويل واتجاهه عشان نقدر نعرض "المطلوب/المتاح" لأمين المستودع بنفس وحدة
      // الطلب الأصلية (اللي كتبها مقدّم الطلب وشافها في الشاشة)، مش بوحدة التخزين الداخلية للمستودع
      // (كان بيظهر مثلاً "0.17 طرد" بدل "2 علبة" رغم أن الرقمين يمثلان نفس الكمية بالظبط)
      let convFactor: number | null = null
      let convDirection: 'multiply' | 'divide' | null = null
      if (itemUnitId && wp.unit_id && itemUnitId !== wp.unit_id) {
        const { data: conv } = await sb.from('unit_conversions')
          .select('from_unit_id, to_unit_id, factor')
          .eq('product_id', wp.id)
          .or(`and(from_unit_id.eq.${itemUnitId},to_unit_id.eq.${wp.unit_id}),and(from_unit_id.eq.${wp.unit_id},to_unit_id.eq.${itemUnitId})`)
          .maybeSingle()
        if (conv) {
          if (conv.from_unit_id === itemUnitId && conv.to_unit_id === wp.unit_id) {
            qty = requestedQty * conv.factor
            convFactor = conv.factor; convDirection = 'multiply'
          } else if (conv.to_unit_id === itemUnitId && conv.from_unit_id === wp.unit_id) {
            qty = requestedQty / conv.factor
            convFactor = conv.factor; convDirection = 'divide'
          }
          // ✅ Fix: تقريب النتيجة لـ 6 خانات عشرية عشان نمنع تخزين بواقي دقة الفاصلة العشرية
          // في JavaScript (مثال: 1 ÷ 6 = 0.16666666666666666) مباشرة في قاعدة البيانات
          qty = Math.round(qty * 1000000) / 1000000
        } else {
          // ✅ Fix حرج: لو مفيش معامل تحويل مسجل، نوقف اعتماد الصنف ده تمامًا بدل ما نخصم الرقم الخام غلط
          // (ده كان سبب مباشر لخصم آلاف الوحدات غلط من المخزون - زي طلب "4360 غرام" بيتخصم كأنه 4360 "كرتون")
          failedItems.push(`${wp.name} — لا يوجد معامل تحويل مسجّل من الوحدة المطلوبة إلى وحدة التخزين الأساسية. من فضلك سجّل معامل التحويل أولاً من صفحة المشتريات ثم أعد الاعتماد`)
          continue
        }
      }

      // ✅ Fix: نضيف هامش تسامح ضئيل (epsilon) قبل اعتبارها "نقص فعلي" — بدون هذا الهامش، فروق دقة
      // الفاصلة العشرية البسيطة بين الكمية المحوَّلة (المقرَّبة لـ 6 خانات) والرصيد الفعلي المخزَّن
      // (غير مقرَّب) كانت تُظهر تنبيه "الكمية غير متاحة" رغم أن المخزون كافٍ عمليًا (فرق أصغر من واحد على المليون)
      const EPSILON = 0.000001
      if (qty > (wp.current_stock || 0) + EPSILON) {
        // ✅ نحوّل "المتاح فعليًا" بنفس اتجاه التحويل العكسي، عشان يظهر لأمين المستودع بنفس وحدة الطلب الأصلية
        const availableInRequestUnit = convFactor === null ? (wp.current_stock || 0)
          : convDirection === 'divide' ? (wp.current_stock || 0) * convFactor
          : (wp.current_stock || 0) / convFactor
        newShortfalls.push({
          itemId: item.id, name: wp.name,
          requestedInBase: requestedQty, available: Math.round(availableInRequestUnit * 1000000) / 1000000,
          unitSymbol: units.find(u => u.id === itemUnitId)?.symbol || wp.units?.symbol || '',
        })
        continue
      }

      plannedMovements.push({
        product_id: wp.id,
        warehouse_id: wh.id,
        movement_type: 'out',
        quantity: qty,
        movement_date: new Date().toISOString().slice(0, 10),
        notes: `طلب مستودع داخلي #${request.request_number} — ${request.department}`,
      })
      // ✅ إضافة: تحديث الوحدة كذلك لو أمين المستودع صحّحها، بالإضافة للكمية المعتمدة كما كان
      // ✅ جديد: نصفّر is_cancelled دائمًا هنا (حتى لو أصلاً false) - مهم بشكل خاص عند نجاح
      // إعادة محاولة صنف كان مستبعدًا سابقًا، عشان الشارة والحالة يتحدّثوا صح بعد النجاح
      const updatePayload: any = { quantity_approved: requestedQty, is_cancelled: false }
      if (editedUnits[item.id] && editedUnits[item.id] !== (item as any).unit_id) {
        updatePayload.unit_id = editedUnits[item.id]
      }
      plannedUpdates.push({ itemId: item.id, payload: updatePayload })
    }

    // ✅ Fix (جذري): لو فيه أي صنف فشل، نوقف العملية بالكامل من غير ما نخصم أي حاجة خالص
    if (failedItems.length > 0) {
      approvingRef.current = false
      setUpdating(false)
      setCheckingAvailability(false)
      alert('⚠️ تعذّر اعتماد الطلب بسبب مشاكل في الأصناف التالية:\n\n' + failedItems.join('\n') + '\n\nلم يتم خصم أي كمية ولم يتم اعتماد الطلب.')
      return
    }

    // ✅ جديد: لو فيه أصناف كميتها غير متاحة بالكامل، نوقف ونعرض تنبيه تفاعلي في المنتصف
    // بدل ما نرفض الطلب كله أو نخصم كمية أكبر من المتاح فعليًا
    if (newShortfalls.length > 0) {
      setShortfalls(newShortfalls)
      approvingRef.current = false
      setUpdating(false)
      setCheckingAvailability(false)
      return
    }

    // ✅ مرحلة ٢: كل الأصناف سليمة (حسب الفحص الأولي) - ننفذ الخصم الفعلي وتحديث الأصناف
    // ✅ Fix حرج: نتحقق فعليًا من نتيجة كل عملية إدراج (error) بدل تجاهلها كما كان الحال سابقًا.
    // السبب: تريجر قاعدة البيانات (لمنع الرصيد السالب) ممكن يرفض عملية معيّنة لو الرصيد
    // تغيّر بين لحظة الفحص (فوق) ولحظة التنفيذ الفعلي هنا - بسبب اعتماد متزامن لطلب آخر
    // لنفس الصنف (Race Condition). قبل هذا التعديل، كان الكود بيتجاهل رفض التريجر ويكمل
    // وكأن كل شيء تم بنجاح، فيظهر الطلب "معتمد بالكامل" للمستخدم بينما بعض الأصناف
    // لم تُخصم فعليًا من المخزون - وهذا أخطر من الرصيد السالب نفسه (تضارب بين الشاشة والواقع).
    const raceFailures: { itemId: string; name: string; error: string }[] = []
    for (let i = 0; i < plannedMovements.length; i++) {
      const mv = plannedMovements[i]
      const upd = plannedUpdates[i]
      const { error: mvErr } = await sb.from('stock_movements').insert([mv])
      if (mvErr) {
        const failedItem = (request.internal_warehouse_request_items || []).find(it => it.id === upd.itemId)
        raceFailures.push({ itemId: upd.itemId, name: (failedItem as any)?.warehouse_products?.name || upd.itemId, error: mvErr.message })
        continue
      }
      await sb.from('internal_warehouse_request_items').update(upd.payload).eq('id', upd.itemId)
    }
    // ✅ الأصناف اللي رفضها التريجر تتعامل بنفس أسلوب الأصناف المستبعدة يدويًا - نعلّمها
    // مستبعدة بدل ما تفضل بحالة غير واضحة، والمستخدم بيتنبّه بالتفصيل تحت
    for (const rf of raceFailures) {
      await sb.from('internal_warehouse_request_items').update({ is_cancelled: true, quantity_approved: 0 }).eq('id', rf.itemId)
    }
    // ✅ جديد: تعليم الأصناف المستبعدة في قاعدة البيانات
    for (const itemId of cancelledItems) {
      await sb.from('internal_warehouse_request_items').update({ is_cancelled: true, quantity_approved: 0 }).eq('id', itemId)
    }
    // ✅ جديد: الأصناف المحذوفة نهائيًا (اتحذفت من المستودع) تتعلّم مستبعدة بشكل دائم كمان،
    // لكن عمدًا لا تُحسب ضمن شرط "معلّق" تحت - عشان الطلب يقدر يترحّل لـ"معتمدة" حتى لو
    // فيه صنف ميت مش هيرجع موجود تاني، بدل ما يفضل عالق في "معلّق" للأبد
    for (const g of permanentlyGoneItems) {
      await sb.from('internal_warehouse_request_items').update({ is_cancelled: true, quantity_approved: 0 }).eq('id', g.itemId)
    }

    // 3) تحديث حالة الطلب - "معلّق" لو تم استبعاد صنف واحد على الأقل يدويًا أو بسبب رفض التريجر
    // (الأصناف المحذوفة نهائيًا لا تُحسب هنا عمدًا - انظر التعليق فوق)، وإلا "معتمدة" بالكامل
    const finalStatus = (cancelledItems.size > 0 || raceFailures.length > 0) ? 'partial' : 'approved'
    await sb.from('internal_warehouse_requests').update({
      status: finalStatus, approved_by: actionBy, approved_at: new Date().toISOString(),
    }).eq('id', request.id)

    // ✅ تنبيه واضح للمستخدم لو حصل تعارض توقيت مع طلب آخر لنفس الصنف
    if (raceFailures.length > 0) {
      alert(
        '⚠️ تعذّر خصم الأصناف التالية لأن الرصيد تغيّر أثناء عملية الاعتماد (على الأرجح تم اعتماد طلب آخر لنفس الصنف في نفس اللحظة تقريبًا):\n\n' +
        raceFailures.map(f => `• ${f.name} — ${f.error}`).join('\n') +
        '\n\nتم اعتماد باقي الأصناف بنجاح. يرجى مراجعة الرصيد الحالي لهذه الأصناف وإعادة تقديم طلب جديد لها إذا لزم الأمر.'
      )
    }
    // ✅ تنبيه واضح لو تم استبعاد صنف نهائيًا لأنه محذوف من المستودع
    if (permanentlyGoneItems.length > 0) {
      alert(
        'ℹ️ تم استبعاد الأصناف التالية بشكل دائم من هذا الطلب لأنها لم تعد موجودة في مستودع الفرع (تم حذفها):\n\n' +
        permanentlyGoneItems.map(g => `• ${g.name}`).join('\n') +
        (finalStatus === 'approved' ? '\n\nتم اعتماد باقي الطلب بنجاح.' : '')
      )
    }

    approvingRef.current = false
    setUpdating(false)
    setCheckingAvailability(false)
    onUpdate()
  }

  // ✅ جديد: تعديل الكمية المطلوبة تلقائيًا للحد المتاح فعليًا، عشان أمين المستودع يقدر يعتمد الطلب فورًا بعد التعديل
  function adjustToAvailable(itemId: string, requestedInBase: number, available: number) {
    const item = (request.internal_warehouse_request_items || []).find(i => i.id === itemId)
    if (!item) return
    // نحسب الكمية الجديدة بنفس وحدة الطلب الأصلية (مش وحدة المخزون الأساسية بالضرورة)
    const ratio = available / requestedInBase
    const newQty = Math.max(0, (approvedQtys[itemId] ?? item.quantity_requested) * ratio)
    // ✅ Fix: Math.floor كان بيقص أي نتيجة قريبة جدًا من رقم صحيح للأسفل غلط بسبب دقة الفاصلة
    // العشرية في JavaScript (مثال: 1/6 × 6 = 0.9999999999999999 مش 1 بالظبط) - فكان بيظهر
    // 0.99 بدل 1.00 الصحيحة. Math.round بيتعامل مع الحالة دي صح لأنه بيقرّب لأقرب رقم مش لأسفل دايمًا
    setApprovedQtys(p => ({ ...p, [itemId]: Math.round(newQty * 100) / 100 }))
    setShortfalls(null)
  }

  // ✅ جديد: استبعاد صنف بعينه من الطلب بالكامل (يبقى الطلب "معلّق" ويُعتمد باقي الأصناف)
  function excludeItem(itemId: string) {
    setCancelledItems(prev => new Set(prev).add(itemId))
    setShortfalls(null)
  }

  async function reject() {
    if (!actionBy.trim()) { alert('يرجى إدخال اسمك'); return }
    if (!rejectReason.trim()) { alert('يرجى إدخال سبب الرفض'); return }
    setUpdating(true)
    await sb.from('internal_warehouse_requests').update({
      status: 'rejected', rejected_by: actionBy, rejected_at: new Date().toISOString(), rejection_reason: rejectReason,
    }).eq('id', request.id)
    setUpdating(false)
    onUpdate()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 620, padding: 24, margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ color: S.gold, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>طلب #{request.request_number}</h3>
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
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.gold }}>
            الأصناف ({request.internal_warehouse_request_items?.length || 0})
          </div>
          {(request.internal_warehouse_request_items || []).map((item, i) => {
            const isExcluded = cancelledItems.has(item.id)
            return (
            <div key={i} style={{ padding: '12px 14px', borderBottom: i < (request.internal_warehouse_request_items?.length||0)-1 ? `1px solid ${S.border}` : 'none', opacity: isExcluded ? 0.45 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.white, textDecoration: isExcluded ? 'line-through' : 'none' }}>{item.warehouse_products?.name}</div>
                  {item.warehouse_products?.name_en && <div style={{ fontSize: 11, color: S.muted }}>{item.warehouse_products.name_en}</div>}
                  {item.notes && <div style={{ fontSize: 11, color: S.amber, marginTop: 3 }}>📝 {item.notes}</div>}
                  {isExcluded && <div style={{ fontSize: 11, color: S.red, fontWeight: 700, marginTop: 3 }}>🚫 مستبعد من هذا الاعتماد</div>}
                </div>
                <div style={{ textAlign: 'left', flexShrink: 0 }}>
                  {/* ✅ جديد: أثناء استكمال طلب معلّق (isResuming)، عناصر التحكم (الكمية/الوحدة/الاستبعاد)
                      تظهر فقط للأصناف المستبعدة فعليًا (is_cancelled === true) - أي صنف اتخصم بنجاح
                      من قبل يفضل بعرض للقراءة فقط ولا يظهر له أي زر تعديل نهائيًا */}
                  {(canApprove || (canResume && (item as any).is_cancelled === true)) && !isExcluded ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <input type="number" min="0" value={approvedQtys[item.id] ?? item.quantity_requested}
                        onChange={e => setApprovedQtys(p => ({ ...p, [item.id]: parseFloat(e.target.value) || 0 }))}
                        style={{ width: 80, textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.blue}40`, borderRadius: 8, padding: '6px 8px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'ltr' }} />
                      {/* ✅ إضافة: تعديل الوحدة متاح فقط لأمين المستودع قبل الاعتماد، لتصحيح أي خطأ من مقدّم الطلب */}
                      <select value={editedUnits[item.id] ?? ''} onChange={e => setEditedUnits(p => ({ ...p, [item.id]: e.target.value }))}
                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.amber}40`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.amber, outline: 'none', fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
                        {units.map(u => <option key={u.id} value={u.id} style={{ background: S.navy2, color: S.white }}>{u.symbol || u.name}</option>)}
                      </select>
                      {/* ✅ جديد: استبعاد هذا الصنف بعينه من الطلب - يبقى الطلب "معلّق" ويُعتمد باقي الأصناف */}
                      <button onClick={() => excludeItem(item.id)} title="استبعاد هذا الصنف من الاعتماد"
                        style={{ background: 'transparent', border: `1px solid ${S.red}40`, borderRadius: 8, color: S.red, cursor: 'pointer', fontSize: 12, padding: '6px 8px' }}>
                        🚫
                      </button>
                    </div>
                  ) : isExcluded && (canApprove || canResume) ? (
                    <button onClick={() => setCancelledItems(prev => { const next = new Set(prev); next.delete(item.id); return next })}
                      style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, cursor: 'pointer', fontSize: 11, padding: '6px 10px', fontFamily: 'Tajawal, sans-serif' }}>
                      ↩️ تراجع عن الاستبعاد
                    </button>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.blue }}>{item.quantity_requested} {item.units?.symbol}</div>
                  )}
                  {(item.quantity_approved||0) > 0 && (request.status === 'approved' || request.status === 'partial') && <div style={{ fontSize: 11, color: S.green, marginTop: 4 }}>تم خصم: {item.quantity_approved} {item.units?.symbol}</div>}
                  {(item as any).is_cancelled && <div style={{ fontSize: 11, color: S.red, marginTop: 4 }}>🚫 تم استبعاده من الطلب{canResume ? ' — يمكن إعادة المحاولة أعلاه' : ''}</div>}
                </div>
              </div>
            </div>
            )
          })}
        </div>

        {/* ✅ جديد: تنبيه واضح في المنتصف لو فيه أصناف كميتها غير متاحة بالكامل */}
        {shortfalls && shortfalls.length > 0 && (
          <div style={{ background: S.amberB, border: `1.5px solid ${S.amber}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.amber, marginBottom: 10 }}>⚠️ الكمية المطلوبة غير متاحة بالكامل في المستودع</div>
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
            <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>بعد التعديل أو الاستبعاد، اضغط "موافقة" مرة أخرى لإتمام الاعتماد.</div>
          </div>
        )}
        {request.status === 'rejected' && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}40`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.red, fontWeight: 700, marginBottom: 4 }}>❌ مرفوض بواسطة {request.rejected_by}</div>
            <div style={{ fontSize: 12, color: S.muted }}>السبب: {request.rejection_reason}</div>
          </div>
        )}

        {/* حالة الموافقة */}
        {request.status === 'approved' && (
          <div style={{ background: S.greenB, border: `1px solid ${S.green}40`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.green, fontWeight: 700 }}>✅ تمت الموافقة والخصم من المخزون بواسطة {request.approved_by}</div>
          </div>
        )}

        {/* ✅ جديد: حالة معلّق - تمت الموافقة على جزء من الطلب واستبعاد صنف أو أكثر */}
        {request.status === 'partial' && (
          <div style={{ background: S.amberB, border: `1px solid ${S.amber}40`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.amber, fontWeight: 700 }}>⏸️ معلّق — تم اعتماد وخصم الأصناف المتاحة فقط بواسطة {request.approved_by}، واستُبعد صنف أو أكثر لعدم توفر الكمية</div>
            {canResume && <div style={{ fontSize: 11, color: S.muted, marginTop: 6 }}>يمكنك تعديل الكمية/الوحدة للأصناف المستبعدة أعلاه ثم الضغط على "استكمال الطلب المعلّق" أدناه لإعادة المحاولة.</div>}
          </div>
        )}

        {/* Actions */}
        {/* ✅ جديد: القسم ده بيظهر دلوقتي كمان لما يكون الطلب "معلّق" (canResume) - عشان أمين
            المستودع يقدر يعيد محاولة اعتماد الأصناف المستبعدة بس، مع إخفاء زر الرفض في هذه
            الحالة لأن رفض طلب اتخصم منه جزء فعليًا مش منطقي ولا آمن */}
        {(canApprove || canResume) && !showReject && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>اسمك (أمين المستودع) *</label>
            <input style={{ ...inp, marginBottom: 12 }} value={actionBy} onChange={e => setActionBy(e.target.value)} placeholder="أدخل اسمك..." />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={approve} disabled={updating}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {updating ? '⏳...' : (isResuming ? '🔄 استكمال الطلب المعلّق' : '✅ موافقة وخصم من المخزون')}
              </button>
              {!isResuming && (
                <button onClick={() => setShowReject(true)} disabled={updating}
                  style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  ❌ رفض
                </button>
              )}
            </div>
          </div>
        )}

        {canApprove && showReject && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>اسمك *</label>
            <input style={{ ...inp, marginBottom: 12 }} value={actionBy} onChange={e => setActionBy(e.target.value)} placeholder="أدخل اسمك..." />
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>سبب الرفض *</label>
            <input style={{ ...inp, marginBottom: 12 }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="اكتب سبب الرفض..." />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowReject(false)} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                رجوع
              </button>
              <button onClick={reject} disabled={updating}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {updating ? '⏳...' : '❌ تأكيد الرفض'}
              </button>
            </div>
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
export default function InternalWarehouseRequestsPage() {
  const sb = createClient()
  const { employee } = useAuth()
  const { isAr } = useLang()
  const [requests, setRequests] = useState<InternalRequest[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<InternalRequest|null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [activeBranch, setActiveBranch] = useState<string>('') // '' = الإجمالي (admin فقط)، أو branch_id محدد
  const [showReport, setShowReport] = useState(false)
  const [search, setSearch] = useState('')

  const role = employee?.role || ''
  const myBranchId = employee?.branch_id || ''
  const isAdmin = role === 'admin'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('internal_warehouse_requests')
      .select('*, branches(name), internal_warehouse_request_items(id,product_id,quantity_requested,quantity_approved,unit_id,notes,is_cancelled,warehouse_products(name,name_en),units(symbol))')
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
    if (!isAdmin && role !== 'warehouse_manager' && myBranchId) setActiveBranch(myBranchId)
  }, [isAdmin, role, myBranchId])

  const isBranchManager = role === 'branch_manager'
  const isWarehouseKeeper = role === 'warehouse_keeper'
  // ✅ دور جديد: مدير المستودعات - يشوف ويعالج طلبات كل الفروع مع بعض (زي الأدمن في موضوع رؤية الفروع بس)
  const isWarehouseManager = role === 'warehouse_manager'
  const canSeeAllBranches = isAdmin || isWarehouseManager
  const canCreate = [...SUPERVISOR_ROLES, ...MANAGER_ROLES, ...SENIOR_ROLES].includes(role)

  // طلبات الفرع النشط (أو كل الفروع لو activeBranch فاضي و admin/مدير المستودعات)
  const branchRequests = activeBranch ? requests.filter(r => r.branch_id === activeBranch) : requests
  // الأدوار غير admin/مدير المستودعات تشوف بس تاب فرعها
  const visibleBranches = canSeeAllBranches ? branches : branches.filter(b => b.id === myBranchId)

  // تعريف التابات (الحالة: قيد الانتظار/معتمدة/مرفوضة)
  const allTabs = [
    { label: isAr ? 'قيد الانتظار' : 'Pending', icon: '⏳', show: true, filter: (r: InternalRequest) => r.status === 'pending' },
    { label: isAr ? 'معلّق' : 'On Hold', icon: '⏸️', show: true, filter: (r: InternalRequest) => r.status === 'partial' },
    { label: isAr ? 'معتمدة' : 'Approved', icon: '✅', show: true, filter: (r: InternalRequest) => r.status === 'approved' },
    { label: isAr ? 'مرفوضة' : 'Rejected', icon: '❌', show: true, filter: (r: InternalRequest) => r.status === 'rejected' },
  ]
  const visibleTabs = allTabs.filter(t => t.show)
  const currentTab = visibleTabs[activeTab] || visibleTabs[0]

  const filtered = branchRequests.filter(r => {
    const tabMatch = currentTab?.filter(r) || false
    const searchMatch = !search || r.requested_by?.includes(search) || String(r.request_number).includes(search) || r.department?.includes(search)
    return tabMatch && searchMatch
  })

  // تقرير مقارن لكل فرع (admin فقط)
  const comparisonReport = branches.map(b => {
    const brReqs = requests.filter(r => r.branch_id === b.id)
    return {
      id: b.id, name: b.name,
      total: brReqs.length,
      pending: brReqs.filter(r => r.status === 'pending').length,
      approved: brReqs.filter(r => r.status === 'approved').length,
      rejected: brReqs.filter(r => r.status === 'rejected').length,
    }
  })

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}} select option{background:#0F2040}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🏭 طلبات المستودع الداخلي</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'طلب مستلزمات مباشرة من مستودع الفرع — يحتاج موافقة أمين المستودع' : 'Direct requests from the branch internal warehouse'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canSeeAllBranches && (
            <button onClick={() => setShowReport(true)} style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              📊 {isAr ? 'تقرير مقارن' : 'Comparison Report'}
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowNew(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              ➕ {isAr ? 'طلب جديد' : 'New Request'}
            </button>
          )}
        </div>
      </div>

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
          { label: isAr ? 'قيد الانتظار' : 'Pending', count: branchRequests.filter(r=>r.status==='pending').length, color: S.amber, bg: S.amberB, icon: '⏳' },
          { label: isAr ? 'معلّق' : 'On Hold', count: branchRequests.filter(r=>r.status==='partial').length, color: S.orange, bg: S.orangeB, icon: '⏸️' },
          { label: isAr ? 'معتمدة' : 'Approved', count: branchRequests.filter(r=>r.status==='approved').length, color: S.green, bg: S.greenB, icon: '✅' },
          { label: isAr ? 'مرفوضة' : 'Rejected', count: branchRequests.filter(r=>r.status==='rejected').length, color: S.red, bg: S.redB, icon: '❌' },
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
          const count = branchRequests.filter(tab.filter).length
          return (
            <button key={i} onClick={() => setActiveTab(i)}
              style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${activeTab===i ? S.gold : S.border}`, background: activeTab===i ? S.gold3 : 'transparent', color: activeTab===i ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab===i ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.icon} {tab.label}
              {count > 0 && <span style={{ background: activeTab===i ? S.gold : S.amber, color: S.navy, borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{count}</span>}
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
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 14, color: S.muted }}>{isAr ? 'لا توجد طلبات في هذا التاب' : 'No requests in this tab'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(req => (
            <RequestCard key={req.id} req={req} role={role} onOpen={() => setSelected(req)} />
          ))}
        </div>
      )} 
      {showNew && <NewRequestModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} currentEmployee={employee} />}
      {selected && <RequestDetailModal request={selected} currentEmployee={employee} onClose={() => setSelected(null)} onUpdate={() => { setSelected(null); fetchAll() }} />}

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
                    {[isAr ? 'الفرع' : 'Branch', isAr ? 'الإجمالي' : 'Total', isAr ? 'قيد الانتظار' : 'Pending', isAr ? 'معتمدة' : 'Approved', isAr ? 'مرفوضة' : 'Rejected'].map(h => (
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
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.green }}>{r.approved}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.red }}>{r.rejected}</td>
                    </tr>
                  ))}
                  <tr style={{ background: S.gold3 }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>🌐 {isAr ? 'الإجمالي الكلي' : 'Grand Total'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 14, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.total,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.pending,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.approved,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.rejected,0)}</td>
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
