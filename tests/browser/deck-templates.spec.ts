import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { templateExports } from "../../scripts/pptx-cases/deck-templates.mjs"
import { decksOn } from "./deck-test"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

for (const { original, exported, slides } of templateExports) {
  test(`the ${original} template opens with every slide painted and exports with no part changed @export`, async ({
    page,
  }) => {
    const source = join(process.cwd(), "packages/templates/files", original)
    await decksOn(page).open(source)
    await expect(page.locator("[data-slide-entry]")).toHaveCount(slides)
    const file = join(process.cwd(), "tests/browser", exported)
    await savedExport(page, file)
    const before = await partsOf(source)
    const after = await partsOf(file)
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
      (name) => before.get(name)?.equals(after.get(name) ?? Buffer.alloc(0)) !== true,
    )
    expect(changed).toEqual([])
  })
}
