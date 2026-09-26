import type { ReactNode } from 'react'
import { Footer } from './Footer'
import logo from '../assets/logo.png'

/** Shared shell for the standalone auth pages (Login/Register/Forgot/Reset
 * password) — none of them sit under the app's Layout/CustomerLayout, so
 * this is what gives them the same split branding/form layout plus the
 * platform footer, in one place instead of four. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="hidden items-center justify-center bg-slate-900 md:flex md:w-1/2">
          <img src={logo} alt="" className="h-48 w-auto" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          <img src={logo} alt="" className="mb-6 h-16 w-auto md:hidden" />
          <div className="w-full max-w-sm rounded-lg bg-white shadow-card p-8">
            {children}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
