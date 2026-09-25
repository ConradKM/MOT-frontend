// A light client-side sanity check only - the server (app/phone.py) does the
// real, authoritative parsing/normalisation to E.164. This just gives fast
// feedback without making the customer type "+44" themselves: 07…, +447…
// and 00447… are all accepted, spaces/dashes/brackets are ignored.
const UK_MOBILE_RE = /^(?:\+44|0044|0)7\d{9}$/

export function isPlausibleUkMobile(value: string): boolean {
  return UK_MOBILE_RE.test(value.replace(/[\s\-()]/g, ''))
}
