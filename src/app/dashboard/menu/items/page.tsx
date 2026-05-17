'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
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

const PAGE_SIZE = 20
const TOP_6_NAMES = ['شيش طاووق','كباب دجاج','مندي دجاج','شاورما مع الرز','كبسة دجاج','وجبة شاورما']

// ══ Pagination Component ══
function Pagination({ page, total, totalPages, onChange }: {
  page: number; total: number; totalPages: number; onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, flexWrap: 'wrap', gap: 12 }}>
      <div style={{ fontSize: 12, color: S.muted }}>عرض {from}–{to} من {total} صنف</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${page === 1 ? S.border : S.gold}`, background: page === 1 ? 'transparent' : S.gold3, color: page === 1 ? S.muted : S.gold, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          ← السابق
        </button>
        {getPages().map((p, i) => (
          p === '...' ? <span key={`e${i}`} style={{ color: S.muted }}>...</span>
          : <button key={p} onClick={() => onChange(p as number)}
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${p === page ? S.gold : S.border}`, background: p === page ? S.gold3 : 'transparent', color: p === page ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 800 : 400, fontFamily: 'Tajawal, sans-serif' }}>
              {p}
            </button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${page === totalPages ? S.border : S.gold}`, background: page === totalPages ? 'transparent' : S.gold3, color: page === totalPages ? S.muted : S.gold, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          التالي →
        </button>
      </div>
    </div>
  )
}


interface Category {
  id: string; name: string; name_en: string; icon: string
  sort_order: number; is_active: boolean; item_count?: number
}

interface MenuItem {
  id: string; category_id: string; name: string; name_en: string
  or_code: string; description: string; description_en: string
  price: number; cost_price: number; image_url?: string
  is_active: boolean; is_available: boolean; sort_order: number
  menu_categories?: { name: string; name_en: string; icon: string } | any}

// ══ Image Upload Helper ══
function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result as string)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

// ══ Add/Edit Item Modal ══
function ItemModal({ item, categories, onClose, onSaved }: {
  item?: MenuItem | null; categories: Category[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>(item?.image_url || '')
  const [form, setForm] = useState({
    category_id: item?.category_id || '',
    name: item?.name || '',
    name_en: item?.name_en || '',
    or_code: item?.or_code || '',
    description: item?.description || '',
    description_en: item?.description_en || '',
    price: item?.price?.toString() || '',
    cost_price: item?.cost_price?.toString() || '',
    is_active: item?.is_active !== false,
    is_available: item?.is_available !== false,
  })

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const b64 = await toBase64(file)
    setImagePreview(b64)
  }

  async function save() {
    if (!form.name || !form.category_id) { alert('يرجى إدخال الاسم والقسم'); return }
    setSaving(true)
    const payload = {
      ...form,
      price: parseFloat(form.price) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      image_url: imagePreview || null,
    }
    let error
    if (item) {
      ({ error } = await supabase.from('menu_items').update(payload).eq('id', item.id))
    } else {
      ({ error } = await supabase.from('menu_items').insert([payload]))
    }
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  const margin = form.price && form.cost_price
    ? (((parseFloat(form.price) - parseFloat(form.cost_price)) / parseFloat(form.price)) * 100).toFixed(1)
    : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 780, padding: 32, margin: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {item ? '✏️ تعديل الصنف' : '➕ إضافة صنف جديد'}
            </h2>
            <p style={{ fontSize: 12, color: S.muted }}>أدخل تفاصيل الصنف والسعر والصورة</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>

          {/* LEFT: الصورة */}
          <div>
            <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 12 }}>📸 صورة الصنف</div>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${imagePreview ? S.green : S.border}`,
                borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                background: imagePreview ? 'transparent' : S.card,
                aspectRatio: '1', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'all .2s', marginBottom: 12,
              }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="صورة الصنف" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
                  <div style={{ fontSize: 12, color: S.muted }}>اضغط لرفع صورة</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
            {imagePreview && (
              <button onClick={() => setImagePreview('')} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                🗑️ حذف الصورة
              </button>
            )}

            {/* Margin Preview */}
            {margin && (
              <div style={{ background: parseFloat(margin) > 60 ? S.greenB : parseFloat(margin) > 40 ? S.amberB : S.redB, border: `1px solid ${parseFloat(margin) > 60 ? S.green : parseFloat(margin) > 40 ? S.amber : S.red}`, borderRadius: 12, padding: '14px 16px', marginTop: 14 }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>هامش الربح</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: parseFloat(margin) > 60 ? S.green : parseFloat(margin) > 40 ? S.amber : S.red }}>{margin}%</div>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                  ربح: {formatMYR(parseFloat(form.price) - parseFloat(form.cost_price))} لكل صنف
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: التفاصيل */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* القسم */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>القسم *</label>
              <select style={{ ...inp }} value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                <option value="">اختر القسم</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name} — {c.name_en}</option>)}
              </select>
            </div>

            {/* الأسماء */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>اسم الصنف (عربي) *</label>
                <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: شوربة عدس" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Item Name (English)</label>
                <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Lentil Soup" />
              </div>
            </div>

            {/* OR Code */}
{item?.or_code && (
  <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
    <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>رقم الصنف</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: S.gold }}>{item.or_code}</div>
  </div>
)}

            {/* الأسعار */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>سعر البيع (MYR) *</label>
                <input style={inp} type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>سعر التكلفة (MYR)</label>
                <input style={inp} type="number" step="0.01" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))} placeholder="0.00" />
              </div>
            </div>

            {/* الوصف */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الوصف (عربي)</label>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف مختصر للصنف..." />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Description (English)</label>
              <textarea style={{ ...inp, direction: 'ltr', textAlign: 'left', minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={form.description_en} onChange={e => setForm(p => ({ ...p, description_en: e.target.value }))} placeholder="Brief description..." />
            </div>

            {/* الحالة */}
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: S.gold, width: 16, height: 16 }} />
                <div>
                  <div style={{ fontSize: 12, color: S.white, fontWeight: 600 }}>نشط</div>
                  <div style={{ fontSize: 10, color: S.muted }}>يظهر في النظام</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
                <input type="checkbox" checked={form.is_available} onChange={e => setForm(p => ({ ...p, is_available: e.target.checked }))} style={{ accentColor: S.green, width: 16, height: 16 }} />
                <div>
                  <div style={{ fontSize: 12, color: S.white, fontWeight: 600 }}>متاح</div>
                  <div style={{ fontSize: 10, color: S.muted }}>متوفر للطلب</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الحفظ...' : item ? '💾 حفظ التعديلات' : '✅ إضافة الصنف'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Add Category Modal ══
function AddCategoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', name_en: '', icon: '🍽️' })
  const icons = ['🍲', '🥗', '🫙', '🔥', '🥙', '🍛', '🥩', '🍚', '☕', '🧃', '🍮', '🫓', '🥘', '🍜', '🫕', '🥪', '🍱', '🧆']

  async function save() {
    if (!form.name) { alert('يرجى إدخال اسم القسم'); return }
    setSaving(true)
    const { error } = await supabase.from('menu_categories').insert([{ ...form, is_active: true }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 460, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>➕ إضافة قسم جديد</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>اسم القسم (عربي) *</label>
              <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: المقبلات" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Category Name (English)</label>
              <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Appetizers" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>الأيقونة</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {icons.map(icon => (
                <button key={icon} onClick={() => setForm(p => ({ ...p, icon }))}
                  style={{ width: 38, height: 38, borderRadius: 8, border: `1px solid ${form.icon === icon ? S.gold : S.border}`, background: form.icon === icon ? S.gold3 : S.card, cursor: 'pointer', fontSize: 20 }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '💾 حفظ القسم'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══

// ══ Ingredients Modal ══
function IngredientsModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const supabase = createClient()
  const [ingredients, setIngredients] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('menu_item_ingredients')
        .select('*, warehouse_products(id, name, category, last_purchase_price, units(symbol))')
        .eq('menu_item_id', item.id),
      supabase.from('warehouse_products')
        .select('id, name, category, last_purchase_price, units(symbol)')
        .eq('is_active', true).order('category').order('name'),
    ]).then(([ing, prods]) => {
      setIngredients(ing.data || [])
      setProducts(prods.data || [])
      setLoading(false)
    })
  }, [item.id])

  async function addIngredient() {
    const { data } = await supabase.from('menu_item_ingredients')
      .insert([{ menu_item_id: item.id, quantity: 1 }])
      .select('*, warehouse_products(id, name, category, last_purchase_price, units(symbol))')
    if (data) setIngredients(p => [...p, data[0]])
  }

  async function updateField(id: string, field: string, value: any) {
    await supabase.from('menu_item_ingredients').update({ [field]: value }).eq('id', id)
    const { data } = await supabase.from('menu_item_ingredients')
      .select('*, warehouse_products(id, name, category, last_purchase_price, units(symbol))')
      .eq('menu_item_id', item.id)
    setIngredients(data || [])
  }

  async function deleteIng(id: string) {
    await supabase.from('menu_item_ingredients').delete().eq('id', id)
    setIngredients(p => p.filter(i => i.id !== id))
  }

  const totalCost = ingredients.reduce((s, ing) => {
    return s + ((ing.warehouse_products?.last_purchase_price || 0) * (ing.quantity || 0))
  }, 0)

  const margin = item.price > 0 && totalCost > 0
    ? (((item.price - totalCost) / item.price) * 100).toFixed(1)
    : null

  const inpS: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#FAFAF8',
    outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 700, padding: 28, margin: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🧪 مكونات الوصفة</h2>
            <p style={{ fontSize: 13, color: S.muted }}>{item.name} — {item.name_en}</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* ملخص التكلفة */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: S.redB, border: `1px solid ${S.red}30`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🏭 تكلفة المكونات</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: S.red }}>MYR {totalCost.toFixed(2)}</div>
          </div>
          <div style={{ background: S.gold3, border: `1px solid ${S.gold}30`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>💰 سعر البيع</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: S.gold }}>MYR {(item.price || 0).toFixed(2)}</div>
          </div>
          <div style={{ background: margin && parseFloat(margin) > 0 ? S.greenB : S.redB, border: `1px solid ${margin && parseFloat(margin) > 0 ? S.green : S.red}30`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>📈 هامش الربح</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: margin && parseFloat(margin) > 0 ? S.green : S.red }}>
              {margin ? margin + '%' : '—'}
            </div>
          </div>
        </div>

        {margin && (
          <div style={{ marginBottom: 16, background: parseFloat(margin) > 0 ? S.greenB : S.redB, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: parseFloat(margin) > 0 ? S.green : S.red, fontWeight: 700 }}>
            {parseFloat(margin) > 0
              ? `✅ ربح MYR ${(item.price - totalCost).toFixed(2)} لكل وجبة`
              : `❌ خسارة MYR ${(totalCost - item.price).toFixed(2)} لكل وجبة — يجب مراجعة السعر أو التكاليف`}
          </div>
        )}

        {/* المكونات */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>{ingredients.length} مكون</div>
          <button onClick={addIngredient} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ➕ إضافة مكون
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
        ) : ingredients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: S.card, borderRadius: 14, color: S.muted }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧪</div>
            <div style={{ fontSize: 14, color: S.white, marginBottom: 6 }}>لا توجد مكونات بعد</div>
            <div style={{ fontSize: 12 }}>اضغط "إضافة مكون" لتحديد مكونات هذا الصنف من المستودع</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ingredients.map((ing) => (
              <div key={ing.id} style={{ background: S.card, borderRadius: 12, padding: '12px 16px', display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 10, alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>المكون من المستودع</label>
                  <select style={{ ...inpS, direction: 'rtl' }}
                    value={ing.warehouse_product_id || ''}
                    onChange={e => updateField(ing.id, 'warehouse_product_id', e.target.value || null)}>
                    <option value="">اختر المكون</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category}) — MYR {p.last_purchase_price || 0}/{p.units?.symbol || 'وحدة'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min="0" step="0.01" style={{ ...inpS, direction: 'ltr', textAlign: 'center' }}
                      value={ing.quantity || ''}
                      onChange={e => updateField(ing.id, 'quantity', parseFloat(e.target.value) || 0)} />
                    <span style={{ fontSize: 12, color: S.muted, flexShrink: 0 }}>{ing.warehouse_products?.units?.symbol || ''}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>التكلفة</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: S.red }}>
                    {ing.warehouse_products?.last_purchase_price && ing.quantity
                      ? 'MYR ' + (ing.warehouse_products.last_purchase_price * ing.quantity).toFixed(2)
                      : '—'}
                  </div>
                </div>
                <button onClick={() => deleteIng(ing.id)}
                  style={{ padding: '8px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 14, marginTop: 14 }}>
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ تم</button>
        </div>
      </div>
    </div>
  )
}

export default function MenuItemsPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [ingredientsItem, setIngredientsItem] = useState<MenuItem | null>(null)
  const [filterAvailable, setFilterAvailable] = useState<'all' | 'available' | 'unavailable'>('all')
  const [page, setPage] = useState(1)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [cats, itms] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('id, category_id, name, name_en, or_code, description, description_en, price, cost_price, is_active, is_available, sort_order, menu_categories(name,name_en,icon)').eq('is_active', true).order('sort_order').order('name'),
    ])
    const catsWithCount = (cats.data || []).map(c => ({
      ...c,
      item_count: (itms.data || []).filter(i => i.category_id === c.id).length
    }))
    setCategories(catsWithCount)
    setItems(itms.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    fetchAll()
  }

  async function deleteItem(id: string) {
    if (!confirm('هل تريد حذف هذا الصنف؟')) return
    await supabase.from('menu_items').update({ is_active: false }).eq('id', id)
    fetchAll()
  }

  // Filter
  const filtered = items.filter(i => {
    const matchCat = selectedCat === 'all' || i.category_id === selectedCat
    const matchSearch = !search || i.name.includes(search) || (i.name_en || '').toLowerCase().includes(search.toLowerCase()) || (i.or_code || '').includes(search)
    const matchAvail = filterAvailable === 'all' || (filterAvailable === 'available' ? i.is_available : !i.is_available)
    return matchCat && matchSearch && matchAvail
  })

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [selectedCat, search, filterAvailable])

  // Paginate
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Top 6
  const top6 = items.filter(i => TOP_6_NAMES.includes(i.name))

  // Stats
  const totalItems = items.length
  const availableItems = items.filter(i => i.is_available).length
  const avgPrice = items.length ? (items.reduce((s, i) => s + i.price, 0) / items.length) : 0

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        .item-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .item-card { transition: all .2s; }
      `}</style>

      {/* ══ Header ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📖 قائمة الطعام</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة أصناف المنيو والأسعار والصور</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddCat(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            📁 قسم جديد
          </button>
          <button onClick={() => setShowAddItem(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ➕ صنف جديد
          </button>
        </div>
      </div>

      {/* ══ Stats ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'إجمالي الأصناف', value: totalItems, icon: '🍽️', color: S.blue, bg: S.blueB },
          { label: 'متاح الآن', value: availableItems, icon: '✅', color: S.green, bg: S.greenB },
          { label: 'غير متاح', value: totalItems - availableItems, icon: '⏸', color: S.red, bg: S.redB },
          { label: 'الأقسام', value: categories.length, icon: '📁', color: S.purple, bg: S.purpleB },
          { label: 'متوسط السعر', value: formatMYR(avgPrice), icon: '💰', color: S.gold, bg: S.gold3 },
        ].map((s, i) => (
          <div key={i} style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ══ Top 6 الأكثر طلباً ══ */}
      {top6.length > 0 && selectedCat === 'all' && !search && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: S.white }}>الأكثر طلباً</span>
            <span style={{ fontSize: 12, color: S.muted, background: S.card2, borderRadius: 20, padding: '2px 10px' }}>أعلى 6 أصناف</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {top6.slice(0, 6).map((item, idx) => (
              <div key={item.id} style={{ background: S.navy2, borderRadius: 14, border: `2px solid rgba(201,168,76,0.25)`, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: S.gold, color: S.navy, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{idx + 1}</div>
                <div style={{ aspectRatio: '4/3', background: S.navy3, overflow: 'hidden' }}>
                  {item.image_url ? <img src={item.image_url} loading="lazy" alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>{item.menu_categories?.icon || '🍽️'}</div>}
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 4 }}>{item.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>{formatMYR(item.price)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, height: 1, background: S.border }} />
        </div>
      )}

      {/* ══ Category Overview Cards ══ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: S.muted, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>الأقسام</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <button
            onClick={() => setSelectedCat('all')}
            style={{
              background: selectedCat === 'all' ? S.gold3 : S.card2,
              border: `1px solid ${selectedCat === 'all' ? S.gold : S.border}`,
              borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
              textAlign: 'right', transition: 'all .2s',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>🍽️</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: selectedCat === 'all' ? S.gold : S.white, marginBottom: 2 }}>الكل</div>
            <div style={{ fontSize: 11, color: S.muted }}>All Items</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: selectedCat === 'all' ? S.gold : S.blue, marginTop: 6 }}>{totalItems}</div>
          </button>
          {categories.map(cat => (
            <button key={cat.id}
              onClick={() => setSelectedCat(selectedCat === cat.id ? 'all' : cat.id)}
              style={{
                background: selectedCat === cat.id ? S.gold3 : S.card2,
                border: `1px solid ${selectedCat === cat.id ? S.gold : S.border}`,
                borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                textAlign: 'right', transition: 'all .2s',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>{cat.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: selectedCat === cat.id ? S.gold : S.white, marginBottom: 2, lineHeight: 1.3 }}>{cat.name}</div>
              <div style={{ fontSize: 10, color: S.muted }}>{cat.name_en}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: selectedCat === cat.id ? S.gold : S.blue, marginTop: 6 }}>{cat.item_count || 0}</div>
            </button>
          ))}
          <button
            onClick={() => setShowAddCat(true)}
            style={{ background: 'transparent', border: `2px dashed ${S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 110, transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = S.gold; e.currentTarget.style.background = S.gold3 }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ fontSize: 24, color: S.muted }}>➕</div>
            <div style={{ fontSize: 11, color: S.muted }}>قسم جديد</div>
          </button>
        </div>
      </div>

      {/* ══ Search & Filters ══ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ ...inp, flex: 1, minWidth: 200 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 بحث بالاسم أو الكود أو الإنجليزي..."
        />
        <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={filterAvailable} onChange={e => setFilterAvailable(e.target.value as 'all' | 'available' | 'unavailable')}>
          <option value="all">كل الأصناف</option>
          <option value="available">متاح فقط</option>
          <option value="unavailable">غير متاح</option>
        </select>
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          <button onClick={() => setView('grid')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'grid' ? S.gold3 : 'transparent', color: view === 'grid' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>⊞</button>
          <button onClick={() => setView('list')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'list' ? S.gold3 : 'transparent', color: view === 'list' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>☰</button>
        </div>
        <div style={{ fontSize: 12, color: S.muted }}>{filtered.length} صنف{totalPages > 1 && ` • ص${page}/${totalPages}`}</div>
      </div>

      {/* ══ Items ══ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد أصناف</div>
          <div style={{ fontSize: 13 }}>اضغط "صنف جديد" لإضافة أول صنف</div>
        </div>
      ) : view === 'grid' ? (
        /* Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {paginated.map(item => (
            <div key={item.id} className="item-card" style={{
              background: S.navy2, borderRadius: 16,
              border: `1px solid ${item.is_available ? S.border : S.redB}`,
              overflow: 'hidden', position: 'relative',
            }}>
              {/* صورة */}
              <div style={{ aspectRatio: '4/3', background: S.navy3, position: 'relative', overflow: 'hidden' }}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                    {item.menu_categories?.icon || '🍽️'}
                  </div>
                )}
                {/* Availability Badge */}
                <div style={{ position: 'absolute', top: 8, right: 8, background: item.is_available ? S.greenB : S.redB, border: `1px solid ${item.is_available ? S.green : S.red}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: item.is_available ? S.green : S.red, backdropFilter: 'blur(8px)' }}>
                  {item.is_available ? '✅ متاح' : '⏸ غير متاح'}
                </div>
                {/* OR Code */}
                {item.or_code && (
                  <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(10,22,40,0.85)', borderRadius: 8, padding: '3px 8px', fontSize: 10, color: S.gold, fontWeight: 700 }}>
                    {item.or_code}
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: '14px 14px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic', marginBottom: 6 }}>{item.name_en}</div>
                {item.description && <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>{formatMYR(item.price)}</div>
                  {item.cost_price > 0 && (
                    <div style={{ fontSize: 10, color: S.muted }}>
                      تكلفة: {formatMYR(item.cost_price)}
                    </div>
                  )}
                </div>

                {/* Category Tag */}
                <div style={{ fontSize: 10, color: S.muted, background: S.card, borderRadius: 8, padding: '3px 8px', display: 'inline-block', marginBottom: 10 }}>
                  {item.menu_categories?.icon} {item.menu_categories?.name}
                </div>

                {/* Actions */}
<div style={{ display: 'flex', gap: 6 }}>
  <button onClick={() => setEditItem(item)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>✏️ تعديل</button>
  <button onClick={() => setIngredientsItem(item)} style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 12 }}>🧪</button>
  <button onClick={() => toggleAvailable(item)} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${item.is_available ? S.amber : S.green}`, background: item.is_available ? S.amberB : S.greenB, color: item.is_available ? S.amber : S.green, cursor: 'pointer', fontSize: 12 }}>
    {item.is_available ? '⏸' : '▶'}
  </button>
  <button onClick={() => deleteItem(item.id)} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['الصنف', 'القسم', 'الكود', 'سعر البيع', 'التكلفة', 'الهامش', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(item => {
                  const margin = item.price && item.cost_price
                    ? (((item.price - item.cost_price) / item.price) * 100).toFixed(0)
                    : null
                  return (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} loading="lazy" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: S.navy3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                              {item.menu_categories?.icon || '🍽️'}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic' }}>{item.name_en}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: S.card2, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: S.muted }}>
                          {item.menu_categories?.icon} {item.menu_categories?.name}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: S.gold, fontWeight: 600 }}>{item.or_code || '—'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: S.gold, fontSize: 13 }}>{formatMYR(item.price)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: S.muted }}>{item.cost_price ? formatMYR(item.cost_price) : '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {margin ? (
                          <span style={{ background: parseInt(margin) > 60 ? S.greenB : parseInt(margin) > 40 ? S.amberB : S.redB, color: parseInt(margin) > 60 ? S.green : parseInt(margin) > 40 ? S.amber : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                            {margin}%
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: item.is_available ? S.greenB : S.redB, color: item.is_available ? S.green : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                          {item.is_available ? '✅ متاح' : '⏸ غير متاح'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditItem(item)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12 }}>✏️</button>
                          <button onClick={() => toggleAvailable(item)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${item.is_available ? S.amber : S.green}`, background: item.is_available ? S.amberB : S.greenB, color: item.is_available ? S.amber : S.green, cursor: 'pointer', fontSize: 12 }}>
                            {item.is_available ? '⏸' : '▶'}
                          </button>
                          <button onClick={() => deleteItem(item.id)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Pagination ══ */}
      <Pagination page={page} total={filtered.length} totalPages={totalPages} onChange={setPage} />

      {/* ══ Modals ══ */}
      {(showAddItem || editItem) && (
        <ItemModal
          item={editItem}
          categories={categories}
          onClose={() => { setShowAddItem(false); setEditItem(null) }}
          onSaved={() => { setShowAddItem(false); setEditItem(null); fetchAll() }}
        />
      )}
      {ingredientsItem && (
        <IngredientsModal item={ingredientsItem} onClose={() => setIngredientsItem(null)} />
      )}
      {showAddCat && (
        <AddCategoryModal
          onClose={() => setShowAddCat(false)}
          onSaved={() => { setShowAddCat(false); fetchAll() }}
        />
      )}
    </div>
  )
}
