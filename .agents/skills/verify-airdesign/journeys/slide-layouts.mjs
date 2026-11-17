import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../bin/new-deck.mjs"

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  const deck = page.url().split("/").at(-1)
  await page.getByRole("button", { name: "Choose a layout for the new slide" }).click()
  await expect(page.getByRole("menuitem")).toHaveCount(6)
  await capture("layout-menu-open")
  await page.getByRole("menuitem", { name: "Two Content", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(3)
  const heading = page.locator(
    '[data-slide-paint] [data-canvas-element="ppt/slides/slide2.xml#2"] [contenteditable="true"]',
  )
  await heading.click()
  await heading.pressSequentially("Two columns", { delay: 20 })
  await expect(heading).toHaveText("Two columns")
  const out = path.dirname(await capture("two-content-typed"))
  await expect
    .poll(async () => (await post(deckRoutes.open, { deck }, cookie)).json.register.order?.[0]?.layoutPart)
    .toBe("ppt/slideLayouts/slideLayout4.xml")
  await page.reload()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await page.locator('[data-slide-entry="2"]').click()
  await expect(heading).toHaveText("Two columns")
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const file = path.join(out, "slide-layouts.pptx")
  await (await saving).saveAs(file)
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const before = await pptx.readParts(fs.readFileSync(path.join(repo, "apps/web/src/decks/blank.pptx")))
  const after = await pptx.readParts(fs.readFileSync(file))
  expect(new TextDecoder().decode(after.get("ppt/slides/_rels/slide2.xml.rels"))).toContain("slideLayout4.xml")
  expect(
    pptx.slideExportFailures(
      before,
      after,
      [...before.keys()].filter(
        (name) => !["[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"].includes(name),
      ),
    ),
  ).toEqual([])
  note(
    `Blank deck → New slide menu lists six layouts; Two Content adds slide 2 with three placeholders, takes typing, saves layoutPart to the API, survives reload and exports pointing at slideLayout4 in ${file}; untouched parts match.`,
  )
}
