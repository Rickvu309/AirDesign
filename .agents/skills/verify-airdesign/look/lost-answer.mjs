import path from "node:path"
import { openDeck } from "./open-deck.mjs"

export async function importedDeck(kit) {
  const { cookie } = await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures", "clean.pptx"))
  return { cookie, deck: new URL(kit.page.url()).pathname.split("/").at(-1) }
}

export function committing(kit) {
  return (url) => url.pathname === kit.deckRoutes.commit.path
}

export async function reopened(page) {
  const failed = new Promise((resolve) => page.once("pageerror", resolve))
  const painted = page
    .waitForFunction(
      () => {
        const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
        return document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
      },
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => undefined)
  await page.reload()
  await Promise.race([painted, failed])
}

export async function shownOrFailed(page, text) {
  const failed = new Promise((resolve) => page.once("pageerror", resolve))
  const shown = page
    .getByText(text, { exact: true })
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined)
  await Promise.race([shown, failed])
}

export function pendingSlide(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(all.result.find((row) => row?.kind === "pending" && row.slideEdit !== undefined) ?? null)
          }
        }
      }),
  )
}
