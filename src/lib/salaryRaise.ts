// ✅ تسجيل زيادة راتب — منطق واحد تستخدمه صفحة الموظفين (زر «زيادة راتب») وصفحة الطلبات («تطبيق الزيادة»)
import type { createBrowserClient } from '@supabase/ssr'

type SB = ReturnType<typeof createBrowserClient>

export const round2 = (n: number) => Math.round(n * 100) / 100

export async function recordSalaryRaise(supabase: SB, p: {
  employeeId: string; currentSalary: number; amount: number; effectiveDate: string; createdBy: string | null; notes: string | null
}): Promise<{ error: string } | { newSalary: number; warning: string | null }> {
  const newSalary = round2(p.currentSalary + p.amount)

  // نسجّل الزيادة في السجل التاريخي (salary_increases) قبل تحديث الراتب نفسه — سجل تدقيق بكل زيادة (متى، بكم، من اعتمدها)
  const { data: inserted, error: insError } = await supabase.from('salary_increases').insert([{
    employee_id: p.employeeId,
    amount: p.amount,
    effective_date: p.effectiveDate,
    salary_before: p.currentSalary,
    salary_after: newSalary,
    created_by: p.createdBy,
    notes: p.notes,
  }]).select('id').single()
  if (insError) return { error: 'خطأ في تسجيل الزيادة: ' + insError.message }

  // الراتب في جدول employee_compensation المقفول
  const { error: updError } = await supabase.from('employee_compensation')
    .upsert({ employee_id: p.employeeId, salary: newSalary, updated_at: new Date().toISOString() }, { onConflict: 'employee_id' })
  if (updError) {
    // نلغي سطر السجل حتى لا تبدو الزيادة مسجَّلة والراتب لم يتغير
    const { error: undoError } = await supabase.from('salary_increases').delete().eq('id', (inserted as { id: string }).id)
    return { error: 'خطأ في تحديث الراتب: ' + updError.message + (undoError ? ' — ⚠️ وتعذّر إلغاء سطر سجل الزيادة، راجعه يدويًا: ' + undoError.message : '') }
  }

  // نعكس الزيادة فورًا على سجلات الرواتب غير المعتمدة من شهر السريان فصاعدًا (من أكتوبر 2026 كحد أدنى، كقاعدة صفحة الرواتب).
  // صفحة «راتبي» تقرأ الراتب الأساسي المخزَّن في سجل الشهر، وهذا السجل لا يتحدّث إلا عند فتح الأدمن لكشف ذلك الشهر —
  // فكانت الزيادة لا تظهر للموظف حتى يفتح الأدمن الرواتب. الأشهر المعتمدة/المدفوعة لا تُمَس، والسجلات ذات الأساسي صفر
  // (لم يبدأ / موقوف) تبقى كما هي. ظهور المبلغ المستحق النهائي يتجدد أيضًا عند فتح كشف الشهر.
  let warning: string | null = null
  const effYM = p.effectiveDate.slice(0, 7) < '2026-10' ? '2026-10' : p.effectiveDate.slice(0, 7)
  const { data: openMonths } = await supabase.from('payroll_months').select('id, year, month').not('status', 'in', '("finalized","paid")')
  const openIds = ((openMonths || []) as { id: string; year: number; month: number }[])
    .filter(m => `${m.year}-${String(m.month).padStart(2, '0')}` >= effYM).map(m => m.id)
  if (openIds.length > 0) {
    const { error: recError } = await supabase.from('payroll_records')
      .update({ basic_salary: newSalary, updated_at: new Date().toISOString() })
      .eq('employee_id', p.employeeId).in('payroll_month_id', openIds).gt('basic_salary', 0)
    if (recError) warning = 'تم تسجيل الزيادة، لكن تعذّر تحديث كشوف الرواتب المفتوحة: ' + recError.message + ' — افتح صفحة الرواتب للشهر ليتحدّث الكشف.'
  }
  return { newSalary, warning }
}
