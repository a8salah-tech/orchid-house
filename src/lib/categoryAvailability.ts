// وقت ظهور القسم في المنيو (اختياري): أيام الأسبوع + من ساعة + إلى ساعة، دائمًا بتوقيت ماليزيا الثابت (UTC+8)
// وليس بساعة جهاز الزبون. بلا أي قيد = القسم متاح طوال الوقت. يُستخدم في صفحة المنيو العامة وفي /api/submit-order.
export type CategoryWindow = { available_days?: number[] | null; available_from?: string | null; available_to?: string | null }

const MY_OFFSET_MS = 8 * 60 * 60 * 1000
const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

export function malaysiaClock(now: Date = new Date()): { day: number; minutes: number } {
  const my = new Date(now.getTime() + MY_OFFSET_MS)
  return { day: my.getUTCDay(), minutes: my.getUTCHours() * 60 + my.getUTCMinutes() } // day: 0=الأحد … 6=السبت
}

export function isCategoryAvailableNow(cat: CategoryWindow, now: Date = new Date()): boolean {
  const days = cat.available_days && cat.available_days.length > 0 ? cat.available_days : null
  if (!days && !cat.available_from && !cat.available_to) return true
  const { day, minutes } = malaysiaClock(now)
  const from = cat.available_from ? toMinutes(cat.available_from) : null
  const to = cat.available_to ? toMinutes(cat.available_to) : null
  const dayOk = (d: number) => !days || days.includes(d)
  // نافذة تعبر منتصف الليل (مثل 22:00 → 02:00): الجزء بعد منتصف الليل يتبع يوم البداية (أمس)
  if (from !== null && to !== null && from > to) {
    if (minutes >= from) return dayOk(day)
    if (minutes < to) return dayOk((day + 6) % 7)
    return false
  }
  if (!dayOk(day)) return false
  if (from !== null && minutes < from) return false
  if (to !== null && minutes >= to) return false
  return true
}
