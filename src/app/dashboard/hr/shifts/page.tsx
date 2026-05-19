'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'

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
    onSaved()
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
function AssignModal({ employees, shifts, onClose, onSaved }: { employees: any[]; shifts: any[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const now = new Date()
  const [empId, setEmpId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [days, setDays] = useState([0,1,2,3,4,5,6])
  const [monthsCount, setMonthsCount] = useState(1)

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const previewDays = useMemo(() => Array.from({length:daysInMonth},(_,i)=>{
    const d = new Date(year,month,i+1)
    return {date:ld(d), dow:d.getDay(), day:i+1}
  }).filter(d=>days.includes(d.dow)), [year,month,days,daysInMonth])

  async function save() {
    if (!empId||!shiftId||previewDays.length===0) { alert('يرجى إكمال البيانات'); return }
    setSaving(true)
    const sh = shifts.find(s=>s.id===shiftId)
    let totalDays = 0

    for (let m = 0; m < monthsCount; m++) {
      const targetMonth = (month + m) % 12
      const targetYear = year + Math.floor((month + m) / 12)
      const daysInTargetMonth = new Date(targetYear, targetMonth+1, 0).getDate()
      const targetDays = Array.from({length:daysInTargetMonth},(_,i)=>{
        const d = new Date(targetYear,targetMonth,i+1)
        return {date:ld(d), dow:d.getDay()}
      }).filter(d=>days.includes(d.dow))

      const ms = `${targetYear}-${String(targetMonth+1).padStart(2,'0')}-01`
      const me = `${targetYear}-${String(targetMonth+1).padStart(2,'0')}-${String(daysInTargetMonth).padStart(2,'0')}`
      setProgress(`حذف جدول ${MONTHS_AR[targetMonth]} ${targetYear}...`)
      await supabase.from('shift_schedules').delete().eq('employee_id',empId).gte('date',ms).lte('date',me)
      setProgress(`إضافة أيام ${MONTHS_AR[targetMonth]} ${targetYear}...`)
      const rows = targetDays.map(d=>({employee_id:empId,shift_id:shiftId,date:d.date,status:'confirmed'}))
      for (let i=0;i<rows.length;i+=50) {
        const {error} = await supabase.from('shift_schedules').insert(rows.slice(i,i+50))
        if (error) { alert('خطأ: '+error.message); setSaving(false); return }
      }
      totalDays += targetDays.length
    }

    const endMonth = (month + monthsCount - 1) % 12
    const endYear = year + Math.floor((month + monthsCount - 1) / 12)
    await supabase.from('employee_requests').insert([{
      employee_id:empId, request_type:'shift_assigned',
      title:`جدول ${MONTHS_AR[month]} ${year}${monthsCount > 1 ? ' — ' + MONTHS_AR[endMonth] + ' ' + endYear : ''}`,
      description:`تم تعيينك في ${sh?.name} لـ ${totalDays} يوم (${monthsCount} شهر)`,
      status:'approved'
    }])
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,overflowY:'auto'}}>
      <div style={{background:S.navy2,borderRadius:20,border:`1px solid ${S.border}`,width:'100%',maxWidth:520,padding:28,margin:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div>
            <h3 style={{color:S.white,fontSize:16,fontWeight:800,marginBottom:4}}>📅 تعيين جدول شهري</h3>
            <p style={{fontSize:12,color:S.muted}}>الشيفت سيتكرر في الأيام المختارة</p>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:S.muted,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>الموظف *</label>
            <select style={inp} value={empId} onChange={e=>setEmpId(e.target.value)}>
              <option value="">اختر الموظف</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name} — {e.department}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:8}}>الشيفت *</label>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {shifts.map(s=>(
                <label key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,border:`1px solid ${shiftId===s.id?s.color:S.border}`,background:shiftId===s.id?s.color+'15':'transparent',cursor:'pointer'}}>
                  <input type="radio" name="shiftR" checked={shiftId===s.id} onChange={()=>setShiftId(s.id)} style={{accentColor:s.color}} />
                  <div style={{width:8,height:28,borderRadius:4,background:s.color}} />
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:S.white}}>{s.name}</div>
                    <div style={{fontSize:11,color:S.muted}}>{s.start_time?.slice(0,5)} — {s.end_time?.slice(0,5)}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>الشهر</label>
              <select style={inp} value={month} onChange={e=>setMonth(parseInt(e.target.value))}>
                {MONTHS_AR.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>السنة</label>
              <select style={inp} value={year} onChange={e=>setYear(parseInt(e.target.value))}>
                {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:8}}>عدد الشهور</label>
              <div style={{display:'flex',gap:8}}>
                {[{label:'شهر',v:1},{label:'3 شهور',v:3},{label:'6 شهور',v:6},{label:'سنة',v:12}].map(opt=>(
                  <button key={opt.v} onClick={()=>setMonthsCount(opt.v)}
                    style={{flex:1,padding:'8px 4px',borderRadius:8,border:`1px solid ${monthsCount===opt.v?S.gold:S.border}`,background:monthsCount===opt.v?S.gold3:'transparent',color:monthsCount===opt.v?S.gold:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif',fontWeight:monthsCount===opt.v?700:400}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:8}}>أيام العمل</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {DAYS_SHORT.map((d,i)=>(
                <button key={i} onClick={()=>setDays(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i].sort())}
                  style={{width:42,height:42,borderRadius:10,border:`1px solid ${days.includes(i)?S.gold:S.border}`,background:days.includes(i)?S.gold3:'transparent',color:days.includes(i)?S.gold:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          {previewDays.length>0&&(
            <div style={{background:S.greenB,border:`1px solid rgba(34,197,94,0.3)`,borderRadius:10,padding:'10px 14px'}}>
              <div style={{fontSize:13,fontWeight:700,color:S.green}}>✅ {previewDays.length} يوم في {MONTHS_AR[month]} {year}</div>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end',alignItems:'center'}}>
          {saving&&<span style={{fontSize:12,color:S.muted}}>{progress}</span>}
          <button onClick={onClose} style={{padding:'10px 20px',borderRadius:10,border:`1px solid ${S.muted}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{padding:'10px 24px',borderRadius:10,border:`1px solid ${S.green}`,background:S.greenB,color:S.green,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
            {saving?'⏳...':'✅ تعيين'}
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
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  const isManager = isAdmin || ['branch_manager','kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(employee?.role||'')
  const isEmployee = !isManager

  const [shifts, setShifts] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [mySchedules, setMySchedules] = useState<any[]>([])
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0) // لإعادة التحميل

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [activeTab, setActiveTab] = useState('schedule')
  const [showAddShift, setShowAddShift] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
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

      const {data: empData} = await supabase.from('employees').select('id,name,name_en,role,department,branch_id').eq('is_active',true).order('name')
      setEmployees(empData||[])
const {data: schData} = await supabase.from('shift_schedules')
  .select('*')
  .gte('date', monthStart)
  .lte('date', monthEnd)

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
  const workingNow = useMemo(()=>{
    const nowDate = todayStr()
    const nowMins = new Date().getHours()*60+new Date().getMinutes()
    return schedules.filter(s=>{
      if (String(s.date).slice(0,10)!==nowDate) return false
      if (!s.shifts?.start_time||!s.shifts?.end_time) return false
      const [sh,sm]=s.shifts.start_time.split(':').map(Number)
      const [eh,em]=s.shifts.end_time.split(':').map(Number)
      let end=eh*60+em; if(end<sh*60+sm) end+=24*60
      return nowMins>=sh*60+sm && nowMins<=end
    })
  },[schedules])

  // الفروع
  const branches = useMemo(()=>{
    const b = new Set<string>()
    employees.forEach(e=>{
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
    <table><thead><tr><th>الموظف</th><th>القسم</th>
    ${monthDays.map(d=>`<th>${d.day}<br/><small>${DAYS_SHORT[d.dow]}</small></th>`).join('')}</tr></thead>
    <tbody>${employees.map(emp=>`<tr><td style="text-align:right">${emp.name}${emp.name_en?' '+emp.name_en:''}</td><td>${emp.department||''}</td>
    ${monthDays.map(d=>{const s=getShift(emp.id,d.date);return s?`<td><span class="s" style="background:${s.shifts?.color||'#gold'}30;color:${s.shifts?.color||'#C9A84C'}">${s.shifts?.name||''}</span></td>`:'<td>—</td>'}).join('')}</tr>`).join('')}
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
              {isAdmin&&<button onClick={()=>setShowAddShift(true)} style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${S.purple}`,background:S.purpleB,color:S.purple,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>⏰ شيفت جديد</button>}
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

          {loading?(
            <div style={{textAlign:'center',padding:60,color:S.muted}}>⏳ جاري التحميل...</div>
          ):(
            /* عرض مقسم على الفروع */
            branches.map(branch=>{
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
                            <th style={{padding:'10px 14px',textAlign:'right',fontSize:12,color:S.muted,fontWeight:700,borderBottom:`1px solid ${S.border}`,position:'sticky',right:0,background:S.navy3,minWidth:130,zIndex:2}}>الموظف</th>
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
                              <td style={{padding:'8px 14px',position:'sticky',right:0,background:ei%2===0?S.navy2:'#0d1b35',borderLeft:`1px solid ${S.border}`,zIndex:1}}>
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <div style={{width:26,height:26,borderRadius:'50%',background:S.gold3,border:`1px solid ${S.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:S.gold,flexShrink:0}}>{emp.name?.charAt(0)}</div>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:700,color:S.white}}>{emp.name}{emp.name_en ? ' '+emp.name_en : ''}</div>
                                    <div style={{fontSize:10,color:S.muted}}>{emp.department}</div>
                                  </div>
                                </div>
                              </td>
                              {monthDays.map(d=>{
                                const sch = getShift(emp.id, d.date)
                                const isToday = d.date===todayStr()
                                return (
                                  <td key={d.day} style={{padding:'2px',textAlign:'center',background:isToday?'rgba(201,168,76,0.04)':'transparent'}}>
                                    {sch?(
                                      <div title={`${sch.shifts?.name} ${sch.shifts?.start_time?.slice(0,5)}—${sch.shifts?.end_time?.slice(0,5)}`}
                                        style={{background:(sch.shifts?.color||S.gold)+'30',border:`1px solid ${(sch.shifts?.color||S.gold)}60`,borderRadius:4,padding:'2px 1px',fontSize:9,fontWeight:800,color:sch.shifts?.color||S.gold,lineHeight:1.2}}>
                                        {sch.shifts?.name?.slice(0,3)||'✓'}
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
            const bw = workingNow.filter(s=>{
              const brName = Array.isArray(s.employees?.branches)?s.employees.branches[0]?.name:s.employees?.branches?.name
              return (brName||'بدون فرع')===branch
            })
            if (bw.length===0) return null
            return (
              <div key={branch} style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:800,color:S.white,marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
                  <span>🏪</span><span>{branch}</span>
                  <span style={{fontSize:12,color:S.green,background:S.greenB,borderRadius:20,padding:'2px 10px'}}>{bw.length} موظف</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                  {bw.map((s:any)=>(
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
          {shifts.map((shift:any)=>(
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
            <span style={{fontSize:14,fontWeight:700,color:S.white}}>{MONTHS_AR[viewMonth]} {viewYear} — {mySchedules.length} شيفت</span>
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
      {showAssign&&<AssignModal employees={employees} shifts={shifts} onClose={()=>setShowAssign(false)} onSaved={()=>{setShowAssign(false);refresh()}} />}
      {showRequest&&employee?.id&&<RequestModal shifts={shifts} employeeId={employee.id} onClose={()=>setShowRequest(false)} onSaved={()=>{setShowRequest(false);refresh()}} />}
    </div>
  )
}
