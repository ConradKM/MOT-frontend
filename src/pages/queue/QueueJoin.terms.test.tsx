import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { GARAGE_ID, QUEUE_TOKEN, TERMS_TEXT, makePublicGarage, makeQueueStatus } from '../../test/fixtures'
import { renderWithAppProviders } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { QueueJoin } from './QueueJoin'

function renderJoin() {
  return renderWithAppProviders(
    <Routes>
      <Route path="/queue/:garageId" element={<QueueJoin />} />
      <Route path="/queue/:garageId/status" element={<h1>Your place</h1>} />
    </Routes>,
    { route: `/queue/${GARAGE_ID}` },
  )
}

function captureJoins() {
  const bodies: Record<string, unknown>[] = []
  server.use(
    http.post('*/api/public/:slug/queue/join', async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json({ ...makeQueueStatus(), token: QUEUE_TOKEN }, { status: 201 })
    }),
  )
  return bodies
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('First name'), 'Sam')
  await user.type(screen.getByLabelText('Mobile number'), '07123 456789')
}

describe('QueueJoin — terms and conditions', () => {
  it('requires the terms to be accepted, then sends the accepted version', async () => {
    server.use(
      http.get('*/api/public/garages/:id', () =>
        HttpResponse.json(makePublicGarage({ terms_and_conditions: TERMS_TEXT, terms_version: 4 })),
      ),
    )
    const joins = captureJoins()
    const user = userEvent.setup()
    const { container } = renderJoin()
    await fill(user)
    await expectNoA11yViolations(container)

    await user.click(screen.getByRole('button', { name: 'Join the queue' }))
    expect(
      await screen.findByText('Please accept the terms and conditions to continue.'),
    ).toBeInTheDocument()
    expect(joins).toHaveLength(0)

    await user.click(screen.getByRole('checkbox', { name: /I have read and accept the/ }))
    await user.click(screen.getByRole('button', { name: 'Join the queue' }))
    expect(await screen.findByRole('heading', { name: 'Your place' })).toBeInTheDocument()
    expect(joins[0]).toMatchObject({ terms_accepted: true, terms_version: 4 })
  })

  it('re-prompts when the terms changed while the customer was on the page', async () => {
    server.use(
      http.get('*/api/public/garages/:id', () =>
        HttpResponse.json(makePublicGarage({ terms_and_conditions: TERMS_TEXT, terms_version: 1 })),
      ),
      http.post('*/api/public/:slug/queue/join', () =>
        HttpResponse.json(
          { code: 409, status: 'Conflict', errors: { reason: 'terms_version_mismatch' } },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderJoin()
    await fill(user)
    const box = screen.getByRole('checkbox', { name: /I have read and accept the/ })
    await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Join the queue' }))

    expect(
      await screen.findByText('The terms were updated. Please read and accept the latest version.'),
    ).toBeInTheDocument()
    expect(box).not.toBeChecked()
  })

  it('is unchanged for a business without terms', async () => {
    const joins = captureJoins()
    const user = userEvent.setup()
    renderJoin()
    await fill(user)
    expect(screen.queryByRole('checkbox', { name: /accept the/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Join the queue' }))
    await screen.findByRole('heading', { name: 'Your place' })
    expect(joins[0]).not.toHaveProperty('terms_accepted')
  })
})
