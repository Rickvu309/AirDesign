import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { readSlides } from "./read-shapes.js"
import { slideTextStyles } from "./slide-text-styles.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function template(name: string) {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/deck-templates/files/${name}.pptx`)))
}

it("names a template's master text styles from its AirDesign names: the type scale", async () => {
  const parts = await template("neutral")
  const slides = readSlides(parts)
  const styles = slideTextStyles(parts, slides[4]!.part)
  const named = Object.fromEntries(styles.map((style) => [style.name, style.fields.size]))
  expect(named).toMatchObject({
    Title: 2800,
    Body: 1600,
    "Body 2": 1400,
    Heading: 2000,
    Caption: 1100,
    Label: 1000,
    "Big number": 5400,
  })
  expect(styles.find((style) => style.name === "Heading")?.id).toBe("ppt/slideMasters/slideMaster1.xml/otherStyle/1")
})

it("keeps the generic names for a master with no AirDesign names", async () => {
  const fs = process.getBuiltinModule("node:fs")
  const parts = await readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`)))
  const names = slideTextStyles(parts, readSlides(parts)[0]!.part).map((style) => style.name)
  expect(names).not.toContain("Heading")
})
