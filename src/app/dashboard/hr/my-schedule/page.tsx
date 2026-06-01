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
const DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function MySchedulePage() {
  const sb = createClient()
  const { employee } = useAuth()
  const { isAr } = useLang()
  const now = new Date()

  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [schedules, setSchedules] = useState<any[]>([])
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
    sb.from('shift_schedules')
      .select('*, shifts(name,color,start_time,end_time)')
      .eq('employee_id', employee.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .then(({ data }) => { setSchedules(data || []); setLoading(false) })
  }, [employee?.id, viewMonth, viewYear])

  function getShift(dateStr: string) {
    return schedules.find(s => String(s.date).slice(0,10) === dateStr)
  }

  const todayStr = localDate(now)
  const workDays = schedules.filter(s => s.shift_id || s.custom_start).length
  const leaveDays = schedules.filter(s => !s.shift_id && !s.custom_start).length
  const todayShift = getShift(todayStr)

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
          {isAr ? 'جدول دوامك الشهري' : 'Your monthly work schedule'}
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
            const isToday = d.date === todayStr
            const isLeave = sch && !sch.shift_id && !sch.custom_start
            const hasShift = sch && (sch.shift_id || sch.custom_start)
            const timeFrom = sch?.custom_start ? sch.custom_start.slice(0,5) : sch?.shifts?.start_time?.slice(0,5)
            const timeTo = sch?.custom_end ? sch.custom_end.slice(0,5) : sch?.shifts?.end_time?.slice(0,5)
            const shiftColor = sch?.shifts?.color || S.purple

            return (
              <div key={d.date} style={{
                background: isToday ? S.gold3 : isLeave ? S.amberB : hasShift ? S.navy2 : 'transparent',
                border: `1px solid ${isToday ? S.gold+'60' : isLeave ? S.amber+'40' : hasShift ? S.border : 'transparent'}`,
                borderRadius: 12, padding: hasShift || isLeave ? '12px 16px' : '8px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                opacity: !sch ? 0.4 : 1,
              }}>
                {/* Day number */}
                <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? S.gold : S.white }}>{d.day}</div>
                  <div style={{ fontSize: 10, color: S.muted }}>{DAYS[d.dow].slice(0, isAr ? 3 : 3)}</div>
                </div>

                {/* Color bar */}
                {(hasShift || isLeave) && (
                  <div style={{ width: 4, height: 36, borderRadius: 2, background: isLeave ? S.amber : shiftColor, flexShrink: 0 }} />
                )}

                {/* Content */}
                <div style={{ flex: 1 }}>
                  {hasShift && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 2 }}>
                        {sch.custom_start ? (isAr ? '🕐 دوام مخصص' : '🕐 Custom Shift') : (sch.shifts?.name || '')}
                      </div>
                      <div style={{ fontSize: 12, color: sch.custom_start ? S.purple : S.muted }}>
                        ⏰ {timeFrom} — {timeTo}
                      </div>
                    </>
                  )}
                  {isLeave && <div style={{ fontSize: 13, fontWeight: 700, color: S.amber }}>🏖️ {isAr ? 'إجازة' : 'Day Off'}</div>}
                  {!sch && <div style={{ fontSize: 12, color: S.muted }}>—</div>}
                </div>

                {/* Today badge */}
                {isToday && (
                  <span style={{ background: S.greenB, color: S.green, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {isAr ? 'اليوم ✅' : 'Today ✅'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
