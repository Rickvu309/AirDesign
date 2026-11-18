import { expect, type Page } from "@playwright/test"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { forward, openClean, signInBrowser, test } from "./api-stack"

const node = "256.2"

function value(text: string): string {
  return JSON.stringify([{ from: 0, runs: [{ from: 0, text }] }])
}

function pending(page: Page) {
  return page.locator("[data-slide-paint] [data-fonts-pending]")
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function holdFonts(page: Page): Promise<() => void> {
  let release = () => {}
  const held = new Promise<void>((done) => {
    release = done
  })
  await page.route("**/fonts/family*", async (route) => {
    await held
    await route.fallback().catch(() => undefined)
  })
  return release
}

test("an agent's edits paint on a slide whose font arrives after the deck opens", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await holdFonts(page)
  try {
    const deck = await openClean(page)
    const editor = page.locator('[contenteditable="true"]')
    await expect(editor).toHaveText("Hello")
    await expect(pending(page).first()).toBeAttached()
    await expect
      .poll(async () => (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)).index)
      .toBe("ready")
    const first = (await stack.post("/decks/open", { deck }, cookie)).json.revision
    const before = await stack.callTool(
      "airdesign_edit_deck",
      { deck, base: first, changes: [{ node, readAt: 0, value: value("Before the font") }] },
      cookie,
    )
    expect(before).toMatchObject({ ok: true })
    await expect(editor).toHaveText("Before the font")
    release()
    await expect(pending(page)).toHaveCount(0)
    await expect(editor).toHaveText("Before the font")
    const second = (await stack.post("/decks/open", { deck }, cookie)).json.revision
    const after = await stack.callTool(
      "airdesign_edit_deck",
      { deck, base: second, changes: [{ node, readAt: 0, value: value("After the font") }] },
      cookie,
    )
    expect(after).toMatchObject({ ok: true })
    await expect(editor).toHaveText("After the font")
  } finally {
    release()
  }
})

test("a person's typing stays on a slide whose font arrives while they type", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await holdFonts(page)
  try {
    await openClean(page)
    const editor = page.locator('[contenteditable="true"]')
    await expect(pending(page).first()).toBeAttached()
    await editor.click()
    await page.keyboard.press("ControlOrMeta+a")
    await editor.pressSequentially("Typed early", { delay: 30 })
    await expect(editor).toHaveText("Typed early")
    release()
    await expect(pending(page)).toHaveCount(0)
    await expect(editor).toHaveText("Typed early")
    await editor.pressSequentially(" and late", { delay: 30 })
    await expect(editor).toHaveText("Typed early and late")
  } finally {
    release()
  }
})

test("Aira's edit paints on a slide whose font arrives after the edit", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await holdFonts(page)
  try {
    const deck = await openClean(page)
    const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
    const editor = page.locator('[contenteditable="true"]')
    await expect(pending(page).first()).toBeAttached()
    stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" })
    const side = page.locator("[data-editor-panel]")
    await side.getByRole("textbox", { name: airaCopy.askAira }).fill("Change the title to Hello from Aira")
    await page.keyboard.press("Enter")
    await expect(side.getByText("The title now reads Hello from Aira.", { exact: true })).toBeVisible()
    await expect(editor).toHaveText("Hello from Aira")
    release()
    await expect(pending(page)).toHaveCount(0)
    await expect(editor).toHaveText("Hello from Aira")
  } finally {
    release()
  }
})
