'use client'

import { useState, useRef, useEffect } from 'react'
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
  green: '#22C55E', greenB: 'rgba(34,197,94,0.15)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  border: 'rgba(59,159,229,0.15)', border2: 'rgba(59,159,229,0.3)',
  glow: 'rgba(59,159,229,0.2)',
}

const SECTIONS = [
  { key: 'outdoor', label: 'Outdoor Hall',  labelAr: 'الصالة الخارجية',      icon: '🌿', color: C.green },
  { key: 'indoor',  label: 'Indoor Hall',   labelAr: 'الصالة الداخلية المكيفة', icon: '❄️', color: C.blue1 },
  { key: 'terrace', label: 'Terrace',       labelAr: 'التراس',              icon: '🌅', color: C.amber },
  { key: 'vip',     label: 'VIP',           labelAr: 'VIP',               icon: '👑', color: '#C9A84C' },
]

// موضع كل طاولة على الخريطة (x, y من أصل 640x780)
const TABLE_POSITIONS: Record<number, { x: number; y: number }> = {
  1:  { x: 84,  y: 68  },
  2:  { x: 320, y: 68  },
  3:  { x: 390, y: 680 },
  4:  { x: 84,  y: 140 },
  5:  { x: 530, y: 58  },
  6:  { x: 530, y: 120 },
  7:  { x: 160, y: 68  },
  8:  { x: 240, y: 68  },
  9:  { x: 84,  y: 210 },
  10: { x: 530, y: 210 },
  11: { x: 428, y: 315 },
  12: { x: 320, y: 178 },
  13: { x: 196, y: 315 },
  14: { x: 320, y: 420 },
  15: { x: 390, y: 68  },
  16: { x: 170, y: 68  },
  17: { x: 455, y: 68  },
  18: { x: 84,  y: 490 },
  19: { x: 160, y: 490 },
  20: { x: 84,  y: 560 },
  21: { x: 160, y: 560 },
  22: { x: 260, y: 470 },
  23: { x: 340, y: 470 },
  24: { x: 420, y: 470 },
  25: { x: 260, y: 540 },
  26: { x: 196, y: 375 },
  27: { x: 84,  y: 620 },
  28: { x: 160, y: 620 },
  29: { x: 310, y: 680 },
  30: { x: 470, y: 620 },
}

type Phase = 'section' | 'table' | 'details' | 'done'
type Table = { id: string; number: number; name: string; status: string; section: string }

export default function BookingPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [phase, setPhase] = useState<Phase>('section')
  const [section, setSection] = useState('')
  const [tables, setTables] = useState<Table[]>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [hoveredTable, setHoveredTable] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bookingRef, setBookingRef] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', date: '', time: '', guests: '2', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function loadTables(sec: string) {
    setLoadingTables(true)
    const { data } = await sb.from('tables')
      .select('id,number,name,status,section')
      .eq('section', sec)
      .eq('is_active', true)
      .order('number')
    setTables(data || [])
    setLoadingTables(false)
  }

  function pickSection(sec: string) {
    setSection(sec)
    setSelectedTable(null)
    loadTables(sec)
    setPhase('table')
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email is required'
    if (!form.phone.trim() || form.phone.length < 8) e.phone = 'Valid phone number is required'
    if (!form.date) e.date = 'Date is required'
    if (!form.time) e.time = 'Time is required'
    if (form.date && new Date(form.date) < new Date(new Date().toDateString())) e.date = 'Date cannot be in the past'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validate() || !selectedTable) return
    setSubmitting(true)
    const { data, error } = await sb.from('bookings').insert([{
      customer_name: form.name,
      customer_email: form.email,
      customer_phone: form.phone,
      booking_date: form.date,
      booking_time: form.time,
      guests: parseInt(form.guests) || 2,
      section,
      table_id: selectedTable.id,
      table_number: selectedTable.number,
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

  // ══ Done ══
  if (phase === 'done') return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}} @keyframes glow{0%,100%{box-shadow:0 0 20px ${C.glow}}50%{box-shadow:0 0 40px rgba(59,159,229,.4)}}`}</style>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center', animation: 'fadeUp .6s ease' }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>🌸</div>
        <div style={{ background: C.bg2, borderRadius: 24, border: `1px solid ${C.border2}`, padding: '36px 28px', animation: 'glow 2s ease infinite' }}>
          <div style={{ color: C.blue1, fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 10 }}>Booking Confirmed!</div>
          <h2 style={{ color: C.white, fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Thank you, {form.name.split(' ')[0]}!</h2>
          <p style={{ color: C.silver2, fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>Your reservation has been received. We'll confirm within 24 hours.</p>
          <div style={{ background: 'rgba(59,159,229,.08)', border: `1px solid ${C.border2}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ color: C.silver2, fontSize: 10, letterSpacing: 3, marginBottom: 8 }}>BOOKING REFERENCE</div>
            <div style={{ color: C.blue1, fontSize: 36, fontWeight: 900, letterSpacing: 6 }}>#{bookingRef}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 14, padding: 16, textAlign: 'left' }}>
            {[
              { icon: '📍', label: 'Section', value: selectedSection?.label },
              { icon: '🪑', label: 'Table', value: `Table ${selectedTable?.number}` },
              { icon: '📅', label: 'Date', value: new Date(form.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
              { icon: '🕐', label: 'Time', value: form.time },
              { icon: '👥', label: 'Guests', value: `${form.guests} guests` },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <div>
                  <div style={{ color: C.silver2, fontSize: 10 }}>{r.label}</div>
                  <div style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: C.silver2, fontSize: 12, marginTop: 20 }}>Confirmation sent to <strong style={{ color: C.white }}>{form.email}</strong></p>
        </div>
      </div>
    </div>
  )

  // ══ Outdoor Map Component ══
  const OutdoorMap = () => {
    const tableMap = Object.fromEntries(tables.map(t => [t.number, t]))

    const TableNode = ({ num }: { num: number }) => {
      const t = tableMap[num]
      if (!t) return null
      const pos = TABLE_POSITIONS[num]
      if (!pos) return null
      const isAvail = t.status === 'available'
      const isOcc   = t.status === 'occupied'
      const isSel   = selectedTable?.id === t.id
      const isHov   = hoveredTable === num
      const color   = isOcc ? C.red : isAvail ? C.green : C.amber
      const bgOp    = isSel ? '.5' : isHov ? '.35' : '.2'
      return (
        <g
          style={{ cursor: isOcc ? 'not-allowed' : 'pointer' }}
          onClick={() => { if (!isOcc) setSelectedTable(isSel ? null : t) }}
          onMouseEnter={() => setHoveredTable(num)}
          onMouseLeave={() => setHoveredTable(null)}
        >
          <rect
            x={pos.x - 26} y={pos.y - 18} width={52} height={36} rx={7}
            fill={color} fillOpacity={bgOp}
            stroke={color} strokeWidth={isSel ? 2.5 : 1.5}
            strokeOpacity={isSel ? 1 : .7}
          />
          {/* chairs top */}
          <rect x={pos.x - 14} y={pos.y - 26} width={10} height={8} rx={2} fill={color} fillOpacity={.5}/>
          <rect x={pos.x + 4}  y={pos.y - 26} width={10} height={8} rx={2} fill={color} fillOpacity={.5}/>
          {/* chairs bottom */}
          <rect x={pos.x - 14} y={pos.y + 18} width={10} height={8} rx={2} fill={color} fillOpacity={.5}/>
          <rect x={pos.x + 4}  y={pos.y + 18} width={10} height={8} rx={2} fill={color} fillOpacity={.5}/>
          <text x={pos.x} y={pos.y + 5} textAnchor="middle" fill={color} fontSize={12} fontWeight={isSel ? '700' : '500'} fontFamily="system-ui">{num}</text>
          {isSel && <rect x={pos.x - 28} y={pos.y - 20} width={56} height={40} rx={8} fill="none" stroke={C.white} strokeWidth={1.5} strokeDasharray="4,3" opacity={.7}/>}
        </g>
      )
    }

    return (
      <div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { color: C.green, label: 'Available · متاحة' },
            { color: C.amber, label: 'Reserved · محجوزة' },
            { color: C.red,   label: 'Occupied · مشغولة' },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.silver2 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }}/>
              {l.label}
            </div>
          ))}
        </div>

        {/* SVG Map */}
        <div style={{ background: '#0a1a0a', borderRadius: 16, border: `1px solid #1a3a1a`, overflow: 'hidden', position: 'relative' }}>
          <svg viewBox="0 0 640 760" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Background */}
            <rect width={640} height={760} fill="#0d1a0d"/>
            <rect width={640} height={760} fill="#0f200f" opacity=".5"/>
            {/* Border */}
            <rect x={20} y={20} width={600} height={720} rx={14} fill="none" stroke="#1e3a1e" strokeWidth={1.5} strokeDasharray="6,4"/>

            {/* Label */}
            <text x={320} y={44} textAnchor="middle" fill="#3a6a3a" fontSize={11} fontFamily="system-ui">🌿 الصالة الخارجية · Outdoor Hall</text>

            {/* Gazebo octagon */}
            <polygon points="320,230 375,248 395,303 375,358 320,376 265,358 245,303 265,248" fill="#122212" stroke="#1e4a1e" strokeWidth={1.5}/>
            <text x={320} y={308} textAnchor="middle" fill="#3a7a3a" fontSize={13} fontFamily="system-ui">شلال</text>
            <text x={320} y={326} textAnchor="middle" fill="#2a5a2a" fontSize={10} fontFamily="system-ui">Gazebo</text>

            {/* Garden area */}
            <rect x={220} y={520} width={200} height={100} rx={10} fill="#111d11" stroke="#1a3a1a" strokeWidth={1}/>
            <text x={320} y={575} textAnchor="middle" fill="#2a5a2a" fontSize={12} fontFamily="system-ui">حديقة · Garden</text>

            {/* All 30 tables */}
            {Array.from({length: 30}, (_, i) => i + 1).map(n => <TableNode key={n} num={n}/>)}
          </svg>
        </div>

        {/* Selected table popup */}
        {selectedTable && (
          <div style={{ background: C.greenB, border: `1px solid ${C.green}40`, borderRadius: 14, padding: '14px 18px', marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>✅ Table {selectedTable.number} Selected</div>
              <div style={{ fontSize: 11, color: C.silver2 }}>Outdoor Hall · الصالة الخارجية</div>
            </div>
            <button onClick={() => setPhase('details')}
              style={{ background: `linear-gradient(135deg,${C.blue1},${C.blue2})`, border: 'none', borderRadius: 12, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: C.white, whiteSpace: 'nowrap' }}>
              Continue →
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'system-ui', color: C.white, paddingBottom: 40 }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} input,select,textarea{font-family:system-ui;} input::placeholder,textarea::placeholder{color:${C.silver2}} select option{background:${C.bg2};color:${C.white}}`}</style>

      {/* Header */}
      <div style={{ background: C.bg3, padding: '20px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.white }}>ORCHID <span style={{ color: C.blue1 }}>HOUSE</span></div>
        <div style={{ fontSize: 13, color: C.silver2, marginTop: 4 }}>Table Reservation</div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
          {['Section', 'Table', 'Details'].map((s, i) => {
            const phases = ['section', 'table', 'details', 'done']
            const currentIdx = phases.indexOf(phase)
            const done = currentIdx > i
            const active = currentIdx === i
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i > 0 ? 1 : 'none' }}>
                {i > 0 && <div style={{ flex: 1, height: 1, background: done ? C.blue1 : C.border }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: done || active ? C.blue1 : C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.white, flexShrink: 0 }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 11, color: active ? C.white : C.silver2, whiteSpace: 'nowrap' }}>{s}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ══ Step 1: Section ══ */}
        {phase === 'section' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose Your Section</h2>
            <p style={{ color: C.silver2, fontSize: 14, marginBottom: 24 }}>Select your preferred dining area</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {SECTIONS.map(s => (
                <div key={s.key} onClick={() => pickSection(s.key)}
                  style={{ background: C.bg2, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'all .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${s.color}`; (e.currentTarget as HTMLElement).style.background = s.color + '10' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${C.border}`; (e.currentTarget as HTMLElement).style.background = C.bg2 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: s.color + '20', border: `1.5px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{s.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: C.white, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: C.silver2 }}>{s.labelAr}</div>
                  </div>
                  <div style={{ color: C.silver2, fontSize: 20 }}>›</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Step 2: Table ══ */}
        {phase === 'table' && (
          <div>
            <button onClick={() => { setPhase('section'); setSelectedTable(null) }} style={{ background: 'transparent', border: 'none', color: C.blue1, cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>

            <div style={{ background: selectedSection?.color + '15', border: `1px solid ${selectedSection?.color}40`, borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{selectedSection?.icon}</span>
              <div style={{ fontWeight: 700, color: C.white }}>{selectedSection?.label} · {selectedSection?.labelAr}</div>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Choose a Table</h2>

            {loadingTables ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.silver2 }}>⏳ Loading tables...</div>
            ) : tables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.silver2 }}>No tables found in this section</div>
            ) : section === 'outdoor' ? (
              <OutdoorMap />
            ) : (
              <>
                <p style={{ color: C.silver2, fontSize: 13, marginBottom: 20 }}>
                  <span style={{ background: C.greenB, color: C.green, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>✅ Available</span>
                  <span style={{ background: C.amberB, color: C.amber, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>⏳ Reserved</span>
                  <span style={{ background: C.redB, color: C.red, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>🔴 Occupied</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, marginBottom: 20 }}>
                  {tables.map(t => {
                    const isAvail = t.status === 'available'
                    const isSelected = selectedTable?.id === t.id
                    const color = isAvail ? C.green : t.status === 'reserved' ? C.amber : C.red
                    const bg = isAvail ? C.greenB : t.status === 'reserved' ? C.amberB : C.redB
                    return (
                      <div key={t.id}
                        onClick={() => isAvail && setSelectedTable(isSelected ? null : t)}
                        style={{ background: isSelected ? color + '30' : bg, border: `2px solid ${isSelected ? color : color + '50'}`, borderRadius: 14, padding: '14px 8px', textAlign: 'center', cursor: isAvail ? 'pointer' : 'not-allowed', opacity: isAvail ? 1 : 0.5, transition: 'all .15s', transform: isSelected ? 'scale(1.05)' : 'scale(1)' }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>🪑</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{t.number}</div>
                        <div style={{ fontSize: 10, color, marginTop: 2, fontWeight: 600 }}>{isAvail ? 'Free' : t.status === 'reserved' ? 'Reserved' : 'Busy'}</div>
                      </div>
                    )
                  })}
                </div>
                {selectedTable && (
                  <div style={{ background: C.greenB, border: `1px solid ${C.green}40`, borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>✅ Table {selectedTable.number} Selected</div>
                      <div style={{ fontSize: 11, color: C.silver2 }}>{selectedSection?.label}</div>
                    </div>
                    <button onClick={() => setPhase('details')} style={{ background: `linear-gradient(135deg,${C.blue1},${C.blue2})`, border: 'none', borderRadius: 12, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: C.white }}>Continue →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ Step 3: Details ══ */}
        {phase === 'details' && (
          <div>
            <button onClick={() => setPhase('table')} style={{ background: 'transparent', border: 'none', color: C.blue1, cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{selectedSection?.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: C.white, fontSize: 14 }}>{selectedSection?.label} · Table {selectedTable?.number}</div>
                <div style={{ fontSize: 12, color: C.green }}>✅ Available</div>
              </div>
              <button onClick={() => setPhase('table')} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.silver2, cursor: 'pointer', fontSize: 12, padding: '5px 10px' }}>Change</button>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Your Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Full Name *</label>
                <input style={inp('name')} placeholder="John Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                {errors.name && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.name}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Email Address *</label>
                <input type="email" style={inp('email')} placeholder="john@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                {errors.email && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Phone Number *</label>
                <input type="tel" style={inp('phone')} placeholder="+60 12-345 6789" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                {errors.phone && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.phone}</div>}
              </div>
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
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Number of Guests</label>
                <select style={{ ...inp('guests'), cursor: 'pointer' }} value={form.guests} onChange={e => setForm(p => ({ ...p, guests: e.target.value }))}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
                  <option value="11">10+ guests (contact us)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Special Requests (optional)</label>
                <textarea style={{ ...inp('notes'), minHeight: 80, resize: 'vertical' as const }} placeholder="Birthday, dietary needs..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <button onClick={submit} disabled={submitting}
                style={{ width: '100%', background: submitting ? '#333' : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border: 'none', borderRadius: 16, padding: '16px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 16, color: C.white, boxShadow: submitting ? 'none' : `0 8px 28px ${C.glow}`, marginTop: 8 }}>
                {submitting ? '⏳ Submitting...' : '✅ Confirm Reservation'}
              </button>
              <p style={{ textAlign: 'center', color: C.silver2, fontSize: 12 }}>We'll confirm your booking within 24 hours.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
