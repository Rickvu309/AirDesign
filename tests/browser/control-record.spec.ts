import { expect } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { test } from "./api-stack"
import { pickColor, shownColor } from "./design-panel"
import { spot } from "./doom-deck"
import { neutralColorNames } from "./doom-editor-design-art"
import { designDoom, pick, saved, section, undoOnStage } from "./doom-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a record changes one field of a gradient stop, keeps its other fields and the other stop, and Undo puts that field back", async ({
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
  const stop = (at: number) => fill.getByRole("group", { name: designCopy.stop(at), exact: true })
  const color = (at: number) => stop(at).getByRole("group", { name: fillWords.color ?? "", exact: true })
  await expect(shownColor(color(1))).toHaveText(neutralColorNames.accent1)
  await pickColor(page, color(2), neutralColorNames.accent2)
  await expect.poll(stops).toEqual([
    { at: 0, color: { var: "accent1" } },
    { at: 1, color: { var: "accent2" } },
  ])
  await expect(shownColor(color(1))).toHaveText(neutralColorNames.accent1)
  await expect(stop(2).getByRole("textbox", { name: fillWords.pos ?? "", exact: true })).toHaveValue("100")
  await undoOnStage(page)
  await expect.poll(stops).toEqual([
    { at: 0, color: { var: "accent1" } },
    { at: 1, color: { var: "background" } },
  ])
})
