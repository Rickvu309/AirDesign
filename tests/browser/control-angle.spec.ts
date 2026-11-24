import { expect } from "@playwright/test"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { test } from "./api-stack"
import { spot } from "./editor-deck"
import { designDoom, pick, saved, section, typeInto, undoOnStage } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("an angle takes a typed number in degrees, wraps past a full turn, and Undo puts it back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: {
        box: spot(200, 200, 400, 300),
        geometry: { kind: "rect" },
        fills: [
          {
            kind: "gradient",
            shape: "linear",
            angle: 90,
            stops: [
              { at: 0, color: { var: "accent1" } },
              { at: 1, color: { var: "background" } },
            ],
          },
        ],
      },
    },
  ])
  const angle = async () => (await saved(stack, opened, "t:1")).fills[0].angle
  await pick(page, "t:1", 400, 350)
  const field = () => section(page, fillCopy.section).getByRole("textbox", { name: fillWords.angle, exact: true })
  await expect(field()).toHaveValue("90")
  await typeInto(field(), "0")
  await expect.poll(angle).toBe(0)
  await expect(field()).toHaveValue("0")
  await typeInto(field(), "400")
  await expect(field()).toHaveValue("40")
  await expect.poll(angle).toBe(40)
  await typeInto(field(), "-10")
  await expect(field()).toHaveValue("350")
  await expect.poll(angle).toBe(350)
  await typeInto(field(), "720")
  await expect(field()).toHaveValue("0")
  await expect.poll(angle).toBe(0)
  await field().press("ArrowDown")
  await expect(field()).toHaveValue("359")
  await expect.poll(angle).toBe(359)
  await field().press("ArrowUp")
  await expect(field()).toHaveValue("0")
  await expect.poll(angle).toBe(0)
  await typeInto(field(), "45")
  await expect.poll(angle).toBe(45)
  await undoOnStage(page)
  await expect.poll(angle).toBe(0)
  for (const back of [359, 0, 350, 40, 0, 90]) {
    await page.keyboard.press("ControlOrMeta+z")
    await expect.poll(angle).toBe(back)
  }
  await pick(page, "t:1", 400, 350)
  await expect(field()).toHaveValue("90")
})
