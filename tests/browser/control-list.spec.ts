import { expect } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { test } from "./api-stack"
import { spot } from "./editor-deck"
import { designDoom, pick, saved, section, undoOnStage } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a list adds a gradient stop and removes one within its bounds, and Undo brings the removed stop back", async ({
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
  const stops = async () => (await saved(stack, opened, "t:1")).fills[0].stops
  await pick(page, "t:1", 400, 350)
  const fill = section(page, fillCopy.section)
  const items = fill.getByRole("list", { name: fillWords.stops, exact: true }).getByRole("listitem")
  await expect(items).toHaveCount(2)
  await expect(fill.getByRole("button", { name: designCopy.removeStop(1), exact: true })).toHaveCount(0)
  await fill.getByRole("button", { name: designCopy.addStop, exact: true }).click()
  await expect(items).toHaveCount(3)
  await expect.poll(async () => (await stops()).length).toBe(3)
  const three = await stops()
  await fill.getByRole("button", { name: designCopy.removeStop(2), exact: true }).click()
  await expect(items).toHaveCount(2)
  await expect.poll(async () => (await stops()).length).toBe(2)
  expect(await stops()).toEqual([three[0], three[2]])
  await undoOnStage(page)
  await expect.poll(stops).toEqual(three)
  await pick(page, "t:1", 400, 350)
  await expect(items).toHaveCount(3)
})
