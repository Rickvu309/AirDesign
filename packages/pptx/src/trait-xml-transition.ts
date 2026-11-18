import type { TransitionValue } from "@airdesign/document"
import { readArrival } from "./transition-read.js"
import { writeArrival } from "./transition-write.js"
import { whole, type TraitXml } from "./xml-codec.js"

export const transitionXml: TraitXml<"transition"> = {
  slot: null,
  fields: {
    value: whole({
      read: (parts, at): TransitionValue | null => {
        const arrival = readArrival(parts.get(at.part))
        return arrival.state === "value" ? arrival.value : null
      },
      write: (parts, at, value) => writeArrival(parts, at.part, value),
    }),
  },
}
