import { resolveFont } from "@airdesign/catalog"
import type * as doom from "@airdesign/doom"
import { told, type Answer } from "./answer.js"

type Named = { readonly field: string; readonly font: string }

function fontsOf(intent: doom.Intent): readonly Named[] {
  if (intent.op === "variables")
    return Object.entries(intent.fonts ?? {}).map(([slot, font]) => ({ field: `fonts.${slot}`, font }))
  return "font" in intent && intent.font !== undefined ? [{ field: "font", font: intent.font }] : []
}

function served(intent: doom.Intent): doom.Intent {
  const family = (font: string) => resolveFont(font)?.family ?? font
  if (intent.op === "variables" && intent.fonts !== undefined)
    return {
      ...intent,
      fonts: Object.fromEntries(Object.entries(intent.fonts).map(([slot, font]) => [slot, family(font)])),
    }
  return "font" in intent && intent.font !== undefined ? { ...intent, font: family(intent.font) } : intent
}

export function withCatalogFonts(intent: doom.Intent): doom.Intent | Answer {
  const unknown = fontsOf(intent).find(({ font }) => resolveFont(font) === undefined)
  if (unknown === undefined) return served(intent)
  return told(false, {
    ok: false,
    refusal: "field",
    field: unknown.field,
    note: `field ${unknown.field}. ${unknown.font} is not in AirDesign's font catalog, so nothing landed. Name a family the catalog holds, such as Inter, Montserrat, Lora or Playfair Display.`,
  })
}
