import { productCopy } from "../../apps/web/src/copy/product-copy"
import { expect, test, type Page } from "@playwright/test"
import { openFixture as open } from "./fixture-deck.ts"
import { store } from "./home-store.ts"
import { cleanFixture, forward, openClean, signInBrowser, test as stackTest, type Stack } from "./api-stack"
import { exportFromDialog } from "./export-dialog.ts"
import { newBlankDeck } from "./new-deck"
import { holdableDevice, slowDevice } from "./slow-device"

const title = (page: Page) => page.getByRole("button", { name: /^Rename deck: / })
const field = (page: Page) => page.getByRole("textbox", { name: "Deck name" })

test("clicking the title renames the deck in place and Enter saves it everywhere", async ({ page }) => {
  const { calls } = await store(page, [])
  await open(page)
  await page.getByRole("button", { name: "Rename deck: clean" }).click()
  await expect(field(page)).toBeFocused()
  await field(page).fill("Quarterly plan")
  await field(page).press("Enter")
  await expect(title(page)).toHaveAccessibleName("Rename deck: Quarterly plan")
  await expect(title(page)).toBeFocused()
  await expect(page).toHaveTitle("Quarterly plan - AirDesign")
  const id = page.url().split("/").at(-1)
  await expect
    .poll(() => calls.filter((call) => call.path === "rename").at(-1)?.body)
    .toEqual({ deck: id, name: "Quarterly plan" })
  await page.reload()
  await expect(title(page)).toHaveAccessibleName("Rename deck: Quarterly plan")
})

test("the new name is the exported file's name", async ({ page }) => {
  await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("Quarterly plan")
  await field(page).press("Enter")
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  expect((await download).suggestedFilename()).toBe("Quarterly plan.pptx")
})

test("Escape leaves the name as it was", async ({ page }) => {
  const { calls } = await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("Not saved")
  await field(page).press("Escape")
  await expect(title(page)).toHaveAccessibleName("Rename deck: clean")
  await expect(page).toHaveTitle(/^clean - AirDesign$/)
  expect(calls.filter((call) => call.path === "rename" && call.body.name === "Not saved")).toEqual([])
})

test("an empty or too long name is refused with words, and the field stays open", async ({ page }) => {
  await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("   ")
  await field(page).press("Enter")
  await expect(page.getByRole("alert")).toHaveText("Enter a name for this deck.")
  await expect(field(page)).toBeFocused()
  await field(page).fill("a".repeat(201))
  await field(page).press("Enter")
  await expect(page.getByRole("alert")).toHaveText("Use 200 characters or fewer.")
  await field(page).fill("a".repeat(200))
  await expect(page.getByRole("alert")).toHaveCount(0)
  await field(page).press("Enter")
  await expect(title(page)).toHaveAccessibleName(`Rename deck: ${"a".repeat(200)}`)
})

test("leaving the field saves a valid name and drops an invalid one", async ({ page }) => {
  await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("By clicking away")
  await page.locator("[data-editor-canvas]").click({ position: { x: 5, y: 5 } })
  await expect(title(page)).toHaveAccessibleName("Rename deck: By clicking away")
  await title(page).click()
  await field(page).fill("")
  await page.locator("[data-editor-canvas]").click({ position: { x: 5, y: 5 } })
  await expect(title(page)).toHaveAccessibleName("Rename deck: By clicking away")
})

test("a rename made offline reaches the server once the network is back", async ({ page, context }) => {
  const { calls } = await store(page, [])
  await open(page)
  await context.setOffline(true)
  await title(page).click()
  await field(page).fill("Made offline")
  await field(page).press("Enter")
  await expect(title(page)).toHaveAccessibleName("Rename deck: Made offline")
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect.poll(() => calls.filter((call) => call.path === "rename").at(-1)?.body.name).toBe("Made offline")
})

test("the deck home shows the new name", async ({ page }) => {
  const { calls } = await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("Shown at home")
  await field(page).press("Enter")
  await expect.poll(() => calls.some((call) => call.path === "rename" && call.body.name === "Shown at home")).toBe(true)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Shown at home" })).toBeVisible()
})

async function serverName(stack: Stack, cookie: string, deck: string): Promise<unknown> {
  const listed = (await stack.post("/decks/list", {}, cookie)).json.decks as readonly Record<string, unknown>[]
  return listed.find((each) => each.deck === deck)?.name
}

async function slow(page: Page, path: string): Promise<void> {
  const onDeck = () => new URL(page.url()).pathname.startsWith("/deck/")
  let loads = 0
  let deckLoad = onDeck() ? loads : -1
  page.on("domcontentloaded", () => loads++)
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && onDeck()) deckLoad = loads
  })
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      const fromDeck = loads === deckLoad
      await new Promise((resolve) => setTimeout(resolve, 300))
      const left = loads !== deckLoad || !onDeck()
      await (fromDeck && left ? route.abort() : route.fallback()).catch(() => undefined)
    },
  )
}

async function held(page: Page, path: string): Promise<() => void> {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      await gate
      await route.fallback().catch(() => undefined)
    },
  )
  return release
}

function opened(page: Page): string[] {
  const decks: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/decks/open") decks.push(String(request.postDataJSON().deck))
  })
  return decks
}

async function leftAtOnce(page: Page, create: () => Promise<void>): Promise<string> {
  await page.goto("/")
  await create()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = new URL(page.url()).pathname.slice("/deck/".length)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  return deck
}

stackTest(
  "a name entered just before going Back on a slow network reaches the server without opening the deck again",
  async ({ page, context, stack }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    const deck = await openClean(page)
    await expect.poll(() => serverName(stack, cookie, deck)).toBe("clean")
    await slow(page, "/decks/rename")
    await title(page).click()
    await field(page).fill("Quick rename")
    await field(page).press("Enter")
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("heading", { name: "Quick rename" })).toBeVisible()
    await expect.poll(() => serverName(stack, cookie, deck), { timeout: 5000 }).toBe("Quick rename")
  },
)

stackTest(
  "a name entered just before leaving through the mark reaches the server and shows on Home",
  async ({ page, context, stack }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    const deck = await openClean(page)
    await expect.poll(() => serverName(stack, cookie, deck)).toBe("clean")
    await slow(page, "/decks/rename")
    await title(page).click()
    await field(page).fill("Quick rename")
    await field(page).press("Enter")
    await page.getByRole("link", { name: "Go to your decks" }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("heading", { name: "Quick rename" })).toBeVisible()
    await expect.poll(() => serverName(stack, cookie, deck), { timeout: 5000 }).toBe("Quick rename")
  },
)

stackTest(
  "a deck imported and left at once on a slow network keeps its file's name on Home",
  async ({ page, context, stack }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    await slow(page, "/decks/rename")
    const deck = await openClean(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("heading", { name: "clean" })).toBeVisible()
    await expect.poll(() => serverName(stack, cookie, deck), { timeout: 5000 }).toBe("clean")
  },
)

stackTest(
  "a deck imported and left before its editor opens is listed on Home under its file's name",
  async ({ page, context, stack }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    await slow(page, "/decks/open")
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(cleanFixture)
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    const deck = new URL(page.url()).pathname.slice("/deck/".length)
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("heading", { name: "clean" })).toBeVisible()
    await expect.poll(() => serverName(stack, cookie, deck), { timeout: 5000 }).toBe("clean")
  },
)

for (const [kind, name, create] of [
  ["deck imported", "clean", (page: Page) => page.locator("input[type=file]").setInputFiles(cleanFixture)],
  ["blank deck created", productCopy.blankDeck, newBlankDeck],
] as const) {
  stackTest(
    `a ${kind} and left at once shows on Home before its open reaches the server, then the server lists it`,
    async ({ page, context, stack }) => {
      const cookie = await stack.signIn()
      await signInBrowser(context, cookie)
      await forward(page, stack)
      const release = await held(page, "/decks/open")
      const deck = await leftAtOnce(page, () => create(page))
      await expect(page.getByRole("heading", { name })).toBeVisible()
      expect(await serverName(stack, cookie, deck)).toBeUndefined()
      release()
      await expect.poll(() => serverName(stack, cookie, deck), { timeout: 5000 }).toBe(name)
      await page.reload()
      await expect(page.getByRole("heading", { name })).toHaveCount(1)
    },
  )
}

stackTest(
  "a deck imported and not opened is shown and sent only by the account that imported it",
  async ({ page, context, stack }) => {
    const first = await stack.signIn()
    const second = await stack.signIn()
    await signInBrowser(context, first)
    await forward(page, stack)
    await page.route("**/decks/open", (route) => route.abort())
    const deck = await leftAtOnce(page, () => page.locator("input[type=file]").setInputFiles(cleanFixture))
    await expect(page.getByRole("heading", { name: "clean" })).toBeVisible()
    await page.unroute("**/decks/open")
    const sent = opened(page)
    await signInBrowser(context, second)
    await page.reload()
    await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "clean" })).toHaveCount(0)
    expect(sent).toEqual([])
    expect(await stack.saved(deck)).toBeUndefined()
    await signInBrowser(context, first)
    await page.reload()
    await expect(page.getByRole("heading", { name: "clean" })).toBeVisible()
    await expect.poll(() => serverName(stack, first, deck), { timeout: 5000 }).toBe("clean")
    expect(sent).toEqual([deck])
    expect((await stack.saved(deck))?.owner).toBe(await stack.emailOf(first))
  },
)

stackTest(
  "a name entered while its device write is held is still the deck's name after an immediate reload",
  async ({ page, context, stack }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    await holdableDevice(page)
    const deck = await openClean(page)
    await expect.poll(() => serverName(stack, cookie, deck)).toBe("clean")
    await slowDevice(page)
    await title(page).click()
    await field(page).fill("Kept name")
    await field(page).press("Enter")
    await expect(title(page)).toHaveAccessibleName("Rename deck: Kept name")
    await page.reload()
    await expect(title(page)).toHaveAccessibleName("Rename deck: Kept name")
    await expect.poll(() => serverName(stack, cookie, deck)).toBe("Kept name")
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Kept name" })).toBeVisible()
  },
)

stackTest(
  "a deck imported and left while the editor's device writes are held is still listed on Home after a reload",
  async ({ page, context, stack }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    await holdableDevice(page)
    await page.route("**/decks/open", (route) => route.abort())
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(cleanFixture)
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    const deck = new URL(page.url()).pathname.slice("/deck/".length)
    await slowDevice(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "clean" })).toBeVisible()
    await page.unroute("**/decks/open")
    await page.reload()
    await expect(page.getByRole("heading", { name: "clean" })).toBeVisible()
    await expect.poll(() => serverName(stack, cookie, deck), { timeout: 5000 }).toBe("clean")
  },
)
