import { decide, version, type Register } from "./decide.js"

export type Queued = {
  readonly base: number
  readonly value: string
}

export function unsent<Item>(queue: readonly Item[], acknowledged: number): readonly Item[] {
  return queue.slice(acknowledged)
}

export function replay(register: Register, pending: readonly Queued[]): Register {
  let current = register
  for (const edit of pending) {
    if (edit.base !== version(current)) {
      continue
    }
    const decision = decide(current, { command: "person", value: edit.value })
    if (decision.decision !== "apply") {
      throw new Error("person edit refused")
    }
    current = decision.register
  }
  return current
}
