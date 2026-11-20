import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function holdDeviceStore(page) {
  await page.evaluate(
    () =>
      new Promise((held, refused) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => refused(request.error)
        request.onsuccess = () => {
          const database = request.result
          const stores = [...database.objectStoreNames]
          const writing = database.transaction(stores, "readwrite")
          const rows = writing.objectStore(stores[0] ?? "")
          let releasing = false
          window.releaseDeviceStore = () => {
            releasing = true
          }
          const keep = () => {
            if (!releasing) rows.get("held").onsuccess = keep
          }
          keep()
          writing.oncomplete = () => database.close()
          held()
        }
      }),
  )
  return () => page.evaluate(() => window.releaseDeviceStore())
}

async function drive({ page, signIn }) {
  await signIn()
  await page.goto("./")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().match(/\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const slide = page.locator("[data-slide-paint]").first()
  const box = await slide.boundingBox()
  if (box === null) throw new Error("slide")
  await slide.click({ position: { x: 4, y: 4 } })
  const release = await holdDeviceStore(page)
  for (const [index, month] of ["Jan", "Feb", "Mar"].entries()) {
    await page.keyboard.press("t")
    await page.mouse.click(box.x + box.width * (0.1 + index * 0.2), box.y + box.height * 0.2)
    await page.keyboard.type(month)
    await page.keyboard.press("Escape")
  }
  await release()
  await expect(slide.locator("[data-canvas-element]")).not.toHaveCount(0)
  await page.waitForTimeout(1500)
}

export default { name: "text-placed-while-storing", design: editor, drive }
