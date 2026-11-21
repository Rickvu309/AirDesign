import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { format, openRegister } from "../../packages/document/src/index.ts"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const deckAddress = /\/deck\/[A-Za-z0-9_-]{1,64}$/

async function serve(page: Page): Promise<string[]> {
  const commits: string[] = []
  await page.route("**/decks/open", async (route) => {
    const { deck } = route.request().postDataJSON() as { deck: string }
    await route.fulfill({ json: { ok: true, deck, revision: 0, register: openRegister("", "") } })
  })
  await page.route("**/decks/index", async (route) => {
    const { deck } = route.request().postDataJSON() as { deck: string }
    await route.fulfill({ json: { ok: true, deck, revision: 0 } })
  })
  await page.route("**/decks/commit", async (route) => {
    const { deck } = route.request().postDataJSON() as { deck: string }
    commits.push(deck)
    await route.abort("internetdisconnected")
  })
  await page.route("**/decks/list", (route) =>
    route.fulfill({ json: { ok: true, account: { email: "first@example.com" }, decks: [], trash: [] } }),
  )
  await page.route("**/decks/rename", (route) => route.fulfill({ json: { ok: true } }))
  return commits
}

function newerBuildQueues(page: Page, version: number): Promise<string[]> {
  return page.evaluate(
    (at) =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign", at)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const writing = database.transaction("rows", "readwrite")
          const store = writing.objectStore("rows")
          store.put({ kind: "pending", node: "258.slide", format: at }, "newer\u0005deck\u0000p\u00000")
          const all = store.getAll()
          writing.oncomplete = () => {
            database.close()
            resolve((all.result as { node?: string }[]).map((row) => String(row.node)))
          }
        }
      }),
    version,
  )
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a deck a newer build stored asks the person to reload and sends nothing", async ({ page, context }) => {
  await serve(page)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(deckAddress)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  const address = new URL(page.url()).pathname
  await page.locator('[contenteditable="true"]').dblclick()
  await page.keyboard.press("End")
  await page.keyboard.type(" there")
  await expect(page.getByText("Unable to reach AirDesign. Edits are saved on this device.")).toBeVisible()

  expect(await newerBuildQueues(page, format + 1)).toContain("258.slide")
  const reopened = await context.newPage()
  const commits = await serve(reopened)
  await reopened.goto(address)

  const line = reopened.locator("[data-deck-refused]")
  await expect(line).toBeVisible()
  await expect(reopened.getByText("AirDesign has a new version")).toBeVisible()
  await expect(reopened.getByRole("button", { name: "Reload" })).toBeVisible()
  await expect(reopened.locator('[contenteditable="true"]')).toHaveCount(0)
  expect(await newerBuildQueues(reopened, format + 1)).toContain("258.slide")
  expect(commits).toEqual([])
})
