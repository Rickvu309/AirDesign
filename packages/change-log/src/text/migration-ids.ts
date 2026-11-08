import {createHash} from "node:crypto"
import {id, type Id} from "../../../deck/src/model.ts"

export type TextLifetime = {kind: "initial"} | {kind: "contribution"; command: string}
export type TextLifetimeInput = {deck: Id; element: Id; lifetime: TextLifetime}
export type TextLifetimeAllocation = TextLifetimeInput & {frame: Id; paragraph: Id}
function key(input: TextLifetimeInput): string { return JSON.stringify([input.deck, input.element, input.lifetime.kind === "initial" ? ["initial"] : ["contribution", input.lifetime.command]]) }
export function allocateTextLifetimeIds(inputs: TextLifetimeInput[], historicalUsedIds: readonly Id[]): TextLifetimeAllocation[] {
  const reserved = new Set(historicalUsedIds)
  for (const input of inputs) { reserved.add(input.deck); reserved.add(input.element) }
  const sorted = [...inputs].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)
  const seen = new Set<string>()
  return sorted.map(input => {
    const identity = key(input)
    if (seen.has(identity)) throw new Error("duplicate-text-lifetime")
    seen.add(identity)
    function allocate(slot: "frame" | "paragraph"): Id {
      for (let collision = 0; collision < Number.MAX_SAFE_INTEGER; collision++) {
        const candidate = id("t" + createHash("sha256").update(JSON.stringify([identity, slot, collision])).digest("hex").slice(0, 31))
        if (!reserved.has(candidate)) { reserved.add(candidate); return candidate }
      }
      throw new Error("text-id-space-exhausted")
    }
    return {...input, frame: allocate("frame"), paragraph: allocate("paragraph")}
  })
}
