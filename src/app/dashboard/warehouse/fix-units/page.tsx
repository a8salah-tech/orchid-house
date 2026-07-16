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
            {totalCount === 0 ? 'مفيش أي أصناف ناقصة الوحدة الأساسية 🎉' : `خلصت! صححت ${fixedCount} صنف`}
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

          {/* ✅ جديد: وحدات فرعية اختيارية - لو الصنف بيتشترى أو بيتطلب بوحدة تانية غير الأساسية */}
          {selectedUnit && (
            <div style={{ marginBottom: 16, background: S.card, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>
                🔁 وحدات فرعية (اختياري) — لو الصنف بيتشترى أو بيتطلب بوحدة تانية غير "{units.find(u => u.id === selectedUnit)?.symbol}"
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
                ➕ إضافة وحدة فرعية تانية
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
    </div>
  )
}
