import { expect } from "@playwright/test"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { test } from "./api-stack"
import { accent, spot } from "./doom-deck"
import { designDoom, painted, pick, saved, section, typeInto, undoOnStage } from "./doom-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a percent takes a typed number in percent, steps with the arrow keys, refuses more than the whole, and Undo puts it back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { box: spot(200, 200, 400, 300), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  const opacity = async () => (await saved(stack, opened, "t:1")).opacity
  await pick(page, "t:1", 400, 350)
  const field = section(page, opacityCopy.section).getByRole("textbox", { name: opacityCopy.label, exact: true })
  await expect(field).toHaveValue("100")
  await field.fill("60")
  await field.press("ArrowDown")
  await expect(field).toHaveValue("59")
  await field.press("Enter")
  await expect.poll(opacity).toBe(0.59)
  await expect.poll(() => painted(page, "t:1").evaluate((node) => getComputedStyle(node).opacity)).toBe("0.59")
  await typeInto(field, "140")
  await expect(field).toHaveValue("59")
  expect(await opacity()).toBe(0.59)
  await undoOnStage(page)
  await expect.poll(opacity).toBeUndefined()
  await pick(page, "t:1", 400, 350)
  await expect(field).toHaveValue("100")
})
