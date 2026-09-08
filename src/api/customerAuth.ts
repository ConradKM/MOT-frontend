import { customerApiFetch } from './customerClient'

export interface CustomerTokenPair {
  access_token: string
  refresh_token: string
}

/** Knowledge-factor login: email + the booking reference from a confirmation
 * screen or email. No password involved. */
export function customerReferenceLogin(data: {
  email: string
  booking_reference: string
}): Promise<CustomerTokenPair> {
  return customerApiFetch<CustomerTokenPair>('/api/customer/auth/login/reference', {
    method: 'POST',
    body: data,
    skipAuth: true,
  })
}

export function customerPasswordLogin(data: {
  email: string
  password: string
}): Promise<CustomerTokenPair> {
  return customerApiFetch<CustomerTokenPair>('/api/customer/auth/login/password', {
    method: 'POST',
    body: data,
    skipAuth: true,
  })
}

/** Lets an already-signed-in customer start using email + password going
 * forward - the "Create an account" action on the account page. */
export function setCustomerPassword(password: string): Promise<void> {
  return customerApiFetch<void>('/api/customer/auth/set-password', {
    method: 'POST',
    body: { password },
  })
}
