'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'

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

// ✅ رفع صورة الفاتورة لـ Supabase Storage بدل تخزينها base64 جوه قاعدة البيانات
// (السبب الرئيسي لبطء الصفحة كان تخزين الصور كـ base64 مباشرة في عمود image_url)
async function uploadInvoiceImage(supabase: ReturnType<typeof createClient>, file: File, invoiceKey: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${invoiceKey}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { data, error } = await supabase.storage.from('invoice-images').upload(path, file, { upsert: true, contentType: file.type })
  if (error) { console.error('Invoice image upload error:', error); return null }
  const { data: urlData } = supabase.storage.from('invoice-images').getPublicUrl(data.path)
  return urlData.publicUrl
}

interface Product { id: string; name: string; name_en?: string; category: string; current_stock: number; last_purchase_price: number; units?: { symbol: string }; warehouse_id?: string }
interface Supplier { id: string; name: string; phone?: string }
interface Unit { id: string; name: string; symbol: string }
interface Invoice {
  id: string; sys_number?: number; invoice_number: string; invoice_date: string
  total_amount: number; status: string; image_url?: string; notes: string
  warehouse_id?: string
  warehouse_suppliers?: { name: string }; warehouses?: { name: string; branch_id?: string }; created_at: string
}
interface InvoiceItem {
  product_id: string; product_name: string
  quantity: string; unit_price: string; unit_id: string; matched: boolean
  contents_per_unit?: number; contents_unit_name?: string
  contents_manual?: string
  sst_percent?: string
  discount_type?: 'percent' | 'amount'
  discount_value?: string
}

// ✅ يحسب قيمة الخصم الفعلية (مبلغ) لصنف واحد - بيدعم نسبة % أو مبلغ ثابت
function calcItemDiscount(item: InvoiceItem, grossAmount: number): number {
  const val = parseFloat(item.discount_value || '0') || 0
  if (val <= 0) return 0
  if (item.discount_type === 'amount') return Math.min(val, grossAmount)
  return grossAmount * (val / 100) // النوع الافتراضي: نسبة مئوية
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
function ProductSearchInput({ products, value, productName, matched, onChange, onAddNew, loading, otherWarehouseProducts, onUseFromOtherWarehouse }: {
  products: Product[]
  value: string
  productName: string
  matched: boolean
  onChange: (id: string, name: string, lastPrice: number) => void
  onAddNew: (name: string) => void
  loading?: boolean
  otherWarehouseProducts?: (Product & { warehouse_name?: string })[]
  onUseFromOtherWarehouse?: (p: Product) => void
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

  // ✅ لو مفيش نتايج (أو نتايج قليلة) في المستودع الحالي، نلاقي هل نفس الصنف موجود جاهز في مستودع تاني بنفس الاسم
  const crossWarehouseMatches = query.trim().length >= 2 && otherWarehouseProducts
    ? otherWarehouseProducts.filter(p =>
        (p.name.toLowerCase().includes(query.toLowerCase()) || (p.name_en || '').toLowerCase().includes(query.toLowerCase()))
        && !filtered.some(fp => fp.name.trim().toLowerCase() === p.name.trim().toLowerCase())
      ).slice(0, 10)
    : []

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

  function handleUseOther(p: Product) {
    onUseFromOtherWarehouse?.(p)
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
              لا نتائج لـ "<strong style={{ color: S.white }}>{query}</strong>" في هذا المستودع
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
                  <div style={{ fontSize: 11, color: S.gold }}>آخر سعر: {p.last_purchase_price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                )}
              </div>
            </div>
          ))}

          {/* ✅ جديد: الصنف موجود جاهز في مستودع تاني بنفس الاسم - نعرضه كخيار سريع بدل ما يتكتب من الأول */}
          {crossWarehouseMatches.length > 0 && (
            <>
              <div style={{ padding: '7px 12px', background: 'rgba(139,92,246,0.08)', fontSize: 11, color: S.purple, fontWeight: 700, borderTop: `1px solid ${S.border}` }}>
                🔗 موجود جاهز في مستودع تاني — إضافته هنا بنفس بياناته
              </div>
              {crossWarehouseMatches.map(p => (
                <div
                  key={`other-${p.id}`}
                  onMouseDown={() => handleUseOther(p)}
                  style={{
                    padding: '9px 14px', cursor: 'pointer',
                    background: 'rgba(139,92,246,0.05)',
                    borderBottom: `1px solid ${S.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: S.white }}>{p.name}</div>
                    {p.name_en && <div style={{ fontSize: 11, color: S.muted }}>{p.name_en}</div>}
                  </div>
                  <div style={{ textAlign: 'left', flexShrink: 0, marginRight: 8 }}>
                    <div style={{ fontSize: 10, color: S.purple }}>📦 {p.warehouse_name}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>{p.category}</div>
                  </div>
                </div>
              ))}
            </>
          )}

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
function NewInvoiceModal({ products: initialProducts, suppliers, units, warehouses, unitConversions, employeeId, onClose, onSaved, onConversionAdded }: {
  products: Product[]; suppliers: Supplier[]; units: Unit[]
  warehouses: { id: string; name: string }[]; unitConversions: any[]; employeeId?: string; onClose: () => void; onSaved: () => void
  onConversionAdded?: (conv: any) => void
}) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')
  const [invoiceImages, setInvoiceImages] = useState<string[]>([])
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

  // ✅ جديد: كل أصناف المستودعات التانية (مرة واحدة بس عند فتح المودال) - عشان نقدر نلاقي نفس الصنف لو موجود في مستودع تاني
  const [allWarehouseProducts, setAllWarehouseProducts] = useState<(Product & { warehouse_name?: string })[]>([])
  useEffect(() => {
    supabase
      .from('warehouse_products')
      .select('*, units(symbol)')
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (!error && data) {
          const withWhName = (data as Product[]).map(p => ({
            ...p,
            warehouse_name: warehouses.find(w => w.id === p.warehouse_id)?.name || '',
          }))
          setAllWarehouseProducts(withWhName)
        }
      })
  }, [])

  const [items, setItems] = useState<InvoiceItem[]>([{
    product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false, contents_manual: ''
  }])
  const [form, setForm] = useState({
    supplier_id: '', warehouse_id: '',
    supplier_invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0], notes: '',
    sst_percent: '',
    discount_type: 'percent' as 'percent' | 'amount',
    discount_value: '',
  })

  // ✅ أصناف موجودة في مستودعات تانية (غير المستودع المختار حاليًا) - عشان نعرضها كخيار "موجود جاهز"
  const otherWarehouseProducts = form.warehouse_id
    ? allWarehouseProducts.filter(p => p.warehouse_id !== form.warehouse_id)
    : []

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
  // ✅ جديد: إضافة معامل تحويل مباشرة من فورم الفاتورة لو مش موجود
  const [addingConvForIndex, setAddingConvForIndex] = useState<number | null>(null)
  const [newConvFactor, setNewConvFactor] = useState('')

  async function saveNewConversion(itemIndex: number, productId: string, fromUnitId: string, toUnitId: string) {
    const factor = parseFloat(newConvFactor)
    if (!factor || factor <= 0) { alert('من فضلك أدخل رقم صحيح أكبر من صفر'); return }
    const { data: created, error } = await supabase.from('unit_conversions').insert([{
      product_id: productId, from_unit_id: fromUnitId, to_unit_id: toUnitId, factor,
    }]).select('product_id, from_unit_id, to_unit_id, factor, from_unit:units!unit_conversions_from_unit_id_fkey(name,symbol), to_unit:units!unit_conversions_to_unit_id_fkey(name,symbol)').single()
    if (error || !created) {
      alert('حصل خطأ أثناء حفظ معامل التحويل: ' + (error?.message || ''))
      return
    }
    onConversionAdded?.(created)
    setItems(p => p.map((it, idx) => idx === itemIndex ? {
      ...it, contents_per_unit: factor, contents_unit_name: (created as any).to_unit?.name,
    } : it))
    setAddingConvForIndex(null)
    setNewConvFactor('')
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setScanning(true)
    setScanProgress('⏳ جاري رفع الصور...')
    const uploadedUrls: string[] = []
    for (const file of files) {
      // ✅ base64 بيتستخدم بس مؤقتًا (في الذاكرة) عشان نبعته لتحليل الذكاء الاصطناعي، مش هيتحفظ في قاعدة البيانات
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      // ✅ الصورة نفسها بترفع على Supabase Storage، ونخزن بس الرابط القصير (مش الصورة كاملة) في قاعدة البيانات
      const uploadedUrl = await uploadInvoiceImage(supabase, file, `invoice_${Date.now()}`)
      if (!uploadedUrl) {
        alert('فشل رفع صورة الفاتورة — تأكد من إعداد bucket "invoice-images" في Supabase')
        continue
      }
      uploadedUrls.push(uploadedUrl)
      // نحلل الصورة بالذكاء الاصطناعي بالـ base64 المؤقت (مش من الرابط، عشان السرعة ومنعًا لأي تأخير شبكة إضافي)
      await handleAIScan(base64)
    }
    setInvoiceImages(prev => [...prev, ...uploadedUrls])
    setScanning(false)
    setScanProgress('')
    // نفرّغ قيمة input عشان لو المستخدم اختار نفس الملفات تاني تتسجل onChange
    e.target.value = ''
  }

  function removeImage(index: number) {
    setInvoiceImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleAIScan(base64: string) {
    setScanning(true)
    setScanProgress('🔍 جاري تحليل الفاتورة بالذكاء الاصطناعي...')
    try {
      setScanProgress('📷 استخراج البيانات من الصورة...')
      const result = await scanInvoiceWithAI(base64, availableProducts)
      setScanProgress('🔗 مطابقة الأصناف مع قاعدة البيانات...')
      // ✅ نملأ حقول الفاتورة (الرقم، التاريخ، الملاحظات، المورد) فقط لو لسه فاضية —
      // عشان لو صورة تانية لنفس الفاتورة فيها رقم/تاريخ مختلف بالغلط، نحافظ على أول قيمة صحيحة اتقرأت
      if (result.invoice_number) setForm(p => p.supplier_invoice_number ? p : ({ ...p, supplier_invoice_number: result.invoice_number }))
      if (result.invoice_date) setForm(p => ({ ...p, invoice_date: result.invoice_date }))
      if (result.notes) setForm(p => p.notes ? { ...p, notes: p.notes + ' / ' + result.notes } : { ...p, notes: result.notes })
      if (result.supplier_name) {
        const matched = localSuppliers.find(s => s.name.includes(result.supplier_name) || result.supplier_name.includes(s.name))
        if (matched) setForm(p => p.supplier_id ? p : ({ ...p, supplier_id: matched.id }))
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
        // ✅ ندمج الأصناف الجديدة مع الموجودة (نستبعد السطر الفارغ الافتراضي الأول لو لسه موجود ومفيهوش بيانات)
        setItems(prev => {
          const cleaned = prev.filter(it => it.product_id || it.product_name || it.quantity || it.unit_price)
          return [...cleaned, ...matchedItems]
        })
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

  // ✅ جديد: لو الصنف موجود جاهز في مستودع تاني، ننسخه للمستودع الحالي بنفس بياناته (الاسم، الكاتيجوري، الوحدة)
  // بدل ما نضطر ندخّل بيانات صنف جديد من الصفر - المخزون بيبدأ من صفر لأنه مخزون منفصل لكل مستودع
  async function useProductFromOtherWarehouse(sourceProduct: Product, itemIndex: number) {
    if (!form.warehouse_id) return
    const { data: created, error } = await supabase.from('warehouse_products').insert([{
      name: sourceProduct.name,
      name_en: sourceProduct.name_en || null,
      category: sourceProduct.category,
      unit_id: (sourceProduct as any).unit_id || null,
      current_stock: 0,
      last_purchase_price: sourceProduct.last_purchase_price || 0,
      min_stock: (sourceProduct as any).min_stock || 0,
      warehouse_id: form.warehouse_id,
      is_active: true,
    }]).select('*, units(symbol)').single()
    if (error || !created) {
      alert('حصل خطأ أثناء إضافة الصنف للمستودع: ' + (error?.message || ''))
      return
    }
    const newProduct = created as Product
    setWarehouseProducts(prev => [...prev, newProduct])
    setItems(p => p.map((it, idx) => idx === itemIndex ? {
      ...it, product_id: newProduct.id, product_name: newProduct.name, matched: true,
      unit_price: newProduct.last_purchase_price ? String(newProduct.last_purchase_price) : it.unit_price,
    } : it))
  }

  function addItem() {
    setItems(p => [...p, { product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false, contents_manual: '' }])
  }

  async function save() {
    if (!form.warehouse_id) { alert('يرجى اختيار المستودع'); return }
    if (items.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return }
    if (items.some(i => !i.product_id || !i.quantity || !i.unit_price)) { alert('يرجى إكمال بيانات الأصناف'); return }
    setSaving(true)
    try {
      // ✅ الترتيب الصحيح: مجموع خام → خصم كل صنف → صافي الصنف → SST على الصافي → مجموع بعد الضريبة → خصم الفاتورة كاملة → الإجمالي النهائي
      const grossSubtotalSave = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0)
      const itemDiscountsTotalSave = items.reduce((s, i) => {
        const gross = parseFloat(i.quantity) * parseFloat(i.unit_price)
        return s + calcItemDiscount(i, gross)
      }, 0)
      const totalSSTAmount = items.reduce((s, i) => {
        const gross = parseFloat(i.quantity) * parseFloat(i.unit_price)
        const net = gross - calcItemDiscount(i, gross)
        return s + Math.round(net * (parseFloat(i.sst_percent || '0') / 100) * 100) / 100
      }, 0)
      const beforeInvoiceDiscountSave = (grossSubtotalSave - itemDiscountsTotalSave) + totalSSTAmount
      const invoiceDiscountVal = parseFloat(form.discount_value || '0') || 0
      const invoiceDiscountAmtSave = invoiceDiscountVal <= 0 ? 0
        : form.discount_type === 'amount' ? Math.min(invoiceDiscountVal, beforeInvoiceDiscountSave)
        : beforeInvoiceDiscountSave * (invoiceDiscountVal / 100)
      const total = Math.max(0, Math.round((beforeInvoiceDiscountSave - invoiceDiscountAmtSave) * 100) / 100)
      const { data: inv, error: invErr } = await supabase.from('purchase_invoices').insert([{
        supplier_id: form.supplier_id || null,
        warehouse_id: form.warehouse_id,
        invoice_number: form.supplier_invoice_number || null,
        invoice_date: form.invoice_date,
        notes: form.notes,
        total_amount: total,
        image_url: invoiceImages[0] || null,
        status: 'confirmed',
        created_by: employeeId || null,
        sst_amount: totalSSTAmount || null,
        discount_type: invoiceDiscountVal > 0 ? form.discount_type : null,
        discount_value: invoiceDiscountVal > 0 ? invoiceDiscountVal : null,
        discount_amount: invoiceDiscountAmtSave || null,
      }]).select().single()
      if (invErr) throw invErr
      if (invoiceImages.length > 0) {
        await supabase.from('purchase_invoice_images').insert(
          invoiceImages.map((url, idx) => ({ invoice_id: inv.id, image_url: url, sort_order: idx }))
        )
      }
      for (const item of items) {
        const itemSSTPercent = parseFloat(item.sst_percent || '0') || 0
        const itemSub = parseFloat(item.quantity) * parseFloat(item.unit_price)
        const itemDiscountAmt = calcItemDiscount(item, itemSub)
        const itemNet = itemSub - itemDiscountAmt
        const itemSSTAmount = Math.round(itemNet * itemSSTPercent / 100 * 100) / 100
        const itemDiscountVal = parseFloat(item.discount_value || '0') || 0
        await supabase.from('purchase_invoice_items').insert([{
          invoice_id: inv.id, product_id: item.product_id,
          quantity: parseFloat(item.quantity), unit_price: parseFloat(item.unit_price),
          unit_id: item.unit_id || null,
          notes: item.contents_manual ? `محتويات الوحدة: ${item.contents_manual}` : null,
          sst_percent: itemSSTPercent || null,
          sst_amount: itemSSTAmount || null,
          discount_type: itemDiscountVal > 0 ? (item.discount_type || 'percent') : null,
          discount_value: itemDiscountVal > 0 ? itemDiscountVal : null,
          discount_amount: itemDiscountAmt || null,
        }])
        // ✅ Fix حرج: لازم نضرب الكمية في معامل التحويل (contents_per_unit) لو الصنف اتشرى بوحدة مختلفة عن وحدة التخزين الأساسية
        // مثال: لو اشتريت "1 صندوق" وكل صندوق = 25 كيس (وحدة التخزين)، لازم يتسجل في المخزون 25 كيس مش 1 بس
        const actualQty = parseFloat(item.quantity) * (item.contents_per_unit || 1)
        await supabase.from('stock_movements').insert([{
          movement_type: 'in', product_id: item.product_id,
          warehouse_id: form.warehouse_id, quantity: actualQty,
          unit_price: parseFloat(item.unit_price), invoice_id: inv.id,
          movement_date: form.invoice_date,
        }])
      }
      // ✅ قيد محاسبي تلقائي: مدين المخزون (1120)، دائن الذمم الدائنة - الموردون (2101)
      if (total > 0) {
        try {
          const { data: wh } = await supabase.from('warehouses').select('branch_id').eq('id', form.warehouse_id).maybeSingle()
          const branchId = (wh as any)?.branch_id
          if (branchId) {
            const supplierName = suppliers.find(s => s.id === form.supplier_id)?.name || 'مورد غير محدد'
            const { count } = await supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('entry_type', 'purchase')
            const entryNumber = `PI-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
            const { data: entry, error: entryErr } = await supabase.from('journal_entries').insert([{
              entry_number: entryNumber, entry_type: 'purchase', date: form.invoice_date,
              description: `فاتورة مشتريات - ${supplierName}`, reference: form.supplier_invoice_number || null,
              total_amount: total, status: 'posted', branch_id: branchId,
            }]).select('id').single()
            if (!entryErr && entry?.id) {
              await supabase.from('journal_entry_lines').insert([
                { entry_id: entry.id, account_code: '1120', account_name: 'المخزون', description: `فاتورة مشتريات - ${supplierName}`, debit: total, credit: 0, sort_order: 0 },
                { entry_id: entry.id, account_code: '2101', account_name: 'الذمم الدائنة - الموردون', description: `فاتورة مشتريات - ${supplierName}`, debit: 0, credit: total, sort_order: 1 },
              ])
            } else {
              console.error('purchase journal entry error:', entryErr?.message)
            }
          }
        } catch (jeErr) {
          console.error('purchase journal entry exception:', jeErr)
        }
      }
      onSaved()
    } catch (e: unknown) {
      alert('خطأ: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  // ✅ حسابات الملخص الكاملة: المجموع الخام، خصومات الأصناف، الضريبة (على الصافي بعد خصم الصنف)، وخصم الفاتورة (على الإجمالي بعد الضريبة)
  const grossSubtotal = items.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)), 0)
  const itemDiscountsTotal = items.reduce((s, i) => {
    const gross = (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)
    return s + calcItemDiscount(i, gross)
  }, 0)
  const netSubtotal = grossSubtotal - itemDiscountsTotal
  const totalSSTAmountPreview = items.reduce((s, i) => {
    const gross = (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)
    const net = gross - calcItemDiscount(i, gross)
    return s + net * (parseFloat(i.sst_percent || '0') / 100)
  }, 0)
  const beforeInvoiceDiscount = netSubtotal + totalSSTAmountPreview
  const invoiceDiscountAmt = (() => {
    const val = parseFloat(form.discount_value || '0') || 0
    if (val <= 0) return 0
    if (form.discount_type === 'amount') return Math.min(val, beforeInvoiceDiscount)
    return beforeInvoiceDiscount * (val / 100)
  })()
  const total = grossSubtotal // ✅ نبقي على الاسم القديم "total" = المجموع الخام، عشان مانكسرش أي استخدام تاني ليه في الكود
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
              <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 10 }}>📷 صور الفاتورة {invoiceImages.length > 0 && `(${invoiceImages.length})`}</div>

              {invoiceImages.length === 0 ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${S.border}`,
                    borderRadius: 14, padding: 24,
                    textAlign: 'center', cursor: 'pointer', marginBottom: 10,
                    background: 'transparent',
                    transition: 'all .2s', minHeight: 140,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
                    <div style={{ fontSize: 13, color: S.white, fontWeight: 600, marginBottom: 4 }}>صوّر أو ارفع الفاتورة</div>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 12 }}>الذكاء الاصطناعي سيستخرج البيانات تلقائياً</div>
                    <div style={{ padding: '7px 18px', background: S.gold3, border: `1px solid ${S.gold}`, borderRadius: 8, display: 'inline-block', fontSize: 12, color: S.gold, fontWeight: 700 }}>اختر صورة أو أكثر</div>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginBottom: 10 }}>
                    {invoiceImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', border: `2px solid ${S.green}`, borderRadius: 10, overflow: 'hidden', aspectRatio: '1' }}>
                        <img src={img} alt={`فاتورة ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => window.open(img, '_blank')} />
                        <button onClick={() => removeImage(idx)}
                          style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: S.white, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '1px 6px', fontSize: 10, color: S.white }}>{idx + 1}</div>
                      </div>
                    ))}
                    <div onClick={() => fileRef.current?.click()}
                      style={{ border: `2px dashed ${S.gold}`, borderRadius: 10, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: S.gold3, fontSize: 24, color: S.gold }}>
                      ＋
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: S.muted }}>📌 لو الفاتورة في أكتر من صفحة، أضف باقي الصور بنفس الطريقة — كل صفحة هتتحلل وتُضاف أصنافها تلقائياً</div>
                </div>
              )}
              {/* ✅ بدون capture — الموبايل يعرض الاختيار: كاميرا أو الاستوديو/الملفات */}
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageUpload} />

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

              {invoiceImages.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setInvoiceImages([]); setItems([{ product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false, contents_manual: '' }]) }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🔄 مسح الكل وإعادة المحاولة</button>
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
                    products={warehouseProducts.length > 0 ? warehouseProducts : localProducts.filter((p: any) => p.warehouse_id === form.warehouse_id)}
                    value={item.product_id}
                    productName={item.product_name}
                    matched={item.matched}
                    loading={loadingWarehouseProducts}
                    otherWarehouseProducts={otherWarehouseProducts}
                    onUseFromOtherWarehouse={(p) => useProductFromOtherWarehouse(p, i)}
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
                        // ✅ Fix حرج جديد: لو الوحدة المختارة هي نفسها الوحدة الأساسية للصنف، مفيش أي تحويل مطلوب خالص
                        // (كان بيدوّر على تحويلات تانية للصنف ده لغرض العرض بس - زي "1 كرتون = 48 علبة" - ويطبّقها غلط
                        // حتى لو المشتري نفسه كرتون بالظبط، فيضاعف الكمية غلط تمامًا)
                        const purchasedProduct = availableProducts.find(p => p.id === item.product_id)
                        const isBaseUnit = purchasedProduct && (purchasedProduct as any).unit_id === e.target.value
                        // ✅ Fix حرج: معامل التحويل ممكن يكون متسجل بأي اتجاه -
                        // إما "وحدة الشراء → الوحدة الأساسية" (نضرب) أو "الوحدة الأساسية → وحدة الشراء" (نقسم)
                        // كان الكود بيدوّر على اتجاه واحد بس، فلو الاتجاه عكسي كان بيسجل الكمية الخام غلط بالكامل
                        const convDirect = isBaseUnit ? null : unitConversions.find(c => c.product_id === item.product_id && c.from_unit_id === e.target.value)
                        const convReverse = isBaseUnit ? null : unitConversions.find(c => c.product_id === item.product_id && c.to_unit_id === e.target.value)
                        let factor: number | undefined = isBaseUnit ? 1 : undefined
                        let unitName: string | undefined = isBaseUnit ? undefined : undefined
                        if (!isBaseUnit && convDirect) { factor = convDirect.factor; unitName = convDirect.to_unit?.name }
                        else if (!isBaseUnit && convReverse) { factor = convReverse.factor ? 1 / convReverse.factor : undefined; unitName = convReverse.from_unit?.name }
                        setItems(p => p.map((it, idx) => idx === i ? {
                          ...it, unit_id: e.target.value,
                          contents_per_unit: factor, contents_unit_name: unitName,
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
                    {/* ✅ جديد: تحذير واضح لو الوحدة المختارة مالهاش معامل تحويل متسجل، مع إمكانية إضافته فورًا من هنا */}
                    {item.matched && item.unit_id && !item.contents_per_unit && (() => {
                      const baseUnitId = availableProducts.find(p => p.id === item.product_id) ? (availableProducts.find(p => p.id === item.product_id) as any)?.unit_id : null
                      if (!baseUnitId || baseUnitId === item.unit_id) return null // نفس الوحدة الأساسية، مفيش داعي لمعامل تحويل
                      const baseUnitSymbol = units.find(u => u.id === baseUnitId)?.symbol || ''
                      return (
                        <div style={{ marginTop: 6, padding: '8px 10px', background: S.amberB, border: `1px solid ${S.amber}`, borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: S.amber, fontWeight: 700, marginBottom: 6 }}>
                            ⚠️ لا يوجد معامل تحويل بين "{units.find(u => u.id === item.unit_id)?.symbol}" و"{baseUnitSymbol}" — الكمية ستُسجَّل 1:1 بدون تحويل!
                          </div>
                          {addingConvForIndex === i ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, color: S.white, whiteSpace: 'nowrap' }}>1 {units.find(u => u.id === item.unit_id)?.symbol} =</span>
                              <input type="number" min="0" step="0.01" value={newConvFactor} onChange={e => setNewConvFactor(e.target.value)}
                                style={{ ...inp, width: 70, padding: '4px 8px', fontSize: 12 }} placeholder="عدد" />
                              <span style={{ fontSize: 11, color: S.white, whiteSpace: 'nowrap' }}>{baseUnitSymbol}</span>
                              <button onClick={() => saveNewConversion(i, item.product_id, item.unit_id, baseUnitId)}
                                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: S.green, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                                حفظ
                              </button>
                              <button onClick={() => { setAddingConvForIndex(null); setNewConvFactor('') }}
                                style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11 }}>
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setAddingConvForIndex(i); setNewConvFactor('') }}
                              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${S.amber}`, background: 'transparent', color: S.amber, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                              ✏️ تحديد معامل التحويل الآن
                            </button>
                          )}
                        </div>
                      )
                    })()}
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
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 11, color: S.muted }}>SST %</label>
                        <input
                          type="number" min="0" max="100" step="0.1"
                          value={item.sst_percent || ''}
                          onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, sst_percent: e.target.value } : it))}
                          placeholder="0"
                          style={{ ...inp, width: 60, padding: '4px 8px', fontSize: 12, textAlign: 'center' }}
                        />
                      </div>
                      {/* ✅ خصم على الصنف - نسبة % أو مبلغ ثابت */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 11, color: S.muted }}>خصم</label>
                        <input
                          type="number" min="0" step="0.1"
                          value={item.discount_value || ''}
                          onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, discount_value: e.target.value } : it))}
                          placeholder="0"
                          style={{ ...inp, width: 60, padding: '4px 8px', fontSize: 12, textAlign: 'center' }}
                        />
                        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                          {(['percent', 'amount'] as const).map(t => (
                            <button key={t} type="button"
                              onClick={() => setItems(p => p.map((it, idx) => idx === i ? { ...it, discount_type: t } : it))}
                              style={{ padding: '4px 8px', fontSize: 11, border: 'none', cursor: 'pointer', background: (item.discount_type || 'percent') === t ? S.gold : 'transparent', color: (item.discount_type || 'percent') === t ? S.navy : S.muted, fontWeight: 700 }}>
                              {t === 'percent' ? '%' : 'MYR'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: 12, color: S.gold, fontWeight: 600, marginTop: 6 }}>
                      {(() => {
                        const subtotal = parseFloat(item.quantity) * parseFloat(item.unit_price)
                        const discountAmt = calcItemDiscount(item, subtotal)
                        const netAmt = subtotal - discountAmt
                        const sst = netAmt * (parseFloat(item.sst_percent || '0') / 100)
                        return (
                          <span>
                            {formatMYR(subtotal)}
                            {discountAmt > 0 && <span style={{ color: S.red }}> −خصم {formatMYR(discountAmt)}</span>}
                            {sst > 0 && <span style={{ color: '#F59E0B' }}> +SST {formatMYR(sst)}</span>}
                            {(discountAmt > 0 || sst > 0) && <span> = {formatMYR(netAmt + sst)}</span>}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ background: S.navy3, borderRadius: 12, padding: '16px 18px', marginTop: 8 }}>
              {/* المجموع قبل أي خصم */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: S.muted, fontSize: 13 }}>المجموع قبل الخصم</span>
                <span style={{ color: S.white, fontSize: 15, fontWeight: 700 }}>{formatMYR(grossSubtotal)}</span>
              </div>
              {/* خصومات الأصناف */}
              {itemDiscountsTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: S.red, fontSize: 13 }}>خصم الأصناف</span>
                  <span style={{ color: S.red, fontSize: 15, fontWeight: 700 }}>− {formatMYR(itemDiscountsTotal)}</span>
                </div>
              )}
              {/* SST إجمالي الأصناف الخاضعة (محسوبة على الصافي بعد خصم الصنف) */}
              {totalSSTAmountPreview > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: '#F59E0B', fontSize: 13 }}>SST (الأصناف الخاضعة)</span>
                  <span style={{ color: '#F59E0B', fontSize: 15, fontWeight: 700 }}>{formatMYR(totalSSTAmountPreview)}</span>
                </div>
              )}

              {/* ✅ خصم على الفاتورة كاملة - نسبة % أو مبلغ ثابت */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingTop: 8, borderTop: `1px dashed rgba(255,255,255,0.08)` }}>
                <span style={{ color: S.muted, fontSize: 13 }}>خصم على الفاتورة كاملة</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" min="0" step="0.1"
                    value={form.discount_value}
                    onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                    placeholder="0"
                    style={{ ...inp, width: 70, padding: '4px 8px', fontSize: 12, textAlign: 'center' }}
                  />
                  <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                    {(['percent', 'amount'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setForm(p => ({ ...p, discount_type: t }))}
                        style={{ padding: '4px 8px', fontSize: 11, border: 'none', cursor: 'pointer', background: form.discount_type === t ? S.gold : 'transparent', color: form.discount_type === t ? S.navy : S.muted, fontWeight: 700 }}>
                        {t === 'percent' ? '%' : 'MYR'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {invoiceDiscountAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: S.red, fontSize: 13 }}>قيمة خصم الفاتورة</span>
                  <span style={{ color: S.red, fontSize: 15, fontWeight: 700 }}>− {formatMYR(invoiceDiscountAmt)}</span>
                </div>
              )}

              {/* الإجمالي النهائي */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: `1px solid rgba(255,255,255,0.07)` }}>
                <span style={{ color: S.muted, fontSize: 14 }}>الإجمالي النهائي</span>
                <span style={{ color: S.gold, fontSize: 22, fontWeight: 800 }}>
                  {formatMYR(Math.max(0, beforeInvoiceDiscount - invoiceDiscountAmt))}
                </span>
              </div>
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
function InvoiceDetailModal({ invoice, products, suppliers, units, warehouses, unitConversions, currentEmployeeId, currentEmployeeName, onClose, onViewImage, onDeleted, onSaved }: {
  invoice: any; products: any[]; suppliers: any[]; units: any[]; warehouses: any[]; unitConversions?: any[]
  currentEmployeeId?: string; currentEmployeeName?: string
  onClose: () => void; onViewImage: (url: string) => void; onDeleted: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  // ✅ editForm معرّف أولاً قبل أي useEffect يستخدمه
  const [editForm, setEditForm] = useState({
    invoice_number: invoice.invoice_number || '',
    invoice_date: invoice.invoice_date || '',
    supplier_id: invoice.supplier_id || '',
    warehouse_id: invoice.warehouse_id || '',
    notes: invoice.notes || '',
    sst_percent: String((invoice as any).sst_percent || ''),
    discount_type: ((invoice as any).discount_type || 'percent') as 'percent' | 'amount',
    discount_value: String((invoice as any).discount_value || ''),
  })
  const [editItems, setEditItems] = useState<any[]>([])
  // ✅ جديد: إضافة معامل تحويل مباشرة من فورم التعديل لو مش موجود
  const [addingConvForEditIndex, setAddingConvForEditIndex] = useState<number | null>(null)
  const [newEditConvFactor, setNewEditConvFactor] = useState('')

  async function saveNewEditConversion(itemIndex: number, productId: string, fromUnitId: string, toUnitId: string) {
    const factor = parseFloat(newEditConvFactor)
    if (!factor || factor <= 0) { alert('من فضلك أدخل رقم صحيح أكبر من صفر'); return }
    const { data: created, error } = await supabase.from('unit_conversions').insert([{
      product_id: productId, from_unit_id: fromUnitId, to_unit_id: toUnitId, factor,
    }]).select('product_id, from_unit_id, to_unit_id, factor, from_unit:units!unit_conversions_from_unit_id_fkey(name,symbol), to_unit:units!unit_conversions_to_unit_id_fkey(name,symbol)').single()
    if (error || !created) {
      alert('حصل خطأ أثناء حفظ معامل التحويل: ' + (error?.message || ''))
      return
    }
    setEditItems(p => p.map((it, idx) => idx === itemIndex ? {
      ...it, contents_per_unit: factor, contents_unit_name: (created as any).to_unit?.name,
    } : it))
    setAddingConvForEditIndex(null)
    setNewEditConvFactor('')
  }
  const [editWarehouseProducts, setEditWarehouseProducts] = useState<any[]>([])
  const [loadingEditProducts, setLoadingEditProducts] = useState(false)
  // ميزة: ملاحظات الفاتورة (يدوية + سجل تعديلات)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [invoiceNotes, setInvoiceNotes] = useState<any[]>([])
  // ميزة: سبب التعديل
  const [editReason, setEditReason] = useState('')

  // ✅ الصورة بقت بتتجاب هنا بس (لما الفاتورة تتفتح)، مش مع قايمة الفواتير كلها - أهم إصلاح لمشكلة الـ timeout
  const [invoiceImageUrl, setInvoiceImageUrl] = useState<string | null>(invoice.image_url || null)
  useEffect(() => {
    supabase.from('purchase_invoices').select('image_url').eq('id', invoice.id).maybeSingle().then(({ data }) => {
      setInvoiceImageUrl(data?.image_url || null)
    })
  }, [invoice.id])

  // جلب أصناف المستودع المختار مباشرة من قاعدة البيانات
  useEffect(() => {
    if (!editForm.warehouse_id) { setEditWarehouseProducts([]); return }
    setLoadingEditProducts(true)
    supabase.from('warehouse_products')
      .select('*, units(symbol)')
      .eq('is_active', true)
      .eq('warehouse_id', editForm.warehouse_id)
      .order('name')
      .then(({ data }) => { setEditWarehouseProducts(data || []); setLoadingEditProducts(false) })
  }, [editForm.warehouse_id])

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
        .select('id, invoice_id, product_id, quantity, unit_price, unit_id, notes, sst_percent, sst_amount, discount_type, discount_value, discount_amount')
        .eq('invoice_id', invoice.id)
      if (!rawItems || rawItems.length === 0) { setItems([]); setEditItems([]); setLoadingItems(false); return }
      const productIds = [...new Set(rawItems.map((i: any) => i.product_id))]
      const { data: prods } = await supabase.from('warehouse_products').select('id, name, unit_id').in('id', productIds)
      const prodMap = Object.fromEntries((prods || []).map((p: any) => [p.id, p.name]))
      const prodUnitMap = Object.fromEntries((prods || []).map((p: any) => [p.id, p.unit_id]))
      const loaded = rawItems.map((i: any) => ({ ...i, product_name: prodMap[i.product_id] || '—' }))
      setItems(loaded)
      setEditItems(loaded.map((i: any) => {
        // ✅ Fix حرج جديد: لو الوحدة المسجلة هي نفسها الوحدة الأساسية للصنف، مفيش أي تحويل مطلوب خالص
        const isBaseUnit = prodUnitMap[i.product_id] === i.unit_id
        // ✅ Fix حرج: دعم الاتجاهين لمعامل التحويل (نفس منطق الفاتورة الجديدة)
        const convDirect = isBaseUnit ? null : (unitConversions || []).find((c: any) => c.product_id === i.product_id && c.from_unit_id === i.unit_id)
        const convReverse = isBaseUnit ? null : (unitConversions || []).find((c: any) => c.product_id === i.product_id && c.to_unit_id === i.unit_id)
        const factor = isBaseUnit ? 1 : (convDirect ? convDirect.factor : (convReverse?.factor ? 1 / convReverse.factor : undefined))
        const unitName = isBaseUnit ? undefined : (convDirect ? convDirect.to_unit?.name : convReverse?.from_unit?.name)
        return {
          id: i.id, product_id: i.product_id, quantity: String(i.quantity), unit_price: String(i.unit_price), unit_id: i.unit_id || '',
          sst_percent: i.sst_percent != null ? String(i.sst_percent) : '',
          discount_type: i.discount_type || 'percent',
          discount_value: i.discount_value != null ? String(i.discount_value) : '',
          contents_per_unit: factor, contents_unit_name: unitName,
        }
      }))
      setLoadingItems(false)
    }
    async function loadNotes() {
      const { data } = await supabase
        .from('purchase_invoice_notes')
        .select('id, note_type, note, reason, created_at, employee_id, employees(name)')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: false })
      setInvoiceNotes(data || [])
    }
    loadItems()
    loadNotes()
  }, [invoice.id])

  async function saveNote() {
    if (!newNote.trim()) return
    setSavingNote(true)
    const { error } = await supabase.from('purchase_invoice_notes').insert([{
      invoice_id: invoice.id,
      note_type: 'manual',
      note: newNote.trim(),
      employee_id: currentEmployeeId || null,
    }])
    if (!error) {
      setNewNote('')
      const { data } = await supabase
        .from('purchase_invoice_notes')
        .select('id, note_type, note, reason, created_at, employee_id, employees(name)')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: false })
      setInvoiceNotes(data || [])
    }
    setSavingNote(false)
  }

  async function handleSave() {
    if (editItems.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return }
    if (editItems.some(i => !i.product_id || !i.quantity || !i.unit_price)) { alert('يرجى إكمال بيانات الأصناف'); return }
    if (!editReason.trim()) { alert('يرجى كتابة سبب التعديل'); return }
    setSaving(true)
    // ✅ نفس ترتيب الحساب المستخدم في فاتورة جديدة: خام → خصم الصنف → صافي → SST على الصافي → خصم الفاتورة → الإجمالي
    const grossSubtotalEdit = editItems.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0)
    const itemDiscountsTotalEdit = editItems.reduce((s, i) => {
      const gross = parseFloat(i.quantity) * parseFloat(i.unit_price)
      return s + calcItemDiscount(i, gross)
    }, 0)
    const totalSSTAmount = editItems.reduce((s, i) => {
      const gross = parseFloat(i.quantity) * parseFloat(i.unit_price)
      const net = gross - calcItemDiscount(i, gross)
      return s + Math.round(net * (parseFloat(i.sst_percent || '0') / 100) * 100) / 100
    }, 0)
    const beforeInvoiceDiscountEdit = (grossSubtotalEdit - itemDiscountsTotalEdit) + totalSSTAmount
    const editInvoiceDiscountVal = parseFloat(editForm.discount_value || '0') || 0
    const editInvoiceDiscountAmt = editInvoiceDiscountVal <= 0 ? 0
      : editForm.discount_type === 'amount' ? Math.min(editInvoiceDiscountVal, beforeInvoiceDiscountEdit)
      : beforeInvoiceDiscountEdit * (editInvoiceDiscountVal / 100)
    const total = Math.max(0, Math.round((beforeInvoiceDiscountEdit - editInvoiceDiscountAmt) * 100) / 100)
    await supabase.from('purchase_invoices').update({
      invoice_number: editForm.invoice_number || null, invoice_date: editForm.invoice_date, supplier_id: editForm.supplier_id || null, warehouse_id: editForm.warehouse_id || null, notes: editForm.notes || null,
      total_amount: total, sst_amount: totalSSTAmount || null,
      discount_type: editInvoiceDiscountVal > 0 ? editForm.discount_type : null,
      discount_value: editInvoiceDiscountVal > 0 ? editInvoiceDiscountVal : null,
      discount_amount: editInvoiceDiscountAmt || null,
    }).eq('id', invoice.id)
    await supabase.from('purchase_invoice_items').delete().eq('invoice_id', invoice.id)
    await supabase.from('stock_movements').delete().eq('invoice_id', invoice.id)
    for (const item of editItems) {
      const itemSSTPercent = parseFloat(item.sst_percent || '0') || 0
      const itemSub = parseFloat(item.quantity) * parseFloat(item.unit_price)
      const itemDiscountAmt = calcItemDiscount(item, itemSub)
      const itemNet = itemSub - itemDiscountAmt
      const itemSSTAmount = Math.round(itemNet * itemSSTPercent / 100 * 100) / 100
      const itemDiscountVal = parseFloat(item.discount_value || '0') || 0
      await supabase.from('purchase_invoice_items').insert([{
        invoice_id: invoice.id,
        product_id: item.product_id,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        unit_id: item.unit_id || null,
        sst_percent: itemSSTPercent || null,
        sst_amount: itemSSTAmount || null,
        discount_type: itemDiscountVal > 0 ? (item.discount_type || 'percent') : null,
        discount_value: itemDiscountVal > 0 ? itemDiscountVal : null,
        discount_amount: itemDiscountAmt || null,
      }])
      if (editForm.warehouse_id) {
        // ✅ Fix حرج (نفس إصلاح الفاتورة الجديدة): لازم نضرب الكمية في معامل التحويل الصحيح
        // بنلاقيه من unit_id المحفوظ مع الصنف نفسه (الوحدة اللي اتشرى بيها وقت إنشاء الفاتورة الأصلية)
        // ✅ Fix إضافي حرج: معامل التحويل ممكن يكون متسجل بأي اتجاه (وحدة الشراء→الأساسية أو العكس)
        // ✅ Fix حرج جديد: لو وحدة الشراء المسجلة هي نفسها الوحدة الأساسية للصنف، مفيش أي تحويل مطلوب خالص
        // (كان بيدوّر على تحويلات تانية للصنف موجودة لغرض العرض بس - زي "1 كرتون = 48 علبة" - ويطبّقها غلط)
        // ملحوظة: products هنا فاضية دايمًا (مش متسجل فيها بيانات)، فبنستخدم editWarehouseProducts كمصدر موثوق
        const prodSourceForBase = editWarehouseProducts.length > 0 ? editWarehouseProducts : products
        const purchasedProductBase = (prodSourceForBase.find((p: any) => p.id === item.product_id) as any)?.unit_id
        const isBaseUnit = purchasedProductBase === item.unit_id
        const convDirect = isBaseUnit ? null : (unitConversions || []).find((c: any) => c.product_id === item.product_id && c.from_unit_id === item.unit_id)
        const convReverse = isBaseUnit ? null : (unitConversions || []).find((c: any) => c.product_id === item.product_id && c.to_unit_id === item.unit_id)
        const factor = isBaseUnit ? 1 : (convDirect ? convDirect.factor : (convReverse?.factor ? 1 / convReverse.factor : 1))
        const actualQty = parseFloat(item.quantity) * factor
        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          warehouse_id: editForm.warehouse_id,
          movement_type: 'in',
          quantity: actualQty,
          invoice_id: invoice.id,
          notes: 'تعديل فاتورة مشتريات',
        }])
      }
    }
    setSaving(false)
    // ✅ تسجيل سبب التعديل في جدول الملاحظات
    await supabase.from('purchase_invoice_notes').insert([{
      invoice_id: invoice.id,
      note_type: 'edit',
      reason: editReason.trim(),
      note: `تعديل بواسطة ${currentEmployeeName || 'مجهول'}`,
      employee_id: currentEmployeeId || null,
    }])
    setEditReason('')
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

  // ✅ حسابات ملخص التعديل - نفس منطق فاتورة جديدة بالظبط
  const editGrossSubtotal = editItems.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)), 0)
  const editItemDiscountsTotal = editItems.reduce((s, i) => {
    const gross = (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)
    return s + calcItemDiscount(i, gross)
  }, 0)
  const editTotalSST = editItems.reduce((s, i) => {
    const gross = (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)
    const net = gross - calcItemDiscount(i, gross)
    return s + net * (parseFloat(i.sst_percent || '0') / 100)
  }, 0)
  const editBeforeInvoiceDiscount = (editGrossSubtotal - editItemDiscountsTotal) + editTotalSST
  const editInvoiceDiscountPreview = (() => {
    const val = parseFloat(editForm.discount_value || '0') || 0
    if (val <= 0) return 0
    if (editForm.discount_type === 'amount') return Math.min(val, editBeforeInvoiceDiscount)
    return editBeforeInvoiceDiscount * (val / 100)
  })()
  const editTotal = editGrossSubtotal // ✅ الاسم القديم "editTotal" = المجموع الخام، عشان مانكسرش أي استخدام تاني ليه


  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: S2.navy2, borderRadius: 18, border: `1px solid ${S2.border}`, width: '100%', maxWidth: 580, padding: '24px 20px', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: S2.gold, fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{mode === 'edit' ? '✏️ تعديل الفاتورة' : '🧾 تفاصيل الفاتورة'}</h3>
            {invoice.invoice_number && <div style={{ fontSize: 12, color: S2.muted }}>رقم المورد: {invoice.invoice_number}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {mode === 'view' && (() => {
              const hoursSinceCreation = (Date.now() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60)
              const canEdit = hoursSinceCreation <= 24
              return canEdit ? (
                <button onClick={() => setMode('edit')} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S2.gold}`, background: S2.gold3, color: S2.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✏️ تعديل</button>
              ) : null
            })()}
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
                { label: 'الصافي قبل الضريبة', value: formatMYR((invoice.total_amount || 0) - ((invoice as any).sst_amount || 0) + ((invoice as any).discount_amount || 0)), icon: '💵' },
                ...((invoice as any).discount_amount ? [{ label: `خصم الفاتورة${(invoice as any).discount_type === 'percent' ? ` (${(invoice as any).discount_value}%)` : ''}`, value: '− ' + formatMYR((invoice as any).discount_amount || 0), icon: '🏷️', amber: true }] : []),
                ...((invoice as any).sst_amount ? [{ label: `SST`, value: formatMYR((invoice as any).sst_amount || 0), icon: '🧾', amber: true }] : []),
                { label: 'الإجمالي النهائي', value: `MYR ${Number(invoice.total_amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, icon: '💰', green: true },
                { label: 'أدخلها', value: (invoice as any).employees?.name || '—', icon: '👤' },
              ].map((r, i) => (
                <div key={i} style={{ background: S2.card, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: S2.muted, marginBottom: 3 }}>{r.icon} {r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: (r as any).green ? S2.green : (r as any).amber ? '#F59E0B' : S2.white }}>{r.value}</div>
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
                        <div style={{ fontSize: 12, color: S2.muted }}>{parseFloat(item.unit_price).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: 12, color: S2.gold, fontWeight: 600 }}>{t.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                    )
                  })}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 12px', gap: 8, borderTop: `1px solid ${S2.border}`, background: S2.greenB }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S2.green, gridColumn: '1/4' }}>الإجمالي</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S2.green }}>{items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ قسم الملاحظات — ملاحظات يدوية + سجل التعديلات */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: S2.gold, fontWeight: 700, marginBottom: 10 }}>📝 الملاحظات والتعديلات</div>
              {/* إضافة ملاحظة جديدة */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="أضف ملاحظة على الفاتورة..."
                  style={{ ...inpD, flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') saveNote() }}
                />
                <button onClick={saveNote} disabled={savingNote || !newNote.trim()} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${S2.gold}`, background: S2.gold3, color: S2.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: !newNote.trim() ? 0.5 : 1 }}>
                  {savingNote ? '⏳' : '💬 إضافة'}
                </button>
              </div>
              {/* سجل الملاحظات */}
              {invoiceNotes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invoiceNotes.map((n: any) => (
                    <div key={n.id} style={{ background: n.note_type === 'edit' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', borderRight: `3px solid ${n.note_type === 'edit' ? S2.amber : S2.blue}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: n.note_type === 'edit' ? S2.amber : S2.blue, fontWeight: 700 }}>
                          {n.note_type === 'edit' ? '✏️ تعديل' : '💬 ملاحظة'} — {n.employees?.name || 'مجهول'}
                        </span>
                        <span style={{ fontSize: 10, color: S2.muted }}>{new Date(n.created_at).toLocaleString('ar-SA')}</span>
                      </div>
                      {n.reason && <div style={{ fontSize: 12, color: S2.white, marginBottom: 2 }}>السبب: {n.reason}</div>}
                      {n.note && <div style={{ fontSize: 12, color: S2.muted }}>{n.note}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 12, color: S2.muted, fontSize: 12 }}>لا توجد ملاحظات بعد</div>
              )}
            </div>

            {invoiceImageUrl && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: S2.gold, fontWeight: 700, marginBottom: 8 }}>📸 صورة الفاتورة</div>
                <img src={invoiceImageUrl} alt="فاتورة" style={{ width: '100%', maxHeight: 180, borderRadius: 10, cursor: 'pointer', border: `1px solid ${S2.border}`, objectFit: 'contain', background: S2.navy3 }} onClick={() => onViewImage(invoiceImageUrl)} />
                <button onClick={() => onViewImage(invoiceImageUrl)} style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${S2.blue}`, background: S2.blueB, color: S2.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🔍 عرض بالحجم الكامل</button>
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
              <div>
                <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>خصم على الفاتورة كاملة</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min="0" step="0.1" style={{ ...inpD, width: 100, textAlign: 'center' }} value={editForm.discount_value} onChange={e => setEditForm(p => ({ ...p, discount_value: e.target.value }))} placeholder="0" />
                  <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid rgba(255,255,255,0.10)` }}>
                    {(['percent', 'amount'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setEditForm(p => ({ ...p, discount_type: t }))}
                        style={{ padding: '5px 10px', fontSize: 12, border: 'none', cursor: 'pointer', background: editForm.discount_type === t ? S2.gold : 'transparent', color: editForm.discount_type === t ? S2.navy : S2.muted, fontWeight: 700 }}>
                        {t === 'percent' ? '%' : 'MYR'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S2.white }}>📦 الأصناف</div>
                <button onClick={() => setEditItems(p => [...p, { product_id: '', quantity: '', unit_price: '', unit_id: '' }])} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S2.green}`, background: S2.greenB, color: S2.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>➕ إضافة صنف</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editItems.map((item, i) => (
                  <div key={i} style={{ background: S2.card, borderRadius: 10, padding: '8px 10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                      <select style={{ ...inpD, padding: '7px 10px' }} value={item.product_id} onChange={e => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, product_id: e.target.value } : x))}>
                        <option value="">الصنف</option>
                        {(editWarehouseProducts.length > 0 ? editWarehouseProducts : products.filter((p: any) => p.warehouse_id === editForm.warehouse_id)).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input style={{ ...inpD, padding: '7px 10px' }} type="number" placeholder="الكمية" value={item.quantity} onChange={e => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, quantity: e.target.value } : x))} />
                      <input style={{ ...inpD, padding: '7px 10px' }} type="number" placeholder="السعر" value={item.unit_price} onChange={e => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, unit_price: e.target.value } : x))} />
                      {/* ✅ جديد: عرض/تعديل الوحدة - كانت غايبة تمامًا في وضع التعديل */}
                      <select style={{ ...inpD, padding: '7px 10px' }} value={item.unit_id || ''} onChange={e => {
                        // ✅ Fix حرج جديد: لو الوحدة المختارة هي نفسها الوحدة الأساسية للصنف، مفيش أي تحويل مطلوب خالص
                        const prodSourceForBase = editWarehouseProducts.length > 0 ? editWarehouseProducts : products
                        const purchasedProductBase = (prodSourceForBase.find((p: any) => p.id === item.product_id) as any)?.unit_id
                        const isBaseUnit = purchasedProductBase === e.target.value
                        // ✅ Fix حرج: دعم الاتجاهين لمعامل التحويل
                        const convDirect = isBaseUnit ? null : (unitConversions || []).find((c: any) => c.product_id === item.product_id && c.from_unit_id === e.target.value)
                        const convReverse = isBaseUnit ? null : (unitConversions || []).find((c: any) => c.product_id === item.product_id && c.to_unit_id === e.target.value)
                        const factor = isBaseUnit ? 1 : (convDirect ? convDirect.factor : (convReverse?.factor ? 1 / convReverse.factor : undefined))
                        const unitName = isBaseUnit ? undefined : (convDirect ? convDirect.to_unit?.name : convReverse?.from_unit?.name)
                        setEditItems(p => p.map((x, xi) => xi === i ? {
                          ...x, unit_id: e.target.value,
                          contents_per_unit: factor, contents_unit_name: unitName,
                        } : x))
                      }}>
                        <option value="">الوحدة</option>
                        {units.map((u: any) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                      </select>
                      <button onClick={() => setEditItems(p => p.filter((_, xi) => xi !== i))} style={{ background: S2.redB, border: `1px solid ${S2.red}`, borderRadius: 8, color: S2.red, cursor: 'pointer', padding: '7px 10px', fontSize: 14 }}>✕</button>
                    </div>
                    {item.contents_per_unit && item.contents_unit_name && (
                      <div style={{ fontSize: 10, color: S2.blue, marginTop: 6, fontWeight: 600 }}>
                        📦 1 وحدة = {item.contents_per_unit} {item.contents_unit_name}
                        {item.quantity && <span style={{ color: S2.gold }}> ← إجمالي: {(parseFloat(item.quantity) * item.contents_per_unit).toFixed(1)}</span>}
                      </div>
                    )}
                    {/* ✅ جديد: تحذير لو الوحدة مالهاش معامل تحويل، مع إمكانية إضافته فورًا */}
                    {item.product_id && item.unit_id && !item.contents_per_unit && (() => {
                      const prodList = editWarehouseProducts.length > 0 ? editWarehouseProducts : products
                      const baseUnitId = (prodList.find((p: any) => p.id === item.product_id) as any)?.unit_id
                      if (!baseUnitId || baseUnitId === item.unit_id) return null
                      const baseUnitSymbol = units.find((u: any) => u.id === baseUnitId)?.symbol || ''
                      return (
                        <div style={{ marginTop: 6, padding: '8px 10px', background: S2.amberB, border: `1px solid ${S2.amber}`, borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: S2.amber, fontWeight: 700, marginBottom: 6 }}>
                            ⚠️ لا يوجد معامل تحويل بين "{units.find((u: any) => u.id === item.unit_id)?.symbol}" و"{baseUnitSymbol}" — الكمية ستُسجَّل 1:1 بدون تحويل!
                          </div>
                          {addingConvForEditIndex === i ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, color: S2.white, whiteSpace: 'nowrap' }}>1 {units.find((u: any) => u.id === item.unit_id)?.symbol} =</span>
                              <input type="number" min="0" step="0.01" value={newEditConvFactor} onChange={e => setNewEditConvFactor(e.target.value)}
                                style={{ ...inpD, width: 70, padding: '4px 8px', fontSize: 12 }} placeholder="عدد" />
                              <span style={{ fontSize: 11, color: S2.white, whiteSpace: 'nowrap' }}>{baseUnitSymbol}</span>
                              <button onClick={() => saveNewEditConversion(i, item.product_id, item.unit_id, baseUnitId)}
                                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: S2.green, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                                حفظ
                              </button>
                              <button onClick={() => { setAddingConvForEditIndex(null); setNewEditConvFactor('') }}
                                style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${S2.border}`, background: 'transparent', color: S2.muted, cursor: 'pointer', fontSize: 11 }}>
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setAddingConvForEditIndex(i); setNewEditConvFactor('') }}
                              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${S2.amber}`, background: 'transparent', color: S2.amber, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                              ✏️ تحديد معامل التحويل الآن
                            </button>
                          )}
                        </div>
                      )
                    })()}
                    {item.quantity && item.unit_price && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ fontSize: 11, color: S2.muted }}>SST %</label>
                          <input type="number" min="0" max="100" step="0.1" value={item.sst_percent || ''}
                            onChange={e => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, sst_percent: e.target.value } : x))}
                            placeholder="0" style={{ ...inpD, width: 60, padding: '4px 8px', fontSize: 12, textAlign: 'center' }} />
                        </div>
                        {/* ✅ خصم على الصنف - نسبة % أو مبلغ ثابت */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ fontSize: 11, color: S2.muted }}>خصم</label>
                          <input type="number" min="0" step="0.1" value={item.discount_value || ''}
                            onChange={e => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, discount_value: e.target.value } : x))}
                            placeholder="0" style={{ ...inpD, width: 60, padding: '4px 8px', fontSize: 12, textAlign: 'center' }} />
                          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid rgba(255,255,255,0.10)` }}>
                            {(['percent', 'amount'] as const).map(t => (
                              <button key={t} type="button"
                                onClick={() => setEditItems(p => p.map((x, xi) => xi === i ? { ...x, discount_type: t } : x))}
                                style={{ padding: '4px 8px', fontSize: 11, border: 'none', cursor: 'pointer', background: (item.discount_type || 'percent') === t ? S2.gold : 'transparent', color: (item.discount_type || 'percent') === t ? S2.navy : S2.muted, fontWeight: 700 }}>
                                {t === 'percent' ? '%' : 'MYR'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ marginLeft: 'auto', fontSize: 12, color: S2.gold, fontWeight: 600 }}>
                          {(() => {
                            const gross = parseFloat(item.quantity) * parseFloat(item.unit_price)
                            const disc = calcItemDiscount(item, gross)
                            const net = gross - disc
                            const sst = net * (parseFloat(item.sst_percent || '0') / 100)
                            return (
                              <span>
                                MYR {gross.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {disc > 0 && <span style={{ color: S2.red }}> −{disc.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                                {sst > 0 && <span style={{ color: '#F59E0B' }}> +{sst.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                                {(disc > 0 || sst > 0) && <span> = {(net + sst).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {editItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 16, color: S2.muted, fontSize: 12, background: S2.card, borderRadius: 10 }}>اضغط "إضافة صنف" لإضافة الأصناف</div>
                )}
              </div>
              {editItems.length > 0 && (
                <div style={{ background: S2.navy3, borderRadius: 12, padding: '14px 16px', marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: S2.muted }}>المجموع قبل الخصم</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: S2.white }}>MYR {editGrossSubtotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {editItemDiscountsTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: S2.red }}>خصم الأصناف</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: S2.red }}>− MYR {editItemDiscountsTotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {editTotalSST > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#F59E0B' }}>SST (الأصناف الخاضعة)</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>MYR {editTotalSST.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {editInvoiceDiscountPreview > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: S2.red }}>خصم الفاتورة كاملة</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: S2.red }}>− MYR {editInvoiceDiscountPreview.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid rgba(255,255,255,0.07)` }}>
                    <span style={{ fontSize: 13, color: S2.muted }}>الإجمالي النهائي</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: S2.green }}>MYR {Math.max(0, editBeforeInvoiceDiscount - editInvoiceDiscountPreview).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: S2.amber, display: 'block', marginBottom: 4, fontWeight: 700 }}>⚠️ سبب التعديل (مطلوب)</label>
              <input
                value={editReason} onChange={e => setEditReason(e.target.value)}
                placeholder="اكتب سبب التعديل هنا..."
                style={{ ...inpD, borderColor: 'rgba(245,158,11,0.4)' }}
              />
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
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  // ✅ Fix: أمين المستودع ومدير المستودعات (مش أمين المستودع بس) يشوفوا فواتير وكل المستودعات زي الأدمن
  const canSeeAllBranches = isAdmin || ['warehouse_keeper', 'warehouse_manager'].includes(employee?.role || '')
  const myBranchId = employee?.branch_id || ''

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [unitConversions, setUnitConversions] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; branch_id?: string }[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  // ✅ جديد: فلتر مشتريات يوم واحد بعينه - مستقل عن فلتر الشهر، لعرض وطباعة مشتريات يوم محدد فقط
  const [filterDate, setFilterDate] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [viewerImage, setViewerImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('') // '' = الإجمالي (admin فقط)، أو branch_id محدد
  const [showReport, setShowReport] = useState(false)

  const [fetchError, setFetchError] = useState<string | null>(null)

  // ✅ نجيب كل الفواتير على صفحات 1000 — قبل كده كان في .limit(200) فالإجمالي وعدد الفواتير
  // كانا يتجمّدان عند 200 مع إن الفواتير تزيد كل يوم
  const fetchAllInvoices = async () => {
    const PAGE = 1000
    const cols = 'id, created_at, invoice_number, invoice_date, supplier_id, warehouse_id, total_amount, sst_percent, sst_amount, notes, status, created_by, warehouse_suppliers(name), warehouses(name,branch_id), employees(name)'
    const all: any[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('purchase_invoices')
        .select(cols)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) return { data: all, error }
      all.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
    return { data: all, error: null as any }
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const [inv, sup, un, wh, brs, uc] = await Promise.all([
      fetchAllInvoices(),
      supabase.from('warehouse_suppliers').select('id,name').order('name'),
      supabase.from('units').select('id,name,symbol').order('name'),
      supabase.from('warehouses').select('id,name,branch_id').eq('is_active', true),
      supabase.from('branches').select('id,name').eq('is_active', true),
      supabase.from('unit_conversions').select('product_id, from_unit_id, to_unit_id, factor, from_unit:units!unit_conversions_from_unit_id_fkey(name,symbol), to_unit:units!unit_conversions_to_unit_id_fkey(name,symbol)'),
    ])

    // ✅ لو طلب الفواتير فشل (RLS، حجم رد كبير جدًا، timeout...)، نطبع ونعرض الخطأ الحقيقي بدل ما نسيبها تظهر "لا يوجد فواتير" بصمت
    if (inv.error) {
      console.error('purchase_invoices fetch error:', inv.error)
      setFetchError(inv.error.message || 'فشل تحميل الفواتير')
    }

    // تحويل المصفوفات الفرعية الخاصة بالعلاقات إلى كائنات مفردة متوافقة مع الـ Types
    const formattedInvoices = (inv.data || []).map((invoice: any) => ({
      ...invoice,
      // تحويل المصفوفة لكائن بأخذ العنصر الأول [0]
      warehouse_suppliers: Array.isArray(invoice.warehouse_suppliers) 
        ? invoice.warehouse_suppliers[0] 
        : invoice.warehouse_suppliers,
      
      warehouses: Array.isArray(invoice.warehouses) 
        ? invoice.warehouses[0] 
        : invoice.warehouses
    }))

    setInvoices(formattedInvoices)
    setSuppliers(sup.data || [])
    setUnits(un.data || [])
    setWarehouses(wh.data || [])
    setBranches(brs.data || [])
    setUnitConversions(uc.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // تحديد التاب الافتراضي بناءً على الدور:
  // admin يبدأ بـ"الإجمالي" ويشوف الكل بحرية.
  // غيره يتقفل على فرعه (لو عنده branch_id)، أو على "المستودع الرئيسي" لو مالوش فرع (أمين مستودع رئيسي مستقبلاً)
  useEffect(() => {
    if (!canSeeAllBranches) setActiveTab(myBranchId || 'main')
  }, [canSeeAllBranches, myBranchId])

  const thisMonth = new Date().toISOString().slice(0, 7)

  // خريطة سريعة: warehouse_id → branch_id (أو 'main' لو المستودع غير مرتبط بفرع — المستودع الرئيسي)
  // ✅ useMemo: تتحسب بس لو warehouses اتغيرت، مش مع كل render
  const warehouseBranchMap = useMemo(() => Object.fromEntries(
    warehouses.map(w => [w.id, w.branch_id || 'main'])
  ), [warehouses])

  function invoiceBranchKey(inv: Invoice): string {
    if (inv.warehouses?.branch_id) return inv.warehouses.branch_id
    if (inv.warehouse_id && warehouseBranchMap[inv.warehouse_id]) return warehouseBranchMap[inv.warehouse_id]
    return 'main'
  }

  // التابات: تاب لكل فرع له مستودع، بالإضافة لتاب "المستودع الرئيسي" دائمًا
  const branchTabs = useMemo(() => branches.map(b => ({ key: b.id, label: `🏪 ${b.name}` })), [branches])
  const allTabs = useMemo(() => [{ key: 'main', label: '🏭 المستودع الرئيسي' }, ...branchTabs], [branchTabs])
  // الأدوار غير admin/أمين مستودع تشوف بس تاب فرعها (أو المستودع الرئيسي لو مالهاش فرع)
  const visibleTabs = canSeeAllBranches ? allTabs : allTabs.filter(t => t.key === (myBranchId || 'main'))

  // ✅ useMemo: أهم تحسين - كانت الفلاتر دي بتتكرر مع كل حرف تكتبه في البحث، دلوقتي بتتحسب بس لو invoices أو activeTab اتغيروا
  const tabInvoices = useMemo(
    () => activeTab ? invoices.filter(inv => invoiceBranchKey(inv) === activeTab) : invoices,
    [invoices, activeTab, warehouseBranchMap]
  )
  const monthInvoices = useMemo(
    () => tabInvoices.filter(i => i.created_at?.startsWith(thisMonth)),
    [tabInvoices, thisMonth]
  )
  const monthTotal = useMemo(() => monthInvoices.reduce((s, i) => s + (i.total_amount || 0), 0), [monthInvoices])
  const totalAll = useMemo(() => tabInvoices.reduce((s, i) => s + (i.total_amount || 0), 0), [tabInvoices])

  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20

  // ✅ useMemo: ده كان بيتكرر مع كل حرف تكتبه في مربع البحث - دلوقتي بيتحسب بس لو الفلاتر أو البيانات اتغيرت فعليًا
  const filtered = useMemo(() => tabInvoices.filter(inv => {
    const matchSearch = !search || inv.invoice_number?.includes(search) || inv.warehouse_suppliers?.name?.includes(search)
    const matchSupplier = !filterSupplier || inv.warehouse_suppliers?.name === filterSupplier
    const matchMonth = !filterMonth || inv.invoice_date?.startsWith(filterMonth)
    // ✅ جديد: تطابق يوم واحد بالظبط (مش شهر كامل)
    const matchDate = !filterDate || inv.invoice_date === filterDate
    return matchSearch && matchSupplier && matchMonth && matchDate
  }), [tabInvoices, search, filterSupplier, filterMonth, filterDate])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginatedInvoices = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const invoiceSuppliers = useMemo(
    () => [...new Set(tabInvoices.map(i => i.warehouse_suppliers?.name).filter(Boolean))],
    [tabInvoices]
  )

  // ✅ useMemo: تقرير المقارنة بين الفروع كان بيتحسب بالكامل مع كل render حتى لو التقرير مقفول - دلوقتي بس لو invoices/allTabs اتغيروا
  const comparisonReport = useMemo(() => allTabs.map(t => {
    const tabInvs = invoices.filter(inv => invoiceBranchKey(inv) === t.key)
    return {
      key: t.key, label: t.label,
      count: tabInvs.length,
      total: tabInvs.reduce((s, i) => s + (i.total_amount || 0), 0),
      monthTotal: tabInvs.filter(i => i.created_at?.startsWith(thisMonth)).reduce((s, i) => s + (i.total_amount || 0), 0),
    }
  }), [allTabs, invoices, thisMonth, warehouseBranchMap])
  const grandTotal = useMemo(() => comparisonReport.reduce((s, r) => s + r.total, 0), [comparisonReport])

  // ✅ جديد: طباعة قائمة المشتريات المعروضة حاليًا (يوم واحد عادةً بعد استخدام فلتر التاريخ) - كشف مطبوع
  // بكل فواتير اليوم مع الإجمالي، بدل ما يضطر المستخدم يجمعها يدويًا من الشاشة
  function printDailyPurchases() {
    if (filtered.length === 0) { alert('لا توجد فواتير مطابقة للطباعة'); return }
    const win = window.open('', '_blank')
    if (!win) return
    const total = filtered.reduce((s, i) => s + (i.total_amount || 0), 0)
    const dateLabel = filterDate || 'كل الفترات'
    const rows = filtered.map((inv, i) => `
      <tr>
        <td>${filtered.length - i}</td>
        <td>${inv.invoice_number || '—'}</td>
        <td>${inv.warehouse_suppliers?.name || '—'}</td>
        <td>${inv.invoice_date}</td>
        <td>${(inv as any).employees?.name || '—'}</td>
        <td>${formatMYR(inv.total_amount)}</td>
      </tr>`).join('')

    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>تقرير المشتريات — ${dateLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; direction: rtl; }
      h2 { color: #C9A84C; margin-bottom: 4px; }
      h3 { color: #555; font-weight: 400; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #0A1628; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; }
      td { padding: 7px 8px; border: 1px solid #ddd; text-align: center; }
      tr:nth-child(even) { background: #f9f9f9; }
      .total-box { background: #fff8e1; border: 1px solid #C9A84C; border-radius: 8px; padding: 14px 18px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 16px; }
      @media print { @page { size: A4; margin: 10mm; } }
    </style></head><body>
    <h2>🌸 Orchid House — تقرير المشتريات اليومية</h2>
    <h3>${dateLabel} · ${filtered.length} فاتورة</h3>
    <table>
      <thead><tr><th>#</th><th>رقم الفاتورة</th><th>المورد</th><th>التاريخ</th><th>بواسطة</th><th>الإجمالي</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total-box"><span>💰 إجمالي المشتريات</span><span>${formatMYR(total)}</span></div>
    <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#666">
      <div>تم الطباعة بواسطة: _______________</div>
      <div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🛒 المشتريات</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة فواتير المشتريات ومسح ذكي بالذكاء الاصطناعي</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canSeeAllBranches && (
            <button onClick={() => setShowReport(true)} style={{ padding: '11px 18px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 تقرير مقارن
            </button>
          )}
          <button onClick={() => setShowNew(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            ✨ فاتورة جديدة
          </button>
        </div>
      </div>

      {/* Branch Tabs */}
      {visibleTabs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* تاب "الإجمالي" يظهر لـ admin وأمين المستودع، لرؤية كل الفروع مجتمعة */}
          {canSeeAllBranches && (
            <button onClick={() => { setActiveTab(''); setCurrentPage(1) }}
              style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${activeTab === '' ? S.gold : S.border}`, background: activeTab === '' ? S.gold3 : 'transparent', color: activeTab === '' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab === '' ? 700 : 400 }}>
              🌐 الإجمالي (الكل)
            </button>
          )}
          {visibleTabs.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setCurrentPage(1) }}
              style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${activeTab === t.key ? S.gold : S.border}`, background: activeTab === t.key ? S.gold3 : 'transparent', color: activeTab === t.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab === t.key ? 700 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'إجمالي الفواتير', value: tabInvoices.length, icon: '🧾', color: S.blue, bg: S.blueB },
          { label: 'مشتريات هذا الشهر', value: monthInvoices.length, icon: '📅', color: S.green, bg: S.greenB },
          { label: 'إجمالي هذا الشهر', value: formatMYR(monthTotal), icon: '💰', color: S.gold, bg: S.gold3 },
          ...(employee?.role === 'admin' ? [{ label: 'إجمالي كل الفواتير', value: formatMYR(totalAll), icon: '📊', color: S.purple, bg: S.purpleB }] : []),
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
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} placeholder="🔍 بحث برقم الفاتورة أو المورد..." />
        <select style={{ ...inp, width: 'auto', minWidth: 160 }} value={filterSupplier} onChange={e => { setFilterSupplier(e.target.value); setCurrentPage(1) }}>
          <option value="">كل الموردين</option>
          {invoiceSuppliers.map(s => <option key={s} value={s!}>{s}</option>)}
        </select>
        <input style={{ ...inp, width: 'auto' }} type="month" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1) }} />
        {/* ✅ جديد: فلتر يوم محدد - لعرض مشتريات يوم واحد بالظبط وطباعتها */}
        <input style={{ ...inp, width: 'auto' }} type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setCurrentPage(1) }} />
        <button onClick={() => { setFilterDate(new Date().toISOString().split('T')[0]); setCurrentPage(1) }}
          style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          📅 اليوم
        </button>
        <button onClick={printDailyPurchases}
          style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          🖨️ طباعة
        </button>
        {(search || filterSupplier || filterMonth || filterDate) && (
          <button onClick={() => { setSearch(''); setFilterSupplier(''); setFilterMonth(''); setFilterDate(''); setCurrentPage(1) }} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>✕ مسح</button>
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
                  {['# النظام', 'رقم المورد', 'المورد', 'التاريخ', 'الإجمالي', 'بواسطة', 'صورة', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 60, color: S.muted }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
                    {fetchError ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: S.red, marginBottom: 6 }}>⚠️ فشل تحميل الفواتير</div>
                        <div style={{ fontSize: 12, color: S.muted, direction: 'ltr' }}>{fetchError}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد فواتير بعد</div>
                        <div style={{ fontSize: 13 }}>اضغط "فاتورة جديدة" لإضافة أول فاتورة</div>
                      </>
                    )}
                  </td></tr>
                ) : paginatedInvoices.map((inv, idx) => (
                  <tr key={inv.id} className="inv-row" style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => setSelectedInvoice(inv)}>
                    <td style={{ padding: '14px 16px', color: S.purple, fontWeight: 800, fontSize: 14 }}>#{filtered.length - idx}</td>
                    <td style={{ padding: '14px 16px', color: S.gold, fontWeight: 700, fontSize: 13 }}>{inv.invoice_number || <span style={{ color: S.muted, fontStyle: 'italic', fontSize: 11 }}>—</span>}</td>
                    <td style={{ padding: '14px 16px', color: S.white, fontSize: 13, fontWeight: 600 }}>{inv.warehouse_suppliers?.name || <span style={{ color: S.muted }}>—</span>}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: S.muted }}>{inv.invoice_date}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: S.green, fontSize: 13 }}>{formatMYR(inv.total_amount)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: S.blue }}>{(inv as any).employees?.name || <span style={{ color: S.muted }}>—</span>}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const { data } = await supabase.from('purchase_invoices').select('image_url').eq('id', inv.id).maybeSingle()
                          if (data?.image_url) setViewerImage(data.image_url)
                          else alert('لا توجد صورة لهذه الفاتورة')
                        }}
                        style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, color: S.blue, cursor: 'pointer', fontSize: 16, padding: '4px 8px' }}
                        title="عرض صورة الفاتورة"
                      >🖼️</button>
                    </td>
                    <td style={{ padding: '14px 16px', color: S.muted, fontSize: 18 }}>←</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'16px 0', borderTop:`1px solid ${S.border}` }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${S.border}`, background:'transparent', color: currentPage === 1 ? S.muted : S.white, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize:13 }}>
                ← السابق
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  style={{ width:34, height:34, borderRadius:8, border:`1px solid ${p === currentPage ? S.gold : S.border}`, background: p === currentPage ? S.gold3 : 'transparent', color: p === currentPage ? S.gold : S.muted, cursor:'pointer', fontSize:13, fontWeight: p === currentPage ? 800 : 400 }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${S.border}`, background:'transparent', color: currentPage === totalPages ? S.muted : S.white, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize:13 }}>
                التالي →
              </button>
              <span style={{ fontSize:12, color:S.muted, marginRight:8 }}>
                {filtered.length} فاتورة — صفحة {currentPage} من {totalPages}
              </span>
            </div>
          )}
        </div>
      )}

      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice} products={products} suppliers={suppliers} units={units} warehouses={warehouses}
          unitConversions={unitConversions}
          currentEmployeeId={employee?.id} currentEmployeeName={employee?.name}
          onClose={() => setSelectedInvoice(null)}
          onViewImage={(url) => setViewerImage(url)}
          onDeleted={() => { setSelectedInvoice(null); fetchAll() }}
          onSaved={() => { setSelectedInvoice(null); fetchAll() }}
        />
      )}

      {viewerImage && <ImageViewerModal imageUrl={viewerImage} onClose={() => setViewerImage(null)} />}

      {showNew && (
        <NewInvoiceModal
          products={products} suppliers={suppliers} units={units}
          warehouses={canSeeAllBranches ? warehouses : warehouses.filter(w => (w.branch_id || 'main') === (myBranchId || 'main'))}
          employeeId={employee?.id}
          unitConversions={unitConversions}
          onConversionAdded={(conv) => setUnitConversions(prev => [...prev, conv])}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); fetchAll() }}
        />
      )}

      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 640, padding: 28, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>📊 تقرير مقارن — كل الفروع</h2>
              <button onClick={() => setShowReport(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: S.navy3, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: S.card2 }}>
                    {['الفرع/المستودع', 'عدد الفواتير', 'إجمالي هذا الشهر', 'الإجمالي الكلي'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonReport.map(r => (
                    <tr key={r.key} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.white, fontWeight: 700 }}>{r.label}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.blue }}>{r.count}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.green }}>{formatMYR(r.monthTotal)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 700 }}>{formatMYR(r.total)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: S.gold3 }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>🌐 الإجمالي الكلي</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{invoices.length}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{formatMYR(comparisonReport.reduce((s,r)=>s+r.monthTotal,0))}</td>
                    <td style={{ padding: '12px 14px', fontSize: 14, color: S.gold, fontWeight: 800 }}>{formatMYR(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button onClick={() => setShowReport(false)} style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
          </div>
        </div>
      )}
    </div> 
  )
}   
 