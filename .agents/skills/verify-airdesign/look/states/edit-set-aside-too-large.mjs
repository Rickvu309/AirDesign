import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"

const committing = "**/decks/commit"
const told = "Unable to save an edit. It was too large to save, so an export of this deck does not include it."

function keepTooLargeEdit({ quotes }) {
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
        const order = row.order + 1
        const runs = [{ ...paragraphs[0].runs[0], text: quotes }]
        const value = JSON.stringify([{ ...paragraphs[0], runs }])
        store.put(
          { ...row, order, base: row.base + 1, value, once: "stuck-batch" },
          key.replace(/\d{12}$/, String(order).padStart(12, "0")),
        )
        store.put({ ...row, once: "stuck-batch" }, key)
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
  await kit.page.evaluate(keepTooLargeEdit, { quotes: '"'.repeat(1_000_000) })
  await kit.page.unroute(committing)
  await kit.page.reload()
  await expect(kit.page.getByText(told, { exact: true })).toBeVisible({ timeout: 20_000 })
}

export default {
  name: "edit-set-aside-too-large",
  design: "/screens/s49-05-editor-errors-edit-set-aside-too-large",
  drive,
}
