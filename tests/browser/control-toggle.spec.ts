import { expect, type Page } from "@playwright/test"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { test } from "./api-stack"
import { spot } from "./editor-deck"
import { designDoom, painted, panel, pick, reloadDesign, saved, undoOnStage, words } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

const looks = (page: Page) =>
  painted(page, "t:1")
    .locator("span")
    .filter({ hasText: "Quarterly" })
    .last()
    .evaluate((node) => {
      const style = getComputedStyle(node)
      return [style.fontWeight, style.fontStyle]
    })

test("a toggle makes the whole text bold and italic, paints before the server answers, each is one undo step, and a reload keeps it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { box: spot(100, 100, 900, 160), text: words("Quarterly review") },
    },
  ])
  const span = async () => (await saved(stack, opened, "t:1")).text.spans[0]
  await pick(page, "t:1", 400, 180)
  const bold = panel(page).getByRole("button", { name: formatCopy.named.bold, exact: true })
  const italic = panel(page).getByRole("button", { name: formatCopy.named.italic, exact: true })
  await expect(bold).toHaveAttribute("aria-pressed", "false")

  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  await page.route(`**${doomRoutes.edit.path}`, async (route) => {
    await gate
    await route.fallback()
  })
  await bold.click()
  await expect.poll(() => looks(page)).toEqual(["700", "normal"])
  await expect(bold).toHaveAttribute("aria-pressed", "true")
  await italic.click()
  await expect.poll(() => looks(page)).toEqual(["700", "italic"])
  expect(await span()).toBeUndefined()
  release()
  await expect.poll(span).toMatchObject({ bold: true, italic: true })

  await undoOnStage(page)
  await expect.poll(async () => (await span())?.italic).toBeUndefined()
  expect((await span())?.bold).toBe(true)
  await expect.poll(() => looks(page)).toEqual(["700", "normal"])
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await span())?.italic).toBe(true)
  await reloadDesign(page)
  await pick(page, "t:1", 400, 180)
  await expect(panel(page).getByRole("button", { name: formatCopy.named.italic, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect.poll(() => looks(page)).toEqual(["700", "italic"])
})
