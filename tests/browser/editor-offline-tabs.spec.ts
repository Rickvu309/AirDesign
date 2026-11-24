import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { forward, test } from "./api-stack"
import { clickSlide, openEditor, savedNode, selectedIds } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

async function cutOff(page: Page): Promise<{ online(): void }> {
  let offline = true
  await page.route(
    (url) => url.pathname.startsWith("/doom/"),
    (route) => (offline ? route.abort("internetdisconnected") : route.fallback()),
  )
  return {
    online() {
      offline = false
    },
  }
}

async function typeInto(page: Page, box: Box, words: string) {
  await clickSlide(page, box.x + box.w / 2, box.y + box.h / 2)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.type(words)
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)
  await page.keyboard.press("Escape")
}

test("two tabs typing offline keep both tabs' words, and the next open sends a closed tab's words", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const title = (await savedNode(stack, opened, "s:4"))?.box as Box
  const subtitle = (await savedNode(stack, opened, "s:5"))?.box as Box
  const first = await cutOff(page)
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  const other = await context.newPage()
  await forward(other, stack)
  const second = await cutOff(other)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-editor-ready]").waitFor()

  await typeInto(page, title, "First tab")
  await typeInto(other, subtitle, "Second tab")
  await typeInto(page, title, "First tab again")
  await other.close()
  first.online()
  second.online()
  const chars = async (node: string) => ((await savedNode(stack, opened, node))?.text as { chars?: string })?.chars

  await expect.poll(() => chars("s:4")).toBe("First tab again")
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect.poll(() => chars("s:5")).toBe("Second tab")
  await expect(page.locator("[data-slide-box] [data-line]").filter({ hasText: "Second tab" })).toHaveCount(1)
  expect(await chars("s:4")).toBe("First tab again")
})

test("an undo made offline over a layer another tab deletes lands the rest on reconnect, and keeps every step", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Box
  const title = await boxOf("s:4")
  const subtitle = await boxOf("s:5")
  const centre = (box: Box) => [box.x + box.w / 2, box.y + box.h / 2] as const

  await clickSlide(page, ...centre(subtitle))
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 1)
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await clickSlide(page, ...centre(title))
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  await expect.poll(async () => (await selectedIds(page)).toSorted()).toEqual(["s:4", "s:5"])
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 2)
  await expect.poll(async () => (await boxOf("s:4")).x).toBe(title.x + 1)
  await page.keyboard.press("Escape")
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-editor-ready]").waitFor()

  const cut = await cutOff(page)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-save-status]")).not.toHaveText(productCopy.saved)
  await clickSlide(other, ...centre(title))
  await expect.poll(() => selectedIds(other)).toEqual(["s:4"])
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  expect((await boxOf("s:5")).x).toBe(subtitle.x + 2)

  cut.online()
  await expect.poll(async () => (await boxOf("s:5")).x, { timeout: 15_000 }).toBe(subtitle.x + 1)
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved)
  await expect(page.getByText(productCopy.editSetAside, { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-slide-box] [data-node="s:4"]')).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 2)
  expect((await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  await other.close()
})

test("an undo of typing in the title, made offline while another tab deletes the title, leaves the name the other tab set and keeps the step below", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Box
  const nameOf = async () => (await savedNode(stack, opened, "s:1"))?.name
  const title = await boxOf("s:4")
  const subtitle = await boxOf("s:5")
  const centre = (box: Box) => [box.x + box.w / 2, box.y + box.h / 2] as const

  await clickSlide(page, ...centre(subtitle))
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 1)
  await page.keyboard.press("Escape")
  await typeInto(page, title, "Quarterly plan")
  await expect.poll(nameOf).toBe("Quarterly plan")
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-editor-ready]").waitFor()

  const cut = await cutOff(page)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-save-status]")).not.toHaveText(productCopy.saved)
  await clickSlide(other, ...centre(title))
  await expect.poll(() => selectedIds(other)).toEqual(["s:4"])
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  await expect.poll(nameOf).toBe(productCopy.blankDeck)

  await page.evaluate((aside) => {
    const seen = { aside: false }
    Object.assign(window, { seen })
    new MutationObserver(() => {
      if (document.body.innerText.includes(aside)) seen.aside = true
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  }, productCopy.editSetAside)
  cut.online()
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved, { timeout: 15_000 })
  await expect(page.locator('[data-slide-box] [data-node="s:4"]')).toHaveCount(0)
  expect(await nameOf()).toBe(productCopy.blankDeck)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x)
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved)
  expect(await page.evaluate(() => (window as unknown as { seen: { aside: boolean } }).seen.aside)).toBe(false)
  await other.close()
})

test("an undo of typing in the title, made offline while another tab renames the deck, puts the words back, leaves the name the other tab set and keeps the step below", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Box
  const nameOf = async () => (await savedNode(stack, opened, "s:1"))?.name
  const wordsOf = async () => ((await savedNode(stack, opened, "s:4"))?.text as { chars?: string })?.chars
  const title = await boxOf("s:4")
  const subtitle = await boxOf("s:5")
  const original = await wordsOf()
  const centre = (box: Box) => [box.x + box.w / 2, box.y + box.h / 2] as const

  await clickSlide(page, ...centre(subtitle))
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 1)
  await page.keyboard.press("Escape")
  await typeInto(page, title, "Quarterly plan")
  await expect.poll(nameOf).toBe("Quarterly plan")
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-editor-ready]").waitFor()

  const cut = await cutOff(page)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-save-status]")).not.toHaveText(productCopy.saved)
  await other.getByRole("button", { name: new RegExp(`^${productCopy.renameDeck}`) }).click()
  const field = other.getByRole("textbox", { name: productCopy.deckName })
  await field.fill("Board pack")
  await field.press("Enter")
  await expect.poll(nameOf).toBe("Board pack")

  await page.evaluate((aside) => {
    const seen = { aside: false }
    Object.assign(window, { seen })
    new MutationObserver(() => {
      if (document.body.innerText.includes(aside)) seen.aside = true
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  }, productCopy.editSetAside)
  cut.online()
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved, { timeout: 15_000 })
  await expect.poll(wordsOf).toBe(original)
  expect(await nameOf()).toBe("Board pack")
  expect(await page.evaluate(() => (window as unknown as { seen: { aside: boolean } }).seen.aside)).toBe(false)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x)
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved)
  await other.close()
})

for (const interleave of [false, true]) {
  test(`guarded offline replay ${interleave ? "refuses a gap" : "saves consecutive edits after a lost reply"}`, async ({
    stack,
  }) => {
    const { packageBuild } = await import("../../scripts/package-build.mjs")
    const repo = process.cwd()
    const catalog: typeof import("../../packages/catalog/src/index.ts") = await packageBuild(repo, "@airdesign/catalog")
    const { doomRoutes } = catalog
    const doom: typeof import("../../packages/doom/src/index.ts") = await packageBuild(repo, "@airdesign/doom")
    const live: typeof import("../../packages/live/src/index.ts") = await packageBuild(repo, "@airdesign/live")
    const { createDoomDeck, openDoomDeck, memoryStorage } = live
    const cookie = await stack.signIn()
    const deck = `guard-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`
    const storage = memoryStorage()
    let offline = true
    let lose = !interleave
    const sent: { readonly edit: import("../../packages/doom/src/index.ts").Edit; readonly reply: unknown }[] = []
    const remote: import("../../packages/live/src/index.ts").DoomRemote = {
      create: async (body) => doomRoutes.create.result((await stack.post(doomRoutes.create.path, body, cookie)).json),
      open: async (body) => doomRoutes.open.result((await stack.post(doomRoutes.open.path, body, cookie)).json),
      since: async (body) => doomRoutes.since.result((await stack.post(doomRoutes.since.path, body, cookie)).json),
      async edit(body) {
        if (offline) throw new TypeError("offline")
        const reply = (await stack.post(doomRoutes.edit.path, body, cookie)).json
        sent.push({ edit: body.edit, reply })
        if (lose) {
          lose = false
          throw new TypeError("reply lost")
        }
        return doomRoutes.edit.result(reply)
      },
    }
    const opened = await createDoomDeck(remote, deck, { storage })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    const local = opened.deck
    const node = doom.nodeId("s:1")
    const rename = (value: string): import("../../packages/doom/src/index.ts").Write[] => [
      { node, prop: "name", value },
    ]
    const first = local.push(rename("First"), interleave ? undefined : { read: local.view() })
    const second = local.push(rename("Second"), { read: local.view() })
    expect(first).toMatchObject({ ok: true })
    expect(second).toMatchObject({ ok: true })
    if (!first.ok || !("saved" in first) || !second.ok || !("saved" in second)) throw new Error("edits not queued")
    await second.saved
    expect(doom.deckName(local.view())).toBe("Second")
    expect(await local.sync()).toEqual({ ok: false, reason: "offline" })
    if (interleave) {
      const other = await stack.post(
        doomRoutes.edit.path,
        {
          deck,
          edit: {
            once: "other-tab",
            author: { kind: "person", id: "other" },
            writes: [{ node: doom.nodeId("s:3"), prop: "name", value: "Other slide" }],
          },
        },
        cookie,
      )
      expect(other.json).toEqual({ ok: true, deck, rev: 2 })
    }
    offline = false
    const reopened = await openDoomDeck(remote, deck, { storage })
    if (!reopened.ok) throw new Error(JSON.stringify(reopened))
    const resumed = reopened.deck
    if (!interleave) expect(await resumed.sync()).toEqual({ ok: false, reason: "offline" })
    expect(await resumed.sync()).toEqual({ ok: true })
    const stored = await remote.open({ deck })
    if (!stored.ok) throw new Error(JSON.stringify(stored))
    expect(stored.rev).toBe(3)
    expect(doom.deckName(stored.fold)).toBe(interleave ? "First" : "Second")
    expect(doom.deckName(resumed.view())).toBe(doom.deckName(stored.fold))
    expect(resumed.pending()).toEqual([])
    if (interleave) {
      expect(sent.map(({ edit }) => edit.once)).toEqual([first.once])
      expect(resumed.notices()).toEqual([{ once: second.once, refused: "stale", because: first.once }])
    } else {
      expect(sent.map(({ edit }) => [edit.once, edit.readBase])).toEqual([
        [first.once, 1],
        [first.once, 1],
        [second.once, 2],
      ])
      expect(sent[0]?.reply).toEqual(sent[1]?.reply)
      expect(resumed.notices()).toEqual([])
    }
  })
}
