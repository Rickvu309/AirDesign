import { trait } from "./trait-decl.js"
import { choice, emu, list, record, readValue } from "./value-kind.js"

export const guideLimit = 200

const guide = record({ axis: choice(["x", "y"]), offset: emu })

export const guides = trait("own", { version: 1, shape: "9280948e" }, { ruler: list(guide, 0, guideLimit) })

export type Guide = { readonly axis: "x" | "y"; readonly offset: number }

export function readGuideList(raw: unknown): readonly Guide[] | null {
  return readValue(guides.fields.ruler, raw)
}
