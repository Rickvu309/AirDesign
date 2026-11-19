import path from "node:path"
import { expect } from "@playwright/test"

async function pending(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction("rows", "readonly")
          const rows = transaction.objectStore("rows").getAll()
          rows.onsuccess = () => resolve(rows.result.filter((row) => row.kind === "pending"))
          transaction.oncomplete = () => database.close()
        }
      }),
  )
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  const deck = page.url().split("/").at(-1)
  const before = (await post(deckRoutes.open, { deck }, cookie)).json.revision
  let first
  let resumed
  let release = false
  await page.route(`**${deckRoutes.commit.path}`, async (route) => {
    const body = route.request().postDataJSON()
    if (!release) {
      if (first === undefined) {
        first = body
        const response = await route.fetch()
        expect((await response.json()).ok).toBe(true)
      }
      await route.abort("connectionfailed")
    } else {
      resumed = body
      await route.continue()
    }
  })
  await editor.dblclick()
  await page.keyboard.press("End")
  await page.keyboard.type("!")
  await expect(editor).toHaveText("Hello!")
  await expect.poll(async () => (await post(deckRoutes.open, { deck }, cookie)).json.revision).toBe(before + 1)
  await expect.poll(async () => (await pending(page)).length).toBe(1)
  expect((await pending(page))[0].once).toBe(first.once)
  await capture("answer-lost")
  note("The real server stored the edit; its answer was dropped and the keyed row remains queued.")
  await page.goto("/version")
  release = true
  await page.goto(`/deck/${deck}`)
  await expect(editor).toHaveText("Hello!")
  await expect.poll(async () => (await pending(page)).length).toBe(0)
  expect(resumed).toEqual(first)
  const after = (await post(deckRoutes.open, { deck }, cookie)).json
  expect(after.revision).toBe(before + 1)
  await capture("reloaded-and-drained")
  note(
    `After reload the identical batch and once key were resent, the queue drained, and revision stayed ${after.revision}.`,
  )
}
