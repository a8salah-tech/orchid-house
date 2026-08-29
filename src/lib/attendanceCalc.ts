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

// نظير computeLateInfo لكن للخروج المبكر — يقارن وقت الخروج بموعد نهاية الشيفت المطابق للبصمة.
// نُثبّت الشيفت على وقت الدخول لو متاح (أدق في تحديد أي شيفت)، وإلا على وقت الخروج.
export async function computeEarlyInfo(
  sb: SB, employeeId: string, dateStr: string, checkOutIso: string, checkInIso?: string | null,
): Promise<{ early_minutes: number }> {
  const win = await resolveShiftWindow(sb, employeeId, dateStr, checkInIso || checkOutIso)
  if (!win) return { early_minutes: 0 }
  const diffMins = Math.floor((win.endMs - new Date(checkOutIso).getTime()) / 60000)
  // صمام أمان أخير: لا يتجاوز مدة الشيفت (لو المطابقة فشلت لأي سبب)
  if (diffMins >= win.durationMins) return { early_minutes: 0 }
  // grace period 10 دقائق
  return { early_minutes: diffMins > 10 ? diffMins : 0 }
}
