import { expect } from "@playwright/test"
import { geometryCopy } from "../../apps/web/src/copy/geometry-copy"
import { test } from "./api-stack"
import { accent, spot } from "./doom-deck"
import { designDoom, panel, pick, reloadDesign, saved, section, typeInto } from "./doom-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("Corners rounds a rectangle in pixels, steps with the arrow keys, keeps it over a reload, returns to square, and an ellipse has none", async ({
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
    {
      id: "t:2",
      type: "shape",
      parent: slide,
      props: { box: spot(1000, 200, 300, 300), geometry: { kind: "ellipse" }, fills: accent },
    },
  ])
  const radius = async () => (await saved(stack, opened, "t:1")).radius
  await pick(page, "t:1", 400, 350)
  const corners = () =>
    section(page, geometryCopy.corners).getByRole("textbox", { name: geometryCopy.corners, exact: true })
  await expect(corners()).toHaveValue("0")
  await typeInto(corners(), "20")
  await expect.poll(radius).toBe(20)
  await corners().press("ArrowUp")
  await expect(corners()).toHaveValue("21")
  await corners().press("Enter")
  await expect.poll(radius).toBe(21)
  await reloadDesign(page)
  await pick(page, "t:1", 400, 350)
  await expect(corners()).toHaveValue("21")
  await typeInto(corners(), "0")
  await expect.poll(radius).toBeUndefined()
  await expect(corners()).toHaveValue("0")
  await pick(page, "t:2", 1150, 350)
  await expect(panel(page).getByRole("textbox", { name: geometryCopy.corners, exact: true })).toHaveCount(0)
})
