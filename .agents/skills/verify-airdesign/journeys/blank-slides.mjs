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
  await capture("blank-original")
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(0)
  await expect(page.locator("[data-slide-paint] [data-placeholder-prompt]")).toHaveCount(0)
  const out = path.dirname(await capture("empty-second-slide"))
  await expect.poll(async () => (await post(deckRoutes.open, { deck }, cookie)).json.register.order?.length).toBe(1)
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const file = path.join(out, "blank-slides.pptx")
  await (await saving).saveAs(file)
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const before = await pptx.readParts(fs.readFileSync(path.join(repo, "apps/web/src/decks/blank.pptx")))
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
    `Blank deck → Add slide stays empty, saves to the API, survives reload and exports to ${file}; untouched parts match. Placeholder editing is outside this proof.`,
  )
}
