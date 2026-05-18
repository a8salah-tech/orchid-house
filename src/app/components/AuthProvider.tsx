'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Employee {
  id: string; name: string; name_en?: string
  role: string; department?: string; branch_id?: string; is_active: boolean
}

interface AuthContextType {
  employee: Employee | null
  permissions: Record<string, boolean>
  loading: boolean
  hasPermission: (key: string) => boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  employee: null, permissions: {}, loading: true,
  hasPermission: () => false, signOut: async () => {},
})

export function useAuth() { return useContext(AuthContext) }

const PUBLIC_PATHS = ['/login', '/unauthorized', '/register']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setEmployee(null)
        setPermissions({})
        if (!PUBLIC_PATHS.includes(pathname)) router.push('/login')
        setLoading(false)
        return
      }

      // جيب بيانات الموظف والصلاحيات
      const { data: empData } = await supabase
        .from('employees')
        .select('id, name, name_en, role, department, branch_id, is_active')
        .eq('auth_user_id', user.id)
        .single()

      if (!empData || !empData.is_active) {
        await supabase.auth.signOut()
        router.push('/login')
        setLoading(false)
        return
      }

      setEmployee(empData)

      // جيب الصلاحيات
      const { data: roleData } = await supabase
        .from('roles_permissions')
        .select('permissions')
        .eq('role', empData.role)
        .single()

      setPermissions(roleData?.permissions || {})
    } catch {
      setEmployee(null)
      setPermissions({})
    }
    setLoading(false)
  }, [pathname])

  useEffect(() => { loadUser() }, [loadUser])

  // مراقبة تغيير Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setEmployee(null)
        setPermissions({})
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        loadUser()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function hasPermission(key: string): boolean {
    if (!employee) return false
    if (permissions.all === true) return true // مدير النظام
    return permissions[key] === true
  }

  async function signOut() {
    await supabase.auth.signOut()
    setEmployee(null)
    setPermissions({})
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ employee, permissions, loading, hasPermission, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
