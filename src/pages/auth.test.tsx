import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders, renderWithProviders } from '../test/utils'
import { SignIn } from './SignIn'
import { ForgotPassword } from './ForgotPassword'
import { ResetPassword } from './ResetPassword'
import { AuthProvider } from '../auth/AuthContext'
import * as authApi from '../api/auth'

vi.mock('../api/auth', async (orig) => ({
  ...(await orig<typeof import('../api/auth')>()),
  forgotPassword: vi.fn(),
  checkResetToken: vi.fn(),
  resetPassword: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

function render(ui: React.ReactElement, route = '/') {
  return renderWithProviders(<AuthProvider>{ui}</AuthProvider>, { route })
}

describe('garage sign-in (business tab)', () => {
  it('has no register/sign-up option, but has a forgot-password link', () => {
    renderWithAppProviders(
      <Routes>
        <Route path="/login" element={<SignIn />} />
      </Routes>,
      { route: '/login' },
    )
    expect(screen.queryByRole('link', { name: /register|sign up/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('shows the reset-success banner when ?reset=1', () => {
    renderWithAppProviders(
      <Routes>
        <Route path="/login" element={<SignIn />} />
      </Routes>,
      { route: '/login?reset=1' },
    )
    expect(screen.getByText(/password has been reset successfully/i)).toBeInTheDocument()
  })
})

describe('ForgotPassword page', () => {
  it('always shows the generic message and never reveals the email', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({ message: 'x' })
    const user = userEvent.setup()
    render(
      <Routes>
        <Route path="/" element={<ForgotPassword />} />
      </Routes>,
    )
    await user.type(screen.getByLabelText('Email'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(
      await screen.findByText(/if an account exists for this email address/i),
    ).toBeInTheDocument()
    expect(authApi.forgotPassword).toHaveBeenCalledWith('someone@example.com')
  })

  it('still shows the generic message when the request fails', async () => {
    vi.mocked(authApi.forgotPassword).mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(
      <Routes>
        <Route path="/" element={<ForgotPassword />} />
      </Routes>,
    )
    await user.type(screen.getByLabelText('Email'), 'x@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(
      await screen.findByText(/if an account exists for this email address/i),
    ).toBeInTheDocument()
  })
})

describe('ResetPassword page', () => {
  it('shows the invalid/expired message for a bad token', async () => {
    vi.mocked(authApi.checkResetToken).mockResolvedValue(false)
    render(
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>,
      '/reset-password?token=bad',
    )
    expect(
      await screen.findByText(/this password reset link is invalid or has expired/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('validates that the two passwords match', async () => {
    vi.mocked(authApi.checkResetToken).mockResolvedValue(true)
    const user = userEvent.setup()
    render(
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>,
      '/reset-password?token=good',
    )
    await screen.findByLabelText('New password')
    await user.type(screen.getByLabelText('New password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm new password'), 'different22')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    expect(authApi.resetPassword).not.toHaveBeenCalled()
  })
})
