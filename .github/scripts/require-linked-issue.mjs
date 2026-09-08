/**
 * Fails a pull request that is not related to an issue.
 *
 * Two ways to satisfy it, so the check never argues with how the team
 * actually works:
 *
 *  1. A GitHub-linked issue — anything that shows under the PR's
 *     "Development" sidebar. That covers closing keywords ("Closes #12") and
 *     issues linked by hand.
 *  2. A plain reference in the PR title or body — "Refs #12",
 *     "Related to owner/repo#12", or a full issue URL — for work that relates
 *     to an issue without closing it.
 *
 * A reference only counts if the issue actually exists and is an issue rather
 * than a pull request. That is also what stops a hex colour like `#123456`
 * from being mistaken for a reference: no such issue, so it is ignored.
 */

const GITHUB_API = process.env.GITHUB_API_URL ?? 'https://api.github.com'

/** Markdown fenced/inline code, where a `#123` is a code sample, not a reference. */
function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
}

/**
 * Every issue reference in `text`, as {owner, repo, number}. Unqualified
 * `#123` references resolve against `defaultRepo` ("owner/name").
 */
export function extractIssueRefs(text, defaultRepo) {
  if (!text) return []
  const [defaultOwner, defaultName] = defaultRepo.split('/')
  const found = new Map()

  const add = (owner, repo, number) => {
    const n = Number(number)
    if (!Number.isInteger(n) || n <= 0) return
    found.set(`${owner}/${repo}#${n}`, { owner, repo, number: n })
  }

  const source = stripCode(text)

  // https://github.com/owner/repo/issues/123
  const urlRe = /https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/g
  for (const m of source.matchAll(urlRe)) add(m[1], m[2], m[3])

  // #123 and owner/repo#123. The leading guard rejects a `#` that is part of a
  // longer token (an anchor in a URL, say) rather than a standalone reference.
  const hashRe = /(?:^|[\s([{,;:!?"'>-])(?:([\w.-]+)\/([\w.-]+))?#(\d+)\b/gm
  for (const m of source.matchAll(hashRe)) {
    add(m[1] ?? defaultOwner, m[2] ?? defaultName, m[3])
  }

  return [...found.values()]
}

async function gh(path, token, init = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  })
  return res
}

/** Issues GitHub itself considers linked to this PR (the Development sidebar). */
async function linkedIssues(owner, repo, number, token) {
  const res = await gh('/graphql', token, {
    method: 'POST',
    body: JSON.stringify({
      query: `query($owner:String!, $repo:String!, $number:Int!) {
        repository(owner:$owner, name:$repo) {
          pullRequest(number:$number) {
            closingIssuesReferences(first: 10) { nodes { number url } }
          }
        }
      }`,
      variables: { owner, repo, number },
    }),
  })
  if (!res.ok) return []
  const body = await res.json()
  return body?.data?.repository?.pullRequest?.closingIssuesReferences?.nodes ?? []
}

/** True when the reference points at a real issue (and not a pull request). */
async function isRealIssue({ owner, repo, number }, token) {
  const res = await gh(`/repos/${owner}/${repo}/issues/${number}`, token)
  if (!res.ok) return false
  const issue = await res.json()
  return !issue.pull_request
}

const FAILURE_HELP = `
This pull request is not related to an issue.

Link one, then re-run this check (editing the PR description re-runs it
automatically):

  * To close the issue when this merges, add a line to the PR description:
        Closes #123
  * If the work only relates to the issue, reference it instead:
        Refs #123
  * Or link it by hand from the PR's "Development" sidebar.

Cross-repository references (owner/repo#123) and full issue URLs both work.
If no issue covers this work yet, open one first - that is the point of the
check: every change on main should be traceable to a reason.
`.trim()

async function main() {
  const token = process.env.GITHUB_TOKEN
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!token || !eventPath) {
    console.error('GITHUB_TOKEN and GITHUB_EVENT_PATH must both be set.')
    process.exit(1)
  }

  const { readFile } = await import('node:fs/promises')
  const event = JSON.parse(await readFile(eventPath, 'utf8'))
  const pr = event.pull_request
  if (!pr) {
    console.error('This check only runs on pull_request events.')
    process.exit(1)
  }

  const [owner, repo] = event.repository.full_name.split('/')

  const linked = await linkedIssues(owner, repo, pr.number, token)
  if (linked.length > 0) {
    console.log(`Linked issue(s): ${linked.map((i) => `#${i.number}`).join(', ')}`)
    return
  }

  const refs = extractIssueRefs(`${pr.title}\n\n${pr.body ?? ''}`, event.repository.full_name)
  for (const ref of refs) {
    if (await isRealIssue(ref, token)) {
      console.log(`Referenced issue: ${ref.owner}/${ref.repo}#${ref.number}`)
      return
    }
  }

  if (refs.length > 0) {
    console.log(
      `Found reference(s) that are not open issues in this repository: ${refs
        .map((r) => `${r.owner}/${r.repo}#${r.number}`)
        .join(', ')}`,
    )
  }

  console.error(`::error::${FAILURE_HELP.split('\n')[0]}`)
  console.error(FAILURE_HELP)
  process.exit(1)
}

// Only run when invoked as a script, so the test can import the parser.
if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
