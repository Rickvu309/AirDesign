import { filedText, paragraphedText } from "./line-breaks.js"
import { restyled } from "./text-restyle.js"

type Loose = Readonly<Record<string, unknown>>

export function textInputValue(
  input: Loose,
  layer: { readonly floor?: string | null; readonly value: string | null },
  styled: boolean,
): string | undefined {
  const sent = typeof input.value === "string" ? paragraphedText(filedText(layer.floor, input.value)) : undefined
  return styled ? restyled(sent ?? layer.value ?? "", input) : sent
}
