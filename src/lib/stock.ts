// ✅ حساب "المخزون المنخفض" — مصدر حقيقة واحد لكل صفحات المستودعات.
//
// الفخ: min_stock دائمًا محفوظة بالوحدة الكبرى (كرتون مثلًا)، بينما current_stock:
//   • لبعض الأصناف محفوظ بالوحدة الكبرى نفسها (زي "ببروني لحم" — الرصيد بالكرتون مباشرة)
//   • ولأصناف تانية محفوظ بالوحدة الصغرى (زي كيس/عبوة)
// التمييز = نفس تمييز عرض الرصيد: لو تحويل الوحدة المختار فيه from_unit_id === unit_id
// فالرصيد بالوحدة الكبرى؛ غير كده بالوحدة الصغرى.
//
// المقارنة الخام السابقة (current_stock <= min_stock * factor كلما وُجد تحويل) كانت بتضرب
// الحد الأدنى حتى للأصناف المخزَّنة بالوحدة الكبرى، فتقارن "8.6 كرتون" بـ "26 كيس" وتُخفي
// المخزون المنخفض؛ أو تقارن خام وحدتين مختلفتين وتُظهره غلط.

type ConvRow = { product_id: string; from_unit_id: string; factor: number }
type StockProduct = { id: string; unit_id?: string | null; min_stock: number; current_stock: number }

export function isLowStock(p: StockProduct, conversions: ConvRow[] | null | undefined): boolean {
  if (!p.min_stock || p.min_stock <= 0 || p.current_stock <= 0) return false
  const convs = conversions || []
  const conv =
    convs.find(c => c.product_id === p.id && c.from_unit_id === p.unit_id) ||
    convs.find(c => c.product_id === p.id)
  // الرصيد مخزَّن بالوحدة الكبرى لو مفيش تحويل، أو لو التحويل المختار from_unit = وحدة الصنف
  const storedInBigUnit = !conv || conv.from_unit_id === p.unit_id
  const minInStockUnit =
    conv && conv.factor > 1 && !storedInBigUnit ? p.min_stock * conv.factor : p.min_stock
  return p.current_stock <= minInStockUnit
}
