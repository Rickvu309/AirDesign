import { expect, type Page } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 } })

function holdOn(page: Page, pattern: string) {
  let release = () => {}
  const held = new Promise<void>((done) => {
    release = done
  })
  const asked: string[] = []
  const seen = page.route(pattern, async (route) => {
    asked.push(route.request().url())
    await held
    await route.fallback().catch(() => undefined)
  })
  return { release, asked, seen }
}

async function signedIn(
  page: Page,
  context: Parameters<typeof signInBrowser>[0],
  stack: Parameters<typeof forward>[1],
) {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
}

test("the editor is not ready while the server has not opened the deck, and is ready once it has", async ({
  page,
  context,
  stack,
}) => {
  await signedIn(page, context, stack)
  const hold = holdOn(page, "**/doom/create")
  await hold.seen
  try {
    const asked = page.waitForRequest("**/doom/create")
    await page.goto("/s")
    await asked
    await expect(page.locator("[data-doom-ready]")).toHaveCount(0)
    await expect(page.locator("[data-doom-stage]")).toHaveCount(0)
  } finally {
    hold.release()
  }
  await expect(page.locator("[data-doom-ready]")).toHaveCount(1)
  expect(page.url()).toContain(await page.locator("[data-doom-ready]").getAttribute("data-doom-ready"))
})

test("the editor is not ready while a font is still arriving, and the filmstrip has none pending the moment it is", async ({
  page,
  context,
  stack,
}) => {
  await signedIn(page, context, stack)
  await page.addInitScript(() => {
    const seen: { pendingInStrip: number; fontsLoading: number }[] = []
    Object.assign(window, { readySeen: seen })
    const watch = new MutationObserver(() => {
      const stage = document.querySelector("[data-doom-stage]")
      if (stage?.hasAttribute("data-doom-ready") !== true) return
      watch.disconnect()
      seen.push({
        pendingInStrip: document.querySelectorAll("[data-editor-sidebar] [data-fonts-pending]").length,
        fontsLoading: [...document.fonts].filter((face) => face.status === "loading").length,
      })
    })
    watch.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-doom-ready"] })
  })
  const hold = holdOn(page, "**/fonts/**")
  await hold.seen
  try {
    await page.goto("/s")
    await expect.poll(() => hold.asked.length).toBeGreaterThan(0)
    await expect(page.locator("[data-doom-stage]")).toBeVisible()
    await expect(page.locator("[data-doom-ready]")).toHaveCount(0)
  } finally {
    hold.release()
  }
  await expect(page.locator("[data-doom-ready]")).toHaveCount(1)
  const atReady = await page.evaluate(() => (window as unknown as { readySeen: unknown[] }).readySeen)
  expect(atReady, "the filmstrip's pending fonts and loading faces at the moment of ready").toEqual([
    { pendingInStrip: 0, fontsLoading: 0 },
  ])
})
