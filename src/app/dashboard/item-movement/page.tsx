'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'

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
const selectOptionStyle = `
  select { color-scheme: dark; }
  select option { background-color: #0F2040; color: #FAFAF8; }
`

interface Branch { id: string; name: string }
interface Warehouse { id: string; name: string; branch_id: string | null }
interface Product {
  id: string; name: string; name_en?: string; product_code?: string
  current_stock: number; warehouse_id: string
  units?: { symbol: string }
}
interface Movement {
  id: string; movement_type: 'in' | 'out'; quantity: number
  movement_date: string; notes: string | null; created_at: string
  invoice_id: string | null; transfer_id: string | null
  destination: string | null; destination_custom: string | null
  running_balance?: number
  invoice_number?: string | null
}

export default function ItemMovementPage() {
  const sb = createClient()
  const { permissions, employee } = useAuth()
  // Fix: فتح الصفحة لمدير المستودعات كمان (warehouse_manager) - كانت مقصورة على permissions.all بس
  const isAdmin = permissions?.all === true
  const canAccess = isAdmin || employee?.role === 'warehouse_manager'

  const [branches, setBranches] = useState<Branch[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<Movement[]>([])

  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [conversionNote, setConversionNote] = useState<string | null>(null)

  useEffect(() => {
    sb.from('branches').select('id,name').eq('is_active', true).order('name').then(({ data }) => setBranches(data || []))
    sb.from('warehouses').select('id,name,branch_id').eq('is_active', true).order('name').then(({ data }) => setWarehouses(data || []))
  }, [])

  const visibleWarehouses = useMemo(() => {
    if (selectedBranch === '') return warehouses.filter(w => !w.branch_id)
    return warehouses.filter(w => w.branch_id === selectedBranch)
  }, [selectedBranch, warehouses])

  useEffect(() => {
    setSelectedWarehouse('')
    setSelectedProduct(null)
    setProducts([])
    setMovements([])
  }, [selectedBranch])

  useEffect(() => {
    if (!selectedWarehouse) { setProducts([]); return }
    sb.from('warehouse_products')
      .select('id,name,name_en,product_code,current_stock,warehouse_id,units(symbol)')
      .eq('warehouse_id', selectedWarehouse)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setProducts((data as any) || []))
    setSelectedProduct(null)
    setMovements([])
  }, [selectedWarehouse])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.name_en || '').toLowerCase().includes(q) ||
      (p.product_code || '').toLowerCase().includes(q)
    )
  }, [products, productSearch])

  const fetchMovements = useCallback(async (product: Product) => {
    setLoading(true)
    const { data } = await sb.from('stock_movements')
      .select('id,movement_type,quantity,movement_date,notes,created_at,invoice_id,transfer_id,destination,destination_custom')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })

    const rows = (data || []) as Movement[]

    const invoiceIds = [...new Set(rows.map(r => r.invoice_id).filter(Boolean))] as string[]
    if (invoiceIds.length > 0) {
      const { data: invoices } = await sb.from('purchase_invoices').select('id,invoice_number').in('id', invoiceIds)
      const invMap = Object.fromEntries((invoices || []).map((inv: any) => [inv.id, inv.invoice_number]))
      rows.forEach(r => { if (r.invoice_id) r.invoice_number = invMap[r.invoice_id] || null })
    }

    let runningBalance = product.current_stock
    for (let i = 0; i < rows.length; i++) {
      rows[i].running_balance = runningBalance
      runningBalance = rows[i].movement_type === 'in'
        ? runningBalance - rows[i].quantity
        : runningBalance + rows[i].quantity
    }
    setMovements(rows)
    setLoading(false)
  }, [])

  function getSourceLabel(m: Movement): { label: string; icon: string } {
    if (m.invoice_id) return { label: `فاتورة مشتريات${m.invoice_number ? ' #' + m.invoice_number : ''}`, icon: '🧾' }
    if (m.transfer_id) return { label: 'تحويل بين مستودعات', icon: '🔄' }
    if (m.notes?.includes('طلب فرع')) return { label: 'طلب فرع', icon: '📦' }
    if (m.notes?.includes('طلب مستودع داخلي')) return { label: 'طلب مستودع داخلي', icon: '🏭' }
    if (m.notes?.includes('تصحيح يدوي') || m.notes?.includes('تم تصحيحه')) return { label: 'تصحيح يدوي', icon: '✏️' }
    if (m.notes?.includes('جرد')) return { label: 'جرد مخزون', icon: '📋' }
    if (m.destination_custom) return { label: m.destination_custom, icon: '📤' }
    if (m.destination) return { label: m.destination, icon: '📤' }
    return { label: 'حركة يدوية', icon: '📝' }
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p)
    fetchMovements(p)
    sb.from('unit_conversions').select('from_unit_id, to_unit_id, factor, units_from:units!unit_conversions_from_unit_id_fkey(symbol), units_to:units!unit_conversions_to_unit_id_fkey(symbol)')
      .eq('product_id', p.id).maybeSingle()
      .then(({ data }: any) => {
        if (data) setConversionNote(`1 ${data.units_from?.symbol || ''} = ${data.factor} ${data.units_to?.symbol || ''}`)
        else setConversionNote(null)
      })
  }

  async function saveCorrection() {
    if (!selectedProduct) return
    const newVal = parseFloat(editValue)
    if (isNaN(newVal)) { alert('يرجى إدخال قيمة صحيحة'); return }
    if (!editReason.trim()) { alert('يرجى إدخال سبب التصحيح'); return }
    setSaving(true)
    const diff = newVal - selectedProduct.current_stock
    if (diff !== 0) {
      await sb.from('stock_movements').insert([{
        product_id: selectedProduct.id,
        warehouse_id: selectedProduct.warehouse_id,
        movement_type: diff > 0 ? 'in' : 'out',
        quantity: Math.abs(diff),
        movement_date: new Date().toISOString().slice(0, 10),
        notes: `تصحيح يدوي: ${editReason}`,
      }])
    }
    setSaving(false)
    setShowEdit(false)
    setEditValue('')
    setEditReason('')
    const { data: updated } = await sb.from('warehouse_products')
      .select('id,name,name_en,product_code,current_stock,warehouse_id,units(symbol)')
      .eq('id', selectedProduct.id)
      .maybeSingle()
    if (updated) {
      setSelectedProduct(updated as any)
      setProducts(prev => prev.map(p => p.id === updated.id ? (updated as any) : p))
      fetchMovements(updated as any)
    }
  }

  function printReport() {
    if (!selectedProduct) return
    const branchName = selectedBranch ? branches.find(b => b.id === selectedBranch)?.name : 'المستودع الرئيسي'
    const warehouseName = warehouses.find(w => w.id === selectedWarehouse)?.name || ''
    const rows = movements.map(m => {
      const src = getSourceLabel(m)
      return `<tr>
      <td>${new Date(m.created_at).toLocaleString('ar-SA')}</td>
      <td style="color:${m.movement_type === 'in' ? '#16A34A' : '#DC2626'}">${m.movement_type === 'in' ? '📥 دخول' : '📤 خروج'}</td>
      <td>${m.quantity} ${selectedProduct.units?.symbol || ''}</td>
      <td>${m.running_balance ?? '—'} ${selectedProduct.units?.symbol || ''}</td>
      <td>${src.icon} ${src.label}</td>
      <td>${m.notes || '—'}</td>
    </tr>`
    }).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html dir="rtl"><head><title>حركة صنف — ${selectedProduct.name}</title>
      <style>
        body { font-family: Tajawal, Arial, sans-serif; padding: 24px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: right; }
        th { background: #f3f3f3; }
      </style></head>
      <body>
        <h1>📜 حركة صنف: ${selectedProduct.name} ${selectedProduct.name_en ? '/ ' + selectedProduct.name_en : ''}</h1>
        <div class="meta">
          الفرع: ${branchName} — المستودع: ${warehouseName} — الكود: ${selectedProduct.product_code || '—'}<br/>
          الكمية الحالية: ${selectedProduct.current_stock} ${selectedProduct.units?.symbol || ''}<br/>
          تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}
        </div>
        <table>
          <thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الرصيد بعد الحركة</th><th>المصدر</th><th>ملاحظات إضافية</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  if (!canAccess) {
    return (
      <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 64 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: S.red }}>غير مصرح بالوصول</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>
      <style>{selectOptionStyle}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📜 حركة صنف</h1>
        <p style={{ fontSize: 13, color: S.muted }}>عرض السجل الكامل لحركة صنف معين، مع إمكانية الطباعة والتصحيح المباشر</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>🏪 الفرع</label>
          <select style={{ ...inp, cursor: 'pointer' }} value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
            <option value="">🏭 المستودع الرئيسي (بدون فرع)</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>🏭 المستودع</label>
          <select style={{ ...inp, cursor: visibleWarehouses.length ? 'pointer' : 'not-allowed' }} value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} disabled={!visibleWarehouses.length}>
            <option value="">-- اختر المستودع --</option>
            {visibleWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>🔍 بحث عن صنف</label>
          <input style={inp} value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="اسم الصنف أو الكود..." disabled={!selectedWarehouse} />
        </div>
      </div>

      {selectedWarehouse && !selectedProduct && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
          {filteredProducts.length === 0 ? (
            <div style={{ color: S.muted, padding: 20, textAlign: 'center', gridColumn: '1 / -1' }}>لا توجد أصناف مطابقة</div>
          ) : filteredProducts.map(p => (
            <div key={p.id} onClick={() => selectProduct(p)}
              style={{ background: S.card, borderRadius: 12, border: `1px solid ${S.border}`, padding: '12px 14px', cursor: 'pointer' }}>
              {p.product_code && <span style={{ display: 'inline-block', background: S.gold3, color: S.gold, borderRadius: 6, padding: '1px 6px', fontSize: 9, fontWeight: 700, marginBottom: 4 }}>{p.product_code}</span>}
              <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{p.name}</div>
              {p.name_en && <div style={{ fontSize: 11, color: S.muted }}>{p.name_en}</div>}
              <div style={{ fontSize: 12, color: p.current_stock > 0 ? S.green : S.red, marginTop: 6, fontWeight: 700 }}>{p.current_stock} {p.units?.symbol}</div>
            </div>
          ))}
        </div>
      )}

      {selectedProduct && (
        <div>
          <div style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <button onClick={() => { setSelectedProduct(null); setMovements([]) }} style={{ background: 'transparent', border: 'none', color: S.muted, cursor: 'pointer', fontSize: 12, marginBottom: 6 }}>← رجوع لقائمة الأصناف</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedProduct.product_code && <span style={{ background: S.gold3, color: S.gold, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{selectedProduct.product_code}</span>}
                <span style={{ fontSize: 16, fontWeight: 800, color: S.white }}>{selectedProduct.name}</span>
                {selectedProduct.name_en && <span style={{ fontSize: 12, color: S.muted }}>{selectedProduct.name_en}</span>}
              </div>
              <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>
                الكمية الحالية: <span style={{ color: selectedProduct.current_stock >= 0 ? S.green : S.red, fontWeight: 800 }}>{selectedProduct.current_stock} {selectedProduct.units?.symbol}</span>
                <span style={{ marginRight: 12, marginLeft: 12 }}>·</span>
                الوحدة الأساسية المخزّنة بها: <span style={{ color: S.gold, fontWeight: 700 }}>{selectedProduct.units?.symbol || '—'}</span>
              </div>
              {conversionNote && (
                <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>ℹ️ {conversionNote} (للعلم فقط — الكمية المخزّنة دائمًا بالوحدة الأساسية أعلاه)</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setEditValue(String(selectedProduct.current_stock)); setShowEdit(true) }}
                style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                ✏️ تعديل / تصحيح الكمية
              </button>
              <button onClick={printReport}
                style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                🖨️ طباعة
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
          ) : movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد حركات مسجلة لهذا الصنف</div>
          ) : (
            <div style={{ background: S.navy3, borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: S.card2 }}>
                    {['التاريخ', 'النوع', 'الكمية', 'الرصيد بعد الحركة', 'المصدر', 'ملاحظات إضافية'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => {
                    const src = getSourceLabel(m)
                    return (
                      <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>{new Date(m.created_at).toLocaleString('ar-SA')}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>
                          <span style={{ background: m.movement_type === 'in' ? S.greenB : S.redB, color: m.movement_type === 'in' ? S.green : S.red, borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                            {m.movement_type === 'in' ? '📥 دخول' : '📤 خروج'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: S.white }}>{m.quantity} <span style={{ fontSize: 11, color: S.muted, fontWeight: 400 }}>{selectedProduct?.units?.symbol}</span></td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: (m.running_balance ?? 0) >= 0 ? S.green : S.red }}>{m.running_balance} <span style={{ fontSize: 11, fontWeight: 400, color: S.muted }}>{selectedProduct?.units?.symbol}</span></td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: S.blue, fontWeight: 600 }}>{src.icon} {src.label}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>{m.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showEdit && selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 420, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>✏️ تصحيح الكمية</h2>
              <button onClick={() => setShowEdit(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>الكمية الحالية: {selectedProduct.current_stock} {selectedProduct.units?.symbol}</label>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>الكمية الصحيحة الجديدة *</label>
              <input style={inp} type="number" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="0" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>سبب التصحيح *</label>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="مثال: تصحيح خطأ تحويل وحدات لطلب رقم..." />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowEdit(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button onClick={saveCorrection} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳...' : '✅ حفظ التصحيح'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
