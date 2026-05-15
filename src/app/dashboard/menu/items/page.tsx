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

const PAGE_SIZE = 20

// أكثر 6 أصناف طلباً — يمكن تعديلها لاحقاً من بيانات المبيعات الفعلية
const TOP_6_NAMES = [
  'شيش طاووق', 'كباب دجاج', 'مندي دجاج', 'شاورما مع الرز',
  'كبسة دجاج', 'وجبة شاورما',
]

function formatMYR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return 'MYR ' + new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}

interface Category {
  id: string; name: string; name_en: string; icon: string
  sort_order: number; is_active: boolean; item_count?: number
}

interface MenuItem {
  id: string; category_id: string; name: string; name_en: string
  or_code: string; description: string; description_en: string
  price: number; cost_price: number; image_url: string
  is_active: boolean; is_available: boolean; sort_order: number
  menu_categories?: { name: string; name_en: string; icon: string; sort_order: number }
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result as string)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

// ══ Item Card ══
function ItemCard({ item, onEdit, onToggle, onDelete }: {
  item: MenuItem; onEdit: () => void; onToggle: () => void; onDelete: () => void
}) {
  return (
    <div className="item-card" style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${item.is_available ? S.border : S.redB}`, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '4/3', background: S.navy3, position: 'relative', overflow: 'hidden' }}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
            {item.menu_categories?.icon || '🍽️'}
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8, background: item.is_available ? S.greenB : S.redB, border: `1px solid ${item.is_available ? S.green : S.red}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: item.is_available ? S.green : S.red, backdropFilter: 'blur(8px)' }}>
          {item.is_available ? '✅ متاح' : '⏸ غير متاح'}
        </div>
        {item.or_code && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(10,22,40,0.85)', borderRadius: 8, padding: '3px 8px', fontSize: 10, color: S.gold, fontWeight: 700 }}>
            {item.or_code}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>{item.name}</div>
        <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic', marginBottom: 6 }}>{item.name_en}</div>
        {item.description && (
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.description}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>{formatMYR(item.price)}</div>
          {item.cost_price > 0 && <div style={{ fontSize: 10, color: S.muted }}>تكلفة: {formatMYR(item.cost_price)}</div>}
        </div>
        <div style={{ fontSize: 10, color: S.muted, background: S.card, borderRadius: 8, padding: '3px 8px', display: 'inline-block', marginBottom: 10 }}>
          {item.menu_categories?.icon} {item.menu_categories?.name}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onEdit} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>✏️ تعديل</button>
          <button onClick={onToggle} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${item.is_available ? S.amber : S.green}`, background: item.is_available ? S.amberB : S.greenB, color: item.is_available ? S.amber : S.green, cursor: 'pointer', fontSize: 12 }}>
            {item.is_available ? '⏸' : '▶'}
          </button>
          <button onClick={onDelete} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
        </div>
      </div>
    </div>
  )
}

// ══ Pagination ══
function Pagination({ page, total, totalPages, onChange }: {
  page: number; total: number; totalPages: number; onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  // صفحات مع ellipsis
  const getPages = () => {
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
          p === '...' ? (
            <span key={`e${i}`} style={{ color: S.muted, padding: '0 4px' }}>...</span>
          ) : (
            <button key={p} onClick={() => onChange(p as number)}
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${p === page ? S.gold : S.border}`, background: p === page ? S.gold3 : 'transparent', color: p === page ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 800 : 400, fontFamily: 'Tajawal, sans-serif' }}>
              {p}
            </button>
          )
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${page === totalPages ? S.border : S.gold}`, background: page === totalPages ? 'transparent' : S.gold3, color: page === totalPages ? S.muted : S.gold, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          التالي →
        </button>
      </div>
    </div>
  )
}

// ══ Item Modal ══
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
    setImagePreview(await toBase64(file))
  }

  async function save() {
    if (!form.name || !form.category_id) { alert('يرجى إدخال الاسم والقسم'); return }
    setSaving(true)
    const payload = { ...form, price: parseFloat(form.price) || 0, cost_price: parseFloat(form.cost_price) || 0, image_url: imagePreview || null }
    const { error } = item
      ? await supabase.from('menu_items').update(payload).eq('id', item.id)
      : await supabase.from('menu_items').insert([payload])
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
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{item ? '✏️ تعديل الصنف' : '➕ إضافة صنف جديد'}</h2>
            <p style={{ fontSize: 12, color: S.muted }}>أدخل تفاصيل الصنف والسعر والصورة</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 12 }}>📸 صورة الصنف</div>
            <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${imagePreview ? S.green : S.border}`, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: imagePreview ? 'transparent' : S.card, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', marginBottom: 12 }}>
              {imagePreview ? <img src={imagePreview} alt="صورة" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
                  <div style={{ fontSize: 12, color: S.muted }}>اضغط لرفع صورة</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
            {imagePreview && <button onClick={() => setImagePreview('')} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🗑️ حذف الصورة</button>}
            {margin && (
              <div style={{ marginTop: 14, background: parseFloat(margin) > 60 ? S.greenB : parseFloat(margin) > 40 ? S.amberB : S.redB, border: `1px solid ${parseFloat(margin) > 60 ? S.green : parseFloat(margin) > 40 ? S.amber : S.red}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>هامش الربح</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: parseFloat(margin) > 60 ? S.green : parseFloat(margin) > 40 ? S.amber : S.red }}>{margin}%</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>القسم *</label>
              <select style={{ ...inp }} value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                <option value="">اختر القسم</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
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
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>رقم الصنف (OR Code)</label>
              <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.or_code} onChange={e => setForm(p => ({ ...p, or_code: e.target.value }))} placeholder="OR-001" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>سعر البيع (MYR) *</label>
                <input style={inp} type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>سعر التكلفة (MYR)</label>
                <input style={inp} type="number" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الوصف (عربي)</label>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف مختصر..." />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Description (English)</label>
              <textarea style={{ ...inp, direction: 'ltr', textAlign: 'left', minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={form.description_en} onChange={e => setForm(p => ({ ...p, description_en: e.target.value }))} placeholder="Brief description..." />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: S.gold, width: 16, height: 16 }} />
                <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>نشط</div>
                <div style={{ fontSize: 11, color: S.muted }}>يظهر في النظام</div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
                <input type="checkbox" checked={form.is_available} onChange={e => setForm(p => ({ ...p, is_available: e.target.checked }))} style={{ accentColor: S.green, width: 16, height: 16 }} />
                <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>متاح</div>
                <div style={{ fontSize: 11, color: S.muted }}>متوفر للطلب</div>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الحفظ...' : item ? '💾 حفظ' : '✅ إضافة'}
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
  const icons = ['🍽️', '🥗', '🫙', '🔥', '🥙', '🍛', '🥩', '🍚', '☕', '🧃', '🍮', '🫓', '🥘', '🍜', '🫕', '🥪', '🍱', '🧆', '🍕', '🍝']

  async function save() {
    if (!form.name) { alert('يرجى إدخال اسم القسم'); return }
    setSaving(true)
    await supabase.from('menu_categories').insert([{ ...form, is_active: true }])
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 460, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>➕ إضافة قسم جديد</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
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
            {saving ? '⏳...' : '✅ إضافة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
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
  const [filterAvailable, setFilterAvailable] = useState<'all' | 'available' | 'unavailable'>('all')
  const [page, setPage] = useState(1)
  const [showTop6, setShowTop6] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [cats, itms] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('*, menu_categories(name,name_en,icon,sort_order)').eq('is_active', true).order('sort_order').order('name'),
    ])
    setCategories(cats.data || [])
    setItems(itms.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    fetchAll()
  }

  async function deleteItem(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return
    await supabase.from('menu_items').delete().eq('id', id)
    fetchAll()
  }

  const categoriesWithCount = categories.map(c => ({
    ...c,
    item_count: items.filter(i => i.category_id === c.id).length
  }))

  // أكثر 6 طلباً
  const top6Items = items.filter(i => TOP_6_NAMES.includes(i.name))

  // ترتيب حسب القسم
  const filtered = items
    .filter(i => {
      const matchCat = selectedCat === 'all' || i.category_id === selectedCat
      const matchSearch = !search || i.name.includes(search) || (i.name_en || '').toLowerCase().includes(search.toLowerCase()) || (i.or_code || '').toLowerCase().includes(search.toLowerCase())
      const matchAvail = filterAvailable === 'all' || (filterAvailable === 'available' ? i.is_available : !i.is_available)
      return matchCat && matchSearch && matchAvail
    })
    .sort((a, b) => {
      const catA = a.menu_categories?.sort_order ?? 99
      const catB = b.menu_categories?.sort_order ?? 99
      if (catA !== catB) return catA - catB
      return (a.sort_order || 0) - (b.sort_order || 0)
    })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [selectedCat, search, filterAvailable])

  const totalItems = items.length
  const availableItems = items.filter(i => i.is_available).length
  const avgPrice = items.length > 0 ? items.reduce((s, i) => s + i.price, 0) / items.length : 0

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        .item-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .item-card { transition: all .2s; }
        .cat-chip { transition: all .15s; }
        .cat-chip:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📖 قائمة الطعام</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة أصناف المنيو والأسعار والصور</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddCat(true)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📁 قسم جديد</button>
          <button onClick={() => setShowAddItem(true)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ صنف جديد</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'إجمالي الأصناف', value: totalItems, icon: '🍽️', color: S.blue, bg: S.blueB },
          { label: 'متاح حالياً', value: availableItems, icon: '✅', color: S.green, bg: S.greenB },
          { label: 'غير متاح', value: totalItems - availableItems, icon: '⏸', color: S.red, bg: S.redB },
          { label: 'الأقسام', value: categories.length, icon: '📁', color: S.purple, bg: S.purpleB },
          { label: 'متوسط السعر', value: formatMYR(avgPrice), icon: '💰', color: S.gold, bg: S.gold3 },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 14, border: `1px solid ${s.color}30`, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ══ الأكثر طلباً ══ */}
      {showTop6 && selectedCat === 'all' && !search && top6Items.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔥</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>الأكثر طلباً</div>
                <div style={{ fontSize: 11, color: S.muted }}>أعلى 6 أصناف مبيعاً في الفرع</div>
              </div>
            </div>
            <button onClick={() => setShowTop6(false)} style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 12, cursor: 'pointer', padding: '6px 12px', fontFamily: 'Tajawal, sans-serif' }}>إخفاء</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {top6Items.slice(0, 6).map((item, idx) => (
              <div key={item.id} style={{ background: S.navy2, borderRadius: 16, border: `2px solid rgba(201,168,76,0.3)`, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: S.gold, color: S.navy, borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                  {idx + 1}
                </div>
                {idx === 0 && (
                  <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(239,68,68,0.9)', color: 'white', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>🔥 #1</div>
                )}
                <div style={{ aspectRatio: '4/3', background: S.navy3, overflow: 'hidden' }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                      {item.menu_categories?.icon || '🍽️'}
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 8 }}>{item.name_en}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: S.gold }}>{formatMYR(item.price)}</div>
                    <span style={{ background: item.is_available ? S.greenB : S.redB, color: item.is_available ? S.green : S.red, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                      {item.is_available ? '✅' : '⏸'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, height: 1, background: `linear-gradient(to left, transparent, ${S.border}, transparent)` }} />
        </div>
      )}

      {!showTop6 && (
        <button onClick={() => setShowTop6(true)} style={{ marginBottom: 20, padding: '8px 16px', borderRadius: 20, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
          🔥 إظهار الأكثر طلباً
        </button>
      )}

      {/* ══ أقسام (Chips) ══ */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>الأقسام</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="cat-chip" onClick={() => setSelectedCat('all')}
            style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${selectedCat === 'all' ? S.gold : S.border}`, background: selectedCat === 'all' ? S.gold3 : 'transparent', color: selectedCat === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: selectedCat === 'all' ? 700 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
            🍽️ الكل
            <span style={{ background: selectedCat === 'all' ? S.gold : S.card2, color: selectedCat === 'all' ? S.navy : S.muted, borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{totalItems}</span>
          </button>
          {categoriesWithCount.map(cat => (
            <button key={cat.id} className="cat-chip" onClick={() => setSelectedCat(selectedCat === cat.id ? 'all' : cat.id)}
              style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${selectedCat === cat.id ? S.gold : S.border}`, background: selectedCat === cat.id ? S.gold3 : 'transparent', color: selectedCat === cat.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: selectedCat === cat.id ? 700 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
              {cat.icon} {cat.name}
              <span style={{ background: selectedCat === cat.id ? S.gold : S.card2, color: selectedCat === cat.id ? S.navy : S.muted, borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{cat.item_count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ فلاتر + عرض ══ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم أو الكود..." />
        <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={filterAvailable} onChange={e => setFilterAvailable(e.target.value as 'all' | 'available' | 'unavailable')}>
          <option value="all">كل الأصناف</option>
          <option value="available">متاح فقط</option>
          <option value="unavailable">غير متاح</option>
        </select>
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          <button onClick={() => setView('grid')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'grid' ? S.gold3 : 'transparent', color: view === 'grid' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>⊞</button>
          <button onClick={() => setView('list')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'list' ? S.gold3 : 'transparent', color: view === 'list' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>☰</button>
        </div>
        <div style={{ fontSize: 12, color: S.muted }}>
          {filtered.length} صنف
          {totalPages > 1 && ` • صفحة ${page}/${totalPages}`}
        </div>
      </div>

      {/* ══ المحتوى ══ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد أصناف</div>
          <div style={{ fontSize: 13 }}>جرب تغيير الفلتر أو أضف صنفاً جديداً</div>
        </div>
      ) : view === 'grid' ? (
        <>
          {/* عرض مجمّع بالأقسام لما يكون "الكل" */}
          {selectedCat === 'all' && !search ? (
            categories.map(cat => {
              const catItems = paginated.filter(i => i.category_id === cat.id)
              if (catItems.length === 0) return null
              return (
                <div key={cat.id} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${S.border}` }}>
                    <span style={{ fontSize: 20 }}>{cat.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{cat.name}</span>
                    <span style={{ fontSize: 12, color: S.muted, fontStyle: 'italic' }}>{cat.name_en}</span>
                    <span style={{ fontSize: 11, color: S.blue, background: S.blueB, borderRadius: 20, padding: '2px 10px', marginRight: 'auto' }}>
                      {items.filter(i => i.category_id === cat.id).length} صنف
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {catItems.map(item => (
                      <ItemCard key={item.id} item={item}
                        onEdit={() => setEditItem(item)}
                        onToggle={() => toggleAvailable(item)}
                        onDelete={() => deleteItem(item.id)} />
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {paginated.map(item => (
                <ItemCard key={item.id} item={item}
                  onEdit={() => setEditItem(item)}
                  onToggle={() => toggleAvailable(item)}
                  onDelete={() => deleteItem(item.id)} />
              ))}
            </div>
          )}
          <Pagination page={page} total={filtered.length} totalPages={totalPages} onChange={setPage} />
        </>
      ) : (
        <>
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
                      ? (((item.price - item.cost_price) / item.price) * 100).toFixed(0) : null
                    return (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
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
          <Pagination page={page} total={filtered.length} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {/* Modals */}
      {(showAddItem || editItem) && (
        <ItemModal item={editItem} categories={categories}
          onClose={() => { setShowAddItem(false); setEditItem(null) }}
          onSaved={() => { setShowAddItem(false); setEditItem(null); fetchAll() }} />
      )}
      {showAddCat && (
        <AddCategoryModal onClose={() => setShowAddCat(false)} onSaved={() => { setShowAddCat(false); fetchAll() }} />
      )}
    </div>
  )
}
