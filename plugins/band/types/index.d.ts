export type Ci = 'passing' | 'failing' | 'running' | 'none'

export type Review = { round: number; verdict: string; open?: string; sha?: string }

export type Pr = { number: number; state: string; ci: Ci; running?: number; head?: string; issue?: number; review?: Review }

export type Work = {
  worktree?: string
  branch: string
  issue?: number
  pr?: Pr
}

export type Activity = 'asking' | 'waiting' | 'working' | 'ended'

export type Beat = {
  id: string
  top: string
  worktree?: string
  branch?: string
  issue?: number
  pr?: { number: number; state: string; ci: Ci; running?: number; verdict?: string; pushedSince?: boolean }
  state: Activity
  since: number
  at: number
}

export type FleetRow = Beat & { self: boolean; shared: boolean }

export type Handoff =
  | { status: 'writing' }
  | { status: 'ready'; text: string; sent?: string }
  | { status: 'failed'; reason: string }

export type Commit = { sha: string; subject: string }

export type Thread = { path: string; line?: number; text: string; url: string }

export type Report = {
  place: string
  branch?: string
  issue?: number
  dirty: string[]
  unpushed: Commit[]
  upstream: boolean
  pr?: { number: number; state: string; title: string; url: string }
  threads: Thread[]
  unread: string[]
}

export type Wrapup =
  | { status: 'reading' }
  | { status: 'ready'; report: Report; asking?: boolean; filing?: boolean; filed?: { url: string; number?: number } }
  | { status: 'failed'; reason: string }

export type SkillRow = { name: string; repo: boolean }

export type SkillView = {
  top?: string
  rows: SkillRow[]
  failed?: string
  picked?: string
  text?: string
  readFailed?: string
  confirmDelete?: string
}

declare module 'claude-code' {
  interface PluginState {
    band: { work: Work | null; focus: number | null; pending: Record<string, number>; fleet: FleetRow[]; handoff: Handoff | null; wrapup: Wrapup | null; skillView: SkillView | null; skillPick: string | null }
  }
}
