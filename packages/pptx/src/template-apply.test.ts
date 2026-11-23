import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { templateStyles } from "./template-style.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function specimen() {
  const bytes = process
    .getBuiltinModule("node:fs")
    .readFileSync(`${process.cwd()}/scripts/pptx-fixtures/doe-heat-pumps.pptx`)
  const parts = new Map(await readParts(bytes))
  const theme = "ppt/theme/theme2.xml"
  parts.set(
    theme,
    encodeUtf8(
      decodeUtf8(parts.get(theme)!)
        .replaceAll('val="4472C4"', 'val="C00000"')
        .replaceAll('typeface="Calibri"', 'typeface="Georgia"'),
    ),
  )
  return parts
}

it("keeps both hyperlink colors in the template's full twelve-color palette", async () => {
  const parts = await specimen()
  for (const style of templateStyles(parts)) {
    expect(Object.keys(style.palette.slots)).toHaveLength(12)
    expect(style.palette.slots.hlink).toMatch(/^[0-9A-F]{6}$/)
    expect(style.palette.slots.folHlink).toMatch(/^[0-9A-F]{6}$/)
  }
})
