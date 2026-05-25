'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { formatMYR } from '../../../../lib/supabase'


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
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const DEFAULT_CATEGORIES = [
  'البار', 'المطبخ', 'خضار', 'فواكة', 'المنظفات',
  'البلاستيك', 'لحوم', 'حلويات', 'توابل وبهارات',
  'ألبان وأجبان', 'حبوب ومعكرونة', 'زيوت وسمنة',
]

const CATEGORY_ICONS: Record<string, string> = {
  'البار': '🍹', 'المطبخ': '👨‍🍳', 'خضار': '🥦', 'فواكة': '🍎',
  'المنظفات': '🧹', 'البلاستيك': '📦', 'لحوم': '🥩', 'حلويات': '🍰',
  'توابل وبهارات': '🌶️', 'ألبان وأجبان': '🧀', 'حبوب ومعكرونة': '🌾', 'زيوت وسمنة': '🫙',
}

const PAGE_SIZE = 20

type Tab = 'overview' | 'in' | 'out' | 'daily' | 'monthly'

interface Warehouse { id: string; name: string; description: string; location: string; is_main: boolean }
interface Unit { id: string; name: string; symbol: string }
interface Product {
  id: string; name: string; name_en?: string; category: string
  current_stock: number; min_stock: number; last_purchase_price: number
  unit_id: string; units?: Unit; is_active: boolean
}
interface Movement { id: string; created_at: string; movement_type: string; quantity: number; unit_price: number; destination: string; destination_custom: string; notes: string; movement_date: string; warehouse_products?: { name: string; units?: Unit }; warehouses?: { name: string } }
interface Invoice { id: string; invoice_number: string; invoice_date: string; total_amount: number; status: string; notes: string; image_url: string; warehouse_suppliers?: { name: string }; warehouses?: { name: string } }

// ══ Modal إضافة صنف ══
function AddProductModal({ units, categories, onClose, onSaved }: {
  units: Unit[]; categories: string[]; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', name_en: '', category: '', unit_id: '', min_stock: '', current_stock: '0' })

  async function save() {
    if (!form.name || !form.unit_id) { alert('يرجى إدخال الاسم والوحدة'); return }
    setSaving(true)
    const { error } = await supabase.from('warehouse_products').insert([{
      name: form.name, name_en: form.name_en, category: form.category,
      unit_id: form.unit_id, min_stock: parseFloat(form.min_stock) || 0,
      current_stock: parseFloat(form.current_stock) || 0, is_active: true,
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 500, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>➕ إضافة صنف جديد</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>اسم الصنف (عربي) *</label>
              <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: لحم بقري" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Product Name (English)</label>
              <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Beef" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الفئة</label>
            <select style={{ ...inp }} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="">اختر الفئة</option>
              {categories.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] || '📦'} {c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>وحدة القياس *</label>
            <select style={{ ...inp }} value={form.unit_id} onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))}>
              <option value="">اختر الوحدة</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الحد الأدنى للتنبيه</label>
              <input style={inp} type="number" value={form.min_stock} onChange={e => setForm(p => ({ ...p, min_stock: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الكمية الحالية</label>
              <input style={inp} type="number" value={form.current_stock} onChange={e => setForm(p => ({ ...p, current_stock: e.target.value }))} placeholder="0" />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الحفظ...' : '💾 حفظ الصنف'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Modal إضافة قسم ══
function AddCategoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: (cat: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 380, padding: 28 }}>
        <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700, marginBottom: 18 }}>➕ إضافة قسم جديد</h3>
        <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="اسم القسم الجديد..." autoFocus />
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={() => { if (name.trim()) { onSaved(name.trim()); onClose() } }} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>💾 إضافة</button>
        </div>
      </div>
    </div>
  )
}

// ══ Modal دخول بضاعة ══
function StockInModal({ warehouseId, warehouseName, products, units, onClose, onSaved }: {
  warehouseId: string; warehouseName: string; products: Product[]; units: Unit[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null)
  const [items, setItems] = useState([{ product_id: '', quantity: '', unit_price: '', unit_id: '' }])
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', invoice_date: new Date().toISOString().split('T')[0], notes: '' })

  useEffect(() => { supabase.from('warehouse_suppliers').select('id,name').then(({ data }) => setSuppliers(data || [])) }, [])

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader(); reader.onload = () => setInvoiceImage(reader.result as string); reader.readAsDataURL(file)
  }

  async function save() {
    if (items.some(i => !i.product_id || !i.quantity || !i.unit_price)) { alert('يرجى إكمال بيانات الأصناف'); return }
    setSaving(true)
    try {
      const total = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0)
      const { data: inv, error: invErr } = await supabase.from('purchase_invoices').insert([{
        ...form, warehouse_id: warehouseId, total_amount: total,
        image_url: invoiceImage || null, status: 'confirmed',
      }]).select().single()
      if (invErr) throw invErr
      for (const item of items) {
        await supabase.from('purchase_invoice_items').insert([{
          invoice_id: inv.id, product_id: item.product_id,
          quantity: parseFloat(item.quantity), unit_price: parseFloat(item.unit_price),
          unit_id: item.unit_id || null,
        }])
        await supabase.from('stock_movements').insert([{
          movement_type: 'in', product_id: item.product_id, warehouse_id: warehouseId,
          quantity: parseFloat(item.quantity), unit_price: parseFloat(item.unit_price),
          invoice_id: inv.id, movement_date: form.invoice_date,
        }])
      }
      onSaved()
    } catch (e: unknown) { alert('خطأ: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setSaving(false) }
  }

  const total = items.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 700, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: S.green, fontSize: 16, fontWeight: 700 }}>📥 دخول بضاعة — {warehouseName}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المورد</label>
            <select style={{ ...inp }} value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}>
              <option value="">اختر المورد</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>رقم الفاتورة</label>
            <input style={inp} value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="INV-001" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>تاريخ الفاتورة</label>
            <input style={inp} type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginBottom: 16, padding: 14, border: `2px dashed ${S.border}`, borderRadius: 12, textAlign: 'center' }}>
          {invoiceImage ? (
            <div>
              <img src={invoiceImage} alt="فاتورة" style={{ maxHeight: 120, borderRadius: 8, marginBottom: 8 }} />
              <button onClick={() => setInvoiceImage(null)} style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', padding: '5px 12px', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>🗑️ حذف الصورة</button>
            </div>
          ) : (
            <label style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
              <div style={{ fontSize: 12, color: S.muted }}>اضغط لرفع صورة الفاتورة</div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
            </label>
          )}
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ fontSize: 13, color: S.gold, fontWeight: 700 }}>أصناف الفاتورة</label>
            <button onClick={() => setItems(p => [...p, { product_id: '', quantity: '', unit_price: '', unit_id: '' }])} style={{ background: S.greenB, border: `1px solid ${S.green}`, borderRadius: 8, color: S.green, cursor: 'pointer', padding: '5px 12px', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>+ إضافة صنف</button>
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <select style={{ ...inp }} value={item.product_id} onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, product_id: e.target.value } : it))}>
                <option value="">اختر الصنف</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input style={inp} type="number" placeholder="الكمية" value={item.quantity} onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))} />
              <input style={inp} type="number" placeholder="سعر الوحدة" value={item.unit_price} onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, unit_price: e.target.value } : it))} />
              <select style={{ ...inp }} value={item.unit_id} onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, unit_id: e.target.value } : it))}>
                <option value="">الوحدة</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
              </select>
              {items.length > 1 && <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', padding: '8px 10px' }}>✕</button>}
            </div>
          ))}
        </div>
        <div style={{ background: S.card, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: S.muted, fontSize: 13 }}>إجمالي الفاتورة</span>
          <span style={{ color: S.gold, fontSize: 20, fontWeight: 700 }}>{total.toFixed(2)} MYR</span>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الحفظ...' : '✅ تأكيد الفاتورة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Modal خروج بضاعة ══
function StockOutModal({ warehouseId, warehouseName, products, onClose, onSaved }: {
  warehouseId: string; warehouseName: string; products: Product[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const destinations = ['المطبخ الرئيسي', 'الصالة', 'البار', 'قسم الحلويات', 'مستودع آخر', 'طرف آخر']
  const [form, setForm] = useState({ product_id: '', quantity: '', destination: '', destination_custom: '', movement_date: new Date().toISOString().split('T')[0], notes: '' })
  const selectedProduct = products.find(p => p.id === form.product_id)

  async function save() {
    if (!form.product_id || !form.quantity || !form.destination) { alert('يرجى إكمال الحقول المطلوبة'); return }
    if (selectedProduct && parseFloat(form.quantity) > selectedProduct.current_stock) { alert('الكمية أكبر من المخزون المتاح!'); return }
    setSaving(true)
    const { error } = await supabase.from('stock_movements').insert([{
      movement_type: 'out', product_id: form.product_id, warehouse_id: warehouseId,
      quantity: parseFloat(form.quantity), destination: form.destination,
      destination_custom: (form.destination === 'طرف آخر' || form.destination === 'مستودع آخر') ? form.destination_custom : null,
      movement_date: form.movement_date, notes: form.notes,
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 500, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: S.red, fontSize: 16, fontWeight: 700 }}>📤 خروج بضاعة — {warehouseName}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الصنف *</label>
            <select style={{ ...inp }} value={form.product_id} onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))}>
              <option value="">اختر الصنف</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (متاح: {p.current_stock} {p.units?.symbol})</option>)}
            </select>
          </div>
          {selectedProduct && (
            <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: S.muted }}>المخزون المتاح</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: selectedProduct.current_stock <= selectedProduct.min_stock ? S.red : S.green }}>
                {selectedProduct.current_stock} {selectedProduct.units?.symbol}
              </span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الكمية *</label>
              <input style={inp} type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التاريخ</label>
              <input style={inp} type="date" value={form.movement_date} onChange={e => setForm(p => ({ ...p, movement_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الوجهة *</label>
            <select style={{ ...inp }} value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}>
              <option value="">اختر الوجهة</option>
              {destinations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {(form.destination === 'طرف آخر' || form.destination === 'مستودع آخر') && (
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التفاصيل</label>
              <input style={inp} value={form.destination_custom} onChange={e => setForm(p => ({ ...p, destination_custom: e.target.value }))} placeholder="اذكر الجهة أو المستودع..." />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '📤 تأكيد الخروج'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
// ══ Unit Conversion Modal ══
function UnitConversionModal({ product, units, onClose }: { product: any; units: any[]; onClose: () => void }) {
  const supabase = createClient()
  const [conversions, setConversions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ from_unit_id: '', to_unit_id: '', factor: '', notes: '' })

  const S2 = {
    navy2: '#0F2040', navy3: '#0C1A32', gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
    white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
    green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
    red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
    blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
    purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
    card: 'rgba(255,255,255,0.04)',
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '9px 12px', fontSize: 13,
    color: S2.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
    boxSizing: 'border-box', direction: 'rtl',
  }

  async function fetchConversions() {
    const { data } = await supabase.from('unit_conversions')
      .select('*, from_unit:units!unit_conversions_from_unit_id_fkey(name,symbol), to_unit:units!unit_conversions_to_unit_id_fkey(name,symbol)')
      .eq('product_id', product.id)
      .order('created_at')
    setConversions(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchConversions() }, [product.id])

  async function addConversion() {
    if (!form.from_unit_id || !form.to_unit_id || !form.factor) {
      alert('يرجى إكمال جميع الحقول'); return
    }
    if (form.from_unit_id === form.to_unit_id) {
      alert('الوحدتان يجب أن تكونا مختلفتان'); return
    }
    setSaving(true)
    await supabase.from('unit_conversions').insert([{
      product_id: product.id,
      from_unit_id: form.from_unit_id,
      to_unit_id: form.to_unit_id,
      factor: parseFloat(form.factor),
      notes: form.notes || null,
    }])
    setForm({ from_unit_id: '', to_unit_id: '', factor: '', notes: '' })
    await fetchConversions()
    setSaving(false)
  }

  async function deleteConversion(id: string) {
    await supabase.from('unit_conversions').delete().eq('id', id)
    fetchConversions()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: S2.navy2, borderRadius: 18, border: `1px solid ${S2.border}`, width: '100%', maxWidth: 520, padding: '24px 20px', margin: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: S2.purple, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>⚖️ تحويلات الوحدات</h3>
            <div style={{ fontSize: 13, fontWeight: 600, color: S2.white }}>{product.name}</div>
            <div style={{ fontSize: 11, color: S2.muted }}>وحدة المخزون الأساسية: <strong style={{ color: S2.gold }}>{product.units?.name || '—'} ({product.units?.symbol})</strong></div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S2.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Explanation */}
        <div style={{ background: S2.purpleB, border: `1px solid #8B5CF640`, borderRadius: 12, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: S2.muted, lineHeight: 1.7 }}>
          💡 مثال: إذا المخزون بالكيس — تقدر تضيف: <strong style={{ color: S2.white }}>1 كرتون = 24 كيس</strong><br/>
          هيساعدك تسجّل دخول كرتون والنظام يحسب الكيسات تلقائياً.
        </div>

        {/* Add Form */}
        <div style={{ background: S2.card, borderRadius: 12, padding: '14px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: S2.white, marginBottom: 12 }}>➕ إضافة تحويل جديد</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>من وحدة</label>
              <select style={inp} value={form.from_unit_id} onChange={e => setForm(p => ({ ...p, from_unit_id: e.target.value }))}>
                <option value="">اختر</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
              </select>
            </div>
            <div style={{ textAlign: 'center', color: S2.muted, fontSize: 18, paddingTop: 20 }}>=</div>
            <div>
              <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>إلى وحدة</label>
              <select style={inp} value={form.to_unit_id} onChange={e => setForm(p => ({ ...p, to_unit_id: e.target.value }))}>
                <option value="">اختر</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>المعامل (العدد)</label>
              <input style={inp} type="number" min="0.001" step="0.001" placeholder="مثال: 24" value={form.factor} onChange={e => setForm(p => ({ ...p, factor: e.target.value }))} />
              {form.from_unit_id && form.to_unit_id && form.factor && (
                <div style={{ fontSize: 10, color: S2.gold, marginTop: 4 }}>
                  1 {units.find(u => u.id === form.from_unit_id)?.name} = {form.factor} {units.find(u => u.id === form.to_unit_id)?.name}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, color: S2.muted, display: 'block', marginBottom: 4 }}>ملاحظة (اختياري)</label>
              <input style={inp} placeholder="مثال: كرتون مياه" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <button onClick={addConversion} disabled={saving}
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S2.purple}`, background: S2.purpleB, color: S2.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '💾 حفظ التحويل'}
          </button>
        </div>

        {/* Existing Conversions */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: S2.white, marginBottom: 10 }}>📋 التحويلات المسجلة</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: S2.muted }}>⏳</div>
          ) : conversions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: S2.muted, fontSize: 12, background: S2.card, borderRadius: 10 }}>
              لا توجد تحويلات — أضف أول تحويل أعلاه
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conversions.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: S2.card, borderRadius: 10, padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S2.white }}>
                      1 {c.from_unit?.name} = <span style={{ color: S2.gold }}>{c.factor}</span> {c.to_unit?.name}
                    </div>
                    {c.notes && <div style={{ fontSize: 11, color: S2.muted }}>{c.notes}</div>}
                  </div>
                  <button onClick={() => deleteConversion(c.id)}
                    style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${S2.red}`, background: S2.redB, color: S2.red, cursor: 'pointer', fontSize: 12 }}>
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={onClose}
          style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 10, border: `1px solid ${S2.border}`, background: 'transparent', color: S2.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          إغلاق
        </button>
      </div>
    </div>
  )
}

export default function WarehouseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const warehouseId = params.id as string
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('overview')
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'empty'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showStockIn, setShowStockIn] = useState(false)
  const [showStockOut, setShowStockOut] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showUnitConversion, setShowUnitConversion] = useState<Product | null>(null)
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7))

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [wh, pr, un, mv, inv] = await Promise.all([
      supabase.from('warehouses').select('*').eq('id', warehouseId).single(),
      supabase.from('warehouse_products').select('*, units(id,name,symbol)').order('name'),
      supabase.from('units').select('*').order('name'),
      supabase.from('stock_movements').select('*, warehouse_products(name, units(symbol)), warehouses(name)').eq('warehouse_id', warehouseId).order('created_at', { ascending: false }).limit(100),
      supabase.from('purchase_invoices').select('*, warehouse_suppliers(name), warehouses(name)').eq('warehouse_id', warehouseId).order('created_at', { ascending: false }).limit(50),
    ])
    setWarehouse(wh.data)
    setProducts(pr.data || [])
    // Merge categories from DB with defaults
    const dbCats = [...new Set((pr.data || []).map((p: Product) => p.category).filter(Boolean))]
    const merged = [...new Set([...DEFAULT_CATEGORIES, ...dbCats])]
    const { data: catData } = await supabase
    .from('warehouse_categories')
    .select('name')
    .order('created_at')
    setCategories(catData?.map((c: {name: string}) => c.name) || DEFAULT_CATEGORIES)
    setUnits(un.data || [])
    setMovements(mv.data || [])
    setInvoices(inv.data || [])
    setLoading(false)
  }, [warehouseId])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleActive(product: Product) {
    await supabase.from('warehouse_products').update({ is_active: !product.is_active }).eq('id', product.id)
    fetchAll()
  }

  // Stats
  const lowStock = products.filter(p => p.current_stock <= p.min_stock && p.min_stock > 0)
  const today = new Date().toISOString().split('T')[0]
  const todayIn = movements.filter(m => m.movement_type === 'in' && m.movement_date === today)
  const todayOut = movements.filter(m => m.movement_type === 'out' && m.movement_date === today)

  // Category counts
  const catCounts = categories.reduce((acc, cat) => {
    acc[cat] = products.filter(p => p.category === cat).length
    return acc
  }, {} as Record<string, number>)

  // Filtering
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.name_en || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? p.is_active !== false : p.is_active === false)
    const matchStock = stockFilter === 'all' ||
      (stockFilter === 'low' && p.current_stock <= p.min_stock && p.min_stock > 0 && p.current_stock > 0) ||
      (stockFilter === 'empty' && p.current_stock === 0)
    return matchSearch && matchCat && matchStatus && matchStock
  })

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE)
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const dailyMovements = movements.filter(m => m.movement_date === today)
  const monthlyMovements = movements.filter(m => m.movement_date?.startsWith(reportMonth))

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: '◉' },
    { id: 'in', label: 'دخول بضاعة', icon: '📥' },
    { id: 'out', label: 'خروج بضاعة', icon: '📤' },
    { id: 'daily', label: 'تقرير اليوم', icon: '📊' },
    { id: 'monthly', label: 'تقرير شهري', icon: '📈' },
  ]

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: S.gold, fontSize: 16 }}>⏳ جاري التحميل...</div>
  if (!warehouse) return <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>المستودع غير موجود</div>

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .prod-row:hover { background: rgba(255,255,255,0.04) !important; }
      `}</style>

      {/* ══ Header ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button onClick={() => router.push('/dashboard/warehouse')} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, cursor: 'pointer', padding: '5px 12px', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>← رجوع</button>
            {warehouse.is_main && <span style={{ background: S.gold3, border: `1px solid ${S.gold}`, color: S.gold, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>رئيسي</span>}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🏭 {warehouse.name}</h1>
          {warehouse.description && <p style={{ fontSize: 13, color: S.muted }}>{warehouse.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddProduct(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ صنف جديد</button>
          <button onClick={() => setShowStockIn(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📥 دخول بضاعة</button>
          <button onClick={() => setShowStockOut(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📤 خروج بضاعة</button>
        </div>
      </div>

      {/* ══ Stats ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'إجمالي الأصناف', value: products.length, icon: '📦', color: S.blue, bg: S.blueB },
          { label: 'مخزون منخفض', value: lowStock.length, icon: '⚠️', color: S.amber, bg: S.amberB },
          { label: 'دخل اليوم', value: todayIn.length + ' حركة', icon: '📥', color: S.green, bg: S.greenB },
          { label: 'خرج اليوم', value: todayOut.length + ' حركة', icon: '📤', color: S.red, bg: S.redB },
        ].map((stat, i) => (
          <div key={i} style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: S.muted }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ══ Tabs ══ */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: S.navy3, borderRadius: 14, padding: 6, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minWidth: 100, padding: '9px 14px', borderRadius: 10,
            border: tab === t.id ? `1px solid ${S.gold}` : '1px solid transparent',
            background: tab === t.id ? S.gold3 : 'transparent',
            color: tab === t.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13,
            fontFamily: 'Tajawal, sans-serif', fontWeight: tab === t.id ? 700 : 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .2s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: نظرة عامة ══ */}
      {tab === 'overview' && (
        <div>
          {/* ── Category Chips ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => { setSelectedCategory('all'); setCurrentPage(1) }}
              style={{
                padding: '7px 14px', borderRadius: 20, border: `1px solid ${selectedCategory === 'all' ? S.gold : S.border}`,
                background: selectedCategory === 'all' ? S.gold3 : 'transparent',
                color: selectedCategory === 'all' ? S.gold : S.muted,
                cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600,
              }}
            >
              الكل ({products.length})
            </button>
            {categories.map(cat => (
              <button key={cat}
                onClick={() => { setSelectedCategory(cat); setCurrentPage(1) }}
                style={{
                  padding: '7px 14px', borderRadius: 20,
                  border: `1px solid ${selectedCategory === cat ? S.blue : S.border}`,
                  background: selectedCategory === cat ? S.blueB : 'transparent',
                  color: selectedCategory === cat ? S.blue : S.muted,
                  cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {CATEGORY_ICONS[cat] || '📦'} {cat}
                <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 6px', fontSize: 11, color: S.white, fontWeight: 700 }}>
                  {catCounts[cat] || 0}
                </span>
              </button>
            ))}
            <button
              onClick={() => setShowAddCategory(true)}
              style={{ padding: '7px 14px', borderRadius: 20, border: `1px dashed ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}
            >
              ➕ قسم جديد
            </button>
          </div>

          {/* ── Advanced Search ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              style={{ ...inp, flex: 1, minWidth: 200 }}
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder="🔍 بحث بالاسم عربي أو إنجليزي..."
            />
            <select style={{ ...inp, width: 'auto', minWidth: 130 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value as 'all' | 'active' | 'inactive'); setCurrentPage(1) }}>
              <option value="all">كل الحالات</option>
              <option value="active">نشط فقط</option>
              <option value="inactive">موقف فقط</option>
            </select>
            <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={stockFilter} onChange={e => { setStockFilter(e.target.value as 'all' | 'low' | 'empty'); setCurrentPage(1) }}>
              <option value="all">كل المخزون</option>
              <option value="low">مخزون منخفض</option>
              <option value="empty">نفذ المخزون</option>
            </select>
          </div>

          {/* ── نتائج البحث ── */}
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 12 }}>
            يعرض {paginatedProducts.length} من {filteredProducts.length} صنف
            {selectedCategory !== 'all' && ` • قسم: ${selectedCategory}`}
            {search && ` • بحث: "${search}"`}
          </div>

          {/* ── Low Stock Alert ── */}
          {lowStock.length > 0 && selectedCategory === 'all' && (
            <div style={{ background: S.amberB, border: `1px solid ${S.amber}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10 }}>
              <span>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: 4 }}>مخزون منخفض</div>
                <div style={{ fontSize: 12, color: S.muted }}>{lowStock.map(p => p.name).join(' • ')}</div>
              </div>
            </div>
          )}

          {/* ── Products Table ── */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                <thead>
                  <tr style={{ background: S.navy3 }}>
                    {['الصنف (عربي / English)', 'الفئة', 'المخزون', 'الحد الأدنى', 'آخر سعر', 'الحالة', 'إجراء'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: S.muted }}>
                      {search ? `لا توجد نتائج لـ "${search}"` : 'لا توجد أصناف — اضغط "صنف جديد" للبدء'}
                    </td></tr>
                  ) : paginatedProducts.map(p => {
                    const isLow = p.current_stock <= p.min_stock && p.min_stock > 0 && p.current_stock > 0
                    const isEmpty = p.current_stock === 0
                    const isInactive = p.is_active === false
                    return (
                      <tr key={p.id} className="prod-row"
                        style={{ borderBottom: `1px solid ${S.border}`, opacity: isInactive ? 0.55 : 1, transition: 'background .15s' }}
                      >
                        {/* اسم المنتج */}
                        <td style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => setSelectedProduct(p)}>
                          <div style={{ fontWeight: 700, color: S.white, fontSize: 13, marginBottom: 3 }}>{p.name}</div>
                          {p.name_en && <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic' }}>{p.name_en}</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: S.card2, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: S.muted }}>
                            {CATEGORY_ICONS[p.category] || '📦'} {p.category || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: isEmpty ? S.red : isLow ? S.amber : S.green, fontSize: 14 }}>
                          {p.current_stock}
                          <span style={{ fontSize: 11, fontWeight: 400, color: S.muted, marginRight: 3 }}>{(p as any).units?.symbol}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: S.muted }}>{p.min_stock} {(p as any).units?.symbol}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: S.gold }}>{p.last_purchase_price ? p.last_purchase_price + ' MYR' : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: isEmpty ? S.redB : isLow ? S.amberB : isInactive ? 'rgba(255,255,255,0.06)' : S.greenB,
                            color: isEmpty ? S.red : isLow ? S.amber : isInactive ? S.muted : S.green,
                          }}>
                            {isInactive ? '⏸ موقف' : isEmpty ? '🔴 نفذ' : isLow ? '⚠️ منخفض' : '✅ كافي'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => toggleActive(p)}
                            style={{
                              padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                              fontFamily: 'Tajawal, sans-serif', fontWeight: 600, border: 'none',
                              background: isInactive ? S.greenB : S.redB,
                              color: isInactive ? S.green : S.red,
                            }}
                          >
                            {isInactive ? '▶ تفعيل' : '⏸ إيقاف'}
                          </button>
                          <button
                            onClick={() => setShowUnitConversion(p)}
                            style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 600, border: `1px solid #8B5CF6`, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', marginTop: 4 }}
                          >
                            ⚖️ تحويل
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: currentPage === 1 ? S.muted : S.white, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'Tajawal, sans-serif' }}
              >← السابق</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} style={{
                  padding: '7px 12px', borderRadius: 8,
                  border: `1px solid ${page === currentPage ? S.gold : S.border}`,
                  background: page === currentPage ? S.gold3 : 'transparent',
                  color: page === currentPage ? S.gold : S.muted,
                  cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: page === currentPage ? 700 : 400,
                }}>{page}</button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: currentPage === totalPages ? S.muted : S.white, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'Tajawal, sans-serif' }}
              >التالي →</button>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: دخول بضاعة ══ */}
      {tab === 'in' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: S.green }}>📥 سجل الفواتير</h2>
            <button onClick={() => setShowStockIn(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>+ فاتورة جديدة</button>
          </div>
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ background: S.navy3 }}>
                    {['رقم الفاتورة', 'التاريخ', 'المورد', 'الإجمالي', 'صورة'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد فواتير بعد</td></tr>
                    : invoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '12px 16px', color: S.gold, fontWeight: 700 }}>{inv.invoice_number || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{inv.invoice_date}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: S.white }}>{inv.warehouse_suppliers?.name || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: S.green }}>{formatMYR(inv.total_amount)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {inv.image_url
                            ? <img src={inv.image_url} alt="فاتورة" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }} onClick={() => window.open(inv.image_url, '_blank')} />
                            : <span style={{ color: S.muted, fontSize: 11 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: خروج بضاعة ══ */}
      {tab === 'out' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: S.red }}>📤 سجل خروج البضاعة</h2>
            <button onClick={() => setShowStockOut(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>+ خروج جديد</button>
          </div>
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ background: S.navy3 }}>
                    {['التاريخ', 'الصنف', 'الكمية', 'الوجهة', 'ملاحظات'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.filter(m => m.movement_type === 'out').length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد حركات خروج</td></tr>
                    : movements.filter(m => m.movement_type === 'out').map(m => (
                      <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{m.movement_date}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: S.white }}>{m.warehouse_products?.name}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: S.red }}>-{m.quantity} {m.warehouse_products?.units?.symbol}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: S.blueB, color: S.blue, borderRadius: 20, padding: '3px 10px', fontSize: 11 }}>
                            {m.destination_custom || m.destination}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{m.notes || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: تقرير اليوم ══ */}
      {tab === 'daily' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: S.white }}>
            📊 تقرير يوم {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: S.greenB, border: `1px solid ${S.green}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 12, color: S.green, marginBottom: 8, fontWeight: 700 }}>📥 دخول اليوم</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: S.green }}>{todayIn.length}</div>
              <div style={{ fontSize: 11, color: S.muted }}>حركة</div>
            </div>
            <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 12, color: S.red, marginBottom: 8, fontWeight: 700 }}>📤 خروج اليوم</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: S.red }}>{todayOut.length}</div>
              <div style={{ fontSize: 11, color: S.muted }}>حركة</div>
            </div>
          </div>
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 450 }}>
                <thead>
                  <tr style={{ background: S.navy3 }}>
                    {['النوع', 'الصنف', 'الكمية', 'الوجهة', 'الوقت'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyMovements.length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد حركات اليوم</td></tr>
                    : dailyMovements.map(m => (
                      <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ background: m.movement_type === 'in' ? S.greenB : S.redB, color: m.movement_type === 'in' ? S.green : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                            {m.movement_type === 'in' ? '📥 دخول' : '📤 خروج'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: S.white }}>{m.warehouse_products?.name}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: m.movement_type === 'in' ? S.green : S.red }}>
                          {m.movement_type === 'in' ? '+' : '-'}{m.quantity}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: S.muted }}>{m.destination || '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: S.muted }}>
                          {new Date(m.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: تقرير شهري ══ */}
      {tab === 'monthly' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: S.white }}>📈 التقرير الشهري</h2>
            <input style={{ ...inp, width: 'auto' }} type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'حركات الدخول', value: monthlyMovements.filter(m => m.movement_type === 'in').length, color: S.green, bg: S.greenB },
              { label: 'حركات الخروج', value: monthlyMovements.filter(m => m.movement_type === 'out').length, color: S.red, bg: S.redB },
              { label: 'إجمالي الحركات', value: monthlyMovements.length, color: S.gold, bg: S.gold3 },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: S.muted }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ background: S.navy3 }}>
                    {['التاريخ', 'النوع', 'الصنف', 'الكمية', 'الوجهة'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyMovements.length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد حركات في هذا الشهر</td></tr>
                    : monthlyMovements.map(m => (
                      <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: S.muted }}>{m.movement_date}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ background: m.movement_type === 'in' ? S.greenB : S.redB, color: m.movement_type === 'in' ? S.green : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                            {m.movement_type === 'in' ? 'دخول' : 'خروج'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: S.white }}>{m.warehouse_products?.name}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: m.movement_type === 'in' ? S.green : S.red }}>
                          {m.movement_type === 'in' ? '+' : '-'}{m.quantity} {m.warehouse_products?.units?.symbol}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: S.blue }}>{m.destination_custom || m.destination || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ Product Detail Modal ══ */}
      {selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ color: S.gold, fontSize: 18, fontWeight: 700 }}>{selectedProduct.name}</h3>
                {selectedProduct.name_en && <p style={{ fontSize: 13, color: S.muted, fontStyle: 'italic' }}>{selectedProduct.name_en}</p>}
              </div>
              <button onClick={() => setSelectedProduct(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'الفئة', value: selectedProduct.category || '—' },
                { label: 'المخزون الحالي', value: `${selectedProduct.current_stock} ${(selectedProduct as any).units?.symbol || ''}`, color: selectedProduct.current_stock <= selectedProduct.min_stock ? S.red : S.green },
                { label: 'الحد الأدنى', value: `${selectedProduct.min_stock} ${(selectedProduct as any).units?.symbol || ''}` },
                { label: 'آخر سعر شراء', value: selectedProduct.last_purchase_price ? `${selectedProduct.last_purchase_price} MYR` : 'لم يُحدد', color: S.gold },
                { label: 'الحالة', value: selectedProduct.is_active === false ? '⏸ موقف' : '✅ نشط', color: selectedProduct.is_active === false ? S.muted : S.green },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: S.card, borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: S.muted }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color || S.white }}>{row.value}</span>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 8 }}>آخر الحركات</div>
                {movements.filter(m => m.warehouse_products?.name === selectedProduct.name).slice(0, 5).map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', background: S.card, borderRadius: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: m.movement_type === 'in' ? S.green : S.red }}>{m.movement_type === 'in' ? '📥 +' : '📤 -'}{m.quantity}</span>
                    <span style={{ fontSize: 11, color: S.muted }}>{m.movement_date}</span>
                    <span style={{ fontSize: 11, color: S.blue }}>{m.destination || '—'}</span>
                  </div>
                ))}
                {movements.filter(m => m.warehouse_products?.name === selectedProduct.name).length === 0 &&
                  <div style={{ fontSize: 12, color: S.muted, textAlign: 'center', padding: 12 }}>لا توجد حركات سابقة</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => toggleActive(selectedProduct)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${selectedProduct.is_active === false ? S.green : S.amber}`, background: selectedProduct.is_active === false ? S.greenB : S.amberB, color: selectedProduct.is_active === false ? S.green : S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {selectedProduct.is_active === false ? '▶ تفعيل' : '⏸ إيقاف'}
              </button>
              <button onClick={() => { setSelectedProduct(null); setShowStockIn(true) }} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📥 دخول</button>
              <button onClick={() => { setSelectedProduct(null); setShowStockOut(true) }} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📤 خروج</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modals ══ */}
      {showAddProduct && (
        <AddProductModal
          units={units} categories={categories}
          onClose={() => setShowAddProduct(false)}
          onSaved={() => { setShowAddProduct(false); fetchAll() }}
        />
      )}
      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onSaved={async (cat) => {
          const sb = createClient()
          await sb.from('warehouse_categories').insert([{ name: cat }])
          setShowAddCategory(false)
         fetchAll()
      }}
        />
      )}
      {showStockIn && warehouse && (
        <StockInModal warehouseId={warehouseId} warehouseName={warehouse.name} products={products} units={units}
          onClose={() => setShowStockIn(false)} onSaved={() => { setShowStockIn(false); fetchAll() }} />
      )}
      {showStockOut && warehouse && (
        <StockOutModal warehouseId={warehouseId} warehouseName={warehouse.name} products={products}
          onClose={() => setShowStockOut(false)} onSaved={() => { setShowStockOut(false); fetchAll() }} />
      )}
      {showUnitConversion && (
        <UnitConversionModal
          product={showUnitConversion}
          units={units}
          onClose={() => setShowUnitConversion(null)}
        />
      )}
    </div>
  )
}
