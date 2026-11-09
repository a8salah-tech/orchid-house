import { createBrowserClient } from '@supabase/ssr'

// ✅ منطق حساب دقائق التأخير والخروج المبكر — مصدر حقيقة واحد مشترك بين صفحة الحضور
// (تسجيل ذاتي / تعديل يدوي / إعادة حساب شهرية) وصفحة طلبات الموظفين (اعتماد "تصحيح الحضور").
// كل الحسابات تستخدم توقيت ماليزيا الثابت (UTC+8) ولا تعتمد إطلاقًا على توقيت جهاز المستخدم.

type SB = ReturnType<typeof createBrowserClient>

// مدة الشيفت المجدول بالدقائق (يتعامل مع الشيفت الليلي العابر لمنتصف الليل).
// نستخدمها كصمام أمان: أي "تأخير" أو "خروج مبكر" أكبر من مدة الشيفت كلها = خطأ بيانات
// (تاريخ صف حضور غلط، أو بصمة مقترنة بشيفت اليوم الخطأ) وليس قيمة حقيقية، فنتجاهله بدل تغذية خصم وهمي.
export function scheduledShiftMinutes(
  startStr: string | null | undefined,
  endStr: string | null | undefined,
): number | null {
  if (!startStr || !endStr) return null
  const [sh, sm] = startStr.split(':').map(Number)
  const [eh, em] = endStr.split(':').map(Number)
  let dur = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0))
  if (dur <= 0) dur += 24 * 60
  return dur
}

// نافذة الشيفت الفعلية (بداية/نهاية بالـ ms، بتوقيت ماليزيا الثابت) لسجل حضور.
// المفتاح: نحدد الشيفت من وقت البصمة نفسه، مش من تاريخ الصف — لأن تاريخ الصف قد يكون
// مزاحًا بيوم كامل في الشيفتات الليلية (بصمة بعد منتصف الليل). نفحص شيفتات (تاريخ-1، تاريخ،
// تاريخ+1) ونختار الشيفت اللي البصمة واقعة جوا نافذته، أو الأقرب لها لو مفيش تطابق تام.
export async function resolveShiftWindow(
  sb: SB, employeeId: string, dateStr: string, anchorIso: string,
): Promise<{ startMs: number; endMs: number; durationMins: number } | null> {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const baseUtc = Date.UTC(y, mo - 1, d)
  const dayStrs = [-1, 0, 1].map(off => new Date(baseUtc + off * 86400000).toISOString().slice(0, 10))
  const { data: schs } = await sb.from('shift_schedules')
    .select('date, custom_start, custom_end, shifts(start_time,end_time)')
    .eq('employee_id', employeeId)
    .in('date', dayStrs)
  if (!schs || schs.length === 0) return null

  type ShiftTimes = { start_time?: string | null; end_time?: string | null }
  type SchedRow = { date: string; custom_start?: string | null; custom_end?: string | null; shifts?: ShiftTimes | ShiftTimes[] | null }

  const anchor = new Date(anchorIso).getTime()
  let best: { startMs: number; endMs: number; durationMins: number; dist: number } | null = null
  for (const s of schs as unknown as SchedRow[]) {
    // Supabase قد يُرجِع المورد المضمَّن ككائن أو كمصفوفة من عنصر واحد حسب الإصدار — نتعامل مع الحالتين
    const shift = Array.isArray(s.shifts) ? s.shifts[0] : s.shifts
    const startStr = s.custom_start || shift?.start_time
    const endStr = s.custom_end || shift?.end_time
    if (!startStr || !endStr) continue
    const [sy, sm, sd] = String(s.date).slice(0, 10).split('-').map(Number)
    const [sh, smin] = startStr.split(':').map(Number)
    const [eh, emin] = endStr.split(':').map(Number)
    // شيفت ليلي عابر لمنتصف الليل → النهاية في اليوم التالي
    const endDayOffset = (eh * 60 + (emin || 0)) <= (sh * 60 + (smin || 0)) ? 1 : 0
    const startMs = Date.UTC(sy, sm - 1, sd, sh, smin || 0, 0) - 8 * 60 * 60 * 1000
    const endMs = Date.UTC(sy, sm - 1, sd + endDayOffset, eh, emin || 0, 0) - 8 * 60 * 60 * 1000
    const dist = anchor < startMs ? startMs - anchor : anchor > endMs ? anchor - endMs : 0
    if (!best || dist < best.dist) best = { startMs, endMs, durationMins: Math.round((endMs - startMs) / 60000), dist }
  }
  return best ? { startMs: best.startMs, endMs: best.endMs, durationMins: best.durationMins } : null
}

// يحسب دقائق التأخير وحالة الحضور (late/present) بمقارنة وقت الدخول الفعلي بموعد بداية الشيفت
// المطابق للبصمة (grace period 10 دقائق). بلا شيفت مجدول، الافتراضي 9 صباحًا بتوقيت ماليزيا.
export async function computeLateInfo(
  sb: SB, employeeId: string, dateStr: string, checkInIso: string,
): Promise<{ status: string; late_minutes: number }> {
  const win = await resolveShiftWindow(sb, employeeId, dateStr, checkInIso)
  let shiftStartMs: number
  let durationMins: number | null = null
  if (win) {
    shiftStartMs = win.startMs
    durationMins = win.durationMins
  } else {
    const [y, mo, d] = dateStr.split('-').map(Number)
    shiftStartMs = Date.UTC(y, mo - 1, d, 9, 0, 0) - 8 * 60 * 60 * 1000
  }

  const diffMins = Math.floor((new Date(checkInIso).getTime() - shiftStartMs) / 60000)
  // صمام أمان أخير: تأخير أكبر من مدة الشيفت = مطابقة فشلت، نتجاهله
  if (durationMins !== null && diffMins >= durationMins) return { status: 'present', late_minutes: 0 }
  const status = diffMins > 10 ? 'late' : 'present'
  return { status, late_minutes: status === 'late' ? diffMins : 0 }
}

// إذن خروج مبكر معتمد لهذا الشيفت: يرجّع لحظة (ms) ساعة الخروج المسموح بها لو وُجد إذن معتمد يقع داخل نافذة الشيفت.
// نفحص أذونات (تاريخ-1، تاريخ، تاريخ+1) لنفس سبب resolveShiftWindow (تاريخ صف الحضور قد يكون مزاحًا بيوم في الشيفت الليلي).
// لو الاستعلام فشل لأي سبب (مثلاً العمود لسه ما اتضافش) نتصرف كأنه مفيش إذن.
async function findExitPermitMs(
  sb: SB, employeeId: string, dateStr: string, win: { startMs: number; endMs: number },
): Promise<number | null> {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const baseUtc = Date.UTC(y, mo - 1, d)
  const dayStrs = [-1, 0, 1].map(off => new Date(baseUtc + off * 86400000).toISOString().slice(0, 10))
  const { data, error } = await sb.from('employee_requests')
    .select('start_date, permit_time')
    .eq('employee_id', employeeId)
    .eq('request_type', 'early_exit_permit')
    .in('status', ['approved', 'completed'])
    .in('start_date', dayStrs)
  if (error || !data) return null
  for (const r of data as unknown as { start_date: string; permit_time: string | null }[]) {
    if (!r.permit_time) continue
    const [ph, pm] = r.permit_time.split(':').map(Number)
    const [sy, sm, sd] = String(r.start_date).slice(0, 10).split('-').map(Number)
    // ساعة الإذن قد تقع في اليوم نفسه أو التالي (شيفت ليلي) — نختار اللي داخل نافذة الشيفت
    for (const off of [0, 1]) {
      const ms = Date.UTC(sy, sm - 1, sd + off, ph, pm || 0, 0) - 8 * 60 * 60 * 1000
      if (ms > win.startMs && ms < win.endMs) return ms
    }
  }
  return null
}

// نظير computeLateInfo لكن للخروج المبكر — يقارن وقت الخروج بموعد نهاية الشيفت المطابق للبصمة.
// نُثبّت الشيفت على وقت الدخول لو متاح (أدق في تحديد أي شيفت)، وإلا على وقت الخروج.
// مع إذن خروج مبكر معتمد:
//   • خرج عند/بعد ساعة الإذن → early_minutes = 0، و permit_minutes = الدقائق الفعلية الناقصة عن نهاية الشيفت (بحد أقصى مدة الإذن)
//   • خرج قبل ساعة الإذن     → permit_minutes = مدة الإذن كاملة، و early_minutes = الجزء الأبكر من الإذن فقط
//   • ما خرجش مبكراً (ضمن سماح الـ10 دقائق من نهاية الشيفت) → لا شيء
// permit_minutes تُخصم بسعر ساعة الموظف الحقيقي، و early_minutes بالمبلغ الثابت للساعة (بدون إذن).
export async function computeEarlyInfo(
  sb: SB, employeeId: string, dateStr: string, checkOutIso: string, checkInIso?: string | null,
): Promise<{ early_minutes: number; permit_minutes: number }> {
  const win = await resolveShiftWindow(sb, employeeId, dateStr, checkInIso || checkOutIso)
  if (!win) return { early_minutes: 0, permit_minutes: 0 }
  const checkOutMs = new Date(checkOutIso).getTime()
  const diffMins = Math.floor((win.endMs - checkOutMs) / 60000)
  // صمام أمان أخير: لا يتجاوز مدة الشيفت (لو المطابقة فشلت لأي سبب)
  if (diffMins >= win.durationMins) return { early_minutes: 0, permit_minutes: 0 }

  const permitMs = await findExitPermitMs(sb, employeeId, dateStr, win)
  // grace period 10 دقائق
  if (permitMs === null) return { early_minutes: diffMins > 10 ? diffMins : 0, permit_minutes: 0 }
  if (diffMins <= 10) return { early_minutes: 0, permit_minutes: 0 }

  const permitMins = Math.floor((win.endMs - permitMs) / 60000)
  if (checkOutMs >= permitMs) return { early_minutes: 0, permit_minutes: Math.min(permitMins, diffMins) }
  const beforePermit = Math.floor((permitMs - checkOutMs) / 60000)
  return { early_minutes: beforePermit > 10 ? beforePermit : 0, permit_minutes: permitMins }
}

// ══════════════════════════════════════════════════════════════════════════════
//  إعادة حساب الحضور بعد تعديل مدير النظام لشيفت يومٍ له سجل حضور
// ══════════════════════════════════════════════════════════════════════════════
//  سياسة الشركة: تعديل الأيام الماضية لمدير النظام وحده، وتعديله يُطبَّق مباشرة (يُعاد حساب التأخير والخروج المبكر لذلك اليوم
//  على الشيفت الجديد، وتُحدَّث ساعات كشف الراتب للأشهر غير المعتمدة). المدراء الآخرون لا يستدعون هذه الدالة.

/** يحدّث ساعات التأخير/الخروج المبكر/إذن الخروج في كشف راتب الشهر من مجموع دقائق الحضور المخزَّنة (نفس معادلة صفحة الرواتب) */
export async function syncAttendanceToPayroll(
  sb: SB, employeeId: string, year: number, month: number,
): Promise<'updated' | 'finalized' | 'skipped'> {
  const { data: pm } = await sb.from('payroll_months').select('id, status').eq('month', month).eq('year', year).maybeSingle()
  if (!pm) return 'skipped'
  if (pm.status === 'finalized') return 'finalized'
  const { data: rec } = await sb.from('payroll_records').select('id').eq('payroll_month_id', pm.id).eq('employee_id', employeeId).maybeSingle()
  if (!rec) return 'skipped'
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  const { data: att } = await sb.from('attendance').select('late_minutes, early_minutes, permit_minutes')
    .eq('employee_id', employeeId).gte('date', monthStart).lte('date', monthEnd)
  const rows = (att || []) as { late_minutes?: number | null; early_minutes?: number | null; permit_minutes?: number | null }[]
  const totalLate = rows.reduce((s, a) => s + (a.late_minutes || 0), 0)
  const totalEarly = rows.reduce((s, a) => s + (a.early_minutes || 0), 0)
  const totalPermit = rows.reduce((s, a) => s + (a.permit_minutes || 0), 0)
  // موظف الراتب الثابت لا يُخصم منه إذن الخروج (نفس قاعدة باقي خصومات الحضور)
  const { data: emp } = await sb.from('employees').select('fixed_salary').eq('id', employeeId).maybeSingle()
  await sb.from('payroll_records').update({
    late_hours: parseFloat((totalLate / 60).toFixed(2)),
    early_exit_hours: parseFloat((totalEarly / 60).toFixed(2)),
    exit_permit_hours: emp?.fixed_salary ? 0 : parseFloat((totalPermit / 60).toFixed(2)),
  }).eq('id', rec.id)
  return 'updated'
}

export type RecalcAfterShiftEditResult = {
  changedRows: { date: string; late: [number, number]; early: [number, number] }[]
  payroll: Record<string, 'updated' | 'finalized' | 'skipped'> // مفتاحه "YYYY-MM"
}

/**
 * يعيد حساب التأخير والخروج المبكر لسجلات حضور الموظف في التواريخ المعطاة (التي عُدّل شيفتها) على الشيفت الجديد،
 * ويضيف ملاحظة على كل سجل تغيّر، ثم يحدّث كشف الراتب للأشهر المتأثرة (غير المعتمدة).
 * dryRun=true: يحسب ويُرجع التغييرات دون أي كتابة.
 */
export async function recalcAttendanceAfterShiftEdit(
  sb: SB, employeeId: string, dates: string[], editorName: string, dryRun = false,
): Promise<RecalcAfterShiftEditResult> {
  const result: RecalcAfterShiftEditResult = { changedRows: [], payroll: {} }
  const uniqueDates = [...new Set(dates)].sort()
  if (uniqueDates.length === 0) return result
  const { data: rows } = await sb.from('attendance')
    .select('id, date, status, check_in_time, check_out_time, late_minutes, early_minutes, permit_minutes, notes')
    .eq('employee_id', employeeId).in('date', uniqueDates).not('check_in_time', 'is', null)
  const months = new Set<string>()
  for (const r of (rows || []) as { id: string; date: string; status: string | null; check_in_time: string; check_out_time: string | null; late_minutes: number | null; early_minutes: number | null; permit_minutes: number | null; notes: string | null }[]) {
    const dateStr = String(r.date).slice(0, 10)
    const late = await computeLateInfo(sb, employeeId, dateStr, r.check_in_time)
    const early = r.check_out_time
      ? await computeEarlyInfo(sb, employeeId, dateStr, r.check_out_time, r.check_in_time)
      : { early_minutes: r.early_minutes || 0, permit_minutes: r.permit_minutes || 0 }
    const changed = late.late_minutes !== (r.late_minutes || 0) || early.early_minutes !== (r.early_minutes || 0) || early.permit_minutes !== (r.permit_minutes || 0)
    if (!changed) continue
    result.changedRows.push({ date: dateStr, late: [r.late_minutes || 0, late.late_minutes], early: [r.early_minutes || 0, early.early_minutes] })
    months.add(dateStr.slice(0, 7))
    if (dryRun) continue
    const note = `🔄 أُعيد حساب التأخير/الخروج المبكر بعد تعديل الشيفت بواسطة ${editorName} / Recalculated after shift edit`
    await sb.from('attendance').update({
      status: late.status, late_minutes: late.late_minutes,
      early_minutes: early.early_minutes, permit_minutes: early.permit_minutes,
      notes: r.notes ? `${r.notes} | ${note}` : note,
    }).eq('id', r.id)
  }
  if (!dryRun) {
    for (const ym of months) {
      const [y, m] = ym.split('-').map(Number)
      result.payroll[ym] = await syncAttendanceToPayroll(sb, employeeId, y, m)
    }
  }
  return result
}
