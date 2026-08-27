import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
  variant: 'error' | 'success'
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastItem['variant']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, variant: ToastItem['variant'] = 'error') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md px-4 py-3 text-sm text-white shadow-lg ${
              t.variant === 'error' ? 'bg-red-600' : 'bg-emerald-600'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
