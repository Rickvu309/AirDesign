import type { Box } from "./box.js"
import type { IndexElement } from "./deck-index.js"
import type { Kind } from "./properties.js"

const elementEdits = ["text", "table", "move", "resize", "remove"] as const

export type ElementEdit = (typeof elementEdits)[number]

export type ElementFacts = {
  readonly kind: Kind
  readonly text: boolean
  readonly grouped: boolean
  readonly animated: boolean
}

const boxed: readonly ElementEdit[] = ["move", "resize", "remove"]

const kindEdits: Readonly<Record<Kind, readonly ElementEdit[]>> = {
  deck: [],
  theme: [],
  master: [],
  layout: [],
  section: [],
  slide: ["text"],
  shape: ["text", ...boxed],
  picture: boxed,
  connector: boxed,
  group: ["move", "resize"],
  table: ["table", "move", "remove"],
  row: [],
  cell: [],
  chart: boxed,
  kept: ["remove"],
}

export function elementTakes(facts: ElementFacts): readonly ElementEdit[] {
  return kindEdits[facts.kind].filter((edit) => {
    if (edit === "text") return facts.text
    if (edit === "remove") return !facts.grouped && !facts.animated
    if (edit === "move" || edit === "resize") return !facts.grouped
    return true
  })
}

export function indexFacts(element: IndexElement, animated: boolean): ElementFacts {
  return { kind: element.kind, text: element.value !== null, grouped: element.grouped, animated }
}

export function boxEdits(before: Box | null, after: Box): readonly ElementEdit[] {
  if (before === null || before.cx !== after.cx || before.cy !== after.cy) return ["move", "resize"]
  return ["move"]
}
