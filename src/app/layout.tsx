import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from './components/AuthProvider'

export const metadata: Metadata = { title: "Orchid House" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}