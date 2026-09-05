import { useState, type FormEvent } from 'react'
import { useSimulateMessage } from '../../api/queries'
import { errorMessage } from '../../lib/errors'
import type { ConversationResult, SimulatorChannel } from '../../api/conversationSimulator'

interface Turn {
  from: 'customer' | 'assistant'
  text: string
  result?: ConversationResult
}

const CHANNELS: { value: SimulatorChannel; label: string }[] = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'VOICE', label: 'Voice (simulated transcript)' },
]

export function ConversationSimulator() {
  const [channel, setChannel] = useState<SimulatorChannel>('WHATSAPP')
  const [phone, setPhone] = useState('07123 456789')
  const [text, setText] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState<string | null>(null)
  const simulate = useSimulateMessage()

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setError(null)
    const outgoing = text.trim()
    setTurns((t) => [...t, { from: 'customer', text: outgoing }])
    setText('')

    try {
      const result = await simulate.mutateAsync({ channel, phone, text: outgoing })
      setTurns((t) => [
        ...t,
        {
          from: 'assistant',
          text: result.response_text ?? '(no automated reply - see state below)',
          result,
        },
      ])
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const handleReset = () => {
    setTurns([])
    setError(null)
  }

  return (
    <div>
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Development tool. Messages here run through the real conversation engine and can create
        real bookings, cancellations and callback requests for the phone number below - no Twilio
        or WhatsApp account is involved. This page is never available in a production
        deployment.
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as SimulatorChannel)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Simulated phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">
              Change this to start a fresh conversation, or reuse one to test a known customer.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear transcript
          </button>
        </div>

        <div className="flex h-[65vh] min-h-[420px] flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {turns.length === 0 && (
              <p className="text-sm text-slate-400">
                Send a message below to start - try "I need an MOT".
              </p>
            )}
            {turns.map((turn, i) => (
              <div key={i} className={`flex ${turn.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      turn.from === 'customer'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{turn.text}</p>
                  </div>
                  {turn.result && (
                    <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                      <div>
                        <dt className="inline font-medium">intent:</dt>{' '}
                        <dd className="inline">{turn.result.intent}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">state:</dt>{' '}
                        <dd className="inline">{turn.result.workflow_step ?? 'none'}</dd>
                      </div>
                      {turn.result.needs_human && (
                        <div className="font-medium text-amber-600">handed to a human</div>
                      )}
                      {turn.result.duplicate && (
                        <div className="font-medium text-amber-600">duplicate message, ignored</div>
                      )}
                      {turn.result.actions_performed.map((action, j) => (
                        <div key={j} className="font-medium text-emerald-600">
                          ✓ {action}
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="border-t border-slate-200 px-4 py-2 text-sm text-red-600">{error}</p>}

          <form onSubmit={handleSend} className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(e)
                  }
                }}
                rows={1}
                placeholder="Type a message as the customer…"
                className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={simulate.isPending || !text.trim()}
                className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {simulate.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
