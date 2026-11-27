import type { Intent } from "./intent-read.js"
import type { LayerKind } from "./kind-fields.js"

export type StartContent = Omit<Extract<Intent, { readonly op: "insert"; readonly kind: LayerKind }>, "parent">
export type Placeholder = { readonly name: string; readonly chars: string }

export type StartRules = {
  readonly deckName: string
  readonly title: Placeholder
  readonly subtitle: Placeholder
  readonly marginShare: number
  readonly gapShare: number
  readonly middleShare: number
  readonly titleHighShare: number
  readonly subtitleHighShare: number
  readonly titleTopShare: number
  readonly titleOnlyHighShare: number
  readonly content: { readonly text: readonly StartContent[]; readonly grid: readonly StartContent[] }
}
