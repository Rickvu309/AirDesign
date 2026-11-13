import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { forward, openClean, signInBrowser, test } from "./api-stack"

const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")

type Stop = { readonly tag: string; readonly name: string; readonly ringed: boolean; readonly framed: boolean }

async function signedIn(
  page: Page,
  context: Parameters<typeof signInBrowser>[0],
  stack: Parameters<typeof forward>[1],
) {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  return cookie
}

async function openBlankDeck(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(blank)
  await expect(page).toHaveURL(/\/deck\//)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
}

async function stopNow(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement) || el === document.body)
      return { tag: "body", name: "", ringed: false, framed: false }
    const probe = document.createElement("span")
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--focus-ring")
    document.body.append(probe)
    const ring = getComputedStyle(probe).color
    probe.remove()
    const style = getComputedStyle(el)
    const wrapper =
      el.parentElement !== null && el.parentElement.hasAttribute("data-focus-ring") ? el.parentElement : null
    const wrapped =
      wrapper !== null &&
      getComputedStyle(wrapper).outlineStyle === "solid" &&
      getComputedStyle(wrapper).outlineColor === ring
    return {
      tag: el.tagName.toLowerCase(),
      name: el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 30),
      ringed:
        wrapped || (style.outlineStyle === "solid" && style.outlineWidth === "2px" && style.outlineColor === ring),
      framed: el.closest("[data-slide-paint]") !== null && document.querySelector("[data-selection]") !== null,
    }
  })
}

test("every Tab stop in the editor draws the one focus ring, or the selection frame on the canvas", async ({
  page,
  context,
  stack,
}) => {
  await signedIn(page, context, stack)
  await openBlankDeck(page)
  await page.locator("[data-slide-entry='1']").focus()
  const stops: Stop[] = []
  for (let press = 0; press < 40; press += 1) {
    await page.keyboard.press("Tab")
    const stop = await stopNow(page)
    if (stop.tag === "body") break
    stops.push(stop)
  }
  expect(stops.length).toBeGreaterThan(15)
  expect(stops.filter((stop) => !stop.ringed && !stop.framed)).toEqual([])
  expect(stops.map((stop) => stop.name)).toEqual(expect.arrayContaining(["Add text box", "Agent", "Ask Aira"]))
})

test("the slide list is one Tab stop, the arrows move through it, and a slide command says what it did", async ({
  page,
  context,
  stack,
}) => {
  await signedIn(page, context, stack)
  await openBlankDeck(page)
  const entry = (number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
  const said = page.locator("[data-slide-list]").locator("xpath=preceding-sibling::*[@data-announcer]")
  await page.getByRole("button", { name: "Add slide" }).first().click()
  await expect(entry(2)).toBeVisible()
  await page.getByRole("button", { name: "Add slide" }).first().click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(said).toHaveText("Added slide 3")
  await expect(page.getByRole("button", { name: "Slide 1 of 3" })).toBeVisible()
  await entry(1).focus()
  await page.keyboard.press("ArrowDown")
  await expect(entry(2)).toBeFocused()
  expect((await stopNow(page)).ringed).toBe(true)
  await expect(entry(2)).toHaveAttribute("aria-current", "true")
  await page.keyboard.press("Tab")
  await expect(page.locator("[data-slide-list] :focus")).toHaveCount(0)
  await page.keyboard.press("Shift+Tab")
  await expect(entry(2)).toBeFocused()
  await page.keyboard.press("Alt+ArrowDown")
  await expect(said).toHaveText("Moved slide 2 to position 3")
  await expect(entry(3)).toBeFocused()
  await expect(entry(3)).toHaveAttribute("aria-current", "true")
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(4)
  await expect(said).toHaveText("Duplicated slide 3. The copy is slide 4")
  await expect(entry(4)).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(said).toHaveText("Deleted slide 4. Press Control+Z to undo")
})

test("the canvas can be reached, moved, resized, left with Escape and cleared from the keyboard, each said aloud", async ({
  page,
  context,
  stack,
}) => {
  await signedIn(page, context, stack)
  await openBlankDeck(page)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]').first()
  await page.locator("[data-slide-entry='1']").focus()
  await page.keyboard.press("Tab")
  await expect(text).toBeFocused()
  await page.keyboard.type("Hello")
  await page.keyboard.press("Escape")
  const frame = page.getByRole("group", { name: "Hello" })
  await expect(frame).toBeFocused()
  await expect(page.locator("[data-selection]")).toBeVisible()
  const before = await frame.boundingBox()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Alt+Shift+ArrowRight")
  await expect(page.locator('[data-slide-paint] [role="status"]')).toHaveText("Resized Hello")
  const after = await frame.boundingBox()
  expect(after?.width).toBeGreaterThan(before?.width ?? 0)
  await page.keyboard.press("Enter")
  await expect(text).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(frame).toBeFocused()
})

test("a dialog takes focus on its safe button, keeps Tab inside, and gives focus back when it closes", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await signedIn(page, context, stack)
  const email = await stack.emailOf(cookie)
  await page.goto("/")
  const account = page.getByRole("button", { name: email })
  await account.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("menuitem", { name: "Delete account" }).press("Enter")
  const dialog = page.getByRole("dialog", { name: "Delete your account?" })
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused()
  for (let press = 0; press < 8; press += 1) {
    await page.keyboard.press("Tab")
    await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(account).toBeFocused()
})

test("the deck home names its layout links and keeps a keyboard user's place after Move to Trash", async ({
  page,
  context,
  stack,
}) => {
  await signedIn(page, context, stack)
  await openBlankDeck(page)
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Grid view" })).toBeVisible()
  await expect(page.getByRole("link", { name: "List view" })).toBeVisible()
  const move = page.getByRole("button", { name: "Move to Trash" })
  await move.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "Recents", level: 1 })).toBeFocused()
})

for (const width of [320, 735]) {
  test(`the deck home, Trash and Settings reflow at ${String(width)} px with no sideways scroll`, async ({
    page,
    context,
    stack,
  }) => {
    await signedIn(page, context, stack)
    await page.setViewportSize({ width, height: 800 })
    for (const path of ["/", "/trash", "/settings/usage", "/settings/agents", "/settings/account"]) {
      await page.goto(path)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      const sizes = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      expect(sizes.scroll, path).toBeLessThanOrEqual(sizes.client)
    }
  })
}

test.fail(
  "adding a slide says the slide was added and no element of the slide left behind was deleted",
  async ({ page, context, stack }) => {
    await signedIn(page, context, stack)
    await openClean(page)
    await expect(page.locator("[data-slide-paint]").getByRole("group", { name: "Hello" })).toBeVisible()
    await page.evaluate(() => {
      const said: string[] = []
      Reflect.set(window, "said", said)
      new MutationObserver(() => {
        const status = document.querySelector('[data-slide-paint] [role="status"]')?.textContent ?? ""
        if (status !== "") said.push(status)
      }).observe(document.body, { subtree: true, childList: true, characterData: true })
    })
    await page.getByRole("button", { name: "Add slide" }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
    await page.waitForTimeout(1000)
    expect(await page.evaluate(() => Reflect.get(window, "said") as string[])).not.toContainEqual(
      expect.stringContaining("deleted"),
    )
  },
)
