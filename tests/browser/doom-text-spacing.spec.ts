import { expect, type Locator } from "@playwright/test"
import { doomEditorCopy } from "../../apps/web/src/copy/doom-editor-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { test } from "./api-stack"
import { clickSlide, landNodes, openDoomEditor, savedNode, spot } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

async function typeInto(field: Locator, value: string) {
  await field.fill(value)
  await field.press("Tab")
}

test("letter spacing typed past Doom's limit at the largest size is clamped and saved, never silently reverted", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(200, 600, 800, 300),
        text: { chars: "Hello there", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" },
      },
    },
  ])
  await clickSlide(page, 300, 640)
  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  const panel = page.locator("[data-design-panel]")
  const spans = async () => ((await savedNode(stack, opened, "t:1")) as { text: { spans: unknown[] } }).text.spans

  await typeInto(panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true }), "2000")
  await expect.poll(spans).toEqual([{ end: 11, size: 2000 }])
  const spacing = panel.getByRole("textbox", { name: textCopy.letterSpacing, exact: true })
  await typeInto(spacing, "100")
  await expect.poll(spans).toEqual([{ end: 11, size: 2000, tracking: 100 }])
  await expect(spacing).toHaveValue("5")
})

test("text size and line height typed past Doom's limit are clamped and saved on Tab and on Enter", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(200, 600, 800, 300),
        text: { chars: "Hello there", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" },
      },
    },
  ])
  await clickSlide(page, 300, 640)
  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  const panel = page.locator("[data-design-panel]")
  const text = async () =>
    (await savedNode(stack, opened, "t:1")) as { text: { spans: unknown[]; paras: { lineHeight?: number }[] } }
  const size = panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })
  const line = panel.getByRole("textbox", { name: textCopy.lineHeight, exact: true })

  await size.fill("2001")
  await size.press("Tab")
  await expect.poll(async () => (await text()).text.spans).toEqual([{ end: 11, size: 2000 }])
  await size.fill("0")
  await size.press("Enter")
  await expect.poll(async () => (await text()).text.spans).toEqual([{ end: 11, size: 1 }])
  await line.fill("501")
  await line.press("Tab")
  await expect.poll(async () => (await text()).text.paras[0]?.lineHeight).toBe(5)
  await line.fill("0")
  await line.press("Enter")
  await expect.poll(async () => (await text()).text.paras[0]?.lineHeight).toBe(0.5)
})
