import { expect } from "@playwright/test"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { test } from "./api-stack"
import { spot } from "./editor-deck"
import { designDoom, painted, panel, pick, saved, typeInto, undoOnStage, words } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a text field takes typed words, writes them to the whole text, leaves a blank alone, and Undo takes them back", async ({
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
  const font = async () => (await saved(stack, opened, "t:1")).text.spans[0]?.font
  await pick(page, "t:1", 400, 180)
  const field = panel(page).getByRole("textbox", { name: textCopy.font, exact: true })
  const shown = await field.inputValue()
  expect(shown).not.toBe("")
  await typeInto(field, "Georgia")
  await expect.poll(font).toBe("Georgia")
  await expect(field).toHaveValue("Georgia")
  await expect
    .poll(() =>
      painted(page, "t:1")
        .locator("span")
        .filter({ hasText: "Quarterly" })
        .last()
        .evaluate((node) => getComputedStyle(node).fontFamily),
    )
    .toMatch(/^"?Georgia/)
  await typeInto(field, "  ")
  await expect(field).toHaveValue("Georgia")
  expect(await font()).toBe("Georgia")
  await undoOnStage(page)
  await expect.poll(font).toBeUndefined()
  await pick(page, "t:1", 400, 180)
  await expect(field).toHaveValue(shown)
})
