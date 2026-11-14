import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format bytes into a human-readable size string. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / Math.pow(1024, i)
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

/** Parse a string as a number, tolerating units/whitespace; returns null when not numeric. */
export function toNumber(s: string): number | null {
  if (s == null) return null
  const m = s.replace(/[^\d.\-]/g, '')
  if (!m) return null
  const n = Number(m)
  return Number.isFinite(n) ? n : null
}
