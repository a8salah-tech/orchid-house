import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// ✅ عميل service-role للاستعلامات الداخلية (تجاوز RLS) — يُستخدم فقط داخل السيرفر للتحقق من هوية المُستدعي
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type Caller = { id: string; role: string; is_active: boolean }

// ✅ يتحقق من جلسة Supabase الموجودة في كوكيز الطلب، ثم يربطها بسجل موظف نشِط.
// يرجع null لو ما فيش جلسة، أو الموظف غير موجود، أو موقوف (is_active = false).
export async function getCaller(): Promise<Caller | null> {
  const jar = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        // القراءة فقط — لا نكتب كوكيز من داخل مسارات الـAPI هذه
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const { data: emp } = await admin
    .from('employees')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single()

  if (!emp || !emp.is_active) return null
  return emp as Caller
}

// ✅ نفس منطق AuthProvider.hasPermission: صلاحية 'all' تعني كل شيء، وإلا يجب أن يكون المفتاح true
export async function callerHasPermission(emp: Caller, key: string): Promise<boolean> {
  const { data } = await admin
    .from('roles_permissions')
    .select('permissions')
    .eq('role', emp.role)
    .single()
  const p = (data?.permissions || {}) as Record<string, boolean>
  return p.all === true || p[key] === true
}
