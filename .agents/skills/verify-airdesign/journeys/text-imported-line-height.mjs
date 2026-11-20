import { importedFixedLineHeight } from "../look/imported-line-height.mjs"
import path from "node:path"
import { createRequire } from "node:module"

export default async function drive(kit) {
  const { repo, expect, capture, note } = kit
  const { designCopy } = createRequire(import.meta.url)(path.join(repo, "apps/web/src/copy/design-copy.ts"))
  const line = await importedFixedLineHeight(kit)
  await expect(line).toHaveValue("12.4")
  const unit = line.locator("xpath=ancestor::*[@data-control][1]")
  await expect(unit).toContainText(designCopy.points)
  await capture("imported-line-height-in-points")
  await line.fill("14")
  await line.press("Enter")
  await expect(line).toHaveValue("14")
  await capture("line-height-typed-14-points")
  note(
    'The date on nasa-cots-parts-nesc slide 7 holds <a:spcPts val="1240"/>: Line height shows 12.4 pt, and a typed 14 stays in points',
  )
}
