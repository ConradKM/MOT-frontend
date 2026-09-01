import { Link, Outlet } from 'react-router-dom'

export function CustomerLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm font-semibold text-slate-900">
            MOT Garage
          </Link>
          <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Garage staff sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
