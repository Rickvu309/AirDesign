import type { DeckIndex } from "./deck-index.js"
import { holdsBorder } from "./border-conversion.js"
import { commandHolds, holdsFills, indexHolds } from "./fills-conversion.js"
import { format } from "./format.js"
import { opensRenamedKey } from "./key-alias.js"
import { holdsTemplateStyle, indexHoldsTemplateStyle, namesTemplateStyle } from "./template-style-conversion.js"

type Rowed = { readonly landed: readonly { readonly v?: number }[] }

function renamed(raw: unknown): boolean {
  return holdsFills(raw) || holdsBorder(raw) || holdsTemplateStyle(raw)
}

function rowFormat(elements: Readonly<Partial<Record<string, Rowed>>>): number {
  let highest = 1
  for (const body of Object.values(elements))
    for (const row of body?.landed ?? []) highest = Math.max(highest, row.v ?? 1)
  return highest
}

export function answeredRegister<
  Stored extends {
    readonly index?: DeckIndex
    readonly order?: readonly { readonly slide: string; readonly grid?: number; readonly row?: string }[]
    readonly elements: Readonly<Partial<Record<string, Rowed>>>
  },
>(register: Stored): Stored & { readonly format?: number } {
  const newerCommand =
    register.order?.some(
      (command) =>
        (command.grid ?? 1) > 1 ||
        (command.slide === "move-many" && command.row === "before") ||
        commandHolds(command, renamed) ||
        opensRenamedKey(command),
    ) ||
    indexHolds(register.index, renamed) ||
    indexHoldsTemplateStyle(register.index) ||
    namesTemplateStyle(register.elements)
  const rows = newerCommand === true ? format : rowFormat(register.elements)
  if (register.index === undefined) return rows > 1 ? { ...register, format: rows } : register
  const { next, ...index } = register.index
  const stored = Math.max(index.format ?? 1, next?.format ?? 1, rows)
  return { ...register, index, ...(stored > 1 ? { format: stored } : {}) }
}
