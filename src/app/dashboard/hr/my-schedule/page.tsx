'use client'

import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'
import { useLang } from '../../../components/LanguageContext'

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
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_AR = ['أح','إث','ثل','أر','خم','جم','سب']
const DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtTime(timeStr: string | null | undefined, isAr: boolean) {
  if (!timeStr) return '—'
  const d = new Date(timeStr)
  return d.toLocaleTimeString(isAr ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
}

function calcLateMins(checkIn: string | null, shiftStart: string | null, checkInDate: string): number {
  if (!checkIn || !shiftStart) return 0
  const ci = new Date(checkIn)
  const [h, m] = shiftStart.split(':').map(Number)
  const expected = new Date(checkInDate + 'T00:00:00')
  expected.setHours(h, m, 0, 0)
  const diff = Math.floor((ci.getTime() - expected.getTime()) / 60000)
  return diff > 10 ? diff : 0
}

export default function MySchedulePage() {
  const sb = createClient()
  const { employee } = useAuth()
  const { isAr } = useLang()
  const now = new Date()

  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [schedules, setSchedules] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [violations, setViolations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const monthStart = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-01`
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()
  const monthEnd = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`

  const monthDays = useMemo(() => Array.from({length: daysInMonth}, (_, i) => {
    const d = new Date(viewYear, viewMonth, i+1)
    return { day: i+1, date: localDate(d), dow: d.getDay() }
  }), [viewMonth, viewYear, daysInMonth])

  useEffect(() => {
    if (!employee?.id) return
    setLoading(true)
    Promise.all([
      sb.from('shift_schedules')
        .select('*, shifts(name,color,start_time,end_time)')
        .eq('employee_id', employee.id)
        .gte('date', monthStart)
        .lte('date', monthEnd),
      sb.from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('date', monthStart)
        .lte('date', monthEnd),
      sb.from('violations')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false }),
    ]).then(([schRes, attRes, vioRes]) => {
      setSchedules(schRes.data || [])
      setAttendance(attRes.data || [])
      setViolations(vioRes.data || [])
      setLoading(false)
    })
  }, [employee?.id, viewMonth, viewYear])

  function getShift(dateStr: string) {
    return schedules.find(s => String(s.date).slice(0,10) === dateStr)
  }
  function getAtt(dateStr: string) {
    return attendance.find(a => String(a.date).slice(0,10) === dateStr)
  }
  function getDayViolations(dateStr: string) {
    return violations.filter(v => String(v.date).slice(0,10) === dateStr)
  }

  const todayStr = localDate(now)
  const workDays = schedules.filter(s => s.shift_id || s.custom_start).length
  // الإجازة = أيام الشهر اللي مفيش ليها شيفت + الأيام اللي محفوظة كإجازة صريحة
  const scheduledDates = new Set(schedules.map(s => String(s.date).slice(0,10)))
  const leaveDays = monthDays.filter(d => {
    const sch = schedules.find(s => String(s.date).slice(0,10) === d.date)
    return !scheduledDates.has(d.date) || (sch && !sch.shift_id && !sch.custom_start)
  }).length
  const todayShift = getShift(todayStr)

  // إجمالي التأخير الشهري
  const totalLateMins = useMemo(() => {
    return attendance.reduce((total, att) => {
      const sch = schedules.find(s => String(s.date).slice(0,10) === String(att.date).slice(0,10))
      const shiftStart = sch?.custom_start || sch?.shifts?.start_time
      const late = calcLateMins(att.check_in_time, shiftStart, String(att.date).slice(0,10))
      return total + late
    }, 0)
  }, [attendance, schedules])

  const totalLateHours = Math.floor(totalLateMins / 60)
  const totalLateRemMins = totalLateMins % 60
  const totalViolationsAmount = violations.filter(v => v.status === 'active').reduce((s, v) => s + (v.amount || 0), 0)

  const MONTHS = isAr ? MONTHS_AR : MONTHS_EN
  const DAYS = isAr ? DAYS_AR : DAYS_EN

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white, maxWidth: 640, margin: '0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: S.white, marginBottom: 4 }}>
          📅 {isAr ? 'دوامي' : 'My Schedule'}
        </h1>
        <p style={{ fontSize: 13, color: S.muted }}>
          {isAr ? 'جدول دوامك الشهري مع سجل الحضور' : 'Your monthly schedule with attendance records'}
        </p>
      </div>

      {/* Today's Shift */}
      {todayShift && (
        <div style={{ background: `linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))`, border: `1px solid ${S.gold}40`, borderRadius: 16, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 36 }}>⏰</div>
          <div>
            <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 2 }}>
              {isAr ? 'دوام اليوم' : "Today's Shift"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.white }}>
              {todayShift.custom_start
                ? `${todayShift.custom_start.slice(0,5)} — ${todayShift.custom_end?.slice(0,5)}`
                : todayShift.shifts
                ? `${todayShift.shifts.name} · ${todayShift.shifts.start_time?.slice(0,5)} — ${todayShift.shifts.end_time?.slice(0,5)}`
                : isAr ? '🏖️ إجازة' : '🏖️ Day Off'}
            </div>
          </div>
        </div>
      )}

      {/* Month Navigator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, background: S.navy2, borderRadius: 12, padding: '12px 16px', border: `1px solid ${S.border}` }}>
        <button onClick={() => { if(viewMonth === 0) { setViewMonth(11); setViewYear(y=>y-1) } else setViewMonth(m=>m-1) }}
          style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 8, color: S.white, cursor: 'pointer', padding: '6px 12px', fontSize: 16 }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: S.white }}>{MONTHS[viewMonth]} {viewYear}</div>
          <div style={{ fontSize: 11, color: S.muted }}>
            {isAr ? `${workDays} يوم عمل · ${leaveDays} إجازة` : `${workDays} work days · ${leaveDays} days off`}
          </div>
        </div>
        <button onClick={() => { if(viewMonth === 11) { setViewMonth(0); setViewYear(y=>y+1) } else setViewMonth(m=>m+1) }}
          style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 8, color: S.white, cursor: 'pointer', padding: '6px 12px', fontSize: 16 }}>›</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: isAr ? 'أيام العمل' : 'Work Days', value: workDays, color: S.green, bg: S.greenB },
          { label: isAr ? 'إجازات' : 'Days Off', value: leaveDays, color: S.amber, bg: S.amberB },
          { label: isAr ? 'أيام الشهر' : 'Total Days', value: daysInMonth, color: S.blue, bg: S.blueB },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '12px', textAlign: 'center', border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Schedule List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ {isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {monthDays.map(d => {
            const sch = getShift(d.date)
            const att = getAtt(d.date)
            const isToday = d.date === todayStr
            const isLeave = !sch || (!sch.shift_id && !sch.custom_start)
            const hasShift = sch && (sch.shift_id || sch.custom_start)
            const timeFrom = sch?.custom_start ? sch.custom_start.slice(0,5) : sch?.shifts?.start_time?.slice(0,5)
            const timeTo = sch?.custom_end ? sch.custom_end.slice(0,5) : sch?.shifts?.end_time?.slice(0,5)
            const shiftColor = sch?.shifts?.color || S.purple

            // حساب التأخير
            const shiftStartStr = sch?.custom_start || sch?.shifts?.start_time
            const lateMins = att ? calcLateMins(att.check_in_time, shiftStartStr, d.date) : 0
            const isLate = lateMins > 0

            if (!sch && !att) return (
              <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: 0.3, padding: '6px 16px' }}>
                <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: S.white }}>{d.day}</div>
                  <div style={{ fontSize: 10, color: S.muted }}>{DAYS[d.dow]}</div>
                </div>
                <div style={{ fontSize: 12, color: S.muted }}>—</div>
              </div>
            )

            return (
              <div key={d.date} style={{
                background: isToday ? S.gold3 : isLeave ? S.amberB : hasShift ? S.navy2 : S.card,
                border: `1px solid ${isToday ? S.gold+'60' : isLate ? S.red+'40' : isLeave ? S.amber+'40' : hasShift ? S.border : S.border}`,
                borderRadius: 14, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Day */}
                  <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? S.gold : S.white }}>{d.day}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>{DAYS[d.dow]}</div>
                  </div>

                  {/* Color bar */}
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: isLeave ? S.amber : isLate ? S.red : shiftColor, flexShrink: 0 }} />

                  {/* Shift info */}
                  <div style={{ flex: 1 }}>
                    {isLeave && <div style={{ fontSize: 13, fontWeight: 700, color: S.amber }}>🏖️ {isAr ? 'إجازة' : 'Day Off'}</div>}
                    {hasShift && (
                      <>
                        <div style={{ fontSize: 12, color: S.muted, marginBottom: 4 }}>
                          {isAr ? '📋 الدوام المخصص:' : '📋 Scheduled:'} <span style={{ color: S.white, fontWeight: 600 }}>{timeFrom} — {timeTo}</span>
                        </div>
                        {att?.check_in_time && (
                          <div style={{ fontSize: 12, color: S.muted, marginBottom: isLate ? 4 : 0 }}>
                            {isAr ? '✅ دخل:' : '✅ Check in:'} <span style={{ color: S.green, fontWeight: 600 }}>{fmtTime(att.check_in_time, isAr)}</span>
                            {att.check_out_time && (
                              <> · {isAr ? '🚪 خرج:' : '🚪 Check out:'} <span style={{ color: S.blue, fontWeight: 600 }}>{fmtTime(att.check_out_time, isAr)}</span></>
                            )}
                          </div>
                        )}
                        {isLate && (
                          <div style={{ fontSize: 12, color: S.red, fontWeight: 700, background: S.redB, borderRadius: 8, padding: '3px 10px', display: 'inline-block' }}>
                            ⏰ {isAr ? `متأخر ${lateMins} دقيقة` : `Late ${lateMins} min`}
                          </div>
                        )}
                        {getDayViolations(d.date).map((v, vi) => (
                          <div key={vi} style={{ fontSize: 11, marginTop: 4, background: v.status === 'cancelled' ? 'rgba(255,255,255,0.04)' : S.redB, borderRadius: 8, padding: '4px 10px', border: `1px solid ${v.status === 'cancelled' ? 'rgba(255,255,255,0.1)' : S.red+'40'}`, opacity: v.status === 'cancelled' ? 0.6 : 1 }}>
                            <span style={{ color: v.status === 'cancelled' ? S.muted : S.red, fontWeight: 700 }}>
                              ⚠️ {v.status === 'cancelled' ? (isAr ? '(ملغاة) ' : '(Cancelled) ') : ''}{isAr ? 'مخالفة:' : 'Violation:'} MYR {(v.amount || 0).toFixed(2)}
                            </span>
                            <span style={{ color: S.muted, marginRight: 6 }}> — {v.reason}</span>
                          </div>
                        ))}
                        {!att?.check_in_time && d.date < todayStr && (
                          <div style={{ fontSize: 11, color: S.red }}>❌ {isAr ? 'لم يتم تسجيل الحضور' : 'No check-in recorded'}</div>
                        )}
                      </>
                    )}
                  </div>

                  {isToday && (
                    <span style={{ background: S.greenB, color: S.green, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {isAr ? 'اليوم' : 'Today'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Monthly Late Summary */}
          {totalLateMins > 0 && (
            <div style={{ background: S.redB, border: `1px solid ${S.red}40`, borderRadius: 14, padding: '16px 20px', marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: S.red, marginBottom: 8 }}>
                ⏰ {isAr ? 'ملخص التأخير الشهري' : 'Monthly Late Summary'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: S.red }}>{totalLateMins}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'إجمالي الدقائق' : 'Total Minutes'}</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: S.red }}>{totalLateHours}:{String(totalLateRemMins).padStart(2,'0')}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'الساعات:الدقائق' : 'Hours:Minutes'}</div>
                </div>
              </div>
            </div>
          )}

          {totalViolationsAmount > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: `1px solid ${S.red}40`, borderRadius: 14, padding: '16px 20px', marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: S.red, marginBottom: 8 }}>
                ⚠️ {isAr ? 'ملخص المخالفات الشهرية' : 'Monthly Violations Summary'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: S.red }}>{violations.filter(v => v.status === 'active').length}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'عدد المخالفات' : 'Total Violations'}</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: S.red }}>MYR {totalViolationsAmount.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'إجمالي الخصم' : 'Total Deductions'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
