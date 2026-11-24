import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { test } from "./api-stack"
import { clickSlide, landNodes, openEditor, savedNode, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

test("text size typed past Doom's limit is clamped and saved on Tab and on Enter", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
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
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  const panel = page.locator("[data-design-panel]")
  const text = async () => (await savedNode(stack, opened, "t:1")) as { text: { spans: unknown[] } }
  const size = panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })

  await size.fill("2001")
  await size.press("Tab")
  await expect.poll(async () => (await text()).text.spans).toEqual([{ end: 11, size: 2000 }])
  await size.fill("0")
  await size.press("Enter")
  await expect.poll(async () => (await text()).text.spans).toEqual([{ end: 11, size: 1 }])
})
