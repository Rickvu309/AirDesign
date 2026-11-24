import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { findPackageJSON } from "node:module"
import initialize from "@echogarden/icu-segmentation-wasm/wasm/icu-segmentation.js"

export async function loadIcu({ harfBuzzPackage, icuReferencePackage, bidiJsPackage, icuWasmSha256 }) {
  for (const [name, version] of [
    ["harfbuzzjs", harfBuzzPackage],
    ["@echogarden/icu-segmentation-wasm", icuReferencePackage],
    ["bidi-js", bidiJsPackage],
  ]) {
    const path = findPackageJSON(name, import.meta.url)
    if (!path) throw new Error(`Can't locate the installed package ${name}`)
    const installed = JSON.parse(await readFile(path, "utf8")).version
    if (installed !== version) throw new Error(`${name}: expected ${version}, got ${installed}`)
  }

  const wasm = import.meta.resolve("@echogarden/icu-segmentation-wasm/wasm/icu-segmentation.wasm")
  const wasmBinary = await readFile(new URL(wasm))
  if (createHash("sha256").update(wasmBinary).digest("hex") !== icuWasmSha256)
    throw new Error("ICU WASM revision changed")
  const icu = await initialize({ wasmBinary })
  icu._loadInternalICUData()

  function boundaries(open, text, locale) {
    const tag = Buffer.from(locale + "\0")
    const textPtr = icu._malloc((text.length + 1) * 2)
    const localePtr = icu._malloc(tag.length)
    let iterator
    try {
      if (!textPtr || !localePtr) throw new Error("ICU allocation failed")
      icu.HEAPU8.set(tag, localePtr)
      const utf16 = new Uint16Array(icu.HEAPU8.buffer, textPtr, text.length + 1)
      for (let at = 0; at < text.length; at++) utf16[at] = text.charCodeAt(at)
      utf16[text.length] = 0
      iterator = open(textPtr, text.length, localePtr)
      if (!iterator) throw new Error("ICU could not open an iterator for " + locale)

      const offsets = []
      for (let pos = icu._getFirstBoundary(iterator); pos !== -1; pos = icu._getNextBoundary(iterator))
        offsets.push(pos)
      return offsets
    } finally {
      if (iterator) icu._destroyBreakIterator(iterator)
      icu._free(textPtr)
      icu._free(localePtr)
    }
  }

  return {
    lines: (text, locale) => boundaries(icu._createLineBreakIterator, text, locale),
    graphemes: (text) => boundaries(icu._createCharacterBreakIterator, text, "und"),
  }
}
