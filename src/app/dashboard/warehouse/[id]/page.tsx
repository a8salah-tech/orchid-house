'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { formatMYR } from '../../../../lib/supabase'
import { useLang } from '../../../components/LanguageContext'
import { useAuth } from '../../../components/AuthProvider'


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

// ✅ Fix: تطبيع نص البحث العربي — يوحّد أشكال الحروف المختلفة (أ/إ/آ/ا، ة/ه، ى/ي) ويشيل التشكيل والمسافات الزائدة
// (نفس الدالة المستخدمة في صفحتي طلبات الفروع وطلبات المستودع الداخلي للحفاظ على سلوك بحث موحّد عبر النظام)
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

type Tab = 'overview' | 'in' | 'out' | 'transfer' | 'daily' | 'monthly'
type UnitConversion = { id: string; product_id: string; from_unit_id: string; to_unit_id: string; factor: number; notes: string; from_unit?: Unit; to_unit?: Unit }

interface Warehouse { id: string; name: string; description: string; location: string; is_main: boolean }
interface Unit { id: string; name: string; symbol: string }
interface Product {
  id: string; name: string; name_en?: string; category: string; product_code?: string
  current_stock: number; min_stock: number; last_purchase_price: number
  unit_id: string; units?: Unit; is_active: boolean
}
interface Movement { id: string; created_at: string; movement_type: string; quantity: number; unit_price: number; product_id?: string; destination: string; destination_custom: string; notes: string; movement_date: string; warehouse_products?: { name: string; units?: Unit }; warehouses?: { name: string } }
interface Invoice { id: string; invoice_number: string; invoice_date: string; total_amount: number; status: string; notes: string; image_url: string; warehouse_suppliers?: { name: string }; warehouses?: { name: string } }

// ══ Modal إضافة صنف ══
function AddProductModal({ units, categories, warehouseId, onClose, onSaved }: {
  units: Unit[]; categories: string[]; warehouseId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', name_en: '', category: '', unit_id: '', min_stock: '', current_stock: '0' })
  const [previewCode, setPreviewCode] = useState<string>('...')

  useEffect(() => {
    supabase.rpc('preview_next_product_code').then(({ data, error }) => {
      if (!error && data) setPreviewCode(data)
    })
  }, [])

  async function save() {
    if (!form.name || !form.unit_id) { alert('يرجى إدخال الاسم والوحدة'); return }
    setSaving(true)
    const { error } = await supabase.from('warehouse_products').insert([{
      name: form.name, name_en: form.name_en, category: form.category,
      unit_id: form.unit_id, min_stock: parseFloat(form.min_stock) || 0,
      current_stock: parseFloat(form.current_stock) || 0, is_active: true,
      warehouse_id: warehouseId,
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
          <div style={{ background: S.gold3, border: `1px solid ${S.gold}40`, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: S.muted }}>كود الصنف (تلقائي)</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: S.gold, fontFamily: 'system-ui', letterSpacing: 0.5 }}>{previewCode}</span>
          </div>
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
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inp }}
                    placeholder="🔍 ابحث عن الصنف..."
                    value={item.product_id ? products.find(p => p.id === item.product_id)?.name || '' : (item as any)._search || ''}
                    onChange={e => {
                      const val = e.target.value
                      setItems(p => p.map((it, idx) => idx === i ? { ...it, product_id: '', _search: val } as any : it))
                    }}
                  />
                  {!(item.product_id) && (item as any)._search && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                      {products
                        .filter(p => matchesSearch(p.name, (item as any)._search || '') || matchesSearch(p.name_en, (item as any)._search || ''))
                        .slice(0, 15)
                        .map(p => (
                          <div key={p.id}
                            onClick={() => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, product_id: p.id, _search: undefined } as any : it))}
                            style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: S.white, borderBottom: `1px solid ${S.border}` }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = S.card2}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          >
                            <div>{p.name}</div>
                            {p.name_en && <div style={{ fontSize: 10, color: S.muted }}>{p.name_en}</div>}
                          </div>
                        ))}
                      {products.filter(p => matchesSearch(p.name, (item as any)._search || '')).length === 0 && (
                        <div style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>لا توجد نتائج</div>
                      )}
                    </div>
                  )}
                </div>
                <input style={inp} type="number" placeholder="الكمية" value={item.quantity} onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))} />
                <input style={inp} type="number" placeholder="سعر الوحدة" value={item.unit_price} onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, unit_price: e.target.value } : it))} />
                <select style={{ ...inp }} value={item.unit_id} onChange={e => setItems(p => p.map((it, idx) => idx === i ? { ...it, unit_id: e.target.value } : it))}>
                  <option value="">الوحدة</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                </select>
                {items.length > 1 && <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', padding: '8px 10px' }}>✕</button>}
              </div>
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
function StockOutModal({ warehouseId, warehouseName, products, unitConversionsAll, onClose, onSaved }: {
  warehouseId: string; warehouseName: string; products: Product[]; unitConversionsAll?: any[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const destinations = ['المطبخ الرئيسي', 'الصالة', 'البار', 'قسم الحلويات', 'مستودع آخر', 'طرف آخر']
  const [form, setForm] = useState({ product_id: '', quantity: '', quantity_unit: 'big', destination: '', destination_custom: '', movement_date: new Date().toISOString().split('T')[0], notes: '' })
  const selectedProduct = products.find(p => p.id === form.product_id)

  // إيجاد تحويل الوحدة الخاص بالصنف (الوحدة الكبيرة ↔ الوحدة الصغيرة)
  function getConv(product: Product) {
    const convs = unitConversionsAll || []
    const directConv = convs.find((c: any) => c.product_id === product.id && c.from_unit_id === product.unit_id)
    const fallbackConv = convs.find((c: any) => c.product_id === product.id)
    return directConv || fallbackConv
  }

  // ✅ Fix: نفس إصلاح المخزون المنخفض الموحّد - مراعاة تحويل الوحدة بدل مقارنة خام بين وحدتين مختلفتين
  function isLowStock(product: Product) {
    if (!product.min_stock || product.min_stock <= 0 || product.current_stock <= 0) return false
    const conv = getConv(product)
    const minStockInBaseUnit = conv && conv.factor > 1 ? product.min_stock * conv.factor : product.min_stock
    return product.current_stock <= minStockInBaseUnit
  }

  // ✅ Fix: تنسيق رصيد الصنف بالوحدة الرئيسية والفرعية بدل عرض current_stock الخام
  // (كان بيظهر أرقام كبيرة جدًا زي 3.9465656565626 لما الرصيد متسجل بأرقام عشرية غير مقربة)
  function formatStock(product: Product) {
    const conv = getConv(product)
    // ✅ Fix: رصيد سالب بيبقى رقمًا واحدًا بالوحدة الأساسية
    if (product.current_stock < 0) {
      return { big: null, bigUnit: '', small: Math.round(product.current_stock * 100) / 100, smallUnit: product.units?.symbol || '' }
    }
    if (!conv || !conv.factor || conv.factor <= 1) {
      return { big: Math.round((product.current_stock || 0) * 100) / 100, bigUnit: product.units?.symbol || '', small: null as number | null, smallUnit: '' }
    }
    const factor = conv.factor
    let bigQty: number, smallQty: number
    if (conv.from_unit_id === product.unit_id) {
      bigQty = Math.floor(product.current_stock)
      smallQty = Math.round((product.current_stock - bigQty) * factor * 100) / 100
    } else {
      bigQty = Math.floor(product.current_stock / factor)
      smallQty = Math.round((product.current_stock % factor) * 100) / 100
    }
    return { big: bigQty, bigUnit: conv.from_unit?.symbol || product.units?.symbol || '', small: smallQty, smallUnit: conv.to_unit?.symbol || '' }
  }

  function stockLabel(product: Product) {
    const s = formatStock(product)
    return s.small !== null && s.small !== undefined ? `${s.big} ${s.bigUnit} و ${s.small} ${s.smallUnit}` : `${s.big} ${s.bigUnit}`
  }

  // خيارات الوحدة المتاحة لإدخال الكمية بها (كبيرة/صغيرة) — إن لم يوجد تحويل فوحدة واحدة فقط
  function unitChoices(product: Product) {
    const conv = getConv(product)
    if (!conv || !conv.factor || conv.factor <= 1) {
      return [{ value: 'big', label: product.units?.symbol || '' }]
    }
    return [
      { value: 'big', label: conv.from_unit?.symbol || product.units?.symbol || '' },
      { value: 'small', label: conv.to_unit?.symbol || '' },
    ]
  }

  // تحويل الكمية المُدخلة (بالوحدة التي اختارها المستخدم) إلى نفس وحدة current_stock الأساسية
  function toBaseQty(product: Product, qty: number, unitChoice: string) {
    const conv = getConv(product)
    if (!conv || !conv.factor || conv.factor <= 1) return qty
    const factor = conv.factor
    const storedInBig = conv.from_unit_id === product.unit_id
    if (unitChoice === 'small') return storedInBig ? qty / factor : qty
    return storedInBig ? qty : qty * factor
  }

  async function save() {
    if (!form.product_id || !form.quantity || !form.destination) { alert('يرجى إكمال الحقول المطلوبة'); return }
    const enteredQty = parseFloat(form.quantity)
    const baseQty = selectedProduct ? toBaseQty(selectedProduct, enteredQty, form.quantity_unit) : enteredQty
    if (selectedProduct && baseQty > selectedProduct.current_stock) { alert('الكمية أكبر من المخزون المتاح!'); return }
    setSaving(true)
    const { error } = await supabase.from('stock_movements').insert([{
      movement_type: 'out', product_id: form.product_id, warehouse_id: warehouseId,
      quantity: baseQty, destination: form.destination,
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
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الصنف *</label>
            <input
              style={{ ...inp }}
              placeholder="🔍 ابحث عن الصنف..."
              value={form.product_id ? (products.find(p => p.id === form.product_id)?.name || '') : productSearch}
              onChange={e => {
                setForm(p => ({ ...p, product_id: '' }))
                setProductSearch(e.target.value)
              }}
            />
            {!form.product_id && productSearch && (
              <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, zIndex: 50, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                {products
                  .filter(p => matchesSearch(p.name, productSearch) || matchesSearch(p.name_en, productSearch))
                  .slice(0, 20)
                  .map(p => (
                    <div key={p.id}
                      onClick={() => { setForm(prev => ({ ...prev, product_id: p.id, quantity_unit: 'big' })); setProductSearch('') }}
                      style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: S.white, borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = S.card2}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <span>{p.name}</span>
                      <span style={{ fontSize: 11, color: isLowStock(p) ? S.red : S.muted }}>متاح: {stockLabel(p)}</span>
                    </div>
                  ))}
                {products.filter(p => matchesSearch(p.name, productSearch) || matchesSearch(p.name_en, productSearch)).length === 0 && (
                  <div style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>لا توجد نتائج</div>
                )}
              </div>
            )}
          </div>
          {selectedProduct && (
            <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: S.muted }}>المخزون المتاح</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: isLowStock(selectedProduct) ? S.red : S.green }}>
                {stockLabel(selectedProduct)}
              </span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الكمية *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="0" />
                <select
                  style={{ ...inp, width: 92, flexShrink: 0 }}
                  value={form.quantity_unit}
                  onChange={e => setForm(p => ({ ...p, quantity_unit: e.target.value }))}
                  disabled={!selectedProduct}
                >
                  {selectedProduct ? unitChoices(selectedProduct).map(u => <option key={u.value} value={u.value}>{u.label}</option>) : <option value="big">الوحدة</option>}
                </select>
              </div>
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

// ══ Modal تحويل بين المستودعات ══
function TransferModal({ warehouseId, warehouseName, products, unitConversionsAll, onClose, onSaved }: {
  warehouseId: string; warehouseName: string; products: Product[]; unitConversionsAll?: any[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [form, setForm] = useState({ product_id: '', quantity: '', quantity_unit: 'big', target_warehouse_id: '', movement_date: new Date().toISOString().split('T')[0], notes: '' })
  const selectedProduct = products.find(p => p.id === form.product_id)
  const targetWarehouses = warehouses.filter(w => w.id !== warehouseId)

  // إيجاد تحويل الوحدة الخاص بالصنف (الوحدة الكبيرة ↔ الوحدة الصغيرة)
  function getConv(product: Product) {
    const convs = unitConversionsAll || []
    const directConv = convs.find((c: any) => c.product_id === product.id && c.from_unit_id === product.unit_id)
    const fallbackConv = convs.find((c: any) => c.product_id === product.id)
    return directConv || fallbackConv
  }

  // ✅ Fix: نفس إصلاح المخزون المنخفض الموحّد - مراعاة تحويل الوحدة بدل مقارنة خام بين وحدتين مختلفتين
  function isLowStock(product: Product) {
    if (!product.min_stock || product.min_stock <= 0 || product.current_stock <= 0) return false
    const conv = getConv(product)
    const minStockInBaseUnit = conv && conv.factor > 1 ? product.min_stock * conv.factor : product.min_stock
    return product.current_stock <= minStockInBaseUnit
  }

  // ✅ Fix: نفس منطق تنسيق الرصيد بالوحدة الرئيسية والفرعية المستخدم في نافذة خروج بضاعة
  function formatStock(product: Product) {
    const conv = getConv(product)
    // ✅ Fix: رصيد سالب بيبقى رقمًا واحدًا بالوحدة الأساسية
    if (product.current_stock < 0) {
      return { big: null, bigUnit: '', small: Math.round(product.current_stock * 100) / 100, smallUnit: product.units?.symbol || '' }
    }
    if (!conv || !conv.factor || conv.factor <= 1) {
      return { big: Math.round((product.current_stock || 0) * 100) / 100, bigUnit: product.units?.symbol || '', small: null as number | null, smallUnit: '' }
    }
    const factor = conv.factor
    let bigQty: number, smallQty: number
    if (conv.from_unit_id === product.unit_id) {
      bigQty = Math.floor(product.current_stock)
      smallQty = Math.round((product.current_stock - bigQty) * factor * 100) / 100
    } else {
      bigQty = Math.floor(product.current_stock / factor)
      smallQty = Math.round((product.current_stock % factor) * 100) / 100
    }
    return { big: bigQty, bigUnit: conv.from_unit?.symbol || product.units?.symbol || '', small: smallQty, smallUnit: conv.to_unit?.symbol || '' }
  }

  function stockLabel(product: Product) {
    const s = formatStock(product)
    return s.small !== null && s.small !== undefined ? `${s.big} ${s.bigUnit} و ${s.small} ${s.smallUnit}` : `${s.big} ${s.bigUnit}`
  }

  // خيارات الوحدة المتاحة لإدخال الكمية بها (كبيرة/صغيرة) — إن لم يوجد تحويل فوحدة واحدة فقط
  function unitChoices(product: Product) {
    const conv = getConv(product)
    if (!conv || !conv.factor || conv.factor <= 1) {
      return [{ value: 'big', label: product.units?.symbol || '' }]
    }
    return [
      { value: 'big', label: conv.from_unit?.symbol || product.units?.symbol || '' },
      { value: 'small', label: conv.to_unit?.symbol || '' },
    ]
  }

  // تحويل الكمية المُدخلة (بالوحدة التي اختارها المستخدم) إلى نفس وحدة current_stock الأساسية
  function toBaseQty(product: Product, qty: number, unitChoice: string) {
    const conv = getConv(product)
    if (!conv || !conv.factor || conv.factor <= 1) return qty
    const factor = conv.factor
    const storedInBig = conv.from_unit_id === product.unit_id
    if (unitChoice === 'small') return storedInBig ? qty / factor : qty
    return storedInBig ? qty : qty * factor
  }

  useEffect(() => {
    supabase.from('warehouses').select('*').order('name').then(({ data }) => setWarehouses(data || []))
  }, [])

  async function save() {
    if (!form.product_id || !form.quantity || !form.target_warehouse_id) { alert('يرجى إكمال الحقول المطلوبة'); return }
    const enteredQty = parseFloat(form.quantity)
    const baseQty = selectedProduct ? toBaseQty(selectedProduct, enteredQty, form.quantity_unit) : enteredQty
    if (selectedProduct && baseQty > selectedProduct.current_stock) { alert('الكمية أكبر من المخزون المتاح!'); return }
    setSaving(true)

    const qty = baseQty
    const transferId = crypto.randomUUID()
    const targetWarehouseName = warehouses.find(w => w.id === form.target_warehouse_id)?.name || ''

    // هل يوجد نفس الصنف بالاسم في المستودع الهدف؟
    const { data: targetProduct } = await supabase.from('warehouse_products')
      .select('id, current_stock')
      .eq('warehouse_id', form.target_warehouse_id)
      .eq('name', selectedProduct?.name)
      .maybeSingle()

    if (!targetProduct) {
      alert(`الصنف "${selectedProduct?.name}" غير موجود في مستودع "${targetWarehouseName}". يرجى إضافته أولاً في المستودع الهدف.`)
      setSaving(false)
      return
    }

    // ✅ Fix: لا نحدّث current_stock يدويًا هنا — الـ trigger (trigger_update_stock)
    // يقوم بهذا تلقائيًا عند إدراج حركة stock_movements. التحديث اليدوي السابق كان يتسبب
    // في خصم/إضافة الكمية مرتين (مرة يدويًا، ومرة أخرى عبر الـ trigger).

    // تسجيل حركة الخروج من المصدر — الـ trigger سيخصم الكمية تلقائيًا
    const { error: outError } = await supabase.from('stock_movements').insert([{
      movement_type: 'out', product_id: form.product_id, warehouse_id: warehouseId,
      quantity: qty, destination: 'مستودع آخر', destination_custom: `تحويل إلى ${targetWarehouseName}`,
      movement_date: form.movement_date, notes: form.notes, transfer_id: transferId,
    }])
    if (outError) { alert('خطأ في تسجيل الخروج من المصدر: ' + outError.message); setSaving(false); return }

    // تسجيل حركة الدخول في الهدف — الـ trigger سيضيف الكمية تلقائيًا
    const { error: inError } = await supabase.from('stock_movements').insert([{
      movement_type: 'in', product_id: targetProduct.id, warehouse_id: form.target_warehouse_id,
      quantity: qty, notes: `تحويل من ${warehouseName}${form.notes ? ' — ' + form.notes : ''}`,
      movement_date: form.movement_date, transfer_id: transferId,
    }])
    if (inError) {
      // تراجع عن حركة الخروج لو فشلت حركة الدخول، بتسجيل حركة 'in' معاكسة بنفس الكمية في المصدر
      await supabase.from('stock_movements').insert([{
        movement_type: 'in', product_id: form.product_id, warehouse_id: warehouseId,
        quantity: qty, notes: `تراجع تلقائي عن تحويل فاشل (${transferId})`,
        movement_date: form.movement_date, transfer_id: transferId,
      }])
      alert('خطأ في تسجيل الدخول للهدف، تم التراجع عن الخصم: ' + inError.message); setSaving(false); return
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 500, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: S.purple, fontSize: 16, fontWeight: 700 }}>🔄 تحويل بين المستودعات — {warehouseName}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الصنف *</label>
            <input
              style={{ ...inp }}
              placeholder="🔍 ابحث عن الصنف..."
              value={form.product_id ? (products.find(p => p.id === form.product_id)?.name || '') : productSearch}
              onChange={e => {
                setForm(p => ({ ...p, product_id: '' }))
                setProductSearch(e.target.value)
              }}
            />
            {!form.product_id && productSearch && (
              <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, zIndex: 50, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                {products
                  .filter(p => matchesSearch(p.name, productSearch) || matchesSearch(p.name_en, productSearch))
                  .slice(0, 20)
                  .map(p => (
                    <div key={p.id}
                      onClick={() => { setForm(prev => ({ ...prev, product_id: p.id, quantity_unit: 'big' })); setProductSearch('') }}
                      style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: S.white, borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = S.card2}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <span>{p.name}</span>
                      <span style={{ fontSize: 11, color: isLowStock(p) ? S.red : S.muted }}>متاح: {stockLabel(p)}</span>
                    </div>
                  ))}
                {products.filter(p => matchesSearch(p.name, productSearch) || matchesSearch(p.name_en, productSearch)).length === 0 && (
                  <div style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>لا توجد نتائج</div>
                )}
              </div>
            )}
          </div>
          {selectedProduct && (
            <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: S.muted }}>المخزون المتاح</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: isLowStock(selectedProduct) ? S.red : S.green }}>
                {stockLabel(selectedProduct)}
              </span>
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المستودع الهدف *</label>
            <select style={{ ...inp }} value={form.target_warehouse_id} onChange={e => setForm(p => ({ ...p, target_warehouse_id: e.target.value }))}>
              <option value="">اختر المستودع</option>
              {targetWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الكمية *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="0" />
                <select
                  style={{ ...inp, width: 92, flexShrink: 0 }}
                  value={form.quantity_unit}
                  onChange={e => setForm(p => ({ ...p, quantity_unit: e.target.value }))}
                  disabled={!selectedProduct}
                >
                  {selectedProduct ? unitChoices(selectedProduct).map(u => <option key={u.value} value={u.value}>{u.label}</option>) : <option value="big">الوحدة</option>}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التاريخ</label>
              <input style={inp} type="date" value={form.movement_date} onChange={e => setForm(p => ({ ...p, movement_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
          <div style={{ background: S.purpleB, borderRadius: 10, padding: '10px 14px', fontSize: 11, color: S.purple }}>
            ℹ️ سيتم خصم الكمية من "{warehouseName}" وإضافتها تلقائياً للمستودع الهدف، بشرط وجود الصنف بنفس الاسم هناك.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '🔄 تأكيد التحويل'}
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

// ══ Edit Product Modal ══
function EditProductModal({ product, categories, units, onClose, onSaved }: {
  product: Product; categories: string[]; units: Unit[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: product.name || '',
    name_en: product.name_en || '',
    category: product.category || '',
    min_stock: String(product.min_stock || 0),
    unit_id: product.units?.id || (product as any).unit_id || '',
  })

  const S2 = {
    navy2: '#0F2040', white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
    gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
    green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
    red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
    card: 'rgba(255,255,255,0.04)',
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
    color: S2.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
    boxSizing: 'border-box', direction: 'rtl',
  }

  async function save() {
    if (!form.name) { alert('يرجى إدخال اسم الصنف'); return }
    setSaving(true)
    const { error } = await supabase.from('warehouse_products').update({
      name: form.name,
      name_en: form.name_en || null,
      category: form.category || null,
      min_stock: parseFloat(form.min_stock) || 0,
      unit_id: form.unit_id || null,
    }).eq('id', product.id)
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S2.navy2, borderRadius: 18, border: `1px solid ${S2.border}`, width: '100%', maxWidth: 440, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: S2.gold, fontSize: 16, fontWeight: 700 }}>✏️ تعديل الصنف</h3>
            <p style={{ fontSize: 12, color: S2.muted, marginTop: 2 }}>{product.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S2.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: S2.muted, display: 'block', marginBottom: 5 }}>الاسم (عربي) *</label>
            <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الصنف" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S2.muted, display: 'block', marginBottom: 5 }}>الاسم (English)</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="Product name" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S2.muted, display: 'block', marginBottom: 5 }}>الفئة</label>
            <select style={inp} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="">— بدون فئة —</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S2.muted, display: 'block', marginBottom: 5 }}>الحد الأدنى للمخزون</label>
            <input style={inp} type="number" min="0" value={form.min_stock} onChange={e => setForm(p => ({ ...p, min_stock: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S2.muted, display: 'block', marginBottom: 5 }}>الوحدة</label>
            <select style={inp} value={form.unit_id} onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))}>
              <option value="">-- بدون وحدة --</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S2.muted}`, background: 'transparent', color: S2.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 22px', borderRadius: 10, border: `1px solid ${S2.gold}`, background: S2.gold3, color: S2.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '💾 حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WarehouseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAr } = useLang()
  const { employee } = useAuth()
  const role = employee?.role || ''
  const isAdmin = role === 'admin'
  const isBranchManager = role === 'branch_manager'
  const isWarehouseKeeper = role === 'warehouse_keeper'
  // ✅ Fix: فتح صلاحية الحذف لأمين ومدير المستودعات كمان، مش الأدمن بس
  const canDelete = isAdmin || ['warehouse_keeper', 'warehouse_manager'].includes(role)
  const warehouseId = params.id as string
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('overview')
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [unitConversionsAll, setUnitConversionsAll] = useState<any[]>([])
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
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showUnitConversion, setShowUnitConversion] = useState<Product | null>(null)
  const [showInventory, setShowInventory] = useState(false)
  const [inventoryData, setInventoryData] = useState<Record<string, { units: string; pieces: string }>>({})
  const [inventorySaving, setInventorySaving] = useState(false)
  const [inventorySearch, setInventorySearch] = useState('')
  const [showEditProduct, setShowEditProduct] = useState<Product | null>(null)
  const [showConversionModal, setShowConversionModal] = useState<Product | null>(null)
  const [conversions, setConversions] = useState<UnitConversion[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [convSaving, setConvSaving] = useState(false)
  const [convForm, setConvForm] = useState({ from_unit_id: '', to_unit_id: '', factor: '', notes: '' })
  const [convPreview, setConvPreview] = useState<{qty: string}>({ qty: '' })
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7))

  const MAIN_WAREHOUSE_ID = 'adcb9ca3-56a7-4c9e-94b8-55fec4fcc0a8'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [wh, pr, un, mv, inv, convRes] = await Promise.all([
      supabase.from('warehouses').select('*').eq('id', warehouseId).single(),
      // ✅ Fix: إضافة فلترة is_active - كانت القائمة بتعرض الأصناف الملغى تنشيطها كمان، فكان بيبدو إن الحذف مبيشتغلش
      supabase.from('warehouse_products').select('*, units(id,name,symbol)').eq('warehouse_id', warehouseId).eq('is_active', true).order('name'),
      supabase.from('units').select('*').order('name'),
      supabase.from('stock_movements').select('*, warehouse_products(name, units(symbol)), warehouses(name)').eq('warehouse_id', warehouseId).order('created_at', { ascending: false }).limit(100),
      supabase.from('purchase_invoices').select('*, warehouse_suppliers(name), warehouses(name)').eq('warehouse_id', warehouseId).order('created_at', { ascending: false }).limit(50),
      supabase.from('unit_conversions').select('*, from_unit:units!unit_conversions_from_unit_id_fkey(name,symbol), to_unit:units!unit_conversions_to_unit_id_fkey(name,symbol)'),
    ])
    setWarehouse(wh.data)
    setUnitConversionsAll(convRes.data || [])

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

  // ✅ Fix حرج: min_stock محفوظة بالوحدة الكبرى (كرتون مثلًا)، بينما current_stock أحيانًا بيستخدم
  // الوحدة الصغرى عند وجود تحويل وحدة مسجَّل للصنف. المقارنة الخام (current_stock <= min_stock) كانت
  // تقارن بين وحدتين مختلفتين فعليًا، فكانت تُظهر "مخزون منخفض" حتى لو الكمية الفعلية أعلى من الحد
  // الأدنى بكثير بعد التحويل الصحيح. هذه الدالة موحّدة الآن وتُستخدم في كل مكان بدل التكرار الخام
  function isLowStock(p: Product) {
    if (!p.min_stock || p.min_stock <= 0 || p.current_stock <= 0) return false
    const conv = unitConversionsAll.find((c: any) => c.product_id === p.id)
    const minStockInBaseUnit = conv && conv.factor > 1 ? p.min_stock * conv.factor : p.min_stock
    return p.current_stock <= minStockInBaseUnit
  }

  // Stats
  const lowStock = products.filter(p => isLowStock(p))
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
    const matchSearch = matchesSearch(p.name, search) || matchesSearch(p.name_en, search) || matchesSearch(p.product_code, search)
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? p.is_active !== false : p.is_active === false)
    const matchStock = stockFilter === 'all' ||
      (stockFilter === 'low' && isLowStock(p)) ||
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


  function printWarehouseReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const today = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
    const grouped: Record<string, typeof products> = {}
    products.filter(p => p.is_active !== false).forEach(p => {
      const cat = p.category || 'غير مصنف'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(p)
    })
    const lowStock = products.filter(p => isLowStock(p) && p.is_active !== false)
    const totalValue = products.reduce((s, p) => s + (p.current_stock * (p.last_purchase_price || 0)), 0)

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<title>تقرير المخزون — ${warehouse?.name || ''}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #1a1a1a; direction: rtl; }
  .header { text-align: center; border-bottom: 3px solid #C9A84C; padding-bottom: 12px; margin-bottom: 20px; }
  .logo { font-size: 20px; font-weight: 900; color: #1a1a1a; }
  .subtitle { font-size: 14px; color: #C9A84C; font-weight: 700; margin-top: 4px; }
  .meta { font-size: 11px; color: #666; margin-top: 4px; }
  .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
  .stat { background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
  .stat-val { font-size: 20px; font-weight: 800; color: #C9A84C; }
  .stat-lbl { font-size: 10px; color: #666; margin-top: 2px; }
  .section-title { background: #f0f0f0; font-weight: 800; color: #333; padding: 8px 12px; margin: 16px 0 0; border-right: 4px solid #C9A84C; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #f5f5f5; padding: 7px 10px; text-align: right; font-size: 11px; color: #555; border-bottom: 2px solid #ddd; }
  td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
  .low { color: #EF4444; font-weight: 700; }
  .ok { color: #22C55E; }
  .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
  @media print { @page { margin: 12mm; size: A4; } }
</style></head><body>
<div class="header">
  <div class="logo">🌸 Orchid Group</div>
  <div class="subtitle">تقرير المخزون — ${warehouse?.name || ''}</div>
  <div class="meta">${today} · إجمالي ${products.length} صنف</div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-val">${products.filter(p=>p.is_active!==false).length}</div><div class="stat-lbl">أصناف نشطة</div></div>
  <div class="stat"><div class="stat-val" style="color:#EF4444">${lowStock.length}</div><div class="stat-lbl">مخزون منخفض</div></div>
  <div class="stat"><div class="stat-val">${products.filter(p=>p.current_stock===0).length}</div><div class="stat-lbl">نفذ المخزون</div></div>
  <div class="stat"><div class="stat-val" style="font-size:14px">MYR ${totalValue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div class="stat-lbl">إجمالي قيمة المخزون</div></div>
</div>
${lowStock.length > 0 ? `
<div class="section-title">⚠️ منتجات تحتاج إعادة طلب (${lowStock.length})</div>
<table><thead><tr><th>الصنف</th><th>الفئة</th><th>المتاح</th><th>الحد الأدنى</th><th>الوحدة</th></tr></thead><tbody>
${lowStock.map(p=>`<tr><td><b>${p.name}</b>${p.name_en?'<br><span style="color:#999;font-size:10px">'+p.name_en+'</span>':''}</td><td>${p.category||'—'}</td><td class="low">${fmtQty(p.current_stock)}</td><td>${fmtQty(p.min_stock)}</td><td>${p.units?.symbol||'—'}</td></tr>`).join('')}
</tbody></table>` : ''}
${Object.entries(grouped).map(([cat, items]) => `
<div class="section-title">📦 ${cat} (${items.length})</div>
<table><thead><tr><th>الصنف</th><th>Item Name</th><th>الوحدة</th><th>المتاح</th><th>الحد الأدنى</th><th>آخر سعر</th></tr></thead><tbody>
${items.map(p=>`<tr><td><b>${p.name}</b></td><td style="direction:ltr;text-align:left;color:#666">${p.name_en||''}</td><td>${p.units?.symbol||'—'}</td><td class="${p.current_stock<=p.min_stock&&p.min_stock>0?'low':'ok'}">${fmtQty(p.current_stock)}</td><td>${fmtQty(p.min_stock||0)}</td><td>MYR ${(p.last_purchase_price||0).toFixed(2)}</td></tr>`).join('')}
</tbody></table>`).join('')}
<div class="footer">Orchid House Restaurant Management System · ${today}</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`
    win.document.write(html)
    win.document.close()
  }

  // ✅ Fix: تقريب أي رقم كمية يُعرض في التقارير لمنع ظهور كسور عشرية طويلة غير مقروءة
  // (زي 0.16666666666666666 الناتجة عن قسمة الكمية على معامل تحويل الوحدة)
  function fmtQty(n: number | null | undefined) {
    if (n === null || n === undefined || isNaN(n)) return 0
    return Math.round(n * 100) / 100
  }

  // ✅ جديد: تنسيق أي كمية حركة (دخول/خروج) بنفس أسلوب "كرتون + عبوة" المستخدم في عرض الرصيد،
  // بدل عرضها دايمًا بالوحدة الأساسية فقط (كانت بتظهر مثلاً "0.25 كرتون" بدل "1 عبوة"
  // رغم إن الاثنين نفس الكمية بالظبط - 1 عبوة = 0.25 كرتون حسب معامل التحويل المسجَّل للصنف)
  function formatQtyLabel(productId: string | null | undefined, qty: number | null | undefined) {
    const q = fmtQty(qty)
    const product = products.find(p => p.id === productId)
    const fallbackUnit = (products.find(p => p.id === productId) as any)?.units?.symbol || ''
    if (!product) return `${q} ${fallbackUnit}`
    const directConv = unitConversionsAll.find((c: any) => c.product_id === productId && c.from_unit_id === product.unit_id)
    const fallbackConv = unitConversionsAll.find((c: any) => c.product_id === productId)
    const conv = directConv || fallbackConv
    const baseUnit = product.units?.symbol || ''
    if (!conv || !conv.factor || conv.factor <= 1) {
      return `${q} ${baseUnit}`
    }
    const factor = conv.factor
    const storedInBig = conv.from_unit_id === product.unit_id
    let bigQty: number, smallQty: number
    if (storedInBig) {
      bigQty = Math.floor(q)
      smallQty = Math.round((q - bigQty) * factor * 100) / 100
    } else {
      bigQty = Math.floor(q / factor)
      smallQty = Math.round((q % factor) * 100) / 100
    }
    const bigUnit = conv.from_unit?.symbol || baseUnit
    const smallUnit = conv.to_unit?.symbol || baseUnit
    if (bigQty === 0 && smallQty !== 0) return `${smallQty} ${smallUnit}`
    if (smallQty === 0) return `${bigQty} ${bigUnit}`
    return `${bigQty} ${bigUnit} و ${smallQty} ${smallUnit}`
  }

  // تنسيق المخزون بالوحدتين الكبيرة والصغيرة
  function formatStock(product: Product) {
    // ✅ Fix: نختار التحويل الذي وحدته الكبيرة (from_unit_id) تطابق وحدة المخزون الأساسية للصنف (unit_id)
    // بدل أخذ أول تحويل عشوائي — مثال: الموز وحدته الأساسية "كرتون"، لازم نختار "1 كرتون = 13 كيلو"
    // مش "1 كيلو = 1000 غرام" (ده تحويل داخلي مش مرتبط بوحدة المخزون)
    const directConv = unitConversionsAll.find((c: any) => c.product_id === product.id && c.from_unit_id === product.unit_id)
    const fallbackConv = unitConversionsAll.find((c: any) => c.product_id === product.id)
    const conv = directConv || fallbackConv
    // ✅ Fix: الرصيد السالب (نتيجة خصم زائد عن المتاح في حركات سابقة) كان بيدّي أرقامًا متضاربة
    // الإشارة عند التقسيم لوحدة كبيرة/صغيرة، لأن Math.floor و % في JS بيتصرفوا بشكل غير بديهي مع السالب.
    // لذلك نعرض الرصيد السالب كرقم واحد بالوحدة الأساسية بدل تقسيمه، مع تنبيه للمستخدم بضرورة المراجعة.
    if (product.current_stock < 0) {
      return {
        big: null,
        bigUnit: '',
        small: Math.round(product.current_stock * 100) / 100,
        smallUnit: product.units?.symbol || '',
        conversionNote: '⚠️ رصيد سالب — يرجى مراجعة حركات هذا الصنف',
      }
    }
    if (!conv || !conv.factor || conv.factor <= 1) {
      return {
        big: null,
        bigUnit: '',
        small: product.current_stock,
        smallUnit: product.units?.symbol || '',
        conversionNote: null,
      }
    }
    const factor = conv.factor
    let bigQty: number, smallQty: number
    if (conv.from_unit_id === product.unit_id) {
      // ✅ Fix حرج: الرصيد متسجل بالفعل بالوحدة الكبيرة نفسها (from_unit = وحدة المخزون الأساسية)
      // زي "ببروني لحم" — current_stock مباشرة بالكرتون، والتحويل هنا "1 كرتون = 5 كيس" لغرض العرض بس
      // فلازم ناخد الجزء الصحيح من الرقم مباشرة، مش نقسم على factor (كان بيدي رقم غلط تمامًا)
      bigQty = Math.floor(product.current_stock)
      smallQty = Math.round((product.current_stock - bigQty) * factor * 100) / 100
    } else {
      // الحالة التانية: الرصيد متسجل بالوحدة الصغيرة (زي كيس)، والتحويل بيجمعها لوحدة كبيرة (كرتون) للعرض
      bigQty = Math.floor(product.current_stock / factor)
      // ✅ Fix: تقريب لمنع أخطاء الفاصلة العائمة في JS (مثال: 6.899999999999999 بدل 6.9)
      smallQty = Math.round((product.current_stock % factor) * 100) / 100
    }
    return {
      big: bigQty,
      bigUnit: conv.from_unit?.symbol || '',
      small: smallQty,
      smallUnit: conv.to_unit?.symbol || product.units?.symbol || '',
      conversionNote: `1 ${conv.from_unit?.symbol || ''} = ${factor} ${conv.to_unit?.symbol || ''}`,
    }
  }

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
          <button onClick={() => setShowTransfer(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🔄 تحويل مستودعات</button>
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

      {/* ── Print + Inventory Buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
        <button onClick={() => {
          const init: Record<string, { units: string; pieces: string }> = {}
          products.forEach(p => { init[p.id] = { units: '', pieces: '' } })
          setInventoryData(init)
          setShowInventory(true)
        }} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          📋 {isAr ? 'بدء الجرد' : 'Start Inventory'}
        </button>
        <button onClick={printWarehouseReport} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          🖨️ طباعة تقرير المخزون
        </button>
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
                <span onClick={() => { setSelectedCategory(cat); setCurrentPage(1) }} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {CATEGORY_ICONS[cat] || '📦'} {cat}
                  <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 6px', fontSize: 11, color: S.white, fontWeight: 700 }}>
                    {catCounts[cat] || 0}
                  </span>
                </span>
                <span
                    onClick={e => { e.stopPropagation(); setEditingCategory(cat); setEditCategoryName(cat) }}
                    style={{ marginRight: 2, color: S.gold, fontSize: 11, cursor: 'pointer', padding: '0 2px' }}
                    title="تعديل اسم القسم"
                  >✏️</span>
                {canDelete && (
                  <span
                    onClick={async e => {
                      e.stopPropagation()
                      const count = catCounts[cat] || 0
                      if (count > 0 && !confirm(`قسم "${cat}" يحتوي على ${count} صنف.\n\n⚠️ سيتم حذف هذه الأصناف نهائيًا (الأصناف التي ليس لها أي تاريخ حركات أو فواتير أو طلبات مرتبطة بها فقط).\nالأصناف التي لها سجل تاريخي سيتم تنبيهك بها ولن تُحذف تلقائيًا.\n\nهل تريد الاستمرار؟`)) return
                      if (count === 0 && !confirm(`حذف قسم "${cat}"؟`)) return

                      if (count > 0) {
                        // ✅ جلب كل منتجات هذا القسم في هذا المستودع
                        const { data: catProducts, error: prodErr } = await supabase
                          .from('warehouse_products').select('id, name')
                          .eq('category', cat).eq('warehouse_id', warehouseId)
                        if (prodErr) { alert('تعذّر جلب أصناف القسم: ' + prodErr.message); return }

                        const blockedNames: string[] = []
                        const deletableIds: string[] = []

                        // ✅ فحص كل صنف على حدة للتأكد من عدم وجود أي ارتباط تاريخي قبل حذفه فعليًا
                        for (const p of (catProducts || [])) {
                          const [sm, pii, iwri, bri, dp] = await Promise.all([
                            supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', p.id),
                            supabase.from('purchase_invoice_items').select('id', { count: 'exact', head: true }).eq('product_id', p.id),
                            supabase.from('internal_warehouse_request_items').select('id', { count: 'exact', head: true }).eq('product_id', p.id),
                            supabase.from('branch_request_items').select('id', { count: 'exact', head: true }).eq('product_id', p.id),
                            supabase.from('department_products').select('id', { count: 'exact', head: true }).eq('product_id', p.id),
                          ])
                          const hasHistory = [sm, pii, iwri, bri, dp].some(r => (r.count || 0) > 0)
                          if (hasHistory) blockedNames.push(p.name)
                          else deletableIds.push(p.id)
                        }

                        // ✅ حذف الأصناف الخالية من أي ارتباط فقط، الباقي يبقى كما هو بدون أي لمس
                        if (deletableIds.length > 0) {
                          const { error: delProdErr } = await supabase.from('warehouse_products').delete().in('id', deletableIds)
                          if (delProdErr) { alert('تعذّر حذف بعض الأصناف: ' + delProdErr.message); return }
                        }

                        if (blockedNames.length > 0) {
                          alert(`⚠️ تم حذف ${deletableIds.length} صنف من القسم.\n\nلم يتم حذف ${blockedNames.length} صنف لوجود سجل تاريخي (حركات/فواتير/طلبات) مرتبط بها:\n${blockedNames.join('، ')}\n\nهذه الأصناف نُقلت إلى "بدون فئة" بدلاً من حذفها.`)
                          // الأصناف المحظورة تُنقل لـ"بدون فئة" (بدل ما تفضل تظهر القسم المحذوف تلقائيًا)
                          await supabase.from('warehouse_products').update({ category: '' }).eq('category', cat).eq('warehouse_id', warehouseId)
                        }
                      }

                      const { error: delErr } = await supabase.from('warehouse_categories').delete().eq('name', cat)
                      if (delErr) { alert('تعذّر حذف القسم: ' + delErr.message); return }
                      // ✅ تحديث الواجهة فقط بعد التأكد من نجاح الحذف فعليًا في قاعدة البيانات
                      setCategories(prev => prev.filter(c => c !== cat))
                      if (selectedCategory === cat) setSelectedCategory('all')
                      fetchAll()
                    }}
                    style={{ marginRight: 4, color: '#EF4444', fontSize: 13, cursor: 'pointer', fontWeight: 700, padding: '0 2px' }}
                    title="حذف القسم"
                  >✕</span>
                )}
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
              placeholder="🔍 بحث بالاسم أو الكود (مثال: OR001)..."
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
            <div style={{ background: S.amberB, border: `1px solid ${S.amber}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <span>⚠️</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.amber }}>مخزون منخفض ({lowStock.length} صنف)</div>
              </div>
              {/* ✅ Fix: بدل القائمة النصية المتصلة بفاصلة، عرض كل صنف في مربع مستقل يوضّح الرصيد الحالي
                  والحد الأدنى، عشان يبقى واضح فورًا أي الأصناف الأقرب للنفاد فعليًا */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, maxHeight: 320, overflowY: 'auto', paddingLeft: 4 }}>
                {lowStock.map(p => {
                  const s = formatStock(p)
                  const stockText = s.big !== null && s.small !== null && s.small !== undefined
                    ? `${s.big} ${s.bigUnit} و ${s.small} ${s.smallUnit}`
                    : `${s.small} ${s.smallUnit}`
                  return (
                    <div key={p.id} style={{ background: S.navy3, border: `1px solid ${S.amber}40`, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.white, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: S.amber }}>المتاح: {stockText}</div>
                      <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>الحد الأدنى: {fmtQty(p.min_stock)} {p.units?.symbol || ''}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Products Table ── */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                <thead>
                  <tr style={{ background: S.navy3 }}>
                    {['الكود', 'الصنف (عربي / English)', 'الفئة', 'الكمية', 'الحد الأدنى', 'آخر سعر', 'الحالة', 'إجراء'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: S.muted }}>
                      {search ? `لا توجد نتائج لـ "${search}"` : 'لا توجد أصناف — اضغط "صنف جديد" للبدء'}
                    </td></tr>
                  ) : paginatedProducts.map(p => {
                    // ✅ Fix: توحيد الحساب مع دالة isLowStock المشتركة بدل تكرار نفس منطق تحويل الوحدة محليًا
                    const isLow = isLowStock(p)
                    const isEmpty = p.current_stock === 0
                    const isInactive = p.is_active === false
                    return (
                      <tr key={p.id} className="prod-row"
                        style={{ borderBottom: `1px solid ${S.border}`, opacity: isInactive ? 0.55 : 1, transition: 'background .15s' }}
                      >
                        {/* كود الصنف */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: S.gold3, color: S.gold, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: 0.5 }}>
                            {p.product_code || '—'}
                          </span>
                        </td>
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
                          {(() => {
                            const s = formatStock(p)
                            const hasBig = s.big !== null
                            return (
                              <div>
                                <div>
                                  {hasBig ? (
                                    <>
                                      {(s.big as number) > 0 && <>{s.big} <span style={{ fontSize: 11, fontWeight: 400, color: S.muted }}>{s.bigUnit}</span></>}
                                      {(s.big as number) > 0 && s.small > 0 && ' + '}
                                      {(s.small > 0 || (s.big as number) === 0) && <>{s.small} <span style={{ fontSize: 11, fontWeight: 400, color: S.muted }}>{s.smallUnit}</span></>}
                                    </>
                                  ) : (
                                    <>{s.small} <span style={{ fontSize: 11, fontWeight: 400, color: S.muted }}>{s.smallUnit}</span></>
                                  )}
                                </div>
                                {s.conversionNote && (
                                  <div style={{ fontSize: 10, fontWeight: 400, color: S.muted, marginTop: 2 }}>ℹ️ {s.conversionNote}</div>
                                )}
                              </div>
                            )
                          })()}
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <button
                            onClick={() => toggleActive(p)}
                            style={{
                              padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                              fontFamily: 'Tajawal, sans-serif', fontWeight: 600,
                              border: `1px solid ${isInactive ? S.green : S.red}`,
                              background: isInactive ? S.greenB : S.redB,
                              color: isInactive ? S.green : S.red,
                            }}
                          >
                            {isInactive ? '▶ تفعيل' : '⏸ إيقاف'}
                          </button>
                          <button
                            onClick={() => setShowEditProduct(p)}
                            style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 600, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold }}
                          >
                            ✏️ تعديل
                          </button>
                          <button
                            onClick={() => setShowUnitConversion(p)}
                            style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 600, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple }}
                          >
                            ⚖️ تحويل
                          </button>
                          {canDelete && (
                            <button
                              onClick={async () => {
                                if (!confirm('حذف هذا الصنف نهائياً؟')) return
                                // ✅ Fix حرج: كان بيستخدم .delete() نهائي مباشر، وده كان بيفشل بصمت لأن الجدول
                                // مرتبط بجداول تانية كتير (حركات مخزون، ربط أقسام، إلخ) فقاعدة البيانات كانت
                                // ترفض الحذف بسبب قيود الربط - والكود مكانش بيتحقق من الخطأ أو يعرضه، فالصنف
                                // كان يفضل موجود زي ما هو من غير ما حد يعرف السبب. الحل: إلغاء تنشيط آمن بدل
                                // حذف نهائي (نفس الأسلوب المستخدم في باقي النظام)، مع إظهار أي خطأ فعلي لو حصل
                                const { error } = await supabase.from('warehouse_products').update({ is_active: false }).eq('id', p.id)
                                if (error) { alert('حصل خطأ أثناء الحذف: ' + error.message); return }
                                fetchAll()
                              }}
                              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 600, border: `1px solid ${S.red}`, background: S.redB, color: S.red }}
                            >
                              🗑️ حذف
                            </button>
                          )}
                          </div>
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: S.green }}>📥 سجل دخول البضاعة</h2>
            <button onClick={() => setShowStockIn(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>+ فاتورة جديدة</button>
          </div>
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ background: S.navy3 }}>
                    {['التاريخ', 'الصنف', 'الكمية', 'سعر الوحدة', 'ملاحظات'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.filter(m => m.movement_type === 'in').length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد حركات دخول بعد</td></tr>
                    : movements.filter(m => m.movement_type === 'in').map(m => (
                      <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{m.movement_date}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: S.white }}>{m.warehouse_products?.name}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: S.green }}>+{formatQtyLabel(m.product_id, m.quantity)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: S.gold }}>{(m as any).unit_price ? formatMYR((m as any).unit_price) : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{m.notes || '—'}</td>
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
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: S.red }}>-{formatQtyLabel(m.product_id, m.quantity)}</td>
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
                          {m.movement_type === 'in' ? '+' : '-'}{formatQtyLabel(m.product_id, m.quantity)}
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
                          {m.movement_type === 'in' ? '+' : '-'}{formatQtyLabel(m.product_id, m.quantity)}
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
                { label: 'الكود', value: selectedProduct.product_code || '—', color: S.gold },
                { label: 'الفئة', value: selectedProduct.category || '—' },
                { label: 'المخزون الحالي', value: `${fmtQty(selectedProduct.current_stock)} ${(selectedProduct as any).units?.symbol || ''}`, color: isLowStock(selectedProduct) ? S.red : S.green },
                { label: 'الحد الأدنى', value: `${fmtQty(selectedProduct.min_stock)} ${(selectedProduct as any).units?.symbol || ''}` },
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
                    <span style={{ fontSize: 12, color: m.movement_type === 'in' ? S.green : S.red }}>{m.movement_type === 'in' ? '📥 +' : '📤 -'}{formatQtyLabel(m.product_id, m.quantity)}</span>
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
          units={units} categories={categories} warehouseId={warehouseId}
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
        <StockOutModal warehouseId={warehouseId} warehouseName={warehouse.name} products={products} unitConversionsAll={unitConversionsAll}
          onClose={() => setShowStockOut(false)} onSaved={() => { setShowStockOut(false); fetchAll() }} />
      )}
      {showTransfer && warehouse && (
        <TransferModal warehouseId={warehouseId} warehouseName={warehouse.name} products={products} unitConversionsAll={unitConversionsAll}
          onClose={() => setShowTransfer(false)} onSaved={() => { setShowTransfer(false); fetchAll() }} />
      )}
      {editingCategory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.gold}40`, width: '100%', maxWidth: 380, padding: 28 }}>
            <h3 style={{ color: S.gold, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>✏️ تعديل اسم القسم</h3>
            <p style={{ fontSize: 12, color: S.muted, marginBottom: 16 }}>القسم الحالي: <strong style={{ color: S.white }}>{editingCategory}</strong></p>
            <input style={{ ...inp, marginBottom: 16 }} value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)} placeholder="الاسم الجديد..." autoFocus />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingCategory(null)} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button onClick={async () => {
                const newName = editCategoryName.trim()
                if (!newName || newName === editingCategory) { setEditingCategory(null); return }
                await supabase.from('warehouse_categories').update({ name: newName }).eq('name', editingCategory)
                await supabase.from('warehouse_products').update({ category: newName }).eq('category', editingCategory)
                setCategories(prev => prev.map(c => c === editingCategory ? newName : c))
                if (selectedCategory === editingCategory) setSelectedCategory(newName)
                setEditingCategory(null)
                fetchAll()
              }} style={{ padding: '9px 22px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                💾 حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditProduct && (
        <EditProductModal
          product={showEditProduct}
          categories={categories}
          units={units}
          onClose={() => setShowEditProduct(null)}
          onSaved={() => { setShowEditProduct(null); fetchAll() }}
        />
      )}
      {showUnitConversion && (
        <UnitConversionModal
          product={showUnitConversion}
          units={units}
          onClose={() => setShowUnitConversion(null)}
        />
      )}

      {/* ══ INVENTORY MODAL ══ */}
      {showInventory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.amber}40`, width: '100%', maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 style={{ color: S.amber, fontSize: 17, fontWeight: 800 }}>📋 {isAr ? 'جرد المخزون' : 'Inventory Count'}</h2>
                <p style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{isAr ? 'أدخل الكمية الفعلية لكل صنف' : 'Enter actual quantity for each item'}</p>
              </div>
              <button onClick={() => setShowInventory(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Search */}
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
              <input style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }}
                placeholder="🔍 بحث..." value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} />
            </div>

            {/* Products List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {/* Header Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '8px 12px', background: S.navy3, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: S.muted, fontWeight: 700 }}>الصنف</div>
                  <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, textAlign: 'center' }}>وحدة كبيرة</div>
                  <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, textAlign: 'center' }}>قطعة / كيس</div>
                  <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, textAlign: 'center' }}>الإجمالي</div>
                </div>

                {products
                  .filter(p => matchesSearch(p.name, inventorySearch) || matchesSearch(p.name_en, inventorySearch))
                  .map(p => {
                    const inv = inventoryData[p.id] || { units: '', pieces: '' }
                    const conv = unitConversionsAll.find((c: any) => c.product_id === p.id)
                    const contents = conv?.factor || 1
                    const hasConv = conv && contents > 1
                    const bigQty = parseFloat(inv.units) || 0
                    const smallQty = parseFloat(inv.pieces) || 0
                    const hasValue = inv.units !== '' || inv.pieces !== ''
                    const smallUnitName = conv?.to_unit?.symbol || p.units?.symbol || ''
                    const bigUnitName = conv?.from_unit?.symbol || p.units?.symbol || ''
                    return (
                      <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '10px 12px', background: hasValue ? 'rgba(245,158,11,0.06)' : S.card, borderRadius: 10, border: `1px solid ${hasValue ? S.amber + '40' : S.border}`, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{p.name}</div>
                          {p.name_en && <div style={{ fontSize: 10, color: S.muted }}>{p.name_en}</div>}
                          <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>
                            {hasConv
                              ? `1 ${bigUnitName} = ${contents} ${smallUnitName}`
                              : `الوحدة: ${p.units?.symbol || '—'}`}
                          </div>
                        </div>
                        <input
                          type="number" min="0"
                          placeholder={hasConv ? "0" : "—"}
                          disabled={!hasConv}
                          value={hasConv ? inv.units : ''}
                          onChange={e => hasConv && setInventoryData(prev => ({ ...prev, [p.id]: { ...prev[p.id], units: e.target.value } }))}
                          style={{ background: hasConv ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, color: hasConv ? S.white : S.muted, outline: 'none', width: '100%', textAlign: 'center', fontFamily: 'system-ui', cursor: hasConv ? 'auto' : 'not-allowed' }}
                        />
                        <input
                          type="number" min="0"
                          placeholder="0"
                          value={inv.pieces}
                          onChange={e => setInventoryData(prev => ({ ...prev, [p.id]: { ...prev[p.id], pieces: e.target.value } }))}
                          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, color: S.white, outline: 'none', width: '100%', textAlign: 'center', fontFamily: 'system-ui' }}
                        />
                        {/* label for small unit */}
                        <div style={{ fontSize: 10, color: S.muted, textAlign: 'center', marginTop: 2 }}>{smallUnitName}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: hasValue ? S.amber : S.muted }}>
                          {hasValue ? (
                            <div>
                              {hasConv && bigQty > 0 && (
                                <div>{bigQty} <span style={{ fontSize: 10, fontWeight: 400 }}>{bigUnitName}</span></div>
                              )}
                              {(() => {
                                const totalPieces = hasConv ? smallQty : bigQty + smallQty
                                return totalPieces > 0 ? (
                                  <div>{totalPieces} <span style={{ fontSize: 10, fontWeight: 400 }}>{smallUnitName}</span></div>
                                ) : null
                              })()}
                              {bigQty === 0 && smallQty === 0 && <div style={{ color: S.muted }}>0</div>}
                            </div>
                          ) : (
                            <div style={{ color: S.muted, fontSize: 12 }}>{fmtQty(p.current_stock)} <span style={{ fontSize: 10 }}>{p.units?.symbol || ''}</span></div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12 }}>
              <div style={{ fontSize: 13, color: S.muted }}>
                {Object.values(inventoryData).filter(v => v.units !== '' || v.pieces !== '').length} صنف تم جرده
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowInventory(false)} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
                <button onClick={async () => {
                  setInventorySaving(true)
                  const updates = Object.entries(inventoryData)
                    .filter(([, v]) => v.units !== '' || v.pieces !== '')
                  if (updates.length === 0) { alert('يرجى إدخال كمية لصنف واحد على الأقل'); setInventorySaving(false); return }

                  // إنشاء سجل جرد جديد بحالة pending
                  const { data: countRecord, error: countErr } = await supabase
                    .from('inventory_counts')
                    .insert([{
                      warehouse_id: warehouseId,
                      counted_by: employee?.id,
                      status: 'pending',
                      count_date: new Date().toISOString().split('T')[0],
                    }]).select('id').single()

                  if (countErr || !countRecord) {
                    alert('خطأ في إنشاء سجل الجرد: ' + countErr?.message)
                    setInventorySaving(false); return
                  }

                  // حفظ تفاصيل كل صنف
                  const items = updates.map(([productId, inv]) => {
                    const p = products.find(x => x.id === productId)
                    const conv = unitConversionsAll.find((c: any) => c.product_id === productId)
                    const factor = conv?.factor || 1
                    const bigQtyEntered = parseFloat(inv.units) || 0
                    const smallQtyEntered = parseFloat(inv.pieces) || 0
                    // ✅ Fix جذري جدًا: كانت المعادلة بتفترض دايمًا إن current_stock مخزّن بالوحدة الصغرى
                    // (actual = وحدات×معامل + كسور)، وده غلط لأصناف كتير (زي "أفخاذ دجاج" و"ببروني لحم")
                    // اللي وحدتها الأساسية المسجّلة فعليًا في قاعدة البيانات هي الوحدة الكبرى نفسها (كرتون مثلاً)،
                    // ومعامل التحويل هنا غرضه عرض/تقسيم الكسور بس، مش تحويل التخزين. النتيجة كانت أرقام
                    // مضاعفة بشكل خاطئ جدًا (مثال حقيقي: "1 كرتون + 5 كيلو" كان بيتسجل 17 بدل 1.42).
                    // الحل: نتحقق أولًا هل وحدة الصنف الأساسية (p.unit_id) هي نفسها "from_unit" في معامل
                    // التحويل (يعني التخزين بالوحدة الكبرى مباشرة)، ولو أيوه نحسب: كبيرة + (كسور ÷ معامل)
                    // بدل: كبيرة × معامل + كسور
                    const storedInBigUnit = conv && p?.unit_id === conv.from_unit_id
                    const actual = storedInBigUnit
                      ? bigQtyEntered + (smallQtyEntered / factor)
                      : bigQtyEntered * factor + smallQtyEntered
                    return {
                      count_id: countRecord.id,
                      product_id: productId,
                      system_stock: p?.current_stock || 0,
                      actual_stock: actual,
                      unit_id: p?.units?.id || null,
                    }
                  })

                  const { error: itemsErr } = await supabase.from('inventory_count_items').insert(items)
                  if (itemsErr) { alert('خطأ في حفظ التفاصيل: ' + itemsErr.message); setInventorySaving(false); return }

                  setInventorySaving(false)
                  setShowInventory(false)
                  fetchAll()
                  alert(`✅ تم رفع الجرد — ${updates.length} صنف\n⏳ في انتظار اعتماد مدير الفرع أو مدير النظام`)
                }} disabled={inventorySaving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: inventorySaving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {inventorySaving ? '⏳ جاري الرفع...' : '📤 رفع الجرد للاعتماد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
