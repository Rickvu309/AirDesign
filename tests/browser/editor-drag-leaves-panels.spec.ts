import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { test } from "./api-stack"
import { accent, clickSlide, savedNode, selectedIds, slidePoint, spot } from "./editor-deck"
import { designDoom, panel } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

declare global {
  interface Window {
    quiet?: () => { readonly strip: number; readonly panel: number }
    stripLanded?: boolean
    roots?: { readonly strip: Element; readonly panel: Element }
  }
}

test("a drag leaves the filmstrip and the Design panel alone until it lands", async ({ page, context, stack }) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    { id: "t:1", type: "shape", parent: slide, props: { box: spot(200, 600, 300, 150), fills: accent } },
  ])
  await clickSlide(page, 350, 675)
  expect(await selectedIds(page)).toEqual(["t:1"])
  const alignLeft = panel(page).getByRole("button", { name: editorCopy.alignLeft, exact: true })
  await expect(alignLeft).toBeVisible()
  await expect(page.locator("[data-editor-sidebar] [data-slide-entry]").first()).toBeVisible()

  await page.evaluate(() => {
    const watched = { attributes: true, childList: true, subtree: true, characterData: true }
    const rootOf = (selector: string) => {
      const root = document.querySelector(selector)
      if (root === null) throw new Error(`no ${selector}`)
      return root
    }
    const parentOf = (root: Element) => {
      if (root.parentElement === null) throw new Error("root has no parent")
      return root.parentElement
    }
    window.roots = { strip: rootOf("[data-editor-sidebar]"), panel: rootOf("[data-design-panel]") }
    const count = (root: Element) => {
      let seen = 0
      const watch = new MutationObserver((list) => {
        seen += list.length
      })
      watch.observe(parentOf(root), watched)
      return () => {
        seen += watch.takeRecords().length
        watch.disconnect()
        return seen
      }
    }
    const strip = count(window.roots.strip)
    const panel = count(window.roots.panel)
    window.quiet = () => ({ strip: strip(), panel: panel() })
  })

  const from = await slidePoint(page, 350, 675)
  const to = await slidePoint(page, 650, 800)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 24 })
  const during = await page.evaluate(() => window.quiet?.())
  expect(during, "mutations of the filmstrip and the Design panel while the drag is held").toEqual({
    strip: 0,
    panel: 0,
  })

  await page.evaluate(() => {
    const watched = { attributes: true, childList: true, subtree: true, characterData: true }
    const roots = window.roots
    if (roots === undefined) throw new Error("no roots")
    const parent = roots.strip.parentElement
    if (parent === null) throw new Error("filmstrip has no parent")
    const watch = new MutationObserver(() => {
      watch.disconnect()
      window.stripLanded = true
    })
    watch.observe(parent, watched)
  })
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => window.stripLanded), {
      message: "the filmstrip updates after the drop",
    })
    .toBe(true)
  const kept = await page.evaluate(() => ({
    strip: window.roots?.strip === document.querySelector("[data-editor-sidebar]") && window.roots?.strip.isConnected,
    panel: window.roots?.panel === document.querySelector("[data-design-panel]") && window.roots?.panel.isConnected,
  }))
  expect(kept, "the filmstrip and the Design panel roots are the same connected elements after the drop").toEqual({
    strip: true,
    panel: true,
  })
  const savedBox = async () => (await savedNode(stack, opened, "t:1"))?.box
  await expect
    .poll(async () => {
      const box = await savedBox()
      return typeof box === "object" && box !== null && "x" in box ? box.x : undefined
    })
    .toBeGreaterThan(400)
  await alignLeft.click()
  await expect.poll(savedBox).toMatchObject({ x: 0 })
})
