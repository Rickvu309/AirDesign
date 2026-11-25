import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { clickSlide, openEditor, savedNode, selectedIds } from "./editor-deck"
import { editor } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 } })

for (const attempt of Array.from({ length: 20 }, (_, index) => index)) {
  test(`a held font engine preserves the active text and saves it in order (${String(attempt + 1)})`, async ({
    page,
    context,
    stack,
  }) => {
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let requested = () => {}
    const loading = new Promise<void>((resolve) => {
      requested = resolve
    })
    await page.route("**/*.wasm", async (route) => {
      requested()
      await held
      await route.continue()
    })
    try {
      const opened = await openEditor(page, context, stack)
      await loading
      await page.keyboard.press("t")
      await clickSlide(page, 300, 700)
      await expect(editor(page)).toBeFocused()
      await page.keyboard.type("Costs fall ")
      const ime = attempt === 19 ? await context.newCDPSession(page) : undefined
      await ime?.send("Input.imeSetComposition", { text: "とうきょう", selectionStart: 5, selectionEnd: 5 })
      await page.evaluate((composing) => {
        const selection = window.getSelection()
        const host = document.querySelector("[data-text-editor]")
        const line = host?.querySelector("[data-line]")
        if (line == null || host === null || selection === null) throw new Error("No active text")
        const offset = (node: Node | null, at: number) => {
          if (node === null || !host.contains(node)) return -1
          const range = document.createRange()
          range.selectNodeContents(host)
          range.setEnd(node, at)
          return range.toString().length
        }
        const anchor = offset(selection.anchorNode, selection.anchorOffset)
        const focus = offset(selection.focusNode, selection.focusOffset)
        const records: MutationRecord[] = []
        const observer = new MutationObserver((changed) => records.push(...changed))
        observer.observe(line, { subtree: true, childList: true, characterData: true, attributes: true })
        const { anchorNode, anchorOffset, focusNode, focusOffset } = selection
        Object.assign(window, {
          checkHeldText: () => {
            observer.disconnect()
            const now = window.getSelection()
            if (now === null) return false
            if (!composing)
              return (
                anchor >= 0 &&
                focus >= 0 &&
                offset(now.anchorNode, now.anchorOffset) === anchor &&
                offset(now.focusNode, now.focusOffset) === focus
              )
            return (
              records.length === 0 &&
              line.isConnected &&
              now.anchorNode === anchorNode &&
              now.anchorOffset === anchorOffset &&
              now.focusNode === focusNode &&
              now.focusOffset === focusOffset
            )
          },
        })
      }, ime !== undefined)
      const pending = page.locator("[data-slide-box] [data-font-pending]:not([data-text-editor] [data-font-pending])")
      await expect(pending.first()).toBeAttached()
      release()
      await expect(pending).toHaveCount(0)
      if (ime === undefined) await expect(editor(page).locator("[data-font-pending]")).toHaveCount(0)
      const stable = await page.evaluate(() => (window as Window & { checkHeldText?: () => boolean }).checkHeldText?.())
      await ime?.send("Input.insertText", { text: "東京" })
      await page.keyboard.type("12% with two shifts")
      await page.keyboard.press("Escape")
      const [id] = await selectedIds(page)
      await expect
        .poll(async () => (await savedNode(stack, opened, id ?? ""))?.text)
        .toMatchObject({ chars: `Costs fall ${ime === undefined ? "" : "東京"}12% with two shifts` })
      expect(stable).toBe(true)
    } finally {
      release()
    }
  })
}

for (let attempt = 1; attempt <= 10; attempt++) {
  test(`an IME commit saves in order when fonts arrive during composition (${String(attempt)})`, async ({
    page,
    context,
    stack,
  }) => {
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(
      (url) => url.pathname.endsWith(".wasm") || url.pathname.includes("/fonts/"),
      async (route) => {
        await held
        await route.continue()
      },
    )
    try {
      const opened = await openEditor(page, context, stack)
      await page.keyboard.press("t")
      await clickSlide(page, 300, 700)
      await expect(editor(page)).toBeFocused()
      await page.keyboard.type("Costs fall ", { delay: 10 })
      const ime = await context.newCDPSession(page)
      await ime.send("Input.imeSetComposition", { text: "と", selectionStart: 1, selectionEnd: 1 })
      await ime.send("Input.imeSetComposition", { text: "とうきょう", selectionStart: 5, selectionEnd: 5 })
      const pending = page.locator("[data-slide-box] [data-font-pending]:not([data-text-editor] [data-font-pending])")
      await expect(pending.first()).toBeAttached()
      release()
      await expect(pending).toHaveCount(0)
      await ime.send("Input.insertText", { text: "東京" })
      await page.keyboard.type("12% with two shifts", { delay: 10 })
      await page.keyboard.press("Escape")
      const [id] = await selectedIds(page)
      await expect
        .poll(async () => (await savedNode(stack, opened, id ?? ""))?.text)
        .toMatchObject({ chars: "Costs fall 東京12% with two shifts" })
    } finally {
      release()
    }
  })
}
