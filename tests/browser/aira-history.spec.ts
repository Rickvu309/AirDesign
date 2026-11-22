import { expect, type BrowserContext, type Page } from "@playwright/test"
import { airaCopy, airaHistoryNameOf } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, signInBrowser, test, type Stack } from "./api-stack"
import { holdableDevice, slowDevice } from "./slow-device"
import { decksOn } from "./deck-test"

const node = "256.2"
const asked = "Change the title to Hello from Aira"
const title = "Change the title to Hello from Aira"
const reply = "The title now reads Hello from Aira."
const answer = "Lead with the claim. Then show the evidence."

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

async function openDeck(page: Page, context: BrowserContext, stack: Stack, indexLate = false) {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  let release = () => {}
  const painted = new Promise<void>((resolve) => {
    release = resolve
  })
  if (indexLate) {
    await page.route("**/decks/index", async (route) => {
      await painted
      await route.fallback()
    })
    await decksOn(page).openHeld()
    release()
  }
  const deck = indexLate ? await decksOn(page).ready() : await decksOn(page).open()
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const side = page.locator("[data-editor-panel]")
  return { cookie, deck, base: String(base), side, log: side.getByRole("log") }
}

async function ask(page: Page, text: string) {
  await page.locator("[data-editor-panel]").getByRole("textbox", { name: "Ask Aira" }).fill(text)
  await page.keyboard.press("Enter")
}

async function chatRuns(page: Page, deck: string): Promise<string[]> {
  return page.evaluate(
    (deck) =>
      new Promise<string[]>((resolve, reject) => {
        const opened = indexedDB.open("airdesign")
        opened.onerror = () => reject(opened.error)
        opened.onsuccess = () => {
          const account = /airdesign\.account=([0-9a-f]{32})/.exec(document.cookie)?.[1] ?? ""
          const prefix = `${account}\u0005${deck}\u0004`
          const values = opened.result
            .transaction("rows", "readonly")
            .objectStore("rows")
            .getAll(IDBKeyRange.bound(prefix, `${prefix}\uffff`))
          values.onsuccess = () => {
            opened.result.close()
            const chats = values.result as { exchanges: { runs: string[] }[] }[]
            resolve(chats.flatMap((chat) => chat.exchanges.flatMap((exchange) => exchange.runs)))
          }
        }
      }),
    deck,
  )
}

async function chatKeys(page: Page, deck: string): Promise<string[]> {
  return page.evaluate(
    (deck) =>
      new Promise<string[]>((resolve, reject) => {
        const opened = indexedDB.open("airdesign")
        opened.onerror = () => reject(opened.error)
        opened.onsuccess = () => {
          const account = /airdesign\.account=([0-9a-f]{32})/.exec(document.cookie)?.[1] ?? ""
          const prefix = `${account}\u0005${deck}\u0004`
          const keys = opened.result
            .transaction("rows", "readonly")
            .objectStore("rows")
            .getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`))
          keys.onsuccess = () => {
            opened.result.close()
            resolve(keys.result.map(String))
          }
        }
      }),
    deck,
  )
}

async function shelvedKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("airdesign:chats:")))
}

test("an answer shown while the device write is slow is still there after an immediate reload", async ({
  page,
  context,
  stack,
  decks,
}) => {
  await holdableDevice(page)
  const { deck, side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "turn.sse" })
  await slowDevice(page)
  await ask(page, "Lead with the number")
  await expect(log.getByText(answer, { exact: true })).toBeVisible()
  await page.reload()
  await decks.ready()
  await expect(log.getByText("Lead with the number", { exact: true })).toBeVisible()
  await expect(log.getByText(answer, { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: airaHistoryNameOf("Lead with the number") })).toBeVisible()
  await expect.poll(() => chatKeys(page, deck)).toHaveLength(1)
  expect(await shelvedKeys(page)).toEqual([])
})

test("an answer shown while the device write is slow is still there when the tab is closed and the deck is opened again", async ({
  page,
  context,
  stack,
}) => {
  await holdableDevice(page)
  const { deck } = await openDeck(page, context, stack)
  stack.aira({ name: "turn.sse" })
  await slowDevice(page)
  await ask(page, "Lead with the number")
  await expect(page.locator("[data-editor-panel]").getByRole("log").getByText(answer, { exact: true })).toBeVisible()
  await page.close()
  const reopened = await context.newPage()
  await forward(reopened, stack)
  await reopened.goto(`/deck/${deck}`)
  await decksOn(reopened).ready()
  const log = reopened.locator("[data-editor-panel]").getByRole("log")
  await expect(log.getByText("Lead with the number", { exact: true })).toBeVisible()
  await expect(log.getByText(answer, { exact: true })).toBeVisible()
  await expect.poll(() => chatKeys(reopened, deck)).toHaveLength(1)
})

test("a reply cut off by a reload is kept up to where it got, as stopped, and runs nothing again", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const { deck, base, side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base, node }, holdAfter: 3 }, { name: "edited.sse" })
  const reached = stack.hold()
  await ask(page, asked)
  await reached
  await expect(side.getByText("I will change the title", { exact: true })).toBeVisible()
  const turns: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/aira/turn") turns.push(request.url())
  })
  await page.reload()
  stack.release()
  await decks.ready()
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(side.getByText("I will change the title", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(side.getByRole("textbox", { name: "Ask Aira" })).toBeEnabled()
  expect(turns).toEqual([])
})

test("deleting a deck for good removes its chats from this device", async ({ page, context, stack }) => {
  const { deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base, node } }, { name: "edited.sse" })
  await ask(page, asked)
  await expect(side.getByText(reply, { exact: true })).toBeVisible()
  await expect.poll(() => chatKeys(page, deck)).toHaveLength(1)
  await page.goto("/")
  await page
    .getByRole("button", { name: / actions$/ })
    .first()
    .click()
  await page.getByRole("menuitem", { name: "Move to Trash" }).click()
  await page.goto("/trash")
  await page.getByRole("button", { name: "Empty Trash" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete for good" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(await chatKeys(page, deck)).toEqual([])
})
