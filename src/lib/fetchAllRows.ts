// Supabase/PostgREST يُرجع 1000 صف كحد أقصى في الطلب الواحد، ويقطع الباقي بصمت.
// هذه الدالة تجلب كل الصفوف على دفعات. ⚠️ لازم يتضمن الاستعلام .order(...) ثابتًا (مثل id) حتى لا تتكرر/تضيع صفوف بين الدفعات.
// نفس شكل نتيجة supabase ({ data, error }) لكن بكل الصفوف على دفعات — بديل مباشر لـ await sb.from(...).select(...) في الاستعلامات التي قد تتجاوز 1000 صف.
// ⚠️ لازم يتضمن الاستعلام .order(...) ثابتًا (مثل id) ثم .range(from, to).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function selectAll<T = any>(
  make: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await make(from, from + pageSize - 1)
    if (error) return { data: out, error }
    if (!data) break
    out.push(...(data as T[]))
    if (data.length < pageSize) break
  }
  return { data: out, error: null }
}

export async function fetchAllRows<T = Record<string, unknown>>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await make(from, from + pageSize - 1)
    if (error || !data) break
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}
