import { resolveFont } from "@airdesign/catalog"
import type * as doom from "@airdesign/doom"
import { told, type Answer } from "./answer.js"

type Fonts =
  | { readonly ok: true; readonly intents: readonly doom.Intent[] }
  | { readonly ok: false; readonly result: Answer }

type Named = { readonly field: string; readonly font: string }

function fontsOf(intent: doom.Intent): readonly Named[] {
  if ((intent.op === "add" || intent.op === "set") && intent.font !== undefined)
    return [{ field: "font", font: intent.font }]
  if (intent.op !== "deck" || intent.fonts === undefined) return []
  return Object.entries(intent.fonts).map(([slot, font]) => ({ field: `fonts.${slot}`, font }))
}

function served(intent: doom.Intent): doom.Intent {
  const family = (font: string) => resolveFont(font)?.family ?? font
  if ((intent.op === "add" || intent.op === "set") && intent.font !== undefined)
    return { ...intent, font: family(intent.font) }
  if (intent.op !== "deck" || intent.fonts === undefined) return intent
  const fonts = Object.fromEntries(Object.entries(intent.fonts).map(([slot, font]) => [slot, family(font)]))
  return { ...intent, fonts }
}

export function withCatalogFonts(intents: readonly doom.Intent[]): Fonts {
  for (const [at, intent] of intents.entries()) {
    const unknown = fontsOf(intent).find(({ font }) => resolveFont(font) === undefined)
    if (unknown !== undefined)
      return {
        ok: false,
        result: told(false, {
          ok: false,
          refusal: "field",
          change: intent.op,
          at,
          field: unknown.field,
          note: `Change ${String(at + 1)} (${intent.op}): field ${unknown.field}. ${unknown.font} is not in AirDesign's font catalog, so nothing landed. Name a family the catalog holds, such as Inter, Montserrat, Lora or Playfair Display.`,
        }),
      }
  }
  return { ok: true, intents: intents.map(served) }
}
