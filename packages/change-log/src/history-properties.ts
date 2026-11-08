import type {Id} from "../../deck/src/model.ts"
import type {Contribution} from "./index.ts"

export const adoptionPropertyKey = "$adoption"
export function contributionProperties(event: Contribution): {node: Id; key: string}[] {
  return event.patches.flatMap(patch => (patch.keys.length === 0 && patch.adopts ? [adoptionPropertyKey] : patch.keys).map(key => ({node: patch.id, key})))
}
