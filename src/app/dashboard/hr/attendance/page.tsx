'use client'

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
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function workDuration(checkIn?: string, checkOut?: string) {
  if (!checkIn) return null
  const end = checkOut ? new Date(checkOut) : new Date()
  const mins = Math.floor((end.getTime() - new Date(checkIn).getTime()) / 60000)
  if (mins < 0) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

type Branch = { id: string; name: string; latitude?: number; longitude?: number; radius_meters?: number }
type AttendanceRecord = {
  id?: string; employee_id: string; date: string
  check_in_time?: string; check_in_lat?: number; check_in_lng?: number; check_in_distance?: number
  check_out_time?: string; check_out_lat?: number; check_out_lng?: number; check_out_distance?: number
  status?: string; is_manual?: boolean; notes?: string; branch_id?: string
}
type Employee = {
  id: string; name: string; name_en?: string; employee_number?: string
  role: string; department?: string; branch_id?: string; salary?: number
  branches?: { name: string } | any
}

// ══════════════════════════════════════════
// Employee Card
// ══════════════════════════════════════════
function MyAttendanceCard() {
  const { employee } = useAuth()
  const sbRef = useRef(createClient())
  const sb    = sbRef.current

  const [branches,  setBranches]  = useState<Branch[]>([])
  const [today,     setToday]     = useState<AttendanceRecord | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [checking,  setChecking]  = useState(false)
  const [distance,  setDistance]  = useState<number | null>(null)
  const [locError,  setLocError]  = useState('')
  const [history,   setHistory]   = useState<AttendanceRecord[]>([])
  const [clock,     setClock]     = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async () => {
    if (!employee?.id) return
    setLoading(true)
    const today_date = new Date().toISOString().split('T')[0]
    const [brs, att, hist] = await Promise.all([
      sb.from('branches').select('id,name,latitude,longitude,radius_meters').eq('is_active', true),
      sb.from('attendance').select('*').eq('employee_id', employee.id).eq('date', today_date).maybeSingle(),
      sb.from('attendance').select('*').eq('employee_id', employee.id).order('date', { ascending: false }).limit(14),
    ])
    setBranches(brs.data || [])
    setToday(att.data)
    setHistory(hist.data || [])
    setLoading(false)
  }, [employee?.id, sb])

  useEffect(() => { fetchData() }, [fetchData])

  // الفرع المحدد للموظف
  const myBranch = branches.find(b => b.id === employee?.branch_id) || branches[0] || null

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
      if (myBranch?.latitude && myBranch?.longitude) {
        const dist = getDistance(lat, lng, myBranch.latitude, myBranch.longitude)
        setDistance(Math.round(dist))
      }
    } catch {
      setLocError('Could not get location. Please allow location access.')
    }
  }

  async function checkIn() {
    if (!employee?.id || !myBranch) return
    setChecking(true); setLocError('')
    try {
      const pos  = await getLocation()
      const lat  = pos.coords.latitude
      const lng  = pos.coords.longitude
      const dist = myBranch.latitude && myBranch.longitude
        ? getDistance(lat, lng, myBranch.latitude, myBranch.longitude) : 0
      const radius = myBranch.radius_meters || 150

      if (dist > radius) {
        setLocError(`You are ${Math.round(dist)}m from the branch. Must be within ${radius}m to check in.`)
        setChecking(false); return
      }

      const today_date = new Date().toISOString().split('T')[0]
      const now        = new Date().toISOString()
      const status     = new Date().getHours() >= 9 ? 'late' : 'present'

      const { error } = await sb.from('attendance').upsert({
        employee_id: employee.id,
        date: today_date,
        check_in_time: now,
        check_in_lat: lat,
        check_in_lng: lng,
        check_in_distance: Math.round(dist),
        status,
        branch_id: myBranch.id,
      }, { onConflict: 'employee_id,date' })

      if (error) { setLocError('Error: ' + error.message); setChecking(false); return }
      setDistance(Math.round(dist))
      await fetchData()
    } catch (e: any) { setLocError('Location error: ' + e.message) }
    setChecking(false)
  }

  async function checkOut() {
    if (!employee?.id) return
    setChecking(true); setLocError('')
    try {
      const pos  = await getLocation()
      const lat  = pos.coords.latitude
      const lng  = pos.coords.longitude
      const dist = myBranch?.latitude && myBranch?.longitude
        ? getDistance(lat, lng, myBranch.latitude, myBranch.longitude) : 0

      const today_date = new Date().toISOString().split('T')[0]

      // ✅ Fix: استخدم employee_id + date مش id فقط
      const { error } = await sb.from('attendance')
        .update({
          check_out_time:     new Date().toISOString(),
          check_out_lat:      lat,
          check_out_lng:      lng,
          check_out_distance: Math.round(dist),
          updated_at:         new Date().toISOString(),
        })
        .eq('employee_id', employee.id)
        .eq('date', today_date)

      if (error) { setLocError('Error: ' + error.message); setChecking(false); return }
      setDistance(Math.round(dist))
      await fetchData()
    } catch (e: any) { setLocError('Location error: ' + e.message) }
    setChecking(false)
  }

  const isInRange = distance !== null && myBranch?.radius_meters ? distance <= myBranch.radius_meters : null

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
        {myBranch && <div style={{ fontSize: 12, color: S.blue, marginTop: 6 }}>🏪 {myBranch.name}</div>}
      </div>

      {/* Status Card */}
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.muted, marginBottom: 16 }}>📋 Today's Attendance</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Check In */}
          <div style={{ background: today?.check_in_time ? S.greenB : S.card, borderRadius: 12, padding: '14px 16px', border: `1px solid ${today?.check_in_time ? S.green + '40' : S.border}` }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🟢 Check In</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: today?.check_in_time ? S.green : S.muted }}>
              {formatTime(today?.check_in_time)}
            </div>
            {today?.check_in_distance !== undefined && today?.check_in_distance !== null && (
              <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>
                📍 {today.check_in_distance}m from branch
              </div>
            )}
          </div>
          {/* Check Out */}
          <div style={{ background: today?.check_out_time ? S.blueB : S.card, borderRadius: 12, padding: '14px 16px', border: `1px solid ${today?.check_out_time ? S.blue + '40' : S.border}` }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🔴 Check Out</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: today?.check_out_time ? S.blue : S.muted }}>
              {formatTime(today?.check_out_time)}
            </div>
            {today?.check_out_distance !== undefined && today?.check_out_distance !== null && (
              <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>
                📍 {today.check_out_distance}m from branch
              </div>
            )}
          </div>
        </div>

        {today?.check_in_time && (
          <div style={{ background: S.gold3, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: S.muted }}>⏱ Duration</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>
              {workDuration(today.check_in_time, today.check_out_time)}
            </span>
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
              <span style={{ fontSize: 16, fontWeight: 900, color: isInRange ? S.green : S.red }}>{distance}m</span>
            </div>
          )}
          {locError && (
            <div style={{ background: S.redB, borderRadius: 10, padding: '10px 14px', marginTop: 8, fontSize: 12, color: S.red }}>
              ⚠️ {locError}
            </div>
          )}
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
          {history.map((h, i) => {
            const dur = workDuration(h.check_in_time, h.check_out_time)
            return (
              <div key={h.id || i} style={{ padding: '12px 18px', borderBottom: i < history.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{formatDate(h.date)}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                      {h.check_in_time ? `In: ${formatTime(h.check_in_time)}` : 'No check-in'}
                      {h.check_out_time ? ` · Out: ${formatTime(h.check_out_time)}` : ''}
                      {dur ? ` · ${dur}` : ''}
                    </div>
                    <div style={{ fontSize: 10, color: S.muted, marginTop: 2, display: 'flex', gap: 10 }}>
                      {h.check_in_distance != null && <span>📍 In: {h.check_in_distance}m</span>}
                      {h.check_out_distance != null && <span>📍 Out: {h.check_out_distance}m</span>}
                    </div>
                  </div>
                  <span style={{ background: h.status === 'present' ? S.greenB : h.status === 'late' ? S.amberB : S.redB, color: h.status === 'present' ? S.green : h.status === 'late' ? S.amber : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {h.status || 'present'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// Admin View
// ══════════════════════════════════════════
function AdminAttendanceView({ empInfo }: { empInfo: any }) {
  const sbRef = useRef(createClient())
  const sb    = sbRef.current

  const [date,         setDate]         = useState(new Date().toISOString().split('T')[0])
  const [records,      setRecords]      = useState<any[]>([])
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [branches,     setBranches]     = useState<Branch[]>([])
  const [loading,      setLoading]      = useState(true)
  const [manualEmp,    setManualEmp]    = useState('')
  const [manualStatus, setManualStatus] = useState('present')
  const [manualNote,   setManualNote]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [filterBranch, setFilterBranch] = useState(() => empInfo?.branch_id || 'all')
  const [tab,          setTab]          = useState<'day' | 'report'>('day')
  const [reportEmp,    setReportEmp]    = useState('')
  const [reportMonth,  setReportMonth]  = useState(new Date().toISOString().slice(0, 7))
  const [reportData,   setReportData]   = useState<any[]>([])
  const [loadingReport, setLoadingReport] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [att, emps, brs] = await Promise.all([
      sb.from('attendance')
        .select('*, employees(id,name,name_en,employee_number,role,department,branch_id,salary,branches(name))')
        .eq('date', date)
        .order('check_in_time'),
      (() => {
        let q = sb.from('employees').select('id,name,name_en,employee_number,role,department,branch_id,salary,branches(name)').eq('is_active', true).order('name')
        const role = empInfo?.role || ''
        const branchId = empInfo?.branch_id || ''
        if (role === 'branch_manager') q = q.eq('branch_id', branchId)
        else if (role === 'kitchen_manager') q = q.eq('branch_id', branchId).in('department', ['المطبخ','البار','الحلويات','Kitchen','Bar','Desserts'])
        else if (role === 'hall_manager') q = q.eq('branch_id', branchId).in('department', ['الصالة','Hall'])
        else if (role === 'bar_manager') q = q.eq('branch_id', branchId).in('department', ['البار','Bar'])
        else if (role === 'kitchen_supervisor') q = q.eq('branch_id', branchId).in('department', ['المطبخ','Kitchen'])
        else if (role === 'hall_supervisor') q = q.eq('branch_id', branchId).in('department', ['الصالة','Hall'])
        else if (role === 'bar_supervisor') q = q.eq('branch_id', branchId).in('department', ['البار','Bar'])
        return q
      })(),
      sb.from('branches').select('id,name').eq('is_active', true),
    ])
    setRecords(att.data || [])
    setEmployees(emps.data || [])
    setBranches(brs.data || [])
    setLoading(false)
  }, [date, sb])

  useEffect(() => { fetchData() }, [fetchData])

  async function addManual() {
    if (!manualEmp) return
    setSaving(true)
    await sb.from('attendance').upsert({
      employee_id: manualEmp, date, status: manualStatus, is_manual: true,
      notes: manualNote || null,
      check_in_time: manualStatus !== 'absent' ? `${date}T08:00:00` : null,
    }, { onConflict: 'employee_id,date' })
    setSaving(false); setManualEmp(''); setManualNote('')
    fetchData()
  }

  async function loadReport() {
    if (!reportEmp) return
    setLoadingReport(true)
    const startDate = `${reportMonth}-01`
    const endDate   = new Date(reportMonth + '-01')
    endDate.setMonth(endDate.getMonth() + 1)
    const endStr = endDate.toISOString().split('T')[0]

    const { data } = await sb.from('attendance')
      .select('*')
      .eq('employee_id', reportEmp)
      .gte('date', startDate)
      .lt('date', endStr)
      .order('date')

    setReportData(data || [])
    setLoadingReport(false)
  }

  function workHours(r: any) {
    if (!r.check_in_time || !r.check_out_time) return '—'
    const mins = Math.floor((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 60000)
    return `${Math.floor(mins/60)}h ${mins%60}m`
  }

  function workMins(r: any) {
    if (!r.check_in_time || !r.check_out_time) return 0
    return Math.floor((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 60000)
  }

  // فلتر حسب الفرع
  const filteredEmps = filterBranch === 'all'
    ? employees
    : employees.filter(e => e.branch_id === filterBranch)

  const filteredRecords = filterBranch === 'all'
    ? records
    : records.filter(r => {
        const emp = employees.find(e => e.id === r.employee_id)
        return emp?.branch_id === filterBranch
      })

  const checkedIn  = filteredRecords.filter(r => r.check_in_time).length
  const checkedOut = filteredRecords.filter(r => r.check_out_time).length
  const absent     = filteredEmps.length - checkedIn
  const late       = filteredRecords.filter(r => r.status === 'late').length

  // إحصائيات الفروع
  const isAdminView = ['admin','branch_manager'].includes(empInfo?.role || '')
  const branchStats = branches.map(b => {
    const brEmps    = employees.filter(e => e.branch_id === b.id)
    const brRecords = records.filter(r => brEmps.some(e => e.id === r.employee_id))
    return {
      branch: b,
      total:    brEmps.length,
      present:  brRecords.filter(r => r.check_in_time).length,
      absent:   brEmps.length - brRecords.filter(r => r.check_in_time).length,
      late:     brRecords.filter(r => r.status === 'late').length,
    }
  })

  // تقرير الموظف
  const reportEmployee = employees.find(e => e.id === reportEmp)
  const totalWorkMins  = reportData.reduce((s, r) => s + workMins(r), 0)
  const presentDays    = reportData.filter(r => r.check_in_time && r.status !== 'absent').length
  const absentDays     = reportData.filter(r => r.status === 'absent').length
  const lateDays       = reportData.filter(r => r.status === 'late').length
  const dailyRate      = reportEmployee?.salary ? reportEmployee.salary / 30 : 0
  const earnedSalary   = dailyRate * presentDays
  const deductions     = dailyRate * absentDays

  function printReport() {
    if (!reportEmployee) return
    const win = window.open('', '_blank')
    if (!win) return
    const rows = reportData.map(r => `<tr>
      <td>${r.date}</td>
      <td>${r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
      <td>${r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
      <td>${r.check_in_distance != null ? r.check_in_distance + 'm' : '—'}</td>
      <td>${r.check_out_distance != null ? r.check_out_distance + 'm' : '—'}</td>
      <td>${workHours(r)}</td>
      <td style="color:${r.status === 'present' ? 'green' : r.status === 'late' ? 'orange' : 'red'}">${r.status || 'present'}</td>
    </tr>`).join('')

    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>Attendance Report - ${reportEmployee.name}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; direction: rtl; }
      h2 { color: #C9A84C; margin-bottom: 4px; }
      .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
      .info-box { background: #f5f5f5; padding: 12px; border-radius: 8px; }
      .info-label { font-size: 10px; color: #666; margin-bottom: 4px; }
      .info-value { font-weight: bold; font-size: 15px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #0A1628; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; }
      td { padding: 7px 8px; border: 1px solid #ddd; text-align: center; }
      tr:nth-child(even) { background: #f9f9f9; }
      .salary-box { background: #fff8e1; border: 1px solid #C9A84C; border-radius: 8px; padding: 16px; margin-top: 20px; }
      @media print { @page { size: A4; margin: 10mm; } }
    </style></head><body>
    <h2>🌸 Orchid House — Attendance Report</h2>
    <h3 style="color:#555;font-weight:400">${reportEmployee.name} ${reportEmployee.name_en || ''} · ${reportMonth}</h3>
    <div class="info">
      <div class="info-box"><div class="info-label">Employee ID</div><div class="info-value">${reportEmployee.employee_number || '—'}</div></div>
      <div class="info-box"><div class="info-label">Role</div><div class="info-value">${reportEmployee.role}</div></div>
      <div class="info-box"><div class="info-label">Branch</div><div class="info-value">${(reportEmployee as any).branches?.name || '—'}</div></div>
      <div class="info-box"><div class="info-label" style="color:green">✅ Present Days</div><div class="info-value" style="color:green">${presentDays}</div></div>
      <div class="info-box"><div class="info-label" style="color:red">❌ Absent Days</div><div class="info-value" style="color:red">${absentDays}</div></div>
      <div class="info-box"><div class="info-label" style="color:orange">⏰ Late Days</div><div class="info-value" style="color:orange">${lateDays}</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>In Distance</th><th>Out Distance</th><th>Duration</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${reportEmployee.salary ? `
    <div class="salary-box">
      <h3 style="color:#C9A84C;margin-bottom:12px">💰 Salary Summary</h3>
      <table style="width:100%">
        <tr><td>Basic Salary</td><td style="font-weight:bold">MYR ${reportEmployee.salary.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Daily Rate (salary ÷ 30)</td><td>MYR ${dailyRate.toFixed(2)}</td></tr>
        <tr><td style="color:green">✅ Earned (${presentDays} days × MYR ${dailyRate.toFixed(2)})</td><td style="color:green;font-weight:bold">MYR ${earnedSalary.toFixed(2)}</td></tr>
        <tr><td style="color:red">❌ Deductions (${absentDays} absent days)</td><td style="color:red;font-weight:bold">- MYR ${deductions.toFixed(2)}</td></tr>
        <tr style="background:#fff8e1"><td style="font-weight:bold">💵 Net Salary</td><td style="font-weight:bold;font-size:16px;color:#C9A84C">MYR ${(earnedSalary - deductions).toFixed(2)}</td></tr>
      </table>
    </div>` : ''}
    <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#666">
      <div>Prepared by: _______________</div>
      <div>Date: ${new Date().toLocaleDateString()}</div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const inp2: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#FAFAF8',
    outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {([['day', '📅 Daily View'], ['report', '📊 Employee Report']] as [typeof tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === t ? 800 : 400, background: tab === t ? S.gold3 : 'transparent', color: tab === t ? S.gold : S.muted }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'day' && (
        <>
          {/* Branch Cards */}
          {branches.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div
                onClick={() => setFilterBranch('all')}
                style={{ background: filterBranch === 'all' ? S.gold3 : S.navy2, border: `1px solid ${filterBranch === 'all' ? S.gold : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s' }}
              >
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>🌸 All Branches</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><div style={{ fontSize: 10, color: S.muted }}>Total</div><div style={{ fontSize: 18, fontWeight: 800, color: S.white }}>{employees.length}</div></div>
                  <div><div style={{ fontSize: 10, color: S.muted }}>Present</div><div style={{ fontSize: 18, fontWeight: 800, color: S.green }}>{records.filter(r => r.check_in_time).length}</div></div>
                </div>
              </div>
              {isAdminView && branchStats.map(bs => (
                <div key={bs.branch.id}
                  onClick={() => setFilterBranch(bs.branch.id)}
                  style={{ background: filterBranch === bs.branch.id ? S.blueB : S.navy2, border: `1px solid ${filterBranch === bs.branch.id ? S.blue : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s' }}
                >
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>🏪 {bs.branch.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    <div><div style={{ fontSize: 9, color: S.muted }}>Total</div><div style={{ fontSize: 16, fontWeight: 800, color: S.white }}>{bs.total}</div></div>
                    <div><div style={{ fontSize: 9, color: S.muted }}>Present</div><div style={{ fontSize: 16, fontWeight: 800, color: S.green }}>{bs.present}</div></div>
                    <div><div style={{ fontSize: 9, color: S.muted }}>Absent</div><div style={{ fontSize: 16, fontWeight: 800, color: S.red }}>{bs.absent}</div></div>
                    <div><div style={{ fontSize: 9, color: S.muted }}>Late</div><div style={{ fontSize: 16, fontWeight: 800, color: S.amber }}>{bs.late}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Date + Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...inp2, width: 180 }} type="date" value={date} onChange={e => setDate(e.target.value)} />
            <div style={{ fontSize: 12, color: S.muted }}>
              {filteredEmps.length} employees
              {filterBranch !== 'all' && ` · ${branches.find(b => b.id === filterBranch)?.name}`}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Present',     value: checkedIn,  color: S.green, bg: S.greenB, icon: '✅' },
              { label: 'Checked Out', value: checkedOut, color: S.blue,  bg: S.blueB,  icon: '🔴' },
              { label: 'Absent',      value: absent,     color: S.red,   bg: S.redB,   icon: '❌' },
              { label: 'Late',        value: late,       color: S.amber, bg: S.amberB, icon: '⏰' },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 12, border: `1px solid ${s.color}30`, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Manual */}
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 12 }}>✏️ Manual Attendance</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 10, alignItems: 'center' }}>
              <select style={inp2} value={manualEmp} onChange={e => setManualEmp(e.target.value)}>
                <option value="">Select Employee...</option>
                {filteredEmps.map(e => <option key={e.id} value={e.id}>{e.name} {e.name_en || ''} — {e.employee_number || e.role}</option>)}
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

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ Loading...</div>
          ) : (
            <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['Employee', 'Branch', 'Dept', 'Check In', 'In Dist.', 'Check Out', 'Out Dist.', 'Duration', 'Status', 'Notes'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(r => {
                      const emp = employees.find(e => e.id === r.employee_id)
                      return (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{r.employees?.name || emp?.name || '—'}</div>
                            <div style={{ fontSize: 11, color: S.gold }}>{r.employees?.employee_number || emp?.employee_number}</div>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.blue }}>
                            {(r.employees as any)?.branches?.name || (emp as any)?.branches?.name || '—'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{r.employees?.department || emp?.department || '—'}</td>
                          <td style={{ padding: '12px 14px', fontSize: 13, color: r.check_in_time ? S.green : S.muted }}>{formatTime(r.check_in_time)}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>
                            {r.check_in_distance != null ? `${r.check_in_distance}m` : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 13, color: r.check_out_time ? S.blue : S.muted }}>{formatTime(r.check_out_time)}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>
                            {r.check_out_distance != null ? `${r.check_out_distance}m` : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold }}>{workHours(r)}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ background: r.status === 'present' ? S.greenB : r.status === 'late' ? S.amberB : r.status === 'remote' ? S.blueB : S.redB, color: r.status === 'present' ? S.green : r.status === 'late' ? S.amber : r.status === 'remote' ? S.blue : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                              {r.is_manual ? '✏️ ' : ''}{r.status || 'present'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{r.notes || '—'}</td>
                        </tr>
                      )
                    })}
                    {/* Absent */}
                    {filteredEmps.filter(e => !filteredRecords.find(r => r.employee_id === e.id)).map(e => (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${S.border}`, opacity: 0.5 }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{e.name} {e.name_en || ''}</div>
                          <div style={{ fontSize: 11, color: S.gold }}>{e.employee_number}</div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: S.blue }}>{(e as any).branches?.name || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{e.department || '—'}</td>
                        <td colSpan={5} style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>—</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: S.redB, color: S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>❌ absent</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Employee Report Tab */}
      {tab === 'report' && (
        <div>
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 14 }}>📊 Monthly Attendance Report</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Employee</label>
                <select style={inp2} value={reportEmp} onChange={e => setReportEmp(e.target.value)}>
                  <option value="">Select Employee...</option>
                  {branches.map(b => (
                    <optgroup key={b.id} label={`🏪 ${b.name}`}>
                      {employees.filter(e => e.branch_id === b.id).map(e => (
                        <option key={e.id} value={e.id}>{e.name} {e.name_en || ''} — {e.employee_number || e.role}</option>
                      ))}
                    </optgroup>
                  ))}
                  {employees.filter(e => !e.branch_id).map(e => (
                    <option key={e.id} value={e.id}>{e.name} {e.name_en || ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Month</label>
                <input style={inp2} type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
              </div>
              <button onClick={loadReport} disabled={!reportEmp || loadingReport}
                style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {loadingReport ? '⏳' : '🔍 Load'}
              </button>
            </div>
          </div>

          {reportData.length > 0 && reportEmployee && (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Present Days', value: presentDays,  color: S.green,  bg: S.greenB,  icon: '✅' },
                  { label: 'Absent Days',  value: absentDays,   color: S.red,    bg: S.redB,    icon: '❌' },
                  { label: 'Late Days',    value: lateDays,     color: S.amber,  bg: S.amberB,  icon: '⏰' },
                  { label: 'Total Hours',  value: `${Math.floor(totalWorkMins/60)}h ${totalWorkMins%60}m`, color: S.blue, bg: S.blueB, icon: '⏱' },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, borderRadius: 12, border: `1px solid ${s.color}30`, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.icon} {s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Salary Summary */}
              {reportEmployee.salary && (
                <div style={{ background: S.gold3, border: `1px solid rgba(201,168,76,0.3)`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: S.gold, marginBottom: 14 }}>💰 Salary Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Basic Salary</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: S.white }}>MYR {reportEmployee.salary.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Daily Rate (÷30)</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: S.white }}>MYR {dailyRate.toFixed(2)}</div>
                    </div>
                    <div style={{ background: S.greenB, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>✅ Earned ({presentDays} days)</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: S.green }}>MYR {earnedSalary.toFixed(2)}</div>
                    </div>
                    <div style={{ background: S.redB, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>❌ Deductions ({absentDays} absent)</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: S.red }}>- MYR {deductions.toFixed(2)}</div>
                    </div>
                    <div style={{ background: 'rgba(201,168,76,0.2)', borderRadius: 10, padding: '12px 14px', border: `1px solid rgba(201,168,76,0.4)` }}>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>💵 Net Salary</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: S.gold }}>MYR {(earnedSalary - deductions).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Print Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button onClick={printReport} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🖨️ Print Report
                </button>
              </div>

              {/* Detail Table */}
              <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.white }}>
                  📋 Daily Records — {reportEmployee.name} {reportEmployee.name_en || ''} · {reportMonth}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: S.navy3 }}>
                        {['Date', 'Check In', 'In Distance', 'Check Out', 'Out Distance', 'Duration', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map(r => (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: S.white }}>{r.date}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: r.check_in_time ? S.green : S.muted }}>{formatTime(r.check_in_time)}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>
                            {r.check_in_distance != null ? `${r.check_in_distance}m` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: r.check_out_time ? S.blue : S.muted }}>{formatTime(r.check_out_time)}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>
                            {r.check_out_distance != null ? `${r.check_out_distance}m` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: S.gold }}>{workHours(r)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: r.status === 'present' ? S.greenB : r.status === 'late' ? S.amberB : S.redB, color: r.status === 'present' ? S.green : r.status === 'late' ? S.amber : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                              {r.status || 'present'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════
export default function AttendancePage() {
  const { employee, permissions } = useAuth()
  const isManager = permissions?.all === true || ['branch_manager','kitchen_manager','hall_manager','bar_manager','kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(employee?.role || '')

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>
            {isManager ? '📊 Attendance Management' : '⏰ My Attendance'}
          </h1>
          <p style={{ fontSize: 13, color: S.muted }}>
            {isManager ? 'Track and manage employee attendance by branch' : 'Check in and out using your location'}
          </p>
        </div>
      </div>

      <MyAttendanceCard />
      {isManager && <div style={{ marginTop: 32 }}><AdminAttendanceView empInfo={employee} /></div>}
    </div>
  )
}
