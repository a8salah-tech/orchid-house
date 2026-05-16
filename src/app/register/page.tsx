'use client'

import { useState, useRef } from 'react'
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
  card: 'rgba(255,255,255,0.04)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12, padding: '12px 16px', fontSize: 14,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl', transition: 'border-color .2s',
}

const DEPARTMENTS = ['المطبخ', 'البار', 'الصالة', 'الحلويات', 'الكاشير', 'الإدارة', 'التوصيل', 'النظافة']
const ROLES = [
  { value: 'admin',               label: 'مدير النظام',   icon: '👑' },
  { value: 'branch_manager',      label: 'مدير الفرع',    icon: '🏪' },
  { value: 'kitchen_supervisor',  label: 'مشرف المطبخ',   icon: '👨‍🍳' },
  { value: 'hall_supervisor',     label: 'مشرف الصالة',   icon: '🍽️' },
  { value: 'bar_supervisor',      label: 'مشرف البار',    icon: '☕' },
  { value: 'cashier',             label: 'كاشير',           icon: '💰' },
  { value: 'employee',            label: 'موظف',            icon: '👤' },
]

// تحويل الصورة لـ base64 ثم رفعها
async function uploadImageFile(
  supabase: ReturnType<typeof createClient>,
  file: File,
  folder: string
): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage
      .from('employees')
      .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type })
    if (error) { console.error('Upload error:', error); return null }
    const { data: urlData } = supabase.storage.from('employees').getPublicUrl(data.path)
    return urlData.publicUrl
  } catch (e) {
    console.error('Upload exception:', e)
    return null
  }
}

export default function RegisterPage() {
  const supabase = createClient()
  const photoRef = useRef<HTMLInputElement>(null)
  const idRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'form' | 'uploading' | 'success'>('form')
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [idPreview, setIdPreview] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [idFile, setIdFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    name: '',
    name_en: '',
    employee_number: '',
    role: 'employee',
    department: '',
    branch: '',
    phone: '',
    email: '',
    join_date: new Date().toISOString().split('T')[0],
    salary: '',
    notes: '',
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('حجم الصورة يجب أن يكون أقل من 5MB'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
    setError('')
  }

  function handleIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('حجم صورة الهوية يجب أن يكون أقل من 5MB'); return }
    setIdFile(file)
    const reader = new FileReader()
    reader.onload = () => setIdPreview(reader.result as string)
    reader.readAsDataURL(file)
    setError('')
  }

  async function handleSubmit() {
    if (!form.name) { setError('يرجى إدخال الاسم الكامل'); return }
    if (!form.role) { setError('يرجى اختيار الدور الوظيفي'); return }

    setStep('uploading')
    setError('')

    let photo_url: string | null = null
    let national_id_url: string | null = null

    // رفع الصورة الشخصية
    if (photoFile) {
      setUploadProgress('جاري رفع الصورة الشخصية...')
      photo_url = await uploadImageFile(supabase, photoFile, 'registrations/photos')
      if (!photo_url) {
        setError('فشل رفع الصورة الشخصية. يرجى المحاولة مرة أخرى.')
        setStep('form')
        return
      }
    }

    // رفع صورة الهوية
    if (idFile) {
      setUploadProgress('جاري رفع صورة الهوية...')
      national_id_url = await uploadImageFile(supabase, idFile, 'registrations/ids')
      if (!national_id_url) {
        setError('فشل رفع صورة الهوية. يرجى المحاولة مرة أخرى.')
        setStep('form')
        return
      }
    }

    setUploadProgress('جاري حفظ البيانات...')

    const { error: dbError } = await supabase.from('employee_registrations').insert([{
      name: form.name,
      name_en: form.name_en || null,
      phone: form.phone || null,
      email: form.email || null,
      department: form.department || null,
      role: form.role,
      notes: form.notes ? `رقم الموظف: ${form.employee_number || '—'} | الفرع: ${form.branch || '—'} | الراتب: ${form.salary || '—'} | تاريخ الانضمام: ${form.join_date} | ${form.notes}` : `رقم الموظف: ${form.employee_number || '—'} | الفرع: ${form.branch || '—'} | الراتب: ${form.salary || '—'} | تاريخ الانضمام: ${form.join_date}`,
      photo_url,
      national_id_url,
      status: 'pending',
    }])

    if (dbError) {
      setError('حدث خطأ أثناء الحفظ: ' + dbError.message)
      setStep('form')
      return
    }

    setStep('success')
  }

  // صفحة النجاح
  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', direction: 'rtl', padding: 20 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>
        <div style={{ textAlign: 'center', maxWidth: 460 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: S.gold, marginBottom: 12 }}>تم استلام بياناتك!</h1>
          <p style={{ fontSize: 15, color: S.muted, lineHeight: 1.9, marginBottom: 28 }}>
            شكراً <strong style={{ color: S.white }}>{form.name}</strong>،<br />
            تم إرسال بياناتك بنجاح وسيتم مراجعتها من قِبَل الإدارة.<br />
            سيتم التواصل معك قريباً.
          </p>
          <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🌙 🐑 🌙</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: S.gold, marginBottom: 6 }}>عيد أضحى مبارك</div>
            <div style={{ fontSize: 13, color: S.muted }}>كل عام وأنتم بخير — نتطلع للعمل معك في عائلة Orchid House 🌸</div>
          </div>
          <div style={{ fontSize: 12, color: S.muted }}>يمكنك إغلاق هذه الصفحة الآن</div>
        </div>
      </div>
    )
  }

  // صفحة الرفع
  if (step === 'uploading') {
    return (
      <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌸</div>
          <div style={{ fontSize: 16, color: S.gold, fontWeight: 700, marginBottom: 8 }}>جاري إرسال البيانات...</div>
          <div style={{ fontSize: 13, color: S.muted }}>{uploadProgress}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl', padding: '24px 20px 40px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus, textarea:focus { border-color: #C9A84C !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #0F2040 inset !important; -webkit-text-fill-color: #FAFAF8 !important; }
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .upload-box:hover { border-color: #C9A84C !important; }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 14px', boxShadow: `0 0 32px rgba(201,168,76,0.3)` }}>🌸</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>Orchid House</h1>
          <p style={{ fontSize: 14, color: S.gold, fontWeight: 600, marginBottom: 2 }}>استمارة تسجيل الموظفين</p>
          <p style={{ fontSize: 12, color: S.muted }}>يرجى تعبئة جميع البيانات بدقة</p>
        </div>

        {/* Eid Banner */}
        <div style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.04))', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 14, padding: '14px 18px', marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>🌙 🐑 🌙</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: S.gold }}>بمناسبة عيد الأضحى المبارك</div>
          <div style={{ fontSize: 12, color: S.muted, marginTop: 3 }}>كل عام وأنتم بخير — أهلاً بكم في عائلة Orchid House</div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: S.red }}>
            ❌ {error}
          </div>
        )}

        {/* Form Card */}
        <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: '24px 22px' }}>

          {/* الصور */}
          <div style={{ background: S.card, borderRadius: 14, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 14 }}>📎 المرفقات</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* صورة شخصية */}
              <div>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 8, fontWeight: 600 }}>📸 صورة الموظف</div>
                <div className="upload-box" onClick={() => photoRef.current?.click()}
                  style={{ width: 90, height: 90, borderRadius: '50%', border: `2px dashed ${photoPreview ? S.green : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.navy3, margin: '0 auto 8px', transition: 'all .2s' }}>
                  {photoPreview
                    ? <img src={photoPreview} alt="صورة" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 26 }}>👤</div>
                        <div style={{ fontSize: 9, color: S.muted, marginTop: 2 }}>اضغط لرفع</div>
                      </div>
                  }
                </div>
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" style={{ display: 'none' }} onChange={handlePhotoChange} />
                {photoPreview
                  ? <button onClick={() => { setPhotoPreview(''); setPhotoFile(null) }} style={{ display: 'block', margin: '0 auto', padding: '3px 12px', borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif' }}>🗑️ حذف</button>
                  : <div style={{ textAlign: 'center', fontSize: 10, color: S.muted }}>JPG / PNG • أقل من 5MB</div>
                }
              </div>

              {/* صورة الهوية */}
              <div>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 8, fontWeight: 600 }}>🪪 صورة الهوية</div>
                <div className="upload-box" onClick={() => idRef.current?.click()}
                  style={{ width: '100%', height: 90, borderRadius: 10, border: `2px dashed ${idPreview ? S.green : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.navy3, marginBottom: 8, transition: 'all .2s' }}>
                  {idPreview
                    ? <img src={idPreview} alt="هوية" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 26 }}>🪪</div>
                        <div style={{ fontSize: 9, color: S.muted, marginTop: 2 }}>اضغط لرفع الهوية</div>
                      </div>
                  }
                </div>
                <input ref={idRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" style={{ display: 'none' }} onChange={handleIdChange} />
                {idPreview
                  ? <button onClick={() => { setIdPreview(''); setIdFile(null) }} style={{ display: 'block', margin: '0 auto', padding: '3px 12px', borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif' }}>🗑️ حذف</button>
                  : <div style={{ textAlign: 'center', fontSize: 10, color: S.muted }}>JPG / PNG • أقل من 5MB</div>
                }
              </div>
            </div>
          </div>

          {/* البيانات الأساسية */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* الاسم */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>الاسم (عربي) *</label>
                <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="الاسم الكامل" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Name (English)</label>
                <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="Full Name" />
              </div>
            </div>

            {/* رقم الموظف */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>رقم الموظف</label>
              <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.employee_number} onChange={e => setForm(p => ({ ...p, employee_number: e.target.value }))} placeholder="EMP-001" />
            </div>

            {/* الدور الوظيفي */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>الدور الوظيفي *</label>
              <select style={inp} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
              </select>
            </div>

            {/* القسم والفرع */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>القسم</label>
                <select style={inp} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                  <option value="">اختر القسم</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>الفرع</label>
                <select style={inp} value={form.branch} onChange={e => setForm(p => ({ ...p, branch: e.target.value }))}>
                  <option value="">اختر الفرع</option>
                  <option value="اوركيد هاوس">اوركيد هاوس</option>
                  <option value="اوركيد فرع KLCC">اوركيد فرع KLCC</option>
                </select>
              </div>
            </div>

            {/* الهاتف والإيميل */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>رقم الهاتف</label>
                <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+60 12-345 6789" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>البريد الإلكتروني</label>
                <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
              </div>
            </div>

            {/* تاريخ الانضمام والراتب */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>تاريخ الانضمام</label>
                <input style={inp} type="date" value={form.join_date} onChange={e => setForm(p => ({ ...p, join_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>الراتب الأساسي (MYR)</label>
                <input style={inp} type="number" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} placeholder="0.00" />
              </div>
            </div>

            {/* ملاحظات */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>ملاحظات إضافية</label>
              <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' } as React.CSSProperties}
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="أي معلومات إضافية..." />
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit}
            style={{ width: '100%', marginTop: 24, padding: '14px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, boxShadow: `0 4px 20px rgba(201,168,76,0.3)`, transition: 'all .2s' }}>
            ✅ إرسال البيانات
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: S.muted, marginTop: 12 }}>
            بياناتك محفوظة ومؤمنة — لن تُشارك مع أي طرف خارجي
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: S.muted, marginTop: 16 }}>
          🌸 Orchid House Restaurant Management System
        </p>
      </div>
    </div>
  )
}
