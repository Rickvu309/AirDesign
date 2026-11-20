import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { namedByColor } from "../../apps/web/src/design/color-names"

export async function colorWords(
  fixture: string,
  options?: { readonly slide?: number; readonly theme?: number; readonly slots?: Readonly<Record<string, string>> },
): Promise<Record<string, string>> {
  const { readParts, readSlides, slideTheme, templateStyles } = await import("../../packages/pptx/dist/index.js")
  const { templateColors } = await import("../../packages/document/dist/index.js")
  const parts = await readParts(await readFile(join(process.cwd(), "scripts/pptx-fixtures", fixture)))
  const styles = templateStyles(parts)
  const slide = readSlides(parts)[options?.slide ?? 0]?.part
  const themeId = slide === undefined ? null : slideTheme(parts, slide)
  const style = options?.theme === undefined ? styles.find((item) => item.id === themeId) : styles[options.theme]
  const entries =
    style === undefined
      ? []
      : templateColors.flatMap((slot) => {
          const hex = options?.slots?.[slot] ?? style.palette.slots[slot]
          return hex === undefined ? [] : [{ slot, css: hex }]
        })
  return Object.fromEntries(namedByColor(entries).map((entry) => [entry.slot, entry.name]))
}

export async function toolbarWords(fixture: string, slide = 0): Promise<Record<string, string>> {
  const { readParts, readSlides, themeSwatches } = await import("../../packages/pptx/dist/index.js")
  const parts = await readParts(await readFile(join(process.cwd(), "scripts/pptx-fixtures", fixture)))
  const part = readSlides(parts)[slide]?.part ?? null
  return Object.fromEntries(namedByColor(themeSwatches(parts, part)).map((swatch) => [swatch.scheme, swatch.name]))
}

export async function templateHex(fixture: string, slot: string): Promise<string> {
  const { readParts, readSlides, slideColorHex } = await import("../../packages/pptx/dist/index.js")
  const parts = await readParts(await readFile(join(process.cwd(), "scripts/pptx-fixtures", fixture)))
  return slideColorHex(parts, readSlides(parts)[0]?.part ?? "", { scheme: slot }) ?? ""
}
