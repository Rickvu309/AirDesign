import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, landNodes, openEditor, spot } from "./editor-deck"
import { panel } from "./editor-design"
import { edit, runs } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 } })

const letters = "MMMMMMMMMMMMMMMMMMMM"

test("Ctrl+B on a template heading toggles SemiBold and Bold, and the painted width follows", async ({
  page,
  context,
  stack,
}) => {
  covers("bold")
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await expect(panel(page)).toBeVisible()
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(80, 560, 1700, 120),
        text: {
          chars: letters,
          spans: [],
          paras: [{}],
          style: "heading",
          resize: "fixed",
          alignV: "top",
        },
      },
    },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)
  await page.evaluate(() => document.fonts.ready)
  await clickSlide(page, 300, 600)
  await edit(page)
  await page.keyboard.press("ControlOrMeta+a")

  const painted = () =>
    runs(page)
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node)
        return {
          family: style.fontFamily,
          weight: style.fontWeight,
          width: node.getBoundingClientRect().width,
        }
      })
  const weightName = () =>
    panel(page)
      .getByRole("combobox", { name: textCopy.weight, exact: true })
      .innerText()
      .then((text) => text.replace(/[^A-Za-z]/g, "").replace(/Weight/g, ""))

  await expect.poll(async () => (await painted()).family).toContain("Inter SemiBold")
  await expect.poll(weightName).toBe("SemiBold")
  const before = await painted()

  await page.keyboard.press("ControlOrMeta+b")
  await expect.poll(async () => (await painted()).width).toBeGreaterThan(before.width + 2)
  await expect.poll(async () => (await painted()).family).not.toContain("SemiBold")
  await expect.poll(async () => (await painted()).weight).toBe("700")
  await expect.poll(weightName).toBe(shortcutCopy.gestures.bold)
  const bold = await painted()

  await page.keyboard.press("ControlOrMeta+b")
  await expect.poll(async () => (await painted()).family).toContain("Inter SemiBold")
  await expect.poll(weightName).toBe("SemiBold")
  await expect.poll(async () => Math.abs((await painted()).width - before.width)).toBeLessThan(1)
  expect(bold.width).toBeGreaterThan(before.width + 2)
})

test("Ctrl+B on a label whose style weight is 600 on a plain family toggles Bold and Regular, in step with the canvas", async ({
  page,
  context,
  stack,
}) => {
  covers("bold")
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await expect(panel(page)).toBeVisible()
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(80, 560, 1700, 120),
        text: { chars: letters, spans: [], paras: [{}], style: "label", resize: "fixed", alignV: "top" },
      },
    },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)
  await page.evaluate(() => document.fonts.ready)
  await clickSlide(page, 300, 600)
  await edit(page)
  await page.keyboard.press("ControlOrMeta+a")

  const painted = () =>
    runs(page)
      .first()
      .evaluate((node) => ({
        weight: getComputedStyle(node).fontWeight,
        width: node.getBoundingClientRect().width,
      }))
  const weightName = () =>
    panel(page)
      .getByRole("combobox", { name: textCopy.weight, exact: true })
      .innerText()
      .then((text) => text.replace(/[^A-Za-z]/g, "").replace(/Weight/g, ""))

  const resting = await painted()
  const restingName = resting.weight === "700" ? shortcutCopy.gestures.bold : "Regular"
  await expect.poll(weightName).toBe(restingName)

  await page.keyboard.press("ControlOrMeta+b")
  await expect.poll(async () => (await painted()).weight).not.toBe(resting.weight)
  const flipped = await painted()
  await expect.poll(weightName).toBe(flipped.weight === "700" ? shortcutCopy.gestures.bold : "Regular")
  expect(flipped.width).not.toBeCloseTo(resting.width, 0)

  await page.keyboard.press("ControlOrMeta+b")
  await expect.poll(async () => (await painted()).weight).toBe(resting.weight)
  await expect.poll(weightName).toBe(restingName)
  await expect.poll(async () => Math.abs((await painted()).width - resting.width)).toBeLessThan(1)
})
