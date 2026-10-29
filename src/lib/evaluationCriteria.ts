// معايير تقييم الموظف الشهري — مصدر واحد تستخدمه صفحة التقييم (المخالفات) وصفحة «راتبي».
// كل معيار يُقيَّم من 10، ووزنه من 100 (مجموع الأوزان = 100) فيكون الإجمالي = Σ (الدرجة ÷ 10 × الوزن).
export type EvalCriterion = { key: string; weight: number; label: string; label_en: string; icon: string }

export const EVAL_CRITERIA: EvalCriterion[] = [
  { key: 'attendance',       weight: 15, label: 'الحضور والالتزام',          label_en: 'Attendance & Punctuality',       icon: '⏰' },
  { key: 'work_quality',     weight: 20, label: 'جودة الأداء والإنتاجية',    label_en: 'Work Quality & Productivity',    icon: '⭐' },
  { key: 'customer_service', weight: 15, label: 'التعامل مع العملاء',        label_en: 'Customer Service',               icon: '🤝' },
  { key: 'hygiene',          weight: 10, label: 'النظافة الشخصية والمظهر',   label_en: 'Personal Hygiene & Appearance',  icon: '✨' },
  { key: 'teamwork',         weight: 10, label: 'العمل الجماعي والتعاون',    label_en: 'Teamwork & Cooperation',         icon: '👥' },
  { key: 'food_safety',      weight: 15, label: 'السلامة والنظافة الغذائية', label_en: 'Food Safety & Hygiene Standards', icon: '🍽️' },
  { key: 'initiative',       weight: 10, label: 'المبادرة وحل المشكلات',    label_en: 'Initiative & Problem Solving',   icon: '💡' },
  { key: 'discipline',       weight: 5,  label: 'الانضباط واحترام القوانين', label_en: 'Discipline & Rule Compliance',   icon: '📋' },
]

// أقسام الخلف (لا يتعاملون مع العملاء مباشرة): «التعامل مع العملاء» (15%) يُستبدل عندهم بأربعة معايير (db/evaluation_boh_criteria.sql)
export const BOH_DEPARTMENTS = ['المطبخ', 'البار', 'الحلويات', 'النظافة']
export const BOH_EXTRA_CRITERIA: EvalCriterion[] = [
  { key: 'recipe_standards', weight: 5, label: 'الالتزام بالوصفات ومعايير الجودة والتقديم', label_en: 'Recipe, Quality & Presentation Standards', icon: '👨‍🍳' },
  { key: 'prep_speed',       weight: 4, label: 'السرعة والالتزام بأوقات التحضير',           label_en: 'Preparation Speed & Timing',               icon: '⏱️' },
  { key: 'waste_control',    weight: 3, label: 'تقليل الهدر وحسن استخدام المواد',           label_en: 'Waste Reduction & Material Use',           icon: '♻️' },
  { key: 'workstation',      weight: 3, label: 'تنظيف وتنظيم مكان العمل',                   label_en: 'Workstation Cleanliness & Organization',   icon: '🧹' },
]
export const EVAL_CRITERIA_BOH: EvalCriterion[] = [
  ...EVAL_CRITERIA.filter(c => c.key !== 'customer_service'),
  ...BOH_EXTRA_CRITERIA,
]

// كل مفاتيح الدرجات المحتملة (القديمة + الجديدة) — لقراءة صف التقييم المخزَّن
export const EVAL_ALL_KEYS = [...EVAL_CRITERIA.map(c => c.key), ...BOH_EXTRA_CRITERIA.map(c => c.key)]

// طقم المعايير الواجب تطبيقه على موظف في قسم معيّن. التقييم المعتمد السابق بلا أي درجة جديدة يبقى بمعاييره القديمة
// فلا يتغير إجماليه بأثر رجعي.
export function evalCriteriaFor(department: string | null | undefined, ev?: Record<string, unknown> | null): EvalCriterion[] {
  if (!department || !BOH_DEPARTMENTS.includes(department)) return EVAL_CRITERIA
  if (ev && ev.status === 'approved' && BOH_EXTRA_CRITERIA.every(c => !ev[c.key])) return EVAL_CRITERIA
  return EVAL_CRITERIA_BOH
}

export function calcEvalTotal(sc: Record<string, number>, criteria: EvalCriterion[] = EVAL_CRITERIA): number {
  return criteria.reduce((s, c) => s + ((sc[c.key] || 0) / 10) * c.weight, 0)
}

export function getEvalGrade(t: number, ar: boolean) {
  if (t >= 90) return { label: ar ? 'ممتاز' : 'Excellent', color: '#22C55E' }
  if (t >= 75) return { label: ar ? 'جيد جداً' : 'Very Good', color: '#14B8A6' }
  if (t >= 60) return { label: ar ? 'جيد' : 'Good', color: '#3B82F6' }
  if (t >= 50) return { label: ar ? 'مقبول' : 'Acceptable', color: '#F59E0B' }
  return { label: ar ? 'ضعيف' : 'Poor', color: '#EF4444' }
}
