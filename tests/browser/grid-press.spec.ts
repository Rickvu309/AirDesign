import { expect, type Page } from "@playwright/test"
import { entry, manySlides, openGrid } from "./slide-grid-deck"
import { panOf, roomOf, zoomTo } from "./grid-reorder-deck"
import { test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce", hasTouch: true })

const card = (page: Page) => page.locator("[data-grid-card]").nth(1)
const live = (page: Page) => card(page).locator("[data-grid-edit]")
const selected = (page: Page) => live(page).locator("[data-selection]")

test.beforeEach(async ({ page }) => {
  if (process.env.AIRDESIGN_GRID_CPU_RATE !== "4") return
  const device = await page.context().newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
})

for (const zoom of ["fit", 200] as const) {
  for (const pointer of ["mouse", "touch"] as const) {
    test(`press ownership at ${String(zoom)} with ${pointer}`, async ({ page, decks }) => {
      await decks.open({ name: "three.pptx", mimeType: "application/octet-stream", buffer: await manySlides(3) })
      await openGrid(page)
      if (zoom !== "fit") await zoomTo(page, zoom)
      const device = await page.context().newCDPSession(page)
      async function point(surface: "number" | "blank" | "element", active: boolean) {
        const box = await entry(page, 2).boundingBox()
        if (box === null) throw new Error("no card")
        const room = await roomOf(page)
        await page.mouse.move(room.x + 20, room.y + 20)
        await page.mouse.wheel(box.x - room.x - 100, box.y - room.y - 80)
        const slid = await entry(page, 2).boundingBox()
        if (slid === null) throw new Error("no card")
        if (surface === "blank") {
          const x = slid.x + slid.width * 0.8
          const y = slid.y + slid.height * 0.8
          await page.mouse.wheel(x - room.x - room.width / 2, y - room.y - room.height / 2)
          const placed = await entry(page, 2).boundingBox()
          if (placed === null) throw new Error("no card")
          return { x: placed.x + placed.width * 0.8, y: placed.y + placed.height * 0.8 }
        }
        const target =
          surface === "number"
            ? card(page).locator("[data-slide-number]")
            : active
              ? live(page).locator("[data-canvas-element]").first()
              : card(page).locator("[data-thumb-node]").first()
        const hit = await target.boundingBox()
        if (hit === null) throw new Error("no target")
        return { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 }
      }
      async function press(at: { x: number; y: number }, moved: boolean) {
        if (pointer === "mouse") {
          await page.mouse.move(at.x, at.y)
          await page.mouse.down()
          if (moved) await page.mouse.move(at.x + 30, at.y + 20, { steps: 4 })
        } else {
          await device.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...at, id: 1 }] })
          if (moved)
            await device.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x: at.x + 30, y: at.y + 20, id: 1 }],
            })
        }
      }
      async function release() {
        if (pointer === "mouse") await page.mouse.up()
        else await device.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      }
      for (const active of [false, true]) {
        for (const surface of ["number", "blank", "element"] as const) {
          for (const moved of [false, true]) {
            await test.step(`${active ? "open" : "closed"} ${surface} ${moved ? "drag" : "click"}`, async () => {
              if (active) {
                await entry(page, 2).focus()
                await page.keyboard.press("Enter")
                await expect(live(page)).toHaveCount(1)
                const element = await point("element", true)
                await page.mouse.click(element.x, element.y)
                await expect(selected(page)).toHaveCount(1)
              } else {
                await page.keyboard.press("Escape")
                await page.keyboard.press("Escape")
                await expect(live(page)).toHaveCount(0)
              }
              const at = await point(surface, active)
              await press(at, moved)
              if (surface === "element") {
                await expect(selected(page)).toHaveCount(1)
                await expect(page.locator("[data-drag-ghost]")).toHaveCount(0)
                await release()
              } else if (moved) {
                await expect(page.locator("[data-drag-ghost]")).toBeVisible()
                await page.keyboard.press("Escape")
                await release()
                await expect(live(page)).toHaveCount(active ? 1 : 0)
                if (active) await expect(selected(page)).toHaveCount(1)
                await expect(page.locator("[data-drag-ghost]")).toHaveCount(0)
              } else {
                await release()
                await expect(live(page)).toHaveCount(0)
                await expect(entry(page, 2)).toHaveAttribute("data-selected", "")
              }
            })
          }
        }
      }
      await page.keyboard.press("Escape")
      await page.keyboard.press("Escape")
      for (const tool of ["Space", "h"]) {
        for (const active of [false, true]) {
          if (active) {
            await entry(page, 2).focus()
            await page.keyboard.press("Enter")
          }
          for (const surface of ["number", "blank", "element"] as const) {
            const at = await point(surface, active)
            const before = await panOf(page)
            if (tool === "Space") await page.keyboard.down("Space")
            else await page.keyboard.press("h")
            await press(at, true)
            await release()
            if (tool === "Space") await page.keyboard.up("Space")
            else await page.keyboard.press("v")
            const after = await panOf(page)
            expect(after.x - before.x).toBeCloseTo(30, 0)
            expect(after.y - before.y).toBeCloseTo(20, 0)
            await expect(live(page)).toHaveCount(active ? 1 : 0)
            await expect(selected(page)).toHaveCount(0)
            await expect(page.locator("[data-drag-ghost]")).toHaveCount(0)
          }
          await page.keyboard.press("Escape")
        }
      }
    })
  }
}
