import { resolveFont } from "@airdesign/catalog"
import type * as doom from "@airdesign/doom"
import { told, type ToolResult } from "./answer.js"

type Fonts =
  | { readonly ok: true; readonly changes: readonly doom.AgentChange[] }
  | { readonly ok: false; readonly result: ToolResult }

const fontOf = (change: doom.AgentChange) =>
  (change.op === "add" || change.op === "set") && change.font !== undefined ? change.font : undefined

export function withCatalogFonts(changes: readonly doom.AgentChange[]): Fonts {
  const named: doom.AgentChange[] = []
  for (const [at, change] of changes.entries()) {
    const font = fontOf(change)
    const family = font === undefined ? undefined : resolveFont(font)?.family
    if (font !== undefined && family === undefined)
      return {
        ok: false,
        result: told(false, {
          ok: false,
          refusal: "field",
          change: change.op,
          at,
          field: "font",
          note: `Change ${String(at + 1)} (${change.op}): field font. ${font} is not in AirDesign's font catalog, so nothing landed. Name a family the catalog holds, such as Inter, Montserrat, Lora or Playfair Display.`,
        }),
      }
    named.push(family === undefined ? change : ({ ...change, font: family } as doom.AgentChange))
  }
  return { ok: true, changes: named }
}
