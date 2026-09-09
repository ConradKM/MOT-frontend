import { useCallback, useEffect, useRef, useState } from 'react'
import { Call, Device } from '@twilio/voice-sdk'
import { getVoiceToken } from '../api/communications'
import { isApiError } from '../lib/errors'

export type DialerStatus =
  | 'initialising'
  | 'ready'
  | 'calling'
  | 'ringing'
  | 'connected'
  | 'ended'
  | 'failed'

export interface TwilioDialer {
  status: DialerStatus
  error: string | null
  isMuted: boolean
  /** True while the Device is registered and idle (or a previous call ended). */
  canCall: boolean
  /**
   * The exact destination handed to `Device.connect()` for the call that is
   * currently ringing/connecting/connected, or `null` when idle. This is the
   * single source of truth for "who are we actually on a call with" - callers
   * must not derive the active-call identity from their own selection state,
   * which can change under them mid-call.
   */
  activeNumber: string | null
  startCall: (to: string) => Promise<void>
  hangUp: () => void
  toggleMute: () => void
  sendDigit: (digit: string) => void
}

const IDLE_STATUSES: DialerStatus[] = ['ready', 'ended', 'failed']

function tokenError(err: unknown): string {
  if (isApiError(err)) {
    if (err.code === 503) return "Browser calling isn't set up for this deployment yet."
    if (err.code === 409) return 'This business has no outbound phone number configured.'
  }
  return "Couldn't get a calling token. Please try again."
}

function callError(err: unknown): string {
  const e = err as { code?: number; name?: string; message?: string }
  if (e?.name === 'NotAllowedError' || e?.name === 'NotFoundError' || e?.code === 31401) {
    return 'Allow microphone access in your browser to place calls.'
  }
  if (e?.code === 31005 || e?.code === 53405) {
    return 'Call failed to connect - check your internet connection and try again.'
  }
  if (e?.code === 31003) return "Couldn't reach the calling service."
  if (e?.code === 13224 || e?.code === 21215) return "That number can't be called."
  return e?.message || 'Something went wrong with the call.'
}

/**
 * Twilio Voice SDK browser dialler. Fetches a short-lived Voice Access Token
 * from the backend, registers a `Device`, and exposes call controls. Only
 * initialises while `enabled` is true, and always tears the `Device` down on
 * unmount - it never touches inbound / ConversationRelay handling.
 */
export function useTwilioDevice({ enabled }: { enabled: boolean }): TwilioDialer {
  const [status, setStatus] = useState<DialerStatus>('initialising')
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [activeNumber, setActiveNumber] = useState<string | null>(null)

  const deviceRef = useRef<Device | null>(null)
  const callRef = useRef<Call | null>(null)

  // `startCall` reads the latest status without depending on it (a dep would
  // re-create the callback on every transition and drop `call` listeners).
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const refreshToken = useCallback(async () => {
    try {
      const { token } = await getVoiceToken()
      deviceRef.current?.updateToken(token)
    } catch {
      /* the next call attempt surfaces the failure */
    }
  }, [])

  useEffect(() => {
    if (!enabled || deviceRef.current) return
    let cancelled = false

    ;(async () => {
      setStatus('initialising')
      setError(null)
      try {
        const { token } = await getVoiceToken()
        if (cancelled) return
        const device = new Device(token, {
          logLevel: 'error',
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        })
        device.on('registered', () => setStatus('ready'))
        device.on('unregistered', () => setStatus('initialising'))
        device.on('tokenWillExpire', () => void refreshToken())
        device.on('error', (err: unknown) => {
          setError(callError(err))
          setStatus('failed')
          setActiveNumber(null)
        })
        deviceRef.current = device
        await device.register()
        if (cancelled) return
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setError(tokenError(err))
        setStatus('failed')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, refreshToken])

  useEffect(() => {
    return () => {
      try {
        callRef.current?.disconnect()
        deviceRef.current?.destroy()
      } catch {
        /* best effort */
      }
      deviceRef.current = null
      callRef.current = null
    }
  }, [])

  const startCall = useCallback(async (to: string) => {
    const device = deviceRef.current
    if (!device || !IDLE_STATUSES.includes(statusRef.current)) return
    const dest = to.trim()
    if (!dest) {
      setError('Enter a number to call.')
      return
    }

    setError(null)
    setStatus('calling')
    setIsMuted(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch (err) {
      setError(callError(err))
      setStatus('failed')
      return
    }

    try {
      // Lock the active-call identity to exactly what Twilio is dialling,
      // before the connect resolves - nothing downstream should ever show a
      // different number while this call is live.
      setActiveNumber(dest)
      const call = await device.connect({ params: { To: dest } })
      callRef.current = call
      call.on('ringing', () => setStatus('ringing'))
      call.on('accept', () => setStatus('connected'))
      call.on('reconnected', () => setStatus('connected'))
      call.on('disconnect', () => {
        callRef.current = null
        setStatus('ended')
        setActiveNumber(null)
      })
      call.on('cancel', () => {
        callRef.current = null
        setStatus('ended')
        setActiveNumber(null)
      })
      call.on('reject', () => {
        callRef.current = null
        setStatus('ended')
        setActiveNumber(null)
      })
      call.on('error', (err: unknown) => {
        callRef.current = null
        setError(callError(err))
        setStatus('failed')
        setActiveNumber(null)
      })
    } catch (err) {
      setError(callError(err))
      setStatus('failed')
      setActiveNumber(null)
    }
  }, [])

  const hangUp = useCallback(() => {
    callRef.current?.disconnect()
    deviceRef.current?.disconnectAll()
    callRef.current = null
    setStatus((s) => (s === 'ready' ? s : 'ended'))
    setActiveNumber(null)
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted((muted) => {
      const next = !muted
      callRef.current?.mute(next)
      return next
    })
  }, [])

  const sendDigit = useCallback((digit: string) => {
    callRef.current?.sendDigits(digit)
  }, [])

  return {
    status,
    error,
    isMuted,
    canCall: IDLE_STATUSES.includes(status),
    activeNumber,
    startCall,
    hangUp,
    toggleMute,
    sendDigit,
  }
}
