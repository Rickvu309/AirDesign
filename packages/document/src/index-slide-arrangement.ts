import { type Guide, type LayoutGuide } from "./trait-guides.js"
import { type TransitionValue } from "./trait-transition.js"

export type IndexArrangement = {
  readonly transition?: TransitionValue | "kept"
  readonly guides?: readonly Guide[]
  readonly layoutGuides?: readonly LayoutGuide[]
}
