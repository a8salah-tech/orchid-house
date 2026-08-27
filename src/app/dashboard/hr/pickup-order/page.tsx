'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

// دمج الاسم الأول والأخير (name_en يخزّن اسم العائلة في هذا النظام)
function getFullName(p?: { name?: string; name_en?: string } | null): string {
  if (!p) return '—'
  return [p.name, p.name_en].filter(Boolean).join(' ').trim() || '—'
}

type PayrollMonth = { id: string; month: number; year: number; status: string }
type Branch = { id: string; name: string }
type RankedEmployee = {
  employee_id: string; name: string; role: string; department?: string | null
  employee_number?: string | null
  lateHours: number; absenceDays: number; hasAbsenceDeduction: boolean; hasAttended: boolean
  attendanceScore: number; evalScore: number; hasEval: boolean; combined: number
}

export default function PickupOrderPage() {
  const sb = createClient()
  const { isAr } = useLang()

  const [months, setMonths] = useState<PayrollMonth[]>([])
  const [selectedMonth, setSelectedMonth] = useState<PayrollMonth | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [ranked, setRanked] = useState<RankedEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRanked, setLoadingRanked] = useState(false)

  const fetchInit = useCallback(async () => {
    setLoading(true)
    const [{ data: monthsData }, { data: branchesData }] = await Promise.all([
      sb.from('payroll_months').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
      sb.from('branches').select('id,name').eq('is_active', true).order('name'),
    ])
    setMonths(monthsData || [])
    setBranches(branchesData || [])
    if (monthsData && monthsData.length > 0) setSelectedMonth(monthsData[0])
    if (branchesData && branchesData.length > 0) setSelectedBranch(branchesData[0])
    setLoading(false)
  }, [])

  useEffect(() => { fetchInit() }, [fetchInit])

  // ✅ نفس الخوارزمية بالضبط المستخدمة في صفحة "راتبي" لحساب دور الموظف في الاستلام (my-salary/page.tsx) —
  // لازم تفضل متطابقة تمامًا هنا وهناك، وإلا الرقم اللي يشوفه الموظف لوحده هيختلف عن الترتيب الكامل اللي بيطبعه الأدمن
  useEffect(() => {
    if (!selectedMonth || !selectedBranch) { setRanked([]); return }
    let cancelled = false
    setLoadingRanked(true)
    ;(async () => {
      const { data: branchEmps } = await sb.from('employees')
        .select('id,name,name_en,employee_number,role,department')
        .eq('branch_id', selectedBranch.id).eq('is_active', true)
      const empIds = (branchEmps || []).map(e => e.id)
      if (empIds.length === 0) { if (!cancelled) { setRanked([]); setLoadingRanked(false) }; return }

      const monthStart = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`
      const monthEnd = new Date(Date.UTC(selectedMonth.year, selectedMonth.month, 0)).toISOString().split('T')[0]

      const [{ data: records }, { data: evalsData }, { data: attData }] = await Promise.all([
        sb.from('payroll_records').select('employee_id, late_hours, absence_days, deduction_2')
          .eq('payroll_month_id', selectedMonth.id)
          .in('employee_id', empIds),
        sb.from('employee_evaluations').select('employee_id, total_score, month, year')
          .in('employee_id', empIds)
          .eq('status', 'approved')
          .order('year', { ascending: false })
          .order('month', { ascending: false }),
        // ✅ Fix حرج: absence_days/late_hours بيرجعوا صفر لموظف مفيش له شيفت مجدول ولا بصمة خالص هذا الشهر
        // (مش بس اللي حضر بانضباط تام) - فكان بيطلع بدرجة حضور 100% كاملة رغم إنه ما بصمش يوم واحد.
        // هنا نتحقق من وجود بصمة حقيقية على الأقل، ولو معندوش خالص نصفّر درجة حضوره بدل ما نفترض الأفضل
        sb.from('attendance').select('employee_id, check_in_time')
          .in('employee_id', empIds).not('check_in_time', 'is', null)
          .gte('date', monthStart).lte('date', monthEnd),
      ])
      if (cancelled) return

      const latestEvalByEmp: Record<string, number> = {}
      for (const ev of (evalsData || [])) {
        if (!(ev.employee_id in latestEvalByEmp)) latestEvalByEmp[ev.employee_id] = ev.total_score
      }
      const employeesWithAnyAttendance = new Set((attData || []).map(a => a.employee_id))
      const empById = Object.fromEntries((branchEmps || []).map(e => [e.id, e]))

      const scored: RankedEmployee[] = (records || [])
        .filter(r => empById[r.employee_id])
        .map(r => {
          const lateHours = r.late_hours || 0
          const absenceDays = r.absence_days || 0
          const hasAbsenceDeduction = (r.deduction_2 || 0) > 0
          const hasAttended = employeesWithAnyAttendance.has(r.employee_id)
          // ✅ بدون أي بصمة حضور فعلية هذا الشهر، مفيش أساس نحسب عليه انضباط حضور - نعتبرها صفر، مش 100%
          const attendanceScore = hasAttended
            ? Math.max(0, 100 - lateHours * 3 - absenceDays * 15 - (hasAbsenceDeduction ? 10 : 0))
            : 0
          const hasEval = r.employee_id in latestEvalByEmp
          const evalScore = latestEvalByEmp[r.employee_id] ?? 70
          const combined = attendanceScore * 0.5 + evalScore * 0.5
          const emp = empById[r.employee_id]
          return {
            employee_id: r.employee_id, name: getFullName(emp), role: emp?.role || '',
            department: emp?.department, employee_number: emp?.employee_number,
            lateHours, absenceDays, hasAbsenceDeduction, hasAttended, attendanceScore, evalScore, hasEval, combined,
          }
        })
      scored.sort((a, b) => b.combined - a.combined)
      if (!cancelled) { setRanked(scored); setLoadingRanked(false) }
    })()
    return () => { cancelled = true }
  }, [selectedMonth?.id, selectedBranch?.id])

  const monthLabel = selectedMonth ? `${(isAr ? MONTHS_AR : MONTHS_EN)[(selectedMonth.month || 1) - 1]} ${selectedMonth.year}` : ''

  function printOrder() {
    if (!selectedMonth || !selectedBranch) return
    const win = window.open('', '_blank')
    if (!win) return
    const rows = ranked.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.name}</td>
        <td>${r.employee_number || '—'}</td>
        <td>${r.department || '—'}</td>
        <td>${r.hasAttended ? r.attendanceScore.toFixed(0) : 'لا يوجد بصمة حضور'}</td>
        <td>${r.hasEval ? r.evalScore.toFixed(0) : '—'}</td>
        <td>${r.combined.toFixed(1)}</td>
      </tr>`).join('')

    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>دور استلام الرواتب — ${selectedBranch.name} — ${monthLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; direction: rtl; }
      h2 { color: #C9A84C; margin-bottom: 4px; }
      h3 { color: #555; font-weight: 400; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #0A1628; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; }
      td { padding: 7px 8px; border: 1px solid #ddd; text-align: center; }
      tr:nth-child(even) { background: #f9f9f9; }
      td:first-child { font-weight: bold; color: #C9A84C; }
      @media print { @page { size: A4; margin: 10mm; } }
    </style></head><body>
    <h2>🌸 Orchid House — دور استلام الرواتب نقداً</h2>
    <h3>${selectedBranch.name} · ${monthLabel} · ${ranked.length} موظف</h3>
    <table>
      <thead><tr><th>الدور</th><th>الاسم</th><th>الرقم الوظيفي</th><th>القسم</th><th>نسبة الالتزام بالحضور</th><th>تقييم الأداء</th><th>الدرجة الإجمالية</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#666">
      <div>تم الطباعة بواسطة: _______________</div>
      <div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ {isAr ? 'جاري التحميل...' : 'Loading...'}</div>
  )

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🎟️ {isAr ? 'دور استلام الرواتب' : 'Salary Pickup Order'}</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'ترتيب الموظفين لاستلام رواتبهم نقداً حسب التزامهم بالحضور والانصراف وتقييم أدائهم' : 'Employee order for cash salary collection, ranked by attendance discipline and performance evaluation'}</p>
        </div>
        <button onClick={printOrder} disabled={ranked.length === 0}
          style={{ padding: '11px 20px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: ranked.length === 0 ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: ranked.length === 0 ? 0.5 : 1 }}>
          🖨️ {isAr ? 'طباعة الترتيب' : 'Print Order'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={selectedMonth?.id || ''} onChange={e => setSelectedMonth(months.find(m => m.id === e.target.value) || null)}
          style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy2, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          {months.map(m => <option key={m.id} value={m.id}>{(isAr ? MONTHS_AR : MONTHS_EN)[(m.month || 1) - 1]} {m.year}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {branches.map(b => (
            <button key={b.id} onClick={() => setSelectedBranch(b)}
              style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${selectedBranch?.id === b.id ? S.gold : S.border}`, background: selectedBranch?.id === b.id ? S.gold3 : 'transparent', color: selectedBranch?.id === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: selectedBranch?.id === b.id ? 700 : 400 }}>
              🏪 {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {!selectedMonth || !selectedBranch ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>{isAr ? 'اختر الشهر والفرع' : 'Select a month and branch'}</div>
      ) : loadingRanked ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ {isAr ? 'جاري الحساب...' : 'Calculating...'}</div>
      ) : ranked.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
          {isAr ? 'لا توجد سجلات رواتب لهذا الفرع في هذا الشهر' : 'No payroll records for this branch this month'}
        </div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: S.white }}>{selectedBranch.name} — {monthLabel}</span>
            <span style={{ fontSize: 12, color: S.muted }}>{ranked.length} {isAr ? 'موظف' : 'employees'}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {[
                    isAr ? 'الدور' : 'Order', isAr ? 'الموظف' : 'Employee', isAr ? 'القسم' : 'Department',
                    isAr ? 'نسبة الالتزام بالحضور' : 'Attendance Score', isAr ? 'تقييم الأداء' : 'Evaluation',
                    isAr ? 'الدرجة الإجمالية' : 'Combined Score',
                  ].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => (
                  <tr key={r.employee_id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '14px 16px', color: S.gold, fontWeight: 900, fontSize: 15 }}>#{i + 1}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{r.name}</div>
                      {r.employee_number && <div style={{ fontSize: 10, color: S.muted }}>{r.employee_number}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: S.muted }}>{r.department || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {r.hasAttended ? (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 700, color: r.attendanceScore >= 80 ? S.green : r.attendanceScore >= 50 ? S.amber : S.red }}>{r.attendanceScore.toFixed(0)}</span>
                          {(r.lateHours > 0 || r.absenceDays > 0) && (
                            <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>
                              {r.lateHours > 0 && `⏰ ${r.lateHours.toFixed(1)}${isAr ? 'س تأخير' : 'h late'}`}
                              {r.lateHours > 0 && r.absenceDays > 0 && ' · '}
                              {r.absenceDays > 0 && `🚫 ${r.absenceDays}${isAr ? 'ي غياب' : 'd absent'}`}
                            </div>
                          )}
                        </>
                      ) : (
                        // ✅ Fix حرج: بدون أي بصمة حضور فعلية، الدرجة صفر بمعنى "مفيش بيانات" - لازم نوضّح كده
                        // بدل ما نعرض "0" مجردة ممكن تتفهم غلط، أو الأسوأ لو كانت بتتحسب زي قبل الإصلاح (100%)
                        <span style={{ fontSize: 11, color: S.red, fontWeight: 700 }}>🚫 {isAr ? 'لا يوجد بصمة حضور' : 'No attendance recorded'}</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {r.hasEval
                        ? <span style={{ fontSize: 13, fontWeight: 700, color: S.teal }}>{r.evalScore.toFixed(0)}</span>
                        : <span style={{ fontSize: 11, color: S.muted, fontStyle: 'italic' }}>{isAr ? 'لا يوجد تقييم' : 'No evaluation'}</span>}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: S.gold, fontSize: 14 }}>{r.combined.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
