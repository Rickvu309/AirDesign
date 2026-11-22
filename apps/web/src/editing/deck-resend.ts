import type { FlushOutcome } from "@/editing/commit-edit"
import { pause } from "@/editing/deck-follow"

export const resendFirst = 1000
export const resendMost = 5000

export function resendPause(attempt: number, random: () => number): number {
  const ceiling = Math.min(resendMost, resendFirst * 2 ** attempt)
  return ceiling / 2 + (ceiling / 2) * random()
}

export async function resendPending(
  flush: () => Promise<FlushOutcome>,
  settle: (outcome: FlushOutcome) => void,
  signal: AbortSignal,
  rest: (ms: number, signal: AbortSignal) => Promise<void> = pause,
  random: () => number = Math.random,
): Promise<FlushOutcome | undefined> {
  for (let attempt = 0; ; attempt += 1) {
    await rest(resendPause(attempt, random), signal)
    if (signal.aborted) return undefined
    const outcome = await flush()
    if (signal.aborted) return undefined
    settle(outcome)
    if (outcome !== "offline" && outcome !== "empty") return outcome
  }
}
