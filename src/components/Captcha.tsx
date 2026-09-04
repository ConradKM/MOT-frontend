import { useEffect, useRef } from 'react'

// Provider is chosen at build time via env; kept generic so we're not locked
// to one vendor. With nothing configured (local dev / tests) this renders
// nothing and yields an empty token - a backend on CAPTCHA_PROVIDER=none
// accepts that.
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

function ensureScript(src: string): HTMLScriptElement {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
  if (existing) return existing
  const s = document.createElement('script')
  s.src = src
  s.async = true
  s.defer = true
  document.head.appendChild(s)
  return s
}

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
  reset: (id?: string) => void
}

/** Renders the configured CAPTCHA widget and reports its token via `onToken`.
 * Emits `""` on expiry / error so the caller re-requires verification.
 * Renders null / emits "" when no provider is configured. */
export function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!captchaEnabled) {
      onToken('')
      return
    }
    const provider = PROVIDER as string
    const el = containerRef.current
    if (!el) return

    const onOk = (token: string) => onToken(token)
    const onGone = () => onToken('') // expired / errored / timed out

    // --- Cloudflare Turnstile: explicit render ------------------------------
    // Turnstile only implicitly renders `.cf-turnstile` elements present when
    // its script loads; this widget mounts later, so render it by hand.
    if (provider === 'turnstile') {
      el.className = WIDGET_CLASS.turnstile
      let widgetId: string | undefined
      let stopped = false
      const script = ensureScript(SCRIPT_SRC.turnstile)

      const render = () => {
        const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile
        if (stopped || !ts || widgetId !== undefined || !containerRef.current) return
        widgetId = ts.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: onOk,
          'expired-callback': onGone,
          'error-callback': onGone,
          'timeout-callback': onGone,
        })
      }

      if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
        render()
      } else {
        script.addEventListener('load', render, { once: true })
        // Fallback poll: the script tag may already exist from a prior mount
        // while `window.turnstile` is still initialising, so `load` won't fire.
        const poll = window.setInterval(() => {
          if (stopped || (window as unknown as { turnstile?: TurnstileApi }).turnstile) {
            window.clearInterval(poll)
            render()
          }
        }, 200)
        window.setTimeout(() => window.clearInterval(poll), 15000)
      }

      return () => {
        stopped = true
        script.removeEventListener('load', render)
        const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile
        if (ts && widgetId !== undefined) {
          try {
            ts.remove(widgetId)
          } catch {
            /* widget already gone */
          }
        }
      }
    }

    // --- reCAPTCHA / hCaptcha: implicit render via data-* + globals --------
    const suffix = Math.random().toString(36).slice(2)
    const okName = `__captchaOk_${suffix}`
    const goneName = `__captchaGone_${suffix}`
    const win = window as unknown as Record<string, unknown>
    win[okName] = onOk
    win[goneName] = onGone

    el.className = WIDGET_CLASS[provider]
    el.dataset.sitekey = SITE_KEY as string
    el.dataset.callback = okName
    el.dataset.expiredCallback = goneName
    el.dataset.errorCallback = goneName
    ensureScript(SCRIPT_SRC[provider])

    return () => {
      delete win[okName]
      delete win[goneName]
    }
    // onToken is expected to be stable (useCallback in the caller).
  }, [onToken])

  if (!captchaEnabled) return null
  return <div ref={containerRef} className="mt-1" />
}
