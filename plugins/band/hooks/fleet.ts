import type { Beat, Activity, FleetRow, Pr, Work } from '../types'

export const BEAT_MS = 2 * 60 * 1000
export const GONE_MS = 10 * 60 * 1000
export const PRUNE_MS = 24 * 60 * 60 * 1000

const ORDER: Record<Activity, number> = { asking: 0, waiting: 1, working: 2, ended: 3 }

export function fleetDir(home: string): string {
  return `${home.replace(/[\\/]+$/, '').replace(/\\/g, '/')}/.claude/band-fleet`
}

export function placeKey(top: string): string {
  return top.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function pushedSince(pr: Pr): boolean {
  const sha = pr.review?.sha?.toLowerCase()
  const head = pr.head?.toLowerCase()
  return !!sha && !!head && !head.startsWith(sha) && !sha.startsWith(head)
}

export function nameOf(worktree: string | undefined, branch: string | undefined, prefix: string, top = ''): string {
  if (branch && branch !== 'main' && branch !== 'HEAD') return prefix && branch.startsWith(prefix) ? branch.slice(prefix.length) : branch
  return worktree ?? (top.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || top)
}

export function beatOf(id: string, top: string, work: Work | null, state: Activity, since: number, at: number): Beat {
  return {
    id,
    top,
    worktree: work?.worktree,
    branch: work?.branch,
    issue: work?.issue,
    pr: work?.pr
      ? {
          number: work.pr.number,
          state: work.pr.state,
          ci: work.pr.ci,
          running: work.pr.running || undefined,
          verdict: work.pr.review?.verdict,
          pushedSince: pushedSince(work.pr) || undefined,
        }
      : undefined,
    state,
    since,
    at,
  }
}

export function parseBeat(text: string): Beat | undefined {
  try {
    const b = JSON.parse(text) as Beat
    if (typeof b?.id !== 'string' || typeof b.at !== 'number' || typeof b.state !== 'string') return undefined
    return b
  } catch {
    return undefined
  }
}

export function isLive(b: Beat, now: number): boolean {
  return b.state !== 'ended' && now - b.at < GONE_MS
}

export function fleetOf(beats: Beat[], now: number, self: string): FleetRow[] {
  const live = beats.filter(b => isLive(b, now))
  const counts = new Map<string, number>()
  for (const b of live) {
    if (!b.worktree) continue
    const k = placeKey(b.top)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return live
    .map(b => ({ ...b, self: b.id === self, shared: !!b.worktree && (counts.get(placeKey(b.top)) ?? 0) > 1 }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.since - b.since)
}

export function sharedWith(rows: FleetRow[], self: string): number {
  const me = rows.find(r => r.id === self)
  if (!me?.shared) return 0
  return rows.filter(r => r.id !== self && placeKey(r.top) === placeKey(me.top)).length
}
