import { useEffect, useRef } from 'react'

// Provider is chosen at build time via env; kept generic so we're not locked
// to one vendor. With nothing configured (local dev) this renders nothing and
// yields an empty token - the backend's "none" provider accepts that.
const PROVIDER = import.meta.env.VITE_CAPTCHA_PROVIDER as string | undefined
const SITE_KEY = import.meta.env.VITE_CAPTCHA_SITE_KEY as string | undefined

const SCRIPT_SRC: Record<string, string> = {
  recaptcha: 'https://www.google.com/recaptcha/api.js',
  hcaptcha: 'https://js.hcaptcha.com/1/api.js',
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
}
const WIDGET_CLASS: Record<string, string> = {
  recaptcha: 'g-recaptcha',
  hcaptcha: 'h-captcha',
  turnstile: 'cf-turnstile',
}

export const captchaEnabled = Boolean(PROVIDER && SITE_KEY && SCRIPT_SRC[PROVIDER ?? ''])

/** Renders the configured CAPTCHA widget and reports its token via `onToken`.
 * A no-op (renders null, emits "") when no provider is configured. */
export function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!captchaEnabled) {
      onToken('')
      return
    }

    const provider = PROVIDER as string
    const callbackName = `__captchaCb_${Math.random().toString(36).slice(2)}`
    ;(window as unknown as Record<string, unknown>)[callbackName] = (token: string) =>
      onToken(token)

    const el = containerRef.current
    if (el) {
      el.className = WIDGET_CLASS[provider]
      el.dataset.sitekey = SITE_KEY as string
      el.dataset.callback = callbackName
      // reCAPTCHA/hCaptcha auto-render `.g-recaptcha`/`.h-captcha` on script
      // load; Turnstile auto-renders `.cf-turnstile`. So just ensure the
      // script is present.
    }
    if (!document.querySelector(`script[src="${SCRIPT_SRC[provider]}"]`)) {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC[provider]
      s.async = true
      s.defer = true
      document.head.appendChild(s)
    }

    return () => {
      delete (window as unknown as Record<string, unknown>)[callbackName]
    }
    // onToken is expected to be stable (useCallback in the caller).
  }, [onToken])

  if (!captchaEnabled) return null
  return <div ref={containerRef} className="mt-1" />
}
