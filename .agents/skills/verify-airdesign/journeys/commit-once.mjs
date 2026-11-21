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

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes, dropReply }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  const deck = page.url().split("/").at(-1)
  const before = (await post(deckRoutes.open, { deck }, cookie)).json.revision
  const { dropped, restore } = await dropReply(deckRoutes.commit)
  await editor.dblclick()
  await page.keyboard.press("End")
  await page.keyboard.type("!")
  await expect(editor).toHaveText("Hello!")
  await expect.poll(async () => (await post(deckRoutes.open, { deck }, cookie)).json.revision).toBe(before + 1)
  const { request, response } = await dropped
  const first = request.postDataJSON()
  expect((await response.json()).ok).toBe(true)
  await expect.poll(async () => (await pending(page)).length).toBe(1)
  expect((await pending(page))[0].once).toBe(first.once)
  await capture("answer-lost")
  note("The real server stored the edit; its answer was dropped and the keyed row remains queued.")
  await page.goto("/version")
  let resent
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === deckRoutes.commit.path) resent = request.postDataJSON()
  })
  await restore()
  await page.goto(`/deck/${deck}`)
  await expect(editor).toHaveText("Hello!")
  await expect.poll(async () => (await pending(page)).length).toBe(0)
  expect(resent).toEqual(first)
  const after = (await post(deckRoutes.open, { deck }, cookie)).json
  expect(after.revision).toBe(before + 1)
  await capture("reloaded-and-drained")
  note(
    `After reload the identical batch and once key were resent, the queue drained, and revision stayed ${after.revision}.`,
  )
}
