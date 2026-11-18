import { decide, version, type Register } from "./decide.js"
import { rootElement, type ElementId } from "./element-id.js"
import { storedValue, type Value } from "./value.js"

export type Queued = Value & {
  readonly base: number
  readonly node?: ElementId
}

export function unsent<Item>(queue: readonly Item[], acknowledged: number): readonly Item[] {
  return queue.slice(acknowledged)
}

function versionAt(register: Register, node: ElementId | undefined): number {
  const body = register.elements[node ?? rootElement]
  if (body === undefined) {
    throw new Error("missing node")
  }
  return version(body)
}

export function replay(register: Register, pending: readonly Queued[]): Register {
  let current = register
  for (const edit of pending) {
    if (edit.base !== versionAt(current, edit.node)) {
      continue
    }
    const decision = decide(
      current,
      edit.node === undefined
        ? { command: "person", ...storedValue(edit) }
        : { command: "person", ...storedValue(edit), node: edit.node },
    )
    if (decision.decision !== "apply") {
      throw new Error("person edit refused")
    }
    current = decision.register
  }
  return current
}
