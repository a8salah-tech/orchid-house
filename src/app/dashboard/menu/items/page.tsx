'use client'



import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useLang } from '../../../components/LanguageContext'

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
  boxSizing: 'border-box',
}

function formatMYR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return 'MYR ' + new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}

const PAGE_SIZE = 20 // fallback

// ══ Pagination Component ══
function Pagination({ page, total, totalPages, onChange, pageSize, onPageSizeChange }: {
  page: number; total: number; totalPages: number; onChange: (p: number) => void; pageSize?: number; onPageSizeChange?: (s: number) => void
}) {
  const { isAr } = useLang()

  if (totalPages <= 1 && !onPageSizeChange) return null
  const size = pageSize || 50
  const from = (page - 1) * size + 1
  const to = Math.min(page * size, total)
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
      <div style={{ fontSize: 12, color: S.muted }}>{isAr ? `عرض ${from}–${to} من ${total} صنف` : `Showing ${from}–${to} of ${total} items`}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${page === 1 ? S.border : S.gold}`, background: page === 1 ? 'transparent' : S.gold3, color: page === 1 ? S.muted : S.gold, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          {isAr ? '← السابق' : '← Prev'}
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
          {isAr ? 'التالي →' : 'Next →'}
        </button>
      </div>
    </div>
  )
}


interface Category {
  id: string; name: string; name_en: string; name_ms?: string | null; icon: string
  sort_order: number; is_active: boolean; item_count?: number
}

interface MenuItem {
  id: string; category_id: string; name: string; name_en: string; name_ms?: string | null
  or_code: string; description: string; description_en: string; description_ms?: string | null
  price: number; cost_price: number; image_url?: string
  is_active: boolean; is_available: boolean; sort_order: number
  discount_percent?: number
  sizes?: { id: string; name: string; name_en: string; name_ms?: string | null; price: number; is_active: boolean }[]
  menu_categories?: { name: string; name_en: string; icon: string } | any
}

// ══ Image Upload Helper ══
async function uploadToStorage(supabase: ReturnType<typeof createClient>, file: File, itemId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${itemId}_${Date.now()}.${ext}`  
  const { data, error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true, contentType: file.type })
  if (error) { console.error('Upload error:', error); return null }
  const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(data.path)
  return urlData.publicUrl
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
    name_ms: item?.name_ms || '',
    or_code: item?.or_code || '',
    description: item?.description || '',
    description_en: item?.description_en || '',
    description_ms: item?.description_ms || '',
    price: item?.price?.toString() || '',
    cost_price: item?.cost_price?.toString() || '',
    discount_percent: item?.discount_percent != null && item.discount_percent > 0 ? String(item.discount_percent) : '',
    is_active: item?.is_active !== false,
    is_available: item?.is_available !== false,
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [sizes, setSizes] = useState<{id?:string;name:string;name_en:string;name_ms?:string;price:string;is_active:boolean}[]>([])
  const { isAr } = useLang()
  const [modalTab, setModalTab] = useState<'info'|'sizes'>('info')
  useEffect(() => {
    if (!item?.id) return
    supabase.from('menu_item_sizes').select('*').eq('menu_item_id', item.id).order('sort_order').then(({ data }) => {
      setSizes((data || []).map((s: any) => ({ ...s, price: String(s.price) })))
    })
  }, [item?.id])

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function save() {
    if (!form.name || !form.category_id) { alert('يرجى إدخال الاسم والقسم'); return }
    setSaving(true)

    // ✅ التحقق من عدم تكرار كود الصنف (OR-code) على أي صنف تاني
    const trimmedCode = form.or_code.trim()
    if (trimmedCode) {
      let dupQuery = supabase.from('menu_items').select('id,name').eq('or_code', trimmedCode).eq('is_active', true)
      if (item?.id) dupQuery = dupQuery.neq('id', item.id)
      const { data: dup } = await dupQuery.maybeSingle()
      if (dup) {
        alert(isAr
          ? `⚠️ الكود "${trimmedCode}" مستخدم بالفعل للصنف "${dup.name}". اختر كود تاني.`
          : `⚠️ Code "${trimmedCode}" is already used by "${dup.name}". Choose another.`)
        setSaving(false)
        return
      }
    }

    let finalImageUrl: string | null = item?.image_url || null

    if (imageFile) {
      const tempId = item?.id || `new_${Date.now()}`
      const uploadedUrl = await uploadToStorage(supabase, imageFile, tempId)
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl
      } else {
        alert('فشل رفع الصورة — تأكد من إعداد bucket menu-images في Supabase')
        setSaving(false)
        return
      }
    } else if (imagePreview === '') {
      finalImageUrl = null
    }

    const numMatch = trimmedCode.match(/(\d+)/)
    const derivedSortOrder = numMatch ? parseInt(numMatch[1], 10) : (item?.sort_order ?? 0)

    const payload = {
      name: form.name,
      name_en: form.name_en || null,
      name_ms: form.name_ms || null,
      or_code: trimmedCode || null,
      description: form.description || null,
      description_en: form.description_en || null,
      description_ms: form.description_ms || null,
      category_id: form.category_id || null,
      price: parseFloat(form.price) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      discount_percent: form.discount_percent === '' || form.discount_percent === null ? 0 : (parseFloat(form.discount_percent) || 0),
      is_available: form.is_available !== false,
      is_active: (form as any).is_active !== false,
      image_url: finalImageUrl,
      ...(trimmedCode ? { sort_order: derivedSortOrder } : {}),
    }

    let error
    if (item) {
      ({ error } = await supabase.from('menu_items').update(payload).eq('id', item.id))
    } else if (trimmedCode) {
      // ✅ المستخدم كتب كود بنفسه — نستخدم رقمه هو زي ما هو، من غير ما نغيره برقم تلقائي
      ({ error } = await supabase.from('menu_items').insert([payload]))
    } else {
      // ✅ لو سايب الكود فاضي، ياخد آخر ترتيب في نفس القسم (max sort_order + 1) بدل ما يتحط تلقائي في الأول
      const { data: maxRow } = await supabase
        .from('menu_items')
        .select('sort_order')
        .eq('category_id', form.category_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;
      ({ error } = await supabase.from('menu_items').insert([{ ...payload, sort_order: nextSortOrder }]))
    }
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    const savedId = item?.id
    if (savedId) {
      await supabase.from('menu_item_sizes').delete().eq('menu_item_id', savedId)
      const valid = sizes.filter((s) => s.name && s.price)
      if (valid.length > 0) await supabase.from('menu_item_sizes').insert(valid.map((s, i) => ({ menu_item_id: savedId, name: s.name, name_en: s.name_en || null, name_ms: s.name_ms || null, price: parseFloat(s.price), is_active: s.is_active !== false, sort_order: i })))
    }
    onSaved()
  }

  const margin = form.price && form.cost_price
    ? (((parseFloat(form.price) - parseFloat(form.cost_price)) / parseFloat(form.price)) * 100).toFixed(1)
    : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 780, padding: 32, margin: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {item ? (isAr ? '✏️ تعديل الصنف' : '✏️ Edit Item') : (isAr ? '➕ إضافة صنف جديد' : '➕ Add New Item')}
            </h2>
            <p style={{ fontSize: 12, color: S.muted }}>{isAr ? 'أدخل تفاصيل الصنف والسعر والصورة' : 'Enter item details, price and image'}</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {(['info','sizes'] as const).map(t => (
            <button key={t} onClick={() => setModalTab(t)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: modalTab === t ? 700 : 400, background: modalTab === t ? S.gold3 : 'transparent', color: modalTab === t ? S.gold : S.muted }}>
              {t === 'info' ? (isAr ? '📋 بيانات الصنف' : '📋 Item Info') : (isAr ? '📏 الأحجام' : '📏 Sizes')}
            </button>
          ))}
        </div>

        {modalTab === 'info' && (<div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>

          {/* LEFT: الصورة */}
          <div>
            <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 12 }}>{isAr ? '📸 صورة الصنف' : '📸 Item Image'}</div>
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
                {isAr ? '🗑️ حذف الصورة' : '🗑️ Remove Image'}
              </button>
            )}

            {/* Margin Preview */}
            {margin && (
              <div style={{ background: parseFloat(margin) > 60 ? S.greenB : parseFloat(margin) > 40 ? S.amberB : S.redB, border: `1px solid ${parseFloat(margin) > 60 ? S.green : parseFloat(margin) > 40 ? S.amber : S.red}`, borderRadius: 12, padding: '14px 16px', marginTop: 14 }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>هامش الربح</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: parseFloat(margin) > 60 ? S.green : parseFloat(margin) > 40 ? S.amber : S.red }}>{margin}%</div>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                  {isAr ? 'ربح' : 'Profit'}: {formatMYR(parseFloat(form.price) - parseFloat(form.cost_price))} {isAr ? 'لكل صنف' : 'per item'}
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
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'اسم الصنف (عربي) *' : 'Item Name (Arabic) *'}</label>
                <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: شوربة عدس" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Item Name (English)</label>
                <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Lentil Soup" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Item Name (Bahasa Malaysia)</label>
                <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_ms} onChange={e => setForm(p => ({ ...p, name_ms: e.target.value }))} placeholder="cth. Sup Lentil" />
              </div>
            </div>

            {/* OR Code */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'كود الصنف (رقم الترتيب)' : 'Item Code (sort number)'}</label>
              <input
                style={{ ...inp, direction: 'ltr', textAlign: 'left', fontWeight: 700, color: S.gold }}
                value={form.or_code}
                onChange={e => setForm(p => ({ ...p, or_code: e.target.value }))}
                placeholder={isAr ? 'مثال: OR-155 (هيتحدد تلقائيًا لو سبته فاضي)' : 'e.g. OR-155 (auto-assigned if left empty)'}
              />
            </div>

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

            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الخصم %</label>
              <input style={inp} type="number" min="0" max="100" value={form.discount_percent} onChange={e => setForm(p => ({ ...p, discount_percent: e.target.value }))} placeholder="0" />
              {parseFloat(form.discount_percent) > 0 && form.price && <div style={{ fontSize: 11, color: S.green, marginTop: 4 }}>{isAr ? 'السعر بعد الخصم' : 'Price after discount'}: MYR {(parseFloat(form.price) * (1 - parseFloat(form.discount_percent)/100)).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
            </div>

            {/* الوصف */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={isAr ? "وصف مختصر للصنف..." : "Brief description..."} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Description (English)</label>
              <textarea style={{ ...inp, direction: 'ltr', textAlign: 'left', minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={form.description_en} onChange={e => setForm(p => ({ ...p, description_en: e.target.value }))} placeholder="Brief description..." />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Description (Bahasa Malaysia)</label>
              <textarea style={{ ...inp, direction: 'ltr', textAlign: 'left', minHeight: 70, resize: 'vertical' } as React.CSSProperties} value={form.description_ms} onChange={e => setForm(p => ({ ...p, description_ms: e.target.value }))} placeholder="Penerangan ringkas..." />
            </div>

            {/* الحالة */}
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: S.gold, width: 16, height: 16 }} />
                <div>
                  <div style={{ fontSize: 12, color: S.white, fontWeight: 600 }}>{isAr ? 'نشط' : 'Active'}</div>
                  <div style={{ fontSize: 10, color: S.muted }}>يظهر في النظام</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
                <input type="checkbox" checked={form.is_available} onChange={e => setForm(p => ({ ...p, is_available: e.target.checked }))} style={{ accentColor: S.green, width: 16, height: 16 }} />
                <div>
                  <div style={{ fontSize: 12, color: S.white, fontWeight: 600 }}>{isAr ? 'متاح' : 'Available'}</div>
                  <div style={{ fontSize: 10, color: S.muted }}>متوفر للطلب</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        )}

        {modalTab === 'sizes' && (
          <div>
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: S.muted }}>
              {isAr ? '💡 أضف أحجام للصنف (كاملة، نص، ربع) بأسعار مختلفة. إذا لم تضف — يستخدم السعر الأساسي.' : '💡 Add sizes (Full, Half, Quarter) with different prices. If not added — base price is used.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>📏 الأحجام</div>
              <button onClick={() => setSizes(p => [...p, { name: '', name_en: '', price: '', is_active: true }])} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>➕ إضافة حجم</button>
            </div>
            {sizes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: S.muted, fontSize: 12, background: S.card, borderRadius: 10 }}>لا توجد أحجام</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sizes.map((size, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px auto', gap: 8, alignItems: 'center', background: S.card, borderRadius: 10, padding: '8px 10px' }}>
                    <input style={{ ...inp, padding: '7px 10px' }} placeholder="الاسم عربي" value={size.name} onChange={e => setSizes(p => p.map((s, si) => si === i ? { ...s, name: e.target.value } : s))} />
                    <input style={{ ...inp, padding: '7px 10px', direction: 'ltr' as const }} placeholder="English name" value={size.name_en} onChange={e => setSizes(p => p.map((s, si) => si === i ? { ...s, name_en: e.target.value } : s))} />
                    <input style={{ ...inp, padding: '7px 10px', direction: 'ltr' as const }} placeholder="Nama Melayu" value={size.name_ms || ''} onChange={e => setSizes(p => p.map((s, si) => si === i ? { ...s, name_ms: e.target.value } : s))} />
                    <input style={{ ...inp, padding: '7px 10px', direction: isAr ? 'rtl' : 'ltr' }} type="number" step="0.01" placeholder={isAr ? 'السعر' : 'Price'} value={size.price} onChange={e => setSizes(p => p.map((s, si) => si === i ? { ...s, price: e.target.value } : s))} />
                    <button onClick={() => setSizes(p => p.filter((_, si) => si !== i))} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13 }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? (isAr ? '⏳ جاري الحفظ...' : '⏳ Saving...') : item ? (isAr ? '💾 حفظ التعديلات' : '💾 Save Changes') : (isAr ? '✅ إضافة الصنف' : '✅ Add Item')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Add Category Modal ══
function AddCategoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const { isAr } = useLang()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', name_en: '', name_ms: '', icon: '🍽️' })
  const icons = ['🍲', '🥗', '🫙', '🔥', '🥙', '🍛', '🥩', '🍚', '☕', '🧃', '🍮', '🫓', '🥘', '🍜', '🫕', '🥪', '🍱', '🧆']

  async function save() {
    if (!form.name) { alert('يرجى إدخال اسم القسم'); return }
    setSaving(true)
    // ✅ القسم الجديد ياخد آخر ترتيب (max sort_order + 1) بدل ما يتحط تلقائي في الأول
    const { data: maxRow } = await supabase
      .from('menu_categories')
      .select('sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;
    const { error } = await supabase.from('menu_categories').insert([{ ...form, name_en: form.name_en || null, name_ms: form.name_ms || null, is_active: true, sort_order: nextSortOrder }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 460, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>{isAr ? '➕ إضافة قسم جديد' : '➕ Add New Category'}</h3>
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
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Category Name (Bahasa Malaysia)</label>
            <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_ms} onChange={e => setForm(p => ({ ...p, name_ms: e.target.value }))} placeholder="cth. Pembuka Selera" />
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
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : (isAr ? '💾 حفظ القسم' : '💾 Save Category')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══

// ══ وحدات القياس مع معاملات التحويل ══
// كل وحدة تحتوي على: الاسم، الرمز، ونسبة التحويل إلى الوحدة الأساسية (كيلو للوزن، لتر للسوائل، حبة لما عدا ذلك)
const UNIT_OPTIONS = [
  // وزن
  { label: 'كيلوجرام', symbol: 'كجم', factor: 1 },
  { label: 'جرام', symbol: 'جم', factor: 0.001 },
  { label: 'مليجرام', symbol: 'مجم', factor: 0.000001 },
  // حجم
  { label: 'لتر', symbol: 'ل', factor: 1 },
  { label: 'مليلتر', symbol: 'مل', factor: 0.001 },
  // عدد
  { label: 'حبة', symbol: 'حبة', factor: 1 },
  { label: 'ملعقة كبيرة', symbol: 'م.ك', factor: 1 },
  { label: 'ملعقة صغيرة', symbol: 'م.ص', factor: 1 },
  { label: 'كوب', symbol: 'كوب', factor: 1 },
  { label: 'علبة', symbol: 'علبة', factor: 1 },
  { label: 'كيس', symbol: 'كيس', factor: 1 },
]

// حساب تكلفة المكون مع مراعاة وحدة الوصفة vs وحدة المستودع
function calcIngCost(ing: any): number {
  const basePrice = ing.warehouse_products?.last_purchase_price || 0
  const qty = ing.quantity || 0
  const factor = ing.unit_conversion ?? 1
  return basePrice * qty * factor
}

// ══ Ingredients Modal ══
function IngredientsModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { isAr } = useLang()

  const [ingredients, setIngredients] = useState<any[]>([])
  const [products, setProducts]       = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [quantities, setQuantities]   = useState<Record<string, string>>({})
  const [search, setSearch]           = useState<Record<string, string>>({})
  const searchRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      setSearch(prev => {
        const open = Object.keys(prev)
        if (!open.length) return prev
        const still = open.filter(id => searchRefs.current[id]?.contains(e.target as Node))
        if (still.length === open.length) return prev
        const next = { ...prev }
        open.forEach(id => { if (!still.includes(id)) delete next[id] })
        return next
      })
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [])

  const fetchIngredients = useCallback(async () => {
    const { data } = await sb
      .from('menu_item_ingredients')
      .select('*, warehouse_products(id, name, category, last_purchase_price, units(symbol))')
      .eq('menu_item_id', item.id)
    const rows = data || []
    setIngredients(rows)
    setQuantities(prev => {
      const next = { ...prev }
      rows.forEach((r: any) => { if (!(r.id in next)) next[r.id] = r.quantity?.toString() ?? '' })
      return next
    })
  }, [item.id, sb])

  useEffect(() => {
    Promise.all([
      sb.from('menu_item_ingredients')
        .select('*, warehouse_products(id, name, category, last_purchase_price, units(symbol))')
        .eq('menu_item_id', item.id),
      sb.from('warehouse_products')
        .select('id, name, category, last_purchase_price, units(symbol)')
        .eq('is_active', true).order('category').order('name'),
    ]).then(([ing, prods]) => {
      const rows = ing.data || []
      setIngredients(rows)
      setQuantities(Object.fromEntries(rows.map((r: any) => [r.id, r.quantity?.toString() ?? ''])))
      setProducts(prods.data || [])
      setLoading(false)
    })
  }, [item.id, sb])

  async function addIngredient() {
    const { data } = await sb.from('menu_item_ingredients')
      .insert([{ menu_item_id: item.id, quantity: 1, unit_label: null, unit_conversion: 1 }])
      .select('*, warehouse_products(id, name, category, last_purchase_price, units(symbol))')
    if (data?.[0]) {
      setIngredients(p => [...p, data[0]])
      setQuantities(p => ({ ...p, [data[0].id]: '1' }))
    }
  }

  async function updateField(id: string, field: string, value: any) {
    await sb.from('menu_item_ingredients').update({ [field]: value }).eq('id', id)
    await fetchIngredients()
  }

  async function saveQuantity(id: string) {
    const val = parseFloat(quantities[id] ?? '0') || 0
    await sb.from('menu_item_ingredients').update({ quantity: val }).eq('id', id)
    setIngredients(p => p.map(i => i.id === id ? { ...i, quantity: val } : i))
  }

  async function updateUnit(ing: any, symbol: string, factor: number) {
    await sb.from('menu_item_ingredients')
      .update({ unit_label: symbol, unit_conversion: factor })
      .eq('id', ing.id)
    setIngredients(p => p.map(i =>
      i.id === ing.id ? { ...i, unit_label: symbol, unit_conversion: factor } : i
    ))
  }

  async function deleteIng(id: string) {
    await sb.from('menu_item_ingredients').delete().eq('id', id)
    setIngredients(p => p.filter(i => i.id !== id))
    setQuantities(p => { const n = { ...p }; delete n[id]; return n })
  }

  const totalCost = ingredients.reduce((s, ing) => {
    const qty = parseFloat(quantities[ing.id] ?? ing.quantity ?? 0)
    return s + (ing.warehouse_products?.last_purchase_price || 0) * qty * (ing.unit_conversion ?? 1)
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
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 720, padding: 28, margin: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{isAr ? '🧪 مكونات الوصفة' : '🧪 Recipe Ingredients'}</h2>
            <p style={{ fontSize: 13, color: S.muted }}>{item.name} — {item.name_en}</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: S.redB, border: `1px solid ${S.red}30`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🏭 تكلفة المكونات</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: S.red }}>MYR {totalCost.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style={{ background: S.gold3, border: `1px solid ${S.gold}30`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>💰 سعر البيع</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: S.gold }}>MYR {(item.price || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
              ? `✅ ربح MYR ${(item.price - totalCost).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} لكل وجبة`
              : `❌ خسارة MYR ${(totalCost - item.price).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} لكل وجبة — يجب مراجعة السعر أو التكاليف`}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>{ingredients.length} مكون</div>
          <button onClick={addIngredient} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {isAr ? '➕ إضافة مكون' : '➕ Add Ingredient'}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>{isAr ? '⏳ جاري التحميل...' : '⏳ Loading...'}</div>
        ) : ingredients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: S.card, borderRadius: 14, color: S.muted }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧪</div>
            <div style={{ fontSize: 14, color: S.white, marginBottom: 6 }}>لا توجد مكونات بعد</div>
            <div style={{ fontSize: 12 }}>{isAr ? 'اضغط "إضافة مكون" لتحديد مكونات هذا الصنف من المستودع' : 'Click "Add Ingredient" to link ingredients from warehouse'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ingredients.map((ing) => {
              const baseUnit    = ing.warehouse_products?.units?.symbol || 'وحدة'
              const displayUnit = ing.unit_label || baseUnit
              const localQty    = quantities[ing.id] ?? ing.quantity?.toString() ?? ''
              const numQty      = parseFloat(localQty) || 0
              const ingCost     = (ing.warehouse_products?.last_purchase_price || 0) * numQty * (ing.unit_conversion ?? 1)

              return (
                <div key={ing.id} style={{ background: S.card, borderRadius: 12, padding: '14px 16px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 10, alignItems: 'start' }}>

                  {/* المكون */}
                  <div ref={el => { searchRefs.current[ing.id] = el }}>
                    <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>المكون من المستودع</label>
                    {ing.warehouse_product_id && !(ing.id in search) ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: S.white }}>
                          {products.find(p => p.id === ing.warehouse_product_id)?.name || '—'}
                        </div>
                        <button
                          onClick={() => setSearch(p => ({ ...p, [ing.id]: '' }))}
                          style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
                          تغيير
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          autoFocus
                          style={{ ...inpS, direction: 'rtl' }}
                          placeholder={isAr ? "🔍 ابحث عن مكون..." : "🔍 Search ingredient..."}
                          value={search[ing.id] || ''}
                          onChange={e => setSearch(p => ({ ...p, [ing.id]: e.target.value }))}
                        />
                        <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 8, maxHeight: 200, overflowY: 'auto', zIndex: 100, marginTop: 2 }}>
                          {(() => {
                            const q = (search[ing.id] || '').trim()
                            const filtered = products.filter((p: any) =>
                              !q || p.name.includes(q) || (p.category || '').includes(q)
                            ).slice(0, 10)
                            return filtered.length > 0 ? filtered.map((p: any) => (
                              <div key={p.id}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { updateField(ing.id, 'warehouse_product_id', p.id); setSearch(prev => { const n = { ...prev }; delete n[ing.id]; return n }) }}
                                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${S.border}`, fontSize: 12 }}
                                onMouseEnter={e => (e.currentTarget.style.background = S.card2)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <div style={{ color: S.white, fontWeight: 600 }}>{p.name}</div>
                                <div style={{ color: S.muted, fontSize: 11 }}>{p.category} — MYR {p.last_purchase_price || 0}/{p.units?.symbol || 'وحدة'}</div>
                              </div>
                            )) : <div style={{ padding: '10px 12px', color: S.muted, fontSize: 12 }}>لا توجد نتائج</div>
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* الكمية */}
                  <div>
                    <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية</label>
                    <input
                      type="number" min="0" step="0.01"
                      style={{ ...inpS, direction: 'ltr', textAlign: 'center' }}
                      value={localQty}
                      onChange={e => setQuantities(p => ({ ...p, [ing.id]: e.target.value }))}
                      onBlur={() => saveQuantity(ing.id)}
                    />
                  </div>

                  {/* الوحدة */}
                  <div>
                    <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>
                      الوحدة
                      {ing.unit_label && ing.unit_label !== baseUnit && (
                        <span style={{ color: S.gold, marginRight: 4 }}>({baseUnit} أساسي)</span>
                      )}
                    </label>
                    <select
                      style={{ ...inpS, cursor: 'pointer' }}
                      value={ing.unit_label || baseUnit}
                      onChange={e => {
                        const opt = UNIT_OPTIONS.find(u => u.symbol === e.target.value)
                        updateUnit(ing, e.target.value, opt?.factor ?? 1)
                      }}
                    >
                      {!UNIT_OPTIONS.find(u => u.symbol === baseUnit) && (
                        <option value={baseUnit}>{baseUnit} (أساسي)</option>
                      )}
                      {UNIT_OPTIONS.map(u => (
                        <option key={u.symbol} value={u.symbol}>{u.label} ({u.symbol})</option>
                      ))}
                    </select>
                    {ing.unit_label && ing.unit_label !== baseUnit && (
                      <div style={{ fontSize: 10, color: S.teal, marginTop: 3 }}>×{ing.unit_conversion} تحويل</div>
                    )}
                  </div>

                  {/* التكلفة */}
                  <div style={{ textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>التكلفة</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.red }}>
                      {ingCost > 0 ? 'MYR ' + ingCost.toFixed(3) : '—'}
                    </div>
                    {ing.unit_label && ing.unit_label !== baseUnit && numQty > 0 && (
                      <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>
                        {numQty}{displayUnit} = {(numQty * (ing.unit_conversion ?? 1)).toFixed(4)}{baseUnit}
                      </div>
                    )}
                  </div>

                  {/* حذف */}
                  <button onClick={() => deleteIng(ing.id)}
                    style={{ padding: '8px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 14, marginTop: 18, alignSelf: 'start' }}>
                    🗑️
                  </button>

                </div>
              )
            })}
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
  const { isAr } = useLang()
  const [lang] = useState<'ar'|'en'>(() => typeof window !== 'undefined' ? (localStorage.getItem('dashboard-lang') as 'ar'|'en' || 'ar') : 'ar')
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
  const [pageSize, setPageSize] = useState(50)
  // ✅ الأكثر طلباً — يُحسب من الطلبات المدفوعة فعلياً عبر RPC app_menu_top_items
  const [topOrders, setTopOrders] = useState<{ menu_item_id: string; times_ordered: number; units: number }[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [cats, itms, top] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('id, category_id, name, name_en, name_ms, or_code, description, description_en, description_ms, price, cost_price, discount_percent, is_active, is_available, sort_order, image_url, menu_categories(name,name_en,icon)').eq('is_active', true).order('sort_order').order('name'),
      supabase.rpc('app_menu_top_items', { p_limit: 10, p_days: 90 }),
    ])
    const catsWithCount = (cats.data || []).map(c => ({
      ...c,
      item_count: (itms.data || []).filter(i => i.category_id === c.id).length
    }))
    setCategories(catsWithCount)
    setItems(itms.data || [])
    if (top.error) console.warn('app_menu_top_items:', top.error.message)
    setTopOrders((top.data as any) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    fetchAll()
  }

  async function deleteItem(id: string) {
    if (!confirm(isAr ? 'هل تريد حذف هذا الصنف؟' : 'Delete this item?')) return
    await supabase.from('menu_items').update({ is_active: false }).eq('id', id)
    fetchAll()
  }

  // ✅ تعديل كود الصنف (OR-code) مباشرة من الكارت - بيمنع التكرار وبيحسب ترتيب العرض من الرقم اللي في الكود
  async function updateItemCode(item: MenuItem, newCode: string) {
    const trimmed = newCode.trim()
    if (!trimmed || trimmed === (item.or_code || '')) return
    const duplicate = items.find(i => i.id !== item.id && (i.or_code || '') === trimmed)
    if (duplicate) {
      alert(isAr
        ? `⚠️ الكود "${trimmed}" مستخدم بالفعل للصنف "${duplicate.name}". اختر كود تاني.`
        : `⚠️ Code "${trimmed}" is already used by "${duplicate.name}". Choose another.`)
      fetchAll()
      return
    }
    const numMatch = trimmed.match(/(\d+)/)
    const derivedSortOrder = numMatch ? parseInt(numMatch[1], 10) : (item.sort_order ?? 0)
    await supabase.from('menu_items').update({ or_code: trimmed, sort_order: derivedSortOrder }).eq('id', item.id)
    fetchAll()
  }

  // ✅ تعديل رقم ترتيب القسم يدويًا - بيمنع التكرار بين كل الأقسام
  async function updateCategorySortOrder(cat: Category, newValue: number) {
    if (isNaN(newValue)) return
    if (newValue === (cat.sort_order ?? 0)) return
    const duplicate = categories.find(c => c.id !== cat.id && (c.sort_order ?? 0) === newValue)
    if (duplicate) {
      alert(isAr
        ? `⚠️ الرقم ${newValue} مستخدم بالفعل للقسم "${duplicate.name}". اختر رقم تاني.`
        : `⚠️ Number ${newValue} is already used by category "${duplicate.name}". Choose another number.`)
      fetchAll()
      return
    }
    await supabase.from('menu_categories').update({ sort_order: newValue }).eq('id', cat.id)
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
  useEffect(() => { setPage(1) }, [selectedCat, search, filterAvailable, pageSize])

  // Paginate
  const totalPages = pageSize === 9999 ? 1 : Math.ceil(filtered.length / pageSize)
  const paginated = pageSize === 9999 ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

  // ✅ الأكثر طلباً: نربط نتائج الـ RPC بأصناف المنيو الحالية، ونحافظ على ترتيب الـ RPC (الأعلى أولاً)
  const itemById = new Map(items.map(i => [i.id, i]))
  const topList = topOrders
    .map(t => ({ item: itemById.get(t.menu_item_id), times: t.times_ordered, units: t.units }))
    .filter((x): x is { item: MenuItem; times: number; units: number } => !!x.item)
    .slice(0, 10)

  // Stats
  const totalItems = items.length
  const availableItems = items.filter(i => i.is_available).length
  const avgPrice = items.length ? (items.reduce((s, i) => s + i.price, 0) / items.length) : 0

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
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
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'إدارة أصناف المنيو والأسعار والصور' : 'Manage menu items, prices and images'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddCat(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            📁 قسم جديد
          </button>
          <button onClick={() => setShowAddItem(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {isAr ? '➕ صنف جديد' : '➕ New Item'}
          </button>
        </div>
      </div>

      {/* ══ Stats ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: isAr ? 'إجمالي الأصناف' : 'Total Items', value: totalItems, icon: '🍽️', color: S.blue, bg: S.blueB },
          { label: isAr ? 'متاح الآن' : 'Available', value: availableItems, icon: '✅', color: S.green, bg: S.greenB },
          { label: isAr ? 'غير متاح' : 'Unavailable', value: totalItems - availableItems, icon: '⏸', color: S.red, bg: S.redB },
          { label: 'الأقسام', value: categories.length, icon: '📁', color: S.purple, bg: S.purpleB },
          { label: isAr ? 'متوسط السعر' : 'Avg Price', value: formatMYR(avgPrice), icon: '💰', color: S.gold, bg: S.gold3 },
        ].map((s, i) => (
          <div key={i} style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ══ الأكثر طلباً — أعلى 10 أصناف من الطلبات المدفوعة ══ */}
      {topList.length > 0 && selectedCat === 'all' && !search && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{isAr ? 'الأكثر طلباً' : 'Most Ordered'}</span>
            <span style={{ fontSize: 12, color: S.muted, background: S.card2, borderRadius: 20, padding: '2px 10px' }}>{isAr ? `أعلى ${topList.length} أصناف` : `Top ${topList.length}`}</span>
            <span style={{ fontSize: 11, color: S.muted }}>{isAr ? '· الطلبات المدفوعة آخر 90 يوم' : '· paid orders, last 90 days'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {topList.map(({ item, times, units }, idx) => (
              <div key={item.id} onClick={() => setEditItem(item)} style={{ background: S.navy2, borderRadius: 14, border: `2px solid rgba(201,168,76,0.25)`, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: S.gold, color: S.navy, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{idx + 1}</div>
                <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(10,22,40,0.85)', borderRadius: 8, padding: '3px 8px', fontSize: 11, color: S.gold, fontWeight: 800 }}>×{units} {isAr ? 'مرة' : ''}</div>
                <div style={{ aspectRatio: '4/3', background: S.navy3, overflow: 'hidden' }}>
                  {item.image_url ? <img src={item.image_url} loading="lazy" alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>{item.menu_categories?.icon || '🍽️'}</div>}
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 4 }}>{lang === 'en' ? (item.name_en || item.name) : item.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>{formatMYR(item.price)}</span>
                    <span style={{ fontSize: 11, color: S.muted }}>{times} {isAr ? 'طلب' : 'orders'}</span>
                  </div>
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
          {categories.map((cat) => (
            <div key={cat.id} style={{ position: 'relative' }}>
              <button
                onClick={() => setSelectedCat(selectedCat === cat.id ? 'all' : cat.id)}
                style={{
                  width: '100%',
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
              <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 3 }} onClick={(e) => e.stopPropagation()}>
                <input
                  key={`cat-sort-${cat.id}-${cat.sort_order}`}
                  type="number"
                  defaultValue={cat.sort_order ?? 0}
                  onBlur={(e) => updateCategorySortOrder(cat, parseInt(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  title={isAr ? 'رقم ترتيب القسم' : 'Category sort number'}
                  style={{ width: 38, padding: '2px 4px', borderRadius: 6, border: `1px solid ${S.border}`, background: 'rgba(10,22,40,0.9)', color: S.gold, fontSize: 11, textAlign: 'center', fontWeight: 700 }}
                />
              </div>
            </div>
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
          placeholder={isAr ? "🔍 بحث بالاسم أو الكود أو الإنجليزي..." : "🔍 Search by name, code or English..."}
        />
        <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={filterAvailable} onChange={e => setFilterAvailable(e.target.value as 'all' | 'available' | 'unavailable')}>
          <option value="all">{isAr ? "كل الأصناف" : "All Items"}</option>
          <option value="available">{isAr ? "متاح فقط" : "Available only"}</option>
          <option value="unavailable">{isAr ? "غير متاح" : "Unavailable"}</option>
        </select>
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          <button onClick={() => setView('grid')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'grid' ? S.gold3 : 'transparent', color: view === 'grid' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>⊞</button>
          <button onClick={() => setView('list')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'list' ? S.gold3 : 'transparent', color: view === 'list' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>☰</button>
        </div>
        <div style={{ fontSize: 12, color: S.muted }}>{filtered.length} صنف{totalPages > 1 && ` • ص${page}/${totalPages}`}</div>
      </div>

      {/* ══ Items ══ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>{isAr ? '⏳ جاري التحميل...' : '⏳ Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد أصناف</div>
          <div style={{ fontSize: 13 }}>{isAr ? 'اضغط "صنف جديد" لإضافة أول صنف' : 'Click "New Item" to add your first item'}</div>
        </div>
      ) : view === 'grid' ? (
        /* Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, alignItems: 'stretch' }}>
          {paginated.map(item => (
            <div key={item.id} className="item-card" style={{
              background: S.navy2, borderRadius: 16,
              border: `1px solid ${item.is_available ? S.border : S.redB}`,
              overflow: 'hidden', position: 'relative',
              display: 'flex', flexDirection: 'column', height: '100%',
            }}>
              {/* صورة */}
              <div style={{ aspectRatio: '4/3', background: S.navy3, position: 'relative', overflow: 'hidden' }}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                    {item.menu_categories?.icon || '🍽️'}
                  </div>
                )}
                {/* Availability Badge */}
                <div style={{ position: 'absolute', top: 8, right: 8, background: item.is_available ? S.greenB : S.redB, border: `1px solid ${item.is_available ? S.green : S.red}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: item.is_available ? S.green : S.red, backdropFilter: 'blur(8px)' }}>
                  {item.is_available ? (isAr ? '✅ متاح' : '✅ Available') : (isAr ? '⏸ غير متاح' : '⏸ Unavailable')}
                </div>
                {/* OR Code */}
                {item.or_code && (
                  <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(10,22,40,0.85)', borderRadius: 8, padding: '3px 8px', fontSize: 10, color: S.gold, fontWeight: 700 }}>
                    {item.or_code}
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 2 }}>{lang === 'en' ? (item.name_en || item.name) : item.name}</div>
                <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic', marginBottom: 6 }}>{lang === 'en' ? item.name : (item.name_en || '')}</div>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, lineHeight: 1.5, height: 32, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {(lang === 'en' ? item.description_en : item.description) || ' '}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    {item.discount_percent && item.discount_percent > 0 ? (
                      <>
                        <div style={{ fontSize: 11, color: S.muted, textDecoration: 'line-through' }}>{formatMYR(item.price)}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: S.green }}>{formatMYR(item.price * (1 - item.discount_percent / 100))} <span style={{ fontSize: 10, background: S.redB, color: S.red, borderRadius: 20, padding: '2px 6px' }}>-{item.discount_percent}%</span></div>
                      </>
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>{formatMYR(item.price)}</div>
                    )}
                    {item.sizes && item.sizes.length > 0 && <div style={{ fontSize: 10, color: S.blue, marginTop: 2 }}>📏 {item.sizes.length} {lang === 'en' ? 'sizes' : 'أحجام'}</div>}
                  </div>
                  {item.cost_price > 0 && <div style={{ fontSize: 10, color: S.muted }}>{lang === 'en' ? 'Cost:' : 'تكلفة:'} {formatMYR(item.cost_price)}</div>}
                </div>

                {/* Category Tag */}
                <div style={{ fontSize: 10, color: S.muted, background: S.card, borderRadius: 8, padding: '3px 8px', display: 'inline-block', marginBottom: 10 }}>
                  {item.menu_categories?.icon} {item.menu_categories?.name}
                </div>

                <div style={{ flex: 1 }} />
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                  <button onClick={() => setEditItem(item)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 34 }}>{isAr ? '✏️ تعديل' : '✏️ Edit'}</button>
                  <button onClick={() => setIngredientsItem(item)} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🧪</button>
                  <button onClick={() => toggleAvailable(item)} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${item.is_available ? S.amber : S.green}`, background: item.is_available ? S.amberB : S.greenB, color: item.is_available ? S.amber : S.green, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.is_available ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => deleteItem(item.id)} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🗑️</button>
</div>
                {(() => {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: S.muted }}>{isAr ? 'الكود:' : 'Code:'}</span>
                      <input
                        key={`item-code-${item.id}-${item.or_code}`}
                        type="text"
                        defaultValue={item.or_code || ''}
                        onBlur={(e) => updateItemCode(item, e.target.value)}
                        style={{ width: 70, padding: '5px 6px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.card, color: S.gold, fontSize: 12, textAlign: 'center', fontWeight: 700, direction: 'ltr' }}
                      />
                    </div>
                  )
                })()}
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
                  {[isAr ? 'الصنف' : 'Item', isAr ? 'القسم' : 'Category', isAr ? 'الكود' : 'Code', isAr ? 'سعر البيع' : 'Price', isAr ? 'التكلفة' : 'Cost', isAr ? 'الهامش' : 'Margin', isAr ? 'الحالة' : 'Status', ''].map(h => (
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
                           <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{item.name_en}</div>
                           <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic' }}>{item.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: S.card2, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: S.muted }}>
                          {item.menu_categories?.icon} {item.menu_categories?.name}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input
                          key={`item-code-list-${item.id}-${item.or_code}`}
                          type="text"
                          defaultValue={item.or_code || ''}
                          onBlur={(e) => updateItemCode(item, e.target.value)}
                          style={{ width: 80, padding: '5px 6px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.gold, fontSize: 12, fontWeight: 600, direction: 'ltr' }}
                        />
                      </td>
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
                          {item.is_available ? (isAr ? '✅ متاح' : '✅ Available') : (isAr ? '⏸ غير متاح' : '⏸ Unavailable')}
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
      <Pagination page={page} total={filtered.length} totalPages={totalPages} onChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />

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
