import { productCopy } from "../bin/product-copy.mjs"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"

const typed = "My first deck"

function textsIn(register) {
  return Object.values(register?.elements ?? {}).flatMap((element) => {
    const last = element.landed.filter((landed) => landed.visible && typeof landed.value === "string").at(-1)
    return last === undefined
      ? []
      : [
          JSON.parse(last.value)
            .flatMap((paragraph) => paragraph.runs.map((run) => run.text))
            .join(""),
        ]
  })
}

async function clearBrowser(page) {
  await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()
    for (const database of await indexedDB.databases()) {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(database.name)
        request.onsuccess = resolve
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error("database open"))
      })
    }
    const directory = await navigator.storage.getDirectory()
    for await (const name of directory.keys()) await directory.removeEntry(name, { recursive: true })
  })
}

export default async function drive({ repo, page, context, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  const menu = page.getByRole("menu", { name: productCopy.newDeck })
  await expect(menu.getByRole("menuitem", { name: "Import PowerPoint" })).toBeVisible()
  const out = path.dirname(await capture("new-deck-menu"))
  await context.setOffline(true)
  await menu.getByRole("menuitem", { name: productCopy.blankDeck, exact: true }).click()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const address = page.url()
  const deck = address.split("/").at(-1)
  const title = page.locator('[contenteditable="true"]').first()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(0)
  await expect(page.locator("[data-slide-paint] [data-placeholder-prompt]")).toHaveCount(0)
  await expect(page.locator("aside").first()).toContainText(productCopy.blankDeck)
  await capture("blank-created-offline")
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  await expect(title).toBeFocused()
  await title.pressSequentially(typed, { delay: 50 })
  await expect(title).toHaveText(typed)
  await capture("typed-offline")
  note(`created ${deck} with an empty first slide, added a text box and typed "${typed}" with the browser offline`)
  await context.setOffline(false)
  await expect.poll(async () => textsIn((await post(deckRoutes.open, { deck }, cookie)).json.register)).toEqual([typed])
  await expect.poll(async () => (await post(deckRoutes.original, { deck }, cookie)).json.ok).toBe(true)
  const listed = await post(deckRoutes.list, {}, cookie)
  expect(listed.json.decks).toMatchObject([{ deck, name: productCopy.blankDeck }])
  const opened = await post(deckRoutes.open, { deck }, cookie)
  expect(opened.json.register.index.elements).toHaveLength(0)
  note(
    "after reconnecting, the real API keeps the typed text box, no indexed elements, the Blank deck name and the original",
  )
  await page.reload()
  await expect(title).toHaveText(typed)
  await capture("reloaded")
  await page.goto("/")
  await expect(page.getByRole("heading", { name: productCopy.blankDeck, exact: true })).toBeVisible()
  await capture("listed-on-home")
  await page.getByRole("link", { name: productCopy.blankDeck, exact: true }).click()
  await expect(title).toHaveText(typed)
  await page.goto("/version")
  await clearBrowser(page)
  await page.goto(address)
  await expect(title).toHaveText(typed)
  await capture("cleared-browser")
  note("Home lists the new deck; reload and a cleared browser rebuild the edited slide from the server original")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const exported = await download
  expect(exported.suggestedFilename()).toBe("Blank deck.pptx")
  const file = path.join(out, "blank-export.pptx")
  await exported.saveAs(file)
  const original = path.join(repo, "scripts/pptx-fixtures/empty.pptx")
  fs.copyFileSync(original, path.join(out, "empty.pptx"))
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const before = await pptx.readParts(fs.readFileSync(original))
  const after = await pptx.readParts(fs.readFileSync(file))
  expect([...after.keys()]).toEqual([...before.keys()])
  for (const [name, bytes] of before) {
    if (name !== "ppt/slides/slide1.xml") expect(after.get(name), name).toEqual(bytes)
  }
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  expect(page.url()).not.toBe(address)
  await expect(title).toHaveText(typed)
  await capture("export-reimported")
  note(
    `export ${file} preserves every untouched part byte for byte and imports with "${typed}"; original ${path.join(out, "empty.pptx")}`,
  )
}
