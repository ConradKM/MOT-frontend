import { describe, expect, it } from 'vitest'
import { extractIssueRefs } from './require-linked-issue.mjs'

const REPO = 'ConradKM/MOT-frontend'
const refs = (text) => extractIssueRefs(text, REPO)
const numbers = (text) => refs(text).map((r) => r.number)

describe('extractIssueRefs — finding a reference', () => {
  it('finds a closing keyword reference', () => {
    expect(refs('Closes #12')).toEqual([
      { owner: 'ConradKM', repo: 'MOT-frontend', number: 12 },
    ])
  })

  it.each(['Closes #12', 'Fixes #12', 'Refs #12', 'Related to #12', 'see #12.', '(#12)'])(
    'finds the reference in %p however it is phrased',
    (text) => {
      expect(numbers(text)).toEqual([12])
    },
  )

  it('finds a reference at the very start of the text', () => {
    expect(numbers('#12 is the issue')).toEqual([12])
  })

  it('finds a cross-repository reference', () => {
    expect(refs('Refs ConradKM/MOT-backend#8')).toEqual([
      { owner: 'ConradKM', repo: 'MOT-backend', number: 8 },
    ])
  })

  it('finds a full issue URL', () => {
    expect(refs('See https://github.com/ConradKM/MOT-backend/issues/8')).toEqual([
      { owner: 'ConradKM', repo: 'MOT-backend', number: 8 },
    ])
  })

  it('finds several distinct references', () => {
    expect(numbers('Closes #12, refs #34 and #56')).toEqual([12, 34, 56])
  })

  it('reports each issue once, however many times it is mentioned', () => {
    expect(numbers('Closes #12. Really, #12. See also #12')).toEqual([12])
  })

  it('treats a cross-repo reference as distinct from the same number locally', () => {
    expect(refs('Closes #12 and ConradKM/MOT-backend#12')).toHaveLength(2)
  })
})

describe('extractIssueRefs — not mistaking other text for a reference', () => {
  it('returns nothing for a PR that references no issue', () => {
    expect(refs('Tidy up the README wording.')).toEqual([])
  })

  it('returns nothing for empty or missing text', () => {
    expect(refs('')).toEqual([])
    expect(extractIssueRefs(undefined, REPO)).toEqual([])
    expect(extractIssueRefs(null, REPO)).toEqual([])
  })

  it('ignores a reference inside a fenced code block', () => {
    // A code sample is documentation, not a statement about this PR.
    expect(numbers('```js\nconst colour = "#12"\n```')).toEqual([])
  })

  it('ignores a reference inside inline code', () => {
    expect(numbers('The literal `#12` is used as a CSS id.')).toEqual([])
  })

  it('ignores a URL fragment, which is not a reference', () => {
    expect(numbers('See https://example.com/docs#12 for details.')).toEqual([])
  })

  it('does not read a hex colour as a reference to a real issue', () => {
    // #123456 parses as a number here; the caller then asks GitHub whether
    // issue 123456 exists, and a repository this size has no such issue. This
    // records that the syntactic match is expected, and why it is harmless.
    expect(numbers('Changed the badge to #123456.')).toEqual([123456])
  })

  it('ignores a bare hash with no number', () => {
    expect(numbers('The # character is fine.')).toEqual([])
  })

  it('ignores a zero or negative issue number', () => {
    expect(numbers('Closes #0')).toEqual([])
  })

  it('does not treat a markdown heading as a reference', () => {
    expect(numbers('# Summary\n\nSome description.')).toEqual([])
  })
})
