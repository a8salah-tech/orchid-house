'use client'
export const dynamic = 'force-dynamic'
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

// ✅ FIX 3: فواصل الأرقام
function formatMYR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return 'MYR ' + new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}

interface Product { id: string; name: string; name_en?: string; category: string; current_stock: number; last_purchase_price: number; units?: { symbol: string } }
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
}

// ══ AI Invoice Scanner ══
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

// ══ Add Supplier Modal ══
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

// ══ Image Viewer Modal ══
// ✅ FIX 2: صورة الفاتورة لا تملأ الشاشة + زر إغلاق واضح
function ImageViewerModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: -16, left: -16, width: 36, height: 36, borderRadius: '50%', background: S.red, border: 'none', color: S.white, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontWeight: 700 }}
        >✕</button>
        <img src={imageUrl} alt="فاتورة" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain', display: 'block' }} />
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: S.muted }}>اضغط خارج الصورة للإغلاق</div>
      </div>
    </div>
  )
}

// ══ New Invoice Modal ══
function NewInvoiceModal({ products, suppliers, units, warehouses, onClose, onSaved }: {
  products: Product[]; suppliers: Supplier[]; units: Unit[]
  warehouses: { id: string; name: string }[]; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [localSuppliers, setLocalSuppliers] = useState(suppliers)
  const [items, setItems] = useState<InvoiceItem[]>([{ product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false }])
  const [form, setForm] = useState({
    supplier_id: '', warehouse_id: warehouses[0]?.id || '',
    // ✅ FIX 5: رقم الفاتورة من المورد منفصل عن رقم النظام
    supplier_invoice_number: '', // رقم فاتورة المورد
    invoice_date: new Date().toISOString().split('T')[0], notes: '',
  })

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
      const result = await scanInvoiceWithAI(base64, products)
      setScanProgress('🔗 مطابقة الأصناف مع قاعدة البيانات...')

      if (result.invoice_number) setForm(p => ({ ...p, supplier_invoice_number: result.invoice_number }))
      if (result.invoice_date) setForm(p => ({ ...p, invoice_date: result.invoice_date }))
      if (result.notes) setForm(p => ({ ...p, notes: result.notes }))

      if (result.supplier_name) {
        const matched = localSuppliers.find(s =>
          s.name.includes(result.supplier_name) || result.supplier_name.includes(s.name)
        )
        if (matched) setForm(p => ({ ...p, supplier_id: matched.id }))
      }

      if (result.items?.length) {
        const matchedItems: InvoiceItem[] = result.items.map(item => {
          const match = products.find(p =>
            p.name.includes(item.name) || item.name.includes(p.name) ||
            (p.name_en && (p.name_en.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(p.name_en.toLowerCase())))
          )
          return {
            product_id: match?.id || '',
            product_name: match?.name || item.name,
            quantity: String(item.quantity || ''),
            unit_price: String(item.unit_price || ''),
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
    setItems(p => [...p, { product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false }])
  }

  function setItem(i: number, k: string, v: string) {
    setItems(p => p.map((it, idx) => {
      if (idx !== i) return it
      if (k === 'product_id') {
        const prod = products.find(p => p.id === v)
        return { ...it, product_id: v, product_name: prod?.name || '', matched: !!prod, unit_price: prod?.last_purchase_price ? String(prod.last_purchase_price) : it.unit_price }
      }
      return { ...it, [k]: v }
    }))
  }

  async function save() {
    if (!form.warehouse_id) { alert('يرجى اختيار المستودع'); return }
    if (items.some(i => !i.product_id || !i.quantity || !i.unit_price)) { alert('يرجى إكمال بيانات الأصناف'); return }
    setSaving(true)
    try {
      const total = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0)
      // ✅ FIX 5: نحفظ رقم فاتورة المورد في invoice_number، والنظام يولد رقمه التلقائي
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
        }])
        await supabase.from('stock_movements').insert([{
          movement_type: 'in', product_id: item.product_id,
          warehouse_id: form.warehouse_id, quantity: parseFloat(item.quantity),
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
            <div>
              <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>🛒 فاتورة مشتريات جديدة</h2>
              <p style={{ fontSize: 11, color: S.muted }}>صوّر الفاتورة وسيقوم الذكاء الاصطناعي باستخراج البيانات تلقائياً</p>
            </div>
            <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>

          {/* ✅ FIX 1: Mobile responsive grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

            {/* LEFT: صورة الفاتورة */}
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
                  // ✅ FIX 2: الصورة محدودة الحجم داخل الـ modal
                  <img src={invoiceImage} alt="فاتورة" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
                ) : (
                  <div>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
                    <div style={{ fontSize: 13, color: S.white, fontWeight: 600, marginBottom: 4 }}>صوّر أو ارفع الفاتورة</div>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 12 }}>الذكاء الاصطناعي سيستخرج البيانات تلقائياً</div>
                    <div style={{ padding: '7px 18px', background: S.gold3, border: `1px solid ${S.gold}`, borderRadius: 8, display: 'inline-block', fontSize: 12, color: S.gold, fontWeight: 700 }}>
                      اختر صورة
                    </div>
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
                  {/* ✅ FIX 2: زر عرض بدل حذف مباشر */}
                  <button
                    onClick={() => { /* handled by clicking image zone */ }}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}
                    // نفتح صورة في tab جديد
                    onClickCapture={() => window.open(invoiceImage, '_blank')}
                  >🔍 عرض الصورة</button>
                  <button
                    onClick={() => { setInvoiceImage(null); setItems([{ product_id: '', product_name: '', quantity: '', unit_price: '', unit_id: '', matched: false }]) }}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}
                  >🔄 إعادة المحاولة</button>
                </div>
              )}
            </div>

            {/* RIGHT: بيانات الفاتورة */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 4 }}>📋 بيانات الفاتورة</div>

              {/* المورد */}
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المورد</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select style={{ ...inp, flex: 1 }} value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}>
                    <option value="">اختر المورد</option>
                    {localSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button onClick={() => setShowAddSupplier(true)} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center' }}>+</button>
                </div>
              </div>

              {/* المستودع */}
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المستودع *</label>
                <select style={{ ...inp }} value={form.warehouse_id} onChange={e => setForm(p => ({ ...p, warehouse_id: e.target.value }))}>
                  <option value="">اختر المستودع</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              {/* ✅ FIX 5: رقمان منفصلان */}
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

          {/* ── الأصناف ── */}
          <div style={{ marginTop: 20, borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: S.gold, fontWeight: 700 }}>📦 أصناف الفاتورة</div>
              <button onClick={addItem} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>+ إضافة صنف</button>
            </div>

            {/* ✅ FIX 1: Mobile friendly items */}
            {items.map((item, i) => (
              <div key={i} style={{ background: S.card, borderRadius: 12, padding: '12px', marginBottom: 10 }}>
                {/* ✅ FIX 4: اسم الصنف يظهر واضح */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الصنف</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      style={{ ...inp, borderColor: item.matched ? S.green : 'rgba(255,255,255,0.10)' }}
                      value={item.product_id}
                      onChange={e => setItem(i, 'product_id', e.target.value)}
                    >
                      <option value="">{item.product_name ? `✓ ${item.product_name}` : 'اختر الصنف'}</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.name_en ? ` — ${p.name_en}` : ''}</option>)}
                    </select>
                    {item.matched && (
                      <div style={{ fontSize: 11, color: S.green, marginTop: 3, fontWeight: 600 }}>
                        ✓ {item.product_name}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
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
                    <select style={{ ...inp }} value={item.unit_id} onChange={e => setItem(i, 'unit_id', e.target.value)}>
                      <option value="">—</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', padding: '10px', fontSize: 14, alignSelf: 'flex-end' }}>✕</button>
                </div>
                {/* ✅ FIX 3: إجمالي الصنف بفواصل */}
                {item.quantity && item.unit_price && (
                  <div style={{ textAlign: 'left', marginTop: 6, fontSize: 12, color: S.gold, fontWeight: 600 }}>
                    = {formatMYR(parseFloat(item.quantity) * parseFloat(item.unit_price))}
                  </div>
                )}
              </div>
            ))}

            {/* Total */}
            <div style={{ background: S.navy3, borderRadius: 12, padding: '14px 18px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: S.muted, fontSize: 14 }}>إجمالي الفاتورة</span>
              {/* ✅ FIX 3: فواصل الأرقام */}
              <span style={{ color: S.gold, fontSize: 22, fontWeight: 800 }}>{formatMYR(total)}</span>
            </div>
          </div>

          {/* Actions */}
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
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </>
  )
}

// ══ الصفحة الرئيسية ══

// ══ Invoice Detail Modal ══
function InvoiceDetailModal({ invoice, onClose, onViewImage, onDeleted }: {
  invoice: any; onClose: () => void; onViewImage: (url: string) => void; onDeleted: () => void
}) {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.from('purchase_invoice_items')
      .select('*, products(name), units(name_ar)')
      .eq('invoice_id', invoice.id)
      .then(({ data }) => { setItems(data || []); setLoadingItems(false) })
  }, [invoice.id])

  async function handleDelete() {
    if (!confirm('حذف هذه الفاتورة نهائياً؟')) return
    setDeleting(true)
    await supabase.from('purchase_invoice_items').delete().eq('invoice_id', invoice.id)
    await supabase.from('stock_movements').delete().eq('invoice_id', invoice.id)
    await supabase.from('purchase_invoices').delete().eq('id', invoice.id)
    setDeleting(false)
    onDeleted()
  }

  const S2 = {
    navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
    gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
    white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
    green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
    red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
    blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
    card: 'rgba(255,255,255,0.04)',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: S2.navy2, borderRadius: 18, border: `1px solid ${S2.border}`, width: '100%', maxWidth: 560, padding: '24px 20px', margin: 'auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: S2.gold, fontSize: 17, fontWeight: 700, marginBottom: 2 }}>🧾 تفاصيل الفاتورة</h3>
            {invoice.invoice_number && <div style={{ fontSize: 12, color: S2.muted }}>رقم المورد: {invoice.invoice_number}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S2.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'المورد', value: invoice.warehouse_suppliers?.name || '—', icon: '🤝' },
            { label: 'المستودع', value: invoice.warehouses?.name || '—', icon: '🏭' },
            { label: 'التاريخ', value: invoice.invoice_date, icon: '📅' },
            { label: 'الإجمالي', value: `MYR ${Number(invoice.total_amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, icon: '💰', green: true },
          ].map((r, i) => (
            <div key={i} style={{ background: S2.card, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: S2.muted, marginBottom: 3 }}>{r.icon} {r.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: r.green ? S2.green : S2.white }}>{r.value}</div>
            </div>
          ))}
        </div>
        {invoice.notes && (
          <div style={{ background: S2.card, borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: S2.muted, marginBottom: 3 }}>📝 ملاحظات</div>
            <div style={{ fontSize: 13, color: S2.white }}>{invoice.notes}</div>
          </div>
        )}

        {/* Invoice Items */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S2.white, marginBottom: 10 }}>📦 أصناف الفاتورة</div>
          {loadingItems ? (
            <div style={{ textAlign: 'center', padding: 20, color: S2.muted, fontSize: 12 }}>⏳ جاري التحميل...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: S2.muted, fontSize: 12 }}>لا توجد أصناف مسجلة</div>
          ) : (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${S2.border}` }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: S2.navy3, padding: '8px 12px', gap: 8 }}>
                {['الصنف', 'الكمية', 'سعر الوحدة', 'الإجمالي'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: S2.muted, fontWeight: 700 }}>{h}</div>
                ))}
              </div>
              {items.map((item, i) => {
                const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 12px', gap: 8, borderTop: `1px solid ${S2.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: 12, color: S2.white, fontWeight: 600 }}>{item.products?.name || '—'}</div>
                    <div style={{ fontSize: 12, color: S2.muted }}>{item.quantity} {item.units?.name_ar || ''}</div>
                    <div style={{ fontSize: 12, color: S2.muted }}>{parseFloat(item.unit_price).toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: S2.gold, fontWeight: 600 }}>{total.toFixed(2)}</div>
                  </div>
                )
              })}
              {/* Total Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 12px', gap: 8, borderTop: `1px solid ${S2.border}`, background: S2.greenB }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S2.green, gridColumn: '1/4' }}>الإجمالي</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: S2.green }}>
                  {items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Image */}
        {invoice.image_url && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S2.gold, fontWeight: 700, marginBottom: 8 }}>📸 صورة الفاتورة</div>
            <img src={invoice.image_url} alt="فاتورة"
              style={{ width: '100%', maxHeight: 180, borderRadius: 10, cursor: 'pointer', border: `1px solid ${S2.border}`, objectFit: 'contain', background: S2.navy3 }}
              onClick={() => onViewImage(invoice.image_url)} />
            <button onClick={() => onViewImage(invoice.image_url)}
              style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${S2.blue}`, background: S2.blueB, color: S2.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
              🔍 عرض بالحجم الكامل
            </button>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={handleDelete} disabled={deleting}
            style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S2.red}`, background: S2.redB, color: S2.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>
            {deleting ? '⏳...' : '🗑️ حذف'}
          </button>
          <button onClick={onClose}
            style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${S2.muted}`, background: 'transparent', color: S2.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PurchasesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [units, setUnits] = useState<Unit[]>([])
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
    const [inv, prod, sup, un, wh] = await Promise.all([
      supabase.from('purchase_invoices').select('*, warehouse_suppliers(name), warehouses(name)').order('created_at', { ascending: false }),
      supabase.from('warehouse_products').select('*, units(symbol)').eq('is_active', true).order('name'),
      supabase.from('warehouse_suppliers').select('*').order('name'),
      supabase.from('units').select('*').order('name'),
      supabase.from('warehouses').select('id,name').eq('is_active', true),
    ])
    setInvoices(inv.data || [])
    setProducts(prod.data || [])
    setSuppliers(sup.data || [])
    setUnits(un.data || [])
    setWarehouses(wh.data || [])
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

      {/* ══ Header ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🛒 المشتريات</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة فواتير المشتريات مع مسح ذكي بالذكاء الاصطناعي</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✨ فاتورة جديدة بالذكاء الاصطناعي
        </button>
      </div>

      {/* ══ Stats ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'إجمالي الفواتير', value: invoices.length, icon: '🧾', color: S.blue, bg: S.blueB },
          { label: 'مشتريات هذا الشهر', value: monthInvoices.length, icon: '📅', color: S.green, bg: S.greenB },
          // ✅ FIX 3: فواصل الأرقام في الإحصائيات
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

      {/* ══ AI Banner ══ */}
      <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.08))', border: `1px solid rgba(139,92,246,0.25)`, borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 28 }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>مسح الفواتير بالذكاء الاصطناعي</div>
          <div style={{ fontSize: 12, color: S.muted }}>صوّر أي فاتورة ورقية وسيقوم الذكاء الاصطناعي باستخراج جميع البيانات تلقائياً</div>
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
          جرّب الآن ✨
        </button>
      </div>

      {/* ══ Filters ══ */}
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

      {/* ══ Invoices Table ══ */}
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
                    {/* ✅ FIX 5: رقم النظام التلقائي */}
                    <td style={{ padding: '14px 16px', color: S.purple, fontWeight: 800, fontSize: 14 }}>#{filtered.length - idx}</td>
                    {/* رقم فاتورة المورد */}
                    <td style={{ padding: '14px 16px', color: S.gold, fontWeight: 700, fontSize: 13 }}>{inv.invoice_number || <span style={{ color: S.muted, fontStyle: 'italic', fontSize: 11 }}>—</span>}</td>
                    <td style={{ padding: '14px 16px', color: S.white, fontSize: 13, fontWeight: 600 }}>{inv.warehouse_suppliers?.name || <span style={{ color: S.muted }}>—</span>}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: S.muted }}>{inv.invoice_date}</td>
                    {/* ✅ FIX 3: فواصل الأرقام */}
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: S.green, fontSize: 13 }}>{formatMYR(inv.total_amount)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {inv.image_url ? (
                        <img
                          src={inv.image_url} alt="فاتورة"
                          style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: `1px solid ${S.border}` }}
                          onClick={(e) => { e.stopPropagation(); setViewerImage(inv.image_url) }}
                        />
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

      {/* ══ Invoice Detail Modal ══ */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onViewImage={(url) => setViewerImage(url)}
          onDeleted={() => { setSelectedInvoice(null); fetchAll() }}
        />
      )}

      {/* ✅ FIX 2: Image Viewer منفصل */}
      {viewerImage && <ImageViewerModal imageUrl={viewerImage} onClose={() => setViewerImage(null)} />}

      {showNew && (
        <NewInvoiceModal
          products={products} suppliers={suppliers} units={units} warehouses={warehouses}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); fetchAll() }}
        />
      )}
    </div>
  )
}
