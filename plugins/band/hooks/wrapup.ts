import type { Commit, Report, Thread } from '../types'

export const WRAPUP_PANE = 'band-wrapup'

export const THREADS_QUERY =
  'query($owner:String!,$repo:String!,$pr:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$pr){ reviewThreads(first:100){ nodes{ isResolved comments(first:1){ nodes{ path line body url } } } } } } }'

export function dirtyOf(porcelain: string): string[] {
  return porcelain
    .split('\n')
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.length > 3)
    .map(l => l.slice(3))
}

export function commitsOf(log: string): Commit[] {
  return log
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const i = l.indexOf(' ')
      return i < 0 ? { sha: l, subject: '' } : { sha: l.slice(0, i), subject: l.slice(i + 1) }
    })
}

export function firstLine(body: string): string {
  const line =
    body
      .replace(/<!--[\s\S]*?-->/g, '')
      .split('\n')
      .map(l => l.replace(/[*_`#>]/g, '').trim())
      .find(Boolean) ?? ''
  return line.length <= 160 ? line : `${line.slice(0, 157).trimEnd()}...`
}

type ThreadNode = { isResolved?: boolean; comments?: { nodes?: { path?: string; line?: number | null; body?: string; url?: string }[] } }

export function threadsOf(json: string): Thread[] {
  const j = JSON.parse(json) as { data?: { repository?: { pullRequest?: { reviewThreads?: { nodes?: ThreadNode[] } } } } }
  return (j.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [])
    .filter(n => n.isResolved === false)
    .map(n => n.comments?.nodes?.[0])
    .filter(c => c !== undefined)
    .map(c => ({ path: c.path ?? '', line: c.line ?? undefined, text: firstLine(c.body ?? ''), url: c.url ?? '' }))
}

export function repoOf(prUrl: string): { owner: string; repo: string } | undefined {
  const m = /github\.com\/([^/]+)\/([^/]+)\/pull\/\d+/.exec(prUrl)
  return m ? { owner: m[1], repo: m[2] } : undefined
}

export function isClear(r: Report): boolean {
  return r.dirty.length === 0 && r.unpushed.length === 0 && r.threads.length === 0 && (!r.pr || r.pr.state !== 'OPEN')
}

export function ghiTitle(r: Report): string {
  return r.pr ? `Leftovers from PR #${r.pr.number}: ${r.pr.title}` : `Leftovers from ${r.branch ?? r.place}`
}

export function ghiBody(r: Report): string {
  const lines = r.threads.map(t => `- \`${t.path}${t.line ? `:${t.line}` : ''}\` - ${t.text} ([thread](${t.url}))`)
  const from = r.pr ? `From the open review threads on PR #${r.pr.number}` : 'From the open review threads'
  const refs = r.issue ? `, refs #${r.issue}` : ''
  return `${lines.join('\n')}\n\n${from}${refs}. Filed by /wrapup.\n`
}

export function issueNumberOf(url: string): number | undefined {
  const m = /\/issues\/(\d+)\s*$/.exec(url.trim())
  return m ? Number(m[1]) : undefined
}
