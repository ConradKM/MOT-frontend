import type { ReactNode } from 'react'
import { Footer } from './Footer'

/** Shared shell for the standalone auth pages (Login/Register/Forgot/Reset
 * password) — none of them sit under the app's Layout/CustomerLayout, so
 * this is what gives them the same centred card look plus the platform
 * footer, in one place instead of four. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 px-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
      <Footer />
    </div>
  )
}
