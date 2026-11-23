import { productCopy } from "@/copy/product-copy"

const nameLimit = 120
const unsafe = /[\\/:*?"<>|\p{Cc}]+/gu
const trailing = /[. ]+$/

export function exportBaseName(name: string): string {
  const spaced = name.replace(unsafe, " ").replace(/\s+/g, " ").trim()
  const kept = [...spaced].slice(0, nameLimit).join("").replace(trailing, "")
  return kept === "" ? productCopy.blankDeck : kept
}
