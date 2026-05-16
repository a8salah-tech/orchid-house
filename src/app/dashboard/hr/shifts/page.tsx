'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
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

const DAYS_SHORT = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب']
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const SHIFT_COLORS = ['#C9A84C','#22C55E','#3B82F6','#8B5CF6','#EF4444','#F59E0B','#14B8A6','#EC4899']

// تاريخ محلي بدون UTC offset
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayStr(): string { return localDate(new Date()) }

interface Shift { id: string; name: string; start_time: string; end_time: string; department: string; color: string; is_active: boolean }
interface Employee { id: string; name: string; role: string; department: string; branch_id?: string; branches?: { name: string } | any }
interface Schedule {
  id: string; employee_id: string; shift_id: string; date: string; status: string
  employees?: { name: string; department: string; branches?: { name: string } }
  shifts?: { name: string; start_time: string; end_time: string; color: string }
}
interface ShiftRequest {
  id: string; employee_id: string; shift_id: string; date: string; reason: string; status: string; rejection_reason?: string
  employees?: { name: string; department: string }
  shifts?: { name: string; start_time: string; end_time: string; color: string }
}

// ══ Shift Modal ══
function ShiftModal({ shift, onClose, onSaved }: { shift?: Shift|null; onClose:()=>void; onSaved:()=>void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name:shift?.name||'', start_time:shift?.start_time||'08:00', end_time:shift?.end_time||'16:00', color:shift?.color||'#C9A84C', is_active:shift?.is_active!==false })

  async function save() {
    if (!form.name) return
    setSaving(true)
    const {error} = shift ? await supabase.from('shifts').update(form).eq('id',shift.id) : await supabase.from('shifts').insert([form])
    setSaving(false)
    if (error) { alert('خطأ: '+error.message); return }
    onSaved()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:S.navy2,borderRadius:20,border:`1px solid ${S.border}`,width:'100%',maxWidth:420,padding:28}}>
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
function AssignMonthModal({ employees, shifts, onClose, onSaved }: { employees:Employee[]; shifts:Shift[]; onClose:()=>void; onSaved:()=>void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const now = new Date()
  const [form, setForm] = useState({ employee_id:'', shift_id:'', year:now.getFullYear(), month:now.getMonth(), days:[0,1,2,3,4,5,6] as number[] })

  const daysInMonth = new Date(form.year, form.month+1, 0).getDate()
  const previewDays = useMemo(() => Array.from({length:daysInMonth},(_,i)=>{
    const d = new Date(form.year, form.month, i+1)
    return {date:localDate(d), dayOfWeek:d.getDay(), day:i+1}
  }).filter(d=>form.days.includes(d.dayOfWeek)), [form.year, form.month, form.days, daysInMonth])

  function toggleDay(day:number) {
    setForm(p=>({...p, days:p.days.includes(day)?p.days.filter(d=>d!==day):[...p.days,day].sort()}))
  }

  async function save() {
    if (!form.employee_id || !form.shift_id || previewDays.length===0) { alert('يرجى إكمال البيانات'); return }
    setSaving(true)
    setProgress('جاري حذف الجدول القديم...')
    const monthStart = `${form.year}-${String(form.month+1).padStart(2,'0')}-01`
    const monthEnd = `${form.year}-${String(form.month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`
    await supabase.from('shift_schedules').delete().eq('employee_id',form.employee_id).gte('date',monthStart).lte('date',monthEnd)

    setProgress(`جاري إضافة ${previewDays.length} يوم...`)
    const rows = previewDays.map(d=>({ employee_id:form.employee_id, shift_id:form.shift_id, date:d.date, status:'confirmed' }))
    for (let i=0; i<rows.length; i+=50) {
      const {error} = await supabase.from('shift_schedules').insert(rows.slice(i,i+50))
      if (error) { alert('خطأ: '+error.message); setSaving(false); return }
    }

    const shift = shifts.find(s=>s.id===form.shift_id)
    await supabase.from('employee_requests').insert([{
      employee_id:form.employee_id, request_type:'shift_assigned',
      title:`جدول ${MONTHS_AR[form.month]} ${form.year}`,
      description:`تم تعيينك في ${shift?.name} لـ ${previewDays.length} يوم خلال شهر ${MONTHS_AR[form.month]}`,
      status:'approved',
    }])
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,overflowY:'auto'}}>
      <div style={{background:S.navy2,borderRadius:20,border:`1px solid ${S.border}`,width:'100%',maxWidth:540,padding:28,margin:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div>
            <h3 style={{color:S.white,fontSize:16,fontWeight:800,marginBottom:4}}>📅 تعيين جدول شهري</h3>
            <p style={{fontSize:12,color:S.muted}}>حدد الموظف والشيفت والأيام</p>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:S.muted,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>الموظف *</label>
            <select style={inp} value={form.employee_id} onChange={e=>setForm(p=>({...p,employee_id:e.target.value}))}>
              <option value="">اختر الموظف</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name} — {e.department}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:8}}>الشيفت *</label>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {shifts.map(s=>(
                <label key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,border:`1px solid ${form.shift_id===s.id?s.color:S.border}`,background:form.shift_id===s.id?s.color+'15':'transparent',cursor:'pointer'}}>
                  <input type="radio" name="shift" checked={form.shift_id===s.id} onChange={()=>setForm(p=>({...p,shift_id:s.id}))} style={{accentColor:s.color}} />
                  <div style={{width:8,height:30,borderRadius:4,background:s.color}} />
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:S.white}}>{s.name}</div>
                    <div style={{fontSize:11,color:S.muted}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>الشهر</label>
              <select style={inp} value={form.month} onChange={e=>setForm(p=>({...p,month:parseInt(e.target.value)}))}>
                {MONTHS_AR.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>السنة</label>
              <select style={inp} value={form.year} onChange={e=>setForm(p=>({...p,year:parseInt(e.target.value)}))}>
                {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:8}}>أيام العمل</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {DAYS_SHORT.map((d,i)=>(
                <button key={i} onClick={()=>toggleDay(i)}
                  style={{width:44,height:44,borderRadius:10,border:`1px solid ${form.days.includes(i)?S.gold:S.border}`,background:form.days.includes(i)?S.gold3:'transparent',color:form.days.includes(i)?S.gold:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                  {d}
                </button>
              ))}
            </div>
            <div style={{fontSize:11,color:S.muted,marginTop:6}}>{form.days.map(d=>DAYS_AR[d]).join('، ')}</div>
          </div>
          {previewDays.length>0 && (
            <div style={{background:S.greenB,border:`1px solid rgba(34,197,94,0.3)`,borderRadius:12,padding:'12px 16px'}}>
              <div style={{fontSize:13,fontWeight:700,color:S.green,marginBottom:6}}>📊 {previewDays.length} يوم في {MONTHS_AR[form.month]}</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {previewDays.slice(0,15).map(d=>(
                  <span key={d.date} style={{background:S.greenB,color:S.green,borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>{d.day}</span>
                ))}
                {previewDays.length>15&&<span style={{color:S.muted,fontSize:11}}>+{previewDays.length-15}</span>}
              </div>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end',alignItems:'center'}}>
          {saving&&<span style={{fontSize:12,color:S.muted}}>{progress}</span>}
          <button onClick={onClose} style={{padding:'10px 20px',borderRadius:10,border:`1px solid ${S.muted}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{padding:'10px 24px',borderRadius:10,border:`1px solid ${S.green}`,background:S.greenB,color:S.green,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
            {saving?`⏳ ${progress}`:'✅ تعيين الجدول'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Request Shift Modal (للموظف) ══
function RequestShiftModal({ shifts, employeeId, onClose, onSaved }: { shifts:Shift[]; employeeId:string; onClose:()=>void; onSaved:()=>void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({shift_id:'', date:todayStr(), reason:''})

  async function save() {
    if (!form.shift_id || !form.date) { alert('يرجى اختيار الشيفت والتاريخ'); return }
    setSaving(true)
    const {error} = await supabase.from('shift_requests').insert([{employee_id:employeeId,shift_id:form.shift_id,date:form.date,reason:form.reason,status:'pending'}])
    setSaving(false)
    if (error) { alert('خطأ: '+error.message); return }
    onSaved()
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
            <select style={inp} value={form.shift_id} onChange={e=>setForm(p=>({...p,shift_id:e.target.value}))}>
              <option value="">اختر الشيفت</option>
              {shifts.map(s=><option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0,5)}—{s.end_time.slice(0,5)})</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>التاريخ *</label>
            <input style={{...inp,direction:'ltr',textAlign:'left'}} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>سبب الطلب</label>
            <textarea style={{...inp,minHeight:70,resize:'vertical'} as React.CSSProperties} value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} placeholder="اشرح سبب طلب التغيير..." />
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

// ══ Print ══
function printSchedule(schedules:Schedule[], employees:Employee[], month:number, year:number) {
  const daysInMonth = new Date(year,month+1,0).getDate()
  const getShift = (empId:string,day:number) => {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return schedules.find(s=>s.employee_id===empId&&s.date?.slice(0,10)===ds)
  }
  const html = `<html dir="rtl"><head><title>جدول ${MONTHS_AR[month]} ${year}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px}h2{text-align:center}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px;text-align:center}
    th{background:#0A1628;color:white}.s{border-radius:4px;padding:2px 4px;font-size:10px;font-weight:bold}</style></head>
    <body><h2>🌸 Orchid House — ${MONTHS_AR[month]} ${year}</h2>
    <table><thead><tr><th>الموظف</th><th>القسم</th>
    ${Array.from({length:daysInMonth},(_,i)=>`<th>${i+1}<br/><small>${DAYS_SHORT[new Date(year,month,i+1).getDay()]}</small></th>`).join('')}
    </tr></thead><tbody>
    ${employees.map(emp=>`<tr><td style="text-align:right">${emp.name}</td><td>${emp.department||''}</td>
    ${Array.from({length:daysInMonth},(_,i)=>{const s=getShift(emp.id,i+1);return s?`<td><span class="s" style="background:${s.shifts?.color||'#C9A84C'}30;color:${s.shifts?.color||'#C9A84C'}">${s.shifts?.name||''}</span></td>`:'<td>—</td>'}).join('')}</tr>`).join('')}
    </tbody></table><p style="text-align:center;font-size:10px;color:#666;margin-top:16px">🌸 Orchid House — ${new Date().toLocaleDateString('ar-SA')}</p></body></html>`
  const win = window.open('','_blank')
  if (win) { win.document.write(html); win.document.close(); win.print() }
}

// ══ الصفحة الرئيسية ══
export default function ShiftsPage() {
  const supabase = createClient()
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  const isManager = isAdmin || ['branch_manager','kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(employee?.role||'')
  const isEmployee = !isManager

  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [requests, setRequests] = useState<ShiftRequest[]>([])
  const [mySchedules, setMySchedules] = useState<Schedule[]>([])
  const [myRequests, setMyRequests] = useState<ShiftRequest[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [activeTab, setActiveTab] = useState('schedule')
  const [filterDept, setFilterDept] = useState('الكل')
  const [filterBranch, setFilterBranch] = useState('الكل')
  const [showAddShift, setShowAddShift] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [editShift, setEditShift] = useState<Shift|null>(null)

  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()

  const monthDays = useMemo(()=>Array.from({length:daysInMonth},(_,i)=>{
    const d = new Date(viewYear,viewMonth,i+1)
    return {day:i+1, date:localDate(d), dayOfWeek:d.getDay()}
  }), [viewMonth, viewYear, daysInMonth])

  const fetchAll = useCallback(async()=>{
    setLoading(true)
    const monthStart = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-01`
    const monthEnd = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`

    const [sh,emp,sch,req] = await Promise.all([
      supabase.from('shifts').select('*').eq('is_active',true).order('start_time'),
      supabase.from('employees').select('id,name,role,department,branch_id,branches(name)').eq('is_active',true).order('name'),
      supabase.from('shift_schedules').select('*,employees(name,department,branches(name)),shifts(name,start_time,end_time,color)').gte('date',monthStart).lte('date',monthEnd).order('date'),
      supabase.from('shift_requests').select('*,employees(name,department),shifts(name,start_time,end_time,color)').eq('status','pending').order('created_at',{ascending:false}),
    ])

    setShifts(sh.data||[])
    setEmployees(emp.data||[])
    setSchedules(sch.data||[])
   console.log('SCHEDULES COUNT:', sch.data?.length, 'MONTH:', viewMonth+1, 'YEAR:', viewYear)
    if (isAdmin) setRequests(req.data||[])
    else if (isManager) setRequests((req.data||[]).filter((r:ShiftRequest)=>r.employees?.department===employee?.department))

    if (employee?.id) {
      setMySchedules((sch.data||[]).filter((s:Schedule)=>s.employee_id===employee.id))
      const {data:myR} = await supabase.from('shift_requests').select('*,shifts(name,start_time,end_time,color)').eq('employee_id',employee.id).order('created_at',{ascending:false}).limit(20)
      setMyRequests(myR||[])
    }
    setLoading(false)
  }, [viewMonth, viewYear])

  useEffect(()=>{ setActiveTab(isEmployee?'my_schedule':'schedule') },[isEmployee])
  useEffect(()=>{ fetchAll() },[fetchAll])

  function getShift(empId:string, dateStr:string) {
    return schedules.find(s=>s.employee_id===empId && s.date?.slice(0,10)===dateStr)
  }

  const workingNow = useMemo(()=>{
    const nowDate = todayStr()
    const nowMins = new Date().getHours()*60+new Date().getMinutes()
    return schedules.filter(s=>{
      if (s.date?.slice(0,10)!==nowDate) return false
      if (!s.shifts?.start_time||!s.shifts?.end_time) return false
      const [sh,sm]=s.shifts.start_time.split(':').map(Number)
      const [eh,em]=s.shifts.end_time.split(':').map(Number)
      let end=eh*60+em; if(end<sh*60+sm)end+=24*60
      return nowMins>=sh*60+sm&&nowMins<=end
    })
  },[schedules])

  const branches = useMemo(()=>{
    const b = new Set(employees.map(e=>e.branches?.name||'بدون فرع'))
    return ['الكل',...b]
  },[employees])

  const departments = useMemo(()=>{
    const d = new Set(employees.map(e=>e.department||'—'))
    return ['الكل',...d]
  },[employees])

  const filteredEmployees = useMemo(()=>{
    let emps = employees
    if (!isAdmin&&isManager&&employee?.department) emps=emps.filter(e=>e.department===employee.department)
    if (filterDept!=='الكل') emps=emps.filter(e=>e.department===filterDept)
    if (filterBranch!=='الكل') emps=emps.filter(e=>(e.branches?.name||'بدون فرع')===filterBranch)
    return emps
  },[employees,filterDept,filterBranch,isAdmin,isManager,employee?.department])

  async function approveRequest(req:ShiftRequest) {
    await supabase.from('shift_schedules').delete().eq('employee_id',req.employee_id).eq('date',req.date)
    await supabase.from('shift_schedules').insert([{employee_id:req.employee_id,shift_id:req.shift_id,date:req.date,status:'confirmed'}])
    await supabase.from('shift_requests').update({status:'approved',reviewed_at:new Date().toISOString()}).eq('id',req.id)
    fetchAll()
  }
  async function rejectRequest(req:ShiftRequest) {
    const reason=prompt('سبب الرفض:'); if(reason===null)return
    await supabase.from('shift_requests').update({status:'rejected',rejection_reason:reason,reviewed_at:new Date().toISOString()}).eq('id',req.id)
    fetchAll()
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
            <button onClick={()=>setShowRequest(true)} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.teal}`,background:S.tealB,color:S.teal,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
              🔄 طلب تغيير شيفت
            </button>
          ):(
            <>
              {isAdmin&&<button onClick={()=>setShowAddShift(true)} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.purple}`,background:S.purpleB,color:S.purple,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>⏰ شيفت جديد</button>}
              <button onClick={()=>setShowAssign(true)} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.gold}`,background:S.gold3,color:S.gold,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>📅 تعيين جدول شهري</button>
              <button onClick={()=>printSchedule(schedules,filteredEmployees,viewMonth,viewYear)} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.blue}`,background:S.blueB,color:S.blue,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>🖨️ طباعة</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'الشيفتات',value:shifts.length,icon:'⏰',color:S.purple,bg:S.purpleB},
          {label:'الموظفون',value:employees.length,icon:'👷',color:S.blue,bg:S.blueB},
          {label:'مجدولون هذا الشهر',value:new Set(schedules.map(s=>s.employee_id)).size,icon:'📅',color:S.green,bg:S.greenB},
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
              <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)}else setViewMonth(m=>m-1)}} style={{padding:'7px 14px',borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>← السابق</button>
              <span style={{fontSize:15,fontWeight:800,color:S.white}}>{MONTHS_AR[viewMonth]} {viewYear}</span>
              <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)}else setViewMonth(m=>m+1)}} style={{padding:'7px 14px',borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>التالي →</button>
              <button onClick={()=>{setViewMonth(now.getMonth());setViewYear(now.getFullYear())}} style={{padding:'7px 12px',borderRadius:10,border:`1px solid ${S.gold}`,background:S.gold3,color:S.gold,cursor:'pointer',fontSize:11,fontFamily:'Tajawal, sans-serif'}}>هذا الشهر</button>
            </div>
            <div style={{display:'flex',gap:8}}>
              <select style={{...inp,width:'auto',minWidth:120}} value={filterBranch} onChange={e=>setFilterBranch(e.target.value)}>
                {branches.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
              <select style={{...inp,width:'auto',minWidth:120}} value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
                {departments.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {loading?(
            <div style={{textAlign:'center',padding:60,color:S.muted}}>⏳ جاري التحميل...</div>
          ):(
            <div style={{background:S.navy2,borderRadius:16,border:`1px solid ${S.border}`,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
                  <thead>
                    <tr style={{background:S.navy3}}>
                      <th style={{padding:'10px 16px',textAlign:'right',fontSize:12,color:S.muted,fontWeight:700,borderBottom:`1px solid ${S.border}`,position:'sticky',right:0,background:S.navy3,minWidth:130,zIndex:2}}>الموظف</th>
                      {monthDays.map(d=>{
                        const isToday=d.date===todayStr()
                        return <th key={d.day} style={{padding:'5px 2px',textAlign:'center',fontSize:10,color:isToday?S.gold:S.muted,fontWeight:700,borderBottom:`1px solid ${S.border}`,minWidth:38,background:isToday?S.gold3:'transparent'}}>
                          <div>{d.day}</div><div style={{fontSize:9}}>{DAYS_SHORT[d.dayOfWeek]}</div>
                        </th>
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length===0?(
                      <tr><td colSpan={daysInMonth+1} style={{textAlign:'center',padding:40,color:S.muted}}>لا يوجد موظفون</td></tr>
                    ):filteredEmployees.map((emp,ei)=>(
                      <tr key={emp.id} style={{borderBottom:`1px solid ${S.border}`,background:ei%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
                        <td style={{padding:'8px 16px',position:'sticky',right:0,background:ei%2===0?S.navy2:'#0d1b35',borderLeft:`1px solid ${S.border}`,zIndex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:26,height:26,borderRadius:'50%',background:S.gold3,border:`1px solid ${S.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:S.gold,flexShrink:0}}>{emp.name.charAt(0)}</div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:S.white}}>{emp.name}</div>
                              <div style={{fontSize:10,color:S.muted}}>{emp.department}</div>
                            </div>
                          </div>
                        </td>
                        {monthDays.map(d=>{
                          const sch=getShift(emp.id,d.date)
                          const isToday=d.date===todayStr()
                          return <td key={d.day} style={{padding:'3px',textAlign:'center',background:isToday?'rgba(201,168,76,0.03)':'transparent'}}>
                            {sch?(
                              <div title={`${sch.shifts?.name} ${sch.shifts?.start_time?.slice(0,5)}—${sch.shifts?.end_time?.slice(0,5)}`}
                                style={{background:(sch.shifts?.color||S.gold)+'25',border:`1px solid ${(sch.shifts?.color||S.gold)}50`,borderRadius:4,padding:'2px 1px',fontSize:9,fontWeight:700,color:sch.shifts?.color||S.gold,cursor:'help'}}>
                                {sch.shifts?.name?.slice(0,3)||'—'}
                              </div>
                            ):<span style={{color:S.border,fontSize:10}}>—</span>}
                          </td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ يعملون الآن ══ */}
      {activeTab==='working_now'&&(
        <div>
          {branches.filter(b=>b!=='الكل').map(branch=>{
            const bw=workingNow.filter(s=>(s.employees?.branches?.name||'بدون فرع')===branch)
            if(bw.length===0)return null
            return (
              <div key={branch} style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:800,color:S.white,marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
                  <span>🏪</span><span>{branch}</span>
                  <span style={{fontSize:12,color:S.green,background:S.greenB,borderRadius:20,padding:'2px 10px'}}>{bw.length} موظف</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                  {bw.map(s=>(
                    <div key={s.id} style={{background:S.navy2,borderRadius:14,border:`1px solid ${(s.shifts?.color||S.green)+'40'}`,padding:'14px 16px',display:'flex',gap:12,alignItems:'center'}}>
                      <div style={{position:'relative',flexShrink:0}}>
                        <div style={{width:40,height:40,borderRadius:'50%',background:S.gold3,border:`1px solid ${S.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:S.gold}}>{s.employees?.name?.charAt(0)||'؟'}</div>
                        <div style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:'50%',background:S.green,border:`2px solid ${S.navy2}`}} />
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:S.white,marginBottom:2}}>{s.employees?.name}</div>
                        <div style={{fontSize:11,color:S.muted,marginBottom:4}}>{s.employees?.department}</div>
                        <span style={{background:(s.shifts?.color||S.gold)+'20',color:s.shifts?.color||S.gold,borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:700}}>
                          {s.shifts?.name} • {s.shifts?.start_time?.slice(0,5)}—{s.shifts?.end_time?.slice(0,5)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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
          {shifts.map(shift=>{
            const [sh,sm]=shift.start_time.split(':').map(Number)
            const [eh,em]=shift.end_time.split(':').map(Number)
            let mins=(eh*60+em)-(sh*60+sm);if(mins<0)mins+=24*60
            return (
              <div key={shift.id} style={{background:S.navy2,borderRadius:16,border:`1px solid ${shift.color}30`,overflow:'hidden'}}>
                <div style={{height:6,background:shift.color}} />
                <div style={{padding:'16px 18px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                    <div style={{fontSize:16,fontWeight:800,color:S.white}}>{shift.name}</div>
                    {isAdmin&&<button onClick={()=>setEditShift(shift)} style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${S.gold}`,background:S.gold3,color:S.gold,cursor:'pointer',fontSize:12}}>✏️</button>}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div style={{background:S.card,borderRadius:8,padding:'8px 12px'}}>
                      <div style={{fontSize:10,color:S.muted,marginBottom:2}}>🕐 البداية</div>
                      <div style={{fontSize:15,fontWeight:800,color:S.white}}>{shift.start_time.slice(0,5)}</div>
                    </div>
                    <div style={{background:S.card,borderRadius:8,padding:'8px 12px'}}>
                      <div style={{fontSize:10,color:S.muted,marginBottom:2}}>🕕 النهاية</div>
                      <div style={{fontSize:15,fontWeight:800,color:S.white}}>{shift.end_time.slice(0,5)}</div>
                    </div>
                  </div>
                  <div style={{marginTop:10,fontSize:12,color:S.muted}}>⏱️ {Math.floor(mins/60)} ساعة</div>
                </div>
              </div>
            )
          })}
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
          ):requests.map(req=>(
            <div key={req.id} style={{background:S.navy2,borderRadius:14,border:`1px solid ${S.border}`,padding:'16px 20px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:S.amberB,border:`1px solid ${S.amber}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{req.employees?.name?.charAt(0)||'؟'}</div>
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
            <span style={{fontSize:14,fontWeight:700,color:S.white}}>{MONTHS_AR[viewMonth]} {viewYear} — {mySchedules.length} شيفت</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)}else setViewMonth(m=>m-1)}} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif'}}>← السابق</button>
              <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)}else setViewMonth(m=>m+1)}} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif'}}>التالي →</button>
            </div>
          </div>
          {mySchedules.length===0?(
            <div style={{textAlign:'center',padding:60,background:S.navy2,borderRadius:16,border:`1px solid ${S.border}`}}>
              <div style={{fontSize:48,marginBottom:12}}>📅</div>
              <div style={{fontSize:15,fontWeight:600,color:S.white,marginBottom:6}}>لا يوجد جدول لهذا الشهر</div>
              <div style={{fontSize:13,color:S.muted}}>تواصل مع مديرك لتعيين شيفتك</div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {mySchedules.map(sch=>{
                const d=new Date(sch.date+'T00:00:00')
                const isToday=sch.date?.slice(0,10)===todayStr()
                return (
                  <div key={sch.id} style={{background:isToday?S.gold3:S.navy2,borderRadius:12,border:`1px solid ${isToday?S.gold:(sch.shifts?.color||S.gold)+'30'}`,padding:'12px 16px',display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:44,textAlign:'center',flexShrink:0}}>
                      <div style={{fontSize:18,fontWeight:800,color:isToday?S.gold:S.white}}>{d.getDate()}</div>
                      <div style={{fontSize:10,color:S.muted}}>{DAYS_SHORT[d.getDay()]}</div>
                    </div>
                    <div style={{width:6,height:40,borderRadius:3,background:sch.shifts?.color||S.gold,flexShrink:0}} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:S.white,marginBottom:2}}>{sch.shifts?.name}</div>
                      <div style={{fontSize:12,color:S.muted}}>{sch.shifts?.start_time?.slice(0,5)} — {sch.shifts?.end_time?.slice(0,5)}</div>
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
          ):myRequests.map(req=>{
            const ST:Record<string,{label:string;color:string;bg:string}>={pending:{label:'⏳ قيد المراجعة',color:S.amber,bg:S.amberB},approved:{label:'✅ موافق عليه',color:S.green,bg:S.greenB},rejected:{label:'❌ مرفوض',color:S.red,bg:S.redB}}
            const st=ST[req.status]||ST.pending
            return (
              <div key={req.id} style={{background:S.navy2,borderRadius:12,border:`1px solid ${S.border}`,padding:'12px 16px',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <div style={{width:6,height:36,borderRadius:3,background:req.shifts?.color||S.gold,flexShrink:0}} />
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:S.white,marginBottom:2}}>{req.shifts?.name}</div>
                      <div style={{fontSize:11,color:S.muted}}>📅 {new Date(req.date+'T00:00:00').toLocaleDateString('ar-SA',{weekday:'long',month:'short',day:'numeric'})}</div>
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
      {(showAddShift||editShift)&&<ShiftModal shift={editShift} onClose={()=>{setShowAddShift(false);setEditShift(null)}} onSaved={()=>{setShowAddShift(false);setEditShift(null);fetchAll()}} />}
      {showAssign&&<AssignMonthModal employees={employees} shifts={shifts} onClose={()=>setShowAssign(false)} onSaved={()=>{setShowAssign(false);fetchAll()}} />}
      {showRequest&&employee?.id&&<RequestShiftModal shifts={shifts} employeeId={employee.id} onClose={()=>setShowRequest(false)} onSaved={()=>{setShowRequest(false);fetchAll()}} />}
    </div>
  )
}
