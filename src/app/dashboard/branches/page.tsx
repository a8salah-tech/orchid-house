'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  teal: '#00C8C8', tealB: 'rgba(0,200,200,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
}

type Branch = { id: string; name: string; location: string | null; image_url?: string | null }
// ✅ جديد: صورة توضيحية لكل قسم (Indoor/Outdoor/Upstairs) في كل فرع — تظهر في صفحة الحجز
type SectionPhoto = { branch_id: string; section: string; image_url: string | null }
const BOOKING_SECTIONS = [
  { key: 'outdoor', label: 'الصالة الخارجية', icon: '🌿' },
  { key: 'indoor', label: 'الصالة الداخلية', icon: '❄️' },
  { key: 'upstairs', label: 'الطابق العلوي', icon: '🌅' },
]

// ✅ نفس نمط رفع صور الأصناف بالضبط — نعيد استخدام bucket menu-images الموجود بالفعل،
// بمسار فرعي "branches/" حتى لا تتداخل الأسماء مع صور المنيو
// ملحوظة: توليد الطابع الزمني (Date.now) يبقى هنا على مستوى الموديول، لا داخل جسم المكوّن،
// حتى لا تُصنَّف كدالة غير نقيّة تُستدعى أثناء الرندر (قاعدة react-hooks/purity)
async function uploadBranchImage(supabase: ReturnType<typeof createClient>, file: File, pathPrefix: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${pathPrefix}-${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true, contentType: file.type })
  if (error || !data) { console.error('uploadBranchImage:', error?.message); return null }
  const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(data.path)
  return urlData?.publicUrl || null
}

export default function BranchesPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ✅ صور الأقسام (booking_section_photos) — قد لا يكون الجدول موجودًا بعد لو SQL لسه ما اتشغلش
  const [sectionPhotos, setSectionPhotos] = useState<SectionPhoto[]>([])
  const [uploadingSectionKey, setUploadingSectionKey] = useState<string | null>(null)
  const sectionFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    // ✅ select('*') بدل تحديد الأعمدة: fail-open لو عمود image_url لسه ما اتضافش (قبل تشغيل SQL)
    const { data } = await sb.from('branches').select('*').eq('is_active', true).order('name')
    setBranches((data as Branch[]) || [])
    setLoading(false)
  }, [sb])

  const fetchSectionPhotos = useCallback(async () => {
    // fail-open: لو الجدول لسه ما اتعملش، هترجع خطأ ونتجاهله بدون كسر الصفحة
    const { data, error } = await sb.from('booking_section_photos').select('*')
    if (!error && data) setSectionPhotos(data as SectionPhoto[])
  }, [sb])

  useEffect(() => { fetchBranches(); fetchSectionPhotos() }, [fetchBranches, fetchSectionPhotos])

  async function onPickFile(branch: Branch, file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('يرجى اختيار ملف صورة'); return }
    if (file.size > 8 * 1024 * 1024) { alert('حجم الصورة كبير جدًا (الحد الأقصى 8MB)'); return }
    setUploadingId(branch.id)
    const url = await uploadBranchImage(sb, file, `branches/${branch.id}`)
    if (!url) {
      alert('فشل رفع الصورة — تأكد من إعداد bucket menu-images في Supabase')
      setUploadingId(null)
      return
    }
    const { error } = await sb.from('branches').update({ image_url: url }).eq('id', branch.id)
    setUploadingId(null)
    if (error) { alert('فشل حفظ الصورة: ' + error.message); return }
    setBranches(prev => prev.map(b => b.id === branch.id ? { ...b, image_url: url } : b))
  }

  async function removeImage(branch: Branch) {
    if (!confirm('هل تريد حذف صورة هذا الفرع؟')) return
    const { error } = await sb.from('branches').update({ image_url: null }).eq('id', branch.id)
    if (error) { alert('خطأ: ' + error.message); return }
    setBranches(prev => prev.map(b => b.id === branch.id ? { ...b, image_url: null } : b))
  }

  // ✅ رفع/حذف صورة قسم معيّن (Indoor/Outdoor/Upstairs) لفرع معيّن
  function sectionKey(branchId: string, section: string) { return `${branchId}:${section}` }

  async function onPickSectionFile(branch: Branch, section: string, file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('يرجى اختيار ملف صورة'); return }
    if (file.size > 8 * 1024 * 1024) { alert('حجم الصورة كبير جدًا (الحد الأقصى 8MB)'); return }
    const key = sectionKey(branch.id, section)
    setUploadingSectionKey(key)
    const url = await uploadBranchImage(sb, file, `branches/sections/${branch.id}-${section}`)
    if (!url) {
      alert('فشل رفع الصورة — تأكد من إعداد bucket menu-images في Supabase')
      setUploadingSectionKey(null)
      return
    }
    const { error } = await sb.from('booking_section_photos')
      .upsert({ branch_id: branch.id, section, image_url: url, updated_at: new Date().toISOString() }, { onConflict: 'branch_id,section' })
    setUploadingSectionKey(null)
    if (error) { alert('فشل حفظ صورة القسم: ' + error.message + ' — تأكد من تشغيل db/booking_section_photos.sql'); return }
    setSectionPhotos(prev => {
      const rest = prev.filter(p => !(p.branch_id === branch.id && p.section === section))
      return [...rest, { branch_id: branch.id, section, image_url: url }]
    })
  }

  async function removeSectionImage(branch: Branch, section: string) {
    if (!confirm('هل تريد حذف صورة هذا القسم؟')) return
    const { error } = await sb.from('booking_section_photos').update({ image_url: null }).eq('branch_id', branch.id).eq('section', section)
    if (error) { alert('خطأ: ' + error.message); return }
    setSectionPhotos(prev => prev.map(p => (p.branch_id === branch.id && p.section === section) ? { ...p, image_url: null } : p))
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🏪 صور الفروع</h1>
        <p style={{ fontSize: 13, color: S.muted }}>هذه الصورة تظهر للعميل في صفحة الحجز عند اختيار الفرع</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جارٍ التحميل...</div>
      ) : branches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا توجد فروع نشطة</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {branches.map(b => (
            <div key={b.id} style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ width: '100%', height: 170, position: 'relative', background: `linear-gradient(135deg, ${S.teal}20, ${S.navy3})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {b.image_url
                  ? <img src={b.image_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ fontSize: 44 }}>🏪</div>}
                {uploadingId === b.id && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: S.teal }}>⏳ جارٍ الرفع...</div>
                )}
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: S.white, marginBottom: 2 }}>{b.name}</div>
                {b.location && <div style={{ fontSize: 12, color: S.muted, marginBottom: 12 }}>📍 {b.location}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input ref={el => { fileInputRefs.current[b.id] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => onPickFile(b, e.target.files?.[0])} />
                  <button onClick={() => fileInputRefs.current[b.id]?.click()} disabled={uploadingId === b.id}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: uploadingId === b.id ? 'not-allowed' : 'pointer', fontSize: 12.5, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    📷 {b.image_url ? 'تغيير الصورة' : 'رفع صورة'}
                  </button>
                  {b.image_url && (
                    <button onClick={() => removeImage(b)}
                      style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12.5, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      🗑️
                    </button>
                  )}
                </div>

                {/* ✅ صور الأقسام (Indoor/Outdoor/Upstairs) — تظهر للعميل تحت كل قسم في صفحة الحجز */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: S.muted, marginBottom: 10 }}>🖼️ صور الأقسام في صفحة الحجز</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {BOOKING_SECTIONS.map(sec => {
                      const key = sectionKey(b.id, sec.key)
                      const photo = sectionPhotos.find(p => p.branch_id === b.id && p.section === sec.key)
                      const isUploading = uploadingSectionKey === key
                      return (
                        <div key={sec.key} style={{ display: 'flex', alignItems: 'center', gap: 8, background: S.navy3, borderRadius: 10, padding: 8 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: `${S.teal}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                            {photo?.image_url
                              ? <img src={photo.image_url} alt={sec.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: 17 }}>{sec.icon}</span>}
                            {isUploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>⏳</div>}
                          </div>
                          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: S.white }}>{sec.icon} {sec.label}</div>
                          <input ref={el => { sectionFileInputRefs.current[key] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => onPickSectionFile(b, sec.key, e.target.files?.[0])} />
                          <button onClick={() => sectionFileInputRefs.current[key]?.click()} disabled={isUploading}
                            style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            📷 {photo?.image_url ? 'تغيير' : 'رفع'}
                          </button>
                          {photo?.image_url && (
                            <button onClick={() => removeSectionImage(b, sec.key)}
                              style={{ padding: '6px 9px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                              🗑️
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
