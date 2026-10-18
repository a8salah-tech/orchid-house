// Supabase/PostgREST يُرجع 1000 صف كحد أقصى في الطلب الواحد، ويقطع الباقي بصمت.
// هذه الدالة تجلب كل الصفوف على دفعات. ⚠️ لازم يتضمن الاستعلام .order(...) ثابتًا (مثل id) حتى لا تتكرر/تضيع صفوف بين الدفعات.
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
