import { ProtectedRoute } from '../components/ProtectedRoute'
import Layout from '../components/Layout'
import MandatoryPolicyGate from '../components/MandatoryPolicyGate'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
      <MandatoryPolicyGate />
    </ProtectedRoute>
  )
}
