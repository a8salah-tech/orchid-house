'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const PAGE_SIZE = 20

type Supplier = {
  id: string; name: string; company?: string; category?: string
  email?: string; phone?: string; whatsapp?: string; address?: string
  payment_type: 'cash' | 'credit' | 'mixed'; credit_days: number
  total_purchases: number; outstanding_balance: number
  notes?: string; is_active: boolean; created_at: string
  invoice_count?: number; source?: 'main' | 'warehouse'
}

type Product = {
  id: string; name: string; name_en?: string; category: string
  last_purchase_price: number; current_stock: number
}

type Tab = 'suppliers' | 'order'

const PAYMENT_CFG = {
  cash:   { label: 'Cash',   color: S.green, bg: S.greenB },
  credit: { label: 'Credit', color: S.amber, bg: S.amberB },
  mixed:  { label: 'Mixed',  color: S.blue,  bg: S.blueB  },
}

const CATEGORIES = ['Meat & Poultry','Seafood','Vegetables & Fruits','Dairy & Eggs','Dry Goods','Beverages','Bakery','Spices & Condiments','Cleaning Supplies','Packaging','Other']

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,.04)', border: `1px solid rgba(255,255,255,0.08)`,
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FAFAF8',
  outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box',
}

// ══ Pagination ══
function Pagination({ page, total, totalPages, onChange }: {
  page: number; total: number; totalPages: number; onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to   = Math.min(page * PAGE_SIZE, total)
  const pages: (number | '...')[] = []
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i) }
  else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page-1); i <= Math.min(totalPages-1, page+1); i++) pages.push(i)
    if (page < totalPages-2) pages.push('...')
    pages.push(totalPages)
  }
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:24, flexWrap:'wrap', gap:10 }}>
      <div style={{ fontSize:12, color:S.muted }}>عرض {from}–{to} من {total}</div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        <button onClick={() => onChange(page-1)} disabled={page===1} style={{ padding:'7px 14px', borderRadius:10, border:`1px solid ${page===1?S.border:S.gold}`, background:page===1?'transparent':S.gold3, color:page===1?S.muted:S.gold, cursor:page===1?'not-allowed':'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif' }}>← السابق</button>
        {pages.map((p,i) => p==='...'
          ? <span key={`e${i}`} style={{ color:S.muted, padding:'7px 4px' }}>...</span>
          : <button key={p} onClick={() => onChange(p as number)} style={{ width:34, height:34, borderRadius:10, border:`1px solid ${p===page?S.gold:S.border}`, background:p===page?S.gold3:'transparent', color:p===page?S.gold:S.muted, cursor:'pointer', fontSize:12, fontWeight:p===page?800:400, fontFamily:'Tajawal, sans-serif' }}>{p}</button>
        )}
        <button onClick={() => onChange(page+1)} disabled={page===totalPages} style={{ padding:'7px 14px', borderRadius:10, border:`1px solid ${page===totalPages?S.border:S.gold}`, background:page===totalPages?'transparent':S.gold3, color:page===totalPages?S.muted:S.gold, cursor:page===totalPages?'not-allowed':'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif' }}>التالي →</button>
      </div>
    </div>
  )
}

// ══ Order Modal — موردو المنتج من product_suppliers ══
function OrderModal({ product, suppliers, onClose }: {
  product: Product; suppliers: Supplier[]; onClose: () => void
}) {
  const sb = createClient()
  const [selected, setSelected]               = useState<Supplier | null>(null)
  const [qty, setQty]                         = useState('1')
  const [notes, setNotes]                     = useState('')
  const [productSuppliers, setProductSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading]                 = useState(true)
  const [addingSupplier, setAddingSupplier]   = useState(false)
  const [searchSup, setSearchSup]             = useState('')

  // ✅ جيب موردي هذا المنتج من جدول product_suppliers
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await sb
        .from('product_suppliers')
        .select('supplier_id, is_primary')
        .eq('product_id', product.id)

      const ids = (data || []).map((r: any) => r.supplier_id)
      const matched = ids.length > 0
        ? suppliers.filter(s => ids.includes(s.id) && s.is_active)
        : []
      setProductSuppliers(matched)
      setLoading(false)
    }
    load()
  }, [product.id, suppliers])

  // ✅ إضافة مورد جديد لهذا المنتج
  async function linkSupplier(sup: Supplier) {
    await sb.from('product_suppliers').insert([{
      product_id: product.id,
      supplier_id: sup.id,
    }]).select()
    setProductSuppliers(p => [...p, sup])
    setAddingSupplier(false)
    setSearchSup('')
  }

  // ✅ إزالة مورد من المنتج
  async function unlinkSupplier(supId: string) {
    await sb.from('product_suppliers')
      .delete()
      .eq('product_id', product.id)
      .eq('supplier_id', supId)
    setProductSuppliers(p => p.filter(s => s.id !== supId))
    if (selected?.id === supId) setSelected(null)
  }

  // الموردون غير المرتبطين بعد
  const unlinked = suppliers.filter(s =>
    s.is_active &&
    !productSuppliers.find(ps => ps.id === s.id) &&
    (searchSup === '' || s.name.toLowerCase().includes(searchSup.toLowerCase()))
  )

  function buildWhatsAppMsg() {
    const price = product.last_purchase_price > 0
      ? `\nآخر سعر شراء: MYR ${product.last_purchase_price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : ''
    return encodeURIComponent(
      `مرحباً ${selected?.name || ''}،\n\n` +
      `نود طلب:\n` +
      `📦 المنتج: ${product.name}${product.name_en ? ` (${product.name_en})` : ''}\n` +
      `🔢 الكمية: ${qty}${price}\n` +
      (notes ? `📝 ملاحظات: ${notes}\n` : '') +
      `\nمن فضلك تأكد الطلب.\nشكراً 🙏`
    )
  }

  function buildEmailBody() {
    const price = product.last_purchase_price > 0
      ? `\nآخر سعر شراء: MYR ${product.last_purchase_price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : ''
    return encodeURIComponent(
      `مرحباً ${selected?.name || ''}،\n\n` +
      `المنتج: ${product.name}${product.name_en ? ` (${product.name_en})` : ''}\n` +
      `الكمية: ${qty}${price}\n` +
      (notes ? `ملاحظات: ${notes}\n` : '') +
      `\nمن فضلك تأكد الطلب.\nشكراً`
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ background:S.navy2, borderRadius:20, border:`1px solid ${S.gold}`, width:'100%', maxWidth:520, padding:'28px 24px', margin:'auto', boxShadow:`0 0 40px rgba(201,168,76,0.15)` }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ color:S.gold, fontSize:17, fontWeight:800, marginBottom:4 }}>📦 طلب من مورد</h2>
            <p style={{ fontSize:13, color:S.muted }}>{product.name}{product.name_en ? ` — ${product.name_en}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:S.muted, fontSize:22, cursor:'pointer' }}>✕</button>
        </div>

        {/* معلومات المنتج */}
        <div style={{ background:S.card, borderRadius:12, padding:'12px 16px', marginBottom:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <div style={{ fontSize:11, color:S.muted, marginBottom:3 }}>💰 آخر سعر شراء</div>
            <div style={{ fontSize:15, color:S.gold, fontWeight:800 }}>
              {product.last_purchase_price > 0 ? `MYR ${product.last_purchase_price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:S.muted, marginBottom:3 }}>📊 المخزون الحالي</div>
            <div style={{ fontSize:13, color:product.current_stock <= 5 ? S.red : S.green, fontWeight:700 }}>
              {product.current_stock} وحدة {product.current_stock <= 5 ? '⚠️' : ''}
            </div>
          </div>
        </div>

        {/* الكمية والملاحظات */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          <div>
            <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:6 }}>الكمية المطلوبة</label>
            <input style={{ ...inp, width:'100%', direction:'ltr', textAlign:'center', fontSize:16, fontWeight:700 }}
              type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:6 }}>ملاحظات</label>
            <input style={{ ...inp, width:'100%' }} placeholder="مواصفات خاصة..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* موردو المنتج */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <label style={{ fontSize:13, color:S.white, fontWeight:700 }}>
              موردو هذا المنتج
              {!loading && <span style={{ fontSize:11, color:S.muted, fontWeight:400, marginRight:6 }}>({productSuppliers.length})</span>}
            </label>
            <button
              onClick={() => setAddingSupplier(!addingSupplier)}
              style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${S.teal}`, background:S.tealB, color:S.teal, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif', fontWeight:700 }}
            >
              {addingSupplier ? '✕ إلغاء' : '+ ربط مورد'}
            </button>
          </div>

          {/* إضافة مورد جديد للمنتج */}
          {addingSupplier && (
            <div style={{ background:S.navy3, borderRadius:12, padding:12, marginBottom:12, border:`1px solid ${S.teal}30` }}>
              <input
                style={{ ...inp, width:'100%', marginBottom:8 }}
                placeholder="🔍 ابحث عن مورد..."
                value={searchSup}
                onChange={e => setSearchSup(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight:160, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {unlinked.length === 0 ? (
                  <div style={{ textAlign:'center', padding:12, color:S.muted, fontSize:13 }}>
                    {searchSup ? 'لا نتائج' : 'كل الموردون مرتبطون بالفعل'}
                  </div>
                ) : unlinked.map(s => (
                  <div key={s.id}
                    onClick={() => linkSupplier(s)}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', borderRadius:8, background:S.card, cursor:'pointer', border:`1px solid ${S.border}` }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = S.teal}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = S.border}
                  >
                    <div>
                      <div style={{ fontSize:13, color:S.white, fontWeight:600 }}>{s.name}</div>
                      {s.company && <div style={{ fontSize:11, color:S.muted }}>{s.company}</div>}
                    </div>
                    <span style={{ fontSize:12, color:S.teal, fontWeight:700 }}>+ ربط</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* قائمة الموردين المرتبطين */}
          {loading ? (
            <div style={{ textAlign:'center', padding:20, color:S.muted, fontSize:13 }}>⏳ جاري التحميل...</div>
          ) : productSuppliers.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:S.muted, fontSize:13, background:S.card, borderRadius:10 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🔗</div>
              لا يوجد موردون مرتبطون بهذا المنتج
              <div style={{ fontSize:12, marginTop:4 }}>اضغط "+ ربط مورد" لإضافة مورد</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:300, overflowY:'auto' }}>
              {productSuppliers.map(s => (
                <div key={s.id}
                  onClick={() => setSelected(selected?.id === s.id ? null : s)}
                  style={{
                    background: selected?.id === s.id ? 'rgba(201,168,76,0.12)' : S.card,
                    border: `1px solid ${selected?.id === s.id ? S.gold : S.border}`,
                    borderRadius:12, padding:'12px 14px', cursor:'pointer', transition:'all .15s',
                  }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:selected?.id===s.id?8:0 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:selected?.id===s.id?S.gold:S.white }}>
                        {selected?.id===s.id && '✓ '}{s.name}
                      </div>
                      {s.company && <div style={{ fontSize:11, color:S.muted }}>{s.company}</div>}
                      <div style={{ display:'flex', gap:12, marginTop:4, flexWrap:'wrap' }}>
                        {s.phone && <span style={{ fontSize:12, color:S.muted }}>📞 {s.phone}</span>}
                        {s.whatsapp && <span style={{ fontSize:12, color:S.green }}>📱 WhatsApp</span>}
                        {s.total_purchases > 0 && <span style={{ fontSize:12, color:S.gold }}>💰 MYR {s.total_purchases.toLocaleString('en-US',{maximumFractionDigits:0})}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <span style={{ background:PAYMENT_CFG[s.payment_type].bg, color:PAYMENT_CFG[s.payment_type].color, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                        {PAYMENT_CFG[s.payment_type].label}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); unlinkSupplier(s.id) }}
                        style={{ background:S.redB, border:`1px solid ${S.red}30`, borderRadius:6, color:S.red, cursor:'pointer', padding:'3px 7px', fontSize:11, fontFamily:'Tajawal, sans-serif' }}
                        title="إزالة الربط"
                      >✕</button>
                    </div>
                  </div>

                  {/* أزرار التواصل عند الاختيار */}
                  {selected?.id === s.id && (
                    <div style={{ display:'flex', gap:8 }} onClick={e => e.stopPropagation()}>
                      {s.whatsapp && (
                        <a href={`https://wa.me/${s.whatsapp.replace(/\D/g,'')}?text=${buildWhatsAppMsg()}`}
                          target="_blank" rel="noreferrer"
                          style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${S.green}`, background:S.greenB, color:S.green, cursor:'pointer', fontSize:13, fontWeight:700, textDecoration:'none', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                          📱 واتساب
                        </a>
                      )}
                      {s.email && (
                        <a href={`mailto:${s.email}?subject=طلب ${product.name}&body=${buildEmailBody()}`}
                          style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${S.blue}`, background:S.blueB, color:S.blue, cursor:'pointer', fontSize:13, fontWeight:700, textDecoration:'none', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                          📧 إيميل
                        </a>
                      )}
                      {s.phone && (
                        <a href={`tel:${s.phone}`}
                          style={{ padding:'10px 14px', borderRadius:10, border:`1px solid ${S.purple}`, background:S.purpleB, color:S.purple, cursor:'pointer', fontSize:13, fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          📞
                        </a>
                      )}
                      {!s.whatsapp && !s.email && !s.phone && (
                        <div style={{ flex:1, padding:'10px', borderRadius:10, background:S.card, color:S.muted, fontSize:12, textAlign:'center' }}>
                          لا توجد وسيلة تواصل مسجلة
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={onClose} style={{ width:'100%', padding:'12px', borderRadius:12, border:`1px solid ${S.muted}`, background:'transparent', color:S.muted, cursor:'pointer', fontSize:13, fontFamily:'Tajawal, sans-serif' }}>
          إغلاق
        </button>
      </div>
    </div>
  )
}

// ══ Order Tab ══
function OrderTab({ suppliers }: { suppliers: Supplier[] }) {
  const sb = createClient()
  const [products, setProducts]             = useState<Product[]>([])
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [catFilter, setCatFilter]           = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [page, setPage]                     = useState(1)
  // ✅ منتجات لها موردون فقط
  const [linkedIds, setLinkedIds]           = useState<Set<string>>(new Set())
  const [showOnlyLinked, setShowOnlyLinked] = useState(false)

  useEffect(() => {
    Promise.all([
      sb.from('warehouse_products').select('id,name,name_en,category,last_purchase_price,current_stock').eq('is_active',true).order('name'),
      sb.from('product_suppliers').select('product_id'),
    ]).then(([{ data: prods }, { data: links }]) => {
      setProducts(prods || [])
      setLinkedIds(new Set((links||[]).map((l:any)=>l.product_id)))
      setLoading(false)
    })
  }, [])

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]

  const filtered = products.filter(p => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.name_en||'').toLowerCase().includes(q)
    const matchCat    = !catFilter || p.category === catFilter
    const matchLinked = !showOnlyLinked || linkedIds.has(p.id)
    return matchSearch && matchCat && matchLinked
  })

  useEffect(() => { setPage(1) }, [search, catFilter, showOnlyLinked])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  return (
    <div>
      {selectedProduct && (
        <OrderModal
          product={selectedProduct}
          suppliers={suppliers}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      <div style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:20, fontSize:13, color:S.muted }}>
        💡 اضغط على أي منتج لمعرفة موردينه وإرسال طلب مباشر — يمكنك ربط موردين جدد من داخل الطلب
      </div>

      {/* فلاتر */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input style={{ ...inp, flex:1, minWidth:180 }}
          placeholder="🔍 ابحث عن منتج..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...inp, width:'auto', minWidth:150, cursor:'pointer' }}
          value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">كل التصنيفات</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setShowOnlyLinked(!showOnlyLinked)}
          style={{ padding:'10px 14px', borderRadius:10, border:`1px solid ${showOnlyLinked?S.gold:S.border}`, background:showOnlyLinked?S.gold3:'transparent', color:showOnlyLinked?S.gold:S.muted, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif', fontWeight:showOnlyLinked?700:400, whiteSpace:'nowrap' }}
        >
          🔗 {showOnlyLinked ? 'لها موردون' : 'كل المنتجات'}
        </button>
        <div style={{ fontSize:12, color:S.muted, display:'flex', alignItems:'center' }}>
          {filtered.length} منتج
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:S.muted }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📦</div>
          <div>لا توجد منتجات</div>
        </div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
            {paginated.map(p => {
              const hasSuppliers = linkedIds.has(p.id)
              return (
                <div key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  style={{
                    background:S.navy2, borderRadius:14,
                    border:`1px solid ${hasSuppliers ? 'rgba(201,168,76,0.3)' : S.border}`,
                    padding:'14px 16px', cursor:'pointer', transition:'all .15s', position:'relative',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.borderColor=S.gold }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform='translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor=hasSuppliers?'rgba(201,168,76,0.3)':S.border }}
                >
                  {/* شارة لو عنده موردون */}
                  {hasSuppliers && (
                    <div style={{ position:'absolute', top:10, left:10, background:S.gold3, border:`1px solid rgba(201,168,76,0.4)`, borderRadius:6, padding:'2px 7px', fontSize:10, color:S.gold, fontWeight:700 }}>
                      🔗 مورد
                    </div>
                  )}

                  <div style={{ marginBottom:10, paddingLeft: hasSuppliers ? 46 : 0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:S.white, marginBottom:2 }}>{p.name}</div>
                    {p.name_en && <div style={{ fontSize:11, color:S.muted }}>{p.name_en}</div>}
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div style={{ background:S.card, borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, color:S.muted, marginBottom:2 }}>آخر سعر</div>
                      <div style={{ fontSize:14, fontWeight:800, color:S.gold }}>
                        {p.last_purchase_price > 0 ? `MYR ${p.last_purchase_price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </div>
                    </div>
                    <div style={{ background:p.current_stock <= 5 ? S.redB : S.card, borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, color:S.muted, marginBottom:2 }}>المخزون</div>
                      <div style={{ fontSize:14, fontWeight:800, color:p.current_stock <= 5 ? S.red : S.green }}>
                        {p.current_stock} {p.current_stock <= 5 ? '⚠️' : ''}
                      </div>
                    </div>
                  </div>

                  {p.category && (
                    <div style={{ marginTop:8, fontSize:11, color:S.muted, background:S.card, borderRadius:6, padding:'3px 8px', display:'inline-block' }}>
                      {p.category}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <Pagination page={page} total={filtered.length} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}

// ══ Supplier Modal ══
function SupplierModal({ supplier, onClose, onSaved }: {
  supplier?: Supplier | null; onClose: () => void; onSaved: () => void
}) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: supplier?.name||'', company: supplier?.company||'',
    category: supplier?.category||'', email: supplier?.email||'',
    phone: supplier?.phone||'', whatsapp: supplier?.whatsapp||'',
    address: supplier?.address||'', payment_type: supplier?.payment_type||'cash',
    credit_days: supplier?.credit_days?.toString()||'0',
    outstanding_balance: supplier?.outstanding_balance?.toString()||'0',
    notes: supplier?.notes||'', is_active: supplier?.is_active!==false,
  })

  async function save() {
    if (!form.name.trim()) { alert('Supplier name is required'); return }
    setSaving(true)
    const payload: any = {
      name:form.name, company:form.company||null, category:form.category||null,
      email:form.email||null, phone:form.phone||null, whatsapp:form.whatsapp||null,
      address:form.address||null, payment_type:form.payment_type,
      credit_days:parseInt(form.credit_days)||0,
      outstanding_balance:parseFloat(form.outstanding_balance)||0,
      notes:form.notes||null, is_active:form.is_active,
    }
    let error
    if (supplier) ({ error } = await sb.from('suppliers').update(payload).eq('id',supplier.id))
    else          ({ error } = await sb.from('suppliers').insert([payload]))
    setSaving(false)
    if (error) { alert('Error: '+error.message); return }
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ background:S.navy2, borderRadius:20, border:`1px solid ${S.border}`, width:'100%', maxWidth:560, padding:'28px 24px', margin:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ color:S.white, fontSize:17, fontWeight:800 }}>{supplier?'✏️ Edit Supplier':'➕ Add Supplier'}</h2>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>Contact Name *</label><input style={{ ...inp, width:'100%' }} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
            <div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>Company</label><input style={{ ...inp, width:'100%' }} value={form.company} onChange={e=>setForm(p=>({...p,company:e.target.value}))} /></div>
          </div>
          <div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>Category</label>
            <select style={{ ...inp, width:'100%', cursor:'pointer' }} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
              <option value="">Select...</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>📧 Email</label><input type="email" style={{ ...inp, width:'100%' }} value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} /></div>
            <div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>📞 Phone</label><input style={{ ...inp, width:'100%' }} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} /></div>
          </div>
          <div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>📱 WhatsApp</label><input style={{ ...inp, width:'100%' }} value={form.whatsapp} onChange={e=>setForm(p=>({...p,whatsapp:e.target.value}))} /></div>
          <div>
            <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:8 }}>Payment Type</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {(Object.entries(PAYMENT_CFG) as any[]).map(([k,cfg]:any)=>(
                <button key={k} onClick={()=>setForm(p=>({...p,payment_type:k}))} style={{ padding:'10px', borderRadius:10, border:`1px solid ${form.payment_type===k?cfg.color:S.border}`, background:form.payment_type===k?cfg.bg:'transparent', color:form.payment_type===k?cfg.color:S.muted, cursor:'pointer', fontSize:13, fontFamily:'Tajawal, sans-serif', fontWeight:form.payment_type===k?700:400 }}>{cfg.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {form.payment_type!=='cash'&&<div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>Credit Days</label><input type="number" style={{ ...inp, width:'100%' }} value={form.credit_days} onChange={e=>setForm(p=>({...p,credit_days:e.target.value}))} /></div>}
            <div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>Outstanding (MYR)</label><input type="number" style={{ ...inp, width:'100%' }} value={form.outstanding_balance} onChange={e=>setForm(p=>({...p,outstanding_balance:e.target.value}))} /></div>
          </div>
          <div><label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>Notes</label><textarea style={{ ...inp, width:'100%', minHeight:60, resize:'vertical' } as React.CSSProperties} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} /></div>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', background:S.card, borderRadius:10, padding:'10px 14px' }}>
            <input type="checkbox" checked={form.is_active} onChange={e=>setForm(p=>({...p,is_active:e.target.checked}))} style={{ accentColor:S.green, width:16, height:16 }} />
            <div><div style={{ fontSize:13, color:S.white, fontWeight:600 }}>Active Supplier</div><div style={{ fontSize:11, color:S.muted }}>Currently supplying</div></div>
          </label>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ padding:'11px 20px', borderRadius:10, border:`1px solid ${S.muted}`, background:'transparent', color:S.muted, cursor:'pointer', fontFamily:'Tajawal, sans-serif' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:1, padding:'11px', borderRadius:10, border:`1px solid ${S.gold}`, background:S.gold3, color:S.gold, cursor:'pointer', fontSize:14, fontFamily:'Tajawal, sans-serif', fontWeight:700 }}>
            {saving?'⏳...':supplier?'💾 Save':'✅ Add Supplier'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Supplier Detail ══
function SupplierDetail({ supplier, onClose, onEdit }: {
  supplier: Supplier; onClose: () => void; onEdit: () => void
}) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    sb.from('purchase_invoices').select('id,invoice_number,invoice_date,total_amount,status')
      .eq('supplier_id',supplier.id).order('invoice_date',{ascending:false})
      .then(({data})=>setInvoices(data||[]))
  }, [supplier.id])

  const cfg = PAYMENT_CFG[supplier.payment_type]
  const totalAmount = invoices.filter(i=>i.status!=='cancelled').reduce((s,i)=>s+parseFloat(i.total_amount||0),0)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ background:S.navy2, borderRadius:20, border:`1px solid ${S.border}`, width:'100%', maxWidth:620, padding:'24px 20px', margin:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ color:S.white, fontSize:18, fontWeight:800 }}>🤝 {supplier.name}</h2>
            {supplier.company&&<div style={{ fontSize:13, color:S.muted }}>{supplier.company}</div>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onEdit} style={{ padding:'8px 14px', borderRadius:10, border:`1px solid ${S.gold}`, background:S.gold3, color:S.gold, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif', fontWeight:700 }}>✏️ Edit</button>
            <button onClick={onClose} style={{ background:'transparent', border:'none', color:S.muted, fontSize:22, cursor:'pointer' }}>✕</button>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          <div style={{ background:S.greenB, borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:11, color:S.muted, marginBottom:3 }}>💰 Total</div>
            <div style={{ fontSize:16, fontWeight:800, color:S.green }}>MYR {totalAmount.toFixed(0)}</div>
          </div>
          <div style={{ background:supplier.outstanding_balance>0?S.redB:S.greenB, borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:11, color:S.muted, marginBottom:3 }}>⚖️ Outstanding</div>
            <div style={{ fontSize:16, fontWeight:800, color:supplier.outstanding_balance>0?S.red:S.green }}>MYR {supplier.outstanding_balance.toFixed(0)}</div>
          </div>
          <div style={{ background:cfg.bg, borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:11, color:S.muted, marginBottom:3 }}>💳 Payment</div>
            <div style={{ fontSize:16, fontWeight:800, color:cfg.color }}>{cfg.label}</div>
          </div>
        </div>
        <div style={{ background:S.card, borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
          {[
            {icon:'📧',label:'Email',  value:supplier.email,    link:supplier.email?`mailto:${supplier.email}`:null},
            {icon:'📞',label:'Phone',  value:supplier.phone,    link:supplier.phone?`tel:${supplier.phone}`:null},
            {icon:'📱',label:'WhatsApp',value:supplier.whatsapp,link:supplier.whatsapp?`https://wa.me/${supplier.whatsapp.replace(/\D/g,'')}`:null},
            {icon:'📝',label:'Notes',  value:supplier.notes},
          ].filter(r=>r.value).map((r,i)=>(
            <div key={i} style={{ display:'flex', gap:10, padding:'7px 0', borderBottom:`1px solid ${S.border}`, fontSize:13, alignItems:'center' }}>
              <span>{r.icon}</span>
              <span style={{ color:S.muted, minWidth:80 }}>{r.label}</span>
              {(r as any).link
                ?<a href={(r as any).link} target="_blank" rel="noreferrer" style={{ color:S.blue, textDecoration:'none', fontWeight:600 }}>{r.value}</a>
                :<span style={{ color:S.white }}>{r.value}</span>}
            </div>
          ))}
        </div>
        {invoices.length>0&&(
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:S.white, marginBottom:10 }}>📄 Recent Invoices</div>
            <div style={{ background:S.navy3, borderRadius:12, overflow:'hidden', border:`1px solid ${S.border}` }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Invoice #','Date','Amount','Status'].map(h=><th key={h} style={{ padding:'8px 12px', fontSize:11, color:S.muted, fontWeight:700, borderBottom:`1px solid ${S.border}`, textAlign:'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {invoices.slice(0,5).map(inv=>(
                    <tr key={inv.id} style={{ borderBottom:`1px solid ${S.border}` }}>
                      <td style={{ padding:'8px 12px', fontSize:12, color:S.gold }}>{inv.invoice_number||'—'}</td>
                      <td style={{ padding:'8px 12px', fontSize:12, color:S.white }}>{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                      <td style={{ padding:'8px 12px', fontSize:12, color:S.white, fontWeight:700 }}>MYR {parseFloat(inv.total_amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding:'8px 12px' }}><span style={{ background:inv.status==='cancelled'?S.redB:S.greenB, color:inv.status==='cancelled'?S.red:S.green, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══ Main Page ══
export default function SuppliersPage() {
  const sbRef = useRef(createClient())
  const sb    = sbRef.current
  const [tab, setTab]                       = useState<Tab>('suppliers')
  const [suppliers, setSuppliers]           = useState<Supplier[]>([])
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [filter, setFilter]                 = useState<'all'|'active'|'inactive'>('active')
  const [catFilter, setCatFilter]           = useState('')
  const [page, setPage]                     = useState(1)
  const [showAdd, setShowAdd]               = useState(false)
  const [editSupplier, setEditSupplier]     = useState<Supplier|null>(null)
  const [viewSupplier, setViewSupplier]     = useState<Supplier|null>(null)

  const fetchSuppliers = useCallback(async () => {
    const [{ data:mainS }, { data:warehouseS }, { data:invoices }] = await Promise.all([
      sb.from('suppliers').select('*').order('name'),
      sb.from('warehouse_suppliers').select('*').order('name'),
      sb.from('purchase_invoices').select('supplier_id,total_amount,status').neq('status','cancelled'),
    ])
    const invMap: Record<string,{total:number;count:number}> = {}
    ;(invoices||[]).forEach((inv:any) => {
      if (inv.supplier_id) {
        if (!invMap[inv.supplier_id]) invMap[inv.supplier_id]={total:0,count:0}
        invMap[inv.supplier_id].total+=parseFloat(inv.total_amount)||0
        invMap[inv.supplier_id].count+=1
      }
    })
    const wSuppliers: Supplier[] = (warehouseS||[]).map((ws:any)=>({
      id:ws.id, name:ws.name, company:undefined, category:'مورد مستودع',
      email:undefined, phone:ws.phone||undefined, whatsapp:undefined, address:undefined,
      payment_type:'cash' as const, credit_days:0,
      total_purchases:invMap[ws.id]?.total||0, outstanding_balance:0,
      notes:undefined, is_active:ws.is_active!==false, created_at:ws.created_at,
      invoice_count:invMap[ws.id]?.count||0, source:'warehouse' as const,
    }))
    const mainNames = new Set((mainS||[]).map((s:any)=>s.name.toLowerCase()))
    const combined = [
      ...(mainS||[]).map((s:any)=>({...s,invoice_count:invMap[s.id]?.count||0,source:'main' as const})),
      ...wSuppliers.filter(ws=>!mainNames.has(ws.name.toLowerCase())),
    ].sort((a,b)=>a.name.localeCompare(b.name))
    setSuppliers(combined)
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q||s.name.toLowerCase().includes(q)||(s.company||'').toLowerCase().includes(q)||(s.phone||'').includes(q)
    const matchFilter = filter==='all'||(filter==='active'?s.is_active:!s.is_active)
    const matchCat    = !catFilter||s.category===catFilter
    return matchSearch&&matchFilter&&matchCat
  })

  useEffect(() => { setPage(1) }, [search, filter, catFilter])

  const totalPages = Math.ceil(filtered.length/PAGE_SIZE)
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const stats = {
    total:suppliers.filter(s=>s.is_active).length,
    totalPurchases:suppliers.reduce((s,sup)=>s+sup.total_purchases,0),
    totalOutstanding:suppliers.reduce((s,sup)=>s+sup.outstanding_balance,0),
  }

  function exportCSV() {
    // ✅ رقم عادي بدون فواصل آلاف هنا (مش عرض) - القيمة بتتحط في خلية CSV وأي فاصلة جواها هتكسر ترقيم الأعمدة
    const rows=[['Name','Company','Category','Phone','WhatsApp','Email','Payment','Total Purchases','Outstanding','Status'],...suppliers.map(s=>[s.name,s.company||'',s.category||'',s.phone||'',s.whatsapp||'',s.email||'',s.payment_type,s.total_purchases.toFixed(2),s.outstanding_balance.toFixed(2),s.is_active?'Active':'Inactive'])]
    const csv=rows.map(r=>r.join(',')).join('\n')
    const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='suppliers.csv';a.click()
  }

  return (
    <div style={{ fontFamily:'Tajawal, sans-serif', color:S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}*{box-sizing:border-box}@media(max-width:640px){.sup-grid{grid-template-columns:1fr!important}.stat-grid{grid-template-columns:1fr 1fr!important}}`}</style>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>🤝 الموردون</h1>
          <p style={{ fontSize:13, color:S.muted }}>إدارة الموردين وإرسال طلبات الشراء</p>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={exportCSV} style={{ padding:'10px 16px', borderRadius:12, border:`1px solid ${S.blue}`, background:S.blueB, color:S.blue, cursor:'pointer', fontSize:13, fontFamily:'Tajawal, sans-serif', fontWeight:700 }}>📥 Export</button>
          <button onClick={() => setShowAdd(true)} style={{ padding:'10px 20px', borderRadius:12, border:`1px solid ${S.green}`, background:S.greenB, color:S.green, cursor:'pointer', fontSize:13, fontFamily:'Tajawal, sans-serif', fontWeight:700 }}>➕ مورد جديد</button>
        </div>
      </div>

      <div className="stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
        {[
          {label:'الموردون النشطون', value:stats.total, color:S.white, icon:'🤝'},
          {label:'إجمالي المشتريات', value:`MYR ${stats.totalPurchases.toLocaleString('en-US',{maximumFractionDigits:0})}`, color:S.green, icon:'💰'},
          {label:'المستحق', value:`MYR ${stats.totalOutstanding.toLocaleString('en-US',{maximumFractionDigits:0})}`, color:stats.totalOutstanding>0?S.red:S.green, icon:'⚖️'},
        ].map((s,i)=>(
          <div key={i} style={{ background:S.card2, borderRadius:14, border:`1px solid ${S.border}`, padding:'14px 16px' }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:18, fontWeight:800, color:s.color, marginBottom:4 }}>{s.value}</div>
            <div style={{ fontSize:11, color:S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.04)', borderRadius:12, padding:4, marginBottom:24 }}>
        {([['suppliers','🤝 الموردون'],['order','📦 طلب من مورد']] as [Tab,string][]).map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontSize:14, fontFamily:'Tajawal, sans-serif', fontWeight:tab===t?800:400, background:tab===t?S.gold3:'transparent', color:tab===t?S.gold:S.muted, transition:'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {tab==='order' ? (
        <OrderTab suppliers={suppliers} />
      ) : (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
            <input style={{ ...inp, flex:1, minWidth:200 }} placeholder="🔍 Search supplier..." value={search} onChange={e=>setSearch(e.target.value)} />
            <select style={{ ...inp, width:'auto', minWidth:160, cursor:'pointer' }} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
              <option value="">All Categories</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display:'flex', background:S.navy3, borderRadius:10, padding:4, gap:4 }}>
              {(['all','active','inactive'] as const).map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 12px', borderRadius:8, border:'none', background:filter===f?S.gold3:'transparent', color:filter===f?S.gold:S.muted, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif', fontWeight:filter===f?700:400, textTransform:'capitalize' }}>{f}</button>
              ))}
            </div>
            <div style={{ fontSize:12, color:S.muted, display:'flex', alignItems:'center' }}>{filtered.length} مورد</div>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:S.muted }}>⏳ Loading...</div>
          ) : filtered.length===0 ? (
            <div style={{ textAlign:'center', padding:60, color:S.muted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🤝</div>
              <div>No suppliers found</div>
              <button onClick={()=>setShowAdd(true)} style={{ marginTop:16, padding:'10px 20px', borderRadius:10, border:`1px solid ${S.green}`, background:S.greenB, color:S.green, cursor:'pointer', fontSize:13, fontFamily:'Tajawal, sans-serif', fontWeight:700 }}>➕ Add Supplier</button>
            </div>
          ) : (
            <>
              <div className="sup-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
                {paginated.map(s=>{
                  const cfg=PAYMENT_CFG[s.payment_type]
                  return (
                    <div key={s.id}
                      style={{ background:S.navy2, borderRadius:16, border:`1px solid ${s.is_active?S.border:S.red+'30'}`, overflow:'hidden', cursor:'pointer', opacity:s.is_active?1:0.7, transition:'all .15s' }}
                      onClick={()=>setViewSupplier(s)}
                      onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLDivElement).style.boxShadow='0 8px 24px rgba(0,0,0,0.3)'}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateY(0)';(e.currentTarget as HTMLDivElement).style.boxShadow='none'}}
                    >
                      <div style={{ padding:'16px 18px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:15, fontWeight:800, color:S.white, marginBottom:2 }}>{s.name}</div>
                            {s.company&&<div style={{ fontSize:12, color:S.muted }}>{s.company}</div>}
                            <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                              {s.category&&<div style={{ background:S.navy3, borderRadius:20, padding:'2px 10px', fontSize:11, color:S.muted }}>{s.category}</div>}
                              {(s.invoice_count||0)>0&&<div style={{ background:S.blueB, borderRadius:20, padding:'2px 10px', fontSize:11, color:S.blue }}>{s.invoice_count} فاتورة</div>}
                            </div>
                          </div>
                          <span style={{ background:cfg.bg, color:cfg.color, borderRadius:20, padding:'4px 10px', fontSize:11, fontWeight:700, flexShrink:0 }}>{cfg.label}</span>
                        </div>
                        {(s.phone||s.whatsapp)&&(
                          <div style={{ display:'flex', gap:12, marginBottom:10 }}>
                            {s.phone&&<div style={{ fontSize:12, color:S.muted }}>📞 {s.phone}</div>}
                            {s.whatsapp&&<div style={{ fontSize:12, color:S.green }}>📱 WhatsApp</div>}
                          </div>
                        )}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                          <div style={{ background:S.card, borderRadius:10, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:S.muted, marginBottom:3 }}>Total Purchases</div>
                            <div style={{ fontSize:14, fontWeight:700, color:S.gold }}>MYR {s.total_purchases.toLocaleString('en-US',{maximumFractionDigits:0})}</div>
                          </div>
                          <div style={{ background:s.outstanding_balance>0?S.redB:S.card, borderRadius:10, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:S.muted, marginBottom:3 }}>Outstanding</div>
                            <div style={{ fontSize:14, fontWeight:700, color:s.outstanding_balance>0?S.red:S.green }}>
                              {s.outstanding_balance>0?`MYR ${s.outstanding_balance.toLocaleString('en-US',{maximumFractionDigits:0})}`:'✅ Clear'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8 }} onClick={e=>e.stopPropagation()}>
                          {s.whatsapp&&<a href={`https://wa.me/${s.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${S.green}`, background:S.greenB, color:S.green, cursor:'pointer', fontSize:12, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>📱 Chat</a>}
                          {s.phone&&<a href={`tel:${s.phone}`} style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${S.blue}`, background:S.blueB, color:S.blue, cursor:'pointer', fontSize:12, textDecoration:'none' }}>📞 Call</a>}
                          <button onClick={()=>setEditSupplier(s)} style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${S.gold}`, background:S.gold3, color:S.gold, cursor:'pointer', fontSize:12, marginLeft:'auto' }}>✏️ Edit</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Pagination page={page} total={filtered.length} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </>
      )}

      {(showAdd||editSupplier)&&<SupplierModal supplier={editSupplier} onClose={()=>{setShowAdd(false);setEditSupplier(null)}} onSaved={()=>{setShowAdd(false);setEditSupplier(null);fetchSuppliers()}} />}
      {viewSupplier&&<SupplierDetail supplier={viewSupplier} onClose={()=>setViewSupplier(null)} onEdit={()=>{setEditSupplier(viewSupplier);setViewSupplier(null)}} />}
    </div>
  )
}
