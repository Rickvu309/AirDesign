import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("button", { name: "Blank deck", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  const deck = page.url().split("/").at(-1)
  await capture("blank-original")
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(2)
  const out = path.dirname(await capture("layout-placeholders"))
  await expect.poll(async () => (await post(deckRoutes.open, { deck }, cookie)).json.register.order?.length).toBe(1)
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const file = path.join(out, "blank-slides.pptx")
  await (await saving).saveAs(file)
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const before = await pptx.readParts(fs.readFileSync(path.join(repo, "scripts/pptx-fixtures/blank.pptx")))
  const after = await pptx.readParts(fs.readFileSync(file))
  expect(
    pptx.slideExportFailures(
      before,
      after,
      [...before.keys()].filter(
        (name) => !["[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"].includes(name),
      ),
    ),
  ).toEqual([])
  await page.reload()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await capture("saved-two-slides")
  note(
    `Blank deck → New slide paints two layout placeholders, saves to the API, survives reload and exports to ${file}; untouched parts match. Placeholder editing is outside this proof.`,
  )
}
