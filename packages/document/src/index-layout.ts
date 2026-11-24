import type { IndexElement } from "./deck-index.js"

export type IndexLayout = {
  readonly part: string
  readonly name: string
  readonly floor: readonly IndexElement[]
}
