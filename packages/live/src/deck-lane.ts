import type { DeckId } from "@airdesign/catalog"
import { accountKey } from "./device.js"

const flushing = new Map<string, Promise<unknown>>()
const mutating = new Map<string, Promise<unknown>>()

function queued<T>(lanes: Map<string, Promise<unknown>>, deck: DeckId, work: () => Promise<T>): Promise<T> {
  const lane = `${accountKey() ?? ""}\u0005${deck}`
  const before = lanes.get(lane) ?? Promise.resolve()
  const run = before.then(
    () => work(),
    () => work(),
  )
  lanes.set(lane, run)
  return run
}

export function serial<T>(deck: DeckId, work: () => Promise<T>): Promise<T> {
  return queued(mutating, deck, work)
}

export function flushLane<T>(deck: DeckId, work: () => Promise<T>): Promise<T> {
  return queued(flushing, deck, work)
}
