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
    await expect(page.locator("[data-editor-ready]")).toHaveCount(0)
    await expect(page.locator("[data-editor-stage]")).toHaveCount(0)
  } finally {
    hold.release()
  }
  await expect(page.locator("[data-editor-ready]")).toHaveCount(1)
  expect(page.url()).toContain(await page.locator("[data-editor-ready]").getAttribute("data-editor-ready"))
})

test("the editor and filmstrip paint while fonts arrive and clear their pending text once fonts load", async ({
  page,
  context,
  stack,
}) => {
  await signedIn(page, context, stack)
  const hold = holdOn(page, "**/fonts/**")
  await hold.seen
  const canvas = page.locator("[data-slide-box] [data-font-pending]")
  const filmstrip = page.locator("[data-slide-thumb] [data-font-pending]")
  try {
    await page.goto("/s")
    await expect.poll(() => hold.asked.length).toBeGreaterThan(0)
    await expect(page.locator("[data-editor-ready]")).toHaveCount(1)
    await expect(canvas.first()).toBeVisible()
    await expect(filmstrip.first()).toBeVisible()
  } finally {
    hold.release()
  }
  await expect(canvas).toHaveCount(0)
  await expect(filmstrip).toHaveCount(0)
})

test("the editor recovers a cold font engine without reopening the deck", async ({ page, context, stack }) => {
  await signedIn(page, context, stack)
  let attempts = 0
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/assets/icu-breaks-*.wasm", async (route) => {
    if (++attempts === 1) {
      await route.abort()
      return
    }
    await held
    await route.fallback()
  })
  const canvas = page.locator("[data-slide-box] [data-font-pending]")
  const filmstrip = page.locator("[data-slide-thumb] [data-font-pending]")
  try {
    await page.goto("/s")
    await expect.poll(() => attempts).toBe(2)
    await expect(canvas.first()).toBeVisible()
    await expect(filmstrip.first()).toBeVisible()
  } finally {
    release()
  }
  await expect(canvas).toHaveCount(0)
  await expect(filmstrip).toHaveCount(0)
})
