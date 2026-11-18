import { presentCopy } from "../../apps/web/src/copy/present-copy.ts"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { forward, openClean, settled, signInBrowser, test } from "./api-stack"
import { covers } from "./gesture"

const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")

type Stop = {
  readonly tag: string
  readonly name: string
  readonly ringed: boolean
  readonly framed: boolean
  readonly caret: boolean
}

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
  await settled(page)
}

async function stopNow(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement) || el === document.body)
      return { tag: "body", name: "", ringed: false, framed: false, caret: false }
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
      caret:
        el instanceof HTMLTextAreaElement &&
        el.id === "speaker-notes" &&
        style.caretColor === style.color &&
        style.color !== "rgba(0, 0, 0, 0)",
    }
  })
}

test("every Tab stop shows a focus ring, a canvas frame or the notes caret", async ({ page, context, stack }) => {
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
  expect(stops.at(-1)?.name).toBe("Ask Aira")
  expect(stops.find((stop) => stop.name === presentCopy.notes)).toMatchObject({ caret: true, ringed: false })
  expect(stops.filter((stop) => !stop.ringed && !stop.framed && !stop.caret)).toEqual([])
  expect(stops.map((stop) => stop.name)).toEqual(expect.arrayContaining(["Add text", "Agent", "Ask Aira"]))
})

test("the slide list is one Tab stop, the arrows move through it, and a slide command says what it did", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-down")
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
  await expect(said).toHaveText("Slide 4 deleted")
})

test("the canvas can be reached, moved, resized, left with Escape and cleared from the keyboard, each said aloud", async ({
  page,
  context,
  stack,
}) => {
  covers("resize-keys", "edit-text")
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
  await page.getByRole("button", { name: / actions$/ }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("menuitem", { name: "Move to Trash" })).toBeFocused()
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

test("adding a slide says the slide was added and no element of the slide left behind was deleted", async ({
  page,
  context,
  stack,
}) => {
  await signedIn(page, context, stack)
  await openClean(page)
  await expect(page.locator("[data-slide-paint]").getByRole("group", { name: "Hello" })).toBeVisible()
  const said = page.locator("[data-slide-list]").locator("xpath=preceding-sibling::*[@data-announcer]")
  await page.evaluate(() => {
    const heard: string[] = []
    Reflect.set(window, "said", heard)
    new MutationObserver(() => {
      const status = document.querySelector('[data-slide-paint] [role="status"]')?.textContent ?? ""
      if (status !== "") heard.push(status)
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(said).toHaveText("Added slide 2")
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "said") as string[])).toContain("Slide 2 of 2")
  const heard = await page.evaluate(() => Reflect.get(window, "said") as string[])
  expect(heard).not.toContainEqual(expect.stringContaining("deleted"))
})

test("duplicating, moving, selecting and deleting a slide says the slide, and so do undo and redo", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-duplicate", "slide-up", "slide-delete")
  await signedIn(page, context, stack)
  await openClean(page)
  const canvas = page.locator('[data-slide-paint] [role="status"]')
  const said = page.locator("[data-slide-list]").locator("xpath=preceding-sibling::*[@data-announcer]")
  const entry = (number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
  await page.evaluate(() => {
    const heard: string[] = []
    Reflect.set(window, "said", heard)
    new MutationObserver(() => {
      const status = document.querySelector('[data-slide-paint] [role="status"]')?.textContent ?? ""
      if (status !== "") heard.push(status)
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })

  await entry(1).focus()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(said).toHaveText("Duplicated slide 1. The copy is slide 2")
  await expect(canvas).toHaveText("Slide 2 of 2")

  await page.keyboard.press("Alt+ArrowUp")
  await expect(said).toHaveText("Moved slide 2 to position 1")
  const label = page.locator("[data-slide-label]")
  await expect(label).toHaveText("1")
  await entry(2).click()
  await expect(label).toHaveText("2")
  await entry(1).click()
  await expect(label).toHaveText("1")
  await expect(canvas).toHaveText("Slide 1 of 2")

  await entry(1).focus()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(said).toHaveText("Slide 1 deleted")
  await expect(canvas).toHaveText("Slide 1 of 1")

  await entry(1).focus()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(said).toHaveText("Slide 1 of 2")
  await expect(canvas).toHaveText("Slide 1 of 2")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(said).toHaveText("Slide 1 deleted")
  await expect(canvas).toHaveText("Slide 1 of 1")

  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(said).toHaveText("Added slide 2")
  await expect(canvas).toHaveText("Slide 2 of 2")
  await entry(2).focus()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(said).toHaveText("Slide 1 of 1")
  await expect(canvas).toHaveText("Slide 1 of 1")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(said).toHaveText("Added slide 2")
  await expect(canvas).toHaveText("Slide 2 of 2")

  await page.getByRole("button", { name: "Grid" }).click()
  const gridSaid = page.locator("[data-editor-grid] [data-announcer]")
  const gridEntry = (number: number) => page.locator(`[data-editor-grid] [data-slide-entry="${String(number)}"]`)
  await gridEntry(2).focus()
  await page.keyboard.press("ArrowLeft")
  await expect(gridEntry(1)).toBeFocused()
  await expect(gridEntry(1)).toHaveAccessibleName("Slide 1 of 2")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(gridSaid).toHaveText("Slide 1 of 1")

  const heard = await page.evaluate(() => Reflect.get(window, "said") as string[])
  expect(heard).not.toContainEqual(expect.stringContaining("deleted"))
})
