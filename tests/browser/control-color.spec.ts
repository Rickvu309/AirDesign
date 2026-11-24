import { expect } from "@playwright/test"
import { colorCopy } from "../../apps/web/src/copy/color-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { test } from "./api-stack"
import { picker, shownColor, typeColor } from "./design-panel"
import { accent, spot } from "./editor-deck"
import { hexes, neutralColorNames } from "./editor-design-art"
import { designDoom, painted, pick, saved, section, undoOnStage } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

const navy = "rgb(31, 78, 121)"

test("a colour takes a typed hex, a template colour and a tint, paints each at once, and Undo puts the one before back", async ({
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
  const color = async () => (await saved(stack, opened, "t:1")).fills?.[0]?.color
  const filled = () =>
    painted(page, "t:1")
      .locator("[data-body]")
      .evaluate(
        (body) =>
          [...body.querySelectorAll("*")]
            .map((each) => getComputedStyle(each).backgroundColor)
            .find((color) => color !== "rgba(0, 0, 0, 0)") ?? "none",
      )
  await pick(page, "t:1", 400, 350)
  const field = () =>
    section(page, fillCopy.section).getByRole("group", { name: fillWords["paint.solid"], exact: true })
  await expect(shownColor(field())).toHaveText(neutralColorNames.accent1)

  await typeColor(page, shownColor(field()), colorCopy.hexName("1f4e79"))
  await expect.poll(color).toBe(hexes.navy)
  await expect(shownColor(field())).toHaveText("1F4E79")
  await expect.poll(filled).toBe(navy)

  await shownColor(field()).click()
  await picker(page).getByRole("button", { name: neutralColorNames.accent3, exact: true }).first().click()
  await page.keyboard.press("Escape")
  await expect.poll(color).toEqual({ var: "accent3" })
  await expect(shownColor(field())).toHaveText(neutralColorNames.accent3)

  await shownColor(field()).click()
  await picker(page).getByRole("button", { name: colorCopy.add, exact: true }).click()
  await picker(page).getByRole("button", { name: colorCopy.moreTints, exact: true }).click()
  await picker(page)
    .getByRole("button", { name: colorCopy.lighter(neutralColorNames.accent1, 40), exact: true })
    .click()
  await page.keyboard.press("Escape")
  await expect(picker(page)).toHaveCount(0)
  await expect.poll(color).toEqual({ var: "accent1", tint: 0.4 })

  await undoOnStage(page)
  await expect.poll(color).toEqual({ var: "accent3" })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(color).toBe(hexes.navy)
  await expect.poll(filled).toBe(navy)
})
