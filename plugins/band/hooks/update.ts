import { MARKETPLACE } from './config'

export const UPDATE_MS = 6 * 60 * 60 * 1000
export const UPDATE_DELAY_MS = 60 * 1000

export type Installed = { id: string; scope: string }

export function ownPlugins(json: string): Installed[] {
  try {
    const list = JSON.parse(json) as { id?: unknown; scope?: unknown }[]
    if (!Array.isArray(list)) return []
    return list
      .filter(p => typeof p.id === 'string' && p.id.endsWith(`@${MARKETPLACE}`) && typeof p.scope === 'string')
      .map(p => ({ id: p.id as string, scope: p.scope as string }))
  } catch {
    return []
  }
}

export function due(stamp: string, now: number): boolean {
  try {
    const at = Number((JSON.parse(stamp) as { at?: unknown }).at)
    return !Number.isFinite(at) || now - at >= UPDATE_MS
  } catch {
    return true
  }
}
