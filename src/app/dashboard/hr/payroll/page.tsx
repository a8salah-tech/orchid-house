'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#FAFAF8',
  outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%',
  boxSizing: 'border-box', textAlign: 'right', direction: 'ltr',
}

type PayrollMonth = { id: string; month: number; year: number; status: string; notes?: string; created_at: string }
type Branch = { id: string; name: string }
type Employee = {
  id: string; name: string; name_en?: string; employee_number?: string
  role: string; department?: string; salary?: number; insurance?: number
  work_insurance?: number; branch_id?: string; branches?: { name: string } | any
}
type PayrollRecord = {
  id?: string; created_at?: string; payroll_month_id: string; employee_id: string
  basic_salary: number; insurance: number; working_days: number; days_worked: number
  overtime_days: number; overtime_hours: number
  allowance_1: number; allowance_1_label: string
  allowance_2: number; allowance_2_label: string
  allowance_3: number; allowance_3_label: string
  absence_days: number; late_hours: number; early_exit_hours: number
  tax: number
  deduction_1: number; deduction_1_label: string
  deduction_2: number; deduction_2_label: string
  deduction_3: number; deduction_3_label: string
  advance: number; advance_balance: number
  carried_forward: number
  amount_due: number; amount_paid: number
  work_insurance: number; notes?: string
  employees?: Employee
}

function emptyRecord(monthId: string, emp: Employee): PayrollRecord {
  return {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    payroll_month_id: monthId, employee_id: emp.id,
    basic_salary: emp.salary || 0, insurance: emp.insurance || 0,
    working_days: 30, days_worked: 30,
    overtime_days: 0, overtime_hours: 0,
    allowance_1: 0, allowance_1_label: 'Allowance 1',
    allowance_2: 0, allowance_2_label: 'Allowance 2',
    allowance_3: 0, allowance_3_label: 'Allowance 3',
    absence_days: 0, late_hours: 0, early_exit_hours: 0,
    tax: 0,
    deduction_1: 0, deduction_1_label: 'Deduction 1',
    deduction_2: 0, deduction_2_label: 'Deduction 2',
    deduction_3: 0, deduction_3_label: 'Deduction 3',
    advance: 0, advance_balance: 0, carried_forward: 0,
    amount_due: 0, amount_paid: 0,
    work_insurance: emp.work_insurance || 0,
  }
}

function calcRecord(r: PayrollRecord) {
  const dailyRate   = r.basic_salary / (r.working_days || 30)
  const hourlyRate  = dailyRate / 8
  const earnedBase  = dailyRate * r.days_worked
  const overtimePay = (dailyRate * r.overtime_days) + (hourlyRate * r.overtime_hours)
  const totalAllowances = r.allowance_1 + r.allowance_2 + r.allowance_3
  const totalEarnings   = earnedBase + overtimePay + totalAllowances
  const absenceDed  = dailyRate * r.absence_days
  const lateDed     = hourlyRate * r.late_hours
  const earlyDed    = hourlyRate * r.early_exit_hours
  const totalDeductions = absenceDed + lateDed + earlyDed + r.insurance + r.tax + r.deduction_1 + r.deduction_2 + r.deduction_3 + r.advance
  const netSalary   = totalEarnings - totalDeductions + r.carried_forward
  const amountDue   = netSalary > 0 ? netSalary : 0
  const balance     = amountDue - r.amount_paid
  return { dailyRate, hourlyRate, earnedBase, overtimePay, totalAllowances, totalEarnings, absenceDed, lateDed, earlyDed, totalDeductions, netSalary, amountDue, balance }
}

function Cell({ value, onChange, readOnly = false }: { value: any; onChange: (v: any) => void; readOnly?: boolean }) {
  return (
    <td style={{ padding: '4px 6px', border: `1px solid ${S.border}`, minWidth: 80 }}>
      <input
        style={{ ...inp, fontSize: 11, padding: '4px 6px', opacity: readOnly ? 0.6 : 1, cursor: readOnly ? 'default' : 'text' }}
        type="text" inputMode="decimal" value={value}
        readOnly={readOnly}
        onChange={e => {
          if (readOnly) return
          const v = e.target.value.replace(/[^\d.]/g, '')
          onChange(parseFloat(v) || 0)
        }}
      />
    </td>
  )
}

function PayrollRow({ record, empMap, onChange, readOnly = false }: {
  record: PayrollRecord
  empMap: Record<string, Employee>
  onChange: (updated: PayrollRecord) => void
  readOnly?: boolean
}) {
  const emp  = empMap[record.employee_id]
  const calc = calcRecord(record)
  const set  = (field: keyof PayrollRecord, val: any) => onChange({ ...record, [field]: val })
  const thStyle: React.CSSProperties = {
    padding: '6px 8px', fontSize: 11, color: S.white,
    background: 'rgba(255,255,255,0.02)', border: `1px solid ${S.border}`, whiteSpace: 'nowrap',
  }
  const fmt = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <tr>
      <td style={{ ...thStyle, color: S.muted, textAlign: 'center', minWidth: 30 }}>{emp?.employee_number || '—'}</td>
      <td style={{ ...thStyle, minWidth: 160 }}>
        <div style={{ fontWeight: 700, color: S.white, fontSize: 12 }}>{emp?.name} {emp?.name_en && <span style={{ color: S.muted, fontWeight: 400 }}>{emp.name_en}</span>}</div>
        <div style={{ fontSize: 10, color: S.muted }}>{emp?.department}</div>
      </td>
      <Cell value={record.basic_salary}     onChange={v => set('basic_salary', v)}     readOnly={readOnly} />
      <Cell value={record.insurance}        onChange={v => set('insurance', v)}        readOnly={readOnly} />
      <td style={{ ...thStyle, color: S.gold, textAlign: 'center', minWidth: 70 }}>{fmt(calc.dailyRate)}</td>
      <td style={{ ...thStyle, color: S.gold, textAlign: 'center', minWidth: 70 }}>{fmt(calc.hourlyRate)}</td>
      <Cell value={record.overtime_days}    onChange={v => set('overtime_days', v)}    readOnly={readOnly} />
      <Cell value={record.overtime_hours}   onChange={v => set('overtime_hours', v)}   readOnly={readOnly} />
      <Cell value={record.allowance_1}      onChange={v => set('allowance_1', v)}      readOnly={readOnly} />
      <Cell value={record.allowance_2}      onChange={v => set('allowance_2', v)}      readOnly={readOnly} />
      <Cell value={record.allowance_3}      onChange={v => set('allowance_3', v)}      readOnly={readOnly} />
      <td style={{ ...thStyle, color: S.green, fontWeight: 800, textAlign: 'center', minWidth: 90 }}>{fmt(calc.totalEarnings)}</td>
      <Cell value={record.absence_days}     onChange={v => set('absence_days', v)}     readOnly={readOnly} />
      <Cell value={record.late_hours}       onChange={v => set('late_hours', v)}       readOnly={readOnly} />
      <Cell value={record.early_exit_hours} onChange={v => set('early_exit_hours', v)} readOnly={readOnly} />
      <td style={{ ...thStyle, color: S.muted, textAlign: 'center' }}>{fmt(record.insurance)}</td>
      <Cell value={record.tax}              onChange={v => set('tax', v)}              readOnly={readOnly} />
      <Cell value={record.deduction_1}      onChange={v => set('deduction_1', v)}      readOnly={readOnly} />
      <Cell value={record.deduction_2}      onChange={v => set('deduction_2', v)}      readOnly={readOnly} />
      <Cell value={record.deduction_3}      onChange={v => set('deduction_3', v)}      readOnly={readOnly} />
      <td style={{ ...thStyle, color: S.red, fontWeight: 800, textAlign: 'center', minWidth: 90 }}>{fmt(calc.totalDeductions)}</td>
      <Cell value={record.advance}          onChange={v => set('advance', v)}          readOnly={readOnly} />
      <Cell value={record.advance_balance}  onChange={v => set('advance_balance', v)}  readOnly={readOnly} />
      <Cell value={record.carried_forward}  onChange={v => set('carried_forward', v)}  readOnly={readOnly} />
      <td style={{ ...thStyle, color: calc.netSalary >= 0 ? S.teal : S.red, fontWeight: 800, textAlign: 'center', minWidth: 90, fontSize: 13 }}>
        {fmt(calc.netSalary)}
      </td>
      <Cell value={record.amount_due}       onChange={v => set('amount_due', v)} />
      <Cell value={record.amount_paid}      onChange={v => set('amount_paid', v)} />
      <td style={{ ...thStyle, color: (record.amount_due - record.amount_paid) > 0 ? S.amber : S.green, fontWeight: 700, textAlign: 'center' }}>
        {fmt(record.amount_due - record.amount_paid)}
      </td>
      <Cell value={record.work_insurance}   onChange={v => set('work_insurance', v)} />
    </tr>
  )
}

export default function PayrollPage() {
  const sbRef = useRef(createClient())
  const sb    = sbRef.current
  const { employee: currentUser, permissions, hasPermission } = useAuth()
  const role = currentUser?.role || ''
  const isSuperAdmin = permissions?.all === true
  const isBranchManager = role === 'branch_manager'
  const isAdmin = isSuperAdmin
  const myId = currentUser?.id || ''

  const [months,        setMonths]        = useState<PayrollMonth[]>([])
  const [branches,      setBranches]      = useState<Branch[]>([])
  const [employees,     setEmployees]     = useState<Employee[]>([])
  const [selectedMonth, setSelectedMonth] = useState<PayrollMonth | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)  // ✅ الفرع المختار
  const [records,       setRecords]       = useState<PayrollRecord[]>([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [showNewMonth,  setShowNewMonth]  = useState(false)
  const [newMonth,      setNewMonth]      = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })
  const [search,        setSearch]        = useState('')

  const empMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [mo, em, br] = await Promise.all([
      sb.from('payroll_months').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
      (() => {
        let q = sb.from('employees').select('id,name,name_en,employee_number,role,department,salary,insurance,work_insurance,branch_id,branches(name)').eq('is_active', true).order('name')
        // فلتر حسب الدور
        if (!isSuperAdmin && isBranchManager) q = q.eq('branch_id', currentUser?.branch_id || '')
        else if (!isSuperAdmin && !isBranchManager) q = q.eq('id', myId)
        return q
      })(),
      sb.from('branches').select('id,name').eq('is_active', true).order('name'),
    ])
    setMonths(mo.data || [])
    setEmployees(em.data || [])
    setBranches(br.data || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function loadMonthRecords(month: PayrollMonth, branch?: Branch | null) {
    setSelectedMonth(month)
    setSelectedBranch(branch || null)

    let emps = employees
    if (emps.length === 0) {
      let q2 = sb.from('employees').select('id,name,name_en,employee_number,role,department,salary,insurance,work_insurance,branch_id,branches(name)').eq('is_active', true).order('name')
      if (!isSuperAdmin && isBranchManager) q2 = q2.eq('branch_id', currentUser?.branch_id || '')
      else if (!isSuperAdmin && !isBranchManager) q2 = q2.eq('id', myId)
      const { data } = await q2
      emps = data || []
      setEmployees(emps)
    }

    // ✅ فلتر موظفي الفرع المختار
    const filteredEmps = branch ? emps.filter(e => e.branch_id === branch.id) : emps

    const { data } = await sb.from('payroll_records')
      .select('*, employees(id,name,name_en,employee_number,role,department,salary,insurance,work_insurance,branch_id,branches(name))')
      .eq('payroll_month_id', month.id)

    // جيب المخالفات والغياب للشهر
    const monthStart = `${month.year}-${String(month.month).padStart(2,'0')}-01`
    const monthEnd   = new Date(month.year, month.month, 0).toISOString().split('T')[0]
    const empIds = filteredEmps.map(e => e.id)

    const [violRes, absRes] = await Promise.all([
      empIds.length > 0
        ? sb.from('violations').select('employee_id,amount').eq('status','active').gte('date',monthStart).lte('date',monthEnd).in('employee_id', empIds)
        : Promise.resolve({ data: [] }),
      empIds.length > 0
        ? sb.from('absences').select('employee_id').eq('status','active').gte('date',monthStart).lte('date',monthEnd).in('employee_id', empIds)
        : Promise.resolve({ data: [] }),
    ])

    // احسب خصم المخالفات والغياب لكل موظف
    const violMap: Record<string, number> = {}
    for (const v of (violRes.data || [])) {
      violMap[v.employee_id] = (violMap[v.employee_id] || 0) + (v.amount || 0)
    }
    const absMap: Record<string, number> = {}
    for (const a of (absRes.data || [])) {
      absMap[a.employee_id] = (absMap[a.employee_id] || 0) + 1
    }

    const existing    = (data || []).filter((r: any) => filteredEmps.some(e => e.id === r.employee_id))
    const existingIds = existing.map((r: any) => r.employee_id)
    const missing     = filteredEmps.filter(e => !existingIds.includes(e.id)).map(e => emptyRecord(month.id, e))

    // دمج المخالفات والغياب — دائماً بتحسب من الجداول مش من DB
    const allRecords = [...existing, ...missing].map((r: any) => {
      const emp = filteredEmps.find(e => e.id === r.employee_id)
      const baseSalary = emp?.salary || r.basic_salary || 0
      const dailyRate = baseSalary / 30
      const violAmount = violMap[r.employee_id] || 0
      const absDays = absMap[r.employee_id] || 0
      const absAmount = parseFloat((absDays * dailyRate).toFixed(2))
      return {
        ...r,
        basic_salary: baseSalary,
        deduction_1: violAmount,
        deduction_1_label: violAmount > 0 ? `مخالفات (${violAmount.toFixed(2)} MYR)` : 'Violations',
        deduction_2: absAmount,
        deduction_2_label: absDays > 0 ? `غياب بدون عذر (${absDays} يوم)` : 'Absences',
      }
    })
    setRecords(allRecords)

    // Auto-save violations and absences deductions
    const toAutoSave = allRecords
      .filter((r: any) => violMap[r.employee_id] > 0 || absMap[r.employee_id] > 0)
      .map((r: any) => {
        const calc = calcRecord(r)
        const { employees: _emp, ...cleanRecord } = r as any
        return { ...cleanRecord, amount_due: calc.amountDue, updated_at: new Date().toISOString() }
      })
    if (toAutoSave.length > 0) {
      await sb.from('payroll_records').upsert(toAutoSave, { onConflict: 'payroll_month_id,employee_id' })
    }
  }

  async function createMonth() {
    const { data, error } = await sb.from('payroll_months')
      .insert([{ month: newMonth.month, year: newMonth.year, status: 'draft' }])
      .select().single()
    if (error) { alert('Error: ' + error.message); return }
    await fetchAll()
    setShowNewMonth(false)
    loadMonthRecords(data)
  }

  async function saveAll() {
    if (!selectedMonth) return
    setSaving(true)
    const toUpsert = records.map(r => {
      const calc = calcRecord(r)
      const { employees: _e, ...clean } = r as any
      return { ...clean, amount_due: r.amount_due || calc.amountDue, updated_at: new Date().toISOString() }
    })
    const { error } = await sb.from('payroll_records').upsert(toUpsert, { onConflict: 'payroll_month_id,employee_id' })
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  async function finalizeMonth() {
    if (!selectedMonth) return
    if (!confirm('Are you sure you want to finalize this month?')) return
    await saveAll()
    await sb.from('payroll_months').update({ status: 'finalized', finalized_at: new Date().toISOString() }).eq('id', selectedMonth.id)
    fetchAll()
    setSelectedMonth(prev => prev ? { ...prev, status: 'finalized' } : null)
  }

  function printPayroll() {
    if (!selectedMonth) return
    const monthName = MONTHS[selectedMonth.month - 1]
    const fmt = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const totals = visibleRecords.reduce((acc, r) => {
      const c = calcRecord(r)
      return { earnings: acc.earnings + c.totalEarnings, deductions: acc.deductions + c.totalDeductions, net: acc.net + c.netSalary, paid: acc.paid + r.amount_paid }
    }, { earnings: 0, deductions: 0, net: 0, paid: 0 })

    const rows = visibleRecords.filter(r => empMap[r.employee_id]).map(r => {
      const e = empMap[r.employee_id]
      const c = calcRecord(r)
      return `<tr>
        <td>${e?.employee_number || '—'}</td>
        <td>${e?.name || '—'} ${e?.name_en || ''}</td>
        <td>${fmt(r.basic_salary)}</td><td>${fmt(r.insurance)}</td>
        <td>${fmt(c.dailyRate)}</td><td>${fmt(c.hourlyRate)}</td>
        <td>${r.overtime_days}</td><td>${r.overtime_hours}</td>
        <td>${fmt(r.allowance_1)}</td><td>${fmt(r.allowance_2)}</td><td>${fmt(r.allowance_3)}</td>
        <td style="font-weight:bold;color:#2e7d32">${fmt(c.totalEarnings)}</td>
        <td>${r.absence_days}</td><td>${r.late_hours}</td><td>${r.early_exit_hours}</td>
        <td>${fmt(r.insurance)}</td><td>${fmt(r.tax)}</td>
        <td>${fmt(r.deduction_1)}</td><td>${fmt(r.deduction_2)}</td><td>${fmt(r.deduction_3)}</td>
        <td style="font-weight:bold;color:#c62828">${fmt(c.totalDeductions)}</td>
        <td style="font-weight:bold;color:#0277bd">${fmt(c.netSalary)}</td>
        <td>${fmt(r.work_insurance)}</td>
      </tr>`
    }).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Payroll - ${monthName} ${selectedMonth.year}${selectedBranch ? ' - ' + selectedBranch.name : ''}</title>
    <style>body{font-family:Arial,sans-serif;font-size:10px;margin:10px;direction:rtl}h2{text-align:center;font-size:14px}h3{text-align:center;font-size:11px;color:#C9A84C}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#0A1628;color:white;padding:5px 4px;border:1px solid #333;text-align:center;white-space:nowrap}td{padding:4px;border:1px solid #ccc;text-align:center}tr:nth-child(even){background:#f9f9f9}.total-row{background:#fff8e1!important;font-weight:bold}@media print{@page{size:A3 landscape;margin:8mm}}</style>
    </head><body>
    <h2>🌸 Orchid House — Payroll Sheet</h2>
    <h3>${monthName} ${selectedMonth.year}${selectedBranch ? ' | ' + selectedBranch.name : ''}</h3>
    <table><thead><tr>
      <th>ID</th><th>Employee</th><th>Basic</th><th>Ins.</th><th>Daily</th><th>Hourly</th>
      <th>OT Days</th><th>OT Hrs</th><th>A1</th><th>A2</th><th>A3</th><th>Total Earn.</th>
      <th>Absent</th><th>Late</th><th>Early</th><th>Ins.</th><th>Tax</th>
      <th>D1</th><th>D2</th><th>D3</th><th>Total Ded.</th><th>Net</th><th>Work Ins.</th>
    </tr></thead><tbody>${rows}
    <tr class="total-row"><td colspan="11" style="text-align:right">TOTAL</td>
      <td>${fmt(totals.earnings)}</td><td colspan="8"></td>
      <td>${fmt(totals.deductions)}</td><td>${fmt(totals.net)}</td><td></td>
    </tr></tbody></table>
    <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:11px">
      <div>Prepared by: _______________</div>
      <div>Approved by: _______________</div>
      <div>Date: ${new Date().toLocaleDateString()}</div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const filteredRecords = useMemo(() => {
    if (!search) return records
    return records.filter(r => {
      const e = empMap[r.employee_id]
      return e?.name.includes(search) || (e?.name_en || '').toLowerCase().includes(search.toLowerCase()) || (e?.employee_number || '').includes(search)
    })
  }, [records, search, empMap])

  const visibleRecords = useMemo(() => {
    if (isAdmin) return filteredRecords
    // مدير قسم — يشوف رواتب موظفين قسمه بس مش راتبه هو
    const managerRoles = ['kitchen_manager','hall_manager','bar_manager','kitchen_supervisor','hall_supervisor','bar_supervisor','branch_manager']
    if (managerRoles.includes(currentUser?.role || '')) return filteredRecords.filter(r => r.employee_id !== currentUser?.id)
    // موظف عادي — يشوف راتبه بس
    return filteredRecords.filter(r => r.employee_id === currentUser?.id)
  }, [filteredRecords, isAdmin, currentUser?.id, currentUser?.role])

  const totals = useMemo(() => visibleRecords.reduce((acc, r) => {
    const c = calcRecord(r)
    return { earnings: acc.earnings + c.totalEarnings, deductions: acc.deductions + c.totalDeductions, net: acc.net + c.netSalary, paid: acc.paid + r.amount_paid, balance: acc.balance + (r.amount_due - r.amount_paid) }
  }, { earnings: 0, deductions: 0, net: 0, paid: 0, balance: 0 }), [visibleRecords])

  // ✅ إحصائيات كل فرع — admin و branch_manager فقط
  const branchStats = useMemo(() => {
    return branches.map(b => {
      const branchEmps = employees.filter(e => e.branch_id === b.id)
      const totalSalary = branchEmps.reduce((s, e) => s + (e.salary || 0), 0)
      return { branch: b, empCount: branchEmps.length, totalSalary }
    })
  }, [branches, employees])

  const thStyle: React.CSSProperties = {
    padding: '8px 6px', fontSize: 10, color: S.white, background: S.navy3,
    border: `1px solid ${S.border}`, whiteSpace: 'nowrap', textAlign: 'center',
    position: 'sticky', top: 0, zIndex: 10,
  }
  const thGroupStyle = (color: string): React.CSSProperties => ({ ...thStyle, background: color, fontSize: 9 })
  const fmt = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // حماية الصفحة — أي شخص يحاول الوصول يشوف راتبه فقط
  // DB security: Supabase RLS يجب أن يكون مفعّل


  // ── منع الوصول لغير المصرح لهم ──
  if (currentUser && !isSuperAdmin && !isBranchManager) {
    return (
      <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 64 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>غير مصرح بالوصول</div>
        <div style={{ fontSize: 14, color: '#8A9BB5', textAlign: 'center' }}>هذه الصفحة متاحة فقط لمدير النظام ومدير الفرع</div>
      </div>
    )
  }

    return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.2; }
        select option { background: #0F2040; color: #FAFAF8; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.4); border-radius: 3px; }
        .branch-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .branch-card { transition: all .2s; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: S.gold }}>💰 Payroll Management</h1>
        {selectedMonth && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: S.white, fontWeight: 700 }}>
              {MONTHS[selectedMonth.month - 1]} {selectedMonth.year}
              {selectedBranch && <span style={{ color: S.gold, marginRight: 8 }}> — {selectedBranch.name}</span>}
            </span>
            <span style={{ background: selectedMonth.status === 'finalized' ? S.greenB : S.amberB, color: selectedMonth.status === 'finalized' ? S.green : S.amber, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>
              {selectedMonth.status === 'finalized' ? '✅ Finalized' : '📝 Draft'}
            </span>
            <input style={{ ...inp, width: 180, fontSize: 12 }} placeholder="🔍 Search employee..." value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={printPayroll} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print</button>
            {isAdmin && selectedMonth.status !== 'finalized' && (
              <>
                <button onClick={saveAll} disabled={saving} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {saving ? '⏳...' : saved ? '✅ Saved!' : '💾 Save'}
                </button>
                <button onClick={finalizeMonth} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🔒 Finalize</button>
              </>
            )}
            <button onClick={() => { setSelectedMonth(null); setSelectedBranch(null) }} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>← Back</button>
          </div>
        )}
      </div>

      <div style={{ padding: 20 }}>

        {!selectedMonth ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: S.white, marginBottom: 4 }}>📅 Payroll Months</h2>
                <p style={{ fontSize: 12, color: S.muted }}>اختر الشهر ثم الفرع لعرض المرتبات</p>
              </div>
              {isAdmin && <button onClick={() => setShowNewMonth(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ New Month</button>}
            </div>

            {/* ✅ Branch Stats Cards */}
            {!loading && branches.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: S.white, marginBottom: 12 }}>🏪 ملخص الفروع</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                  {/* كل الفروع */}
                  <div
                    className="branch-card"
                    style={{ background: S.gold3, border: `1px solid rgba(201,168,76,0.3)`, borderRadius: 16, padding: '20px 22px', cursor: 'pointer' }}
                    onClick={() => months.length > 0 && loadMonthRecords(months[0], null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ fontSize: 28 }}>🌸</div>
                      <div style={{ background: 'rgba(201,168,76,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: S.gold, fontWeight: 700 }}>كل الفروع</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: S.gold, marginBottom: 4 }}>Orchid Group</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>👥 إجمالي الموظفين</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: S.white }}>{employees.length}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>💰 إجمالي المرتبات</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: S.green }}>
                          MYR {employees.reduce((s, e) => s + (e.salary || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* كل فرع على حدة */}
                  {branchStats.map(({ branch, empCount, totalSalary }) => (
                    <div
                      key={branch.id}
                      className="branch-card"
                      style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 16, padding: '20px 22px', cursor: 'pointer' }}
                      onClick={() => months.length > 0 && loadMonthRecords(months[0], branch)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div style={{ fontSize: 28 }}>🏪</div>
                        <div style={{ background: S.blueB, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: S.blue, fontWeight: 700 }}>فرع</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: S.white, marginBottom: 4 }}>{branch.name}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                        <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>👥 الموظفون</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: S.white }}>{empCount}</div>
                        </div>
                        <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>💰 المرتبات</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: S.green }}>
                            MYR {totalSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: S.border, margin: '24px 0' }} />
              </div>
            )}

            {/* New Month Modal */}
            {showNewMonth && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, padding: 28, width: 360 }}>
                  <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700, marginBottom: 20 }}>➕ New Payroll Month</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Month</label>
                      <select style={inp} value={newMonth.month} onChange={e => setNewMonth(p => ({ ...p, month: parseInt(e.target.value) }))}>
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Year</label>
                      <input style={inp} type="number" value={newMonth.year} onChange={e => setNewMonth(p => ({ ...p, year: parseInt(e.target.value) }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowNewMonth(false)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>Cancel</button>
                    <button onClick={createMonth} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ Create</button>
                  </div>
                </div>
              </div>
            )}

            {/* Months List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
            ) : months.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>No payroll months yet</div>
                <button onClick={() => setShowNewMonth(true)} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ Create First Month</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: S.muted, fontWeight: 700, marginBottom: 12 }}>📅 الأشهر — اضغط لعرض كل الموظفين أو اختر فرعاً من الأعلى</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                  {months.map(m => (
                    <div key={m.id}
                      style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${m.status === 'finalized' ? S.green + '40' : S.border}`, padding: '18px 20px', cursor: 'pointer', transition: 'all .2s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: S.white }}>{MONTHS[m.month - 1]}</div>
                          <div style={{ fontSize: 13, color: S.muted }}>{m.year}</div>
                        </div>
                        <span style={{ background: m.status === 'finalized' ? S.greenB : S.card2, color: m.status === 'finalized' ? S.green : S.muted, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                          {m.status === 'finalized' ? '✅' : '📝'} {m.status}
                        </span>
                      </div>
                      {/* أزرار الفروع داخل كل شهر */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        <button onClick={() => loadMonthRecords(m, null)}
                          style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                          🌸 كل الفروع
                        </button>
                        {branches.map(b => (
                          <button key={b.id} onClick={() => loadMonthRecords(m, b)}
                            style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                            🏪 {b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          /* PAYROLL TABLE */
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: isSuperAdmin ? 'Total Employees' : isBranchManager ? 'Branch Employees' : 'My Payroll', value: visibleRecords.length, color: S.white, icon: '👥' },
                { label: 'Total Earnings',   value: 'MYR ' + fmt(totals.earnings),   color: S.green,  icon: '📈' },
                { label: 'Total Deductions', value: 'MYR ' + fmt(totals.deductions), color: S.red,    icon: '📉' },
                { label: 'Net Payroll',      value: 'MYR ' + fmt(totals.net),        color: S.teal,   icon: '💰' },
                { label: 'Balance',          value: 'MYR ' + fmt(totals.balance),    color: totals.balance > 0 ? S.amber : S.green, icon: '⚖️' },
              ].map((s, i) => (
                <div key={i} style={{ background: S.navy2, borderRadius: 12, border: `1px solid ${S.border}`, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.icon} {s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 2000 }}>
                  <thead>
                    <tr>
                      <th colSpan={2} style={thStyle}>Employee</th>
                      <th colSpan={4} style={thGroupStyle('rgba(201,168,76,0.3)')}>Basic Info</th>
                      <th colSpan={6} style={thGroupStyle('rgba(34,197,94,0.2)')}>Earnings</th>
                      <th style={thGroupStyle('rgba(34,197,94,0.35)')}>Total Earnings</th>
                      <th colSpan={7} style={thGroupStyle('rgba(239,68,68,0.2)')}>Deductions</th>
                      <th style={thGroupStyle('rgba(239,68,68,0.35)')}>Total Ded.</th>
                      <th colSpan={3} style={thGroupStyle('rgba(245,158,11,0.2)')}>Advances</th>
                      <th style={thGroupStyle('rgba(20,184,166,0.4)')}>Net Salary</th>
                      <th colSpan={3} style={thGroupStyle('rgba(59,130,246,0.2)')}>Payment</th>
                      <th style={thGroupStyle('rgba(139,92,246,0.2)')}>Work Ins.</th>
                    </tr>
                    <tr>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Basic Salary</th>
                      <th style={thStyle}>Insurance</th>
                      <th style={thStyle}>Daily Rate</th>
                      <th style={thStyle}>Hourly Rate</th>
                      <th style={thStyle}>OT Days</th>
                      <th style={thStyle}>OT Hours</th>
                      <th style={thStyle}>Allow 1</th>
                      <th style={thStyle}>Allow 2</th>
                      <th style={thStyle}>Allow 3</th>
                      <th style={{ ...thStyle, background: 'rgba(34,197,94,0.35)' }}>Total</th>
                      <th style={thStyle}>Absence</th>
                      <th style={thStyle}>Late (h)</th>
                      <th style={thStyle}>Early Exit</th>
                      <th style={thStyle}>Insurance</th>
                      <th style={thStyle}>Tax</th>
                      <th style={thStyle}>Ded 1</th>
                      <th style={thStyle}>Ded 2</th>
                      <th style={thStyle}>Ded 3</th>
                      <th style={{ ...thStyle, background: 'rgba(239,68,68,0.35)' }}>Total</th>
                      <th style={thStyle}>Advance</th>
                      <th style={thStyle}>Adv Balance</th>
                      <th style={thStyle}>Carried Fwd</th>
                      <th style={{ ...thStyle, background: 'rgba(20,184,166,0.4)', color: S.teal }}>NET</th>
                      <th style={thStyle}>Due</th>
                      <th style={thStyle}>Paid</th>
                      <th style={thStyle}>Balance</th>
                      <th style={thStyle}>Work Ins.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map(r => (
                      <PayrollRow
                        key={r.employee_id}
                        record={r}
                        empMap={empMap}
                        readOnly={!isAdmin}
                        onChange={updated => setRecords(prev => prev.map(p => p.employee_id === updated.employee_id ? updated : p))}
                      />
                    ))}
                    <tr style={{ background: 'rgba(201,168,76,0.1)', fontWeight: 800 }}>
                      <td colSpan={11} style={{ padding: '10px 14px', border: `1px solid ${S.border}`, color: S.gold, fontSize: 13, textAlign: 'right' }}>TOTAL</td>
                      <td style={{ padding: '10px', border: `1px solid ${S.border}`, color: S.green, textAlign: 'center', fontSize: 13 }}>{fmt(totals.earnings)}</td>
                      <td colSpan={8} style={{ border: `1px solid ${S.border}` }} />
                      <td style={{ padding: '10px', border: `1px solid ${S.border}`, color: S.red, textAlign: 'center', fontSize: 13 }}>{fmt(totals.deductions)}</td>
                      <td colSpan={3} style={{ border: `1px solid ${S.border}` }} />
                      <td style={{ padding: '10px', border: `1px solid ${S.border}`, color: S.teal, textAlign: 'center', fontSize: 14 }}>{fmt(totals.net)}</td>
                      <td colSpan={2} style={{ border: `1px solid ${S.border}` }} />
                      <td style={{ padding: '10px', border: `1px solid ${S.border}`, color: totals.balance > 0 ? S.amber : S.green, textAlign: 'center', fontSize: 13 }}>{fmt(totals.balance)}</td>
                      <td style={{ border: `1px solid ${S.border}` }} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {selectedMonth.status !== 'finalized' && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={saveAll} disabled={saving} style={{ padding: '12px 28px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Payroll'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
