import { expect } from "@playwright/test"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { test } from "./api-stack"
import { accent, spot } from "./doom-deck"
import { designDoom, pick, reloadDesign, saved, section, undoOnStage } from "./doom-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a union picks one case of a shape's fill, shows the pick and its own controls, and Undo goes back to the case before", async ({
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
  const fills = async () => (await saved(stack, opened, "t:1")).fills
  await pick(page, "t:1", 400, 350)
  const fill = section(page, fillCopy.section)
  const kind = (name: string) => fill.getByRole("button", { name, exact: true })
  await expect(kind(fillWords.solid)).toHaveAttribute("aria-pressed", "true")
  await expect(fill.getByRole("group", { name: fillWords["paint.solid"], exact: true })).toBeVisible()

  await kind(fillWords.none).click()
  await expect.poll(fills).toBeUndefined()
  await expect(kind(fillWords.none)).toHaveAttribute("aria-pressed", "true")
  await expect(kind(fillWords.solid)).toHaveAttribute("aria-pressed", "false")
  await expect(fill.getByRole("group", { name: fillWords["paint.solid"], exact: true })).toHaveCount(0)

  await kind(fillWords.gradient).click()
  await expect.poll(async () => (await fills())?.[0]?.kind).toBe("gradient")
  await expect(kind(fillWords.gradient)).toHaveAttribute("aria-pressed", "true")
  await expect(fill.getByRole("list", { name: fillWords.stops, exact: true })).toBeVisible()

  await undoOnStage(page)
  await expect.poll(fills).toBeUndefined()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(fills).toEqual(accent)
  await pick(page, "t:1", 400, 350)
  await expect(kind(fillWords.solid)).toHaveAttribute("aria-pressed", "true")
  await kind(fillWords.gradient).click()
  await expect.poll(async () => (await fills())?.[0]?.kind).toBe("gradient")
  await reloadDesign(page)
  await pick(page, "t:1", 400, 350)
  await expect(
    section(page, fillCopy.section).getByRole("button", { name: fillWords.gradient, exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
})
