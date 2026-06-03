'use client'


import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'
import { useLang } from '../../../components/LanguageContext'

const supabase = createBrowserClient(
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
  card: 'rgba(255,255,255,0.04)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const DAYS_SHORT = ['أح','إث','ثل','أر','خم','جم','سب']
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const SHIFT_COLORS = ['#C9A84C','#22C55E','#3B82F6','#8B5CF6','#EF4444','#F59E0B','#14B8A6','#EC4899']

function ld(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayStr() { return ld(new Date()) }

// ══ Shift Modal ══
function ShiftModal({ shift, onClose, onSaved }: { shift?: any; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: shift?.name||'', start_time: shift?.start_time||'08:00', end_time: shift?.end_time||'16:00', color: shift?.color||'#C9A84C' })

  async function save() {
    if (!form.name) return
    setSaving(true)
    if (shift) await supabase.from('shifts').update(form).eq('id', shift.id)
    else await supabase.from('shifts').insert([form])
    setSaving(false)
    setTimeout(() => onSaved(), 300)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:S.navy2,borderRadius:20,border:`1px solid ${S.border}`,width:'100%',maxWidth:400,padding:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h3 style={{color:S.white,fontSize:16,fontWeight:800}}>{shift?'✏️ تعديل':'➕ شيفت جديد'}</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:S.muted,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>اسم الشيفت *</label>
            <input style={inp} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="مثال: صباحي / مسائي" autoFocus />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>من</label>
              <input style={{...inp,direction:'ltr',textAlign:'center'}} type="time" value={form.start_time} onChange={e=>setForm(p=>({...p,start_time:e.target.value}))} />
            </div>
            <div>
              <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>إلى</label>
              <input style={{...inp,direction:'ltr',textAlign:'center'}} type="time" value={form.end_time} onChange={e=>setForm(p=>({...p,end_time:e.target.value}))} />
            </div>
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:8}}>اللون</label>
            <div style={{display:'flex',gap:8}}>
              {SHIFT_COLORS.map(c=><button key={c} onClick={()=>setForm(p=>({...p,color:c}))} style={{width:32,height:32,borderRadius:8,background:c,border:form.color===c?`3px solid ${S.white}`:'3px solid transparent',cursor:'pointer'}} />)}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 18px',borderRadius:10,border:`1px solid ${S.muted}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{padding:'9px 22px',borderRadius:10,border:`1px solid ${S.gold}`,background:S.gold3,color:S.gold,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
            {saving?'⏳...':shift?'💾 حفظ':'✅ إضافة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Assign Monthly Modal ══
function AssignModal({ employees, shifts, onClose, onSaved, initialEmpId, initialMonth, initialYear }: { employees: any[]; shifts: any[]; onClose: () => void; onSaved: () => void; initialEmpId?: string | null; initialMonth?: number; initialYear?: number }) {
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const now = new Date()
  const [empId, setEmpId] = useState(initialEmpId || '')
  const [month, setMonth] = useState(initialMonth ?? now.getMonth())
  const [year, setYear] = useState(initialYear ?? now.getFullYear())
  // calendarMap: date → { type: 'shift'|'custom'|'leave'|'off', shiftId?: string, customStart?: string, customEnd?: string }
  const [calendarMap, setCalendarMap] = useState<Record<string, { type: string; shiftId?: string; customStart?: string; customEnd?: string }>>({})
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [bulkShift, setBulkShift] = useState('')
  const [bulkType, setBulkType] = useState<'shift'|'custom'|'leave'|'off'>('shift')
  const [customStart, setCustomStart] = useState('08:00')
  const [customEnd, setCustomEnd] = useState('16:00')
  // لتعديل يوم واحد بشكل مباشر
  const [editDay, setEditDay] = useState<string | null>(null)
  // تحميل الجدول الموجود عند اختيار موظف
  const [loadedSchedule, setLoadedSchedule] = useState(false)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  useEffect(() => {
    if (initialEmpId) loadExistingSchedule(initialEmpId)
  }, [initialEmpId])

  const DAYS_HDR = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب']

  const allDays = Array.from({ length: daysInMonth }, (_: unknown, i: number) => {
    const d = new Date(year, month, i + 1)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    return { day: i + 1, date: dateStr, dow: d.getDay() }
  })

  // تحميل الجدول الموجود للموظف لهذا الشهر
  async function loadExistingSchedule(eId: string) {
    if (!eId) return
    const ms = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const me = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
    const { data } = await supabase.from('shift_schedules')
      .select('*, shifts(name,color,start_time,end_time)')
      .eq('employee_id', eId).gte('date', ms).lte('date', me)
    if (data && data.length > 0) {
      const map: Record<string, { type: string; shiftId?: string; customStart?: string; customEnd?: string }> = {}
      data.forEach((s: any) => {
        const dateStr = String(s.date).slice(0, 10)
        if (s.custom_start && s.custom_end) {
          map[dateStr] = { type: 'custom', customStart: s.custom_start.slice(0,5), customEnd: s.custom_end.slice(0,5) }
        } else if (s.shift_id) {
          map[dateStr] = { type: 'shift', shiftId: s.shift_id }
        }
      })
      setCalendarMap(map)
      setLoadedSchedule(true)
    } else {
      setCalendarMap({})
      setLoadedSchedule(false)
    }
  }

  function toggleDate(dateStr: string) {
    if (editDay === dateStr) { setEditDay(null); return }
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  function applyBulk() {
    if (selectedDates.size === 0) { alert('اختر أيام أولاً'); return }
    if (bulkType === 'shift' && !bulkShift) { alert('اختر الشيفت'); return }
    if (bulkType === 'custom' && (!customStart || !customEnd)) { alert('أدخل وقت البداية والنهاية'); return }
    setCalendarMap(prev => {
      const next = { ...prev }
      selectedDates.forEach(d => {
        if (bulkType === 'off') delete next[d]
        else if (bulkType === 'shift') next[d] = { type: 'shift', shiftId: bulkShift }
        else if (bulkType === 'custom') next[d] = { type: 'custom', customStart, customEnd }
        else if (bulkType === 'leave') next[d] = { type: 'leave' }
      })
      return next
    })
    setSelectedDates(new Set())
  }

  function applyPattern(pattern: 'all_shift' | 'weekdays' | 'clear') {
    if (pattern === 'clear') { setCalendarMap({}); return }
    if (bulkType === 'shift' && !bulkShift) { alert('اختر الشيفت أولاً'); return }
    if (bulkType === 'custom' && (!customStart || !customEnd)) { alert('أدخل الوقت أولاً'); return }
    const next: Record<string, { type: string; shiftId?: string; customStart?: string; customEnd?: string }> = {}
    allDays.forEach(d => {
      const include = pattern === 'all_shift' || (pattern === 'weekdays' && d.dow !== 5 && d.dow !== 6)
      if (include) {
        if (bulkType === 'shift') next[d.date] = { type: 'shift', shiftId: bulkShift }
        else if (bulkType === 'custom') next[d.date] = { type: 'custom', customStart, customEnd }
      }
    })
    setCalendarMap(next)
  }

  // تعديل يوم واحد مباشرة
  function applyEditDay(type: string, shiftId?: string, cs?: string, ce?: string) {
    if (!editDay) return
    setCalendarMap(prev => {
      const next = { ...prev }
      if (type === 'off') delete next[editDay]
      else if (type === 'shift') next[editDay] = { type: 'shift', shiftId }
      else if (type === 'custom') next[editDay] = { type: 'custom', customStart: cs, customEnd: ce }
      else if (type === 'leave') next[editDay] = { type: 'leave' }
      return next
    })
    setEditDay(null)
  }

  async function save() {
    if (!empId) { alert('اختر موظف'); return }
    const shiftDays = Object.entries(calendarMap).filter(([, v]) => v.type === 'shift' || v.type === 'custom')
    const leaveDays = Object.entries(calendarMap).filter(([, v]) => v.type === 'leave')
    if (shiftDays.length === 0 && leaveDays.length === 0) { alert('لم تحدد أي أيام'); return }
    setSaving(true)
    const ms = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const me = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
    setProgress('حذف الجدول القديم...')
    await supabase.from('shift_schedules').delete().eq('employee_id', empId).gte('date', ms).lte('date', me)
    if (shiftDays.length > 0) {
      setProgress(`إضافة ${shiftDays.length} يوم...`)
      const rows = shiftDays.map(([date, v]) => ({
        employee_id: empId,
        shift_id: v.type === 'shift' ? v.shiftId : null,
        date,
        status: 'confirmed',
        custom_start: v.type === 'custom' ? v.customStart : null,
        custom_end: v.type === 'custom' ? v.customEnd : null,
      }))
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase.from('shift_schedules').insert(rows.slice(i, i + 50))
        if (error) { console.error('Shift insert error:', error); alert('خطأ في الحفظ: ' + error.message); setSaving(false); return }
      }
    }
    // إشعار اختياري — لو فشل مش هيوقف الحفظ
    try {
      await supabase.from('employee_requests').insert([{
        employee_id: empId, request_type: 'shift_assigned',
        title: `جدول ${MONTHS_AR[month]} ${year}`,
        description: `شيفتات: ${shiftDays.length} يوم — إجازات: ${leaveDays.length} يوم`,
        status: 'approved'
      }])
    } catch (_) {}
    setSaving(false)
    setTimeout(() => onSaved(), 300)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 720, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: S.white, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>📅 تعيين جدول شهري</h3>
            <p style={{ fontSize: 12, color: S.muted }}>اختر الأيام من التقويم — يدعم الشيفتات والأوقات المخصصة والإجازات</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Row: Employee + Month + Year */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الموظف *</label>
            <select style={inp} value={empId} onChange={e => { setEmpId(e.target.value); setCalendarMap({}); loadExistingSchedule(e.target.value) }}>
              <option value="">-- اختر الموظف --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.name_en ? ' '+e.name_en : ''} — {e.department}</option>)}
            </select>
            {loadedSchedule && <div style={{ fontSize: 11, color: S.amber, marginTop: 4 }}>⚠️ يوجد جدول محفوظ — سيتم استبداله عند الحفظ</div>}
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الشهر</label>
            <select style={inp} value={month} onChange={e => { setMonth(parseInt(e.target.value)); setCalendarMap({}); setSelectedDates(new Set()); setLoadedSchedule(false) }}>
              {MONTHS_AR.map((m: string, i: number) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>السنة</label>
            <select style={inp} value={year} onChange={e => { setYear(parseInt(e.target.value)); setCalendarMap({}); setSelectedDates(new Set()); setLoadedSchedule(false) }}>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Shift + Custom time selector */}
        <div style={{ background: S.navy3, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 10 }}>نوع اليوم للتطبيق</div>

          {/* Type buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { key: 'shift', label: '⏰ شيفت', color: S.blue, bg: S.blueB },
              { key: 'custom', label: '🕐 وقت مخصص', color: S.purple, bg: S.purpleB },
              { key: 'leave', label: '🏖️ إجازة', color: S.amber, bg: S.amberB },
              { key: 'off', label: '❌ مسح', color: S.red, bg: S.redB },
            ].map(t => (
              <button key={t.key} onClick={() => setBulkType(t.key as any)}
                style={{ padding: '7px 16px', borderRadius: 8, border: `2px solid ${bulkType === t.key ? t.color : S.border}`, background: bulkType === t.key ? t.bg : 'transparent', color: bulkType === t.key ? t.color : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Shift selector */}
          {bulkType === 'shift' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {shifts.map(s => (
                <button key={s.id} onClick={() => setBulkShift(s.id)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: `2px solid ${bulkShift === s.id ? s.color : S.border}`, background: bulkShift === s.id ? s.color + '20' : 'transparent', color: bulkShift === s.id ? s.color : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {s.name} ({s.start_time?.slice(0, 5)}—{s.end_time?.slice(0, 5)})
                </button>
              ))}
            </div>
          )}

          {/* Custom time */}
          {bulkType === 'custom' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>من</label>
                <input type="time" style={{ ...inp, width: 120, direction: 'ltr', textAlign: 'center' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div style={{ color: S.muted, marginTop: 20 }}>→</div>
              <div>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>إلى</label>
                <input type="time" style={{ ...inp, width: 120, direction: 'ltr', textAlign: 'center' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
              <div style={{ background: S.purpleB, borderRadius: 8, padding: '6px 12px', marginTop: 16, fontSize: 12, color: S.purple, fontWeight: 700 }}>
                {customStart} — {customEnd}
              </div>
            </div>
          )}

          {/* Quick patterns */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
            <span style={{ fontSize: 11, color: S.muted, alignSelf: 'center' }}>تطبيق سريع:</span>
            <button onClick={() => applyPattern('all_shift')} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>كل الشهر</button>
            <button onClick={() => applyPattern('weekdays')} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>أيام الأسبوع</button>
            <button onClick={() => applyPattern('clear')} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>مسح الكل</button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedDates.size > 0 && (
          <div style={{ background: S.amberB, border: `1px solid ${S.amber}40`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: S.amber, fontWeight: 700 }}>{selectedDates.size} يوم محدد</span>
            <button onClick={applyBulk} style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ تطبيق على المحدد</button>
            <button onClick={() => setSelectedDates(new Set())} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>إلغاء التحديد</button>
          </div>
        )}

        {/* Edit day popup */}
        {editDay && (
          <div style={{ background: S.navy3, border: `1px solid ${S.gold}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 10 }}>✏️ تعديل يوم {editDay}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {shifts.map(s => (
                <button key={s.id} onClick={() => applyEditDay('shift', s.id)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${s.color}`, background: s.color + '20', color: s.color, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {s.name}
                </button>
              ))}
              <button onClick={() => applyEditDay('custom', undefined, customStart, customEnd)}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                🕐 {customStart}—{customEnd}
              </button>
              <button onClick={() => applyEditDay('leave')}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                🏖️ إجازة
              </button>
              <button onClick={() => applyEditDay('off')}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                ❌ مسح
              </button>
              <button onClick={() => setEditDay(null)}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* Calendar */}
        <div style={{ background: S.navy3, borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
            {DAYS_HDR.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: S.muted, fontWeight: 700, padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: firstDow }).map((_: unknown, i: number) => <div key={`e-${i}`} />)}
            {allDays.map(d => {
              const entry = calendarMap[d.date]
              const isSelected = selectedDates.has(d.date)
              const isEditDay = editDay === d.date
              const isToday = d.date === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
              const shift = entry?.type === 'shift' ? shifts.find(s => s.id === entry.shiftId) : null
              const isWeekend = d.dow === 5 || d.dow === 6

              let bg = 'rgba(255,255,255,0.03)'
              let border = '1px solid rgba(255,255,255,0.06)'
              if (isEditDay) { bg = 'rgba(201,168,76,0.25)'; border = `2px solid ${S.gold}` }
              else if (isSelected) { bg = 'rgba(245,158,11,0.2)'; border = `1px solid ${S.amber}` }
              else if (entry?.type === 'shift' && shift) { bg = shift.color + '20'; border = `1px solid ${shift.color}60` }
              else if (entry?.type === 'custom') { bg = 'rgba(139,92,246,0.15)'; border = `1px solid ${S.purple}60` }
              else if (entry?.type === 'leave') { bg = 'rgba(245,158,11,0.15)'; border = `1px solid ${S.amber}40` }
              if (isToday && !isEditDay) border = `2px solid ${S.gold}`

              return (
                <div key={d.date}
                  onClick={() => toggleDate(d.date)}
                  onDoubleClick={() => setEditDay(d.date)}
                  title="اضغط للتحديد — اضغط مرتين للتعديل المباشر"
                  style={{ background: bg, border, borderRadius: 8, padding: '4px 2px', cursor: 'pointer', textAlign: 'center', minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, transition: 'all .1s' }}>
                  <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? S.gold : (isWeekend ? S.muted : S.white) }}>{d.day}</div>
                  {entry?.type === 'shift' && shift && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: shift.color, background: shift.color + '30', borderRadius: 4, padding: '1px 4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shift.name?.slice(0, 4)}
                    </div>
                  )}
                  {entry?.type === 'custom' && (
                    <div style={{ fontSize: 8, fontWeight: 700, color: S.purple, background: S.purpleB, borderRadius: 4, padding: '1px 3px' }}>
                      {entry.customStart?.slice(0,5)}
                    </div>
                  )}
                  {entry?.type === 'leave' && <div style={{ fontSize: 12 }}>🏖️</div>}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: S.muted, marginTop: 8, textAlign: 'center' }}>
            💡 اضغط مرة للتحديد — اضغط مرتين للتعديل المباشر
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'شيفتات', count: Object.values(calendarMap).filter(v => v.type === 'shift').length, color: S.blue, icon: '⏰' },
            { label: 'مخصصة', count: Object.values(calendarMap).filter(v => v.type === 'custom').length, color: S.purple, icon: '🕐' },
            { label: 'إجازات', count: Object.values(calendarMap).filter(v => v.type === 'leave').length, color: S.amber, icon: '🏖️' },
            { label: 'محددة', count: selectedDates.size, color: S.amber, icon: '🔶' },
          ].map((s, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 10, padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{s.icon}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.count}</span>
              <span style={{ fontSize: 12, color: S.muted }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {shifts.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
              <span style={{ fontSize: 11, color: S.muted }}>{s.name}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: S.purple }} />
            <span style={{ fontSize: 11, color: S.muted }}>وقت مخصص</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏖️</span>
            <span style={{ fontSize: 11, color: S.muted }}>إجازة</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 12, color: S.muted }}>{progress}</span>}
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '✅ حفظ الجدول'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Request Modal (للموظف) ══
function RequestModal({ shifts, employeeId, onClose, onSaved }: { shifts: any[]; employeeId: string; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [shiftId, setShiftId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [reason, setReason] = useState('')

  async function save() {
    if (!shiftId||!date) { alert('يرجى اختيار الشيفت والتاريخ'); return }
    setSaving(true)
    await supabase.from('shift_requests').insert([{employee_id:employeeId,shift_id:shiftId,date,reason,status:'pending'}])
    setSaving(false)
    setTimeout(() => onSaved(), 300)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:S.navy2,borderRadius:20,border:`1px solid ${S.border}`,width:'100%',maxWidth:400,padding:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h3 style={{color:S.white,fontSize:16,fontWeight:800}}>🔄 طلب تغيير شيفت</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:S.muted,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>الشيفت المطلوب *</label>
            <select style={inp} value={shiftId} onChange={e=>setShiftId(e.target.value)}>
              <option value="">اختر الشيفت</option>
              {shifts.map(s=><option key={s.id} value={s.id}>{s.name} ({s.start_time?.slice(0,5)}—{s.end_time?.slice(0,5)})</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>التاريخ *</label>
            <input style={{...inp,direction:'ltr',textAlign:'left'}} type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>السبب</label>
            <textarea style={{...inp,minHeight:70,resize:'vertical'} as React.CSSProperties} value={reason} onChange={e=>setReason(e.target.value)} placeholder="سبب طلب التغيير..." />
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 18px',borderRadius:10,border:`1px solid ${S.muted}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{padding:'9px 20px',borderRadius:10,border:`1px solid ${S.teal}`,background:S.tealB,color:S.teal,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
            {saving?'⏳...':'📤 إرسال'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function ShiftsPage() {
  const { isAr } = useLang()
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  const isBranchManager = employee?.role === 'branch_manager'
  const isDeptManager = ['kitchen_manager','hall_manager','bar_manager'].includes(employee?.role||'')
  const isSupervisor = ['kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(employee?.role||'')
  const hasAssignShifts = permissions?.assign_shifts === true
  const canAssignShifts = isAdmin || isBranchManager || isDeptManager || hasAssignShifts
  console.log('DEBUG shifts:', { role: employee?.role, hasAssignShifts, canAssignShifts, permissions })
  const isManager = isAdmin || isBranchManager || isDeptManager
  const isEmployee = !isManager

  // ── منع الوصول لغير المصرح لهم ──
  if (employee && !canAssignShifts) {
    return (
      <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 64 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>غير مصرح بالوصول</div>
        <div style={{ fontSize: 14, color: '#8A9BB5', textAlign: 'center' }}>استخدم صفحة "دوامي" لعرض جدولك الشخصي</div>
      </div>
    )
  }



  const [shifts, setShifts] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [attendanceToday, setAttendanceToday] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [mySchedules, setMySchedules] = useState<any[]>([])
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0) // لإعادة التحميل

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [activeTab, setActiveTab] = useState('schedule')
  const [filterBranch, setFilterBranch] = useState('all')
  const [showAddShift, setShowAddShift] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assignEmpId, setAssignEmpId] = useState<string | null>(null)
  const [showRequest, setShowRequest] = useState(false)
  const [editShift, setEditShift] = useState<any>(null)

  function refresh() { setTick(t=>t+1) }

  useEffect(() => { setActiveTab(isEmployee?'my_schedule':'schedule') }, [isEmployee])

  useEffect(() => {
    if (!employee?.id) return

    const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()
    const monthStart = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-01`
    const monthEnd = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`

    setLoading(true)

    // جيب كل حاجة بشكل متسلسل مش parallel
    async function load() {
      const {data: shData} = await supabase.from('shifts').select('*').eq('is_active',true).order('start_time')
      setShifts(shData||[])

      // بعد ✅

      // فلتر الموظفين حسب دور المدير
      let empQuery = supabase.from('employees').select('id,name,name_en,role,department,branch_id,branches(name)').eq('is_active',true).order('name')
      // فلتر بالفرع أولاً لمدير الفرع
      if (employee?.role === 'branch_manager') empQuery = empQuery.eq('branch_id', employee.branch_id || '')
      else if (employee?.role === 'kitchen_manager') empQuery = empQuery.eq('branch_id', employee.branch_id || '').in('department', ['المطبخ','البار','الحلويات','Kitchen','Bar','Desserts'])
      else if (employee?.role === 'hall_manager') empQuery = empQuery.eq('branch_id', employee.branch_id || '').in('department', ['الصالة','Hall'])
      else if (employee?.role === 'bar_manager') empQuery = empQuery.eq('branch_id', employee.branch_id || '').in('department', ['البار','Bar'])
      else if (hasAssignShifts && isSupervisor) {
        const deptMap: Record<string, string[]> = {
          kitchen_supervisor: ['المطبخ','Kitchen'],
          hall_supervisor: ['الصالة','Hall'],
          bar_supervisor: ['البار','Bar'],
        }
        const depts = deptMap[employee?.role||''] || []
        if (depts.length > 0) empQuery = empQuery.eq('branch_id', employee?.branch_id||'').in('department', depts)
      }
      const {data: empData} = await empQuery
      setEmployees(empData||[])
// جيب الشيفتات للموظفين المحملين — بشكل مجزأ لو أكتر من 50
      const empIds = (empData||[]).map((e:any) => e.id)
      let allSchData: any[] = []
      const chunkSize = 50
      for (let i = 0; i < Math.max(1, Math.ceil(empIds.length / chunkSize)); i++) {
        const chunk = empIds.slice(i * chunkSize, (i + 1) * chunkSize)
        let q = supabase.from('shift_schedules')
          .select('*, shifts(name,color,start_time,end_time), custom_start, custom_end')
          .gte('date', monthStart)
          .lte('date', monthEnd)
        if (chunk.length > 0) q = q.in('employee_id', chunk)
        const { data: chunkData } = await q
        allSchData = [...allSchData, ...(chunkData || [])]
        if (chunk.length === 0) break
      }
      const schData = allSchData

      const sch = schData||[]
      setSchedules(sch)
      setMySchedules(sch.filter((s:any)=>s.employee_id===employee?.id))

      const {data: reqData} = await supabase.from('shift_requests')
        .select('*,employees(name,name_en,department),shifts(name,start_time,end_time,color)')
        .eq('status','pending').order('created_at',{ascending:false})

      const reqs = reqData||[]
      if (permissions?.all===true) setRequests(reqs)
      else if (isManager) setRequests(reqs.filter((r:any)=>r.employees?.department===employee?.department))

      const {data: myR} = await supabase.from('shift_requests')
        .select('*,shifts(name,start_time,end_time,color)')
        .eq('employee_id',employee?.id||'')
        .order('created_at',{ascending:false}).limit(20)
      setMyRequests(myR||[])

      // جيب الحضور الفعلي لليوم
      const today = todayStr()
      const empIds2 = (empData||[]).map((e:any) => e.id)
      if (empIds2.length > 0) {
        const attChunks: any[] = []
        for (let i = 0; i < Math.ceil(empIds2.length/50); i++) {
          const chunk = empIds2.slice(i*50, (i+1)*50)
          const { data: attChunk } = await supabase.from('attendance')
            .select('*, employees(id,name,name_en,department,branches(name))')
            .eq('date', today)
            .not('check_in_time', 'is', null)
            .is('check_out_time', null)
            .in('employee_id', chunk)
          attChunks.push(...(attChunk||[]))
        }
        setAttendanceToday(attChunks)
      }

      setLoading(false)
    }

    load()
  }, [employee?.id, viewMonth, viewYear, tick])

  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()
  const monthDays = useMemo(()=>Array.from({length:daysInMonth},(_,i)=>{
    const d = new Date(viewYear,viewMonth,i+1)
    return {day:i+1, date:ld(d), dow:d.getDay()}
  }), [viewMonth,viewYear,daysInMonth])

  function getShift(empId:string, dateStr:string) {
    return schedules.find(s=>s.employee_id===empId && String(s.date).slice(0,10)===dateStr)
  }

  // من يعمل الآن

  function normalizeDept(dept: string) {
    const arToEn: Record<string, string> = {
      'المطبخ': 'Kitchen', 'الصالة': 'Hall', 'البار': 'Bar',
      'الحلويات': 'Desserts', 'الكاشير': 'Cashier', 'النظافة': 'Cleaning',
      'التوصيل': 'Delivery', 'الإدارة': 'Management',
    }
    const enToAr: Record<string, string> = {
      'Kitchen': 'المطبخ', 'Hall': 'الصالة', 'Bar': 'البار',
      'Desserts': 'الحلويات', 'Cashier': 'الكاشير', 'Cleaning': 'النظافة',
      'Delivery': 'التوصيل', 'Management': 'الإدارة',
    }
    if (isAr) return enToAr[dept] || dept
    return arToEn[dept] || dept
  }

  // يعملون الآن = الموظفون اللي سجلوا حضور ولم يسجلوا انصراف بعد
  const workingNow = attendanceToday

  // الفروع من الموظفين المحملين
  const branches = useMemo(()=>{
    const b = new Set<string>()
    employees.forEach((e:any)=>{
      const brName = Array.isArray(e.branches)?e.branches[0]?.name:e.branches?.name
      b.add(brName||'بدون فرع')
    })
    return [...b]
  },[employees])

  function getBranchName(emp:any) {
    if (!emp.branches) return 'بدون فرع'
    if (Array.isArray(emp.branches)) return emp.branches[0]?.name||'بدون فرع'
    return emp.branches.name||'بدون فرع'
  }

  async function approveRequest(req:any) {
    await supabase.from('shift_schedules').delete().eq('employee_id',req.employee_id).eq('date',req.date)
    await supabase.from('shift_schedules').insert([{employee_id:req.employee_id,shift_id:req.shift_id,date:req.date,status:'confirmed'}])
    await supabase.from('shift_requests').update({status:'approved',reviewed_at:new Date().toISOString()}).eq('id',req.id)
    refresh()
  }

  async function rejectRequest(req:any) {
    const reason=prompt('سبب الرفض:'); if(reason===null) return
    await supabase.from('shift_requests').update({status:'rejected',rejection_reason:reason,reviewed_at:new Date().toISOString()}).eq('id',req.id)
    refresh()
  }

  function printSchedule() {
    const html = `<html dir="rtl"><head><title>جدول ${MONTHS_AR[viewMonth]} ${viewYear}</title>
    <style>body{font-family:Arial;font-size:11px;margin:20px}h2{text-align:center}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px;text-align:center}
    th{background:#0A1628;color:white}.s{border-radius:3px;padding:2px 4px;font-size:10px;font-weight:bold}</style></head>
    <body><h2>🌸 Orchid Group — ${MONTHS_AR[viewMonth]} ${viewYear}</h2>
    <table><thead><tr><th style='text-align:right;min-width:120px'>الموظف</th><th style='min-width:80px'>الدوام</th>
    ${monthDays.map(d=>`<th style='min-width:28px'>${d.day}<br/><span style='font-size:8px'>${DAYS_SHORT[d.dow]}</span></th>`).join('')}</tr></thead>
    <tbody>${employees.map(emp=>`<tr><td style="text-align:right;white-space:nowrap;font-weight:bold">${emp.name}${emp.name_en ? ' '+emp.name_en : ''}</td>
    <td style='text-align:center;font-size:10px;color:#555'>${(() => {
      const allSch = monthDays.map(d => getShift(emp.id, d.date)).filter(Boolean)
      if (allSch.length === 0) return '—'
      const first = allSch[0]
      const st = first.custom_start ? first.custom_start.slice(0,5) : (first.shifts?.start_time?.slice(0,5)||'')
      const en = first.custom_end ? first.custom_end.slice(0,5) : (first.shifts?.end_time?.slice(0,5)||'')
      return st + (en ? '—' + en : '')
    })()} </td>
    ${monthDays.map(d=>{
      const s=getShift(emp.id,d.date)
      if (!s) return '<td style="color:#ddd;font-size:10px">✗</td>'
      const color = s.shifts?.color||'#C9A84C'
      return '<td style="background:'+color+'20;color:'+color+';font-weight:bold;font-size:11px">✓</td>'
    }).join('')}</tr>`).join('')}
    </tbody></table></body></html>`
    const win=window.open('','_blank'); if(win){win.document.write(html);win.document.close();win.print()}
  }

  const tabs = isEmployee ? [
    {key:'my_schedule',label:'جدولي',icon:'📅'},
    {key:'my_requests',label:'طلباتي',icon:'🔄',badge:myRequests.filter(r=>r.status==='pending').length},
  ] : isAdmin ? [
    {key:'schedule',label:'الجدول الشهري',icon:'📅'},
    {key:'working_now',label:'يعملون الآن',icon:'🟢',badge:workingNow.length},
    {key:'shifts_list',label:'الشيفتات',icon:'⏰'},
    {key:'requests',label:'طلبات التغيير',icon:'🔄',badge:requests.length},
  ] : [
    {key:'schedule',label:'جدول قسمي',icon:'📅'},
    {key:'working_now',label:'يعملون الآن',icon:'🟢',badge:workingNow.length},
    {key:'requests',label:'طلبات القسم',icon:'🔄',badge:requests.length},
  ]

  return (
    <div style={{fontFamily:'Tajawal, sans-serif',direction:'rtl',color:S.white}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option{background:#0F2040;color:#FAFAF8}
        input[type="date"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(1)}
        ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.3);border-radius:3px}
      `}</style>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:S.white,marginBottom:4}}>🕐 إدارة الشيفتات</h1>
          <p style={{fontSize:13,color:S.muted}}>الجدول الشهري وطلبات تغيير الشيفت</p>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {isEmployee ? (
            <button onClick={()=>setShowRequest(true)} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.teal}`,background:S.tealB,color:S.teal,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>🔄 طلب تغيير شيفت</button>
          ):(
            <>
              {isManager&&<button onClick={()=>setShowAddShift(true)} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.purple}`,background:S.purpleB,color:S.purple,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>⏰ شيفت جديد</button>}
              <button onClick={()=>setShowAssign(true)} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.gold}`,background:S.gold3,color:S.gold,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>📅 تعيين جدول شهري</button>
              <button onClick={printSchedule} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.blue}`,background:S.blueB,color:S.blue,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>🖨️ طباعة</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'الشيفتات',value:shifts.length,icon:'⏰',color:S.purple,bg:S.purpleB},
          {label:'الموظفون',value:employees.length,icon:'👷',color:S.blue,bg:S.blueB},
          {label:'مجدولون هذا الشهر',value:new Set(schedules.map((s:any)=>s.employee_id)).size,icon:'📅',color:S.green,bg:S.greenB},
          {label:'يعملون الآن',value:workingNow.length,icon:'🟢',color:S.teal,bg:S.tealB},
          {label:'طلبات معلقة',value:requests.length,icon:'🔄',color:S.amber,bg:S.amberB},
        ].map((s,i)=>(
          <div key={i} style={{background:s.bg,borderRadius:14,border:`1px solid ${s.color}30`,padding:'14px 16px'}}>
            <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:20,fontWeight:800,color:s.color,marginBottom:2}}>{s.value}</div>
            <div style={{fontSize:11,color:S.muted}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {tabs.map(tab=>(
          <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
            style={{padding:'9px 16px',borderRadius:10,border:`1px solid ${activeTab===tab.key?S.gold:S.border}`,background:activeTab===tab.key?S.gold3:'transparent',color:activeTab===tab.key?S.gold:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:activeTab===tab.key?700:400,display:'flex',alignItems:'center',gap:6}}>
            {tab.icon} {tab.label}
            {(tab as any).badge>0&&<span style={{background:S.amber,color:S.navy,borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:800}}>{(tab as any).badge}</span>}
          </button>
        ))}
      </div>

      {/* ══ الجدول الشهري ══ */}
      {activeTab==='schedule'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)}else setViewMonth(m=>m-1)}}
                style={{padding:'7px 14px',borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>← السابق</button>
              <span style={{fontSize:15,fontWeight:800,color:S.white}}>{MONTHS_AR[viewMonth]} {viewYear}</span>
              <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)}else setViewMonth(m=>m+1)}}
                style={{padding:'7px 14px',borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>التالي →</button>
              <button onClick={()=>{setViewMonth(now.getMonth());setViewYear(now.getFullYear())}}
                style={{padding:'7px 12px',borderRadius:10,border:`1px solid ${S.gold}`,background:S.gold3,color:S.gold,cursor:'pointer',fontSize:11,fontFamily:'Tajawal, sans-serif'}}>هذا الشهر</button>
            </div>
          </div>

          {/* فلتر الفرع */}
          {branches.length > 1 && (
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
              <button onClick={()=>setFilterBranch('all')} style={{padding:'7px 16px',borderRadius:20,border:`1px solid ${filterBranch==='all'?S.gold:S.border}`,background:filterBranch==='all'?S.gold3:'transparent',color:filterBranch==='all'?S.gold:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif',fontWeight:600}}>
                🌐 كل الفروع ({employees.length})
              </button>
              {branches.map(b=>(
                <button key={b} onClick={()=>setFilterBranch(filterBranch===b?'all':b)} style={{padding:'7px 16px',borderRadius:20,border:`1px solid ${filterBranch===b?S.blue:S.border}`,background:filterBranch===b?S.blueB:'transparent',color:filterBranch===b?S.blue:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif',fontWeight:600}}>
                  🏪 {b} ({employees.filter(e=>getBranchName(e)===b).length})
                </button>
              ))}
            </div>
          )}

          {loading?(
            <div style={{textAlign:'center',padding:60,color:S.muted}}>⏳ جاري التحميل...</div>
          ):(
            /* عرض مقسم على الفروع */
            branches.filter(b=>filterBranch==='all'||b===filterBranch).map(branch=>{
              const branchEmployees = employees.filter(e=>getBranchName(e)===branch)
              if (branchEmployees.length===0) return null
              return (
                <div key={branch} style={{marginBottom:28}}>
                  {/* عنوان الفرع */}
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px 16px',background:S.navy3,borderRadius:12,border:`1px solid ${S.border}`}}>
                    <span style={{fontSize:18}}>🏪</span>
                    <span style={{fontSize:15,fontWeight:800,color:S.white}}>{branch}</span>
                    <span style={{fontSize:12,color:S.muted,background:S.card,borderRadius:20,padding:'2px 10px'}}>{branchEmployees.length} موظف</span>
                  </div>

                  <div style={{background:S.navy2,borderRadius:16,border:`1px solid ${S.border}`,overflow:'hidden'}}>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:S.navy3}}>
                            <th style={{padding:'10px 14px',textAlign:'right',fontSize:12,color:S.muted,fontWeight:700,borderBottom:`1px solid ${S.border}`,minWidth:130}}>الموظف</th>
                            {monthDays.map(d=>{
                              const isToday = d.date===todayStr()
                              return (
                                <th key={d.day} style={{padding:'4px 2px',textAlign:'center',fontSize:10,color:isToday?S.gold:S.muted,fontWeight:700,borderBottom:`1px solid ${S.border}`,minWidth:36,background:isToday?S.gold3:'transparent'}}>
                                  <div>{d.day}</div>
                                  <div style={{fontSize:9}}>{DAYS_SHORT[d.dow]}</div>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {branchEmployees.map((emp,ei)=>(
                            <tr key={emp.id} style={{borderBottom:`1px solid ${S.border}`,background:ei%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
                              <td style={{padding:'8px 14px',background:ei%2===0?S.navy2:'#0d1b35',borderLeft:`1px solid ${S.border}`,cursor:isManager?'pointer':'default'}} title={isManager?'اضغط لتعيين الشيفت':''}>
                                <div style={{display:'flex',alignItems:'center',gap:8}} onClick={()=>{ if(isManager){ setAssignEmpId(emp.id); setShowAssign(true) } }} title={isManager ? 'اضغط لتعيين الشيفت' : ''}>
                                  <div style={{width:26,height:26,borderRadius:'50%',background:S.gold3,border:`1px solid ${S.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:S.gold,flexShrink:0}}>{emp.name?.charAt(0)}</div>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:700,color:S.white}}>{emp.name}{emp.name_en ? ' '+emp.name_en : ''}</div>
                                    <div style={{fontSize:10,color:S.muted,display:'flex',gap:6,alignItems:'center'}}>
                                      {(() => {
                                        // ابحث عن أول شيفت في الشهر
                                        const firstSch = monthDays.map(d => getShift(emp.id, d.date)).find(s => s)
                                        if (firstSch?.custom_start && firstSch?.custom_end) {
                                          return <span style={{color:'#8B5CF6'}}>{firstSch.custom_start.slice(0,5)} — {firstSch.custom_end.slice(0,5)}</span>
                                        }
                                        if (firstSch?.shifts?.start_time) {
                                          return <span style={{color:firstSch.shifts.color||S.muted}}>{firstSch.shifts.start_time.slice(0,5)} — {firstSch.shifts.end_time?.slice(0,5)} · {emp.department}</span>
                                        }
                                        return <span style={{color:S.muted}}>{emp.department}</span>
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {monthDays.map(d=>{
                                const sch = getShift(emp.id, d.date)
                                const isToday = d.date===todayStr()
                                return (
                                  <td key={d.day} style={{padding:'2px',textAlign:'center',background:isToday?'rgba(201,168,76,0.04)':'transparent'}}>
                                    {sch?(
                                      <div
                                        title={sch.custom_start ? `${sch.custom_start.slice(0,5)}—${sch.custom_end?.slice(0,5)}` : `${sch.shifts?.name||''} ${sch.shifts?.start_time?.slice(0,5)||''}—${sch.shifts?.end_time?.slice(0,5)||''}`}
                                        style={{background:sch.custom_start?S.purpleB:(sch.shifts?.color||S.green)+'25',border:`1px solid ${sch.custom_start?S.purple:(sch.shifts?.color||S.green)+'60'}`,borderRadius:4,padding:'3px 2px',fontSize:11,fontWeight:800,color:sch.custom_start?S.purple:(sch.shifts?.color||S.green),lineHeight:1,textAlign:'center'}}>
                                        ✓
                                      </div>
                                    ):(
                                      <span style={{color:'rgba(255,255,255,0.1)',fontSize:10}}>—</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ══ يعملون الآن ══ */}
      {activeTab==='working_now'&&(
        <div>
          {branches.map(branch=>{
            const bw = workingNow.filter((s:any)=>{
              const brName = Array.isArray(s.employees?.branches)?s.employees.branches[0]?.name:s.employees?.branches?.name
              return (brName||'بدون فرع')===branch
            })
            if (bw.length===0) return null
            // تجميع حسب القسم
            const depts = [...new Set(bw.map((s:any)=>normalizeDept(s.employees?.department||'غير محدد')))]
            return (
              <div key={branch} style={{marginBottom:28}}>
                {/* عنوان الفرع */}
                <div style={{fontSize:15,fontWeight:800,color:S.gold,marginBottom:14,display:'flex',alignItems:'center',gap:8,borderBottom:`1px solid ${S.border}`,paddingBottom:10}}>
                  <span>🏪</span><span>{branch}</span>
                  <span style={{fontSize:12,color:S.green,background:S.greenB,borderRadius:20,padding:'2px 10px'}}>{bw.length} موظف</span>
                </div>
                {/* تجميع حسب القسم */}
                {depts.map(dept=>{
                  const deptEmps = bw.filter((s:any)=>normalizeDept(s.employees?.department||'غير محدد')===dept)
                  return (
                    <div key={dept} style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:700,color:S.muted,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                        <span>🏷️</span><span>{dept}</span>
                        <span style={{fontSize:11,color:S.blue,background:S.blueB,borderRadius:20,padding:'1px 8px'}}>{deptEmps.length}</span>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                        {deptEmps.map((s:any)=>(
                          <div key={s.id} style={{background:S.navy2,borderRadius:14,border:`1px solid ${(s.shifts?.color||S.green)+'40'}`,padding:'12px 14px',display:'flex',gap:12,alignItems:'center'}}>
                            <div style={{position:'relative',flexShrink:0}}>
                              <div style={{width:38,height:38,borderRadius:'50%',background:S.gold3,border:`1px solid ${S.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:S.gold}}>{(s.employees?.name||'؟').charAt(0)}</div>
                              <div style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:'50%',background:S.green,border:`2px solid ${S.navy2}`}} />
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:700,color:S.white,marginBottom:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.employees?.name} {s.employees?.name_en||''}</div>
                              <div style={{fontSize:11,color:S.green}}>✅ دخل: {s.check_in_time ? new Date(s.check_in_time).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) : '—'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {workingNow.length===0&&(
            <div style={{textAlign:'center',padding:60,color:S.muted}}>
              <div style={{fontSize:48,marginBottom:12}}>🔴</div>
              <div style={{fontSize:15,fontWeight:600,color:S.white}}>لا يوجد موظفون في الشيفت حالياً</div>
            </div>
          )}
        </div>
      )}

      {/* ══ الشيفتات ══ */}
      {activeTab==='shifts_list'&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16}}>
          {shifts.map((shift:any)=>(
            <div key={shift.id} style={{background:S.navy2,borderRadius:16,border:`1px solid ${shift.color}30`,overflow:'hidden'}}>
              <div style={{height:6,background:shift.color}} />
              <div style={{padding:'16px 18px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:16,fontWeight:800,color:S.white}}>{shift.name}</div>
                  {isManager&&<button onClick={()=>setEditShift(shift)} style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${S.gold}`,background:S.gold3,color:S.gold,cursor:'pointer',fontSize:12}}>✏️</button>}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div style={{background:S.card,borderRadius:8,padding:'8px 12px'}}>
                    <div style={{fontSize:10,color:S.muted,marginBottom:2}}>🕐 البداية</div>
                    <div style={{fontSize:15,fontWeight:800,color:S.white}}>{shift.start_time?.slice(0,5)}</div>
                  </div>
                  <div style={{background:S.card,borderRadius:8,padding:'8px 12px'}}>
                    <div style={{fontSize:10,color:S.muted,marginBottom:2}}>🕕 النهاية</div>
                    <div style={{fontSize:15,fontWeight:800,color:S.white}}>{shift.end_time?.slice(0,5)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ طلبات التغيير ══ */}
      {activeTab==='requests'&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {requests.length===0?(
            <div style={{textAlign:'center',padding:60,color:S.muted}}>
              <div style={{fontSize:48,marginBottom:12}}>🔄</div>
              <div style={{fontSize:15,fontWeight:600,color:S.white}}>لا توجد طلبات معلقة</div>
            </div>
          ):requests.map((req:any)=>(
            <div key={req.id} style={{background:S.navy2,borderRadius:14,border:`1px solid ${S.border}`,padding:'16px 20px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:S.amberB,border:`1px solid ${S.amber}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:S.amber}}>{req.employees?.name?.charAt(0)||'؟'}</div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:S.white,marginBottom:2}}>{req.employees?.name}</div>
                    <div style={{fontSize:12,color:S.muted,marginBottom:6}}>{req.employees?.department}</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      <span style={{background:(req.shifts?.color||S.gold)+'20',color:req.shifts?.color||S.gold,borderRadius:20,padding:'3px 10px',fontSize:12,fontWeight:700}}>{req.shifts?.name}</span>
                      <span style={{fontSize:12,color:S.muted}}>📅 {new Date(req.date+'T00:00:00').toLocaleDateString('ar-SA',{weekday:'long',month:'long',day:'numeric'})}</span>
                    </div>
                    {req.reason&&<div style={{fontSize:12,color:S.muted,marginTop:6,background:S.card,borderRadius:8,padding:'5px 10px'}}>💬 {req.reason}</div>}
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>approveRequest(req)} style={{padding:'8px 16px',borderRadius:10,border:`1px solid ${S.green}`,background:S.greenB,color:S.green,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>✅ موافقة</button>
                  <button onClick={()=>rejectRequest(req)} style={{padding:'8px 16px',borderRadius:10,border:`1px solid ${S.red}`,background:S.redB,color:S.red,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>❌ رفض</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ جدولي (للموظف) ══ */}
      {activeTab==='my_schedule'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontSize:14,fontWeight:700,color:S.white}}>
  {MONTHS_AR[viewMonth]} {viewYear} —{' '}
  {mySchedules.filter((s:any)=>s.shift_id||s.custom_start).length} يوم عمل{' '}
  {mySchedules.filter((s:any)=>!s.shift_id&&!s.custom_start).length > 0 && `· ${mySchedules.filter((s:any)=>!s.shift_id&&!s.custom_start).length} إجازة`}
</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)}else setViewMonth(m=>m-1)}} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif'}}>← السابق</button>
              <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)}else setViewMonth(m=>m+1)}} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif'}}>التالي →</button>
            </div>
          </div>
          {loading?(
            <div style={{textAlign:'center',padding:40,color:S.muted}}>⏳ جاري التحميل...</div>
          ):mySchedules.length===0?(
            <div style={{textAlign:'center',padding:60,background:S.navy2,borderRadius:16,border:`1px solid ${S.border}`}}>
              <div style={{fontSize:48,marginBottom:12}}>📅</div>
              <div style={{fontSize:15,fontWeight:600,color:S.white,marginBottom:6}}>لا يوجد جدول لهذا الشهر</div>
              <div style={{fontSize:13,color:S.muted}}>تواصل مع مديرك لتعيين شيفتك</div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {mySchedules.map((sch:any)=>{
                const d=new Date(String(sch.date)+'T00:00:00')
                const isToday=String(sch.date).slice(0,10)===todayStr()
                const isLeave = !sch.shift_id && !sch.custom_start
                const isCustom = sch.custom_start && sch.custom_end
                const shiftName = isLeave ? '🏖️ إجازة' : isCustom ? '🕐 دوام مخصص' : (sch.shifts?.name || '—')
                const timeFrom = isCustom ? sch.custom_start?.slice(0,5) : sch.shifts?.start_time?.slice(0,5)
                const timeTo = isCustom ? sch.custom_end?.slice(0,5) : sch.shifts?.end_time?.slice(0,5)
                const barColor = isLeave ? S.amber : isCustom ? S.purple : (sch.shifts?.color || S.gold)
                const borderColor = isToday ? S.gold : barColor + '40'
                const bgColor = isToday ? S.gold3 : isLeave ? S.amberB : S.navy2
                return (
                  <div key={sch.id} style={{background:bgColor,borderRadius:12,border:`1px solid ${borderColor}`,padding:'12px 16px',display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:44,textAlign:'center',flexShrink:0}}>
                      <div style={{fontSize:18,fontWeight:800,color:isToday?S.gold:S.white}}>{d.getDate()}</div>
                      <div style={{fontSize:10,color:S.muted}}>{DAYS_SHORT[d.getDay()]}</div>
                    </div>
                    <div style={{width:6,height:40,borderRadius:3,background:barColor,flexShrink:0}} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:isLeave?S.amber:S.white,marginBottom:2}}>{shiftName}</div>
                      {!isLeave && timeFrom && <div style={{fontSize:12,color:isCustom?S.purple:S.muted,fontWeight:isCustom?700:400}}>⏰ {timeFrom} — {timeTo}</div>}
                      {isLeave && <div style={{fontSize:11,color:S.amber}}>يوم راحة</div>}
                    </div>
                    {isToday&&<span style={{background:S.greenB,color:S.green,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700}}>اليوم ✅</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ طلباتي (للموظف) ══ */}
      {activeTab==='my_requests'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontSize:14,fontWeight:700,color:S.white}}>طلبات تغيير الشيفت</span>
            <button onClick={()=>setShowRequest(true)} style={{padding:'8px 16px',borderRadius:10,border:`1px solid ${S.teal}`,background:S.tealB,color:S.teal,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>➕ طلب جديد</button>
          </div>
          {myRequests.length===0?(
            <div style={{textAlign:'center',padding:60,color:S.muted}}>
              <div style={{fontSize:48,marginBottom:12}}>🔄</div>
              <div style={{fontSize:15,fontWeight:600,color:S.white}}>لا توجد طلبات سابقة</div>
            </div>
          ):myRequests.map((req:any)=>{
            const ST:any={pending:{label:'⏳ قيد المراجعة',color:S.amber,bg:S.amberB},approved:{label:'✅ موافق عليه',color:S.green,bg:S.greenB},rejected:{label:'❌ مرفوض',color:S.red,bg:S.redB}}
            const st=ST[req.status]||ST.pending
            return (
              <div key={req.id} style={{background:S.navy2,borderRadius:12,border:`1px solid ${S.border}`,padding:'12px 16px',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <div style={{width:6,height:36,borderRadius:3,background:req.shifts?.color||S.gold,flexShrink:0}} />
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:S.white,marginBottom:2}}>{req.shifts?.name}</div>
                      <div style={{fontSize:11,color:S.muted}}>📅 {new Date(String(req.date)+'T00:00:00').toLocaleDateString('ar-SA',{weekday:'long',month:'short',day:'numeric'})}</div>
                    </div>
                  </div>
                  <span style={{background:st.bg,color:st.color,borderRadius:20,padding:'3px 12px',fontSize:12,fontWeight:700}}>{st.label}</span>
                </div>
                {req.rejection_reason&&<div style={{marginTop:8,background:S.redB,borderRadius:8,padding:'6px 12px',fontSize:12,color:S.red}}>سبب الرفض: {req.rejection_reason}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {(showAddShift||editShift)&&<ShiftModal shift={editShift} onClose={()=>{setShowAddShift(false);setEditShift(null)}} onSaved={()=>{setShowAddShift(false);setEditShift(null);refresh()}} />}
      {showAssign&&<AssignModal employees={employees} shifts={shifts} initialEmpId={assignEmpId} initialMonth={viewMonth} initialYear={viewYear} onClose={()=>{setShowAssign(false);setAssignEmpId(null)}} onSaved={()=>{setShowAssign(false);setAssignEmpId(null);refresh()}} />}
      {showRequest&&employee?.id&&<RequestModal shifts={shifts} employeeId={employee.id} onClose={()=>setShowRequest(false)} onSaved={()=>{setShowRequest(false);refresh()}} />}
    </div>
  )
}
