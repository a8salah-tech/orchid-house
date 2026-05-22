'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const C = {
  bg: '#0A0F1A', bg2: '#0F1825', bg3: '#141F30',
  blue1: '#3B9FE5', blue2: '#1A6BB5',
  silver: '#B8C5D6', silver2: '#8A9BB5',
  white: '#FFFFFF', white2: '#E8EDF5',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  border: 'rgba(59,159,229,0.15)', border2: 'rgba(59,159,229,0.3)',
  glow: 'rgba(59,159,229,0.2)',
}

const SECTIONS = [
  { key: 'outdoor', label: 'Outdoor Hall', labelAr: 'الصالة الخارجية', icon: '🌿', desc: 'Open air dining · Tables 1-30', tables: 30, color: C.green },
  { key: 'indoor',  label: 'Indoor Hall',  labelAr: 'الصالة الداخلية المكيفة', icon: '❄️', desc: 'Air conditioned · 14 tables', tables: 14, color: C.blue1 },
  { key: 'terrace', label: 'Terrace',      labelAr: 'التراس', icon: '🌅', desc: 'Rooftop terrace · 40 tables', tables: 40, color: '#F59E0B' },
]

type Phase = 'section' | 'details' | 'done'

export default function BookingPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [phase, setPhase] = useState<Phase>('section')
  const [section, setSection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookingRef, setBookingRef] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    date: '', time: '', guests: '2', notes: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email is required'
    if (!form.phone.trim() || form.phone.length < 8) e.phone = 'Valid phone number is required'
    if (!form.date) e.date = 'Date is required'
    if (!form.time) e.time = 'Time is required'
    // Date must be today or future
    if (form.date && new Date(form.date) < new Date(new Date().toDateString())) e.date = 'Date cannot be in the past'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validate()) return
    setSubmitting(true)
    const { data, error } = await sb.from('bookings').insert([{
      customer_name: form.name,
      customer_email: form.email,
      customer_phone: form.phone,
      booking_date: form.date,
      booking_time: form.time,
      guests: parseInt(form.guests) || 2,
      section,
      notes: form.notes || null,
      status: 'pending',
    }]).select('id').single()

    if (error || !data) { setSubmitting(false); alert('Error submitting booking. Please try again.'); return }
    setBookingRef(data.id.slice(-8).toUpperCase())
    setPhase('done')
    setSubmitting(false)
  }

  const inp = (field: string): React.CSSProperties => ({
    width: '100%', background: 'rgba(255,255,255,.06)',
    border: `1px solid ${errors[field] ? C.red : C.border}`,
    borderRadius: 12, padding: '12px 16px', fontSize: 14,
    color: C.white, outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: 'system-ui', caretColor: C.blue1,
  })

  const selectedSection = SECTIONS.find(s => s.key === section)

  // ══ Done Screen ══
  if (phase === 'done') return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}} @keyframes glow{0%,100%{box-shadow:0 0 20px ${C.glow}}50%{box-shadow:0 0 40px rgba(59,159,229,.4)}}`}</style>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center', animation: 'fadeUp .6s ease' }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>🌸</div>
        <div style={{ background: C.bg2, borderRadius: 24, border: `1px solid ${C.border2}`, padding: '36px 28px', animation: 'glow 2s ease infinite' }}>
          <div style={{ color: C.blue1, fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 10 }}>Booking Confirmed!</div>
          <h2 style={{ color: C.white, fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Thank you, {form.name.split(' ')[0]}!</h2>
          <p style={{ color: C.silver2, fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>Your reservation request has been received. Our team will confirm within 24 hours via email or phone.</p>

          <div style={{ background: 'rgba(59,159,229,.08)', border: `1px solid ${C.border2}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ color: C.silver2, fontSize: 10, letterSpacing: 3, marginBottom: 8 }}>BOOKING REFERENCE</div>
            <div style={{ color: C.blue1, fontSize: 36, fontWeight: 900, letterSpacing: 6 }}>#{bookingRef}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 14, padding: 16, textAlign: 'left' }}>
            {[
              { icon: '📍', label: 'Section', value: selectedSection?.label },
              { icon: '📅', label: 'Date', value: new Date(form.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
              { icon: '🕐', label: 'Time', value: form.time },
              { icon: '👥', label: 'Guests', value: `${form.guests} guests` },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <div>
                  <div style={{ color: C.silver2, fontSize: 10 }}>{r.label}</div>
                  <div style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: C.silver2, fontSize: 12, marginTop: 20 }}>A confirmation will be sent to <strong style={{ color: C.white }}>{form.email}</strong></p>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'system-ui', color: C.white, paddingBottom: 40 }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} input,select,textarea{font-family:system-ui;} input::placeholder,textarea::placeholder{color:${C.silver2}} select option{background:${C.bg2};color:${C.white}}`}</style>

      {/* Header */}
      <div style={{ background: C.bg3, padding: '20px 20px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.white }}>ORCHID <span style={{ color: C.blue1 }}>HOUSE</span></div>
        <div style={{ fontSize: 13, color: C.silver2, marginTop: 4 }}>Table Reservation</div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          {['Choose Section', 'Your Details'].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i === 0 ? 'none' : 1 }}>
              {i > 0 && <div style={{ flex: 1, height: 1, background: phase === 'details' ? C.blue1 : C.border }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: (phase === 'section' && i === 0) || (phase === 'details' && i <= 1) ? C.blue1 : C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: C.white }}>
                  {i === 0 && phase === 'details' ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, color: (phase === 'section' && i === 0) || (phase === 'details' && i === 1) ? C.white : C.silver2 }}>{s}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Section */}
        {phase === 'section' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose Your Section</h2>
            <p style={{ color: C.silver2, fontSize: 14, marginBottom: 24 }}>Select your preferred dining area</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {SECTIONS.map(s => (
                <div key={s.key} onClick={() => { setSection(s.key); setPhase('details') }}
                  style={{ background: C.bg2, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '20px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'all .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${s.color}`; (e.currentTarget as HTMLElement).style.background = s.color + '10' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${C.border}`; (e.currentTarget as HTMLElement).style.background = C.bg2 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: s.color + '20', border: `1.5px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: C.white, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: C.silver2, marginBottom: 4 }}>{s.labelAr}</div>
                    <div style={{ fontSize: 12, color: s.color }}>{s.desc}</div>
                  </div>
                  <div style={{ color: C.silver2, fontSize: 20 }}>›</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {phase === 'details' && (
          <div>
            <button onClick={() => setPhase('section')} style={{ background: 'transparent', border: 'none', color: C.blue1, cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>

            <div style={{ background: selectedSection?.color + '15', border: `1px solid ${selectedSection?.color}40`, borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>{selectedSection?.icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: C.white }}>{selectedSection?.label}</div>
                <div style={{ fontSize: 12, color: C.silver2 }}>{selectedSection?.desc}</div>
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Your Details</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Full Name *</label>
                <input style={inp('name')} placeholder="John Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                {errors.name && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.name}</div>}
              </div>

              {/* Email */}
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Email Address *</label>
                <input type="email" style={inp('email')} placeholder="john@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                {errors.email && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
              </div>

              {/* Phone */}
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Phone Number *</label>
                <input type="tel" style={inp('phone')} placeholder="+60 12-345 6789" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                {errors.phone && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.phone}</div>}
              </div>

              {/* Date & Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Date *</label>
                  <input type="date" style={inp('date')} value={form.date} min={new Date().toISOString().split('T')[0]} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  {errors.date && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.date}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Time *</label>
                  <input type="time" style={inp('time')} value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
                  {errors.time && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.time}</div>}
                </div>
              </div>

              {/* Guests */}
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Number of Guests</label>
                <select style={{ ...inp('guests'), cursor: 'pointer' }} value={form.guests} onChange={e => setForm(p => ({ ...p, guests: e.target.value }))}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
                  <option value="11">10+ guests (contact us)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Special Requests (optional)</label>
                <textarea style={{ ...inp('notes'), minHeight: 80, resize: 'vertical' as const }} placeholder="Birthday celebration, dietary requirements, etc..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              <button onClick={submit} disabled={submitting}
                style={{ width: '100%', background: submitting ? '#333' : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border: 'none', borderRadius: 16, padding: '16px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 16, color: C.white, boxShadow: submitting ? 'none' : `0 8px 28px ${C.glow}`, marginTop: 8 }}>
                {submitting ? '⏳ Submitting...' : '✅ Confirm Reservation'}
              </button>

              <p style={{ textAlign: 'center', color: C.silver2, fontSize: 12 }}>
                By submitting, you agree to our reservation policy.<br />
                We'll confirm your booking within 24 hours.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
