import { iconNames } from "@airdesign/catalog"

const shownCount = 24
const startingCount = 12

export const startingIcons: readonly string[] = [
  "rocket",
  "lightbulb",
  "star",
  "heart",
  "target",
  "trophy",
  "users",
  "globe",
  "shield-check",
  "clock",
  "calendar",
  "mail",
  "phone",
  "map-pin",
  "chart-line",
  "chart-pie",
  "settings",
  "zap",
  "check",
  "leaf",
  "cloud",
  "lock",
  "search",
  "flag",
]

export function iconMatches(query: string, most = shownCount): readonly string[] {
  const words = query.trim().toLowerCase()
  if (words === "") return startingIcons.slice(0, Math.min(most, startingCount))
  const found = iconNames.filter((name) => words.split(/\s+/).every((word) => name.includes(word)))
  const first = found.filter((name) => name.startsWith(words.split(/\s+/)[0] ?? ""))
  return [...new Set([...first, ...found])].slice(0, most)
}
