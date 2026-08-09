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
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type PayrollMonth = { id: string; month: number; year: number; status: string }
type PayrollRecord = {
  id?: string; payroll_month_id: string; employee_id: string
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
}
type Employee = { id: string; name: string; name_en?: string; employee_number?: string; role: string; department?: string; salary?: number; branches?: any }

function calcRecord(r: PayrollRecord) {
  const dailyRate   = r.basic_salary / (r.working_days || 30)
  const hourlyRate  = dailyRate / 8
  const earnedBase  = dailyRate * r.days_worked
  const overtimePay = (dailyRate * r.overtime_days) + (hourlyRate * r.overtime_hours)
  const totalAllowances = r.allowance_1 + r.allowance_2 + r.allowance_3
  const totalEarnings   = earnedBase + overtimePay + totalAllowances
  const absenceDed  = dailyRate * r.absence_days
  const lateRate    = 20 // 20 MYR per late hour
  const lateDed     = lateRate * r.late_hours
  const earlyDed    = hourlyRate * r.early_exit_hours
  const totalDeductions = absenceDed + lateDed + earlyDed + r.insurance + r.tax + r.deduction_1 + r.deduction_2 + r.deduction_3 + r.advance
  const netSalary   = totalEarnings - totalDeductions + r.carried_forward
  const amountDue   = netSalary > 0 ? netSalary : 0
  const balance     = amountDue - r.amount_paid
  return { dailyRate, hourlyRate, earnedBase, overtimePay, totalAllowances, totalEarnings, absenceDed, lateDed, earlyDed, totalDeductions, netSalary, amountDue, balance }
}


const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function MySalaryPage() {
  const sb = createClient()
  const { employee: currentUser } = useAuth()
  const myId = currentUser?.id || ''

  const [months, setMonths] = useState<PayrollMonth[]>([])
  const [selectedMonth, setSelectedMonth] = useState<PayrollMonth | null>(null)
  const [myRecord, setMyRecord] = useState<PayrollRecord | null>(null)
  const [myEmp, setMyEmp] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingRecord, setLoadingRecord] = useState(false)

  useEffect(() => {
    if (!myId) return
    Promise.all([
      sb.from('payroll_months').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
      sb.from('employees').select('id,name,name_en,employee_number,role,department,salary,branches(name)').eq('id', myId).single(),
    ]).then(([mo, emp]) => {
      setMonths(mo.data || [])
      setMyEmp(emp.data)
      setLoading(false)
    })
  }, [myId])

  useEffect(() => {
    if (!selectedMonth || !myId) { setMyRecord(null); return }
    setLoadingRecord(true)

    const monthStart = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`
    // ✅ Date.UTC بدل new Date() العادي — لكي الحساب لا يتأثر بتوقيت متصفح المستخدم المحلي (نفس باج monthEnd في صفحة الرواتب)
    const monthEnd = new Date(Date.UTC(selectedMonth.year, selectedMonth.month, 0)).toISOString().split('T')[0]

    Promise.all([
      sb.from('payroll_records').select('*').eq('payroll_month_id', selectedMonth.id).eq('employee_id', myId).maybeSingle(),
      sb.from('attendance').select('check_in_time,date').eq('employee_id', myId).not('check_in_time','is',null).gte('date', monthStart).lte('date', monthEnd),
      // ✅ لازم نجلب custom_start أيضاً — أغلب الموظفين عندهم شيفتات بأوقات مخصصة (بلا shift_id مرتبط بجدول shifts)،
      // وكان الكود يتجاهلها تماماً فيحسب تأخيرهم صفراً دائماً
      sb.from('shift_schedules').select('date,shift_id,custom_start,shifts(start_time)').eq('employee_id', myId).eq('status','confirmed').gte('date', monthStart).lte('date', monthEnd),
      sb.from('violations').select('amount').eq('employee_id', myId).eq('status','active').gte('date', monthStart).lte('date', monthEnd),
    ]).then(([recRes, attRes, schRes, violRes]) => {
      const record = recRes.data
      // احسب المخالفات النشطة فقط
      const activeViolationsTotal = (violRes.data || []).reduce((s: number, v: any) => s + (v.amount || 0), 0)
      const attData = attRes.data || []
      const schData = schRes.data || []

      // map الشيفتات حسب التاريخ — الوقت المخصص (custom_start) له الأولوية، ثم وقت الشيفت المسمّى من جدول shifts
      const schMap: Record<string, string> = {}
      for (const s of schData) {
        const startTime = s.custom_start || (s.shifts as any)?.start_time
        if (startTime) schMap[String(s.date).slice(0,10)] = startTime
      }

      // احسب إجمالي التأخير بالدقائق — نفس طريقة my-schedule
      let totalLateMinutes = 0
      for (const att of attData) {
        const dateStr = String(att.date).slice(0,10)
        const shiftStart = schMap[dateStr]
        if (!shiftStart) continue
        const checkIn = new Date(att.check_in_time)
        const [sh, sm] = shiftStart.split(':').map(Number)
        // وقت الشيفت بنفس يوم الحضور
        const scheduled = new Date(`${dateStr}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00`)
        const gracePeriod = 10 * 60 * 1000 // 10 دقائق
        const diffMs = checkIn.getTime() - (scheduled.getTime() + gracePeriod)
        if (diffMs > 0) totalLateMinutes += Math.floor(diffMs / 60000)
      }
      const lateHours = parseFloat((totalLateMinutes / 60).toFixed(2))

      if (record) {
        setMyRecord({ 
          ...record, 
          late_hours: lateHours,
          deduction_1: activeViolationsTotal,
          deduction_1_label: activeViolationsTotal > 0 ? `مخالفات (${activeViolationsTotal.toFixed(2)} MYR)` : 'Violations',
        })
      } else {
        setMyRecord(null)
      }
      setLoadingRecord(false)
    })
  }, [selectedMonth, myId])

  const c = myRecord ? calcRecord(myRecord) : null
  const netSalary = c?.netSalary || myEmp?.salary || 0
  const grossSalary = c?.totalEarnings || netSalary

  const earnings = myRecord ? [
    { label: 'الراتب الأساسي', value: myRecord.basic_salary || 0, color: S.green },
    { label: myRecord.allowance_1_label || 'بدل 1', value: myRecord.allowance_1 || 0, color: S.green },
    { label: myRecord.allowance_2_label || 'بدل 2', value: myRecord.allowance_2 || 0, color: S.green },
    { label: myRecord.allowance_3_label || 'بدل 3', value: myRecord.allowance_3 || 0, color: S.green },
    { label: 'أوفر تايم', value: c?.overtimePay || 0, color: S.green },
  ].filter(e => e.value > 0) : []

  const deductions = myRecord ? [
    { label: 'خصم الغياب', value: myRecord.absence_days > 0 ? (c?.absenceDed || 0) : 0, color: S.red },
    { label: 'خصم التأخير', value: myRecord.late_hours > 0 ? (c?.lateDed || 0) : 0, color: S.red },
    { label: 'سلفة', value: myRecord.advance || 0, color: S.amber },
    { label: myRecord.deduction_1_label || 'خصم 1', value: myRecord.deduction_1 || 0, color: S.red },
    { label: myRecord.deduction_2_label || 'خصم 2', value: myRecord.deduction_2 || 0, color: S.red },
    { label: myRecord.deduction_3_label || 'خصم 3', value: myRecord.deduction_3 || 0, color: S.red },
    { label: 'ضريبة', value: myRecord.tax || 0, color: S.red },
    { label: 'تأمين', value: myRecord.insurance || 0, color: S.red },
  ].filter(d => d.value > 0) : []

  const totalDeductions = deductions.reduce((s, d) => s + d.value, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'Tajawal, sans-serif' }}>
      <div style={{ textAlign: 'center', color: S.muted }}>⏳ جاري التحميل...</div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, maxWidth: 560, margin: '0 auto', padding: '0 4px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: S.white, marginBottom: 4 }}>💰 راتبي</h1>
        <p style={{ fontSize: 13, color: S.muted }}>تفاصيل راتبك الشهري</p>
      </div>

      {/* Month selector */}
      <div style={{ marginBottom: 20 }}>
        <select
          style={{ width: '100%', background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}
          value={selectedMonth?.id || ''}
          onChange={e => setSelectedMonth(months.find(m => m.id === e.target.value) || null)}
        >
          <option value="">-- اختر الشهر --</option>
          {months.map(m => (
            <option key={m.id} value={m.id}>{MONTHS_AR[m.month - 1]} {m.year}</option>
          ))}
        </select>
      </div>

      {!selectedMonth ? (
        <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ color: S.muted, fontSize: 14 }}>اختر الشهر لعرض راتبك</div>
        </div>
      ) : loadingRecord ? (
        <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : !myRecord ? (
        <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ color: S.muted, fontSize: 14 }}>لم يتم إصدار كشف راتب لهذا الشهر بعد</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Payslip Header */}
          <div style={{ background: `linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))`, border: `1px solid ${S.gold}40`, borderRadius: 18, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: S.gold3, border: `2px solid ${S.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: S.gold, flexShrink: 0 }}>
                {myEmp?.name?.charAt(0) || '؟'}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: S.white }}>{myEmp?.name} {myEmp?.name_en || ''}</div>
                <div style={{ fontSize: 12, color: S.muted }}>{myEmp?.employee_number} · {myEmp?.department}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{(myEmp?.branches as any)?.name}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>صافي الراتب — {MONTHS_AR[(selectedMonth.month || 1) - 1]} {selectedMonth.year}</div>
              <div style={{ fontSize: 38, fontWeight: 900, color: S.gold }}>MYR {netSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style={{ marginTop: 10 }}>
                <span style={{ background: selectedMonth.status === 'finalized' ? S.greenB : S.amberB, color: selectedMonth.status === 'finalized' ? S.green : S.amber, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>
                  {selectedMonth.status === 'finalized' ? '✅ معتمد' : selectedMonth.status === 'paid' ? '💳 مدفوع' : '📝 قيد المراجعة'}
                </span>
              </div>
            </div>
          </div>

          {/* Work Summary */}
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.muted, marginBottom: 12 }}>📊 ملخص العمل</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'أيام العمل', value: myRecord.working_days, color: S.blue },
                { label: 'أيام الحضور', value: myRecord.days_worked, color: S.green },
                { label: 'أيام الغياب', value: myRecord.absence_days, color: myRecord.absence_days > 0 ? S.red : S.muted },
                { label: 'تأخير (ساعة) 20 MYR', value: myRecord.late_hours, color: myRecord.late_hours > 0 ? S.amber : S.muted },
                { label: 'أوفر تايم', value: (myRecord.overtime_days || 0) + (myRecord.overtime_hours ? myRecord.overtime_hours / 8 : 0), color: S.purple },
                { label: 'رصيد سلفة', value: myRecord.advance_balance || 0, color: S.amber },
              ].map((item, i) => (
                <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{typeof item.value === 'number' ? item.value.toFixed(item.value % 1 !== 0 ? 1 : 0) : item.value}</div>
                  <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings */}
          {earnings.length > 0 && (
            <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.green }}>➕ الإضافات</div>
              {earnings.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < earnings.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                  <span style={{ fontSize: 13, color: S.white }}>{e.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: e.color }}>MYR {e.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(34,197,94,0.06)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>إجمالي الإضافات</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: S.green }}>MYR {grossSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Deductions */}
          {deductions.length > 0 && (
            <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.red }}>➖ الخصومات</div>
              {deductions.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < deductions.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                  <span style={{ fontSize: 13, color: S.white }}>{d.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: d.color }}>- MYR {d.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(239,68,68,0.06)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>إجمالي الخصومات</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: S.red }}>- MYR {totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Net Summary */}
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.gold}30`, overflow: 'hidden' }}>
            {[
              { label: 'الراتب الأساسي', value: myRecord.basic_salary || 0, color: S.white },
              { label: 'إجمالي الإضافات', value: grossSalary, color: S.green },
              { label: 'إجمالي الخصومات', value: totalDeductions, color: S.red, prefix: '-' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${S.border}` }}>
                <span style={{ fontSize: 13, color: S.muted }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.prefix || ''}MYR {row.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: S.gold3 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: S.white }}>💰 صافي الراتب</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: S.gold }}>MYR {netSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {myRecord.notes && (
            <div style={{ background: S.amberB, border: `1px solid ${S.amber}40`, borderRadius: 12, padding: '12px 16px', fontSize: 13, color: S.amber }}>
              📝 {myRecord.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
