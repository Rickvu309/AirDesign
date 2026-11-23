export const refusals = [
  "stale",
  "person-protected",
  "run-fenced",
  "dead",
  "present",
  "limit",
  "group-box",
  "locked",
  "kind",
  "last-slide",
] as const

export type Refusal = (typeof refusals)[number]
