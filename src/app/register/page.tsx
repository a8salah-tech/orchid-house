'use client'

import { useState, useEffect, useRef } from 'react'
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
  boxSizing: 'border-box', direction: 'ltr', transition: 'border-color .2s',
}

const inpError: React.CSSProperties = {
  ...inp,
  border: '1px solid #EF4444',
}

const DEPARTMENTS = ['Kitchen', 'Bar', 'Hall', 'Desserts', 'Cashier', 'Management', 'Delivery', 'Cleaning']
const ROLES = [
  { value: 'admin',                label: 'System Admin',       icon: '👑' },
  { value: 'branch_manager',       label: 'Branch Manager',     icon: '🏪' },
  { value: 'kitchen_manager',      label: 'Kitchen Manager',    icon: '🍳' },
  { value: 'hall_manager',         label: 'Hall Manager',       icon: '🏛️' },
  { value: 'bar_manager',          label: 'Bar Manager',        icon: '🍹' },
  { value: 'kitchen_supervisor',   label: 'Kitchen Supervisor', icon: '👨‍🍳' },
  { value: 'hall_supervisor',      label: 'Hall Supervisor',    icon: '🍽️' },
  { value: 'bar_supervisor',       label: 'Bar Supervisor',     icon: '☕' },
  { value: 'cashier',              label: 'Cashier',            icon: '💰' },
  { value: 'assistant_cashier',    label: 'Assistant Cashier',  icon: '💳' },
  { value: 'employee',             label: 'Employee',           icon: '👤' },
]

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

type Branch = { id: string; name: string }

const BRANCH_PREFIX: Record<string, string> = {
  'اوركيد هاوس': 'ORH',
  'اوركيد فرع KLCC': 'ORK',
}
function getPrefix(branchName: string) {
  return BRANCH_PREFIX[branchName] || branchName.slice(0,3).toUpperCase()
}

export default function RegisterPage() {
  const supabase = createClient()
  const [branches, setBranches] = useState<Branch[]>([])

  useEffect(() => {
    supabase.from('branches').select('id,name').eq('is_active', true).order('name')
      .then(({ data }) => setBranches(data || []))
  }, [])

  const photoRef = useRef<HTMLInputElement>(null)
  const idRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'form' | 'uploading' | 'success'>('form')
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photoPreview, setPhotoPreview] = useState('')
  const [idPreview, setIdPreview] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [idFile, setIdFile] = useState<File | null>(null)
  const [showPass, setShowPass] = useState(false)

  const [form, setForm] = useState({
    name: '', name_en: '', employee_number: '',
    role: 'employee', department: '', branch: '',
    phone: '', email: '', email_account: '', password: '',
    join_date: new Date().toISOString().split('T')[0],
    salary: '', notes: '',
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Photo size must be less than 5MB'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
    setError('')
  }

  function handleIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('ID photo size must be less than 5MB'); return }
    setIdFile(file)
    const reader = new FileReader()
    reader.onload = () => setIdPreview(reader.result as string)
    reader.readAsDataURL(file)
    setError('')
  }

  function validateForm() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'First name is required'
    if (!form.name_en.trim()) e.name_en = 'Last name is required'
    if (!form.branch) e.branch = 'Please select a branch'
    if (form.branch && !form.employee_number.trim()) e.employee_number = 'Employee number is required'
    if (!form.role) e.role = 'Please select a job role'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    if (!form.email.trim()) e.email = 'Personal email is required'
    if (form.email && !form.email.includes('@')) e.email = 'Please enter a valid email'
    if (!form.email_account.trim()) e.email_account = 'Login email is required'
    if (form.email_account && !form.email_account.includes('@')) e.email_account = 'Please enter a valid email'
    if (!form.password.trim()) e.password = 'Password is required'
    if (form.password && form.password.length < 6) e.password = 'Password must be at least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    setError('')
    if (!validateForm()) {
      setError('Please fill in all required fields marked with *')
      return
    }

    // Check duplicate email_account
    const { data: existingReg } = await supabase
      .from('employee_registrations')
      .select('id')
      .eq('email_account', form.email_account)
      .maybeSingle()
    if (existingReg) {
      setErrors(p => ({ ...p, email_account: 'This email is already registered. Contact your manager.' }))
      setError('This login email is already registered.')
      return
    }

    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id')
      .eq('email_account', form.email_account)
      .maybeSingle()
    if (existingEmp) {
      setErrors(p => ({ ...p, email_account: 'This email already exists in the system.' }))
      setError('This login email already exists in the system.')
      return
    }

    setStep('uploading')

    let photo_url: string | null = null
    let national_id_url: string | null = null

    if (photoFile) {
      setUploadProgress('Uploading employee photo...')
      photo_url = await uploadImageFile(supabase, photoFile, 'registrations/photos')
      if (!photo_url) { setError('Failed to upload photo. Please try again.'); setStep('form'); return }
    }

    if (idFile) {
      setUploadProgress('Uploading ID photo...')
      national_id_url = await uploadImageFile(supabase, idFile, 'registrations/ids')
      if (!national_id_url) { setError('Failed to upload ID. Please try again.'); setStep('form'); return }
    }

    setUploadProgress('Saving your data...')

    const empNumber = form.employee_number ? `${getPrefix(form.branch)}-${form.employee_number}` : null
    const notesStr = `Employee #: ${empNumber || '—'} | Branch: ${form.branch || '—'} | Salary: ${form.salary || '—'} | Joining Date: ${form.join_date}${form.notes ? ' | ' + form.notes : ''}`

    const { error: dbError } = await supabase.from('employee_registrations').insert([{
      name: form.name,
      name_en: form.name_en || null,
      phone: form.phone || null,
      email: form.email || null,
      email_account: form.email_account || null,
      password_hint: form.password || null,
      department: form.department || null,
      role: form.role,
      notes: notesStr,
      photo_url,
      national_id_url,
      status: 'pending',
    }])

    if (dbError) { setError('An error occurred: ' + dbError.message); setStep('form'); return }
    setStep('success')
  }

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', direction: 'ltr', padding: 20 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>
        <div style={{ textAlign: 'center', maxWidth: 460 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: S.gold, marginBottom: 12 }}>Your Details Have Been Received!</h1>
          <p style={{ fontSize: 15, color: S.muted, lineHeight: 1.9, marginBottom: 28 }}>
            Thank you <strong style={{ color: S.white }}>{form.name} {form.name_en}</strong>,<br />
            Your details have been submitted and will be reviewed by management.<br />
            We will be in touch with you soon.
          </p>
          <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🌸</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: S.gold, marginBottom: 6 }}>Welcome to the Team!</div>
            <div style={{ fontSize: 13, color: S.muted }}>We look forward to working with you at Orchid Group 🌸</div>
          </div>
          <div style={{ fontSize: 12, color: S.muted }}>You may close this page now</div>
        </div>
      </div>
    )
  }

  if (step === 'uploading') {
    return (
      <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', direction: 'ltr' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌸</div>
          <div style={{ fontSize: 16, color: S.gold, fontWeight: 700, marginBottom: 8 }}>Submitting your details...</div>
          <div style={{ fontSize: 13, color: S.muted }}>{uploadProgress}</div>
        </div>
      </div>
    )
  }

  const Field = ({ label, name, children }: { label: string; name: string; children: React.ReactNode }) => (
    <div>
      <label style={{ fontSize: 12, color: errors[name] ? S.red : S.muted, display: 'block', marginBottom: 6, fontWeight: errors[name] ? 700 : 400 }}>
        {label} {['name','name_en','branch','role','phone','email','email_account','password'].includes(name) ? <span style={{ color: S.red }}>*</span> : null}
      </label>
      {children}
      {errors[name] && <div style={{ fontSize: 11, color: S.red, marginTop: 4 }}>⚠ {errors[name]}</div>}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'ltr', padding: '24px 20px 40px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 18 }}>
            <div style={{ width: 90, height: 90, borderRadius: 22, overflow: 'hidden', border: `2px solid ${S.gold}40`, boxShadow: `0 0 30px rgba(201,168,76,0.25)` }}>
              <img src="https://i.ibb.co/hRM7zRdZ/Whats-App-Image-2026-05-15-at-8-59.png" alt="Orchid House" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ width: 1, height: 60, background: `linear-gradient(to bottom, transparent, ${S.gold}60, transparent)` }} />
            <div style={{ width: 90, height: 90, borderRadius: 22, overflow: 'hidden', border: `2px solid ${S.gold}40`, boxShadow: `0 0 30px rgba(201,168,76,0.25)` }}>
              <img src="https://i.ibb.co/KjYtL5LV/Whats-App-Image-2026-05-15-at-8-59-09-AM1.jpg" alt="Orchid House" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: S.white, marginBottom: 4 }}>Orchid Group</h1>
          <p style={{ fontSize: 14, color: S.gold, fontWeight: 600, marginBottom: 2 }}>Employee Registration Form</p>
          <p style={{ fontSize: 12, color: S.muted }}>Please fill in all required fields marked with <span style={{ color: S.red }}>*</span></p>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: S.red }}>
            ❌ {error}
          </div>
        )}

        <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: '24px 22px' }}>

          {/* Photos */}
          <div style={{ background: S.card, borderRadius: 14, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, marginBottom: 14 }}>📎 Attachments</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 8, fontWeight: 600 }}>📸 Employee Photo</div>
                <div className="upload-box" onClick={() => photoRef.current?.click()}
                  style={{ width: 90, height: 90, borderRadius: '50%', border: `2px dashed ${photoPreview ? S.green : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.navy3, margin: '0 auto 8px' }}>
                  {photoPreview ? <img src={photoPreview} alt="photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 26 }}>👤</div><div style={{ fontSize: 9, color: S.muted, marginTop: 2 }}>Tap to upload</div></div>}
                </div>
                <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                {photoPreview
                  ? <button onClick={() => { setPhotoPreview(''); setPhotoFile(null) }} style={{ display: 'block', margin: '0 auto', padding: '3px 12px', borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif' }}>🗑️ Remove</button>
                  : <div style={{ textAlign: 'center', fontSize: 10, color: S.muted }}>JPG / PNG • Max 5MB</div>}
              </div>
              <div>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 8, fontWeight: 600 }}>🪪 ID / Passport</div>
                <div className="upload-box" onClick={() => idRef.current?.click()}
                  style={{ width: '100%', height: 90, borderRadius: 10, border: `2px dashed ${idPreview ? S.green : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.navy3, marginBottom: 8 }}>
                  {idPreview ? <img src={idPreview} alt="id" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 26 }}>🪪</div><div style={{ fontSize: 9, color: S.muted, marginTop: 2 }}>Tap to upload ID</div></div>}
                </div>
                <input ref={idRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIdChange} />
                {idPreview
                  ? <button onClick={() => { setIdPreview(''); setIdFile(null) }} style={{ display: 'block', margin: '0 auto', padding: '3px 12px', borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif' }}>🗑️ Remove</button>
                  : <div style={{ textAlign: 'center', fontSize: 10, color: S.muted }}>JPG / PNG • Max 5MB</div>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="First Name" name="name">
                <input style={errors.name ? inpError : inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="First Name" />
              </Field>
              <Field label="Last Name" name="name_en">
                <input style={errors.name_en ? inpError : inp} value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="Last Name" />
              </Field>
            </div>

            {/* Branch */}
            <Field label="Branch" name="branch">
              <select style={errors.branch ? inpError : inp} value={form.branch} onChange={e => setForm(p => ({ ...p, branch: e.target.value, employee_number: '' }))}>
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </Field>

            {/* Employee Number */}
            {form.branch && (
              <Field label="Employee Number" name="employee_number">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(201,168,76,0.15)', border: `1px solid ${errors.employee_number ? S.red : 'rgba(201,168,76,0.3)'}`, borderRight: 'none', borderRadius: '12px 0 0 12px', padding: '12px 14px', fontSize: 14, fontWeight: 800, color: S.gold, whiteSpace: 'nowrap' }}>
                    {getPrefix(form.branch)}
                  </div>
                  <input style={{ ...(errors.employee_number ? inpError : inp), borderRadius: '0 12px 12px 0', flex: 1 }} type="number" min="1"
                    value={form.employee_number}
                    onChange={e => setForm(p => ({ ...p, employee_number: e.target.value.replace(/\D/g, '') }))}
                    placeholder="e.g. 001" />
                </div>
                {form.employee_number && <div style={{ fontSize: 11, color: S.gold, marginTop: 5 }}>Full: {getPrefix(form.branch)}-{form.employee_number}</div>}
              </Field>
            )}

            {/* Role */}
            <Field label="Job Role" name="role">
              <select style={errors.role ? inpError : inp} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
              </select>
            </Field>

            {/* Department */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Department</label>
              <select style={inp} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                <option value="">Select Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Phone & Personal Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Phone Number" name="phone">
                <input style={errors.phone ? inpError : inp} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+60 12-345 6789" />
              </Field>
              <Field label="Personal Email" name="email">
                <input style={errors.email ? inpError : inp} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
              </Field>
            </div>

            {/* Joining Date & Salary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Joining Date</label>
                <input style={inp} type="date" value={form.join_date} onChange={e => setForm(p => ({ ...p, join_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Basic Salary (MYR)</label>
                <input style={inp} type="number" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} placeholder="0.00" />
              </div>
            </div>

            {/* System Account — REQUIRED */}
            <div style={{ background: S.blueB, border: `1px solid ${S.blue}30`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, color: S.blue, fontWeight: 700, marginBottom: 4 }}>🔑 System Account <span style={{ color: S.red }}>*</span></div>
              <p style={{ fontSize: 11, color: S.muted, marginBottom: 12, lineHeight: 1.6 }}>
                You must set your login email and password to access the system.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Login Email" name="email_account">
                  <input style={errors.email_account ? inpError : inp} type="email"
                    value={form.email_account}
                    onChange={e => setForm(p => ({ ...p, email_account: e.target.value }))}
                    placeholder="email@orchid.com" />
                </Field>
                <Field label="Password (min. 6 characters)" name="password">
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...(errors.password ? inpError : inp), paddingLeft: 40 }}
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••" />
                    <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 16 }}>
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </Field>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Additional Notes</label>
              <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' } as React.CSSProperties}
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any additional information..." />
            </div>
          </div>

          <button onClick={handleSubmit}
            style={{ width: '100%', marginTop: 24, padding: '14px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, boxShadow: `0 4px 20px rgba(201,168,76,0.3)` }}>
            ✅ Submit
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: S.muted, marginTop: 12 }}>
            Your data is secure and will not be shared with any third party
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: S.muted, marginTop: 16 }}>
          🌸 Orchid Group Restaurant Management System
        </p>
      </div>
    </div>
  )
}
