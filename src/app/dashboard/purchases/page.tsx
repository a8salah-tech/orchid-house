'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
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

function formatMYR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return 'MYR ' + new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}

interface Product { id: string; name: string; name_en?: string; category: string; current_stock: number; last_purchase_price: number; units?: { symbol: string }; warehouse_id?: string }
interface Supplier { id: string; name: string; phone?: string }
interface Unit { id: string; name: string; symbol: string }
interface Invoice {
  id: string; sys_number?: number; invoice_number: string; invoice_date: string
  total_amount: number; status: string; image_url: string; notes: string
  warehouse_suppliers?: { name: string }; warehouses?: { name: string }; created_at: string
}
interface InvoiceItem {
  product_id: string; product_name: string
  quantity: string; unit_price: string; unit_id: string; matched: boolean
  contents_per_unit?: number; contents_unit_name?: string
  contents_manual?: string
}

// ── AI Scanner ──
async function scanInvoiceWithAI(base64Image: string, products: Product[]): Promise<{
  supplier_name: string; invoice_number: string; invoice_date: string
  items: { name: string; quantity: number; unit_price: number }[]; notes: string
}> {
  const response = await fetch('/api/scan-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, products })
  })
  const result = await response.json()
  if (!result.success) throw new Error(result.error)
  return result.data
}

// ══════════════════════════════════════════
// ProductSearchInput — بحث ذكي للأصناف
// ══════════════════════════════════════════
function ProductSearchInput({ products, value, productName, matched, onChange, onAddNew, loading }: {
  products: Product[]
  value: string
  productName: string
  matched: boolean
  onChange: (id: string, name: string, lastPrice: number) => void
  onAddNew: (name: string) => void
  loading?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const selectedName = value ? (products.find(p => p.id === value)?.name || productName) : productName

  const filtered = query.trim().length === 0
    ? products.slice(0, 50)
    : products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.name_en || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 30)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(p: Product) {
    onChange(p.id, p.name, p.last_purchase_price || 0)
    setQuery(''); setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    const total = filtered.length + (query.trim() ? 1 : 0)
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, total - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted < filtered.length) { if (filtered[highlighted]) handleSelect(filtered[highlighted]) }
      else { onAddNew(query.trim()); setOpen(false); setQuery('') }
    } else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{
            ...inp,
            borderColor: matched ? S.green : open ? S.gold : 'rgba(255,255,255,0.10)',
            paddingLeft: 36,
          }}
          placeholder={selectedName || 'ابحث عن الصنف...'}
          value={open ? query : selectedName}
          onChange={e => { setQuery(e.target.value); setHighlighted(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
        {matched && !open && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: S.green }}>✓</span>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 999,
          background: S.navy2, border: `1px solid ${S.gold}`,
          borderRadius: 12, marginTop: 4,
          maxHeight: 260, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {loading ? (
            <div style={{ padding: '14px 16px', fontSize: 12, color: S.muted, textAlign: 'center' }}>
              ⏳ جاري تحميل أصناف المستودع...
            </div>
          ) : (
          <>
          {query.trim() === '' && (
            <div style={{ padding: '7px 12px', borderBottom: `1px solid ${S.border}`, fontSize: 11, color: S.muted }}>
              اكتب للبحث — {products.length} صنف متاح
            </div>
          )}

          {filtered.length === 0 && query.trim() !== '' ? (
            <div style={{ padding: '12px 16px', fontSize: 13, color: S.muted, textAlign: 'center' }}>
              لا نتائج لـ "<strong style={{ color: S.white }}>{query}</strong>"
            </div>
          ) : filtered.map((p, i) => (
            <div
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                padding: '9px 14px', cursor: 'pointer',
                background: highlighted === i ? 'rgba(201,168,76,0.12)' : value === p.id ? 'rgba(34,197,94,0.08)' : 'transparent',
                borderBottom: `1px solid ${S.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: S.white, fontWeight: value === p.id ? 700 : 400 }}>
                  {value === p.id && <span style={{ color: S.green, marginLeft: 6 }}>✓ </span>}
                  {p.name}
                </div>
                {p.name_en && <div style={{ fontSize: 11, color: S.muted }}>{p.name_en}</div>}
              </div>
              <div style={{ textAlign: 'left', flexShrink: 0, marginRight: 8 }}>
                <div style={{ fontSize: 10, color: S.muted }}>{p.category}</div>
                {p.last_purchase_price > 0 && (
                  <div style={{ fontSize: 11, color: S.gold }}>آخر سعر: {p.last_purchase_price.toFixed(2)}</div>
                )}
              </div>
            </div>
          ))}

          {query.trim() !== '' && (
            <div
              onMouseDown={() => { onAddNew(query.trim()); setOpen(false); setQuery('') }}
              onMouseEnter={() => setHighlighted(filtered.length)}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                background: highlighted === filtered.length ? 'rgba(201,168,76,0.15)' : 'transparent',
                borderTop: filtered.length > 0 ? `1px solid ${S.border}` : 'none',
                display: 'flex', alignItems: 'center', gap: 8,
                color: S.gold, fontSize: 13, fontWeight: 700,
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: S.gold3, border: `1px solid ${S.gold}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>+</span>
              إضافة "<strong>{query.trim()}</strong>" كصنف جديد
            </div>
          )}
          </>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// AddProductModal — إضافة صنف جديد سريع
// ══════════════════════════════════════════
function AddProductModal({ initialName, onClose, onSaved, units: allUnits, warehouseId }: {
  initialName: string
  onClose: () => void
  onSaved: (p: Product) => void
  units?: { id: string; name: string; symbol: string }[]
  warehouseId?: string
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [form, setForm] = useState({
    name: initialName, name_en: '', category: '',
    current_stock: '0', last_purchase_price: '0',
    unit_id: '', min_stock: '0',
  })

  useEffect(() => {
    // جيب الكاتيجوريز الموجودة
    supabase.from('warehouse_products').select('category').eq('is_active', true).then(({ data }) => {
      const cats = Array.from(new Set<string>((data || []).map((p: any) => p.category).filter(Boolean))).sort()
      setCategories(cats)
    })
  }, [])

  async function save() {
    if (!form.name.trim()) { alert('يرجى إدخال اسم الصنف'); return }
    setSaving(true)
    const { data, error } = await supabase
      .from('warehouse_products')
      .insert([{
        name: form.name.trim(),
        name_en: form.name_en.trim() || null,
        category: form.category || 'عام',
        current_stock: parseFloat(form.current_stock) || 0,
        last_purchase_price: parseFloat(form.last_purchase_price) || 0,
        min_stock: parseFloat(form.min_stock) || 0,
        unit_id: form.unit_id || null,
        is_active: true,
        warehouse_id: warehouseId || null,
      }])
      .select('*, units(symbol)')
      .single()
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved(data)
  }

  const selectStyle: React.CSSProperties = { ...inp, cursor: 'pointer', appearance: 'none' as any }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.gold}`, width: '100%', maxWidth: 460, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: S.gold, fontSize: 16, fontWeight: 700 }}>📦 إضافة صنف جديد</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* اسم الصنف */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>اسم الصنف (عربي) *</label>
            <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: زيت زيتون" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>اسم الصنف (إنجليزي)</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="Olive Oil" />
          </div>

          {/* التصنيف — dropdown من الموجودين */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التصنيف</label>
            <select style={selectStyle} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="">-- اختر تصنيف --</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ تصنيف جديد...</option>
            </select>
            {form.category === '__new__' && (
              <input style={{ ...inp, marginTop: 8 }} placeholder="اكتب اسم التصنيف الجديد"
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))} autoFocus />
            )}
          </div>

          {/* الوحدة */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وحدة القياس</label>
            <select style={selectStyle} value={form.unit_id} onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))}>
              <option value="">-- بدون وحدة --</option>
              {(allUnits || []).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
              ))}
            </select>
          </div>

          {/* الأسعار والمخزون */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المخزون الحالي</label>
              <input style={{ ...inp, direction: 'ltr' }} type="number" value={form.current_stock} onChange={e => setForm(p => ({ ...p, current_stock: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الحد الأدنى</label>
              <input style={{ ...inp, direction: 'ltr' }} type="number" value={form.min_stock} onChange={e => setForm(p => ({ ...p, min_stock: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>آخر سعر شراء</label>
              <input style={{ ...inp, direction: 'ltr' }} type="number" value={form.last_purchase_price} onChange={e => setForm(p => ({ ...p, last_purchase_price: e.target.value }))} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '💾 إضافة الصنف'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// AddSupplierModal
// ══════════════════════════════════════════
function AddSupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: (s: Supplier) => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })

  async function save() {
    if (!form.name) { alert('يرجى إدخال اسم المورد'); return }
    setSaving(true)
    const { data, error } = await supabase.from('warehouse_suppliers').insert([form]).select().single()
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved(data)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 400, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>🤝 إضافة مورد جديد</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>اسم المورد *</label>
            <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: شركة الأغذية المتحدة" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>رقم الهاتف</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+60 12-345 6789" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '💾 حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// ImageViewerModal
// ══════════════════════════════════════════
function ImageViewerModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: -16, left: -16, width: 36, height: 36, borderRadius: '50%', background: S.red, border: 'none', color: S.white, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontWeight: 700 }}>✕</button>
        <img src={imageUrl} alt="فاتورة" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain', display: 'block' }} />
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: S.muted }}>اضغط خارج الصورة للإغلاق</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// NewInvoiceModal
// ══════════════════════════════════════════
function NewInvoiceModal({ products: initialProducts, suppliers, units, warehouses, unitConversions, onClose, onSaved }: {
  products: Product[]; suppliers: Supplier[]; units: Unit[]
  warehouses: { id: string; name: string }[]; unitConversions: any[]; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [addingForIndex, setAddingForIndex] = useState<number>(-1)
  const [localSuppliers, setLocalSuppliers] = useState(suppliers)
  const [localProducts, setLocalProducts] = useState(initialProducts)

  // مزامنة localProducts مع initialProducts كل ما تتحدث (مثلاً بعد اكتمال التحميل من الصفحة الأب)
  useEffect(() => {
    setLocalProducts(initialProducts)
  }, [initialProducts])

  const [warehouseProducts, setWarehouseProducts] = useState<Product[]>([])
  const [loadingWarehouseProducts, setLoadingWarehouseProducts] = useState(false)

  const [items, setItems] = useState<InvoiceItem[]>([{
    product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false, contents_manual: ''
  }])
  const [form, setForm] = useState({
    supplier_id: '', warehouse_id: '',
    supplier_invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0], notes: '',
  })

  // جلب أصناف المستودع المختار مباشرة من قاعدة البيانات (مصدر موثوق 100%، بدل الاعتماد على البيانات الممررة من الصفحة الأب)
  useEffect(() => {
    if (!form.warehouse_id) {
      setWarehouseProducts([])
      return
    }
    let cancelled = false
    setLoadingWarehouseProducts(true)
    supabase
      .from('warehouse_products')
      .select('*, units(symbol)')
      .eq('is_active', true)
      .eq('warehouse_id', form.warehouse_id)
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) {
          setWarehouseProducts(data as Product[])
        }
        setLoadingWarehouseProducts(false)
      })
    return () => { cancelled = true }
  }, [form.warehouse_id])

  // فقط أصناف المستودع المختار حالياً في الفورم — مجلوبة مباشرة من قاعدة البيانات
  const availableProducts = form.warehouse_id ? warehouseProducts : localProducts

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setInvoiceImage(base64)
      await handleAIScan(base64)
    }
    reader.readAsDataURL(file)
  }

  async function handleAIScan(base64: string) {
    setScanning(true)
    setScanProgress('🔍 جاري تحليل الفاتورة بالذكاء الاصطناعي...')
    try {
      setScanProgress('📷 استخراج البيانات من الصورة...')
      const result = await scanInvoiceWithAI(base64, availableProducts)
      setScanProgress('🔗 مطابقة الأصناف مع قاعدة البيانات...')
      if (result.invoice_number) setForm(p => ({ ...p, supplier_invoice_number: result.invoice_number }))
      if (result.invoice_date) setForm(p => ({ ...p, invoice_date: result.invoice_date }))
      if (result.notes) setForm(p => ({ ...p, notes: result.notes }))
      if (result.supplier_name) {
        const matched = localSuppliers.find(s => s.name.includes(result.supplier_name) || result.supplier_name.includes(s.name))
        if (matched) setForm(p => ({ ...p, supplier_id: matched.id }))
      }
      if (result.items?.length) {
        const matchedItems: InvoiceItem[] = result.items.map(item => {
          const match = availableProducts.find(p =>
            p.name.includes(item.name) || item.name.includes(p.name) ||
            (p.name_en && (p.name_en.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(p.name_en.toLowerCase())))
          )
          return {
            product_id: match?.id || '', product_name: match?.name || item.name,
            quantity: String(item.quantity || ''), unit_price: String(item.unit_price || ''),
            unit_id: match?.units ? units.find(u => u.symbol === match.units?.symbol)?.id || '' : '',
            matched: !!match,
          }
        })
        setItems(matchedItems)
      }
      setScanProgress('✅ تم استخراج البيانات بنجاح!')
      setTimeout(() => setScanProgress(''), 2000)
    } catch {
      setScanProgress('❌ تعذّر استخراج البيانات — يمكنك الإدخال يدوياً')
      setTimeout(() => setScanProgress(''), 3000)
    } finally {
      setScanning(false)
    }
  }

  function addItem() {
    setItems(p => [...p, { product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false, contents_manual: '' }])
  }

  function setItem(i: number, k: string, v: string) {
    setItems(p => p.map((it, idx) => {
      if (idx !== i) return it
      if (k === 'product_id') {
        const prod = availableProducts.find(p => p.id === v)
        return { ...it, product_id: v, product_name: prod?.name || '', matched: !!prod, unit_price: prod?.last_purchase_price ? String(prod.last_purchase_price) : it.unit_price }
      }
      return { ...it, [k]: v }
    }))
  }

  async function save() {
    if (!form.warehouse_id) { alert('يرجى اختيار المستودع'); return }
    if (items.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return }
    if (items.some(i => !i.product_id || !i.quantity || !i.unit_price)) { alert('يرجى إكمال بيانات الأصناف'); return }
    setSaving(true)
    try {
      const total = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0)
      const { data: inv, error: invErr } = await supabase.from('purchase_invoices').insert([{
        supplier_id: form.supplier_id || null,
        warehouse_id: form.warehouse_id,
        invoice_number: form.supplier_invoice_number || null,
        invoice_date: form.invoice_date,
        notes: form.notes,
        total_amount: total,
        image_url: invoiceImage || null,
        status: 'confirmed',
      }]).select().single()
      if (invErr) throw invErr
      for (const item of items) {
        await supabase.from('purchase_invoice_items').insert([{
          invoice_id: inv.id, product_id: item.product_id,
          quantity: parseFloat(item.quantity), unit_price: parseFloat(item.unit_price),
          unit_id: item.unit_id || null,
          notes: item.contents_manual ? `محتويات الوحدة: ${item.contents_manual}` : null,
        }])
        const actualQty = parseFloat(item.quantity)
        await supabase.from('stock_movements').insert([{
          movement_type: 'in', product_id: item.product_id,
          warehouse_id: form.warehouse_id, quantity: actualQty,
          unit_price: parseFloat(item.unit_price), invoice_id: inv.id,
          movement_date: form.invoice_date,
        }])
      }
      onSaved()
    } catch (e: unknown) {
      alert('خطأ: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  const total = items.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)), 0)
  const matchedCount = items.filter(i => i.matched).length

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
        <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 860, padding: '24px 20px', margin: 'auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>🛒 فاتورة مشتريات جديدة</h2>
            <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

            {/* صورة الفاتورة */}
            <div>
              <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 10 }}>📷 صورة الفاتورة</div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${invoiceImage ? S.green : S.border}`,
                  borderRadius: 14, padding: invoiceImage ? 8 : 24,
                  textAlign: 'center', cursor: 'pointer', marginBottom: 10,
                  background: invoiceImage ? S.greenB : 'transparent',
                  transition: 'all .2s', minHeight: 140,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {invoiceImage ? (
                  <img src={invoiceImage} alt="فاتورة" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
                ) : (
                  <div>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
                    <div style={{ fontSize: 13, color: S.white, fontWeight: 600, marginBottom: 4 }}>صوّر أو ارفع الفاتورة</div>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 12 }}>الذكاء الاصطناعي سيستخرج البيانات تلقائياً</div>
                    <div style={{ padding: '7px 18px', background: S.gold3, border: `1px solid ${S.gold}`, borderRadius: 8, display: 'inline-block', fontSize: 12, color: S.gold, fontWeight: 700 }}>اختر صورة</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImageUpload} />

              {(scanning || scanProgress) && (
                <div style={{ background: scanning ? S.purpleB : scanProgress.includes('✅') ? S.greenB : S.amberB, border: `1px solid ${scanning ? S.purple : scanProgress.includes('✅') ? S.green : S.amber}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: scanning ? S.purple : scanProgress.includes('✅') ? S.green : S.amber, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {scanning && <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>}
                  {scanProgress}
                </div>
              )}

              {items.some(i => i.matched) && (
                <div style={{ background: S.greenB, border: `1px solid ${S.green}`, borderRadius: 10, padding: '8px 12px', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: S.green, fontWeight: 700 }}>✅ تم مطابقة {matchedCount} من {items.length} صنف</span>
                </div>
              )}

              {invoiceImage && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClickCapture={() => window.open(invoiceImage, '_blank')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🔍 عرض الصورة</button>
                  <button onClick={() => { setInvoiceImage(null); setItems([{ product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false, contents_manual: '' }]) }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🔄 إعادة المحاولة</button>
                </div>
              )}
            </div>

            {/* بيانات الفاتورة */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 4 }}>📋 بيانات الفاتورة</div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المورد</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select style={{ ...inp, flex: 1 }} value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}>
                    <option value="">اختر المورد</option>
                    {localSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button onClick={() => setShowAddSupplier(true)} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 18 }}>+</button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المستودع *</label>
                <select style={inp} value={form.warehouse_id} onChange={e => {
                  const newWh = e.target.value
                  const hasSelectedItems = items.some(it => it.product_id)
                  if (hasSelectedItems && newWh !== form.warehouse_id) {
                    if (!confirm('تغيير المستودع سيؤدي لمسح الأصناف المختارة حالياً، هل تريد الاستمرار؟')) return
                    setItems([{ product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false, contents_manual: '' }])
                  }
                  setForm(p => ({ ...p, warehouse_id: newWh }))
                }}>
                  <option value="">اختر المستودع</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 2 }}>رقم النظام</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.gold }}>يُولَّد تلقائياً عند الحفظ ✦</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>رقم فاتورة المورد</label>
                <input style={inp} value={form.supplier_invoice_number} onChange={e => setForm(p => ({ ...p, supplier_invoice_number: e.target.value }))} placeholder="رقم الفاتورة من المورد (اختياري)" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التاريخ</label>
                <input style={inp} type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
                <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات إضافية..." />
              </div>
            </div>
          </div>

          {/* الأصناف */}
          {!form.warehouse_id ? (
            <div style={{ marginTop: 20, borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
              <div style={{ background: S.amberB, border: `1px solid ${S.amber}`, borderRadius: 10, padding: '14px 16px', color: S.amber, fontSize: 13, textAlign: 'center' }}>
                ⚠️ يرجى اختيار المستودع أولاً لعرض أصنافه وإضافتها للفاتورة
              </div>
            </div>
          ) : (
          <div style={{ marginTop: 20, borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: S.gold, fontWeight: 700 }}>📦 أصناف الفاتورة — {warehouses.find(w => w.id === form.warehouse_id)?.name}</div>
              <button onClick={addItem} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>+ إضافة صنف</button>
            </div>

            {items.map((item, i) => (
              <div key={i} style={{ background: S.card, borderRadius: 12, padding: '12px', marginBottom: 10 }}>
                {/* ✅ بحث ذكي للصنف */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الصنف</label>
                  <ProductSearchInput
                    products={availableProducts}
                    value={item.product_id}
                    productName={item.product_name}
                    matched={item.matched}
                    loading={loadingWarehouseProducts}
                    onChange={(id, name, lastPrice) => {
                      setItems(p => p.map((it, idx) => idx === i ? {
                        ...it, product_id: id, product_name: name, matched: true,
                        unit_price: lastPrice > 0 ? String(lastPrice) : it.unit_price,
                      } : it))
                    }}
                    onAddNew={(name) => {
                      setNewProductName(name)
                      setAddingForIndex(i)
                      setShowAddProduct(true)
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية</label>
                    <input style={inp} type="number" placeholder="0" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>سعر الوحدة</label>
                    <input style={inp} type="number" placeholder="0.00" value={item.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الوحدة</label>
                    <select style={inp} value={item.unit_id} onChange={e => {
                      setItem(i, 'unit_id', e.target.value)
                      if (item.product_id && e.target.value) {
                        const conv = unitConversions.find(c => c.product_id === item.product_id && c.from_unit_id === e.target.value)
                        setItems(p => p.map((it, idx) => idx === i ? {
                          ...it, unit_id: e.target.value,
                          contents_per_unit: conv?.factor, contents_unit_name: conv?.to_unit?.name,
                        } : it))
                      }
                    }}>
                      <option value="">—</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                    </select>
                    {item.contents_per_unit && item.contents_unit_name && (
                      <div style={{ fontSize: 10, color: S.purple, marginTop: 3, fontWeight: 600 }}>
                        📦 1 وحدة = {item.contents_per_unit} {item.contents_unit_name}
                        {item.quantity && <span style={{ color: S.gold }}> ← إجمالي: {(parseFloat(item.quantity) * item.contents_per_unit).toFixed(1)}</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>
                      محتويات الوحدة <span style={{ fontSize: 9, color: S.purple }}>(اختياري)</span>
                    </label>
                    <input
                      style={{ ...inp, borderColor: item.contents_manual ? S.purple : 'rgba(255,255,255,0.10)' }}
                      type="number" min="1" placeholder="مثال: 24"
                      value={item.contents_manual || ''}
                      onChange={e => setItems(p => p.map((it, xi) => xi === i ? { ...it, contents_manual: e.target.value } : it))}
                    />
                    {item.contents_manual && item.quantity && (
                      <div style={{ fontSize: 10, color: S.purple, marginTop: 3, fontWeight: 600 }}>
                        📦 الإجمالي: {(parseFloat(item.quantity) * parseFloat(item.contents_manual)).toFixed(0)} قطعة
                      </div>
                    )}
                  </div>
                  <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', padding: '10px', fontSize: 14, alignSelf: 'flex-end' }}>✕</button>
                </div>

                {item.quantity && item.unit_price && (
                  <div style={{ textAlign: 'left', marginTop: 6, fontSize: 12, color: S.gold, fontWeight: 600 }}>
                    = {formatMYR(parseFloat(item.quantity) * parseFloat(item.unit_price))}
                  </div>
                )}
              </div>
            ))}

            <div style={{ background: S.navy3, borderRadius: 12, padding: '14px 18px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: S.muted, fontSize: 14 }}>إجمالي الفاتورة</span>
              <span style={{ color: S.gold, fontSize: 22, fontWeight: 800 }}>{formatMYR(total)}</span>
            </div>
          </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
            <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {saving ? '⏳ جاري الحفظ...' : '✅ تأكيد الفاتورة'}
            </button>
          </div>
        </div>
      </div>

      {showAddSupplier && (
        <AddSupplierModal
          onClose={() => setShowAddSupplier(false)}
          onSaved={(s) => { setLocalSuppliers(p => [...p, s]); setForm(p => ({ ...p, supplier_id: s.id })); setShowAddSupplier(false) }}
        />
      )}

      {showAddProduct && (
        <AddProductModal
          initialName={newProductName}
          units={units}
          warehouseId={form.warehouse_id}
          onClose={() => { setShowAddProduct(false); setNewProductName(''); setAddingForIndex(-1) }}
          onSaved={(p) => {
            setLocalProducts(prev => [...prev, p])
            setWarehouseProducts(prev => p.warehouse_id === form.warehouse_id ? [...prev, p] : prev)
            if (addingForIndex >= 0) {
              setItems(prev => prev.map((it, idx) => idx === addingForIndex ? {
                ...it, product_id: p.id, product_name: p.name, matched: true,
                unit_price: p.last_purchase_price > 0 ? String(p.last_purchase_price) : it.unit_price,
              } : it))
            }
            setShowAddProduct(false); setNewProductName(''); setAddingForIndex(-1)
          }}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </>
  )
}

// ══════════════════════════════════════════
// InvoiceDetailModal
// ══════════════════════════════════════════
function InvoiceDetailModal({ invoice, products, suppliers, units, warehouses, onClose, onViewImage, onDeleted, onSaved }: {
  invoice: any; products: any[]; suppliers: any[]; units: any[]; warehouses: any[]
  onClose: () => void; onViewImage: (url: string) => void; onDeleted: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    invoice_number: invoice.invoice_number || '',
    invoice_date: invoice.invoice_date || '',
    supplier_id: invoice.supplier_id || '',
    warehouse_id: invoice.warehouse_id || '',
    notes: invoice.notes || '',
  })
  const [editItems, setEditItems] = useState<any[]>([])

  const S2 = {
    navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
    gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
    white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
    green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
    red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
    blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
    amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
    card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.07)',
  }

  const inpD: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: `1px solid rgba(255,255,255,0.10)`,
    borderRadius: 10, padding: '9px 12px', fontSize: 13,
    color: S2.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
    boxSizing: 'border-box', direction: 'rtl',
  }

  useEffect(() => {
    async function loadItems() {
      const { data: rawItems } = await supabase
        .from('purchase_invoice_items')
        .select('id, invoice_id, product_id, quantity, unit_price, unit_id, notes')
        .eq('invoice_id', invoice.id)
      if (!rawItems || rawItems.length === 0) { setItems([]); setEditItems([]); setLoadingItems(false); return }
      const productIds = [...new Set(rawItems.map((i: any) => i.product_id))]
      const { data: prods } = await supabase.from('warehouse_products').select('id, name').in('id', productIds)
      const prodMap = Object.fromEntries((prods || []).map((p: any) => [p.id, p.name]))
      const loaded = rawItems.map((i: any) => ({ ...i, product_name: prodMap[i.product_id] || '—' }))
      setItems(loaded)
      setEditItems(loaded.map((i: any) => ({ id: i.id, product_id: i.product_id, quantity: String(i.quantity), unit_price: String(i.unit_price), unit_id: i.unit_id || '' })))
      setLoadingItems(false)
    }
    loadItems()
  }, [invoice.id])

  async function handleSave() {
    if (editItems.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return }
    if (editItems.some(i => !i.product_id || !i.quantity || !i.unit_price)) { alert('يرجى إكمال بيانات الأصناف'); return }
    setSaving(true)
    const total = editItems.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0)
    await supabase.from('purchase_invoices').update({ invoice_number: editForm.invoice_number || null, invoice_date: editForm.invoice_date, supplier_id: editForm.supplier_id || null, warehouse_id: editForm.warehouse_id || null, notes: editForm.notes || null, total_amount: total }).eq('id', invoice.id)
    await supabase.from('purchase_invoice_items').delete().eq('invoice_id', invoice.id)
    await supabase.from('stock_movements').delete().eq('invoice_id', invoice.id)
    for (const item of editItems) {
      await supabase.from('purchase_invoice_items').insert([{ invoice_id: invoice.id, product_id: item.product_id, quantity: parseFloat(item.quantity), unit_price: parseFloat(item.unit_price), unit_id: item.unit_id || null, total_price: parseFloat(item.quantity) * parseFloat(item.unit_price) }])
      if (editForm.warehouse_id) {
        await supabase.from('stock_movements').insert([{ product_id: item.product_id, warehouse_id: editForm.warehouse_id, movement_type: 'in', quantity: parseFloat(item.quantity), invoice_id: invoice.id, notes: 'تعديل فاتورة مشتريات' }])
      }
    }
    setSaving(false)
    onSaved()
  }

  async function handleCancel() {
    if (!confirm('إلغاء هذه الفاتورة؟ سيتم تصفيرها من المخزون.')) return
    setDeleting(true)
    await supabase.from('purchase_invoice_items').delete().eq('invoice_id', invoice.id)
    await supabase.from('stock_movements').delete().eq('invoice_id', invoice.id)
    await supabase.from('purchase_invoices').update({ status: 'cancelled', total_amount: 0 }).eq('id', invoice.id)
    setDeleting(false)
    onDeleted()
  }

  const editTotal = editItems.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: S2.navy2, borderRadius: 18, border: `1px solid ${S2.border}`, width: '100%', maxWidth: 580, padding: '24px 20px', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: S2.gold, fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{mode === 'edit' ? '✏️ تعديل الفاتورة' : '🧾 تفاصيل الفاتورة'}</h3>
            {invoice.invoice_number && <div style={{ fontSize: 12, color: S2.muted }}>رقم المورد: {invoice.invoice_number}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {mode === 'view' && (
              <button onClick={() => setMode('edit')} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S2.gold}`, background: S2.gold3, color: S2.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✏️ تعديل</button>
            )}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S2.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {mode === 'view' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'المورد', value: invoice.warehouse_suppliers?.name || '—', icon: '🤝' },
                { label: 'المستودع', value: invoice.warehouses?.name || '—', icon: '🏭' },
                { label: 'التاريخ', value: invoice.invoice_date, icon: '📅' },
                { label: 'الإجمالي', value: `MYR ${Number(invoice.total_amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, icon: '💰', green: true },
              ].map((r, i) => (
                <div key={i} style={{ background: S2.card, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: S2.muted, marginBottom: 3 }}>{r.icon} {r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: (r as any).green ? S2.green : S2.white }}>{r.value}</div>
                </div>
              ))}
            </div>

            {invoice.notes && (
              <div style={{ background: S2.card, borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: S2.muted, marginBottom: 3 }}>📝 ملاحظات</div>
                <div style={{ fontSize: 13, color: S2.white }}>{invoice.notes}</div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S2.white, marginBottom: 10 }}>📦 أصناف الفاتورة</div>
              {loadingItems ? (
                <div style={{ textAlign: 'center', padding: 20, color: S2.muted, fontSize: 12 }}>⏳ جاري التحميل...</div>
              ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: S2.muted, fontSize: 12, background: S2.card, borderRadius: 10 }}>لا توجد أصناف — اضغط تعديل لإضافتها</div>
              ) : (
                <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${S2.border}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: S2.navy3, padding: '8px 12px', gap: 8 }}>
                    {['الصنف', 'الكمية', 'سعر الوحدة', 'الإجمالي'].map(h => (
                      <div key={h} style={{ fontSize: 10, color: S2.muted, fontWeight: 700 }}>{h}</div>
                    ))}
                  </div>
                  {items.map((item, i) => {
                    const t = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 12px', gap: 8, borderTop: `1px solid ${S2.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 12, color: S2.white, fontWeight: 600 }}>{item.product_name || '—'}</div>
                        <div style={{ fontSize: 12, color: S2.muted }}>{item.quantity} {units.find(u => u.id === item.unit_id)?.symbol || ''}</div>
                        <div style={{ fontSize: 12, color: S2.muted }}>{parseFloat(item.unit_price).toFixed(2)}</div>
                        <div style={{ fontSize: 12, color: S2.gold, fontWeight: 600 }}>{t.toFixed(2)}</div>
                      </div>
                    )
                  })}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 12px', gap: 8, borderTop: `1px solid ${S2.border}`, background: S2.greenB }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S2.green, gridColumn: '1/4' }}>الإجمالي</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S2.green }}>{items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0).toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>

            {invoice.image_url && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: S2.gold, fontWeight: 700, marginBottom: 8 }}>📸 صورة الفاتورة</div>
                <img src={invoice.image_url} alt="فاتورة" style={{ width: '100%', maxHeight: 180, borderRadius: 10, cursor: 'pointer', border: `1px solid ${S2.border}`, objectFit: 'contain', background: S2.navy3 }} onClick={() => onViewImage(invoice.image_url)} />
                <button onClick={() => onViewImage(invoice.image_url)} style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${S2.blue}`, background: S2.blueB, color: S2.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🔍 عرض بالحجم الكامل</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={handleCancel} disabled={deleting} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S2.amber}`, background: S2.amberB, color: S2.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>
                {deleting ? '⏳...' : '🚫 إلغاء الفاتورة'}
              </button>
              <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${S2.muted}`, background: 'transparent', color: S2.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
            </div>
          </>
        )}

        {mode === 'edit' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>رقم الفاتورة (المورد)</label>
                  <input style={inpD} value={editForm.invoice_number} onChange={e => setEditForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="اختياري" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>التاريخ</label>
                  <input style={inpD} type="date" value={editForm.invoice_date} onChange={e => setEditForm(p => ({ ...p, invoice_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>المورد</label>
                  <select style={inpD} value={editForm.supplier_id} onChange={e => setEditForm(p => ({ ...p, supplier_id: e.target.value }))}>
                    <option value="">— بدون مورد —</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>المستودع *</label>
                  <select style={inpD} value={editForm.warehouse_id} onChange={e => setEditForm(p => ({ ...p, warehouse_id: e.target.value }))}>
                    <option value="">اختر المستودع</option>
                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>ملاحظات</label>
                <input style={inpD} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="اختياري" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S2.white }}>📦 الأصناف</div>
                <button onClick={() => setEditItems(p => [...p, { product_id: '', quantity: '', unit_price: '', unit_id: '' }])} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S2.green}`, background: S2.greenB, color: S2.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>➕ إضافة صنف</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editItems.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'center', background: S2.card, borderRadius: 10, padding: '8px 10px' }}>
                    <select style={{ ...inpD, padding: '7px 10px' }} value={item.product_id} onChange={e => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, product_id: e.target.value } : x))}>
                      <option value="">الصنف</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input style={{ ...inpD, padding: '7px 10px' }} type="number" placeholder="الكمية" value={item.quantity} onChange={e => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, quantity: e.target.value } : x))} />
                    <input style={{ ...inpD, padding: '7px 10px' }} type="number" placeholder="السعر" value={item.unit_price} onChange={e => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, unit_price: e.target.value } : x))} />
                    <button onClick={() => setEditItems(p => p.filter((_, xi) => xi !== i))} style={{ background: S2.redB, border: `1px solid ${S2.red}`, borderRadius: 8, color: S2.red, cursor: 'pointer', padding: '7px 10px', fontSize: 14 }}>✕</button>
                  </div>
                ))}
                {editItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 16, color: S2.muted, fontSize: 12, background: S2.card, borderRadius: 10 }}>اضغط "إضافة صنف" لإضافة الأصناف</div>
                )}
              </div>
              {editItems.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, padding: '8px 12px', background: S2.greenB, borderRadius: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: S2.green }}>الإجمالي: MYR {editTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setMode('view')} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S2.muted}`, background: 'transparent', color: S2.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', borderRadius: 10, border: `1px solid ${S2.gold}`, background: S2.gold3, color: S2.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳ جاري الحفظ...' : '💾 حفظ التعديلات'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════
export default function PurchasesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [unitConversions, setUnitConversions] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [viewerImage, setViewerImage] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [inv, prod, sup, un, wh, uc] = await Promise.all([
      supabase.from('purchase_invoices').select('*, warehouse_suppliers(name), warehouses(name)').order('created_at', { ascending: false }),
      supabase.from('warehouse_products').select('*, units(symbol)').eq('is_active', true).order('name'),
      supabase.from('warehouse_suppliers').select('*').order('name'),
      supabase.from('units').select('*').order('name'),
      supabase.from('warehouses').select('id,name').eq('is_active', true),
      supabase.from('unit_conversions').select('*, from_unit:units!unit_conversions_from_unit_id_fkey(name,symbol), to_unit:units!unit_conversions_to_unit_id_fkey(name,symbol)'),
    ])
    setInvoices(inv.data || [])
    setProducts(prod.data || [])
    setSuppliers(sup.data || [])
    setUnits(un.data || [])
    setWarehouses(wh.data || [])
    setUnitConversions(uc.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthInvoices = invoices.filter(i => i.created_at?.startsWith(thisMonth))
  const monthTotal = monthInvoices.reduce((s, i) => s + (i.total_amount || 0), 0)
  const totalAll = invoices.reduce((s, i) => s + (i.total_amount || 0), 0)

  const filtered = invoices.filter(inv => {
    const matchSearch = !search || inv.invoice_number?.includes(search) || inv.warehouse_suppliers?.name?.includes(search)
    const matchSupplier = !filterSupplier || inv.warehouse_suppliers?.name === filterSupplier
    const matchMonth = !filterMonth || inv.invoice_date?.startsWith(filterMonth)
    return matchSearch && matchSupplier && matchMonth
  })

  const invoiceSuppliers = [...new Set(invoices.map(i => i.warehouse_suppliers?.name).filter(Boolean))]

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .inv-row:hover td { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🛒 المشتريات</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة فواتير المشتريات ومسح ذكي بالذكاء الاصطناعي</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✨ فاتورة جديدة
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'إجمالي الفواتير', value: invoices.length, icon: '🧾', color: S.blue, bg: S.blueB },
          { label: 'مشتريات هذا الشهر', value: monthInvoices.length, icon: '📅', color: S.green, bg: S.greenB },
          { label: 'إجمالي هذا الشهر', value: formatMYR(monthTotal), icon: '💰', color: S.gold, bg: S.gold3 },
          { label: 'إجمالي كل الفواتير', value: formatMYR(totalAll), icon: '📊', color: S.purple, bg: S.purpleB },
          { label: 'عدد الموردين', value: suppliers.length, icon: '🤝', color: S.teal, bg: S.tealB },
        ].map((s, i) => (
          <div key={i} style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div style={{ background: s.bg, borderRadius: 8, padding: '2px 8px', fontSize: 10, color: s.color, fontWeight: 700 }}>جديد</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث برقم الفاتورة أو المورد..." />
        <select style={{ ...inp, width: 'auto', minWidth: 160 }} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value="">كل الموردين</option>
          {invoiceSuppliers.map(s => <option key={s} value={s!}>{s}</option>)}
        </select>
        <input style={{ ...inp, width: 'auto' }} type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        {(search || filterSupplier || filterMonth) && (
          <button onClick={() => { setSearch(''); setFilterSupplier(''); setFilterMonth('') }} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>✕ مسح</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: S.white }}>سجل الفواتير</span>
            <span style={{ fontSize: 12, color: S.muted }}>{filtered.length} فاتورة</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['# النظام', 'رقم المورد', 'المورد', 'التاريخ', 'الإجمالي', 'صورة', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 60, color: S.muted }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد فواتير بعد</div>
                    <div style={{ fontSize: 13 }}>اضغط "فاتورة جديدة" لإضافة أول فاتورة</div>
                  </td></tr>
                ) : filtered.map((inv, idx) => (
                  <tr key={inv.id} className="inv-row" style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => setSelectedInvoice(inv)}>
                    <td style={{ padding: '14px 16px', color: S.purple, fontWeight: 800, fontSize: 14 }}>#{filtered.length - idx}</td>
                    <td style={{ padding: '14px 16px', color: S.gold, fontWeight: 700, fontSize: 13 }}>{inv.invoice_number || <span style={{ color: S.muted, fontStyle: 'italic', fontSize: 11 }}>—</span>}</td>
                    <td style={{ padding: '14px 16px', color: S.white, fontSize: 13, fontWeight: 600 }}>{inv.warehouse_suppliers?.name || <span style={{ color: S.muted }}>—</span>}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: S.muted }}>{inv.invoice_date}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: S.green, fontSize: 13 }}>{formatMYR(inv.total_amount)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {inv.image_url ? (
                        <img src={inv.image_url} alt="فاتورة" style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: `1px solid ${S.border}` }} onClick={(e) => { e.stopPropagation(); setViewerImage(inv.image_url) }} />
                      ) : <span style={{ color: S.muted, fontSize: 18 }}>📄</span>}
                    </td>
                    <td style={{ padding: '14px 16px', color: S.muted, fontSize: 18 }}>←</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice} products={products} suppliers={suppliers} units={units} warehouses={warehouses}
          onClose={() => setSelectedInvoice(null)}
          onViewImage={(url) => setViewerImage(url)}
          onDeleted={() => { setSelectedInvoice(null); fetchAll() }}
          onSaved={() => { setSelectedInvoice(null); fetchAll() }}
        />
      )}

      {viewerImage && <ImageViewerModal imageUrl={viewerImage} onClose={() => setViewerImage(null)} />}

      {showNew && (
        <NewInvoiceModal
          products={products} suppliers={suppliers} units={units} warehouses={warehouses}
          unitConversions={unitConversions}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); fetchAll() }}
        />
      )}
    </div> 
  )
}   
 