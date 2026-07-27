'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

const ALLOWED_ROLES = ['admin', 'warehouse_keeper', 'warehouse_manager']

type Product = {
  id: string; name: string; name_en?: string; category: string
  current_stock: number; warehouse_id: string
}

export default function FixMissingUnitsPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee, permissions, loading: authLoading } = useAuth()
  const isAdmin = permissions?.all === true
  const canAccess = isAdmin || ALLOWED_ROLES.includes(employee?.role || '')

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; name: string; symbol: string }[]>([])
  const [conversionsByProduct, setConversionsByProduct] = useState<Record<string, any[]>>({})
  const [fixedCount, setFixedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedUnit, setSelectedUnit] = useState('')
  const [saving, setSaving] = useState(false)
  // ✅ جديد: وحدات فرعية اختيارية (معاملات تحويل) تتحدد في نفس الخطوة
  const [subUnits, setSubUnits] = useState<{ unitId: string; factor: string }[]>([{ unitId: '', factor: '' }])
  const [reviewWarnings, setReviewWarnings] = useState<{ name: string; warehouseName: string; note: string }[]>([])
  const [done, setDone] = useState(false)

  // ✅ جديد: تاب "كميات مشبوهة" - أرقام سالبة أو ضخمة بشكل غير منطقي
  const [mainTab, setMainTab] = useState<'missing_units' | 'suspicious_qty' | 'warehouse_diff'>('missing_units')
  const [suspiciousProducts, setSuspiciousProducts] = useState<(Product & { unit_symbol?: string })[]>([])
  const [loadingSuspicious, setLoadingSuspicious] = useState(false)
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null)
  const [editingQtyValue, setEditingQtyValue] = useState('')

  // ✅ جديد: تاب "مقارنة المستودعات" - أصناف موجودة في مستودع وناقصة من مستودع تاني، مع إمكانية إضافتها بنفس وحدتها
  const [diffWarehouseA, setDiffWarehouseA] = useState('')
  const [diffWarehouseB, setDiffWarehouseB] = useState('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffMissingItems, setDiffMissingItems] = useState<{ id: string; name: string; name_en?: string; category: string; unit_id: string | null; unit_symbol?: string }[]>([])
  const [diffAddedIds, setDiffAddedIds] = useState<Set<string>>(new Set())
  const [diffAddingId, setDiffAddingId] = useState<string | null>(null)

  // ✅ نجيب فرق الأصناف بين المستودعين المختارين (اللي في A ومش موجود في B، بمطابقة الاسم بعد تنظيفه)
  const fetchWarehouseDiff = useCallback(async () => {
    if (!diffWarehouseA || !diffWarehouseB || diffWarehouseA === diffWarehouseB) { setDiffMissingItems([]); return }
    setDiffLoading(true)
    const [resA, resB] = await Promise.all([
      sb.from('warehouse_products').select('id,name,name_en,category,unit_id,units(symbol)').eq('warehouse_id', diffWarehouseA).eq('is_active', true),
      sb.from('warehouse_products').select('name').eq('warehouse_id', diffWarehouseB).eq('is_active', true),
    ])
    const namesInB = new Set((resB.data || []).map((p: any) => p.name.trim().toLowerCase()))
    const missing = (resA.data || [])
      .filter((p: any) => !namesInB.has(p.name.trim().toLowerCase()))
      .map((p: any) => ({ id: p.id, name: p.name, name_en: p.name_en, category: p.category, unit_id: p.unit_id, unit_symbol: p.units?.symbol }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ar'))
    setDiffMissingItems(missing)
    setDiffAddedIds(new Set())
    setDiffLoading(false)
  }, [sb, diffWarehouseA, diffWarehouseB])

  useEffect(() => { if (mainTab === 'warehouse_diff') fetchWarehouseDiff() }, [mainTab, diffWarehouseA, diffWarehouseB, fetchWarehouseDiff])

  // ✅ إضافة الصنف الناقص للمستودع B بنفس اسمه ووحدته، مع نسخ أي معامل تحويل مسجّل له
  async function addMissingToWarehouseB(item: { id: string; name: string; name_en?: string; category: string; unit_id: string | null }) {
    setDiffAddingId(item.id)
    const { data: newProd, error } = await sb.from('warehouse_products').insert([{
      name: item.name, name_en: item.name_en || null, category: item.category || null,
      unit_id: item.unit_id, warehouse_id: diffWarehouseB, current_stock: 0, is_active: true,
    }]).select('id').single()
    if (error || !newProd) { alert('حصل خطأ أثناء الإضافة: ' + (error?.message || '')); setDiffAddingId(null); return }
    // ✅ نسخ أي معاملات تحويل مسجّلة للصنف الأصلي (لو موجودة) للنسخة الجديدة في المستودع B
    const { data: origConvs } = await sb.from('unit_conversions').select('from_unit_id, to_unit_id, factor').eq('product_id', item.id)
    if (origConvs && origConvs.length > 0) {
      await sb.from('unit_conversions').insert(origConvs.map(c => ({ ...c, product_id: newProd.id })))
    }
    setDiffAddedIds(prev => new Set(prev).add(item.id))
    setDiffAddingId(null)
  }

  const fetchSuspicious = useCallback(async () => {
    setLoadingSuspicious(true)
    // ✅ بنجيب كل الأصناف اللي ليها وحدة أساسية ونفلتر في الكود، عشان شرط "الوحدة = غرام" مش بيتفلتر بسهولة
    // على مستوى قاعدة البيانات لما يكون جوه علاقة مرتبطة (units) في نفس الاستعلام
    const { data } = await sb.from('warehouse_products')
      .select('id,name,name_en,category,current_stock,warehouse_id,units(symbol)')
      .eq('is_active', true)
      .not('unit_id', 'is', null)
      .order('current_stock', { ascending: true })
    const filtered = (data || []).filter((p: any) => {
      const symbol = p.units?.symbol || ''
      const isGram = symbol === 'غرام' || symbol.toLowerCase() === 'g' || symbol.toLowerCase() === 'gram'
      return p.current_stock < 0 // رصيد سالب
        || p.current_stock > 100 // ✅ Fix: كان الحد 5000، دلوقتي 100 حسب طلبك
        || (isGram && p.current_stock > 0 && p.current_stock < 900) // ✅ Fix: استثناء الصفر - يعني ببساطة نفاد الصنف، وهذا طبيعي وليس خطأً
    })
    setSuspiciousProducts(filtered.map((p: any) => ({ ...p, unit_symbol: p.units?.symbol })))
    setLoadingSuspicious(false)
  }, [sb])

  async function saveQtyFix(productId: string, oldQty: number) {
    const val = parseFloat(editingQtyValue)
    if (isNaN(val)) { alert('من فضلك أدخل رقم صحيح'); return }
    if (!confirm(`⚠️ هل أنت متأكد من تعديل الرصيد من ${oldQty} إلى ${val}؟`)) return
    const diff = val - oldQty
    if (diff === 0) { setEditingQtyId(null); return }
    // ✅ جديد: نسجل التصحيح كحركة مخزون موثقة (زي حركات الجرد بالظبط) بدل تعديل الرصيد مباشرة بصمت
    // الـ trigger الموجود أصلاً بيحدّث current_stock تلقائيًا لما نسجل الحركة، فمش محتاجين نعدّله يدويًا
    const { error } = await sb.from('stock_movements').insert([{
      product_id: productId,
      warehouse_id: suspiciousProducts.find(p => p.id === productId)?.warehouse_id,
      movement_type: diff > 0 ? 'in' : 'out',
      quantity: Math.abs(diff),
      movement_date: new Date().toISOString().slice(0, 10),
      notes: `تصحيح رصيد مشبوه — تم الاعتماد بواسطة ${employee?.name || 'غير معروف'} — من ${oldQty} إلى ${val}`,
    }])
    if (error) { alert('حصل خطأ: ' + error.message); return }
    setEditingQtyId(null)
    setEditingQtyValue('')
    fetchSuspicious()
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [prodRes, whRes, unitsRes, convRes] = await Promise.all([
      sb.from('warehouse_products').select('id,name,name_en,category,current_stock,warehouse_id').eq('is_active', true).is('unit_id', null).order('name'),
      sb.from('warehouses').select('id,name'),
      sb.from('units').select('id,name,symbol').order('name'),
      sb.from('unit_conversions').select('product_id, from_unit_id, to_unit_id, factor, from_unit:units!unit_conversions_from_unit_id_fkey(symbol), to_unit:units!unit_conversions_to_unit_id_fkey(symbol)'),
    ])
    const prods = prodRes.data || []
    setProducts(prods)
    setTotalCount(prods.length)
    setFixedCount(0)
    setWarehouses(whRes.data || [])
    setUnits(unitsRes.data || [])
    const grouped: Record<string, any[]> = {}
    for (const c of (convRes.data || [])) {
      if (!grouped[c.product_id]) grouped[c.product_id] = []
      grouped[c.product_id].push(c)
    }
    setConversionsByProduct(grouped)
    setLoading(false)
  }, [sb])

  useEffect(() => { if (employee?.id) fetchAll() }, [employee?.id, fetchAll])
  useEffect(() => { if (employee?.id && mainTab === 'suspicious_qty') fetchSuspicious() }, [employee?.id, mainTab, fetchSuspicious])

  const current = products[0]
  const whName = current ? (warehouses.find(w => w.id === current.warehouse_id)?.name || '—') : ''

  async function saveUnit() {
    if (!current || !selectedUnit) return
    setSaving(true)

    // ✅ لو كان فيه معامل تحويل قديم متسجل للصنف مش مطابق للوحدة الجديدة المختارة،
    // الرصيد المعروض سابقًا كان محتمل يكون محسوب بافتراض خاطئ - ننبه المستخدم يراجعه بنفسه
    const existingConvs = conversionsByProduct[current.id] || []
    const matchingConv = existingConvs.find((c: any) => c.from_unit_id === selectedUnit)
    if (existingConvs.length > 0 && !matchingConv) {
      const otherConv = existingConvs[0]
      setReviewWarnings(prev => [...prev, {
        name: current.name,
        warehouseName: whName,
        note: `كان معروض سابقًا بمعامل تحويل غير مرتبط بالوحدة الجديدة (١ ${otherConv.from_unit?.symbol || '?'} = ${otherConv.factor} ${otherConv.to_unit?.symbol || '?'}) — راجع الرصيد (${current.current_stock}) يدويًا للتأكد من صحته بالوحدة الجديدة`,
      }])
    }

    const { error } = await sb.from('warehouse_products').update({ unit_id: selectedUnit }).eq('id', current.id)
    if (error) { setSaving(false); alert('حصل خطأ: ' + error.message); return }

    // ✅ جديد: حفظ أي وحدات فرعية (معاملات تحويل) اتحددت في نفس الخطوة
    const validSubUnits = subUnits.filter(s => s.unitId && parseFloat(s.factor) > 0)
    if (validSubUnits.length > 0) {
      const { error: convErr } = await sb.from('unit_conversions').insert(
        validSubUnits.map(s => ({
          product_id: current.id,
          from_unit_id: s.unitId,
          to_unit_id: selectedUnit,
          factor: parseFloat(s.factor),
        }))
      )
      if (convErr) { alert('تم حفظ الوحدة الأساسية، لكن حصل خطأ في حفظ الوحدات الفرعية: ' + convErr.message) }
    }

    setSaving(false)
    setProducts(prev => prev.slice(1))
    setFixedCount(prev => prev + 1)
    setSelectedUnit('')
    setSubUnits([{ unitId: '', factor: '' }])
    if (products.length <= 1) setDone(true)
  }

  function skipProduct() {
    setProducts(prev => prev.slice(1))
    setSelectedUnit('')
    setSubUnits([{ unitId: '', factor: '' }])
    if (products.length <= 1) setDone(true)
  }

  if (authLoading || loading) {
    return <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, textAlign: 'center', padding: 80 }}>⏳</div>
  }
  if (!canAccess) {
    return (
      <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, textAlign: 'center', padding: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, color: S.muted }}>هذه الصفحة مخصصة لأمين المستودع ومدير المستودعات والإدارة فقط</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, padding: isMobile ? 14 : 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, color: S.gold, marginBottom: 4 }}>🔧 إصلاح سريع — تحديد الوحدة الأساسية للأصناف الناقصة</h1>
      <p style={{ fontSize: 13, color: S.muted, marginBottom: 20 }}>Quick Fix — Missing Base Units</p>

      {/* ✅ جديد: تابات التبديل بين إصلاح الوحدات الناقصة ومراجعة الكميات المشبوهة */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setMainTab('missing_units')}
          style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${mainTab === 'missing_units' ? S.gold : S.border}`, background: mainTab === 'missing_units' ? S.gold3 : 'transparent', color: mainTab === 'missing_units' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: mainTab === 'missing_units' ? 700 : 400 }}>
          🔧 وحدات ناقصة
        </button>
        <button onClick={() => setMainTab('suspicious_qty')}
          style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${mainTab === 'suspicious_qty' ? S.gold : S.border}`, background: mainTab === 'suspicious_qty' ? S.gold3 : 'transparent', color: mainTab === 'suspicious_qty' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: mainTab === 'suspicious_qty' ? 700 : 400 }}>
          📊 كميات مشبوهة
        </button>
        {/* ✅ جديد: زر تاب مقارنة المستودعات */}
        <button onClick={() => setMainTab('warehouse_diff')}
          style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${mainTab === 'warehouse_diff' ? S.gold : S.border}`, background: mainTab === 'warehouse_diff' ? S.gold3 : 'transparent', color: mainTab === 'warehouse_diff' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: mainTab === 'warehouse_diff' ? 700 : 400 }}>
          🔄 مقارنة المستودعات
        </button>
      </div>

      {mainTab === 'suspicious_qty' ? (
        <div>
          <p style={{ fontSize: 12, color: S.muted, marginBottom: 16 }}>
            الأرصدة السالبة، أو أكثر من 100 وحدة، أو أقل من 900 غرام (إذا كانت الوحدة الأساسية غرام) — راجعها وصحّحها مباشرة إذا لزم الأمر
          </p>

          {/* ✅ جديد: إحصائية بعدد الأصناف حسب نوع المشكلة */}
          {!loadingSuspicious && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              <div style={{ background: S.navy2, borderRadius: 12, border: `1px solid ${S.border}`, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: S.white }}>{suspiciousProducts.length}</div>
                <div style={{ fontSize: 11, color: S.muted }}>إجمالي الأصناف المشبوهة</div>
              </div>
              <div style={{ background: S.redB, borderRadius: 12, border: `1px solid ${S.red}40`, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: S.red }}>{suspiciousProducts.filter(p => p.current_stock < 0).length}</div>
                <div style={{ fontSize: 11, color: S.red }}>رصيد سالب</div>
              </div>
              <div style={{ background: S.amberB, borderRadius: 12, border: `1px solid ${S.amber}40`, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: S.amber }}>{suspiciousProducts.filter(p => p.current_stock >= 0).length}</div>
                <div style={{ fontSize: 11, color: S.amber }}>رقم غير منطقي (كبير جدًا أو صغير جدًا)</div>
              </div>
            </div>
          )}

          {loadingSuspicious ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          ) : suspiciousProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 14, color: S.green }}>لا توجد كميات مشبوهة حاليًا</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suspiciousProducts.map(p => {
                const isNegative = p.current_stock < 0
                return (
                  <div key={p.id} style={{ background: S.navy2, borderRadius: 12, border: `1px solid ${isNegative ? S.red : S.amber}40`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>🏪 {warehouses.find(w => w.id === p.warehouse_id)?.name || '—'}</div>
                    </div>
                    {editingQtyId === p.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="number" value={editingQtyValue} onChange={e => setEditingQtyValue(e.target.value)}
                          style={{ width: 100, padding: '6px 8px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }} />
                        <span style={{ fontSize: 12, color: S.muted }}>{p.unit_symbol}</span>
                        <button onClick={() => saveQtyFix(p.id, p.current_stock)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: S.green, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✔️</button>
                        <button onClick={() => setEditingQtyId(null)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: isNegative ? S.red : S.amber }}>{p.current_stock} {p.unit_symbol}</span>
                        <button onClick={() => { setEditingQtyId(p.id); setEditingQtyValue(String(p.current_stock)) }}
                          style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.blue}`, background: 'transparent', color: S.blue, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                          ✏️ تصحيح
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : mainTab === 'warehouse_diff' ? (
        <div>
          <p style={{ fontSize: 12, color: S.muted, marginBottom: 16 }}>
            اختر مستودعًا أولًا (المصدر) ومستودعًا آخر (المقارَن به) — هنعرضلك كل الأصناف الموجودة في الأول وناقصة من التاني، مع وحدتها، وتقدر تضيفها بضغطة واحدة
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 6 }}>🏭 المستودع المصدر (فيه الأصناف)</label>
              <select value={diffWarehouseA} onChange={e => setDiffWarehouseA(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                <option value="">-- اختر --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20, color: S.muted, fontSize: 16 }}>←</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 6 }}>🏭 المستودع الناقص منه (هنضيف له)</label>
              <select value={diffWarehouseB} onChange={e => setDiffWarehouseB(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                <option value="">-- اختر --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          {diffWarehouseA && diffWarehouseA === diffWarehouseB && (
            <div style={{ textAlign: 'center', padding: 20, color: S.amber }}>⚠️ اختر مستودعين مختلفين للمقارنة</div>
          )}

          {diffLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري المقارنة...</div>
          ) : !diffWarehouseA || !diffWarehouseB || diffWarehouseA === diffWarehouseB ? null : diffMissingItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 14, color: S.green }}>كل أصناف المستودع الأول موجودة بالفعل في المستودع التاني</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: S.amber, fontWeight: 700, marginBottom: 12 }}>⚠️ {diffMissingItems.length} صنف ناقص</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {diffMissingItems.map(item => {
                  const isAdded = diffAddedIds.has(item.id)
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isAdded ? S.greenB : S.navy2, borderRadius: 10, border: `1px solid ${isAdded ? S.green + '60' : S.border}`, padding: '10px 14px' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{item.name} {item.name_en && <span style={{ color: S.muted, fontSize: 11 }}>({item.name_en})</span>}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>الوحدة: {item.unit_symbol || '—'} {item.category && `· ${item.category}`}</div>
                      </div>
                      {isAdded ? (
                        <span style={{ fontSize: 12, color: S.green, fontWeight: 700 }}>✅ تمت الإضافة</span>
                      ) : (
                        <button onClick={() => addMissingToWarehouseB(item)} disabled={diffAddingId === item.id}
                          style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: diffAddingId === item.id ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                          {diffAddingId === item.id ? '⏳...' : '➕ إضافة لهذا المستودع'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
      <>
      {/* شريط التقدم */}
      <div style={{ background: S.navy2, borderRadius: 12, padding: '12px 16px', marginBottom: 20, border: `1px solid ${S.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: S.white, fontWeight: 700 }}>{fixedCount} من {totalCount} صنف</span>
          <span style={{ color: S.muted }}>{totalCount - fixedCount} متبقي</span>
        </div>
        <div style={{ height: 8, background: S.navy3, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: totalCount > 0 ? `${(fixedCount / totalCount) * 100}%` : '0%', background: `linear-gradient(90deg, ${S.gold}, ${S.gold2})`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {done || !current ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, color: S.green, fontWeight: 700, marginBottom: 16 }}>
            {totalCount === 0 ? 'لا توجد أصناف ناقصة الوحدة الأساسية 🎉' : `تم الانتهاء! تم تصحيح ${fixedCount} صنف`}
          </div>
          {reviewWarnings.length > 0 && (
            <div style={{ textAlign: 'right', background: S.amberB, border: `1px solid ${S.amber}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: 10 }}>
                ⚠️ {reviewWarnings.length} صنف يحتاج مراجعة الرصيد يدويًا:
              </div>
              {reviewWarnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: S.white, marginBottom: 8, paddingBottom: 8, borderBottom: i < reviewWarnings.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                  <strong>{w.name}</strong> ({w.warehouseName}) — {w.note}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: isMobile ? 16 : 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: S.white }}>{current.name}</div>
            {current.name_en && <div style={{ fontSize: 13, color: S.muted }}>{current.name_en}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ background: S.card, borderRadius: 8, padding: '3px 10px', fontSize: 11, color: S.muted }}>📦 {current.category}</span>
              <span style={{ background: S.card, borderRadius: 8, padding: '3px 10px', fontSize: 11, color: S.muted }}>🏪 {whName}</span>
              <span style={{ background: S.amberB, borderRadius: 8, padding: '3px 10px', fontSize: 11, color: S.amber, fontWeight: 700 }}>الرصيد الحالي: {current.current_stock}</span>
            </div>
          </div>

          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>اختر الوحدة الأساسية الصحيحة:</label>
          <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 15, fontFamily: 'Tajawal, sans-serif', marginBottom: 16 }}>
            <option value="">-- اختر الوحدة --</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.symbol} ({u.name})</option>)}
          </select>

          {/* ✅ جديد: وحدات فرعية اختيارية - إذا كان الصنف يُشترى أو يُطلب بوحدة أخرى غير الوحدة الأساسية */}
          {selectedUnit && (
            <div style={{ marginBottom: 16, background: S.card, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>
                🔁 وحدات فرعية (اختياري) — إذا كان الصنف يُشترى أو يُطلب بوحدة أخرى غير "{units.find(u => u.id === selectedUnit)?.symbol}"
              </div>
              {subUnits.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: S.white, whiteSpace: 'nowrap' }}>1</span>
                  <select value={s.unitId} onChange={e => setSubUnits(p => p.map((x, xi) => xi === i ? { ...x, unitId: e.target.value } : x))}
                    style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                    <option value="">اختر وحدة الشراء/الطلب</option>
                    {units.filter(u => u.id !== selectedUnit).map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                  </select>
                  <span style={{ fontSize: 12, color: S.white, whiteSpace: 'nowrap' }}>=</span>
                  <input type="number" min="0" step="0.01" placeholder="عدد" value={s.factor} onChange={e => setSubUnits(p => p.map((x, xi) => xi === i ? { ...x, factor: e.target.value } : x))}
                    style={{ width: 70, boxSizing: 'border-box', padding: '7px 8px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif' }} />
                  <span style={{ fontSize: 12, color: S.muted, whiteSpace: 'nowrap' }}>{units.find(u => u.id === selectedUnit)?.symbol}</span>
                  {subUnits.length > 1 && (
                    <button onClick={() => setSubUnits(p => p.filter((_, xi) => xi !== i))}
                      style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 6, color: S.red, cursor: 'pointer', padding: '4px 8px', fontSize: 11, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setSubUnits(p => [...p, { unitId: '', factor: '' }])}
                style={{ padding: '5px 12px', borderRadius: 6, border: `1px dashed ${S.gold}`, background: 'transparent', color: S.gold, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                ➕ إضافة وحدة فرعية أخرى
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={skipProduct}
              style={{ padding: '12px 20px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
              تخطي الآن
            </button>
            <button onClick={saveUnit} disabled={!selectedUnit || saving}
              style={{ flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none', background: S.gold, color: S.navy, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: (!selectedUnit || saving) ? 0.5 : 1 }}>
              {saving ? '⏳ جاري الحفظ...' : '✔️ حفظ والتالي'}
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
