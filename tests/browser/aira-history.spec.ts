import { expect, type BrowserContext, type Page } from "@playwright/test"
import { airaCopy, airaHistoryNameOf } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, openClean, settled, signInBrowser, test, type Stack } from "./api-stack"

const node = "256.2"
const asked = "Change the title to Hello from Aira"
const title = "Change the title to Hello from Aira"
const reply = "The title now reads Hello from Aira."

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

async function openDeck(page: Page, context: BrowserContext, stack: Stack) {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
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

test("a chat survives a reload, New chat keeps it in history, and picking it shows it again to continue", async ({
  page,
  context,
  stack,
}) => {
  const { deck, base, side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base, node } }, { name: "edited.sse" })
  await ask(page, asked)
  await expect(side.getByText(reply, { exact: true })).toBeVisible()
  const head = side.getByRole("button", { name: airaHistoryNameOf(title) })
  await expect(head).toBeVisible()
  await expect(head).toHaveAttribute("title", asked)

  await page.reload()
  await settled(page)
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(side.getByText(reply, { exact: true })).toBeVisible()
  await expect(side.getByText("Edited slides", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: productCopy.undo })).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello from Aira")

  await side.getByRole("button", { name: "New chat", exact: true }).click()
  await expect(log).toHaveCount(0)
  await side.getByRole("button", { name: airaHistoryNameOf("New chat") }).click()
  const chats = page.locator("[data-aira-chats]")
  await expect(chats.getByRole("menuitemradio")).toHaveCount(1)
  await chats.getByRole("menuitemradio", { name: new RegExp(title) }).click()
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(side.getByText(reply, { exact: true })).toBeVisible()

  stack.aira({ name: "turn.sse" })
  const sent = page.waitForRequest((request) => new URL(request.url()).pathname === "/aira/turn")
  await ask(page, "Now say hello")
  const body = (await sent).postDataJSON() as { messages: { role: string }[] }
  expect(body.messages.length).toBeGreaterThan(1)
  await expect(log.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello from Aira")
})

test("Undo on a restored chat takes the run back, and the chat stays undone after a reload", async ({
  page,
  context,
  stack,
}) => {
  const { deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base, node } }, { name: "edited.sse" })
  await ask(page, asked)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello from Aira")
  await page.reload()
  await settled(page)
  await side.getByRole("button", { name: productCopy.undo }).click()
  await expect(editor).toHaveText("Hello")
  await expect(side.getByRole("button", { name: productCopy.undo })).toHaveCount(0)

  await page.reload()
  await settled(page)
  await expect(editor).toHaveText("Hello")
  await expect(side.getByText(reply, { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: productCopy.undo })).toHaveCount(0)
})

test("a chat whose run was undone elsewhere says Undo is no longer possible instead of showing it", async ({
  page,
  context,
  stack,
}) => {
  const { cookie, deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base, node } }, { name: "edited.sse" })
  await ask(page, asked)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello from Aira")
  await expect.poll(() => chatRuns(page, deck)).toHaveLength(1)
  const [runId] = await chatRuns(page, deck)
  expect((await stack.post("/decks/undo", { deck, runId }, cookie)).json.ok).toBe(true)
  await page.reload()
  await settled(page)
  await expect(editor).toHaveText("Hello")
  await side.getByRole("button", { name: productCopy.undo }).click()
  await expect(side.getByText(airaCopy.undoRefused, { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: productCopy.undo })).toHaveCount(0)
  await page.reload()
  await settled(page)
  await expect(side.getByText(airaCopy.undoRefused, { exact: true })).toBeVisible()
})

test("a reply cut off by a reload is kept up to where it got, as stopped, and runs nothing again", async ({
  page,
  context,
  stack,
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
  await settled(page)
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
  await page.getByRole("button", { name: "Move to Trash" }).first().click()
  await page.goto("/trash")
  await page.getByRole("button", { name: "Empty Trash" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete for good" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(await chatKeys(page, deck)).toEqual([])
})
