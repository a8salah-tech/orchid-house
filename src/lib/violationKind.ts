// أنواع سجلات جدول violations: مخالفة عادية، أو خصم من الكاشير (وجبة شخصية / خطأ في الطلب)
export type ViolationKind = 'violation' | 'personal_meal' | 'order_mistake'

export const VIOLATION_KIND_META: Record<ViolationKind, { icon: string; ar: string; en: string; color: string; bg: string }> = {
  violation:     { icon: '⚠️', ar: 'مخالفة',      en: 'Violation',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  personal_meal: { icon: '🍽️', ar: 'وجبة شخصية',  en: 'Personal meal',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  order_mistake: { icon: '🧾', ar: 'خطأ في الطلب', en: 'Order mistake',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
}

export function normalizeKind(k: string | null | undefined): ViolationKind {
  return k === 'personal_meal' || k === 'order_mistake' ? k : 'violation'
}

// يجمع مبالغ سجلات المخالفات حسب النوع
export function sumByKind(rows: { amount?: number | null; kind?: string | null }[]): Record<ViolationKind, number> {
  const out: Record<ViolationKind, number> = { violation: 0, personal_meal: 0, order_mistake: 0 }
  for (const r of rows) out[normalizeKind(r.kind)] += r.amount || 0
  return out
}
