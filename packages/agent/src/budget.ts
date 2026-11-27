export const resultChars = 20_000
export const shotsPerCall = 4
export const readBytes = 24_000
export const foundLines = 400
export const shownProblems = 10
export const namedIds = 5
export const imagesPerCall = 10
export const deckPage = 50

export const scriptLimits = {
  ms: 20_000,
  memory: 64 * 1024 * 1024,
  stack: 1024 * 1024,
  logs: 50,
} as const
