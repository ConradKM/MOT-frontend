import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server'
import { ApiError, apiFetch, setOnAuthFailure } from './client'
import { clearTokens, getAccessToken, setAccessToken, setTokens } from './tokens'
import { makeJwt } from '../test/fixtures'

const URL = '*/api/things'

/** Captures the Authorization header each request arrived with. */
function recordAuth(): string[] {
  const seen: string[] = []
  server.use(
    http.get(URL, ({ request }) => {
      seen.push(request.headers.get('Authorization') ?? '')
      return HttpResponse.json({ ok: true })
    }),
  )
  return seen
}

let onAuthFailure: ReturnType<typeof vi.fn>

beforeEach(() => {
  clearTokens()
  onAuthFailure = vi.fn()
  setOnAuthFailure(onAuthFailure)
})

afterEach(() => {
  // Leave the module-level handler in a harmless state for other suites.
  setOnAuthFailure(() => {})
})

describe('apiFetch — request shaping', () => {
  it('attaches the stored access token as a bearer credential', async () => {
    setTokens('access-1', 'refresh-1')
    const seen = recordAuth()
    await apiFetch('/api/things')
    expect(seen).toEqual(['Bearer access-1'])
  })

  it('sends no credential when nobody is signed in', async () => {
    const seen = recordAuth()
    await apiFetch('/api/things')
    expect(seen).toEqual([''])
  })

  it('omits the credential for endpoints marked skipAuth', async () => {
    // Login/register must not send a stale token — the backend would reject it.
    setTokens('access-1', 'refresh-1')
    const seen = recordAuth()
    await apiFetch('/api/things', { skipAuth: true })
    expect(seen).toEqual([''])
  })

  it('serialises a body as JSON and declares the content type', async () => {
    let received: { body: unknown; contentType: string | null } | undefined
    server.use(
      http.post(URL, async ({ request }) => {
        received = {
          body: await request.json(),
          contentType: request.headers.get('Content-Type'),
        }
        return HttpResponse.json({ id: 'x' })
      }),
    )
    await apiFetch('/api/things', { method: 'POST', body: { name: 'Fiesta' } })
    expect(received).toEqual({ body: { name: 'Fiesta' }, contentType: 'application/json' })
  })

  it('sends no content-type for a body-less request', async () => {
    let contentType: string | null = 'unset'
    server.use(
      http.delete(URL, ({ request }) => {
        contentType = request.headers.get('Content-Type')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await apiFetch('/api/things', { method: 'DELETE' })
    expect(contentType).toBeNull()
  })
})

describe('apiFetch — responses', () => {
  it('resolves with the parsed JSON body', async () => {
    server.use(http.get(URL, () => HttpResponse.json([{ id: 'v1' }])))
    await expect(apiFetch('/api/things')).resolves.toEqual([{ id: 'v1' }])
  })

  it('resolves with undefined for a 204, without trying to parse a body', async () => {
    server.use(http.delete(URL, () => new HttpResponse(null, { status: 204 })))
    await expect(apiFetch('/api/things', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('resolves with an empty collection when the server has nothing to return', async () => {
    server.use(http.get(URL, () => HttpResponse.json([])))
    await expect(apiFetch('/api/things')).resolves.toEqual([])
  })
})

describe('apiFetch — error mapping', () => {
  it.each([
    [400, 'Bad request.'],
    [403, 'You do not have permission.'],
    [404, 'Not found.'],
    [409, 'That slot is already taken.'],
    [500, 'Server exploded.'],
  ])('turns a %i into an ApiError carrying the server’s message', async (code, message) => {
    server.use(http.get(URL, () => HttpResponse.json({ code, status: 'x', message }, { status: code })))
    const err = await apiFetch('/api/things').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code, message })
  })

  it('exposes 422 field errors for a form to render', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json(
          { code: 422, status: 'x', errors: { json: { email: ['Not a valid email.'] } } },
          { status: 422 },
        ),
      ),
    )
    const err = (await apiFetch('/api/things', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(err.fieldErrors).toEqual({ email: ['Not a valid email.'] })
  })

  it('still produces a usable error when the body is not JSON at all', async () => {
    // A proxy or gateway can return an HTML error page; the app must not crash
    // trying to parse it.
    server.use(http.get(URL, () => new HttpResponse('<html>502</html>', { status: 502 })))
    const err = (await apiFetch('/api/things').catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe(502)
    expect(err.message).toBe('Request failed with status 502')
  })

  it('rejects when the network itself fails', async () => {
    server.use(http.get(URL, () => HttpResponse.error()))
    await expect(apiFetch('/api/things')).rejects.toThrow()
  })
})

describe('apiFetch — silent token refresh on 401', () => {
  it('refreshes once and retries the original request', async () => {
    setTokens('stale-access', 'good-refresh')
    let calls = 0
    server.use(
      http.get(URL, ({ request }) => {
        calls++
        if (request.headers.get('Authorization') === 'Bearer stale-access') {
          return HttpResponse.json({ code: 401, status: 'x' }, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
      http.post('*/api/auth/refresh', () => HttpResponse.json({ access_token: 'fresh-access' })),
    )

    await expect(apiFetch('/api/things')).resolves.toEqual({ ok: true })
    expect(calls).toBe(2)
    expect(getAccessToken()).toBe('fresh-access')
    expect(onAuthFailure).not.toHaveBeenCalled()
  })

  it('sends the refresh token — not the access token — to the refresh endpoint', async () => {
    setTokens('stale-access', 'good-refresh')
    let refreshAuth: string | null = null
    server.use(
      http.get(URL, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh-access'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 401, status: 'x' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', ({ request }) => {
        refreshAuth = request.headers.get('Authorization')
        return HttpResponse.json({ access_token: 'fresh-access' })
      }),
    )
    await apiFetch('/api/things')
    expect(refreshAuth).toBe('Bearer good-refresh')
  })

  it('signs the user out when the session can no longer be refreshed', async () => {
    setTokens('stale-access', 'dead-refresh')
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ code: 401, status: 'x', msg: 'Token has expired' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', () => HttpResponse.json({ code: 401, status: 'x' }, { status: 401 })),
    )

    const err = (await apiFetch('/api/things').catch((e: unknown) => e)) as ApiError
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(err.code).toBe(401)
    expect(err.message).toBe('Token has expired')
  })

  it('signs the user out immediately when there is no refresh token to try', async () => {
    setAccessToken('stale-access') // an access token with no refresh alongside it
    server.use(http.get(URL, () => HttpResponse.json({ code: 401, status: 'x' }, { status: 401 })))

    await expect(apiFetch('/api/things')).rejects.toBeInstanceOf(ApiError)
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
  })

  it('does not attempt a refresh for a skipAuth request', async () => {
    // A failed login is a 401 the user must see, not a session to renew.
    let refreshes = 0
    server.use(
      http.post(URL, () =>
        HttpResponse.json({ code: 401, status: 'x', message: 'Bad credentials' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', () => {
        refreshes++
        return HttpResponse.json({ access_token: 'x' })
      }),
    )
    await expect(apiFetch('/api/things', { method: 'POST', body: {}, skipAuth: true })).rejects.toMatchObject(
      { code: 401, message: 'Bad credentials' },
    )
    expect(refreshes).toBe(0)
    expect(onAuthFailure).not.toHaveBeenCalled()
  })

  it('shares a single refresh across concurrent 401s instead of stampeding', async () => {
    // Several queries commonly fire at once on a page load; each retrying its
    // own refresh would invalidate the others' brand-new tokens.
    setTokens('stale-access', 'good-refresh')
    let refreshes = 0
    server.use(
      http.get(URL, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh-access'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 401, status: 'x' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', async () => {
        refreshes++
        return HttpResponse.json({ access_token: 'fresh-access' })
      }),
    )

    const results = await Promise.all([
      apiFetch('/api/things'),
      apiFetch('/api/things'),
      apiFetch('/api/things'),
    ])
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(refreshes).toBe(1)
  })

  it('does not retry a second time if the retried request is also unauthorised', async () => {
    setTokens('stale-access', 'good-refresh')
    let attempts = 0
    server.use(
      http.get(URL, () => {
        attempts++
        return HttpResponse.json({ code: 401, status: 'x' }, { status: 401 })
      }),
      http.post('*/api/auth/refresh', () => HttpResponse.json({ access_token: makeJwt('e1') })),
    )
    await expect(apiFetch('/api/things')).rejects.toBeInstanceOf(ApiError)
    expect(attempts).toBe(2)
  })
})
