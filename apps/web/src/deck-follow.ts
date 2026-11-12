import type { FollowResult } from "@airdesign/live"

type Follower = { follow(deck: string): Promise<FollowResult> }

export const followPause = 2000

const ending: ReadonlySet<string> = new Set(["session", "owner", "deleted", "deck"])

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

export async function followDeck(
  link: Follower,
  deck: string,
  changed: () => Promise<void> | void,
  signal: AbortSignal,
  rest: (ms: number, signal: AbortSignal) => Promise<void> = pause,
): Promise<string | undefined> {
  while (!signal.aborted) {
    let next: FollowResult
    try {
      next = await link.follow(deck)
      if (signal.aborted) return undefined
      if (next.ok && next.changed) await changed()
    } catch {
      await rest(followPause, signal)
      continue
    }
    if (next.ok) continue
    if (ending.has(next.refusal)) return next.refusal
    await rest(followPause, signal)
  }
  return undefined
}
