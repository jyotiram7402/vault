import { daysSince } from '@/lib/utils'
import { estimateStrength } from '@/lib/password/strength'
import { hostOf } from '@/lib/security/url'
import type { LoginItem, VaultItem } from '@/lib/vault/types'

/**
 * Vault health, computed entirely in memory from already-decrypted items.
 * Nothing here touches the network; breach counts are passed in by the caller
 * after an explicit "Check for breaches".
 */

export const OLD_PASSWORD_DAYS = 365
export const WEAK_SCORE_THRESHOLD = 2

export interface LoginWithPassword {
  item: VaultItem
  login: LoginItem
  password: string
}

export interface ReusedGroup {
  /** Never the password itself: just how many items share it. */
  count: number
  items: VaultItem[]
}

export interface HealthReport {
  totalLogins: number
  weak: VaultItem[]
  reused: ReusedGroup[]
  old: VaultItem[]
  breached: { item: VaultItem; count: number }[]
  /** Items with at least one issue. */
  affected: Set<string>
  score: number
}

/** Logins that actually have a password; everything else can't have an issue. */
export function loginsWithPasswords(items: readonly VaultItem[]): LoginWithPassword[] {
  const result: LoginWithPassword[] = []
  for (const item of items) {
    if (item.data.type !== 'login') continue
    const password = item.data.password
    if (!password) continue
    result.push({ item, login: item.data, password })
  }
  return result
}

export function computeHealth(
  items: readonly VaultItem[],
  breaches?: ReadonlyMap<string, number>,
): HealthReport {
  const logins = loginsWithPasswords(items)
  const affected = new Set<string>()

  const weak: VaultItem[] = []
  const old: VaultItem[] = []
  const breached: { item: VaultItem; count: number }[] = []
  const byPassword = new Map<string, VaultItem[]>()

  for (const entry of logins) {
    const strength = estimateStrength(entry.password, {
      username: entry.login.username,
      siteName: hostOf(entry.login.url),
    })
    if (strength.score <= WEAK_SCORE_THRESHOLD) {
      weak.push(entry.item)
      affected.add(entry.item.id)
    }

    const changedAt = entry.login.passwordUpdatedAt ?? entry.item.createdAt
    const age = daysSince(changedAt)
    if (age !== null && age >= OLD_PASSWORD_DAYS) {
      old.push(entry.item)
      affected.add(entry.item.id)
    }

    const existing = byPassword.get(entry.password)
    if (existing) existing.push(entry.item)
    else byPassword.set(entry.password, [entry.item])

    const count = breaches?.get(entry.password)
    if (count !== undefined && count > 0) {
      breached.push({ item: entry.item, count })
      affected.add(entry.item.id)
    }
  }

  const reused: ReusedGroup[] = []
  for (const group of byPassword.values()) {
    if (group.length < 2) continue
    reused.push({ count: group.length, items: group })
    for (const item of group) affected.add(item.id)
  }
  reused.sort((a, b) => b.count - a.count)

  const score =
    logins.length === 0 ? 100 : Math.round((100 * (logins.length - affected.size)) / logins.length)

  return {
    totalLogins: logins.length,
    weak,
    reused,
    old,
    breached: breached.sort((a, b) => b.count - a.count),
    affected,
    score,
  }
}

export function healthLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 45) return 'Needs work'
  return 'At risk'
}

/** Unique passwords to send through the breach check. */
export function uniquePasswords(items: readonly VaultItem[]): string[] {
  const set = new Set<string>()
  for (const entry of loginsWithPasswords(items)) set.add(entry.password)
  return Array.from(set)
}
