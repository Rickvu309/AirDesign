import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { spot } from "./doom-deck"
import { designDoom, painted, panel, pick, reloadDesign, saved, undoOnStage, words } from "./doom-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a choice aligns every paragraph of the text, shows the pick, Undo puts the alignment back, and a reload keeps it", async ({
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
  const aligned = async () => (await saved(stack, opened, "t:1")).text.paras[0]?.align
  const shown = () =>
    painted(page, "t:1")
      .locator("p, div")
      .filter({ hasText: "Quarterly" })
      .last()
      .evaluate((node) => getComputedStyle(node).textAlign)
  await pick(page, "t:1", 400, 180)
  const options = panel(page).locator("[data-segments]").first().getByRole("button")
  const option = (at: number) => options.nth(at)
  await expect(options).toHaveCount(4)
  for (const button of await options.all()) {
    const name = await button.getAttribute("aria-label")
    expect(name).toBeTruthy()
    await expect(button).toHaveAttribute("title", name ?? "")
  }
  await expect(option(0)).toHaveAttribute("aria-pressed", "true")

  await option(1).click()
  await expect.poll(aligned).toBe("center")
  await expect.poll(shown).toBe("center")
  await expect(option(1)).toHaveAttribute("aria-pressed", "true")
  await expect(option(0)).toHaveAttribute("aria-pressed", "false")

  await undoOnStage(page)
  await expect.poll(aligned).toBeUndefined()
  await pick(page, "t:1", 400, 180)
  await expect(option(1)).toHaveAttribute("aria-pressed", "false")
  await option(2).click()
  await expect.poll(aligned).toBe("right")
  await reloadDesign(page)
  await pick(page, "t:1", 400, 180)
  await expect(option(2)).toHaveAttribute("aria-pressed", "true")
  await expect.poll(shown).toBe("right")
})
