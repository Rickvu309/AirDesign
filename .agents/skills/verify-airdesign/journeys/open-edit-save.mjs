import { productCopy } from "../../../../apps/web/src/copy/product-copy.ts"
import path from "node:path"
import { expect } from "@playwright/test"

const typed = "Saved on the server"

function textsIn(register) {
  return Object.values(register?.elements ?? {}).flatMap((element) => {
    const last = element.landed.filter((landed) => landed.visible).at(-1)
    if (last === undefined) return []
    return [
      JSON.parse(last.value)
        .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
        .join("\n"),
    ]
  })
}

async function forgetLocalRows(page) {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction("rows", "readwrite")
          transaction.onerror = () => reject(transaction.error)
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          const cursor = transaction.objectStore("rows").openCursor()
          cursor.onsuccess = () => {
            const at = cursor.result
            if (at === null) return
            const row = at.value
            if (typeof row === "object" && row !== null && "kind" in row) at.delete()
            at.continue()
          }
        }
      }),
  )
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await expect(page.getByRole("button", { name: productCopy.newDeck, exact: true })).toBeVisible()
  await capture("home-signed-in")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await capture("imported")
  note(`imported clean.pptx as deck ${deck}; the slide shows "Hello"`)
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially(typed, { delay: 50 })
  await expect(editor).toHaveText(typed)
  await capture("typed")
  await expect
    .poll(async () => textsIn((await post(deckRoutes.open, { deck }, cookie)).json.register), { timeout: 20_000 })
    .toEqual([typed])
  note(`server copy of ${deck} reads "${typed}" (${deckRoutes.open.path})`)
  const listed = await post(deckRoutes.list, {}, cookie)
  expect(listed.json.decks.map((entry) => entry.deck)).toContain(deck)
  note(`${deckRoutes.list.path} lists ${deck}`)
  const deckUrl = page.url()
  await page.goto("/version")
  await forgetLocalRows(page)
  await page.goto(deckUrl)
  await expect(page.locator('[contenteditable="true"]')).toHaveText(typed, { timeout: 20_000 })
  await capture("reloaded-from-server")
  note("after removing every local edit row and reopening the deck, the slide reads the text the server returned")
}
