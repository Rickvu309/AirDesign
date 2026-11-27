import type { Intent } from "./intent-read.js"

type Unplaced<C> = C extends { readonly slide: unknown } ? Omit<C, "slide"> : never

export type StartContent = Unplaced<Extract<Intent, { readonly op: "add" }>>
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
