import { trait } from "./trait-decl.js"
import { choice, count, mark, readValue, record, union } from "./value-kind.js"

const duration = count(10, 10_000)
const delay = count(0, 86_400_000)
const side = choice(["left", "right", "top", "bottom"])
const advance = union({ click: mark, delay })
const timed = { duration, advance }
const directed = { direction: side, duration, advance }

const value = union({
  none: record({ advance }),
  dissolve: record(timed),
  push: record(directed),
  moveIn: record(directed),
  moveOut: record(directed),
})

export const transition = trait("own", { version: 0, shape: "b27cd785" }, { value })

export function readStoredTransition(raw: unknown) {
  if (raw === "kept") return "kept" as const
  return readValue(transition.fields.value, raw)
}

export type TransitionValue = Exclude<NonNullable<ReturnType<typeof readStoredTransition>>, "kept">
