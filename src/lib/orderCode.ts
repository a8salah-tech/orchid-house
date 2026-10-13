// رقم الطلب الظاهر للعميل والموظفين: 3 حروف ثم 3 أرقام (مثل KDM 482)
// مشتق من معرّف الطلب نفسه بشكل ثابت (نفس الطلب = نفس الرقم في كل الشاشات: العميل، الكاشير، المطبخ، البار، الطباعة)
// الحروف بدون I وO حتى لا تلتبس بالرقمين 1 و0
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // 24 حرفًا
const TOTAL = LETTERS.length ** 3 * 1000 // 13,824,000 رقمًا ممكنًا

export function orderCode(id: string | null | undefined): string {
  const hex = String(id || '').replace(/[^0-9a-f]/gi, '')
  let n: number
  if (hex.length >= 12) {
    // آخر 12 خانة سداسية عشرية = 48 بت (ضمن دقة Number الآمنة)
    n = parseInt(hex.slice(-12, -6), 16) * 16777216 + parseInt(hex.slice(-6), 16)
  } else {
    // معرّف غير عادي: تجزئة بسيطة ثابتة
    n = 0
    for (const ch of String(id || '')) n = (n * 31 + ch.charCodeAt(0)) % 9007199254740
  }
  const v = n % TOTAL
  const letters = Math.floor(v / 1000)
  const digits = v % 1000
  const l1 = Math.floor(letters / (LETTERS.length * LETTERS.length)) % LETTERS.length
  const l2 = Math.floor(letters / LETTERS.length) % LETTERS.length
  const l3 = letters % LETTERS.length
  return LETTERS[l1] + LETTERS[l2] + LETTERS[l3] + String(digits).padStart(3, '0')
}
