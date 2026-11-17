import { expect, test, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { clean, entry, fifty, manySlides, openFile, openGrid } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

type Opened = {
  readonly before: readonly string[]
  readonly after: readonly string[]
  readonly moved: readonly number[]
}

async function recordOpenings(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const named = () =>
      [...document.querySelectorAll("*")]
        .filter((element) => getComputedStyle(element).viewTransitionName === "slide-opening")
        .map(
          (element) =>
            element.getAttribute("data-slide-entry") ??
            (element.matches("[data-slide-paint], :has([data-slide-paint])") ? "canvas" : "other"),
        )
    const opened: Opened[] = []
    Object.assign(window, { opened })
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = (update?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
      const before = named()
      const transition = start(update)
      const moved = transition.ready.then(() =>
        document
          .getAnimations()
          .filter((animation) => {
            const effect = animation.effect
            return effect instanceof KeyframeEffect && effect.pseudoElement === "::view-transition-group(slide-opening)"
          })
          .map((animation) => Number(animation.effect?.getComputedTiming().duration)),
      )
      void transition.finished.then(async () => opened.push({ before, after: named(), moved: await moved }))
      return transition
    }
  })
}

async function openings(page: Page): Promise<Opened[]> {
  return page.evaluate(() => (window as unknown as { opened: Opened[] }).opened)
}

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" })

  test("opening a slide carries its card to the canvas, and the grid carries the canvas back to its card", async ({
    page,
  }) => {
    await recordOpenings(page)
    await openFile(page, clean)
    await page.getByRole("button", { name: "Add slide", exact: true }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
    await openGrid(page)
    await expect.poll(() => openings(page)).toEqual([{ before: ["canvas"], after: ["2"], moved: [280] }])
    await entry(page, 1).click()
    await expect(page.locator("[data-editor-grid]")).toBeVisible()
    await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
    await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
    await expect
      .poll(() => openings(page))
      .toEqual([
        { before: ["canvas"], after: ["2"], moved: [280] },
        { before: ["1"], after: ["canvas"], moved: [280] },
      ])
    await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
    await openGrid(page)
    await expect(entry(page, 1)).toBeFocused()
    await expect(entry(page, 1)).toBeInViewport()
    await expect
      .poll(() => openings(page))
      .toEqual([
        { before: ["canvas"], after: ["2"], moved: [280] },
        { before: ["1"], after: ["canvas"], moved: [280] },
        { before: ["canvas"], after: ["1"], moved: [280] },
      ])
  })
})

test("with reduced motion the grid opens and closes with no transition, back on the slide that was open", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await recordOpenings(page)
  await openFile(page, {
    name: "fifty.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(fifty),
  })
  await openGrid(page)
  await entry(page, 1).focus()
  await page.keyboard.press("End")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(entry(page, fifty)).toHaveAttribute("aria-current", "true")
  await openGrid(page)
  await expect(entry(page, fifty)).toBeFocused()
  await expect(entry(page, fifty)).toBeInViewport()
  expect(await openings(page)).toEqual([])
})
