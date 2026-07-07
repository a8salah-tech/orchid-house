'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'
import { useLang } from '../../../components/LanguageContext'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const CRITERIA = [
  { key: 'attendance',       weight: 15, label: 'الحضور والالتزام',          label_en: 'Attendance & Punctuality',       icon: '⏰' },
  { key: 'work_quality',     weight: 20, label: 'جودة الأداء والإنتاجية',    label_en: 'Work Quality & Productivity',    icon: '⭐' },
  { key: 'customer_service', weight: 15, label: 'التعامل مع العملاء',        label_en: 'Customer Service',               icon: '🤝' },
  { key: 'hygiene',          weight: 10, label: 'النظافة الشخصية والمظهر',   label_en: 'Personal Hygiene & Appearance',  icon: '✨' },
  { key: 'teamwork',         weight: 10, label: 'العمل الجماعي والتعاون',    label_en: 'Teamwork & Cooperation',         icon: '👥' },
  { key: 'food_safety',      weight: 15, label: 'السلامة والنظافة الغذائية', label_en: 'Food Safety & Hygiene Standards', icon: '🍽️' },
  { key: 'initiative',       weight: 10, label: 'المبادرة وحل المشكلات',    label_en: 'Initiative & Problem Solving',   icon: '💡' },
  { key: 'discipline',       weight: 5,  label: 'الانضباط واحترام القوانين', label_en: 'Discipline & Rule Compliance',   icon: '📋' },
]
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
function calcTotal(sc: Record<string,number>) { return CRITERIA.reduce((s,c)=>s+((sc[c.key]||0)/10)*c.weight,0) }
function getGrade(t: number, ar: boolean) {
  if(t>=90) return {label:ar?'ممتاز':'Excellent',color:'#22C55E'}
  if(t>=75) return {label:ar?'جيد جداً':'Very Good',color:'#14B8A6'}
  if(t>=60) return {label:ar?'جيد':'Good',color:'#3B82F6'}
  if(t>=50) return {label:ar?'مقبول':'Acceptable',color:'#F59E0B'}
  return {label:ar?'ضعيف':'Poor',color:'#EF4444'}
}

export default function ViolationsPage() {
  const sb = createClient()
  const { employee, permissions } = useAuth()
  const { isAr } = useLang()
  const isAdmin = permissions?.all === true
  const role = employee?.role || ''
  const isBranchManager = role === 'branch_manager'
  const isDeptManager = ['kitchen_manager','hall_manager','bar_manager'].includes(role)
  const isSupervisor = ['kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(role)
  const canAdd = isAdmin || isBranchManager || isDeptManager || isSupervisor || permissions?.violations === true
  const canViewEvaluations = isAdmin || isBranchManager || isDeptManager

  const [violations, setViolations] = useState<any[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [activeBranch, setActiveBranch] = useState<string>('') // '' = الإجمالي (admin فقط)، أو branch_id محدد — مشترك بين كل التابات
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filterEmp, setFilterEmp] = useState('all')
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20
  const [form, setForm] = useState({ employee_id: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] })
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'violations'|'evaluations'|'absences'|'dept_violations'>('violations')
  const [evalEmps, setEvalEmps] = useState<any[]>([])
  const [evals, setEvals] = useState<any[]>([])
  const [evalMonth, setEvalMonth] = useState(new Date().getMonth()+1)
  const [evalYear, setEvalYear] = useState(new Date().getFullYear())
  const [evalLoading, setEvalLoading] = useState(false)
  const [evalSaving, setEvalSaving] = useState<string|null>(null)
  const [evalScores, setEvalScores] = useState<Record<string,Record<string,number>>>({})
  const [evalNotes, setEvalNotes] = useState<Record<string,string>>({})
  const [absEmps, setAbsEmps] = useState<any[]>([])
  const [absences, setAbsences] = useState<any[]>([])
  const [absLoading, setAbsLoading] = useState(false)
  const [absFilterMonth, setAbsFilterMonth] = useState(new Date().toISOString().slice(0,7))
  const [showAbsAdd, setShowAbsAdd] = useState(false)
  const [absSaving, setAbsSaving] = useState(false)
  const [absForm, setAbsForm] = useState({ employee_id: '', date: new Date().toISOString().split('T')[0], notes: '' })

  // ── مخالفة القسم ──
  const canSubmitDeptViolation = isDeptManager || isSupervisor
  const canViewDeptViolations  = isAdmin || isBranchManager
  const [showDeptViolAdd, setShowDeptViolAdd]   = useState(false)
  const [deptViolations, setDeptViolations]     = useState<any[]>([])
  const [deptViolLoading, setDeptViolLoading]   = useState(false)
  const [deptViolSaving, setDeptViolSaving]     = useState(false)
  const [deptViolFile, setDeptViolFile]         = useState<File | null>(null)
  const [deptViolPreview, setDeptViolPreview]   = useState<string | null>(null)
  const [deptViolFilterMonth, setDeptViolFilterMonth] = useState(new Date().toISOString().slice(0,7))
  const DEPARTMENTS = ['المطبخ','الصالة','البار','الحلويات','الكاشير','التوصيل','المستودع','الإدارة']
  const [deptViolForm, setDeptViolForm] = useState({
    department: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  })
  async function fetchAll() {
    setLoading(true)
    let empQ = sb.from('employees').select('id,name,name_en,department,role,branch_id,employee_number').eq('is_active', true).order('name')
    if (!isAdmin) {
      if (isBranchManager) empQ = empQ.eq('branch_id', employee?.branch_id || '')
      else if (role === 'kitchen_manager') empQ = empQ.eq('branch_id', employee?.branch_id || '').in('department', ['المطبخ','Kitchen','البار','Bar','الحلويات'])
      else if (role === 'hall_manager') empQ = empQ.eq('branch_id', employee?.branch_id || '').in('department', ['الصالة','Hall'])
      else if (role === 'bar_manager') empQ = empQ.eq('branch_id', employee?.branch_id || '').in('department', ['البار','Bar'])
      else if (role === 'kitchen_supervisor') empQ = empQ.eq('branch_id', employee?.branch_id || '').in('department', ['المطبخ','Kitchen'])
      else if (role === 'hall_supervisor') empQ = empQ.eq('branch_id', employee?.branch_id || '').in('department', ['الصالة','Hall'])
      else if (role === 'bar_supervisor') empQ = empQ.eq('branch_id', employee?.branch_id || '').in('department', ['البار','Bar'])
    } else if (activeBranch) {
      // admin اختار تاب فرع محدد (بدل "الإجمالي") — فلترة إضافية بدون التأثير على باقي الأدوار
      empQ = empQ.eq('branch_id', activeBranch)
    }
    const { data: empData } = await empQ
    const today = new Date().toISOString().split('T')[0]
    const empIds = (empData || []).map((e: any) => e.id)
    let workingNowEmps: any[] = []
    if (empIds.length > 0) {
      const { data: attData } = await sb.from('attendance').select('employee_id').eq('date', today).not('check_in_time', 'is', null).is('check_out_time', null).in('employee_id', empIds)
      const workingIds = new Set((attData || []).map((a: any) => a.employee_id))
      workingNowEmps = (empData || []).filter((e: any) => workingIds.has(e.id))
    }
    setEmployees(workingNowEmps.length > 0 ? workingNowEmps : (empData || []))
    const [year, month] = filterMonth.split('-').map(Number)
    const monthStart = new Date(year, month-1, 1).toISOString().split('T')[0]
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]
    let vQ = sb.from('violations').select('*').gte('date', monthStart).lte('date', monthEnd).order('created_at', { ascending: false })
    if (isAdmin) {
      // admin يشوف الكل، إلا لو اختار تاب فرع محدد (بدل "الإجمالي")
      if (activeBranch) {
        const ids = (empData || []).map((e: any) => e.id)
        vQ = vQ.in('employee_id', ids.length > 0 ? ids : ['__none__'])
      }
    } else if (isBranchManager) {
      const ids = (empData || []).map((e: any) => e.id)
      if (ids.length > 0) vQ = vQ.in('employee_id', ids)
    } else if (isDeptManager) {
      // مدير القسم يشوف قسمه فقط
      const ids = (empData || []).map((e: any) => e.id)
      if (ids.length > 0) vQ = vQ.in('employee_id', ids)
    } else if (isSupervisor) {
      // المشرف يشوف اللي هو سجلها بس
      vQ = vQ.eq('created_by', employee?.id || '')
    }
    const { data: vData, error } = await vQ
    if (error) { console.error('violations error:', error.message); setLoading(false); return }
    if (vData && vData.length > 0) {
      const ids2 = [...new Set(vData.map(v => v.employee_id).concat(vData.map(v => v.created_by)).filter(Boolean))]
      const { data: empNames } = await sb.from('employees').select('id,name,name_en,department,employee_number').in('id', ids2 as string[])
      const empMap = Object.fromEntries((empNames || []).map(e => [e.id, e]))
      setViolations(vData.map(v => ({ ...v, empName: empMap[v.employee_id]?.name || '—', empNameEn: empMap[v.employee_id]?.name_en || '', empDept: empMap[v.employee_id]?.department || '', empNumber: empMap[v.employee_id]?.employee_number || '', creatorName: `${empMap[v.created_by]?.name || '—'} ${empMap[v.created_by]?.name_en || ''}`.trim() })))
    } else { setViolations([]) }
    setLoading(false)
  }

  useEffect(() => { if (employee?.id) { setPage(0); fetchAll() } }, [employee?.id, filterMonth, activeBranch])
  useEffect(() => {
    sb.from('branches').select('id,name').eq('is_active', true).then(({ data }) => setBranches(data || []))
  }, [])
  useEffect(() => {
    // الأدوار غير admin تتقفل على فرعها تلقائيًا (شريط واحد مشترك لكل التابات)
    if (!isAdmin && employee?.branch_id) setActiveBranch(employee.branch_id)
  }, [isAdmin, employee?.branch_id])

  async function fetchEvaluations() {
    setEvalLoading(true)
    let q = sb.from('employees').select('id,name,name_en,department').eq('is_active',true).order('name')
    if(!isAdmin){
      if(isBranchManager) q=q.eq('branch_id',employee?.branch_id||'')
      else if(role==='kitchen_manager') q=q.eq('branch_id',employee?.branch_id||'').in('department',['المطبخ','Kitchen'])
      else if(role==='hall_manager') q=q.eq('branch_id',employee?.branch_id||'').in('department',['الصالة','Hall'])
      else if(role==='bar_manager') q=q.eq('branch_id',employee?.branch_id||'').in('department',['البار','Bar'])
      else if(role==='kitchen_supervisor') q=q.eq('branch_id',employee?.branch_id||'').in('department',['المطبخ','Kitchen'])
      else if(role==='hall_supervisor') q=q.eq('branch_id',employee?.branch_id||'').in('department',['الصالة','Hall'])
      else if(role==='bar_supervisor') q=q.eq('branch_id',employee?.branch_id||'').in('department',['البار','Bar'])
    } else if (activeBranch) {
      q = q.eq('branch_id', activeBranch)
    }
    const {data:empData}=await q
    const list=(empData||[]).filter((e:any)=>e.id!==employee?.id)
    setEvalEmps(list)
    const ids=list.map((e:any)=>e.id)
    if(ids.length>0){
      const {data:evData}=await sb.from('employee_evaluations').select('*').in('employee_id',ids).eq('month',evalMonth).eq('year',evalYear)
      setEvals(evData||[])
      const sm:Record<string,Record<string,number>>={};const nm:Record<string,string>={}
      for(const ev of(evData||[])){sm[ev.employee_id]=CRITERIA.reduce((a:any,c)=>({...a,[c.key]:ev[c.key]||0}),{});nm[ev.employee_id]=ev.notes||''}
      setEvalScores(sm);setEvalNotes(nm)
    } else{setEvals([]);setEvalScores({});setEvalNotes({})}
    setEvalLoading(false)
  }
  useEffect(()=>{if(employee?.id&&activeTab==='evaluations')fetchEvaluations()},[employee?.id,activeTab,evalMonth,evalYear,activeBranch])

  async function saveEval(empId:string, action: 'draft'|'submit'|'approve' = 'draft'){
    if(action==='approve' && new Date().getDate()>20){alert(isAr?'انتهت فترة الاعتماد (حتى يوم 20)':'Approval period ended (day 20)');return}
    setEvalSaving(empId)
    const sc=evalScores[empId]||{};const total=calcTotal(sc);const ex=evals.find(e=>e.employee_id===empId)
    const newStatus = action==='approve' ? 'approved' : action==='submit' ? 'submitted' : 'draft'
    const payload={
      employee_id:empId, evaluator_id:employee?.id, month:evalMonth, year:evalYear,
      ...CRITERIA.reduce((a:any,c)=>({...a,[c.key]:sc[c.key]||0}),{}),
      total_score:parseFloat(total.toFixed(2)), notes:evalNotes[empId]||null,
      status:newStatus,
      submitted_at: action==='submit' ? new Date().toISOString() : (ex?.submitted_at||null),
      approved_at: action==='approve' ? new Date().toISOString() : null,
    }
    if(ex)await sb.from('employee_evaluations').update(payload).eq('id',ex.id)
    else await sb.from('employee_evaluations').insert([payload])
    setEvalSaving(null);fetchEvaluations()
  }

  async function fetchAbsences() {
    setAbsLoading(true)
    let empQ = sb.from('employees').select('id,name,name_en,department,branch_id').eq('is_active',true).order('name')
    if(!isAdmin){
      if(isBranchManager) empQ=empQ.eq('branch_id',employee?.branch_id||'')
      else if(role==='kitchen_manager') empQ=empQ.eq('branch_id',employee?.branch_id||'').in('department',['المطبخ','Kitchen'])
      else if(role==='hall_manager') empQ=empQ.eq('branch_id',employee?.branch_id||'').in('department',['الصالة','Hall'])
      else if(role==='bar_manager') empQ=empQ.eq('branch_id',employee?.branch_id||'').in('department',['البار','Bar'])
      else if(role==='kitchen_supervisor') empQ=empQ.eq('branch_id',employee?.branch_id||'').in('department',['المطبخ','Kitchen'])
      else if(role==='hall_supervisor') empQ=empQ.eq('branch_id',employee?.branch_id||'').in('department',['الصالة','Hall'])
      else if(role==='bar_supervisor') empQ=empQ.eq('branch_id',employee?.branch_id||'').in('department',['البار','Bar'])
    } else if (activeBranch) {
      empQ = empQ.eq('branch_id', activeBranch)
    }
    const {data:empData}=await empQ
    const list=(empData||[]).filter((e:any)=>e.id!==employee?.id)
    setAbsEmps(list)
    const ids=list.map((e:any)=>e.id)
    const [year,month]=absFilterMonth.split('-').map(Number)
    const monthStart=new Date(year,month-1,1).toISOString().split('T')[0]
    const monthEnd=new Date(year,month,0).toISOString().split('T')[0]
    let q=sb.from('absences').select('*').gte('date',monthStart).lte('date',monthEnd).order('date',{ascending:false})
    if(ids.length>0&&!isAdmin&&!isBranchManager) q=q.in('employee_id',ids)
    else if(isBranchManager&&ids.length>0) q=q.in('employee_id',ids)
    else if(isAdmin&&activeBranch&&ids.length>0) q=q.in('employee_id',ids)
    const {data:absData}=await q
    if(absData&&absData.length>0){
      const allIds=[...new Set(absData.map((a:any)=>a.employee_id).concat(absData.map((a:any)=>a.created_by)).filter(Boolean))]
      const {data:empNames}=await sb.from('employees').select('id,name,name_en,department').in('id',allIds as string[])
      const empMap=Object.fromEntries((empNames||[]).map(e=>[e.id,e]))
      setAbsences(absData.map((a:any)=>({...a,empName:empMap[a.employee_id]?.name||'—',empNameEn:empMap[a.employee_id]?.name_en||'',empDept:empMap[a.employee_id]?.department||'',creatorName:empMap[a.created_by]?.name||'—'})))
    } else setAbsences([])
    setAbsLoading(false)
  }
  useEffect(()=>{if(employee?.id&&activeTab==='absences')fetchAbsences()},[employee?.id,activeTab,absFilterMonth,activeBranch])
  useEffect(()=>{if(employee?.id&&activeTab==='dept_violations')fetchDeptViolations()},[employee?.id,activeTab,deptViolFilterMonth,activeBranch])

  async function saveAbsence(){
    if(!absForm.employee_id||!absForm.date){alert('يرجى اختيار الموظف والتاريخ');return}
    setAbsSaving(true)
    const initStatus = isSupervisor ? 'submitted' : 'active'
    const {error}=await sb.from('absences').insert([{
      employee_id:absForm.employee_id, created_by:employee?.id,
      date:absForm.date, notes:absForm.notes||null,
      status:initStatus, submitted_at: isSupervisor ? new Date().toISOString() : null,
    }])
    setAbsSaving(false)
    if(error){alert('خطأ: '+error.message);return}
    setShowAbsAdd(false)
    setAbsForm({employee_id:'',date:new Date().toISOString().split('T')[0],notes:''})
    fetchAbsences()
  }

  async function approveAbsence(id:string){
    await sb.from('absences').update({status:'active',manager_approved_by:employee?.id,manager_approved_at:new Date().toISOString()}).eq('id',id)
    fetchAbsences()
  }

  async function returnAbsence(id:string){
    await sb.from('absences').update({status:'draft'}).eq('id',id)
    fetchAbsences()
  }

  async function cancelAbsence(id:string){
    if(!confirm('إلغاء هذا الغياب؟'))return
    await sb.from('absences').update({status:'cancelled'}).eq('id',id)
    fetchAbsences()
  }

  async function fetchDeptViolations() {
    setDeptViolLoading(true)
    const [year, month] = deptViolFilterMonth.split('-').map(Number)
    const monthStart = new Date(year, month-1, 1).toISOString().split('T')[0]
    const monthEnd   = new Date(year, month, 0).toISOString().split('T')[0]
    let dQ = sb.from('department_violations')
      .select('*').gte('date', monthStart).lte('date', monthEnd)
      .order('created_at', { ascending: false })
    if (isSupervisor) dQ = dQ.eq('created_by', employee?.id || '')
    const { data } = await dQ
    let filteredData = data || []
    // فلترة إضافية بالفرع النشط (admin) أو فرع المستخدم (غير admin)، بناءً على فرع منشئ المخالفة
    const branchToFilter = isAdmin ? activeBranch : employee?.branch_id
    if (branchToFilter && filteredData.length > 0) {
      const creatorIds = [...new Set(filteredData.map((d:any) => d.created_by).filter(Boolean))]
      const { data: creators } = await sb.from('employees').select('id,branch_id').in('id', creatorIds as string[])
      const creatorBranchMap = Object.fromEntries((creators || []).map((c: any) => [c.id, c.branch_id]))
      filteredData = filteredData.filter((d: any) => creatorBranchMap[d.created_by] === branchToFilter)
    }
    if (filteredData.length > 0) {
      const creatorIds = [...new Set(filteredData.map((d:any) => d.created_by).filter(Boolean))]
      const { data: names } = await sb.from('employees').select('id,name,name_en').in('id', creatorIds as string[])
      const nameMap = Object.fromEntries((names||[]).map(e=>[e.id,e]))
      setDeptViolations(filteredData.map((d:any) => ({ ...d, creatorName: nameMap[d.created_by]?.name || '—' })))
    } else { setDeptViolations([]) }
    setDeptViolLoading(false)
  }

  async function saveDeptViolation() {
    if (!deptViolForm.department || !deptViolForm.reason || !deptViolForm.date) {
      alert('يرجى إكمال جميع الحقول'); return
    }
    setDeptViolSaving(true)
    let attachUrl = ''
    if (deptViolFile) {
      const ext = deptViolFile.name.split('.').pop()
      const path = `dept_violations/${Date.now()}.${ext}`
      const { data: upData } = await sb.storage.from('employees').upload(path, deptViolFile, { upsert: true })
      if (upData) { const { data: urlData } = sb.storage.from('employees').getPublicUrl(upData.path); attachUrl = urlData.publicUrl }
    }
    const { error } = await sb.from('department_violations').insert([{
      department: deptViolForm.department,
      reason: deptViolForm.reason,
      date: deptViolForm.date,
      created_by: employee?.id,
      attachment_url: attachUrl || null,
    }])
    setDeptViolSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    setShowDeptViolAdd(false)
    setDeptViolForm({ department: '', reason: '', date: new Date().toISOString().split('T')[0] })
    setDeptViolFile(null)
    fetchDeptViolations()
  }

  async function save() {
    if (!form.employee_id || !form.amount || !form.reason) { alert('يرجى إكمال جميع الحقول'); return }
    setSaving(true)
    let finalAttachment = attachmentUrl
    if (attachmentFile) {
      const ext = attachmentFile.name.split('.').pop()
      const path = `violations/${Date.now()}.${ext}`
      const { data: upData } = await sb.storage.from('employees').upload(path, attachmentFile, { upsert: true })
      if (upData) { const { data: urlData } = sb.storage.from('employees').getPublicUrl(upData.path); finalAttachment = urlData.publicUrl }
    }
    // المشرف يسجل بحالة submitted، المدير يسجل مباشرة بحالة active
    const initStatus = isSupervisor ? 'submitted' : 'active'
    const { error } = await sb.from('violations').insert([{
      employee_id: form.employee_id, amount: parseFloat(form.amount),
      reason: form.reason, date: form.date, created_by: employee?.id,
      status: initStatus, attachment_url: finalAttachment || null,
      submitted_at: isSupervisor ? new Date().toISOString() : null,
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    setShowAdd(false)
    setForm({ employee_id: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] })
    setAttachmentFile(null); setAttachmentUrl('')
    fetchAll()
  }

  async function approveViolation(id: string) {
    await sb.from('violations').update({ status: 'active', manager_approved_by: employee?.id, manager_approved_at: new Date().toISOString() }).eq('id', id)
    fetchAll()
  }

  async function returnViolation(id: string) {
    await sb.from('violations').update({ status: 'draft' }).eq('id', id)
    fetchAll()
  }

  async function cancelViolation(id: string) {
    if (!confirm('إلغاء هذه المخالفة؟')) return
    await sb.from('violations').update({ status: 'cancelled' }).eq('id', id)
    fetchAll()
  }

  if (employee && !canAdd) return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>غير مصرح بالوصول</div>
    </div>
  )

  const filtered = violations.filter(v => filterEmp === 'all' || v.employee_id === filterEmp)
  const totalAmount = filtered.filter(v => v.status === 'active').reduce((s, v) => s + (v.amount || 0), 0)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>⚠️ {isAr ? 'المخالفات والتقييمات' : 'Violations & Evaluations'}</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'إدارة مخالفات وتقييمات الموظفين' : 'Manage violations and evaluations'}</p>
        </div>
        {canAdd && activeTab === 'violations' && (
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ➕ {isAr ? 'إضافة مخالفة' : 'Add Violation'}
          </button>
        )}
      </div>

      {/* Branch Tabs — مشتركة بين كل التابات الأربعة */}
      {branches.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={() => setActiveBranch('')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${activeBranch === '' ? S.gold : S.border}`, background: activeBranch === '' ? S.gold3 : 'transparent', color: activeBranch === '' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === '' ? 700 : 400 }}>
              🌐 {isAr ? 'الإجمالي (الكل)' : 'All Branches'}
            </button>
          )}
          {(isAdmin ? branches : branches.filter(b => b.id === employee?.branch_id)).map(b => (
            <button key={b.id} onClick={() => setActiveBranch(b.id)}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${activeBranch === b.id ? S.gold : S.border}`, background: activeBranch === b.id ? S.gold3 : 'transparent', color: activeBranch === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === b.id ? 700 : 400 }}>
              🏪 {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setActiveTab('violations')} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${activeTab==='violations' ? S.red : S.border}`, background: activeTab==='violations' ? S.redB : 'transparent', color: activeTab==='violations' ? S.red : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab==='violations' ? 700 : 400 }}>⚠️ {isAr ? 'المخالفات' : 'Violations'}</button>
        {canViewEvaluations && (
          <button onClick={() => setActiveTab('evaluations')} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${activeTab==='evaluations' ? S.gold : S.border}`, background: activeTab==='evaluations' ? S.gold3 : 'transparent', color: activeTab==='evaluations' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab==='evaluations' ? 700 : 400 }}>⭐ {isAr ? 'التقييمات' : 'Evaluations'}</button>
        )}
        <button onClick={() => setActiveTab('absences')} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${activeTab==='absences' ? '#8B5CF6' : S.border}`, background: activeTab==='absences' ? 'rgba(139,92,246,0.12)' : 'transparent', color: activeTab==='absences' ? '#8B5CF6' : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab==='absences' ? 700 : 400 }}>🚫 {isAr ? 'الغياب' : 'Absences'}</button>
        {(canSubmitDeptViolation || canViewDeptViolations) && (
          <button onClick={() => setActiveTab('dept_violations')} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${activeTab==='dept_violations' ? '#F97316' : S.border}`, background: activeTab==='dept_violations' ? 'rgba(249,115,22,0.12)' : 'transparent', color: activeTab==='dept_violations' ? '#F97316' : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab==='dept_violations' ? 700 : 400 }}>🏢 {isAr ? 'مخالفات الأقسام' : 'Dept Violations'}</button>
        )}
      </div>

      {/* ══ VIOLATIONS TAB ══ */}
      {activeTab === 'violations' && <div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: isAr ? 'إجمالي المخالفات' : 'Total', value: filtered.length, color: S.red, bg: S.redB },
          { label: isAr ? 'إجمالي الخصم' : 'Total Deductions', value: `MYR ${totalAmount.toFixed(2)}`, color: S.amber, bg: S.amberB },
          { label: isAr ? 'نشطة' : 'Active', value: filtered.filter(v => v.status === 'active').length, color: S.green, bg: S.greenB },
          { label: isAr ? 'ملغاة' : 'Cancelled', value: filtered.filter(v => v.status === 'cancelled').length, color: S.muted, bg: S.card },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: 'auto' }} type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        <select style={{ ...inp, width: 'auto', minWidth: 160, cursor: 'pointer', background: S.navy2 }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="all">{isAr ? 'كل الموظفين' : 'All Employees'}</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.name_en || ''}{(e as any).employee_number ? ` (#${(e as any).employee_number})` : ''}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ color: S.muted }}>{isAr ? 'لا توجد مخالفات في هذه الفترة' : 'No violations in this period'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paginated.map(v => (
            <div key={v.id} style={{ background: v.status === 'cancelled' ? S.card : S.navy2, borderRadius: 14, border: `1px solid ${v.status === 'cancelled' ? S.border : S.red+'30'}`, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, opacity: v.status === 'cancelled' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: S.redB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>{v.empName} {v.empNameEn}{v.empNumber ? ` (#${v.empNumber})` : ''} — {v.empDept}</div>
                  <div style={{ fontSize: 12, color: S.muted, marginBottom: 4 }}>{v.reason}</div>
                  <div style={{ fontSize: 13, color: S.muted }}>📅 {v.date} · <span style={{ color: S.white, fontWeight: 600 }}>{isAr ? 'بواسطة' : 'by'}: {v.creatorName}</span></div>
                  {v.attachment_url && (
                    <div style={{ marginTop: 8 }}>
                      {v.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={v.attachment_url} alt="مرفق" style={{ maxWidth: 200, maxHeight: 120, borderRadius: 8, border: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => setImagePreview(v.attachment_url)} />
                      ) : (
                        <a href={v.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: S.blue, display: 'inline-flex', alignItems: 'center', gap: 4, background: S.blueB, borderRadius: 8, padding: '4px 10px' }}>📎 {isAr ? 'عرض المرفق' : 'View Attachment'}</a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: v.status === 'cancelled' ? S.muted : S.red }}>MYR {(v.amount || 0).toFixed(2)}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: v.status==='active'?S.red:v.status==='submitted'?S.amber:S.muted, background: v.status==='active'?S.redB:v.status==='submitted'?S.amberB:S.card, borderRadius: 20, padding: '2px 10px' }}>
                    {v.status==='active'?(isAr?'نشطة':'Active'):v.status==='submitted'?(isAr?'بانتظار الاعتماد':'Pending Approval'):(isAr?'ملغاة':'Cancelled')}
                  </span>
                </div>
                {/* Submitted - waiting manager approval */}
                {v.status === 'submitted' && isDeptManager && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => returnViolation(v.id)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>↩️ {isAr?'إعادة':'Return'}</button>
                    <button onClick={() => approveViolation(v.id)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ {isAr?'اعتماد':'Approve'}</button>
                  </div>
                )}
                {v.status === 'submitted' && (isAdmin || isBranchManager) && (
                  <button onClick={() => approveViolation(v.id)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ {isAr?'اعتماد':'Approve'}</button>
                )}
                {(isAdmin || isBranchManager || isDeptManager) && (v.status === 'active' || v.status === 'submitted') && (
                  <button onClick={() => cancelViolation(v.id)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: page === 0 ? 'transparent' : S.card2, color: page === 0 ? S.muted : S.white, cursor: page === 0 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? '← السابق' : '← Prev'}</button>
          {Array.from({ length: totalPages }, (_, i) => i).map(i => (
            <button key={i} onClick={() => setPage(i)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${i === page ? S.gold : S.border}`, background: i === page ? S.gold3 : 'transparent', color: i === page ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: i === page ? 800 : 400 }}>{i + 1}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: page >= totalPages-1 ? 'transparent' : S.card2, color: page >= totalPages-1 ? S.muted : S.white, cursor: page >= totalPages-1 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'التالي →' : 'Next →'}</button>
        </div>
      )}

      {/* Image Preview Modal */}
      {imagePreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setImagePreview(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setImagePreview(null)} style={{ position: 'absolute', top: -16, right: -16, width: 36, height: 36, borderRadius: '50%', background: S.red, border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>✕</button>
            <img src={imagePreview} alt="مرفق" style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }} />
          </div>
        </div>
      )}

      </div>}

      {/* ══ EVALUATIONS TAB ══ */}
      {activeTab === 'evaluations' && (
        <div>
          <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
            <select style={{...inp,width:'auto',cursor:'pointer',background:S.navy2}} value={evalMonth} onChange={e=>setEvalMonth(Number(e.target.value))}>
              {(isAr?MONTHS_AR:MONTHS_EN).map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select style={{...inp,width:'auto',cursor:'pointer',background:S.navy2}} value={evalYear} onChange={e=>setEvalYear(Number(e.target.value))}>
              {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{fontSize:12,color:S.muted}}>⏰ {isAr?'الاعتماد حتى يوم 20':'Approve until day 20'}</span>
            <span style={{fontSize:12,color:S.green,background:S.greenB,borderRadius:20,padding:'3px 10px'}}>✅ {evals.filter(e=>e.status==='approved').length} {isAr?'معتمد':'Approved'}</span>
          </div>
          {evalLoading ? <div style={{textAlign:'center',padding:60,color:S.muted}}>⏳</div>
          : evalEmps.length===0 ? (
            <div style={{textAlign:'center',padding:60,background:S.navy2,borderRadius:16,border:`1px solid ${S.border}`}}>
              <div style={{fontSize:40,marginBottom:12}}>👥</div>
              <div style={{color:S.muted}}>{isAr?'لا يوجد موظفون':'No employees'}</div>
            </div>
          ) : evalEmps.map(emp => {
            const ex = evals.find(e => e.employee_id === emp.id)
            const sc = evalScores[emp.id] || {}
            const total = calcTotal(sc)
            const grade = getGrade(total, isAr)
            const canEdit = ex?.status !== 'approved' && new Date().getDate() <= 20
            return (
              <div key={emp.id} style={{background:S.navy2,borderRadius:16,border:`1px solid ${ex?.status==='approved'?S.green+'40':S.border}`,padding:20,marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,paddingBottom:14,borderBottom:`1px solid ${S.border}`}}>
                  <div style={{width:42,height:42,borderRadius:'50%',background:S.gold3,border:`1px solid ${S.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:S.gold,flexShrink:0}}>{emp.name?.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:S.white}}>{emp.name} {emp.name_en||''}</div>
                    <div style={{fontSize:12,color:S.muted}}>{emp.department}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:900,color:grade.color}}>{total.toFixed(1)}%</div>
                    <div style={{fontSize:11,fontWeight:700,color:grade.color,background:grade.color+'20',borderRadius:20,padding:'2px 8px'}}>{grade.label}</div>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
                  {CRITERIA.map(c => (
                    <div key={c.key}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:12,color:S.white}}>{c.icon} {isAr?c.label:c.label_en} <span style={{color:S.muted,fontSize:10}}>({c.weight}%)</span></span>
                        <span style={{fontSize:12,fontWeight:800,color:(sc[c.key]||0)>=8?S.green:(sc[c.key]||0)>=6?S.blue:(sc[c.key]||0)>=4?S.amber:(sc[c.key]||0)>0?S.red:S.muted}}>{sc[c.key]||0}/10</span>
                      </div>
                      <div style={{display:'flex',gap:3}}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                          <button key={n} onClick={()=>canEdit&&setEvalScores(p=>({...p,[emp.id]:{...(p[emp.id]||{}),[c.key]:n}}))} disabled={!canEdit}
                            style={{flex:1,padding:'5px 0',borderRadius:5,border:'none',background:(sc[c.key]||0)>=n?(n>=8?S.green:n>=6?S.blue:n>=4?S.amber:S.red):'rgba(255,255,255,0.06)',color:(sc[c.key]||0)>=n?'#fff':S.muted,cursor:canEdit?'pointer':'default',fontSize:10,fontWeight:700}}>{n}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden',marginBottom:4}}>
                    <div style={{height:'100%',width:`${total}%`,background:grade.color,borderRadius:3,transition:'width .3s'}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:11,color:S.muted}}>{isAr?'الإجمالي':'Total'}</span>
                    <span style={{fontSize:11,fontWeight:700,color:grade.color}}>{total.toFixed(1)}% — {grade.label}</span>
                  </div>
                </div>
                {canEdit && <textarea style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${S.border}`,borderRadius:10,padding:'8px 12px',fontSize:12,color:S.white,outline:'none',fontFamily:'Tajawal, sans-serif',direction:'rtl',resize:'none',minHeight:60,boxSizing:'border-box',marginBottom:12} as React.CSSProperties} value={evalNotes[emp.id]||''} onChange={e=>setEvalNotes(p=>({...p,[emp.id]:e.target.value}))} placeholder={isAr?'ملاحظات...':'Notes...'}/>}
                {ex?.status==='approved' && <div style={{background:S.greenB,borderRadius:10,padding:'8px 14px',fontSize:12,color:S.green,marginBottom:10}}>✅ {isAr?'تم الاعتماد النهائي':'Final Approved'} · {ex.approved_at?new Date(ex.approved_at).toLocaleDateString():''}</div>}
                {ex?.status==='draft' && ex?.total_score > 0 && <div style={{background:S.blueB,borderRadius:10,padding:'6px 14px',fontSize:11,color:S.blue,marginBottom:10}}>📝 {isAr?'مسودة محفوظة':'Saved as draft'}</div>}
                {!canEdit && ex?.status!=='approved' && <div style={{background:S.amberB,borderRadius:10,padding:'8px 14px',fontSize:12,color:S.amber,marginBottom:10}}>⚠️ {isAr?'انتهت فترة التقييم (حتى يوم 20)':'Evaluation period ended (until day 20)'}</div>}
                {/* Supervisor buttons: Save Draft + Submit to Manager */}
                {canEdit && isSupervisor && ex?.status !== 'submitted' && (
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>saveEval(emp.id,'draft')} disabled={evalSaving===emp.id}
                      style={{flex:1,padding:'9px',borderRadius:10,border:`1px solid ${S.blue}`,background:S.blueB,color:S.blue,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                      {evalSaving===emp.id?'⏳':(isAr?'💾 حفظ مسودة':'💾 Save Draft')}
                    </button>
                    <button onClick={()=>saveEval(emp.id,'submit')} disabled={evalSaving===emp.id||total===0}
                      style={{flex:1,padding:'9px',borderRadius:10,border:`1px solid ${S.amber}`,background:S.amberB,color:S.amber,cursor:total===0?'not-allowed':'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700,opacity:total===0?0.5:1}}>
                      {evalSaving===emp.id?'⏳':(isAr?'📤 إرسال للمدير':'📤 Submit to Manager')}
                    </button>
                  </div>
                )}
                {/* Supervisor submitted - waiting */}
                {isSupervisor && ex?.status === 'submitted' && (
                  <div style={{background:S.amberB,borderRadius:10,padding:'8px 14px',fontSize:12,color:S.amber}}>
                    ⏳ {isAr?'تم الإرسال — في انتظار اعتماد المدير':'Submitted — awaiting manager approval'}
                    <button onClick={()=>saveEval(emp.id,'draft')} style={{marginRight:10,background:'transparent',border:`1px solid ${S.muted}`,borderRadius:6,color:S.muted,cursor:'pointer',fontSize:11,padding:'2px 8px',fontFamily:'Tajawal, sans-serif'}}>{isAr?'تعديل':'Edit'}</button>
                  </div>
                )}
                {/* Manager buttons: Approve submitted evaluations */}
                {canEdit && isDeptManager && ex?.status === 'submitted' && (
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>saveEval(emp.id,'draft')} disabled={evalSaving===emp.id}
                      style={{flex:1,padding:'9px',borderRadius:10,border:`1px solid ${S.red}`,background:S.redB,color:S.red,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                      {evalSaving===emp.id?'⏳':(isAr?'↩️ إعادة للمشرف':'↩️ Return to Supervisor')}
                    </button>
                    <button onClick={()=>saveEval(emp.id,'approve')} disabled={evalSaving===emp.id}
                      style={{flex:1,padding:'9px',borderRadius:10,border:`1px solid ${S.green}`,background:S.greenB,color:S.green,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                      {evalSaving===emp.id?'⏳':(isAr?'✅ اعتماد نهائي':'✅ Final Approve')}
                    </button>
                  </div>
                )}
                {/* Admin/Branch Manager: can approve directly */}
                {canEdit && (isAdmin || isBranchManager) && ex?.status === 'submitted' && (
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>saveEval(emp.id,'approve')} disabled={evalSaving===emp.id}
                      style={{flex:1,padding:'9px',borderRadius:10,border:`1px solid ${S.green}`,background:S.greenB,color:S.green,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                      {evalSaving===emp.id?'⏳':(isAr?'✅ اعتماد':'✅ Approve')}
                    </button>
                  </div>
                )}
                {/* Draft - manager can also write and approve directly */}
                {canEdit && (isDeptManager||isAdmin||isBranchManager) && (!ex || ex?.status === 'draft') && (
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>saveEval(emp.id,'draft')} disabled={evalSaving===emp.id}
                      style={{flex:1,padding:'9px',borderRadius:10,border:`1px solid ${S.blue}`,background:S.blueB,color:S.blue,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                      {evalSaving===emp.id?'⏳':(isAr?'💾 حفظ':'💾 Save')}
                    </button>
                    <button onClick={()=>saveEval(emp.id,'approve')} disabled={evalSaving===emp.id||total===0}
                      style={{flex:1,padding:'9px',borderRadius:10,border:`1px solid ${S.green}`,background:S.greenB,color:S.green,cursor:total===0?'not-allowed':'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700,opacity:total===0?0.5:1}}>
                      {evalSaving===emp.id?'⏳':(isAr?'✅ اعتماد':'✅ Approve')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ ABSENCES TAB ══ */}
      {activeTab === 'absences' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <input style={{...inp,width:'auto'}} type="month" value={absFilterMonth} onChange={e=>setAbsFilterMonth(e.target.value)} />
            <button onClick={()=>setShowAbsAdd(true)} style={{padding:'9px 18px',borderRadius:10,border:'1px solid #8B5CF6',background:'rgba(139,92,246,0.12)',color:'#8B5CF6',cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
              ➕ {isAr?'تسجيل غياب':'Add Absence'}
            </button>
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:20}}>
            {[
              {label:isAr?'إجمالي الغياب':'Total',value:absences.length,color:'#8B5CF6',bg:'rgba(139,92,246,0.12)'},
              {label:isAr?'نشط':'Active',value:absences.filter(a=>a.status==='active').length,color:S.red,bg:S.redB},
              {label:isAr?'ملغي':'Cancelled',value:absences.filter(a=>a.status==='cancelled').length,color:S.muted,bg:S.card},
            ].map((s,i)=>(
              <div key={i} style={{background:s.bg,borderRadius:12,padding:'14px 16px',border:`1px solid ${s.color}30`}}>
                <div style={{fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
                <div style={{fontSize:11,color:S.muted,marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>

          {absLoading ? <div style={{textAlign:'center',padding:60,color:S.muted}}>⏳</div>
          : absences.length===0 ? (
            <div style={{textAlign:'center',padding:60,background:S.navy2,borderRadius:16,border:`1px solid ${S.border}`}}>
              <div style={{fontSize:40,marginBottom:12}}>✅</div>
              <div style={{color:S.muted}}>{isAr?'لا يوجد غياب في هذه الفترة':'No absences in this period'}</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {absences.map((a:any)=>(
                <div key={a.id} style={{background:a.status==='cancelled'?S.card:S.navy2,borderRadius:14,border:`1px solid ${a.status==='cancelled'?S.border:'rgba(139,92,246,0.3)'}`,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,opacity:a.status==='cancelled'?0.6:1}}>
                  <div style={{display:'flex',gap:14,alignItems:'center',flex:1}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(139,92,246,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🚫</div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:S.white,marginBottom:2}}>{a.empName} {a.empNameEn} — {a.empDept}</div>
                      {a.notes&&<div style={{fontSize:12,color:S.muted,marginBottom:4}}>{a.notes}</div>}
                      <div style={{fontSize:11,color:S.muted}}>📅 {a.date} · {isAr?'بواسطة':'by'}: {a.creatorName}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                    <span style={{fontSize:11,fontWeight:700,color:a.status==='active'?'#8B5CF6':a.status==='submitted'?S.amber:S.muted,background:a.status==='active'?'rgba(139,92,246,0.12)':a.status==='submitted'?S.amberB:S.card,borderRadius:20,padding:'3px 12px'}}>
                      {a.status==='active'?(isAr?'غياب بدون عذر':'Unexcused'):a.status==='submitted'?(isAr?'بانتظار الاعتماد':'Pending Approval'):(isAr?'ملغي':'Cancelled')}
                    </span>
                    {a.status==='submitted'&&isDeptManager&&(
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>returnAbsence(a.id)} style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.amber}`,background:S.amberB,color:S.amber,cursor:'pointer',fontSize:11,fontFamily:'Tajawal, sans-serif'}}>↩️</button>
                        <button onClick={()=>approveAbsence(a.id)} style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.green}`,background:S.greenB,color:S.green,cursor:'pointer',fontSize:11,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>✅ {isAr?'اعتماد':'Approve'}</button>
                      </div>
                    )}
                    {a.status==='submitted'&&(isAdmin||isBranchManager)&&(
                      <button onClick={()=>approveAbsence(a.id)} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.green}`,background:S.greenB,color:S.green,cursor:'pointer',fontSize:11,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>✅ {isAr?'اعتماد':'Approve'}</button>
                    )}
                    {isAdmin&&a.status==='active'&&(
                      <button onClick={()=>cancelAbsence(a.id)} style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${S.muted}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:12,fontFamily:'Tajawal, sans-serif'}}>{isAr?'إلغاء':'Cancel'}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Absence Modal */}
          {showAbsAdd && (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
              <div style={{background:S.navy2,borderRadius:20,border:'1px solid rgba(139,92,246,0.4)',width:'100%',maxWidth:440,padding:28}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                  <h2 style={{color:'#8B5CF6',fontSize:17,fontWeight:800}}>🚫 {isAr?'تسجيل غياب بدون عذر':'Add Unexcused Absence'}</h2>
                  <button onClick={()=>setShowAbsAdd(false)} style={{background:'transparent',border:'none',color:S.muted,fontSize:20,cursor:'pointer'}}>✕</button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div>
                    <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>{isAr?'الموظف *':'Employee *'}</label>
                    <select style={{...inp,cursor:'pointer',background:S.navy3}} value={absForm.employee_id} onChange={e=>setAbsForm(p=>({...p,employee_id:e.target.value}))}>
                      <option value="">{isAr?'-- اختر الموظف --':'-- Select Employee --'}</option>
                      {absEmps.map(e=><option key={e.id} value={e.id}>{e.name} {e.name_en||''} — {e.department}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>{isAr?'التاريخ *':'Date *'}</label>
                    <input style={inp} type="date" value={absForm.date} onChange={e=>setAbsForm(p=>({...p,date:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>{isAr?'ملاحظات (اختياري)':'Notes (optional)'}</label>
                    <textarea style={{...inp,minHeight:70,resize:'none'} as React.CSSProperties} value={absForm.notes} onChange={e=>setAbsForm(p=>({...p,notes:e.target.value}))} placeholder={isAr?'أي ملاحظات...':'Any notes...'} />
                  </div>
                </div>
                <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowAbsAdd(false)} style={{padding:'10px 20px',borderRadius:10,border:`1px solid ${S.muted}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>{isAr?'إلغاء':'Cancel'}</button>
                  <button onClick={saveAbsence} disabled={absSaving} style={{padding:'10px 24px',borderRadius:10,border:'1px solid #8B5CF6',background:'rgba(139,92,246,0.12)',color:'#8B5CF6',cursor:absSaving?'not-allowed':'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                    {absSaving?'⏳':(isAr?'🚫 تسجيل الغياب':'🚫 Save Absence')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.red}40`, width: '100%', maxWidth: 480, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ color: S.red, fontSize: 17, fontWeight: 800 }}>⚠️ {isAr ? 'إضافة مخالفة' : 'Add Violation'}</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'الموظف *' : 'Employee *'}</label>
                <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
                  <option value="">{isAr ? '-- اختر الموظف --' : '-- Select Employee --'}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.name_en || ''}{(e as any).employee_number ? ` (#${(e as any).employee_number})` : ''} — {e.department || e.role}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'المبلغ (MYR) *' : 'Amount (MYR) *'}</label>
                  <input style={{ ...inp, direction: 'ltr' }} type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'التاريخ *' : 'Date *'}</label>
                  <input style={inp} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'سبب المخالفة *' : 'Reason *'}</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'none' } as React.CSSProperties} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder={isAr ? 'اشرح سبب المخالفة...' : 'Explain the violation reason...'} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'مرفق (صورة أو PDF)' : 'Attachment (image or PDF)'}</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} style={{ ...inp, cursor: 'pointer', fontSize: 12 }} />
                {attachmentFile && <div style={{ fontSize: 11, color: S.green, marginTop: 4 }}>✅ {attachmentFile.name}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳' : (isAr ? '⚠️ إضافة المخالفة' : '⚠️ Add Violation')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══ DEPT VIOLATIONS TAB ══ */}
      {activeTab === 'dept_violations' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <input style={{...inp,width:'auto'}} type="month" value={deptViolFilterMonth} onChange={e=>setDeptViolFilterMonth(e.target.value)} />
            {canSubmitDeptViolation && (
              <button onClick={()=>setShowDeptViolAdd(true)} style={{padding:'9px 18px',borderRadius:10,border:'1px solid #F97316',background:'rgba(249,115,22,0.12)',color:'#F97316',cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                ➕ {isAr?'إضافة مخالفة قسم':'Add Dept Violation'}
              </button>
            )}
          </div>

          {/* Notice for non-viewers */}
          {!canViewDeptViolations && canSubmitDeptViolation && (
            <div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:12,padding:'12px 18px',marginBottom:16,fontSize:13,color:'#F97316'}}>
              ℹ️ {isAr?'يمكنك رفع مخالفة القسم — يراها مدير الفرع ومدير النظام فقط.':'You can submit a department violation — visible only to the branch manager and system admin.'}
            </div>
          )}

          {/* Stats — visible only to branch manager / admin */}
          {canViewDeptViolations && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:20}}>
              {[
                {label:isAr?'إجمالي المخالفات':'Total',value:deptViolations.length,color:'#F97316',bg:'rgba(249,115,22,0.12)'},
              ].map((s,i)=>(
                <div key={i} style={{background:s.bg,borderRadius:12,padding:'14px 16px',border:`1px solid ${s.color}30`}}>
                  <div style={{fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
                  <div style={{fontSize:11,color:S.muted,marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* List — only for branch manager / admin */}
          {canViewDeptViolations && (
            deptViolLoading ? <div style={{textAlign:'center',padding:60,color:S.muted}}>⏳</div>
            : deptViolations.length === 0 ? (
              <div style={{textAlign:'center',padding:60,background:S.navy2,borderRadius:16,border:`1px solid ${S.border}`}}>
                <div style={{fontSize:40,marginBottom:12}}>✅</div>
                <div style={{color:S.muted}}>{isAr?'لا توجد مخالفات أقسام في هذه الفترة':'No department violations this period'}</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {deptViolations.map((v:any)=>(
                  <div key={v.id} style={{background:S.navy2,borderRadius:14,border:'1px solid rgba(249,115,22,0.25)',padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                    <div style={{display:'flex',gap:14,alignItems:'flex-start',flex:1}}>
                      <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(249,115,22,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🏢</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:'#F97316',marginBottom:4}}>{v.department}</div>
                        <div style={{fontSize:13,color:S.white,marginBottom:6,lineHeight:1.5}}>{v.reason}</div>
                        <div style={{fontSize:11,color:S.muted}}>📅 {v.date} · {isAr?'بواسطة':'by'}: {v.creatorName}</div>
                        {v.attachment_url && (
                          <div style={{marginTop:8}}>
                            {v.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={v.attachment_url} alt="مرفق" style={{maxWidth:200,maxHeight:120,borderRadius:8,border:`1px solid ${S.border}`,cursor:'pointer'}} onClick={()=>setDeptViolPreview(v.attachment_url)} />
                            ) : (
                              <a href={v.attachment_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:S.blue,display:'inline-flex',alignItems:'center',gap:4,background:S.blueB,borderRadius:8,padding:'4px 10px'}}>📎 {isAr?'عرض المرفق':'View Attachment'}</a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Image Preview */}
          {deptViolPreview && (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setDeptViolPreview(null)}>
              <div style={{position:'relative',maxWidth:'90vw',maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>setDeptViolPreview(null)} style={{position:'absolute',top:-16,right:-16,width:36,height:36,borderRadius:'50%',background:'#F97316',border:'none',color:'#fff',fontSize:18,cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>✕</button>
                <img src={deptViolPreview} alt="مرفق" style={{maxWidth:'85vw',maxHeight:'85vh',borderRadius:12,objectFit:'contain',boxShadow:'0 20px 60px rgba(0,0,0,0.8)'}} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Dept Violation Modal */}
      {showDeptViolAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:S.navy2,borderRadius:20,border:'1px solid rgba(249,115,22,0.4)',width:'100%',maxWidth:460,padding:28}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
              <h2 style={{color:'#F97316',fontSize:17,fontWeight:800}}>🏢 {isAr?'إضافة مخالفة قسم':'Add Department Violation'}</h2>
              <button onClick={()=>setShowDeptViolAdd(false)} style={{background:'transparent',border:'none',color:S.muted,fontSize:20,cursor:'pointer'}}>✕</button>
            </div>
            <div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.25)',borderRadius:10,padding:'10px 14px',marginBottom:18,fontSize:12,color:'#F97316'}}>
              🔒 {isAr?'هذه المخالفة سرية — لا يراها سوى مدير الفرع ومدير النظام':'Confidential — visible only to branch manager and system admin'}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>{isAr?'القسم *':'Department *'}</label>
                <select style={{...inp,cursor:'pointer',background:S.navy3}} value={deptViolForm.department} onChange={e=>setDeptViolForm(p=>({...p,department:e.target.value}))}>
                  <option value="">{isAr?'-- اختر القسم --':'-- Select Department --'}</option>
                  {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>{isAr?'التاريخ *':'Date *'}</label>
                <input style={inp} type="date" value={deptViolForm.date} onChange={e=>setDeptViolForm(p=>({...p,date:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>{isAr?'وصف المخالفة *':'Violation Description *'}</label>
                <textarea style={{...inp,minHeight:90,resize:'none'} as React.CSSProperties} value={deptViolForm.reason} onChange={e=>setDeptViolForm(p=>({...p,reason:e.target.value}))} placeholder={isAr?'اشرح المخالفة أو المشكلة بالتفصيل...':'Describe the violation in detail...'} />
              </div>
              <div>
                <label style={{fontSize:12,color:S.muted,display:'block',marginBottom:5}}>{isAr?'مرفق (صورة أو PDF) — اختياري':'Attachment (image or PDF) — optional'}</label>
                <input type="file" accept="image/*,.pdf" onChange={e=>setDeptViolFile(e.target.files?.[0]||null)} style={{...inp,cursor:'pointer',fontSize:12}} />
                {deptViolFile && <div style={{fontSize:11,color:S.green,marginTop:4}}>✅ {deptViolFile.name}</div>}
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:22,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowDeptViolAdd(false)} style={{padding:'10px 20px',borderRadius:10,border:`1px solid ${S.muted}`,background:'transparent',color:S.muted,cursor:'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif'}}>{isAr?'إلغاء':'Cancel'}</button>
              <button onClick={saveDeptViolation} disabled={deptViolSaving} style={{padding:'10px 24px',borderRadius:10,border:'1px solid #F97316',background:'rgba(249,115,22,0.12)',color:'#F97316',cursor:deptViolSaving?'not-allowed':'pointer',fontSize:13,fontFamily:'Tajawal, sans-serif',fontWeight:700}}>
                {deptViolSaving?'⏳':(isAr?'🏢 حفظ المخالفة':'🏢 Save Violation')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}