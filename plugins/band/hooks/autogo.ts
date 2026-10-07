import type { PromptOrigin } from 'claude-code'

import { PLUGIN } from './config'

export const AUTO_MS = 60 * 1000
export const MAX_AUTO = 3
const TYPED_ORIGINS = new Set(['composer', 'bridge'])

export function fromUser(origin: PromptOrigin | undefined): boolean {
  if (TYPED_ORIGINS.has(origin?.kind ?? '')) return true
  return origin?.kind === 'plugin' && origin.name === PLUGIN && origin.asUser === true
}

const GO_WORDS = /\b(proceed|continue|go ahead|carry on|keep going|move on|start(?: on| it)?|ship it|merge it|your go|green ?light)\b/i
const WAITING = /\b(waiting (?:for|on) your go|on your go|say go|your go to)\b/i
const CHOICE = /\bor\b|\bwhich\b|\bwhat\b|\bhow\b/i

function plain(text: string): string {
  return text
    .replace(/`+/g, '')
    .replace(/\*\*|__|\*/g, '')
    .replace(/^\s*(#+|>|[-+]\s|\d+\.\s)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function proceedLine(answer: string): string | undefined {
  const lines = answer.split(/\r?\n/).map(plain).filter(Boolean)
  const last = lines[lines.length - 1]
  if (!last) return undefined
  if (WAITING.test(last)) return last
  if (!last.endsWith('?') || !GO_WORDS.test(last) || CHOICE.test(last)) return undefined
  return last
}

export function secondsLeft(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000))
}

export function clip(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`
}
