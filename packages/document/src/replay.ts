import { decide, foldRegister, version, type Register, type StoredRegister } from "./decide.js"
import { rootElement, type ElementId } from "./element-id.js"

export type Queued = {
  readonly base: number
  readonly value: string
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

export function replay(register: StoredRegister, pending: readonly Queued[]): Register {
  let current = foldRegister(register)
  for (const edit of pending) {
    if (edit.base !== versionAt(current, edit.node)) {
      continue
    }
    const decision = decide(
      current,
      edit.node === undefined
        ? { command: "person", value: edit.value }
        : { command: "person", value: edit.value, node: edit.node },
    )
    if (decision.decision !== "apply") {
      throw new Error("person edit refused")
    }
    current = decision.register
  }
  return current
}
