import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { dragSlide, openEditor, savedNode, selectedIds, serveOriginals, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const pictureFile = join(process.cwd(), "scripts/pptx-fixtures/picture.png")

type Stack = Parameters<typeof savedNode>[0]

const picked = async (page: Page, stack: Stack, opened: Opened) => {
  const [id] = await selectedIds(page)
  if (id === undefined || id === null) return undefined
  return (await savedNode(stack, opened, id)) as { box: { x: number; y: number; w: number; h: number } } | undefined
}

test("Place image inserts a picture from a file, and a chart or icon lands beside what is already there", async ({
  page,
  context,
  stack,
}) => {
  covers("actions", "undo")
  await serveOriginals(page, stack.originals)
  const opened = await openEditor(page, context, stack)
  const actions = page.getByRole("button", { name: editorCopy.actions, exact: true })

  await actions.click()
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("option", { name: editorCopy.placeImage, exact: true }).click()
  await (await chooser).setFiles(pictureFile)
  const picture = page.locator('[data-slide-box] [data-paint="image"]')
  await expect(picture).toHaveCount(1)
  await expect(page.locator("[data-actions-panel]")).toBeHidden()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(picture).toHaveCount(0)

  await page.keyboard.press("r")
  await dragSlide(page, { x: 0, y: 0 }, { x: 1400, y: 1080 })
  await actions.click()
  await page.getByRole("option", { name: editorCopy.chartKinds.column, exact: true }).click()
  await expect.poll(async () => (await picked(page, stack, opened))?.box.x).toBeGreaterThanOrEqual(1400)

  await expect(page.locator("[data-actions-panel]")).toBeHidden()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-slide-box]").getByText("Q1", { exact: true })).toHaveCount(0)
  await actions.click()
  await page.getByRole("combobox", { name: editorCopy.actionsSearch }).fill("rocket")
  await page.getByRole("option", { name: "rocket", exact: true }).click()
  await expect.poll(async () => (await picked(page, stack, opened))?.box.x).toBeGreaterThanOrEqual(1400)
})
