import { expect, type Page } from "@playwright/test"
import { forward, openClean, signInBrowser, test, type Stack } from "./api-stack"
import { first, store } from "./home-store.ts"
import { holdableDevice, slowDevice } from "./slow-device"

test.use({ viewport: { width: 1600, height: 1000 } })

const starred = (page: Page) => page.getByRole("navigation", { name: "Starred" })
const status = (page: Page) => page.getByRole("status").filter({ hasText: /star/i })

async function serverStar(stack: Stack, cookie: string, deck: string): Promise<unknown> {
  const listed = (await stack.post("/decks/list", {}, cookie)).json.decks as readonly Record<string, unknown>[]
  return listed.find((each) => each.deck === deck)?.starred
}

async function home(page: Page): Promise<void> {
  await page.goto("/")
  await expect(page.locator("[data-decks-main]").getByRole("heading", { name: "clean", level: 2 })).toBeVisible()
}

test("a person stars a deck from its card, sees it under Starred at once, and it stays after a reload", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await home(page)
  await expect(starred(page)).toContainText("Star a deck to keep it here.")
  await page.getByRole("button", { name: "Star clean" }).click()
  await expect(page.getByRole("button", { name: "Remove star from clean" })).toBeFocused()
  await expect(starred(page).getByRole("link", { name: "clean" })).toHaveAttribute("href", `/deck/${deck}`)
  await expect(status(page)).toHaveText("Starred clean")
  await expect.poll(() => serverStar(stack, cookie, deck)).toBe(true)
  await page.reload()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  await page.getByRole("button", { name: "Remove star from clean" }).click()
  await expect(status(page)).toHaveText("Removed star from clean")
  await expect(starred(page)).toContainText("Star a deck to keep it here.")
  await expect.poll(() => serverStar(stack, cookie, deck)).toBe(false)
})

test("the list view stars a deck the same way", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await page.goto("/?view=list")
  await page.getByRole("button", { name: "Star clean" }).click()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  await expect.poll(() => serverStar(stack, cookie, deck)).toBe(true)
})

test("a star sent while the server is slow, then unreachable, shows at once and reaches the server once it answers", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await home(page)
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/decks/star", async (route) => {
    await held
    await route.abort()
  })
  await page.getByRole("button", { name: "Star clean" }).click()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  release()
  await page.reload()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  expect(await serverStar(stack, cookie, deck)).toBe(false)
  await page.unroute("**/decks/star")
  await page.reload()
  await expect.poll(() => serverStar(stack, cookie, deck)).toBe(true)
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
})

test("a star shown while its device write is held is still there after an immediate reload, for its account only", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await holdableDevice(page)
  const deck = await openClean(page)
  await home(page)
  await slowDevice(page)
  await page.getByRole("button", { name: "Star clean" }).click()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  await page.reload()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  await expect.poll(() => serverStar(stack, cookie, deck)).toBe(true)
  await page.getByRole("button", { name: "Remove star from clean" }).click()
  await slowDevice(page)
  await page.getByRole("button", { name: "Star clean" }).click()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  await signInBrowser(context, await stack.signIn())
  await page.reload()
  await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
  await expect(starred(page).getByRole("link")).toHaveCount(0)
  await signInBrowser(context, cookie)
  await page.reload()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  await expect.poll(() => serverStar(stack, cookie, deck)).toBe(true)
})

test("a second account on the same browser sees none of the first one's stars, and the first keeps its unsent star", async ({
  page,
  context,
  stack,
}) => {
  const first = await stack.signIn()
  await signInBrowser(context, first)
  await forward(page, stack)
  const deck = await openClean(page)
  await home(page)
  await page.route("**/decks/star", (route) => route.abort())
  await page.getByRole("button", { name: "Star clean" }).click()
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  await signInBrowser(context, await stack.signIn())
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
  await expect(starred(page)).toContainText("Star a deck to keep it here.")
  await expect(starred(page).getByRole("link")).toHaveCount(0)
  await signInBrowser(context, first)
  await page.unroute("**/decks/star")
  await home(page)
  await expect(starred(page).getByRole("link", { name: "clean" })).toBeVisible()
  await expect.poll(() => serverStar(stack, first, deck)).toBe(true)
})

test("a long deck name stops before its buttons in both views", async ({ page }) => {
  const name = "Quarterly business review for the whole northern region"
  await store(page, [{ ...first, name }])
  for (const address of ["/", "/?view=list"]) {
    await page.goto(address)
    const title = page.locator("[data-decks-main]").getByRole("heading", { name, level: 2 })
    const star = page.getByRole("button", { name: `Star ${name}` })
    const textEnd = await title.evaluate(
      (heading) => heading.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(heading).paddingRight),
    )
    const starBox = await star.boundingBox()
    expect(starBox && textEnd <= starBox.x).toBe(true)
    expect(await star.evaluate((button) => button.closest("h2"))).toBeNull()
  }
})
