import { expect } from "@playwright/test"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { test } from "./api-stack"
import { spot } from "./editor-deck"
import { designDoom, panel, pick, reloadDesign, saved, typeInto, undoOnStage, words } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a length sizes the text in points, steps with the arrow keys, refuses a word, and Undo and a reload agree", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { box: spot(100, 100, 1400, 240), text: words("Quarterly review") },
    },
  ])
  const size = async () => (await saved(stack, opened, "t:1")).text.spans[0]?.size
  await pick(page, "t:1", 400, 180)
  const field = panel(page).getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })
  await expect(field).not.toHaveValue("40")
  await typeInto(field, "40")
  await expect.poll(size).toBe(40)
  await expect(field).toHaveValue("40")
  await field.press("ArrowUp")
  await expect(field).toHaveValue("41")
  await field.press("Enter")
  await expect.poll(size).toBe(41)
  await typeInto(field, "wide")
  await expect(field).toHaveValue("41")
  expect(await size()).toBe(41)

  await undoOnStage(page)
  await expect.poll(size).toBe(40)
  await reloadDesign(page)
  await pick(page, "t:1", 400, 180)
  await expect(panel(page).getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })).toHaveValue("40")
})
