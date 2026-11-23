import { resolveFont } from "@airdesign/catalog"
import type * as doom from "@airdesign/doom"
import { told, type ToolResult } from "./answer.js"

type Fonts =
  | { readonly ok: true; readonly changes: readonly doom.AgentChange[] }
  | { readonly ok: false; readonly result: ToolResult }

type Named = { readonly field: string; readonly font: string }

function fontsOf(change: doom.AgentChange): readonly Named[] {
  if ((change.op === "add" || change.op === "set") && change.font !== undefined)
    return [{ field: "font", font: change.font }]
  if (change.op !== "deck" || change.fonts === undefined) return []
  return Object.entries(change.fonts).map(([slot, font]) => ({ field: `fonts.${slot}`, font }))
}

function served(change: doom.AgentChange): doom.AgentChange {
  const family = (font: string) => resolveFont(font)?.family ?? font
  if ((change.op === "add" || change.op === "set") && change.font !== undefined)
    return { ...change, font: family(change.font) }
  if (change.op !== "deck" || change.fonts === undefined) return change
  const fonts = Object.fromEntries(Object.entries(change.fonts).map(([slot, font]) => [slot, family(font)]))
  return { ...change, fonts }
}

export function withCatalogFonts(changes: readonly doom.AgentChange[]): Fonts {
  for (const [at, change] of changes.entries()) {
    const unknown = fontsOf(change).find(({ font }) => resolveFont(font) === undefined)
    if (unknown !== undefined)
      return {
        ok: false,
        result: told(false, {
          ok: false,
          refusal: "field",
          change: change.op,
          at,
          field: unknown.field,
          note: `Change ${String(at + 1)} (${change.op}): field ${unknown.field}. ${unknown.font} is not in AirDesign's font catalog, so nothing landed. Name a family the catalog holds, such as Inter, Montserrat, Lora or Playfair Display.`,
        }),
      }
  }
  return { ok: true, changes: changes.map(served) }
}
