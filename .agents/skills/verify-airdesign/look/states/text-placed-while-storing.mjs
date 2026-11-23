import { expect } from "@playwright/test"
import { node, openDoomDeck, selected } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { leaveText, placeText } from "../doom-text.mjs"

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

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  const release = await holdDeviceStore(page)
  const placed = []
  for (const [index, month] of ["Jan", "Feb", "Mar"].entries()) {
    await placeText(page, 192 + index * 384, 860)
    await page.keyboard.type(month)
    await leaveText(page)
    placed.push(await selected(page).first().getAttribute("data-selection-outline"))
    await page.keyboard.press("Escape")
  }
  await release()
  for (const id of placed) await expect(node(page, id)).toBeVisible()
  await page.waitForTimeout(1500)
}

export default { name: "text-placed-while-storing", design: editor, drive }
