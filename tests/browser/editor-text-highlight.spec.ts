import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { clickSlide, landNodes, openEditor, spot } from "./editor-deck"
import { editor } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 } })

test("selected words are highlighted at the height of their line, inside the text box, and only as wide as the words", async ({
  page,
  context,
  stack,
}) => {
  await openEditor(page, context, stack)
  await clickSlide(page, 600, 410)
  await page.keyboard.press("Enter")
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("Hello world")
  for (let step = 0; step < 5; step++) await page.keyboard.press("Shift+ArrowLeft")
  const read = () =>
    page.evaluate(() => {
      const box = (rect: DOMRect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })
      const host = document.querySelector("[data-text-editor]")!
      const selection = getSelection()!
      return {
        highlights: [...document.querySelectorAll("[data-text-highlight]")].map((each) =>
          box(each.getBoundingClientRect()),
        ),
        line: box(host.querySelector("[data-line]")!.getBoundingClientRect()),
        frame: box(host.getBoundingClientRect()),
        words: box(selection.getRangeAt(0).getBoundingClientRect()),
        native: getComputedStyle(host.querySelector("[data-run]")!, "::selection").backgroundColor,
      }
    })
  await expect.poll(async () => (await read()).highlights.length).toBe(1)
  const { highlights, line, frame, words, native } = await read()
  const [highlight] = highlights
  expect(Math.abs(highlight!.top - line.top)).toBeLessThan(0.5)
  expect(Math.abs(highlight!.bottom - line.bottom)).toBeLessThan(0.5)
  expect(highlight!.bottom).toBeLessThanOrEqual(frame.bottom + 0.5)
  expect(Math.abs(highlight!.left - words.left)).toBeLessThan(1)
  expect(Math.abs(highlight!.right - words.right)).toBeLessThan(1)
  expect(native).toBe("rgba(0, 0, 0, 0)")
  await page.keyboard.press("ArrowRight")
  await expect(page.locator("[data-text-highlight]")).toHaveCount(0)
})

test("a highlight ends at the last letter of a wrapped line and reaches a little past a line that ends its paragraph", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const chars = "Costs fall twelve percent this year\nTwo shifts"
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        name: "Words",
        box: spot(300, 600, 420, 300),
        text: { chars, spans: [], paras: [{}, {}], style: "body", resize: "fixed", alignV: "top" },
      },
    },
  ])
  await clickSlide(page, 320, 620)
  await page.keyboard.press("Enter")
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  const read = () =>
    page.evaluate(() => {
      const host = document.querySelector("[data-text-editor]")!
      const lines = [...host.querySelectorAll("[data-line]")]
      const range = document.createRange()
      return {
        highlights: [...document.querySelectorAll("[data-text-highlight]")].map(
          (each) => each.getBoundingClientRect().right,
        ),
        words: lines.map((line) => {
          range.selectNodeContents(line)
          return range.getBoundingClientRect().right
        }),
        height: lines[0]!.getBoundingClientRect().height,
      }
    })
  await expect.poll(async () => (await read()).highlights.length).toBeGreaterThan(2)
  const { highlights, words, height } = await read()
  expect(highlights.length).toBe(words.length)
  const ended = words.length - 2
  highlights.forEach((right, at) => {
    const past = right - words[at]!
    if (at === ended) expect(Math.abs(past - height / 4)).toBeLessThan(1)
    else expect(Math.abs(past)).toBeLessThan(1)
  })
})

test("right-to-left words selected after left-to-right words are highlighted across their whole width", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const chars = "abc אבג"
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        name: "Words",
        box: spot(300, 600, 800, 200),
        text: {
          chars,
          spans: [{ end: 4 }, { end: 7, bold: true }],
          paras: [{}],
          style: "body",
          resize: "fixed",
          alignV: "top",
        },
      },
    },
  ])
  await clickSlide(page, 320, 620)
  await page.keyboard.press("Enter")
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+End")
  for (let step = 0; step < 3; step++) await page.keyboard.press("Shift+ArrowLeft")
  const read = () =>
    page.evaluate(() => {
      const side = (rect: DOMRect | undefined) => (rect === undefined ? null : { left: rect.left, right: rect.right })
      const last = [...document.querySelectorAll("[data-text-editor] [data-run]")].at(-1)
      return {
        highlight: side(document.querySelector("[data-text-highlight]")?.getBoundingClientRect()),
        words: side(last?.getBoundingClientRect()),
        picked: getSelection()?.toString(),
      }
    })
  await expect.poll(async () => (await read()).picked).toBe("אבג")
  await expect.poll(async () => (await read()).highlight).not.toBeNull()
  const { highlight, words } = await read()
  expect(words!.right - words!.left).toBeGreaterThan(5)
  expect(Math.abs(highlight!.left - words!.left)).toBeLessThan(1)
  expect(Math.abs(highlight!.right - words!.right)).toBeLessThan(1)
})
