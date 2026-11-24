import { expect } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { accent, landOffScreen, landProps, openEditor, savedSlides, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a painted slide stays painted while a font another slide asks for is held, and the show waits only for the new slide", async ({
  page,
  context,
  stack,
}) => {
  covers("present", "show-next", "show-stop")
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(2)
  const [first, second] = await savedSlides(stack, opened)
  await landOffScreen(stack, opened, [
    { id: "k:1", type: "shape", parent: first!, props: { name: "Card", box: spot(200, 700, 400, 200), fills: accent } },
  ])
  await landProps(stack, opened, second!, { transition: { kind: "fade", ms: 3000 } })
  await page.locator('[data-slide-entry="1"]').click()
  await page.keyboard.press("F5")
  const shown = page.locator("[data-present-show] [data-present-slide]")
  await expect(shown).toHaveAttribute("data-present-slide", "1")
  await expect(page.locator('[data-present-show] [data-node="k:1"]')).toBeVisible()

  let release = () => {}
  const held = new Promise<void>((done) => {
    release = done
  })
  const asked: string[] = []
  await page.route("**/fonts/file**", async (route) => {
    asked.push(route.request().url())
    await held
    await route.fallback().catch(() => undefined)
  })
  await landOffScreen(stack, opened, [
    {
      id: "t:2",
      type: "shape",
      parent: second!,
      props: {
        name: "Words",
        box: spot(200, 200, 900, 120),
        text: {
          chars: "Quarterly revenue",
          spans: [{ end: 17, font: "Lora" }],
          paras: [{}],
          style: "body",
          resize: "fixed",
          alignV: "top",
        },
      },
    },
  ])
  await expect.poll(() => asked.length).toBeGreaterThan(0)
  await expect(page.locator("[data-present-show] [data-fonts-pending]")).toHaveCount(0)
  await expect(page.locator('[data-present-show] [data-node="k:1"]')).toBeVisible()

  await page.keyboard.press("ArrowRight")
  await expect(shown).toHaveAttribute("data-present-slide", "2")
  await expect(page.locator("[data-present-incoming] [data-fonts-pending]")).toHaveCount(1)
  await expect(page.locator("[data-present-leaving] [data-fonts-pending]")).toHaveCount(0)
  await expect(page.locator('[data-present-leaving] [data-node="k:1"]')).toBeVisible()
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector("[data-present-incoming]")!).visibility === "visible",
    ),
  ).toBe(false)

  release()
  await expect(page.locator("[data-present-show] [data-fonts-pending]")).toHaveCount(0)
  await expect(page.locator('[data-present-show] [data-node="t:2"]')).toBeVisible()
  await page.keyboard.press("Escape")
})

test("pressing Next twice while a font is held keeps the painted slide on screen until the slide it lands on can paint", async ({
  page,
  context,
  stack,
}) => {
  covers("present", "show-next", "show-stop")
  const opened = await openEditor(page, context, stack)
  for (const count of [2, 3]) {
    await page.getByRole("button", { name: slideListCopy.addSlide }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(count)
  }
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(3)
  const [first, second, third] = await savedSlides(stack, opened)
  await landOffScreen(stack, opened, [
    { id: "k:1", type: "shape", parent: first!, props: { name: "Card", box: spot(200, 700, 400, 200), fills: accent } },
    { id: "k:3", type: "shape", parent: third!, props: { name: "Card", box: spot(900, 300, 400, 200), fills: accent } },
  ])
  await landProps(stack, opened, third!, { transition: { kind: "fade", ms: 600 } })
  await page.locator('[data-slide-entry="1"]').click()
  await page.keyboard.press("F5")
  const shown = page.locator("[data-present-show] [data-present-slide]")
  await expect(shown).toHaveAttribute("data-present-slide", "1")
  await expect(page.locator('[data-present-show] [data-node="k:1"]')).toBeVisible()

  let release = () => {}
  const held = new Promise<void>((done) => {
    release = done
  })
  const asked: string[] = []
  await page.route("**/fonts/file**", async (route) => {
    asked.push(route.request().url())
    await held
    await route.fallback().catch(() => undefined)
  })
  await landOffScreen(stack, opened, [
    {
      id: "t:2",
      type: "shape",
      parent: second!,
      props: {
        name: "Words",
        box: spot(200, 200, 900, 120),
        text: {
          chars: "Quarterly revenue",
          spans: [{ end: 17, font: "Lora" }],
          paras: [{}],
          style: "body",
          resize: "fixed",
          alignV: "top",
        },
      },
    },
  ])
  await expect.poll(() => asked.length).toBeGreaterThan(0)
  await expect(page.locator('[data-present-show] [data-node="k:1"]')).toBeVisible()
  await page.evaluate(() => {
    const seen = { frames: 0, blank: 0 }
    Object.assign(window, { presentFrames: seen })
    const look = () => {
      const painted = [...document.querySelectorAll("[data-present-show] [data-node]")].some((node) => {
        const box = node.getBoundingClientRect()
        return box.width > 0 && node.checkVisibility({ visibilityProperty: true, opacityProperty: false })
      })
      seen.frames += 1
      if (!painted) seen.blank += 1
      requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })

  await page.keyboard.press("ArrowRight")
  await expect(shown).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("ArrowRight")
  await expect(shown).toHaveAttribute("data-present-slide", "3")
  await expect(page.locator('[data-present-show] [data-node="k:1"]')).toBeVisible()
  await expect(page.locator("[data-present-show] [data-present-incoming]")).toHaveCount(1)
  await expect(page.locator('[data-present-show] [data-present-incoming="3"]')).toBeHidden()

  release()
  await expect(page.locator('[data-present-show] [data-node="k:3"]')).toBeVisible()
  await expect(page.locator("[data-present-show] [data-present-leaving]")).toHaveCount(0)
  await expect(page.locator('[data-present-show] [data-node="k:1"]')).toHaveCount(0)
  const seen = await page.evaluate(
    () => (window as unknown as { presentFrames: { frames: number; blank: number } }).presentFrames,
  )
  expect(seen.frames).toBeGreaterThan(0)
  expect(seen.blank).toBe(0)
  await page.keyboard.press("Escape")
})
