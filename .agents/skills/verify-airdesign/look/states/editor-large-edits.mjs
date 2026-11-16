import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"
import { editor } from "../editor-screen.mjs"

const committing = "**/decks/commit"

function keepLargeEdits({ count, quotes }) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("airdesign")
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const writing = database.transaction("rows", "readwrite")
      const store = writing.objectStore("rows")
      const cursor = store.openCursor()
      writing.onerror = () => reject(writing.error)
      writing.oncomplete = () => {
        database.close()
        resolve()
      }
      cursor.onsuccess = () => {
        const at = cursor.result
        if (at === null) return
        const { once: _sealed, ...row } = at.value
        if (row.kind !== "pending" || typeof row.value !== "string") return at.continue()
        const key = String(at.key)
        const paragraphs = JSON.parse(row.value)
        store.put(row, key)
        for (let index = 0; index < count; index += 1) {
          const order = row.order + 1 + index
          const runs = [{ ...paragraphs[0].runs[0], text: `${quotes}${index}` }]
          const value = JSON.stringify([{ ...paragraphs[0], runs }])
          store.put(
            { ...row, order, base: row.base + 1 + index, value },
            key.replace(/\d{12}$/, String(order).padStart(12, "0")),
          )
        }
      }
    }
  })
}

async function drive(kit) {
  await openAgent(kit)
  const status = kit.page.locator("[data-save-status]")
  await kit.page.route(committing, (route) => route.abort("connectionfailed"))
  const text = kit.page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("x")
  await expect(status).toHaveText("Unable to reach AirDesign")
  await kit.page.evaluate(keepLargeEdits, { count: 80, quotes: '"'.repeat(3_700) })
  await kit.page.unroute(committing)
  await kit.page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect(status).not.toHaveText("Unable to reach AirDesign", { timeout: 20_000 })
  await expect(status).not.toHaveText("Saving…", { timeout: 20_000 })
  await kit.page.waitForTimeout(1500)
}

export default { name: "editor-large-edits", design: editor, drive }
