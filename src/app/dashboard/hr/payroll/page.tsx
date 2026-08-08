'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
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

// ✅ عرض عمودي "الرقم الوظيفي" و"الاسم" المثبّتين (Sticky) في جدول الرواتب — يُستخدمان في الهيدر والصفوف معاً
const ID_COL_W = 64
const NAME_COL_W = 190
// ✅ خصم ساعة التأخير: مبلغ ثابت لكل الموظفين (بالرينجت الماليزي) بدل ما يتحسب حسب راتب كل موظف
const LATE_HOUR_PENALTY = 20
// ✅ لون خلفية الصف عند تحديده (يجب أن يكون صلباً/Opaque في الأعمدة المثبّتة حتى لا يظهر تداخل مع الأعمدة الأخرى أثناء التمرير الأفقي)
const SELECTED_ROW_BG = '#152E59'
// ✅ خلفية صلبة (Opaque) لخلية "TOTAL" المثبّتة أفقياً في آخر صف بالجدول (نفس لون rgba(201,168,76,0.15) بس بدون شفافية)
const TOTAL_ROW_BG = '#222E41'
const SELECTED_ROW_BG_TRANSLUCENT = 'rgba(59,130,246,0.14)'

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#FAFAF8',
  outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%',
  boxSizing: 'border-box', textAlign: 'right', direction: 'ltr',
}

type PayrollMonth = { id: string; month: number; year: number; status: string; notes?: string; created_at: string }

// ✅ نفس منطق حساب حدود الشهر (Date.UTC) الذي صحّحنا بيه باج التوقيت المحلي — دالة موحّدة لكي نتجنب تكرار نفس الباج
function getMonthDateRange(month: { month: number; year: number }): { monthStart: string; monthEnd: string } {
  const monthStart = `${month.year}-${String(month.month).padStart(2, '0')}-01`
  const monthEnd = new Date(Date.UTC(month.year, month.month, 0)).toISOString().split('T')[0]
  return { monthStart, monthEnd }
}

// ✅ يحسب إحصائيات الحضور من سجلات attendance خام: عدد أيام البصمة، أعلى يوم حضور (بالساعات)، وأقل يوم حضور
type AttendanceStats = {
  checkinDays: number
  maxDay: { date: string; minutes: number } | null
  minDay: { date: string; minutes: number } | null
}
function computeAttendanceStats(rows: { date: string; check_in_time: string | null; check_out_time: string | null }[]): AttendanceStats {
  const checkinDays = rows.filter(r => r.check_in_time).length
  const withDuration = rows
    .filter(r => r.check_in_time && r.check_out_time)
    .map(r => ({ date: r.date, minutes: Math.floor((new Date(r.check_out_time!).getTime() - new Date(r.check_in_time!).getTime()) / 60000) }))
    .filter(r => r.minutes > 0)
  let maxDay: { date: string; minutes: number } | null = null
  let minDay: { date: string; minutes: number } | null = null
  for (const d of withDuration) {
    if (!maxDay || d.minutes > maxDay.minutes) maxDay = d
    if (!minDay || d.minutes < minDay.minutes) minDay = d
  }
  return { checkinDays, maxDay, minDay }
}
function fmtDuration(mins: number): string {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
type Branch = { id: string; name: string }
type Employee = {
  id: string; name: string; name_en?: string; employee_number?: string
  role: string; department?: string; salary?: number; insurance?: number
  work_insurance?: number; branch_id?: string; is_active?: boolean; deactivated_at?: string; branches?: { name: string } | any
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

// ✅ حساب الراتب بالتناسب حسب تاريخ إيقاف الموظف (deactivated_at) ومقارنته بالشهر الحالي
// monthStart/monthEnd بصيغة 'YYYY-MM-DD' (مقارنة نصية تعمل صحيح لأن الصيغة موحّدة)
function getMonthlySalaryInfo(emp: Employee, monthStart: string, monthEnd: string): { basicSalary: number; daysWorked: number | null; note: string | null } {
  // موظف نشط ولا توجد تاريخ إيقاف مسجل — راتب طبيعي بالكامل
  if (emp.is_active !== false && !emp.deactivated_at) {
    return { basicSalary: emp.salary || 0, daysWorked: null, note: null }
  }
  if (emp.deactivated_at) {
    if (emp.deactivated_at < monthStart) {
      // الشهر كامل بعد تاريخ الإيقاف — لا توجد راتب
      return { basicSalary: 0, daysWorked: 0, note: `⏸ موقوف عن العمل من ${emp.deactivated_at}` }
    }
    if (emp.deactivated_at > monthEnd) {
      // هذا الشهر كان قبل الإيقاف — كان نشط بالكامل، راتب طبيعي
      return { basicSalary: emp.salary || 0, daysWorked: null, note: null }
    }
    // شهر الإيقاف نفسه — تناسب حسب عدد الأيام الفعلية
    const dayOfMonth = parseInt(emp.deactivated_at.split('-')[2], 10)
    return {
      basicSalary: emp.salary || 0,
      daysWorked: dayOfMonth,
      note: `⏸ تم إيقاف الموظف بتاريخ ${emp.deactivated_at} — تم حساب الراتب لـ ${dayOfMonth} يوم فقط من هذا الشهر`,
    }
  }
  // موقوف (is_active = false) بدون تاريخ إيقاف مسجل (حالة قديمة قبل إضافة هذه الميزة) — أأمن نوقف الراتب من الآن
  return { basicSalary: 0, daysWorked: 0, note: '⏸ موظف موقوف عن العمل (بدون تاريخ إيقاف مسجل)' }
}

// ✅ بيحوّل لون شفاف (rgba) لنفس اللون لكن صلب (Opaque) بدمجه فوق خلفية أساسية —
// ضروري لأي عنصر Sticky (مثل رؤوس الجدول) لكي محتوى الصفوف الذي بيتمرر تحته ميظهرش شفاف من وراه
function solidOver(rgba: string, baseHex: string = '#0F2040'): string {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!m) return rgba
  const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10)
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1
  const baseR = parseInt(baseHex.slice(1, 3), 16)
  const baseG = parseInt(baseHex.slice(3, 5), 16)
  const baseB = parseInt(baseHex.slice(5, 7), 16)
  const mix = (base: number, c: number) => Math.round(base * (1 - a) + c * a)
  return `rgb(${mix(baseR, r)}, ${mix(baseG, g)}, ${mix(baseB, b)})`
}

function calcRecord(r: PayrollRecord) {
  const dailyRate   = r.basic_salary / (r.working_days || 30)
  const hourlyRate  = dailyRate / 8
  const earnedBase  = dailyRate * r.days_worked
  const overtimePay = (dailyRate * r.overtime_days) + (hourlyRate * r.overtime_hours)
  const totalAllowances = r.allowance_1 + r.allowance_2 + r.allowance_3
  const totalEarnings   = earnedBase + overtimePay + totalAllowances
  const absenceDed  = dailyRate * r.absence_days
  // ✅ خصم التأخير: مبلغ ثابت (LATE_HOUR_PENALTY) لكل ساعة تأخير، بغض النظر عن راتب الموظف
  const lateDed     = LATE_HOUR_PENALTY * r.late_hours
  const earlyDed    = hourlyRate * r.early_exit_hours
  const totalDeductions = absenceDed + lateDed + earlyDed + r.insurance + r.tax + r.deduction_1 + r.deduction_2 + r.deduction_3 + r.advance
  const netSalary   = totalEarnings - totalDeductions + r.carried_forward
  const amountDue   = netSalary > 0 ? netSalary : 0
  const balance     = amountDue - r.amount_paid
  return { dailyRate, hourlyRate, earnedBase, overtimePay, totalAllowances, totalEarnings, absenceDed, lateDed, earlyDed, totalDeductions, netSalary, amountDue, balance }
}

function Cell({ value, onChange, readOnly = false, extra, minWidth = 80 }: { value: any; onChange: (v: any) => void; readOnly?: boolean; extra?: React.ReactNode; minWidth?: number }) {
  // ✅ نص محلي منفصل عن الرقم الفعلي — يسمح بكتابة كسور عشرية ("200." أو "200,5") أثناء الكتابة
  // بدل ما القيمة تتحول لرقم فوراً وتمسح النقطة/الفاصلة الذي المستخدم بعد بيكتبها
  const [text, setText] = useState(String(value ?? 0))

  useEffect(() => {
    const parsedCurrent = parseFloat(text.replace(',', '.'))
    // نحدّث النص المحلي بس لو القيمة الجاية من خارج (record) اتغيّرت فعلاً عن الذي المستخدم كاتبه
    if (Number.isNaN(parsedCurrent) || parsedCurrent !== value) {
      setText(String(value ?? 0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <td style={{ padding: '4px 6px', border: `1px solid ${S.border}`, minWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          style={{ ...inp, fontSize: 11, padding: '4px 6px', opacity: readOnly ? 0.6 : 1, cursor: readOnly ? 'default' : 'text', flex: 1, minWidth: 46 }}
          type="text" inputMode="decimal" value={text}
          readOnly={readOnly}
          onChange={e => {
            if (readOnly) return
            // ✅ بنقبل أرقام + نقطة + فاصلة (بعض لوحات المفاتيح بتبعت فاصلة كفاصل عشري)
            const raw = e.target.value.replace(/[^\d.,]/g, '')
            setText(raw)
            const num = parseFloat(raw.replace(',', '.'))
            onChange(Number.isNaN(num) ? 0 : num)
          }}
          onBlur={() => {
            // تنظيف الشكل النهائي بعد ما المستخدم يخلّص الكتابة
            const num = parseFloat(text.replace(',', '.'))
            setText(String(Number.isNaN(num) ? 0 : num))
          }}
        />
        {extra}
      </div>
    </td>
  )
}

function PayrollRow({ record, empMap, onChange, onOpenPayslip, readOnly = false, selected = false, onSelect, isMobile = false }: {
  record: PayrollRecord
  empMap: Record<string, Employee>
  onChange: (updated: PayrollRecord) => void
  onOpenPayslip: (record: PayrollRecord) => void
  readOnly?: boolean
  selected?: boolean
  onSelect?: () => void
  isMobile?: boolean
}) {
  const emp  = empMap[record.employee_id]
  const calc = calcRecord(record)
  const set  = (field: keyof PayrollRecord, val: any) => onChange({ ...record, [field]: val })
  // ✅ يخزّن القيمة القديمة لـ "المدفوع" مؤقتاً لكي زر التراجع بعد "تحديد كمدفوع بالكامل"
  const [lastPaid, setLastPaid] = useState<number | null>(null)
  // ✅ نافذة تأكيد "دفع كامل" — تظهر في منتصف الشاشة بدل نافذة المتصفح الافتراضية
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false)
  const thStyle: React.CSSProperties = {
    padding: '6px 8px', fontSize: 11, color: S.white,
    background: 'rgba(255,255,255,0.02)', border: `1px solid ${S.border}`, whiteSpace: 'nowrap',
  }
  // ✅ عرض عمودي ID/الاسم أصغر على الموبايل لكي يسيبوا مساحة أكبر لباقي الأعمدة القابلة للتمرير
  const rowIdColW = isMobile ? 46 : ID_COL_W
  const rowNameColW = isMobile ? 120 : NAME_COL_W
  // ✅ خلفية صلبة (Opaque) للعمودين المثبّتين، تتغيّر عند تحديد الصف
  const stickyBg = selected ? SELECTED_ROW_BG : S.navy3
  const fmt = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
    <tr
      onClick={onSelect}
      style={{ cursor: onSelect ? 'pointer' : undefined, background: selected ? SELECTED_ROW_BG_TRANSLUCENT : undefined }}
    >
      <td style={{ ...thStyle, color: S.muted, textAlign: 'center', position: 'sticky', right: 0, zIndex: 2, width: rowIdColW, minWidth: rowIdColW, background: stickyBg }}>{emp?.employee_number || '—'}</td>
      <td style={{ ...thStyle, cursor: 'pointer', position: 'sticky', right: rowIdColW, zIndex: 2, width: rowNameColW, minWidth: rowNameColW, background: stickyBg }} onClick={e => { e.stopPropagation(); onOpenPayslip(record) }} title="اضغط لعرض تقرير الراتب التفصيلي">
        <div style={{ fontWeight: 700, color: S.gold, fontSize: isMobile ? 11 : 12, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
          {emp?.name} {emp?.name_en && <span style={{ color: S.muted, fontWeight: 400 }}>{emp.name_en}</span>}
        </div>
        <div style={{ fontSize: isMobile ? 9 : 10, color: S.muted }}>{emp?.department}</div>
        {record.notes && record.notes.startsWith('⏸') && (
          <div style={{ fontSize: 9, color: S.red, marginTop: 2, fontWeight: 700, whiteSpace: 'normal' }}>{record.notes}</div>
        )}
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
      <Cell
        value={record.amount_due}
        onChange={v => set('amount_due', v)}
        minWidth={110}
        extra={!readOnly && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); set('amount_due', calc.netSalary > 0 ? calc.netSalary : 0) }}
            title="مزامنة المستحق مع صافي الراتب المحسوب حالياً"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0 }}
          >🔄</button>
        )}
      />
      <Cell
        value={record.amount_paid}
        onChange={v => set('amount_paid', v)}
        minWidth={110}
        extra={!readOnly && (
          lastPaid === null ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setConfirmPaidOpen(true) }}
              title="تحديد الموظف كمدفوع بالكامل (يساوي المستحق)"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0 }}
            >✅</button>
          ) : (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                set('amount_paid', lastPaid)
                setLastPaid(null)
              }}
              title="تراجع عن آخر تحديد (رجّع القيمة القديمة)"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0 }}
            >↩️</button>
          )
        )}
      />
      <td style={{ ...thStyle, color: (record.amount_due - record.amount_paid) > 0 ? S.amber : S.green, fontWeight: 700, textAlign: 'center' }}>
        {fmt(record.amount_due - record.amount_paid)}
      </td>
      <Cell value={record.work_insurance}   onChange={v => set('work_insurance', v)} />
    </tr>
    {/* ✅ نافذة تأكيد "دفع كامل" — Portal في منتصف الشاشة بدل نافذة المتصفح الافتراضية */}
    {confirmPaidOpen && typeof document !== 'undefined' && createPortal(
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
        onClick={() => setConfirmPaidOpen(false)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 14, padding: 24, minWidth: 320, maxWidth: '90vw', textAlign: 'center', fontFamily: 'Tajawal, sans-serif', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
        >
          <div style={{ fontSize: 15, color: S.white, marginBottom: 20, lineHeight: 1.8 }}>
            تأكيد: تحديد <b style={{ color: S.gold }}>{emp?.name || 'الموظف'}</b> كمدفوع بالكامل ({fmt(record.amount_due)})؟
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => {
                setLastPaid(record.amount_paid)
                set('amount_paid', record.amount_due)
                setConfirmPaidOpen(false)
              }}
              style={{ padding: '8px 22px', borderRadius: 10, border: `1px solid ${S.teal}`, background: 'rgba(20,184,166,0.15)', color: S.teal, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}
            >تأكيد</button>
            <button
              onClick={() => setConfirmPaidOpen(false)}
              style={{ padding: '8px 22px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
            >إلغاء</button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}

function buildPayslipHTML(record: PayrollRecord, emp: Employee | undefined, monthName: string, year: number, attStats?: AttendanceStats | null, scheduleInfo?: { leaveDates: string[]; absentDates: string[] } | null): string {
  const c = calcRecord(record)
  const fmt = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const row = (label: string, value: string, bold = false) => `
    <tr><td class="lbl">${label}</td><td class="val" style="${bold ? 'font-weight:800' : ''}">${value}</td></tr>`
  return `
  <div class="payslip">
    <div class="payslip-header">
      <div class="brand">🌸 Orchid House</div>
      <div class="title">Payslip — قسيمة راتب</div>
      <div class="period">${monthName} ${year}</div>
      ${record.notes && record.notes.startsWith('⏸') ? `<div style="margin-top:6px;color:#c62828;font-weight:800;font-size:11px">${record.notes}</div>` : ''}
    </div>
    <table class="emp-info">
      <tr>
        <td class="lbl">الاسم / Name</td><td class="val">${emp?.name || '—'} ${emp?.name_en || ''}</td>
        <td class="lbl">الرقم الوظيفي / ID</td><td class="val">${emp?.employee_number || '—'}</td>
      </tr>
      <tr>
        <td class="lbl">القسم / Department</td><td class="val">${emp?.department || '—'}</td>
        <td class="lbl">الفرع / Branch</td><td class="val">${(emp?.branches as any)?.name || '—'}</td>
      </tr>
      <tr>
        <td class="lbl">الوظيفة / Role</td><td class="val">${emp?.role || '—'}</td>
        <td class="lbl">أيام العمل / Working Days</td><td class="val">${record.working_days} (${record.days_worked} ايام مُنجزة)</td>
      </tr>
    </table>

    <div class="cols">
      <table class="section">
        <thead><tr><th colspan="2">💰 الاستحقاقات / Earnings</th></tr></thead>
        <tbody>
          ${row('الراتب الأساسي / Basic Salary', fmt(record.basic_salary))}
          ${row('سعر اليوم / Daily Rate', fmt(c.dailyRate))}
          ${row('سعر الساعة / Hourly Rate', fmt(c.hourlyRate))}
          ${row('المستحق الأساسي / Earned Base', fmt(c.earnedBase))}
          ${row('أيام إضافي / OT Days', String(record.overtime_days))}
          ${row('ساعات إضافي / OT Hours', String(record.overtime_hours))}
          ${row('بدل إضافي / Overtime Pay', fmt(c.overtimePay))}
          ${record.allowance_1 > 0 ? row(record.allowance_1_label || 'Allowance 1', fmt(record.allowance_1)) : ''}
          ${record.allowance_2 > 0 ? row(record.allowance_2_label || 'Allowance 2', fmt(record.allowance_2)) : ''}
          ${record.allowance_3 > 0 ? row(record.allowance_3_label || 'Allowance 3', fmt(record.allowance_3)) : ''}
          ${row('إجمالي الاستحقاقات / Total Earnings', fmt(c.totalEarnings), true)}
        </tbody>
      </table>

      <table class="section">
        <thead><tr><th colspan="2">📉 الاستقطاعات / Deductions</th></tr></thead>
        <tbody>
          ${row('غياب يدوي إضافي / Additional Manual Absence', `${record.absence_days} (${fmt(c.absenceDed)})`)}
          ${row('تأخير (ساعات) / Late Hours', `${record.late_hours} (${fmt(c.lateDed)})`)}
          ${row('خروج مبكر / Early Exit (h)', `${record.early_exit_hours} (${fmt(c.earlyDed)})`)}
          ${row('التأمينات / Insurance', fmt(record.insurance))}
          ${row('الضريبة / Tax', fmt(record.tax))}
          ${record.deduction_1 > 0 ? row(record.deduction_1_label || 'Deduction 1', fmt(record.deduction_1)) : ''}
          ${record.deduction_2 > 0 ? row(record.deduction_2_label || 'Deduction 2', fmt(record.deduction_2)) : ''}
          ${record.deduction_3 > 0 ? row(record.deduction_3_label || 'Deduction 3', fmt(record.deduction_3)) : ''}
          ${record.advance > 0 ? row('سلفة / Advance', fmt(record.advance)) : ''}
          ${row('إجمالي الاستقطاعات / Total Deductions', fmt(c.totalDeductions), true)}
        </tbody>
      </table>
    </div>

    <table class="summary">
      <tr>
        <td class="lbl">المرحّل من شهر سابق / Carried Forward</td><td class="val">${fmt(record.carried_forward)}</td>
        <td class="lbl">رصيد السلفة / Advance Balance</td><td class="val">${fmt(record.advance_balance)}</td>
      </tr>
      <tr class="net-row">
        <td class="lbl">صافي الراتب / NET SALARY</td><td class="val net">${fmt(c.netSalary)}</td>
        <td class="lbl">المبلغ المستحق / Amount Due</td><td class="val">${fmt(record.amount_due || c.amountDue)}</td>
      </tr>
      <tr>
        <td class="lbl">المبلغ المدفوع / Amount Paid</td><td class="val">${fmt(record.amount_paid)}</td>
        <td class="lbl">الرصيد المتبقي / Balance</td><td class="val">${fmt((record.amount_due || c.amountDue) - record.amount_paid)}</td>
      </tr>
      <tr>
        <td class="lbl">تأمين العمل / Work Insurance</td><td class="val">${fmt(record.work_insurance)}</td>
        <td class="lbl"></td><td class="val"></td>
      </tr>
    </table>

    ${attStats ? `
    <table class="summary" style="margin-top:10px">
      <tr><td class="lbl" colspan="4" style="background:#FAF7ED;font-weight:800;text-align:center">🕒 ملخص البصمة / Attendance Summary</td></tr>
      <tr>
        <td class="lbl">أيام البصمة / Days Checked In</td><td class="val">${attStats.checkinDays}</td>
        <td class="lbl">أعلى يوم حضور / Best Day</td><td class="val">${attStats.maxDay ? `${attStats.maxDay.date} (${fmtDuration(attStats.maxDay.minutes)})` : '—'}</td>
      </tr>
      <tr>
        <td class="lbl">أقل يوم حضور / Lowest Day</td><td class="val">${attStats.minDay ? `${attStats.minDay.date} (${fmtDuration(attStats.minDay.minutes)})` : '—'}</td>
        <td class="lbl"></td><td class="val"></td>
      </tr>
    </table>` : ''}

    ${scheduleInfo && (scheduleInfo.leaveDates.length > 0 || scheduleInfo.absentDates.length > 0) ? `
    <table class="summary" style="margin-top:10px">
      ${scheduleInfo.leaveDates.length > 0 ? `
      <tr><td class="lbl" colspan="4" style="background:#FAF7ED;font-weight:800;text-align:center">🗓️ أيام الإجازة الرسمية / Official Leave Days (${scheduleInfo.leaveDates.length})</td></tr>
      <tr><td class="val" colspan="4" style="text-align:right">${scheduleInfo.leaveDates.join('، ')}</td></tr>
      ` : ''}
      ${scheduleInfo.absentDates.length > 0 ? `
      <tr><td class="lbl" colspan="4" style="background:#FDEAEA;font-weight:800;text-align:center;color:#DC2626">❌ أيام الغياب الفعلية (مخصومة) / Unauthorized Absence Days (${scheduleInfo.absentDates.length})</td></tr>
      <tr><td class="val" colspan="4" style="text-align:right">${scheduleInfo.absentDates.join('، ')}</td></tr>
      ` : ''}
    </table>` : ''}

    <div class="signatures">
      <div>توقيع الموظف / Employee Signature: ____________________</div>
      <div>توقيع الإدارة / Approved by: ____________________</div>
    </div>
  </div>`
}

const PAYSLIP_PRINT_STYLE = `
  body{font-family:Arial,sans-serif;font-size:12px;margin:0;direction:rtl;color:#0A1628}
  .payslip{padding:18mm 14mm;page-break-after:always}
  .payslip:last-child{page-break-after:auto}
  .payslip-header{text-align:center;border-bottom:2px solid #C9A84C;padding-bottom:10px;margin-bottom:14px}
  .payslip-header .brand{font-size:18px;font-weight:900;color:#0A1628}
  .payslip-header .title{font-size:13px;color:#555;margin-top:2px}
  .payslip-header .period{font-size:12px;color:#C9A84C;font-weight:700;margin-top:4px}
  table.emp-info{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px}
  table.emp-info td{padding:6px 8px;border:1px solid #ddd}
  .cols{display:flex;gap:12px;margin-bottom:14px}
  table.section{flex:1;border-collapse:collapse;font-size:11px}
  table.section th{background:#0A1628;color:#fff;padding:7px;text-align:center;font-size:11px}
  table.section td{padding:5px 8px;border:1px solid #ddd}
  table.summary{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:18px}
  table.summary td{padding:7px 8px;border:1px solid #ddd}
  .net-row{background:#fff8e1}
  .net-row .net{font-weight:900;font-size:14px;color:#0277bd}
  .lbl{color:#555;width:25%}
  .val{font-weight:600;text-align:left;direction:ltr}
  .signatures{display:flex;justify-content:space-between;font-size:11px;margin-top:20px}
  @media print{@page{size:A4;margin:0}}
`

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
  const [payslipRecord, setPayslipRecord] = useState<PayrollRecord | null>(null)
  // ✅ إحصائيات البصمة (أيام البصمة، أعلى/أقل يوم حضور) لتقرير الراتب المفتوح حالياً
  const [payslipAttStats, setPayslipAttStats] = useState<AttendanceStats | null>(null)
  const [loadingPayslipAtt, setLoadingPayslipAtt] = useState(false)
  // ✅ تفاصيل الإجازات الرسمية وأيام الغياب الفعلية (بتواريخها) لتقرير الراتب المفتوح حالياً
  const [payslipScheduleInfo, setPayslipScheduleInfo] = useState<{ leaveDates: string[]; absentDates: string[] } | null>(null)

  useEffect(() => {
    if (!payslipRecord || !selectedMonth) { setPayslipAttStats(null); setPayslipScheduleInfo(null); return }
    let cancelled = false
    setLoadingPayslipAtt(true)
    const { monthStart, monthEnd } = getMonthDateRange(selectedMonth)
    Promise.all([
      sb.from('attendance').select('date,check_in_time,check_out_time')
        .eq('employee_id', payslipRecord.employee_id)
        .gte('date', monthStart).lte('date', monthEnd),
      // ✅ الشيفتات المجدولة فعلياً لهذا الموظف هذا الشهر — لكي نفصل أيام الإجازة الرسمية عن أيام الغياب الحقيقية
      sb.from('shift_schedules').select('date,shift_id,custom_start')
        .eq('employee_id', payslipRecord.employee_id)
        .eq('status', 'confirmed')
        .gte('date', monthStart).lte('date', monthEnd),
    ]).then(([attRes, schedRes]) => {
      if (cancelled) return
      const attRows = attRes.data || []
      setPayslipAttStats(computeAttendanceStats(attRows))

      const attendedDates = new Set(attRows.filter(r => r.check_in_time).map(r => String(r.date).slice(0, 10)))
      const leaveDates: string[] = []
      const workDates: string[] = []
      for (const s of (schedRes.data || [])) {
        const d = String(s.date).slice(0, 10)
        if (!s.shift_id && !s.custom_start) leaveDates.push(d)
        else workDates.push(d)
      }
      const absentDates = workDates.filter(d => !attendedDates.has(d)).sort()
      leaveDates.sort()
      setPayslipScheduleInfo({ leaveDates, absentDates })
      setLoadingPayslipAtt(false)
    })
    return () => { cancelled = true }
  }, [payslipRecord?.employee_id, selectedMonth?.id])
  // ✅ الموظف المحدد حالياً في الجدول (لتمييزه بلون مختلف)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  // ✅ ارتفاع صف الهيدر الأول الحقيقي (بيتقاس فعلياً من DOM، ليس رقم ثابت مخمّن) — لكي صف الهيدر الثاني
  // يتثبّت تحته بالظبط بدون أي تراكب، مهما اختلف حجم الخط أو التفاف النص
  const headerRow1Ref = useRef<HTMLTableRowElement>(null)
  const [headerRow1H, setHeaderRow1H] = useState(31)
  useEffect(() => {
    if (headerRow1Ref.current) setHeaderRow1H(headerRow1Ref.current.getBoundingClientRect().height)
  }, [])

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const empMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [mo, em, br] = await Promise.all([
      sb.from('payroll_months').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
      (() => {
        let q = sb.from('employees').select('id,name,name_en,employee_number,role,department,salary,insurance,work_insurance,branch_id,is_active,deactivated_at,branches(name)').order('name')
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
      let q2 = sb.from('employees').select('id,name,name_en,employee_number,role,department,salary,insurance,work_insurance,branch_id,is_active,deactivated_at,branches(name)').order('name')
      if (!isSuperAdmin && isBranchManager) q2 = q2.eq('branch_id', currentUser?.branch_id || '')
      else if (!isSuperAdmin && !isBranchManager) q2 = q2.eq('id', myId)
      const { data } = await q2
      emps = data || []
      setEmployees(emps)
    }

    // ✅ حساب بداية ونهاية الشهر أولاً لكي نقدر نستخدمهم في الفلترة
    const monthStart = `${month.year}-${String(month.month).padStart(2,'0')}-01`
    // ✅ لازم نستخدم Date.UTC هنا بدل new Date() العادي — لكي الحساب ميتأثرش بتوقيت متصفح الأدمن المحلي
    // (لو اتحسب بالتوقيت المحلي وبعدين اتحول لـ UTC، ممكن يقتطع آخر يوم في الشهر ويفوّت بيانات حضور/تأخير حقيقية)
    const monthEnd   = new Date(Date.UTC(month.year, month.month, 0)).toISOString().split('T')[0]

    // ✅ فلتر موظفي الفرع المختار + استبعاد أي موظف كان متوقف بالكامل قبل بداية هذا الشهر
    // (لو اتوقف داخل الشهر نفسه، بيفضل ظاهر لكي راتبه المتناسب لحد يوم التوقف)
    const filteredEmps = emps.filter(e => {
      if (branch && e.branch_id !== branch.id) return false
      if (e.deactivated_at && e.deactivated_at < monthStart) return false
      if (e.is_active === false && !e.deactivated_at) return false
      return true
    })

    const { data } = await sb.from('payroll_records')
      .select('*, employees(id,name,name_en,employee_number,role,department,salary,insurance,work_insurance,branch_id,branches(name))')
      .eq('payroll_month_id', month.id)

    const empIds = filteredEmps.map(e => e.id)

    // ✅ جلب سجلات الحضور على دفعات (Pagination) — Supabase بيحدّ أي select بـ 1000 صف افتراضياً،
    // وممكن يتخطى الـ 1000 بسهولة مع أكتر من 200 موظف × 31 يوم، فكنا بنفوّت جزء كبير من البيانات من غير ما نلاحظ
    async function fetchAllAttendanceRows(): Promise<{ employee_id: string; date: string; check_in_time: string | null; late_minutes: number }[]> {
      if (empIds.length === 0) return []
      const PAGE_SIZE = 1000
      let all: { employee_id: string; date: string; check_in_time: string | null; late_minutes: number }[] = []
      let page = 0
      while (true) {
        const { data: batch } = await sb.from('attendance')
          .select('employee_id,date,check_in_time,late_minutes')
          .gte('date', monthStart).lte('date', monthEnd)
          .in('employee_id', empIds)
          .order('id')
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
        if (!batch || batch.length === 0) break
        all = all.concat(batch as any)
        if (batch.length < PAGE_SIZE) break
        page++
      }
      return all
    }

    // ✅ الشيفتات المجدولة فعلياً لكل موظف هذا الشهر — لكي نحسب الغياب تلقائياً (شيفت مجدول ولم يُسجَّل له حضور)
    // بنفس منطق أدوات "كشف الغياب" و"فحص صحة الحضور" في صفحة الحضور والانصراف، بدون أي تدخل يدوي
    async function fetchAllShiftSchedules(): Promise<{ employee_id: string; date: string; shift_id: string | null; custom_start: string | null }[]> {
      if (empIds.length === 0) return []
      const PAGE_SIZE = 1000
      let all: { employee_id: string; date: string; shift_id: string | null; custom_start: string | null }[] = []
      let page = 0
      while (true) {
        const { data: batch } = await sb.from('shift_schedules')
          .select('employee_id,date,shift_id,custom_start')
          .eq('status', 'confirmed')
          .gte('date', monthStart).lte('date', monthEnd)
          .in('employee_id', empIds)
          .order('id')
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
        if (!batch || batch.length === 0) break
        all = all.concat(batch as any)
        if (batch.length < PAGE_SIZE) break
        page++
      }
      return all
    }

    const [violRes, absRes, attendanceRows, scheduleRows] = await Promise.all([
      empIds.length > 0
        ? sb.from('violations').select('employee_id,amount').eq('status','active').gte('date',monthStart).lte('date',monthEnd).in('employee_id', empIds)
        : Promise.resolve({ data: [] }),
      empIds.length > 0
        ? sb.from('absences').select('employee_id').eq('status','active').gte('date',monthStart).lte('date',monthEnd).in('employee_id', empIds)
        : Promise.resolve({ data: [] }),
      fetchAllAttendanceRows(),
      fetchAllShiftSchedules(),
    ])

    // احسب خصم المخالفات والغياب لكل موظف
    const violMap: Record<string, number> = {}
    for (const v of (violRes.data || [])) {
      violMap[v.employee_id] = (violMap[v.employee_id] || 0) + (v.amount || 0)
    }
    const manualAbsMap: Record<string, number> = {}
    for (const a of (absRes.data || [])) {
      manualAbsMap[a.employee_id] = (manualAbsMap[a.employee_id] || 0) + 1
    }
    // ✅ إجمالي دقائق التأخير لكل موظف خلال الشهر من جدول الحضور — محوّلة لساعات
    const lateMap: Record<string, number> = {}
    for (const a of attendanceRows) {
      lateMap[a.employee_id] = (lateMap[a.employee_id] || 0) + (a.late_minutes || 0)
    }

    // ✅ الغياب التلقائي: شيفت مجدول (بعد استبعاد أيام الإجازة) ولم يُسجَّل له حضور فعلي —
    // نفس منطق أدوات "كشف الغياب" و"فحص صحة الحضور" في صفحة الحضور، لكن هنا يُحتسب مباشرة بلا أي مراجعة يدوية
    const attendedDateSet = new Set(
      attendanceRows.filter(a => a.check_in_time).map(a => `${a.employee_id}|${String(a.date).slice(0, 10)}`)
    )
    const scheduledByEmp: Record<string, Set<string>> = {}
    for (const s of scheduleRows) {
      if (!s.shift_id && !s.custom_start) continue // يوم إجازة رسمية — مستبعد من الحساب
      const d = String(s.date).slice(0, 10)
      if (!scheduledByEmp[s.employee_id]) scheduledByEmp[s.employee_id] = new Set()
      scheduledByEmp[s.employee_id].add(d)
    }
    const autoAbsMap: Record<string, number> = {}
    for (const employeeId of Object.keys(scheduledByEmp)) {
      let count = 0
      for (const d of scheduledByEmp[employeeId]) {
        if (!attendedDateSet.has(`${employeeId}|${d}`)) count++
      }
      autoAbsMap[employeeId] = count
    }
    // ✅ نأخذ الأكبر بين الغياب المُسجَّل يدوياً من قبل (مخالفات مثلاً) والغياب المُحتسَب تلقائياً من الجدول،
    // لكي لا نفقد أي سجل غياب سابق غير مرتبط بشيفت مجدول
    const absMap: Record<string, number> = {}
    for (const id of new Set([...Object.keys(manualAbsMap), ...Object.keys(autoAbsMap)])) {
      absMap[id] = Math.max(manualAbsMap[id] || 0, autoAbsMap[id] || 0)
    }

    const existing    = (data || []).filter((r: any) => filteredEmps.some(e => e.id === r.employee_id))
    const existingIds = existing.map((r: any) => r.employee_id)
    const missing     = filteredEmps.filter(e => !existingIds.includes(e.id)).map(e => emptyRecord(month.id, e))

    // دمج المخالفات والغياب — دائماً بتحسب من الجداول ليس من DB
    const allRecords = [...existing, ...missing].map((r: any) => {
      const emp = filteredEmps.find(e => e.id === r.employee_id)
      // ✅ تناسب الراتب حسب تاريخ إيقاف الموظف (لو موجود) ومقارنته بشهر الجرد الحالي
      const salaryInfo = emp ? getMonthlySalaryInfo(emp, monthStart, monthEnd) : { basicSalary: r.basic_salary || 0, daysWorked: null, note: null }
      const baseSalary = salaryInfo.basicSalary
      const dailyRate = baseSalary / 30
      const violAmount = violMap[r.employee_id] || 0
      const absDays = absMap[r.employee_id] || 0
      const absAmount = parseFloat((absDays * dailyRate).toFixed(2))
      const lateHrs = parseFloat(((lateMap[r.employee_id] || 0) / 60).toFixed(2))
      return {
        ...r,
        basic_salary: baseSalary,
        days_worked: salaryInfo.daysWorked !== null ? salaryInfo.daysWorked : r.days_worked,
        notes: salaryInfo.note || r.notes,
        late_hours: lateHrs,
        deduction_1: violAmount,
        deduction_1_label: violAmount > 0 ? `مخالفات (${violAmount.toFixed(2)} MYR)` : 'Violations',
        deduction_2: absAmount,
        deduction_2_label: absDays > 0 ? `غياب بدون عذر (${absDays} يوم)` : 'Absences',
      }
    })
    setRecords(allRecords)

    // Auto-save violations and absences deductions
    const toAutoSave = allRecords
      .filter((r: any) => violMap[r.employee_id] > 0 || absMap[r.employee_id] > 0 || lateMap[r.employee_id] > 0)
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

  function printSinglePayslip(record: PayrollRecord) {
    if (!selectedMonth) return
    const emp = empMap[record.employee_id]
    const monthName = MONTHS[selectedMonth.month - 1]
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Payslip - ${emp?.name || ''} - ${monthName} ${selectedMonth.year}</title>
    <style>${PAYSLIP_PRINT_STYLE}</style>
    </head><body>
    ${buildPayslipHTML(record, emp, monthName, selectedMonth.year, payslipAttStats, payslipScheduleInfo)}
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  async function printAllPayslips() {
    if (!selectedMonth) return
    const monthName = MONTHS[selectedMonth.month - 1]
    const win = window.open('', '_blank')
    if (!win) return

    // ✅ نجيب بصمة كل الموظفين مرة واحدة (Pagination-safe) بدل ما نستعلم لكل موظف لوحده
    const { monthStart, monthEnd } = getMonthDateRange(selectedMonth)
    const PAGE_SIZE = 1000
    let attRows: { employee_id: string; date: string; check_in_time: string | null; check_out_time: string | null }[] = []
    let page = 0
    while (true) {
      const { data } = await sb.from('attendance')
        .select('employee_id,date,check_in_time,check_out_time')
        .gte('date', monthStart).lte('date', monthEnd)
        .order('id').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (!data || data.length === 0) break
      attRows = attRows.concat(data)
      if (data.length < PAGE_SIZE) break
      page++
    }
    const attByEmp: Record<string, typeof attRows> = {}
    for (const a of attRows) {
      if (!attByEmp[a.employee_id]) attByEmp[a.employee_id] = []
      attByEmp[a.employee_id].push(a)
    }

    // ✅ نجيب الشيفتات المجدولة لكل الموظفين مرة واحدة كذلك — لفصل أيام الإجازة عن أيام الغياب الفعلية في كل قسيمة
    let schedRows: { employee_id: string; date: string; shift_id: string | null; custom_start: string | null }[] = []
    page = 0
    while (true) {
      const { data } = await sb.from('shift_schedules')
        .select('employee_id,date,shift_id,custom_start')
        .eq('status', 'confirmed')
        .gte('date', monthStart).lte('date', monthEnd)
        .order('id').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (!data || data.length === 0) break
      schedRows = schedRows.concat(data)
      if (data.length < PAGE_SIZE) break
      page++
    }
    function buildScheduleInfo(employeeId: string) {
      const attendedDates = new Set((attByEmp[employeeId] || []).filter(a => a.check_in_time).map(a => String(a.date).slice(0, 10)))
      const leaveDates: string[] = []
      const workDates: string[] = []
      for (const s of schedRows) {
        if (s.employee_id !== employeeId) continue
        const d = String(s.date).slice(0, 10)
        if (!s.shift_id && !s.custom_start) leaveDates.push(d)
        else workDates.push(d)
      }
      return { leaveDates: leaveDates.sort(), absentDates: workDates.filter(d => !attendedDates.has(d)).sort() }
    }

    const allHTML = visibleRecords.filter(r => empMap[r.employee_id]).map(r =>
      buildPayslipHTML(r, empMap[r.employee_id], monthName, selectedMonth.year, computeAttendanceStats(attByEmp[r.employee_id] || []), buildScheduleInfo(r.employee_id))
    ).join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Payslips - ${monthName} ${selectedMonth.year}${selectedBranch ? ' - ' + selectedBranch.name : ''}</title>
    <style>${PAYSLIP_PRINT_STYLE}</style>
    </head><body>
    ${allHTML}
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
    // مدير قسم — يشوف رواتب موظفين قسمه بس ليس راتبه هو
    const managerRoles = ['kitchen_manager','hall_manager','bar_manager','kitchen_supervisor','hall_supervisor','bar_supervisor','branch_manager']
    if (managerRoles.includes(currentUser?.role || '')) return filteredRecords.filter(r => r.employee_id !== currentUser?.id)
    // موظف عادي — يشوف راتبه بس
    return filteredRecords.filter(r => r.employee_id === currentUser?.id)
  }, [filteredRecords, isAdmin, currentUser?.id, currentUser?.role])

  // ✅ إجماليات شاملة لكل عمود رقمي في الجدول — تُستخدم في صف TOTAL أسفل الجدول
  const totals = useMemo(() => visibleRecords.reduce((acc, r) => {
    const c = calcRecord(r)
    return {
      basicSalary: acc.basicSalary + r.basic_salary,
      insurance: acc.insurance + r.insurance,
      otDays: acc.otDays + r.overtime_days,
      otHours: acc.otHours + r.overtime_hours,
      allowance1: acc.allowance1 + r.allowance_1,
      allowance2: acc.allowance2 + r.allowance_2,
      allowance3: acc.allowance3 + r.allowance_3,
      earnings: acc.earnings + c.totalEarnings,
      absenceDays: acc.absenceDays + r.absence_days,
      lateHours: acc.lateHours + r.late_hours,
      earlyExitHours: acc.earlyExitHours + r.early_exit_hours,
      tax: acc.tax + r.tax,
      ded1: acc.ded1 + r.deduction_1,
      ded2: acc.ded2 + r.deduction_2,
      ded3: acc.ded3 + r.deduction_3,
      deductions: acc.deductions + c.totalDeductions,
      advance: acc.advance + r.advance,
      advanceBalance: acc.advanceBalance + r.advance_balance,
      carriedForward: acc.carriedForward + r.carried_forward,
      net: acc.net + c.netSalary,
      due: acc.due + r.amount_due,
      paid: acc.paid + r.amount_paid,
      balance: acc.balance + (r.amount_due - r.amount_paid),
      workInsurance: acc.workInsurance + r.work_insurance,
    }
  }, {
    basicSalary: 0, insurance: 0, otDays: 0, otHours: 0, allowance1: 0, allowance2: 0, allowance3: 0,
    earnings: 0, absenceDays: 0, lateHours: 0, earlyExitHours: 0, tax: 0, ded1: 0, ded2: 0, ded3: 0,
    deductions: 0, advance: 0, advanceBalance: 0, carriedForward: 0, net: 0, due: 0, paid: 0, balance: 0, workInsurance: 0,
  }), [visibleRecords])

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
  const thGroupStyle = (color: string): React.CSSProperties => ({ ...thStyle, background: solidOver(color), fontSize: 9 })
  // ✅ نسخة من thStyle لصف الهيدر الثاني — نفس الشكل بالظبط، بس تثبيتها الرأسي يبدأ من تحت الصف الأول (بالارتفاع المقاس فعلياً)
  const thStyleRow2: React.CSSProperties = { ...thStyle, top: headerRow1H }
  // ✅ رؤوس الأعمدة المثبّتة أفقياً أيضاً (ID / Name) — zIndex أعلى لكي تفضل فوق باقي الرؤوس والصفوف وقت التمرير الأفقي
  // ✅ نفس منطق تصغير عرض العمودين على الموبايل المستخدم في PayrollRow، لكي الهيدر يطابق الصفوف بالظبط
  const headerIdColW = isMobile ? 46 : ID_COL_W
  const headerNameColW = isMobile ? 120 : NAME_COL_W
  const stickyIdHeaderStyle: React.CSSProperties = { ...thStyleRow2, position: 'sticky', right: 0, zIndex: 20, width: headerIdColW, minWidth: headerIdColW }
  const stickyNameHeaderStyle: React.CSSProperties = { ...thStyleRow2, position: 'sticky', right: headerIdColW, zIndex: 20, width: headerNameColW, minWidth: headerNameColW }
  const stickyGroupHeaderStyle: React.CSSProperties = { ...thStyle, position: 'sticky', right: 0, zIndex: 20, width: headerIdColW + headerNameColW, minWidth: headerIdColW + headerNameColW }
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
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: isMobile ? '12px 14px' : '0 24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', height: isMobile ? 'auto' : 60, gap: isMobile ? 12 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: 10 }}>
          <h1 style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, color: S.gold, margin: 0 }}>💰 Payroll Management</h1>
          {isMobile && selectedMonth && (
            <span style={{ fontSize: 11, color: S.white, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {MONTHS[selectedMonth.month - 1]} {selectedMonth.year}
            </span>
          )}
        </div>
        {selectedMonth && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 10 : 10, marginLeft: isMobile ? 0 : 'auto', width: isMobile ? '100%' : undefined }}>
            {/* الشهر + حالة Draft/Finalized — على الموبايل الشهر ظاهر أصلاً فوق جنب العنوان، فهنا بنعرض البادچ بس */}
            {!isMobile && (
              <span style={{ fontSize: 13, color: S.white, fontWeight: 700 }}>
                {MONTHS[selectedMonth.month - 1]} {selectedMonth.year}
                {selectedBranch && <span style={{ color: S.gold, marginRight: 8 }}> — {selectedBranch.name}</span>}
              </span>
            )}
            <span style={{ background: selectedMonth.status === 'finalized' ? S.greenB : S.amberB, color: selectedMonth.status === 'finalized' ? S.green : S.amber, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, alignSelf: isMobile ? 'flex-start' : undefined }}>
              {selectedMonth.status === 'finalized' ? '✅ Finalized' : '📝 Draft'}
            </span>
            {isMobile && selectedBranch && (
              <span style={{ fontSize: 12, color: S.gold }}>{selectedBranch.name}</span>
            )}
            <input style={{ ...inp, width: isMobile ? '100%' : 180, fontSize: 12 }} placeholder="🔍 Search employee..." value={search} onChange={e => setSearch(e.target.value)} />

            {/* ✅ الأزرار: Grid منظّم بعمودين على الموبايل بدل flex-wrap العشوائي، صف واحد على الديسكتوب */}
            <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : undefined, gap: isMobile ? 8 : 10 }}>
              <button
                onClick={() => loadMonthRecords(selectedMonth, selectedBranch)}
                title="إعادة سحب البيانات من جداول الحضور/المخالفات/الغياب من جديد (مفيد بعد أي تعديل في صفحة الحضور)"
                style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}
              >🔄 Refresh</button>
              <button onClick={printPayroll} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print Sheet</button>
              <button onClick={printAllPayslips} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📄 Print All Payslips</button>
              {isAdmin && selectedMonth.status !== 'finalized' && (
                <>
                  <button onClick={saveAll} disabled={saving} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    {saving ? '⏳...' : saved ? '✅ Saved!' : '💾 Save'}
                  </button>
                  <button onClick={finalizeMonth} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🔒 Finalize</button>
                </>
              )}
              <button onClick={() => { setSelectedMonth(null); setSelectedBranch(null) }} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', gridColumn: isMobile ? '1 / -1' : undefined }}>← Back</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: isMobile ? 12 : 20 }}>

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
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
                    <tr ref={headerRow1Ref}>
                      <th colSpan={2} style={stickyGroupHeaderStyle}>Employee</th>
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
                      <th style={stickyIdHeaderStyle}>ID</th>
                      <th style={stickyNameHeaderStyle}>Name</th>
                      <th style={thStyleRow2}>Basic Salary</th>
                      <th style={thStyleRow2}>Insurance</th>
                      <th style={thStyleRow2}>Daily Rate</th>
                      <th style={thStyleRow2}>Hourly Rate</th>
                      <th style={thStyleRow2}>OT Days</th>
                      <th style={thStyleRow2}>OT Hours</th>
                      <th style={thStyleRow2}>Allow 1</th>
                      <th style={thStyleRow2}>Allow 2</th>
                      <th style={thStyleRow2}>Allow 3</th>
                      <th style={{ ...thStyleRow2, background: solidOver('rgba(34,197,94,0.35)') }}>Total</th>
                      <th style={thStyleRow2}>Absence</th>
                      <th style={thStyleRow2} title="يُحسب تلقائيًا من بيانات الحضور (late_minutes)">⏱️ Late (h) 🔄</th>
                      <th style={thStyleRow2}>Early Exit</th>
                      <th style={thStyleRow2}>Insurance</th>
                      <th style={thStyleRow2}>Tax</th>
                      <th style={thStyleRow2}>Ded 1</th>
                      <th style={thStyleRow2}>Ded 2</th>
                      <th style={thStyleRow2}>Ded 3</th>
                      <th style={{ ...thStyleRow2, background: solidOver('rgba(239,68,68,0.35)') }}>Total</th>
                      <th style={thStyleRow2}>Advance</th>
                      <th style={thStyleRow2}>Adv Balance</th>
                      <th style={thStyleRow2}>Carried Fwd</th>
                      <th style={{ ...thStyleRow2, background: solidOver('rgba(20,184,166,0.4)'), color: S.teal }}>NET</th>
                      <th style={thStyleRow2}>Due</th>
                      <th style={thStyleRow2}>Paid</th>
                      <th style={thStyleRow2}>Balance</th>
                      <th style={thStyleRow2}>Work Ins.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map(r => (
                      <PayrollRow
                        key={r.employee_id}
                        record={r}
                        empMap={empMap}
                        readOnly={!isAdmin}
                        onOpenPayslip={setPayslipRecord}
                        onChange={updated => setRecords(prev => prev.map(p => p.employee_id === updated.employee_id ? updated : p))}
                        selected={r.employee_id === selectedEmployeeId}
                        onSelect={() => setSelectedEmployeeId(prev => prev === r.employee_id ? null : r.employee_id)}
                        isMobile={isMobile}
                      />
                    ))}
                    <tr style={{ background: 'rgba(201,168,76,0.15)', fontWeight: 800 }}>
                      <td colSpan={2} style={{ padding: '10px 8px', border: `1px solid ${S.border}`, color: S.gold, fontSize: 13, textAlign: 'center', position: 'sticky', right: 0, zIndex: 5, width: headerIdColW + headerNameColW, minWidth: headerIdColW + headerNameColW, background: TOTAL_ROW_BG }}>TOTAL</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.basicSalary)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.insurance)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12, color: S.muted }}>—</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12, color: S.muted }}>—</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.otDays)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.otHours)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.allowance1)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.allowance2)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.allowance3)}</td>
                      <td style={{ padding: '10px', border: `1px solid ${S.border}`, color: S.green, textAlign: 'center', fontSize: 13 }}>{fmt(totals.earnings)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.absenceDays)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.lateHours)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.earlyExitHours)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.insurance)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.tax)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.ded1)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.ded2)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.ded3)}</td>
                      <td style={{ padding: '10px', border: `1px solid ${S.border}`, color: S.red, textAlign: 'center', fontSize: 13 }}>{fmt(totals.deductions)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.advance)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.advanceBalance)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.carriedForward)}</td>
                      <td style={{ padding: '10px', border: `1px solid ${S.border}`, color: S.teal, textAlign: 'center', fontSize: 14 }}>{fmt(totals.net)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.due)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.paid)}</td>
                      <td style={{ padding: '10px', border: `1px solid ${S.border}`, color: totals.balance > 0 ? S.amber : S.green, textAlign: 'center', fontSize: 13 }}>{fmt(totals.balance)}</td>
                      <td style={{ padding: '8px', border: `1px solid ${S.border}`, textAlign: 'center', fontSize: 12 }}>{fmt(totals.workInsurance)}</td>
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
      {/* Payslip Detail Modal */}
      {payslipRecord && selectedMonth && (() => {
        const emp = empMap[payslipRecord.employee_id]
        const c = calcRecord(payslipRecord)
        const fmt2 = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const monthName = MONTHS[selectedMonth.month - 1]
        const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${S.border}`, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>📋 تقرير الراتب — {emp?.name} {emp?.name_en}</div>
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 3 }}>{monthName} {selectedMonth.year} · {emp?.employee_number || '—'} · {emp?.department}</div>
                  {payslipRecord.notes && payslipRecord.notes.startsWith('⏸') && (
                    <div style={{ marginTop: 6, display: 'inline-block', background: S.redB, color: S.red, borderRadius: 10, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{payslipRecord.notes}</div>
                  )}
                </div>
                <button onClick={() => setPayslipRecord(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S.green, marginBottom: 8 }}>💰 الاستحقاقات</div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>الراتب الأساسي</span><span>{fmt2(payslipRecord.basic_salary)}</span></div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>سعر اليوم</span><span>{fmt2(c.dailyRate)}</span></div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>سعر الساعة</span><span>{fmt2(c.hourlyRate)}</span></div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>أيام/ساعات إضافي</span><span>{payslipRecord.overtime_days}d / {payslipRecord.overtime_hours}h</span></div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>بدل إضافي</span><span>{fmt2(c.overtimePay)}</span></div>
                    {payslipRecord.allowance_1 > 0 && <div style={rowStyle}><span style={{ color: S.muted }}>{payslipRecord.allowance_1_label}</span><span>{fmt2(payslipRecord.allowance_1)}</span></div>}
                    {payslipRecord.allowance_2 > 0 && <div style={rowStyle}><span style={{ color: S.muted }}>{payslipRecord.allowance_2_label}</span><span>{fmt2(payslipRecord.allowance_2)}</span></div>}
                    {payslipRecord.allowance_3 > 0 && <div style={rowStyle}><span style={{ color: S.muted }}>{payslipRecord.allowance_3_label}</span><span>{fmt2(payslipRecord.allowance_3)}</span></div>}
                    <div style={{ ...rowStyle, fontWeight: 800, color: S.green, borderBottom: 'none' }}><span>إجمالي الاستحقاقات</span><span>{fmt2(c.totalEarnings)}</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S.red, marginBottom: 8 }}>📉 الاستقطاعات</div>
                    <div style={rowStyle}>
                    <span style={{ color: S.muted }}>
                      غياب يدوي إضافي ({payslipRecord.absence_days} يوم)
                      <span style={{ display: 'block', fontSize: 9, color: S.muted, opacity: 0.7 }}>(منفصل عن "غياب بدون عذر" أدناه، المُحتسَب تلقائياً من نظام الحضور)</span>
                    </span>
                    <span>{fmt2(c.absenceDed)}</span>
                  </div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>تأخير ({payslipRecord.late_hours} س)</span><span>{fmt2(c.lateDed)}</span></div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>خروج مبكر ({payslipRecord.early_exit_hours} س)</span><span>{fmt2(c.earlyDed)}</span></div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>التأمينات</span><span>{fmt2(payslipRecord.insurance)}</span></div>
                    <div style={rowStyle}><span style={{ color: S.muted }}>الضريبة</span><span>{fmt2(payslipRecord.tax)}</span></div>
                    {payslipRecord.deduction_1 > 0 && <div style={rowStyle}><span style={{ color: S.muted }}>{payslipRecord.deduction_1_label}</span><span>{fmt2(payslipRecord.deduction_1)}</span></div>}
                    {payslipRecord.deduction_2 > 0 && <div style={rowStyle}><span style={{ color: S.muted }}>{payslipRecord.deduction_2_label}</span><span>{fmt2(payslipRecord.deduction_2)}</span></div>}
                    {payslipRecord.deduction_3 > 0 && <div style={rowStyle}><span style={{ color: S.muted }}>{payslipRecord.deduction_3_label}</span><span>{fmt2(payslipRecord.deduction_3)}</span></div>}
                    {payslipRecord.advance > 0 && <div style={rowStyle}><span style={{ color: S.muted }}>سلفة</span><span>{fmt2(payslipRecord.advance)}</span></div>}
                    <div style={{ ...rowStyle, fontWeight: 800, color: S.red, borderBottom: 'none' }}><span>إجمالي الاستقطاعات</span><span>{fmt2(c.totalDeductions)}</span></div>
                  </div>
                </div>

                <div style={{ marginTop: 18, background: S.gold3, border: `1px solid ${S.gold}40`, borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900, color: S.teal, marginBottom: 8 }}>
                    <span>صافي الراتب NET</span><span>MYR {fmt2(c.netSalary)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.muted }}>
                    <span>مدفوع: {fmt2(payslipRecord.amount_paid)}</span>
                    <span>الرصيد: {fmt2((payslipRecord.amount_due || c.amountDue) - payslipRecord.amount_paid)}</span>
                  </div>
                </div>

                {/* ✅ ملخص البصمة — أيام البصمة، أعلى وأقل يوم حضور */}
                <div style={{ marginTop: 18, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: S.blue, marginBottom: 10 }}>🕒 ملخص البصمة</div>
                  {loadingPayslipAtt ? (
                    <div style={{ fontSize: 12, color: S.muted }}>⏳ جاري التحميل...</div>
                  ) : payslipAttStats && payslipAttStats.checkinDays > 0 ? (
                    <>
                      <div style={rowStyle}><span style={{ color: S.muted }}>أيام البصمة</span><span>{payslipAttStats.checkinDays} يوم</span></div>
                      <div style={rowStyle}><span style={{ color: S.muted }}>أعلى يوم حضور</span><span>{payslipAttStats.maxDay ? `${payslipAttStats.maxDay.date} (${fmtDuration(payslipAttStats.maxDay.minutes)})` : '—'}</span></div>
                      <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={{ color: S.muted }}>أقل يوم حضور</span><span>{payslipAttStats.minDay ? `${payslipAttStats.minDay.date} (${fmtDuration(payslipAttStats.minDay.minutes)})` : '—'}</span></div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: S.muted }}>لا توجد بصمة مسجّلة لهذا الموظف في هذا الشهر.</div>
                      {payslipRecord.deduction_2 === 0 && (
                        <div style={{ marginTop: 10, background: S.redB, border: `1px solid ${S.red}40`, borderRadius: 8, padding: '10px 12px', fontSize: 11, color: S.red, lineHeight: 1.8 }}>
                          ⚠️ تحذير: لا توجد أي بصمة لهذا الموظف طوال الشهر، ولم يُسجَّل له أي خصم غياب حتى الآن.
                          راجع أداة "🔍 Absence Detection" في صفحة الحضور والانصراف قبل اعتماد راتبه.
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ✅ تفاصيل الإجازات الرسمية وأيام الغياب الفعلية بتواريخها — شفافية كاملة لرقم "غياب بدون عذر" أعلاه */}
                {payslipScheduleInfo && (payslipScheduleInfo.leaveDates.length > 0 || payslipScheduleInfo.absentDates.length > 0) && (
                  <div style={{ marginTop: 14, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 18px' }}>
                    {payslipScheduleInfo.leaveDates.length > 0 && (
                      <div style={{ marginBottom: payslipScheduleInfo.absentDates.length > 0 ? 14 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: S.teal, marginBottom: 8 }}>🗓️ أيام الإجازة الرسمية ({payslipScheduleInfo.leaveDates.length} يوم)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {payslipScheduleInfo.leaveDates.map(d => (
                            <span key={d} style={{ background: S.tealB, color: S.teal, borderRadius: 8, padding: '4px 10px', fontSize: 11 }}>{d}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: S.muted, marginTop: 6 }}>هذه الأيام مستثناة من الحساب — لا تُعامَل كغياب ولا تُخصَم من الراتب.</div>
                      </div>
                    )}
                    {payslipScheduleInfo.absentDates.length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: S.red, marginBottom: 8 }}>❌ أيام الغياب الفعلية — تُخصَم من الراتب ({payslipScheduleInfo.absentDates.length} يوم)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {payslipScheduleInfo.absentDates.map(d => (
                            <span key={d} style={{ background: S.redB, color: S.red, borderRadius: 8, padding: '4px 10px', fontSize: 11 }}>{d}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: S.muted, marginTop: 6 }}>شيفت مجدول لهذا اليوم ولم يُسجَّل حضور فعلي — محتسَب ضمن "غياب بدون عذر" أعلاه.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                <button onClick={() => setPayslipRecord(null)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
                <button onClick={() => printSinglePayslip(payslipRecord)} style={{ padding: '10px 22px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ طباعة هذا الموظف</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
