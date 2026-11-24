import { readDeckName } from "@airdesign/catalog"
import { limits } from "@airdesign/doom"
import { designCopy } from "@/copy/design-copy"
import { nameTooLongOf } from "@/copy/product-copy"

export type NameReading = { readonly ok: true; readonly name: string } | { readonly ok: false; readonly words: string }

export function layerNameReading(text: string): NameReading {
  const name = readDeckName(text)
  if (name !== undefined) return { ok: true, name }
  const size = [...text.trim()].length
  return { ok: false, words: size > limits.name ? nameTooLongOf(limits.name) : designCopy.layerNameEmpty }
}
