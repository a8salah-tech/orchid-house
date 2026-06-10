'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: true, persistSession: true } }
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

const PUBLIC_PATHS = ['/login', '/unauthorized', '/register', '/menu', '/bookings']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  
  const loadedUserId = useRef<string | null>(null)

  const loadUser = useCallback(async (forceReload = false) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const currentPath = window.location.pathname
      if (!user) {
        setEmployee(null)
        setPermissions({})
        loadedUserId.current = null
        if (!PUBLIC_PATHS.some(p => currentPath.startsWith(p))) router.push('/login')
        return
      }

      // ✅ لو نفس اليوزر وماشي تحميل، ما تكملش
      if (!forceReload && loadedUserId.current === user.id) {
        return
      }

      const { data: empData } = await supabase
        .from('employees')
        .select('id, name, name_en, role, department, branch_id, is_active')
        .eq('auth_user_id', user.id)
        .single()

      if (!empData || !empData.is_active) {
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      const { data: roleData } = await supabase
        .from('roles_permissions')
        .select('permissions')
        .eq('role', empData.role)
        .single()

      setEmployee(empData)
      setPermissions(roleData?.permissions || {})
      loadedUserId.current = user.id

    } catch {
      setEmployee(null)
      setPermissions({})
      loadedUserId.current = null
    } finally {
      setLoading(false)
    }
  }, [router])

  // ✅ مرة واحدة عند البداية بس
  useEffect(() => { loadUser() }, [loadUser])

  // ✅ فقط SIGNED_OUT - مش SIGNED_IN ولا TOKEN_REFRESHED
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setEmployee(null)
        setPermissions({})
        loadedUserId.current = null
        router.push('/login')
      }
      // ✅ SIGNED_IN و TOKEN_REFRESHED محذوفين عمداً
    })
    return () => subscription.unsubscribe()
  }, [router])

  function hasPermission(key: string): boolean {
    if (!employee) return false
    if (permissions.all === true) return true
    return permissions[key] === true
  }

  async function signOut() {
    await supabase.auth.signOut()
    setEmployee(null)
    setPermissions({})
    loadedUserId.current = null
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ employee, permissions, loading, hasPermission, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}