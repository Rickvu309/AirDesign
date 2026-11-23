import { expect } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { test } from "./api-stack"
import { designDoom, painted, pick, saved, undoOnStage } from "./doom-design"
import { accent, spot } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const flow = { mode: "column", gap: 24, padding: { t: 40, r: 40, b: 40, l: 40 }, align: "top-left" }

test("remove auto layout keeps the frame and every child where they were painted, and undo brings the layout back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "frame",
      parent: slide,
      props: {
        name: "Stack",
        box: spot(400, 200, 10, 10),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        layout: flow,
        sizing: { w: "hug", h: "hug" },
      },
    },
    { id: "t:2", type: "shape", parent: "t:1", props: { name: "First", box: spot(0, 0, 600, 160), fills: accent } },
    {
      id: "t:3",
      type: "shape",
      parent: "t:1",
      props: { name: "Second", box: spot(0, 0, 200, 160), fills: accent, sizing: { w: "fill", h: "fixed" } },
    },
  ])
  const before = await Promise.all(["t:1", "t:2", "t:3"].map((id) => painted(page, id).boundingBox()))
  await pick(page, "t:1", 410, 210)
  await page.locator("[data-auto-layout]").getByRole("button", { name: designCopy.removeAutoLayout }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:1")).layout?.mode).toBe("none")
  expect((await saved(stack, opened, "t:1")).box).toMatchObject({ x: 400, y: 200, w: 680, h: 424 })
  expect((await saved(stack, opened, "t:3")).box).toMatchObject({ x: 40, y: 224, w: 600, h: 160 })
  expect((await saved(stack, opened, "t:3")).sizing).toEqual({ w: "fixed", h: "fixed" })
  expect(await Promise.all(["t:1", "t:2", "t:3"].map((id) => painted(page, id).boundingBox()))).toEqual(before)
  await undoOnStage(page)
  await expect.poll(async () => (await saved(stack, opened, "t:1")).layout?.mode).toBe("column")
  expect((await saved(stack, opened, "t:3")).sizing).toEqual({ w: "fill", h: "fixed" })
})
