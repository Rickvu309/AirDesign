import { expect } from "@playwright/test"
import { boxCopy, boxWords } from "../../apps/web/src/copy/box-copy"
import { doomEditorCopy } from "../../apps/web/src/copy/doom-editor-copy"
import { test } from "./api-stack"
import { accent, spot } from "./doom-deck"
import { designDoom, panel, pick, saved, undoOnStage } from "./doom-design"

test.use({ viewport: { width: 1600, height: 1000 } })

const named = (option: string) => `${boxCopy.align} ${option.toLowerCase()}`

test("an action moves the shape on the slide, is a button that never stays pressed, names itself in a tooltip, and Undo moves it back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { box: spot(100, 100, 400, 200), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  const box = async () => (await saved(stack, opened, "t:1")).box
  await pick(page, "t:1", 300, 200)
  const align = panel(page).getByRole("group", { name: boxCopy.align, exact: true })
  await expect(align.getByRole("button")).toHaveCount(6)
  await expect(align.getByRole("button").first()).toHaveAttribute("title", doomEditorCopy.alignLeft)
  await panel(page).getByRole("button", { name: boxCopy.distribute, exact: true }).click()
  for (const way of [boxWords.horizontal, boxWords.vertical])
    await expect(
      page.getByRole("menuitem", { name: `${boxCopy.distribute} ${(way ?? "").toLowerCase()}` }),
    ).toBeVisible()
  await page.keyboard.press("Escape")

  await align.getByRole("button", { name: doomEditorCopy.alignCenter, exact: true }).click()
  await expect.poll(async () => (await box()).x).toBe(760)
  await align.getByRole("button", { name: named(boxWords.middle ?? ""), exact: true }).click()
  await expect.poll(async () => (await box()).y).toBe(440)
  expect((await box()).x).toBe(760)
  for (const button of await align.getByRole("button").all()) await expect(button).not.toHaveAttribute("aria-pressed")

  await undoOnStage(page)
  await expect.poll(async () => (await box()).y).toBe(100)
  expect((await box()).x).toBe(760)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await box()).x).toBe(100)
})
