import type { AgentChange } from "./agent-change.js"

type Unplaced<C> = C extends { readonly slide: unknown } ? Omit<C, "slide"> : never

export type StartContent = Unplaced<Extract<AgentChange, { readonly op: "add" }>>
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
