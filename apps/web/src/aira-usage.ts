import type { WeekUsage } from "@/aira-wire"

export type ClockFormat = { readonly locale?: string; readonly timeZone?: string }

export function usagePercent(usage: WeekUsage): number {
  if (usage.allowed <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((usage.used / usage.allowed) * 100)))
}

export function resetsWhen(resets: string, format: ClockFormat = {}): string {
  const at = new Date(resets)
  const zone = format.timeZone === undefined ? {} : { timeZone: format.timeZone }
  return new Intl.DateTimeFormat(format.locale, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    ...zone,
  })
    .format(at)
    .replace(/\s/gu, " ")
}
