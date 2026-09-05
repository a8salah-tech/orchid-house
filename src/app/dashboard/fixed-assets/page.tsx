'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
  white: '#F5F7FA', muted: '#8A93A6', border: 'rgba(255,255,255,0.08)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  green: '#3DDC84', greenB: 'rgba(61,220,132,0.12)',
  red: '#E5484D', redB: 'rgba(229,72,77,0.12)',
  amber: '#F0A93A', amberB: 'rgba(240,169,58,0.12)',
  blue: '#4B9EF0', blueB: 'rgba(75,158,240,0.12)',
}

function employeeBranchId(e: any): string { return e?.branch_id || '' }
function fullEmployeeName(e: any): string {
  if (!e) return ''
  return [e?.name, e?.name_en].filter(Boolean).join(' ')
}
function normalizeSearchText(s: string | null | undefined): string { return (s || '').trim().toLowerCase() }
function matchesSearch(text: string | null | undefined, query: string): boolean {
  if (!query.trim()) return true
  return normalizeSearchText(text).includes(normalizeSearchText(query))
}

interface Branch { id: string; name: string }
interface FixedAsset {
  id: string; name: string; name_en?: string | null; category?: string | null
  description?: string | null; image_url?: string | null; is_active: boolean
  // ✅ جديد: سعر الأصل - يضيفه/يعدّله مدير المستودعات، ويظهر له وللأدمن فقط
  price?: number | null
}
interface TransferRequest {
  id: string; request_number: number; branch_id: string; requested_by_name: string
  status: string; notes?: string | null; handover_image_url?: string | null
  approved_by_name?: string | null; approved_at?: string | null; created_at: string
  branches?: { name: string }
  items?: { id: string; asset_id: string; quantity_requested: number; quantity_approved?: number | null; fixed_assets?: { name: string; image_url?: string | null } }[]
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '⏳ بانتظار الموافقة', color: S.amber, bg: S.amberB },
  approved: { label: '✅ تم التنفيذ', color: S.green, bg: S.greenB },
  rejected: { label: '❌ مرفوض', color: S.red, bg: S.redB },
}

const inp: React.CSSProperties = {
  width: '100%', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10,
  padding: '10px 12px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function pickImage(file: File, setFile: (f: File) => void, setPreview: (p: string) => void) {
  setFile(file)
  const reader = new FileReader()
  reader.onload = () => setPreview(reader.result as string)
  reader.readAsDataURL(file)
}

// ══ Modal: إضافة/تعديل أصل في الكتالوج (لأمين المستودع) ══
// ✅ Fix: بدل حقل كمية ثابت للمستودع الرئيسي بس، دلوقتي بتختار "الموقع" (مستودع رئيسي أو أحد
// الفرعين) من قائمة، والكمية بتتغيّر تلقائيًا لتعرض رصيد الموقع المختار - وبتُحفظ لنفس الموقع بس
function AssetFormModal({ asset, allBranches, stockByAsset, onClose, onSaved }: {
  asset?: FixedAsset | null; allBranches: { id: string; name: string }[]
  stockByAsset: Record<string, { mainWarehouse: number; branchQty: Record<string, number> }>
  onClose: () => void; onSaved: () => void
}) {
  const sb = createClient()
  const [name, setName] = useState(asset?.name || '')
  const [nameEn, setNameEn] = useState(asset?.name_en || '')
  const [category, setCategory] = useState(asset?.category || '')
  const [description, setDescription] = useState(asset?.description || '')
  // ✅ Fix: السعر بقى إجباري بدل اختياري
  const [price, setPrice] = useState(asset?.price != null ? String(asset.price) : '')
  // ✅ جديد: الموقع المختار لإدخال/تعديل كميته - 'main' أو معرّف فرع
  const [location, setLocation] = useState<string>('main')
  const currentQtyForLocation = !asset ? 0
    : location === 'main' ? (stockByAsset[asset.id]?.mainWarehouse ?? 0)
    : (stockByAsset[asset.id]?.branchQty[location] ?? 0)
  const [qty, setQty] = useState(String(currentQtyForLocation))
  // ✅ لما يغيّر الموقع المختار، نحدّث الكمية المعروضة لرصيد الموقع الجديد تلقائيًا
  useEffect(() => { setQty(String(currentQtyForLocation)) }, [location])
  const [img, setImg] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState(asset?.image_url || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) { alert('يرجى كتابة اسم الأصل'); return }
    // ✅ Fix: السعر إجباري - مفيش حفظ من غيره
    if (!price.trim()) { alert('يرجى إدخال السعر'); return }
    setSaving(true)
    let imgUrl = asset?.image_url || ''
    if (img) {
      const fileName = `fixed-assets/${Date.now()}-${img.name}`
      const { data: upData } = await sb.storage.from('employees').upload(fileName, img, { upsert: true })
      if (upData) imgUrl = sb.storage.from('employees').getPublicUrl(upData.path).data.publicUrl
    }
    const payload = {
      name: name.trim(), name_en: nameEn.trim() || null, category: category.trim() || null,
      description: description.trim() || null, image_url: imgUrl || null,
      price: parseFloat(price),
    }
    const { data: savedAsset, error } = asset
      ? await sb.from('fixed_assets').update(payload).eq('id', asset.id).select().single()
      : await sb.from('fixed_assets').insert([{ ...payload, is_active: true }]).select().single()
    if (error || !savedAsset) { setSaving(false); alert('خطأ: ' + (error?.message || '')); return }
    // ✅ جديد: حفظ كمية الموقع المختار بس (مستودع رئيسي أو فرع محدد) - مش كل المواقع مرة واحدة
    const qtyValue = Math.max(0, parseInt(qty) || 0)
    const isMain = location === 'main'
    let query = sb.from('fixed_asset_stock').select('id').eq('asset_id', savedAsset.id).eq('location_type', isMain ? 'main_warehouse' : 'branch')
    query = isMain ? query.is('branch_id', null) : query.eq('branch_id', location)
    const { data: existingStock } = await query.maybeSingle()
    if (existingStock) {
      await sb.from('fixed_asset_stock').update({ quantity_good: qtyValue, updated_at: new Date().toISOString() }).eq('id', existingStock.id)
    } else {
      await sb.from('fixed_asset_stock').insert([{ asset_id: savedAsset.id, location_type: isMain ? 'main_warehouse' : 'branch', branch_id: isMain ? null : location, quantity_good: qtyValue }])
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 440, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>{asset ? '✏️ تعديل أصل' : '➕ إضافة أصل جديد'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الاسم *</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="مثال: طبق تقديم كبير" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الاسم بالإنجليزية</label>
            <input style={inp} value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Serving Plate (Large)" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التصنيف</label>
            <input style={inp} value={category} onChange={e => setCategory(e.target.value)} placeholder="مثال: أدوات مائدة" />
          </div>
          <div>
            {/* ✅ Fix: السعر بقى إجباري (*) */}
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>💰 السعر (RM) *</label>
            <input type="number" min={0} step="0.01" style={inp} value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            {/* ✅ جديد: اختيار الموقع (مستودع رئيسي أو أحد الفرعين) لإدخال/تعديل كميته */}
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📦 الكمية في</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={location} onChange={e => setLocation(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="main">🏭 المستودع الرئيسي</option>
                {allBranches.map(b => <option key={b.id} value={b.id}>🏪 {b.name}</option>)}
              </select>
              <input type="number" min={0} value={qty} onChange={e => setQty(e.target.value)} style={{ ...inp, width: 90 }} placeholder="0" />
            </div>
            {!asset && <div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>💡 لو عايز تدخل كمية لموقع تاني، احفظ الأصل الأول ثم عدّله واختار الموقع التاني</div>}
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>التفاصيل</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="اختياري..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📷 الصورة</label>
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && pickImage(e.target.files[0], setImg, setImgPreview)} style={{ fontSize: 12, color: S.white }} />
            {imgPreview && <img src={imgPreview} alt={name} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />}
          </div>
          <button onClick={save} disabled={saving}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, marginTop: 6 }}>
            {saving ? '⏳ جارٍ الحفظ...' : (asset ? '💾 حفظ التعديلات' : '➕ إضافة الأصل')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Modal: طلب تحويل جديد (للمشرف/مدير القسم) ══
function NewTransferModal({ assets, currentEmployee, onClose, onSaved }: {
  assets: FixedAsset[]; currentEmployee: any; onClose: () => void; onSaved: () => void
}) {
  const sb = createClient()
  const [items, setItems] = useState<{ asset_id: string; qty: string }[]>([{ asset_id: '', qty: '' }])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function addRow() { setItems(p => [...p, { asset_id: '', qty: '' }]) }
  function removeRow(i: number) { setItems(p => p.filter((_, idx) => idx !== i)) }
  function updateRow(i: number, field: 'asset_id' | 'qty', value: string) {
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }

  async function save() {
    const validItems = items.filter(it => it.asset_id && parseInt(it.qty) > 0)
    if (validItems.length === 0) { alert('يرجى إضافة صنف واحد على الأقل بكمية صحيحة'); return }
    const branchId = employeeBranchId(currentEmployee)
    if (!branchId) { alert('لا يوجد فرع مرتبط بحسابك'); return }
    setSaving(true)
    const { data: req, error } = await sb.from('fixed_asset_transfer_requests').insert([{
      branch_id: branchId, requested_by: currentEmployee?.id || null,
      requested_by_name: fullEmployeeName(currentEmployee) || 'غير معروف',
      notes: notes.trim() || null, status: 'pending',
    }]).select().single()
    if (error || !req) { setSaving(false); alert('خطأ: ' + (error?.message || '')); return }
    const rows = validItems.map(it => ({ request_id: req.id, asset_id: it.asset_id, quantity_requested: parseInt(it.qty) }))
    const { error: itemsErr } = await sb.from('fixed_asset_transfer_items').insert(rows)
    setSaving(false)
    if (itemsErr) { alert('خطأ: ' + itemsErr.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>📦 طلب تحويل أصول جديد</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <select value={it.asset_id} onChange={e => updateRow(i, 'asset_id', e.target.value)} style={{ ...inp, flex: 2 }}>
                <option value="">اختر الصنف...</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="number" min={1} value={it.qty} onChange={e => updateRow(i, 'qty', e.target.value)} placeholder="الكمية" style={{ ...inp, flex: 1 }} />
              {items.length > 1 && (
                <button onClick={() => removeRow(i)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 18 }}>✕</button>
              )}
            </div>
          ))}
          <button onClick={addRow} style={{ padding: '8px', borderRadius: 8, border: `1px dashed ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12 }}>+ إضافة صنف آخر</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري..." />
        </div>
        <button onClick={save} disabled={saving}
          style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          {saving ? '⏳ جارٍ الإرسال...' : '📨 إرسال طلب التحويل'}
        </button>
      </div>
    </div>
  )
}

// ══ Modal: موافقة وتنفيذ التحويل (لأمين المستودع) - صورة تسليم إجبارية ══
function ApproveTransferModal({ req, onClose, onUpdate }: { req: TransferRequest; onClose: () => void; onUpdate: () => void }) {
  const sb = createClient()
  const [approvedQtys, setApprovedQtys] = useState<Record<string, string>>(
    Object.fromEntries((req.items || []).map(it => [it.id, String(it.quantity_requested)]))
  )
  const [handoverImg, setHandoverImg] = useState<File | null>(null)
  const [handoverPreview, setHandoverPreview] = useState('')
  const [saving, setSaving] = useState(false)

  async function approve() {
    if (!handoverImg) { alert('يرجى إرفاق صورة التسليم (إثبات تسليم الأصول للفرع)'); return }
    setSaving(true)
    const fileName = `fixed-assets/handover-${req.id}-${Date.now()}.jpg`
    const { data: upData } = await sb.storage.from('employees').upload(fileName, handoverImg, { upsert: true })
    if (!upData) { setSaving(false); alert('تعذّر رفع صورة التسليم'); return }
    const handoverUrl = sb.storage.from('employees').getPublicUrl(upData.path).data.publicUrl
    for (const it of (req.items || [])) {
      const qty = parseInt(approvedQtys[it.id] || '0') || 0
      await sb.from('fixed_asset_transfer_items').update({ quantity_approved: qty }).eq('id', it.id)
      // ✅ جديد: تحديث الرصيد الفعلي - خصم الكمية من المستودع الرئيسي وإضافتها لرصيد الفرع
      if (qty > 0) {
        const { data: mainRow } = await sb.from('fixed_asset_stock').select('id, quantity_good').eq('asset_id', it.asset_id).eq('location_type', 'main_warehouse').is('branch_id', null).maybeSingle()
        if (mainRow) {
          await sb.from('fixed_asset_stock').update({ quantity_good: Math.max(0, (mainRow.quantity_good || 0) - qty), updated_at: new Date().toISOString() }).eq('id', mainRow.id)
        }
        const { data: branchRow } = await sb.from('fixed_asset_stock').select('id, quantity_good').eq('asset_id', it.asset_id).eq('location_type', 'branch').eq('branch_id', req.branch_id).maybeSingle()
        if (branchRow) {
          await sb.from('fixed_asset_stock').update({ quantity_good: (branchRow.quantity_good || 0) + qty, updated_at: new Date().toISOString() }).eq('id', branchRow.id)
        } else {
          await sb.from('fixed_asset_stock').insert([{ asset_id: it.asset_id, location_type: 'branch', branch_id: req.branch_id, quantity_good: qty }])
        }
      }
    }
    await sb.from('fixed_asset_transfer_requests').update({
      status: 'approved', handover_image_url: handoverUrl, approved_at: new Date().toISOString(),
    }).eq('id', req.id)
    setSaving(false)
    onUpdate()
  }

  async function reject() {
    if (!confirm('تأكيد رفض هذا الطلب؟')) return
    setSaving(true)
    await sb.from('fixed_asset_transfer_requests').update({ status: 'rejected' }).eq('id', req.id)
    setSaving(false)
    onUpdate()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 460, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>📦 طلب #{req.request_number}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: S.muted, marginBottom: 14 }}>
          🏪 {req.branches?.name} — 👤 {req.requested_by_name} — {fmtDate(req.created_at)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {(req.items || []).map(it => (
            <div key={it.id} style={{ background: S.card, borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: S.white }}>{it.fixed_assets?.name} <span style={{ color: S.muted }}>(طلب {it.quantity_requested})</span></span>
              <input type="number" min={0} value={approvedQtys[it.id] || ''} onChange={e => setApprovedQtys(p => ({ ...p, [it.id]: e.target.value }))}
                style={{ width: 70, textAlign: 'center', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '5px 6px', fontSize: 12, color: S.white, outline: 'none' }} />
            </div>
          ))}
        </div>
        {req.notes && <div style={{ fontSize: 12, color: S.amber, marginBottom: 14 }}>📝 {req.notes}</div>}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📷 صورة التسليم (إجبارية) *</label>
          <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && pickImage(e.target.files[0], setHandoverImg, setHandoverPreview)} style={{ fontSize: 12, color: S.white }} />
          {handoverPreview && <img src={handoverPreview} alt="صورة التسليم" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={approve} disabled={saving}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '✅ تنفيذ وتسليم'}
          </button>
          <button onClick={reject} disabled={saving}
            style={{ padding: '11px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ❌ رفض
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Modal: بلاغ تالف/مفقود ══
function DamageReportModal({ assets, currentEmployee, onClose, onSaved }: {
  assets: FixedAsset[]; currentEmployee: any; onClose: () => void; onSaved: () => void
}) {
  const sb = createClient()
  const [assetId, setAssetId] = useState('')
  const [qty, setQty] = useState('1')
  const [status, setStatus] = useState<'damaged' | 'lost'>('damaged')
  const [notes, setNotes] = useState('')
  const [img, setImg] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!assetId) { alert('يرجى اختيار الصنف'); return }
    if (!img) { alert('يرجى إرفاق صورة كإثبات'); return }
    const branchId = employeeBranchId(currentEmployee)
    setSaving(true)
    const fileName = `fixed-assets/damage-${Date.now()}.jpg`
    const { data: upData } = await sb.storage.from('employees').upload(fileName, img, { upsert: true })
    if (!upData) { setSaving(false); alert('تعذّر رفع الصورة'); return }
    const imgUrl = sb.storage.from('employees').getPublicUrl(upData.path).data.publicUrl
    const { error } = await sb.from('fixed_asset_damage_reports').insert([{
      asset_id: assetId, branch_id: branchId || null, quantity: parseInt(qty) || 1, status,
      image_url: imgUrl, reported_by: currentEmployee?.id || null,
      reported_by_name: fullEmployeeName(currentEmployee) || 'غير معروف', notes: notes.trim() || null,
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 440, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: S.red }}>⚠️ بلاغ تالف / مفقود</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الصنف *</label>
            <select style={inp} value={assetId} onChange={e => setAssetId(e.target.value)}>
              <option value="">اختر الصنف...</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الكمية *</label>
              <input type="number" min={1} style={inp} value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الحالة *</label>
              <select style={inp} value={status} onChange={e => setStatus(e.target.value as any)}>
                <option value="damaged">🔧 تالف</option>
                <option value="lost">❓ مفقود</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📷 صورة إثبات (إجبارية) *</label>
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && pickImage(e.target.files[0], setImg, setImgPreview)} style={{ fontSize: 12, color: S.white }} />
            {imgPreview && <img src={imgPreview} alt="إثبات" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />}
          </div>
          <button onClick={save} disabled={saving}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, marginTop: 6 }}>
            {saving ? '⏳ جارٍ الإرسال...' : '📨 إرسال البلاغ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Main Page ══
export default function FixedAssetsPage() {
  const sb = createClient()
  const { employee, permissions, hasPermission } = useAuth() as any
  const isAdmin = permissions?.all === true
  // ✅ صلاحيتان: fixed_assets (عرض وطلب) و fixed_assets_manage (موافقة أمين المستودع + إدارة الكتالوج)
  const canView = isAdmin || hasPermission?.('fixed_assets') || hasPermission?.('fixed_assets_manage')
  const canManage = isAdmin || hasPermission?.('fixed_assets_manage')
  const myBranchId = employeeBranchId(employee)

  const [tab, setTab] = useState<'catalog' | 'transfers' | 'damage'>('catalog')
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [transfers, setTransfers] = useState<TransferRequest[]>([])
  const [damageReports, setDamageReports] = useState<any[]>([])
  // ✅ جديد: رصيد كل أصل في المستودع الرئيسي وكل فرع
  // ✅ Fix: كانت الفروع بتظهر بس لو عندها صف رصيد موجود فعليًا - فالفرع اللي لسه ماوصلهوش أي تحويل
  // كان بيختفي تمامًا بدل ما يظهر بصفر. دلوقتي بنجيب كل الفروع دايمًا ونعرضها كلها، وبنفهرسها
  // بالـ id (مش بس الاسم) عشان نقدر نحدّث رصيد كل فرع بدقة ونسمح بالتعديل اليدوي المباشر
  const [allBranches, setAllBranches] = useState<{ id: string; name: string }[]>([])
  const [stockByAsset, setStockByAsset] = useState<Record<string, { mainWarehouse: number; branchQty: Record<string, number> }>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAssetForm, setShowAssetForm] = useState<FixedAsset | null | 'new'>(null)
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [showDamageReport, setShowDamageReport] = useState(false)
  const [approvingReq, setApprovingReq] = useState<TransferRequest | null>(null)

  async function fetchAll() {
    setLoading(true)
    const [assetsRes, transfersRes, damageRes, stockRes, branchesRes] = await Promise.all([
      sb.from('fixed_assets').select('*').eq('is_active', true).order('name'),
      sb.from('fixed_asset_transfer_requests').select('*, branches(name), items:fixed_asset_transfer_items(id, asset_id, quantity_requested, quantity_approved, fixed_assets(name, image_url))').order('created_at', { ascending: false }),
      sb.from('fixed_asset_damage_reports').select('*, fixed_assets(name, image_url), branches(name)').order('created_at', { ascending: false }),
      // ✅ جديد: رصيد كل أصل (المستودع الرئيسي + كل فرع)
      sb.from('fixed_asset_stock').select('asset_id, location_type, branch_id, quantity_good'),
      // ✅ جديد: قائمة كل الفروع - عشان تظهر كلها دايمًا حتى لو رصيدها لسه صفر
      sb.from('branches').select('id, name').eq('is_active', true).order('name'),
    ])
    setAssets(assetsRes.data || [])
    setAllBranches(branchesRes.data || [])
    // ✅ غير الأدمن/أمين المستودع يشوفوا بس طلبات فرعهم
    let tr = transfersRes.data || []
    if (!canManage && myBranchId) tr = tr.filter((r: any) => r.branch_id === myBranchId)
    setTransfers(tr as TransferRequest[])
    let dr = damageRes.data || []
    if (!canManage && myBranchId) dr = dr.filter((r: any) => r.branch_id === myBranchId)
    setDamageReports(dr)
    // ✅ جديد: تجميع الرصيد حسب الصنف - المستودع الرئيسي رقم واحد، وكل فرع مفهرس بالـ id
    const stockMap: Record<string, { mainWarehouse: number; branchQty: Record<string, number> }> = {}
    for (const row of (stockRes.data || [])) {
      const s = row as any
      if (!stockMap[s.asset_id]) stockMap[s.asset_id] = { mainWarehouse: 0, branchQty: {} }
      if (s.location_type === 'main_warehouse') stockMap[s.asset_id].mainWarehouse += s.quantity_good || 0
      else if (s.branch_id) stockMap[s.asset_id].branchQty[s.branch_id] = (stockMap[s.asset_id].branchQty[s.branch_id] || 0) + (s.quantity_good || 0)
    }
    setStockByAsset(stockMap)
    setLoading(false)
  }

  useEffect(() => { if (employee) fetchAll() }, [employee?.id])

  if (!canView) {
    return <div style={{ padding: 40, textAlign: 'center', color: S.muted, fontFamily: 'Tajawal, sans-serif' }}>ليس لديك صلاحية للوصول لهذه الصفحة</div>
  }

  const filteredAssets = assets.filter(a => matchesSearch(a.name, search) || matchesSearch(a.name_en, search) || matchesSearch(a.category, search))

  return (
    <div style={{ minHeight: '100vh', background: S.navy, padding: 20, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white }}>🍽️ الأصول الثابتة</h1>
          <p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{canManage ? 'إدارة كتالوج الأصول وطلبات التحويل لكل الفروع' : 'كتالوج الأصول وطلبات التحويل لفرعك'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'catalog', label: '📋 الكتالوج' },
          { id: 'transfers', label: '📦 طلبات التحويل' },
          { id: 'damage', label: '⚠️ تالف / مفقود' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '9px 18px', borderRadius: 999, border: tab === t.id ? `1px solid ${S.gold}` : `1px solid ${S.border}`, background: tab === t.id ? S.gold3 : 'transparent', color: tab === t.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ Catalog Tab ══ */}
      {tab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <input style={{ ...inp, maxWidth: 320 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ابحث عن أصل..." />
            {canManage && (
              <button onClick={() => setShowAssetForm('new')} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                + إضافة أصل جديد
              </button>
            )}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جارٍ التحميل...</div>
          ) : filteredAssets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا توجد أصول مسجّلة بعد</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {filteredAssets.map(a => (
                <div key={a.id} onClick={() => canManage && setShowAssetForm(a)}
                  style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden', cursor: canManage ? 'pointer' : 'default' }}>
                  <div style={{ width: '100%', height: 140, background: S.navy3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {a.image_url ? <img src={a.image_url} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 40, opacity: 0.3 }}>🍽️</span>}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 4 }}>{a.name}</div>
                    {a.name_en && <div style={{ fontSize: 11, color: S.muted, direction: 'ltr', textAlign: 'right', marginBottom: 4 }}>{a.name_en}</div>}
                    {a.category && <div style={{ fontSize: 10, color: S.gold, marginBottom: 6 }}>📦 {a.category}</div>}
                    {a.description && <div style={{ fontSize: 11, color: S.muted, marginBottom: 8 }}>{a.description}</div>}
                    {/* ✅ جديد: السعر - يظهر لمدير المستودعات والأدمن فقط */}
                    {canManage && a.price != null && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.green, marginBottom: 8 }}>💰 السعر: RM {Number(a.price).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    )}
                    {/* ✅ Fix: الكمية بقت للعرض فقط دايمًا - التعديل بقى حصريًا من نافذة إضافة/تعديل الأصل */}
                    <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, marginBottom: 2 }}>📊 الكمية المتاحة في:</div>
                      <div style={{ fontSize: 11, color: S.white, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>🏭 المستودع الرئيسي</span>
                        <span style={{ fontWeight: 700, color: S.gold }}>{stockByAsset[a.id]?.mainWarehouse ?? 0}</span>
                      </div>
                      {allBranches.map(b => (
                        <div key={b.id} style={{ fontSize: 11, color: S.white, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>🏪 {b.name}</span>
                          <span style={{ fontWeight: 700, color: S.blue }}>{stockByAsset[a.id]?.branchQty[b.id] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ Transfers Tab ══ */}
      {tab === 'transfers' && (
        <div>
          <div style={{ marginBottom: 18 }}>
            <button onClick={() => setShowNewTransfer(true)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              + طلب تحويل جديد
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جارٍ التحميل...</div>
          ) : transfers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا توجد طلبات تحويل بعد</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {transfers.map(r => {
                const st = STATUS_CFG[r.status] || STATUS_CFG.pending
                return (
                  <div key={r.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: S.gold }}>📦 طلب #{r.request_number} — 🏪 {r.branches?.name}</div>
                        <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>👤 {r.requested_by_name} — {fmtDate(r.created_at)}</div>
                      </div>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                      {(r.items || []).map(it => (
                        <div key={it.id} style={{ fontSize: 12, color: S.white }}>
                          • {it.fixed_assets?.name}: طُلب {it.quantity_requested}{it.quantity_approved != null && ` / سُلِّم ${it.quantity_approved}`}
                        </div>
                      ))}
                    </div>
                    {r.handover_image_url && (
                      <a href={r.handover_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: S.blue }}>🖼️ عرض صورة التسليم</a>
                    )}
                    {canManage && r.status === 'pending' && (
                      <button onClick={() => setApprovingReq(r)} style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        مراجعة وتنفيذ
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ Damage Reports Tab ══ */}
      {tab === 'damage' && (
        <div>
          <div style={{ marginBottom: 18 }}>
            <button onClick={() => setShowDamageReport(true)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              ⚠️ بلاغ تالف / مفقود
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جارٍ التحميل...</div>
          ) : damageReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا توجد بلاغات</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {damageReports.map((d: any) => (
                <div key={d.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.red}40`, overflow: 'hidden' }}>
                  <a href={d.image_url} target="_blank" rel="noreferrer">
                    <img src={d.image_url} alt={d.fixed_assets?.name} style={{ width: '100%', height: 130, objectFit: 'cover' }} />
                  </a>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{d.fixed_assets?.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: d.status === 'lost' ? S.red : S.amber }}>{d.status === 'lost' ? '❓ مفقود' : '🔧 تالف'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: S.muted }}>الكمية: {d.quantity} — 🏪 {d.branches?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 3 }}>👤 {d.reported_by_name} — {fmtDate(d.created_at)}</div>
                    {d.notes && <div style={{ fontSize: 11, color: S.white, marginTop: 6 }}>📝 {d.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAssetForm && (
        <AssetFormModal asset={showAssetForm === 'new' ? null : showAssetForm}
          allBranches={allBranches} stockByAsset={stockByAsset}
          onClose={() => setShowAssetForm(null)} onSaved={() => { setShowAssetForm(null); fetchAll() }} />
      )}
      {showNewTransfer && (
        <NewTransferModal assets={assets} currentEmployee={employee}
          onClose={() => setShowNewTransfer(false)} onSaved={() => { setShowNewTransfer(false); fetchAll() }} />
      )}
      {approvingReq && (
        <ApproveTransferModal req={approvingReq} onClose={() => setApprovingReq(null)} onUpdate={() => { setApprovingReq(null); fetchAll() }} />
      )}
      {showDamageReport && (
        <DamageReportModal assets={assets} currentEmployee={employee}
          onClose={() => setShowDamageReport(false)} onSaved={() => { setShowDamageReport(false); fetchAll() }} />
      )}
    </div>
  )
}
