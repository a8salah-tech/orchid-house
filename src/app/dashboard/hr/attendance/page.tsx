'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'

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
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

// حساب المسافة بين نقطتين (Haversine formula) بالمتر
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

type Branch = { id: string; name: string; latitude?: number; longitude?: number; radius_meters?: number }
type AttendanceRecord = {
  id?: string; employee_id: string; date: string
  check_in_time?: string; check_in_lat?: number; check_in_lng?: number; check_in_distance?: number
  check_out_time?: string; check_out_lat?: number; check_out_lng?: number; check_out_distance?: number
  status?: string; is_manual?: boolean; notes?: string; branch_id?: string
}
type Employee = { id: string; name: string; employee_number?: string; role: string; department?: string; branch_id?: string }

// ══ Employee Attendance Card (للموظف نفسه) ══
function MyAttendanceCard() {
  const { employee } = useAuth()
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [branch, setBranch] = useState<Branch | null>(null)
  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [locError, setLocError] = useState('')
  const [history, setHistory] = useState<AttendanceRecord[]>([])
  const [clock, setClock] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t) }, [])

  const fetchData = useCallback(async () => {
    if (!employee?.id) return
    setLoading(true)
    const today_date = new Date().toISOString().split('T')[0]

    const [br, att, hist] = await Promise.all([
      sb.from('branches').select('id,name,latitude,longitude,radius_meters').limit(1).single(),
      sb.from('attendance').select('*').eq('employee_id', employee.id).eq('date', today_date).maybeSingle(),
      sb.from('attendance').select('*').eq('employee_id', employee.id).order('date', { ascending: false }).limit(10),
    ])
    setBranch(br.data)
    setToday(att.data)
    setHistory(hist.data || [])
    setLoading(false)
  }, [employee?.id, sb])

  useEffect(() => { fetchData() }, [fetchData])

  function getLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
    })
  }

  async function updateLocation() {
    setLocError('')
    try {
      const pos = await getLocation()
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setLocation({ lat, lng })
      if (branch?.latitude && branch?.longitude) {
        const dist = getDistance(lat, lng, branch.latitude, branch.longitude)
        setDistance(Math.round(dist))
      }
    } catch (e: any) {
      setLocError('Could not get location. Please allow location access.')
    }
  }

  async function checkIn() {
    if (!employee?.id || !branch) return
    setChecking(true)
    setLocError('')
    try {
      const pos = await getLocation()
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const dist = branch.latitude && branch.longitude ? getDistance(lat, lng, branch.latitude, branch.longitude) : 0
      const radius = branch.radius_meters || 150

      if (dist > radius) {
        setLocError(`You are ${Math.round(dist)}m from the branch. Must be within ${radius}m to check in.`)
        setChecking(false)
        return
      }

      const today_date = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()
      const checkInHour = new Date().getHours()
      const status = checkInHour >= 9 ? 'late' : 'present'

      const { error } = await sb.from('attendance').upsert({
        employee_id: employee.id,
        date: today_date,
        check_in_time: now,
        check_in_lat: lat,
        check_in_lng: lng,
        check_in_distance: Math.round(dist),
        status,
        branch_id: branch.id,
      }, { onConflict: 'employee_id,date' })

      if (error) { setLocError('Error: ' + error.message); setChecking(false); return }
      await fetchData()
    } catch (e: any) {
      setLocError('Location error: ' + e.message)
    }
    setChecking(false)
  }

  async function checkOut() {
    if (!employee?.id || !today) return
    setChecking(true)
    setLocError('')
    try {
      const pos = await getLocation()
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const dist = branch?.latitude && branch?.longitude ? getDistance(lat, lng, branch.latitude, branch.longitude) : 0

      const { error } = await sb.from('attendance').update({
        check_out_time: new Date().toISOString(),
        check_out_lat: lat,
        check_out_lng: lng,
        check_out_distance: Math.round(dist),
        updated_at: new Date().toISOString(),
      }).eq('id', today.id!)

      if (error) { setLocError('Error: ' + error.message); setChecking(false); return }
      await fetchData()
    } catch (e: any) {
      setLocError('Location error: ' + e.message)
    }
    setChecking(false)
  }

  function formatTime(iso?: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  }

  function workDuration() {
    if (!today?.check_in_time) return null
    const end = today.check_out_time ? new Date(today.check_out_time) : new Date()
    const mins = Math.floor((end.getTime() - new Date(today.check_in_time).getTime()) / 60000)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  const isInRange = distance !== null && branch?.radius_meters ? distance <= branch.radius_meters : null

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      {/* Clock */}
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: '24px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 42, fontWeight: 900, color: S.gold, fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}>
          {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div style={{ fontSize: 14, color: S.muted, marginTop: 4 }}>
          {clock.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Status Card */}
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.muted, marginBottom: 16 }}>📍 Today's Attendance</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: today?.check_in_time ? S.greenB : S.card, borderRadius: 12, padding: '14px 16px', border: `1px solid ${today?.check_in_time ? S.green + '40' : S.border}` }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🟢 Check In</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: today?.check_in_time ? S.green : S.muted }}>
              {formatTime(today?.check_in_time)}
            </div>
            {today?.check_in_distance !== undefined && <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>📍 {today.check_in_distance}m from branch</div>}
          </div>
          <div style={{ background: today?.check_out_time ? S.blueB : S.card, borderRadius: 12, padding: '14px 16px', border: `1px solid ${today?.check_out_time ? S.blue + '40' : S.border}` }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🔴 Check Out</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: today?.check_out_time ? S.blue : S.muted }}>
              {formatTime(today?.check_out_time)}
            </div>
          </div>
        </div>

        {today?.check_in_time && (
          <div style={{ background: S.gold3, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: S.muted }}>⏱ Duration</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>{workDuration()}</span>
          </div>
        )}

        {/* Location Check */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={updateLocation}
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: S.card, color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', marginBottom: 8 }}>
            📍 Check My Location
          </button>
          {distance !== null && (
            <div style={{ background: isInRange ? S.greenB : S.redB, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: isInRange ? S.green : S.red, fontWeight: 700 }}>
                {isInRange ? '✅ You are in range' : '❌ You are out of range'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: isInRange ? S.green : S.red }}>{distance}m</span>
            </div>
          )}
          {locError && <div style={{ background: S.redB, borderRadius: 10, padding: '10px 14px', marginTop: 8, fontSize: 12, color: S.red }}>⚠️ {locError}</div>}
        </div>

        {/* Action Buttons */}
        {!today?.check_in_time ? (
          <button onClick={checkIn} disabled={checking}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${S.green}, #16A34A)`, color: S.white, cursor: checking ? 'not-allowed' : 'pointer', fontSize: 16, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: checking ? 0.7 : 1, boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
            {checking ? '⏳ Getting location...' : '✅ Check In'}
          </button>
        ) : !today?.check_out_time ? (
          <button onClick={checkOut} disabled={checking}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${S.red}, #DC2626)`, color: S.white, cursor: checking ? 'not-allowed' : 'pointer', fontSize: 16, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: checking ? 0.7 : 1, boxShadow: '0 4px 20px rgba(239,68,68,0.3)' }}>
            {checking ? '⏳ Getting location...' : '🔴 Check Out'}
          </button>
        ) : (
          <div style={{ background: S.greenB, borderRadius: 12, padding: '14px', textAlign: 'center', border: `1px solid ${S.green}40` }}>
            <div style={{ fontSize: 14, color: S.green, fontWeight: 700 }}>✅ Attendance Complete</div>
            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>See you tomorrow!</div>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.white }}>📋 Recent Attendance</div>
          {history.map((h, i) => (
            <div key={h.id || i} style={{ padding: '12px 18px', borderBottom: i < history.length - 1 ? `1px solid ${S.border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{formatDate(h.date)}</div>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                  {h.check_in_time ? `In: ${formatTime(h.check_in_time)}` : 'No check-in'}
                  {h.check_out_time ? ` · Out: ${formatTime(h.check_out_time)}` : ''}
                </div>
              </div>
              <span style={{ background: h.status === 'present' ? S.greenB : h.status === 'late' ? S.amberB : S.redB, color: h.status === 'present' ? S.green : h.status === 'late' ? S.amber : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                {h.status || 'present'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══ Admin Attendance View ══
function AdminAttendanceView() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [records, setRecords] = useState<any[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [manualEmp, setManualEmp] = useState('')
  const [manualStatus, setManualStatus] = useState('present')
  const [manualNote, setManualNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'day' | 'summary'>('day')
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0, 7))

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [att, emps] = await Promise.all([
      sb.from('attendance').select('*, employees(id,name,employee_number,role,department)').eq('date', date).order('check_in_time'),
      sb.from('employees').select('id,name,employee_number,role,department').eq('is_active', true).order('name'),
    ])
    setRecords(att.data || [])
    setEmployees(emps.data || [])
    setLoading(false)
  }, [date, sb])

  useEffect(() => { fetchData() }, [fetchData])

  async function addManual() {
    if (!manualEmp) return
    setSaving(true)
    await sb.from('attendance').upsert({
      employee_id: manualEmp,
      date,
      status: manualStatus,
      is_manual: true,
      notes: manualNote || null,
      check_in_time: manualStatus !== 'absent' ? `${date}T08:00:00` : null,
    }, { onConflict: 'employee_id,date' })
    setSaving(false)
    setManualEmp('')
    setManualNote('')
    fetchData()
  }

  function formatTime(iso?: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function workHours(r: any) {
    if (!r.check_in_time || !r.check_out_time) return '—'
    const mins = Math.floor((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 60000)
    return `${Math.floor(mins/60)}h ${mins%60}m`
  }

  const checkedIn   = records.filter(r => r.check_in_time).length
  const checkedOut  = records.filter(r => r.check_out_time).length
  const absent      = employees.length - checkedIn
  const late        = records.filter(r => r.status === 'late').length

  const inp2: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#FAFAF8',
    outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div>
      {/* Header Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp2, width: 180 }} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          <button onClick={() => setView('day')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: view === 'day' ? S.gold3 : 'transparent', color: view === 'day' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: view === 'day' ? 700 : 400 }}>📅 Daily</button>
          <button onClick={() => setView('summary')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: view === 'summary' ? S.gold3 : 'transparent', color: view === 'summary' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: view === 'summary' ? 700 : 400 }}>📊 Summary</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Present', value: checkedIn, color: S.green, bg: S.greenB, icon: '✅' },
          { label: 'Checked Out', value: checkedOut, color: S.blue, bg: S.blueB, icon: '🔴' },
          { label: 'Absent', value: absent, color: S.red, bg: S.redB, icon: '❌' },
          { label: 'Late', value: late, color: S.amber, bg: S.amberB, icon: '⏰' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 12, border: `1px solid ${s.color}30`, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Manual Add */}
      <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 12 }}>✏️ Manual Attendance</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 10, alignItems: 'center' }}>
          <select style={inp2} value={manualEmp} onChange={e => setManualEmp(e.target.value)}>
            <option value="">Select Employee...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.employee_number || e.role}</option>)}
          </select>
          <select style={inp2} value={manualStatus} onChange={e => setManualStatus(e.target.value)}>
            <option value="present">✅ Present</option>
            <option value="late">⏰ Late</option>
            <option value="absent">❌ Absent</option>
            <option value="remote">🏠 Remote</option>
          </select>
          <input style={inp2} value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="Note (optional)..." />
          <button onClick={addManual} disabled={saving || !manualEmp}
            style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {saving ? '⏳' : '✅ Add'}
          </button>
        </div>
      </div>

      {/* Records Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ Loading...</div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['Employee', 'Department', 'Check In', 'Check Out', 'Duration', 'Distance', 'Status', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* موظفين سجلوا */}
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{r.employees?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: S.gold }}>{r.employees?.employee_number}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{r.employees?.department || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: r.check_in_time ? S.green : S.muted }}>{formatTime(r.check_in_time)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: r.check_out_time ? S.blue : S.muted }}>{formatTime(r.check_out_time)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold }}>{workHours(r)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>
                      {r.check_in_distance ? `${r.check_in_distance}m` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: r.status === 'present' ? S.greenB : r.status === 'late' ? S.amberB : r.status === 'remote' ? S.blueB : S.redB, color: r.status === 'present' ? S.green : r.status === 'late' ? S.amber : r.status === 'remote' ? S.blue : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                        {r.is_manual ? '✏️ ' : ''}{r.status || 'present'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{r.notes || '—'}</td>
                  </tr>
                ))}
                {/* موظفين غايبين */}
                {employees
                  .filter(e => !records.find(r => r.employee_id === e.id))
                  .map(e => (
                    <tr key={e.id} style={{ borderBottom: `1px solid ${S.border}`, opacity: 0.5 }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: S.gold }}>{e.employee_number}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{e.department || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.muted }}>—</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.muted }}>—</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.muted }}>—</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>—</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: S.redB, color: S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>❌ absent</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>—</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function AttendancePage() {
  const { employee, permissions } = useAuth()
  const isManager = permissions?.all === true || ['branch_manager','kitchen_manager','hall_manager','bar_manager','kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(employee?.role || '')

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>
            {isManager ? '📊 Attendance Management' : '⏰ My Attendance'}
          </h1>
          <p style={{ fontSize: 13, color: S.muted }}>
            {isManager ? 'Track and manage employee attendance' : 'Check in and out using your location'}
          </p>
        </div>
      </div>

      {isManager ? <AdminAttendanceView /> : <MyAttendanceCard />}
    </div>
  )
}
