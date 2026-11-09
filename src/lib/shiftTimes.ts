// فحص منطقية أوقات الشيفت عند الحفظ — يمنع أخطاء الإدخال التي كانت تفسد حساب الحضور والخروج التلقائي:
//   • 14:00–14:00 (نهاية تساوي البداية): كان النظام يعتبر الشيفت منتهيًا وقت بدايته فيغلق سجل الموظف تلقائيًا وهو يعمل
//   • 09:00–07:00 (22 ساعة): كان يجعل أي خروج عادي «خروجًا مبكرًا» بـ 12 ساعة
// النهاية الأصغر من البداية مقبولة (شيفت ليلي يعبر منتصف الليل، مثل 14:00–02:00 = 12 ساعة).
export const MAX_SHIFT_HOURS = 16

const toMinutes = (t: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec((t || '').trim())
  if (!m) return null
  const h = parseInt(m[1], 10), mi = parseInt(m[2], 10)
  return h < 24 && mi < 60 ? h * 60 + mi : null
}

/** مدة الشيفت بالدقائق (تراعي العبور بعد منتصف الليل)، أو null إن كان أحد الوقتين غير صالح */
export function shiftDurationMinutes(start: string, end: string): number | null {
  const s = toMinutes(start), e = toMinutes(end)
  if (s === null || e === null) return null
  return (e - s + 24 * 60) % (24 * 60)
}

/** رسالة خطأ بالعربية إن كان الشيفت غير منطقي، وإلا null (الوقتان الفارغان لا يُعتبران خطأ هنا: تتحقق منهما الشاشات) */
export function shiftTimesError(start: string, end: string): string | null {
  const s = toMinutes(start), e = toMinutes(end)
  if (s === null || e === null) return null
  if (s === e) return `وقت نهاية الشيفت (${end.slice(0, 5)}) يساوي وقت بدايته (${start.slice(0, 5)}). إن كان الشيفت ينتهي بعد منتصف الليل فاكتب وقت النهاية الصحيح (مثل 02:00).`
  const minutes = shiftDurationMinutes(start, end) as number
  if (minutes > MAX_SHIFT_HOURS * 60) {
    const h = Math.floor(minutes / 60), m = minutes % 60
    return `مدة الشيفت ${h} ساعة${m ? ' و' + m + ' دقيقة' : ''} (من ${start.slice(0, 5)} إلى ${end.slice(0, 5)}) وهي أكثر من الحد الأقصى ${MAX_SHIFT_HOURS} ساعة. تأكد من وقت النهاية.`
  }
  return null
}
