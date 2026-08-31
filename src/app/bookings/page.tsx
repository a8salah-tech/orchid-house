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
  { key: 'outdoor', label: 'Outdoor Hall',  labelAr: 'الصالة الخارجية',         icon: '🌿', color: C.green },
  { key: 'indoor',  label: 'Indoor Hall',   labelAr: 'الصالة الداخلية المكيفة', icon: '❄️', color: C.blue1 },
  { key: 'upstairs',label: 'Upstairs',      labelAr: 'الطابق العلوي',           icon: '🌅', color: C.amber },
]

const BRANCH_NAMES: Record<string, { ar: string; en: string; location: string }> = {
  '783bc0ec-16f5-4e6c-9148-9c30b12d42c2': { ar: 'اوركيد هاوس', en: 'Orchid House', location: 'Lorong Raja Uda' },
  '9375998c-0a98-48c8-be7a-485e0c616ae1': { ar: 'اوركيد  KLCC', en: 'Orchid KLCC ', location: 'Lorong Yap Kwan Seng' },
}
type Phase = 'branch' | 'date' | 'section' | 'table' | 'details' | 'done'
type Table = { id: string; number: number; name: string; status: string; section: string; pos_x?: number; pos_y?: number }
type Branch = { id: string; name: string; location: string }

export default function BookingPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [phase, setPhase] = useState<Phase>('branch')
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [bookingDate, setBookingDate] = useState('')
  const [section, setSection] = useState('')
  const [tables, setTables] = useState<Table[]>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [hoveredTable, setHoveredTable] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bookingRef, setBookingRef] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', date: '', time: '', guests: '2', notes: '' })

  useEffect(() => { if (bookingDate) setForm(p => ({ ...p, date: bookingDate })) }, [bookingDate])
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function fetchBranches() {
    const { data } = await sb.from('branches').select('id,name,location').eq('is_active', true).order('name', { ascending: false })
    setBranches(data || [])
  }

  useEffect(() => { fetchBranches() }, [])

  // دعم زر الرجوع في المتصفح
  useEffect(() => {
    window.history.pushState({ phase }, '', window.location.pathname)
  }, [phase])

  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const prev = e.state?.phase
      if (prev) setPhase(prev as Phase)
      else setPhase('branch')
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  async function loadTables(sec: string) {
    setLoadingTables(true)
    const { data: allTables } = await sb.from('tables')
      .select('id,number,name,status,section,pos_x,pos_y')
      .eq('section', sec)
      .eq('is_active', true)
      .order('number')

    // ✅ توفّر الطاولات يمرّ من السيرفر — جدول bookings لم يعد مقروءاً للزائر المجهول
    let bookedTableIds = new Set<string>()
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'availability', bookingDate, section: sec }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && Array.isArray(data?.reservedTableIds)) bookedTableIds = new Set<string>(data.reservedTableIds)
    } catch { /* في حالة الفشل تُعرض كل الطاولات كمتاحة */ }

    const tablesWithStatus = (allTables || []).map(t => ({
      ...t,
      status: bookedTableIds.has(t.id) ? 'reserved' : t.status === 'occupied' ? 'occupied' : 'available'
    }))

    setTables(tablesWithStatus)
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
    // ✅ إنشاء الحجز يمرّ من السيرفر (مفتاح service-role)
    let newId: string | null = null
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          booking: {
            customer_name: form.name,
            customer_email: form.email,
            customer_phone: form.phone,
            booking_date: form.date,
            booking_time: form.time,
            guests: parseInt(form.guests) || 2,
            branch_id: selectedBranch?.id || null,
            section,
            table_id: selectedTable.id,
            table_number: selectedTable.number,
            notes: form.notes || null,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.id) newId = data.id
    } catch { /* يعالَج أدناه */ }

    if (!newId) { setSubmitting(false); alert('Error submitting booking. Please try again.'); return }
    setBookingRef(newId.slice(-8).toUpperCase())
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

  // ══ Dynamic Map Component (pos_x/pos_y from DB) ══
  const DynamicMap = () => {
    const CANVAS_W = 640
    const CANVAS_H = 500
    const TABLE_W = 52
    const TABLE_H = 36
    const sec = SECTIONS.find(s => s.key === section)
    const hasPosData = tables.some(t => (t.pos_x ?? 0) > 0 || (t.pos_y ?? 0) > 0)

    return (
      <div>
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

        {!hasPosData ? (
          <div style={{ background: C.bg2, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10 }}>
              {tables.map(t => {
                const isAvail = t.status === 'available'
                const isOcc = t.status === 'occupied'
                const isSel = selectedTable?.id === t.id
                const color = isOcc ? C.red : isAvail ? C.green : C.amber
                const bg = isOcc ? C.redB : isAvail ? C.greenB : C.amberB
                return (
                  <div key={t.id}
                    onClick={() => { if (!isOcc) setSelectedTable(isSel ? null : t) }}
                    style={{ background: isSel ? color + '30' : bg, border: `2px solid ${isSel ? color : color + '50'}`, borderRadius: 14, padding: '14px 8px', textAlign: 'center', cursor: isOcc ? 'not-allowed' : 'pointer', opacity: isAvail || isSel ? 1 : 0.6, transform: isSel ? 'scale(1.05)' : 'scale(1)', transition: 'all .15s' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🪑</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{t.number}</div>
                    <div style={{ fontSize: 10, color, marginTop: 2, fontWeight: 600 }}>{isAvail ? 'Free' : t.status === 'reserved' ? 'Reserved' : 'Busy'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ background: '#0a180a', borderRadius: 16, border: `1px solid ${sec?.color || '#22C55E'}30`, overflow: 'hidden' }}>
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <rect width={CANVAS_W} height={CANVAS_H} fill="#0d1a0d"/>
              <defs>
                <pattern id="pgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a3a1a" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width={CANVAS_W} height={CANVAS_H} fill="url(#pgrid)" opacity="0.4"/>
              <text x={CANVAS_W/2} y={CANVAS_H/2} textAnchor="middle" fill="#1a3a1a" fontSize="18" fontFamily="system-ui">{sec?.icon} {sec?.label}</text>
              {tables.map(t => {
                const px = t.pos_x ?? 0
                const py = t.pos_y ?? 0
                const isAvail = t.status === 'available'
                const isOcc   = t.status === 'occupied'
                const isSel   = selectedTable?.id === t.id
                const isHov   = hoveredTable === t.number
                const color   = isOcc ? C.red : isAvail ? C.green : C.amber
                const bgOp    = isSel ? 0.5 : isHov ? 0.35 : 0.2
                return (
                  <g key={t.id}
                    style={{ cursor: isOcc ? 'not-allowed' : 'pointer' }}
                    onClick={() => { if (!isOcc) setSelectedTable(isSel ? null : t) }}
                    onMouseEnter={() => setHoveredTable(t.number)}
                    onMouseLeave={() => setHoveredTable(null)}
                  >
                    <rect x={px + 6}  y={py - 8}  width={10} height={8} rx={2} fill={color} fillOpacity={0.5}/>
                    <rect x={px + 22} y={py - 8}  width={10} height={8} rx={2} fill={color} fillOpacity={0.5}/>
                    <rect x={px + 6}  y={py + TABLE_H} width={10} height={8} rx={2} fill={color} fillOpacity={0.5}/>
                    <rect x={px + 22} y={py + TABLE_H} width={10} height={8} rx={2} fill={color} fillOpacity={0.5}/>
                    <rect x={px} y={py} width={TABLE_W} height={TABLE_H} rx={7}
                      fill={color} fillOpacity={bgOp}
                      stroke={color} strokeWidth={isSel ? 2.5 : 1.5} strokeOpacity={isSel ? 1 : 0.7}
                    />
                    <text x={px + TABLE_W/2} y={py + TABLE_H/2 + 5} textAnchor="middle" fill={color} fontSize={12} fontWeight={isSel ? "700" : "500"} fontFamily="system-ui">{t.number}</text>
                    {isSel && <rect x={px - 2} y={py - 2} width={TABLE_W + 4} height={TABLE_H + 4} rx={9} fill="none" stroke={C.white} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7}/>}
                  </g>
                )
              })}
            </svg>
          </div>
        )}

        {selectedTable && (
          <div style={{ background: C.greenB, border: `1px solid ${C.green}40`, borderRadius: 14, padding: '14px 18px', marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>✅ Table {selectedTable.number} Selected</div>
              <div style={{ fontSize: 11, color: C.silver2 }}>{sec?.label}</div>
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
          {['Branch', 'Date', 'Section', 'Table', 'Details'].map((s, i) => {
            const phases = ['branch', 'date', 'section', 'table', 'details', 'done']
            const currentIdx = phases.indexOf(phase)
            const done = currentIdx > i
            const active = currentIdx === i
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: i > 0 ? 1 : 'none' }}>
                {i > 0 && <div style={{ flex: 1, height: 1, background: done ? C.blue1 : C.border }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: done || active ? C.blue1 : C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.white, flexShrink: 0 }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 10, color: active ? C.white : C.silver2, whiteSpace: 'nowrap' }}>{s}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ══ Step 0: Branch ══ */}
        {phase === 'branch' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose Your Branch</h2>
            <p style={{ color: C.silver2, fontSize: 14, marginBottom: 24 }}>Select the branch you'd like to visit · اختر الفرع</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {branches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: C.silver2 }}>⏳ Loading branches...</div>
              ) : branches.map(b => (
                <div key={b.id} onClick={() => { setSelectedBranch(b); setPhase('date') }}
                  style={{ background: C.bg2, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${C.blue1}`; (e.currentTarget as HTMLElement).style.background = C.blue1 + '10' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${C.border}`; (e.currentTarget as HTMLElement).style.background = C.bg2 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: C.blue1 + '20', border: `1.5px solid ${C.blue1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏪</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: C.white, marginBottom: 2 }}>{BRANCH_NAMES[b.id]?.ar || b.name}</div>
                    <div style={{ fontSize: 13, color: C.silver2, marginBottom: 2 }}>{BRANCH_NAMES[b.id]?.en || ''}</div>
                    {(BRANCH_NAMES[b.id]?.location || b.location) && <div style={{ fontSize: 11, color: C.silver2 }}>📍 {BRANCH_NAMES[b.id]?.location || b.location}</div>}
                  </div>
                  <div style={{ color: C.silver2, fontSize: 20 }}>›</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Step 1: Date ══ */}
        {phase === 'date' && (
          <div>
            <button onClick={() => setPhase('branch')} style={{ background: 'transparent', border: 'none', color: C.blue1, cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
            <div style={{ background: C.blue1 + '15', border: `1px solid ${C.blue1}40`, borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🏪</span>
              <div style={{ fontWeight: 700, color: C.white }}>{selectedBranch?.name}</div>
              {selectedBranch?.location && <div style={{ fontSize: 12, color: C.silver2 }}>📍 {selectedBranch.location}</div>}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose a Date</h2>
            <p style={{ color: C.silver2, fontSize: 14, marginBottom: 24 }}>Select your preferred visit date · اختر تاريخ الزيارة</p>
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
              <label style={{ fontSize: 13, color: C.silver2, display: 'block', marginBottom: 10 }}>Date · التاريخ</label>
              <input type="date" style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', fontSize: 16, color: C.white, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'system-ui', caretColor: C.blue1 }}
                value={bookingDate} min={new Date().toISOString().split('T')[0]}
                onChange={e => setBookingDate(e.target.value)} />
              <button onClick={() => { if (!bookingDate) { alert('Please select a date'); return } setPhase('section') }}
                style={{ width: '100%', background: bookingDate ? `linear-gradient(135deg,${C.blue1},${C.blue2})` : '#333', border: 'none', borderRadius: 14, padding: '14px', cursor: bookingDate ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 15, color: C.white, marginTop: 16, boxShadow: bookingDate ? `0 6px 20px ${C.glow}` : 'none' }}>
                Continue → Choose Section
              </button>
            </div>
          </div>
        )}
        {/* ══ Step 2: Section ══ */}
        {phase === 'section' && (
          <div>
            <button onClick={() => setPhase('date')} style={{ background: 'transparent', border: 'none', color: C.blue1, cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
            <div style={{ background: C.blue1 + '15', border: `1px solid ${C.blue1}40`, borderRadius: 14, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>🏪</span><span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>{selectedBranch?.name}</span>
              <span style={{ color: C.silver2 }}>·</span>
              <span>📅</span><span style={{ color: C.silver2, fontSize: 13 }}>{bookingDate && new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
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

            <div style={{ background: selectedSection?.color + '15', border: `1px solid ${selectedSection?.color}40`, borderRadius: 14, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18 }}>{selectedSection?.icon}</span>
              <span style={{ fontWeight: 700, color: C.white, fontSize: 13 }}>{selectedSection?.label}</span>
              <span style={{ color: C.silver2 }}>·</span>
              <span style={{ fontSize: 13, color: C.silver2 }}>🏪 {selectedBranch?.name}</span>
              <span style={{ color: C.silver2 }}>·</span>
              <span style={{ fontSize: 13, color: C.silver2 }}>📅 {bookingDate && new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Choose a Table</h2>

            {loadingTables ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.silver2 }}>⏳ Loading tables...</div>
            ) : tables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.silver2 }}>No tables found in this section</div>
            ) : (
              <DynamicMap />
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
