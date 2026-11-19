import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import "./product-copy.mjs"

const loaded = new Map()

async function modules(repo) {
  const cached = loaded.get(repo)
  if (cached !== undefined) return cached
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const document = await import(pathToFileURL(path.join(repo, "packages/document/dist/index.js")).href)
  const names = await import(pathToFileURL(path.join(repo, "apps/web/src/design/color-names.ts")).href)
  const value = { pptx, document, names }
  loaded.set(repo, value)
  return value
}

async function partsOf(repo, fixture) {
  const { pptx, document, names } = await modules(repo)
  const file = path.isAbsolute(fixture)
    ? fixture
    : path.join(repo, fixture.includes("/") ? fixture : path.join("scripts/pptx-fixtures", fixture))
  return { pptx, document, names, parts: await pptx.readParts(await readFile(file)) }
}

export async function colorWords(repo, fixture, options = {}) {
  const { pptx, document, names, parts } = await partsOf(repo, fixture)
  const styles = pptx.templateStyles(parts)
  const slide = pptx.readSlides(parts)[options.slide ?? 0]?.part
  const themeId = slide === undefined ? null : pptx.slideTheme(parts, slide)
  const style = options.theme === undefined ? styles.find((item) => item.id === themeId) : styles[options.theme]
  const entries =
    style === undefined
      ? []
      : document.templateColors.flatMap((slot) => {
          const hex = options.slots?.[slot] ?? style.palette.slots[slot]
          return hex === undefined ? [] : [{ slot, css: hex }]
        })
  return Object.fromEntries(names.namedByColor(entries).map((entry) => [entry.slot, entry.name]))
}

export async function toolbarWords(repo, fixture, slide = 0) {
  const { pptx, names, parts } = await partsOf(repo, fixture)
  const part = pptx.readSlides(parts)[slide]?.part ?? null
  return Object.fromEntries(
    names.namedByColor(pptx.themeSwatches(parts, part)).map((swatch) => [swatch.scheme, swatch.name]),
  )
}
