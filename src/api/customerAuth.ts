import { customerApiFetch } from './customerClient'

export interface CustomerTokenPair {
  access_token: string
  refresh_token: string
}

/** Knowledge-factor login: email + a registration number of a vehicle on the account. */
export function customerLogin(data: {
  email: string
  registration_number: string
}): Promise<CustomerTokenPair> {
  return customerApiFetch<CustomerTokenPair>('/api/customer/auth/login', {
    method: 'POST',
    body: data,
    skipAuth: true,
  })
}
