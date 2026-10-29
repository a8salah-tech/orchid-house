// معايير تقييم الموظف الشهري — مصدر واحد تستخدمه صفحة التقييم (المخالفات) وصفحة «راتبي».
// كل معيار يُقيَّم من 10، ووزنه من 100 (مجموع الأوزان = 100) فيكون الإجمالي = Σ (الدرجة ÷ 10 × الوزن).
export const EVAL_CRITERIA = [
  { key: 'attendance',       weight: 15, label: 'الحضور والالتزام',          label_en: 'Attendance & Punctuality',       icon: '⏰' },
  { key: 'work_quality',     weight: 20, label: 'جودة الأداء والإنتاجية',    label_en: 'Work Quality & Productivity',    icon: '⭐' },
  { key: 'customer_service', weight: 15, label: 'التعامل مع العملاء',        label_en: 'Customer Service',               icon: '🤝' },
  { key: 'hygiene',          weight: 10, label: 'النظافة الشخصية والمظهر',   label_en: 'Personal Hygiene & Appearance',  icon: '✨' },
  { key: 'teamwork',         weight: 10, label: 'العمل الجماعي والتعاون',    label_en: 'Teamwork & Cooperation',         icon: '👥' },
  { key: 'food_safety',      weight: 15, label: 'السلامة والنظافة الغذائية', label_en: 'Food Safety & Hygiene Standards', icon: '🍽️' },
  { key: 'initiative',       weight: 10, label: 'المبادرة وحل المشكلات',    label_en: 'Initiative & Problem Solving',   icon: '💡' },
  { key: 'discipline',       weight: 5,  label: 'الانضباط واحترام القوانين', label_en: 'Discipline & Rule Compliance',   icon: '📋' },
]

export function calcEvalTotal(sc: Record<string, number>): number {
  return EVAL_CRITERIA.reduce((s, c) => s + ((sc[c.key] || 0) / 10) * c.weight, 0)
}

export function getEvalGrade(t: number, ar: boolean) {
  if (t >= 90) return { label: ar ? 'ممتاز' : 'Excellent', color: '#22C55E' }
  if (t >= 75) return { label: ar ? 'جيد جداً' : 'Very Good', color: '#14B8A6' }
  if (t >= 60) return { label: ar ? 'جيد' : 'Good', color: '#3B82F6' }
  if (t >= 50) return { label: ar ? 'مقبول' : 'Acceptable', color: '#F59E0B' }
  return { label: ar ? 'ضعيف' : 'Poor', color: '#EF4444' }
}
