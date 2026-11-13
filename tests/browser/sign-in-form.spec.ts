import { expect, test, type Page } from "@playwright/test"
import { signInCopy } from "../../apps/site/src/access/sign-in-copy.ts"
import { serveSite, type ServedSite } from "./site-server.ts"

const phone = { width: 390, height: 844 }
const desktop = { width: 1470, height: 923 }
const pendingKey = "airdesign.pending-sign-in-email"

let site: ServedSite

test.beforeAll(async () => {
  site = await serveSite()
})

test.afterAll(async () => {
  await site.close()
})

async function answerSignIn(page: Page, path: string, status: number): Promise<unknown[]> {
  const posted: unknown[] = []
  await page.route(`${site.origin}${path}`, async (route) => {
    posted.push(route.request().postDataJSON())
    await route.fulfill({ status, contentType: "application/json", body: "{}" })
  })
  return posted
}

async function top(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox()
  if (box === null) throw new Error(`${selector} is not on the page`)
  return box.y
}

for (const size of [desktop, phone]) {
  test(`an email error at ${String(size.width)} px moves nothing below the field`, async ({ page }) => {
    await page.setViewportSize(size)
    await answerSignIn(page, "/sign-in/email", 500)
    for (const [address, line] of [
      ["a@b", signInCopy.emailRefused],
      ["ada@example.com", signInCopy.emailFailed],
    ] as const) {
      await page.goto(`${site.origin}/sign-in`)
      await page.evaluate(() => document.fonts.ready)
      const before = await top(page, "button[type=submit]")
      await page.getByLabel("Email").fill(address)
      await page.getByRole("button", { name: "Continue with email" }).click()
      await expect(page.locator("[data-sign-in-error]")).toHaveText(line)
      expect(await top(page, "button[type=submit]"), address).toBe(before)
    }
  })

  test(`a refused code at ${String(size.width)} px moves nothing on the check page`, async ({ page }) => {
    await page.setViewportSize(size)
    await answerSignIn(page, "/sign-in/code", 401)
    await page.addInitScript((key) => sessionStorage.setItem(key, "ada@example.com"), pendingKey)
    await page.goto(`${site.origin}/sign-in/check`)
    await page.evaluate(() => document.fonts.ready)
    const before = [await top(page, "[data-code-box]"), await top(page, "[data-send-again]")]
    await page.getByLabel("Or enter the 6-digit code").pressSequentially("000000")
    await expect(page.locator("[data-code-error]")).toHaveText(signInCopy.codeRefused)
    expect([await top(page, "[data-code-box]"), await top(page, "[data-send-again]")]).toEqual(before)
  })
}

test("the page refuses exactly the addresses the API refuses, beside the field", async ({ page }) => {
  const posted = await answerSignIn(page, "/sign-in/email", 500)
  for (const address of ["", "a@b", "a@b.c", "a!b@c.co", "a b@c.co"]) {
    await page.goto(`${site.origin}/sign-in`)
    await page.getByLabel("Email").fill(address)
    await page.getByRole("button", { name: "Continue with email" }).click()
    await expect(page.locator("[data-sign-in-error]"), address).toHaveText(signInCopy.emailRefused)
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true")
  }
  expect(posted).toEqual([])
  for (const address of ["a@-b.co", " Ada@Example.COM "]) {
    await page.goto(`${site.origin}/sign-in`)
    await page.getByLabel("Email").fill(address)
    await page.getByRole("button", { name: "Continue with email" }).click()
    await expect(page.locator("[data-sign-in-error]"), address).toHaveText(signInCopy.emailFailed)
  }
  expect(posted).toEqual([{ email: "a@-b.co" }, { email: "ada@example.com" }])
})

test("the code entry shows the focus ring a keyboard user sees on every other control", async ({ page }) => {
  await page.goto(`${site.origin}/sign-in`)
  await page.keyboard.press("Tab")
  const ring = await page
    .getByLabel("Email")
    .evaluate((field) => [getComputedStyle(field).outlineStyle, getComputedStyle(field).outlineColor])
  expect(ring[0]).toBe("solid")
  await page.addInitScript((key) => sessionStorage.setItem(key, "ada@example.com"), pendingKey)
  await page.goto(`${site.origin}/sign-in/check`)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(page.getByLabel("Or enter the 6-digit code")).toBeFocused()
  const entry = await page
    .locator("[data-six-digit-code]")
    .evaluate((row) => [getComputedStyle(row).outlineStyle, getComputedStyle(row).outlineColor])
  expect(entry).toEqual(ring)
})

test("Get a new link and Use a different email keep the email the person typed", async ({ page }) => {
  await page.addInitScript((key) => sessionStorage.setItem(key, "ada@example.com"), pendingKey)
  await page.goto(`${site.origin}/sign-in/expired`)
  await page.getByRole("link", { name: "Get a new link" }).click()
  await expect(page).toHaveURL(`${site.origin}/sign-in`)
  await expect(page.getByLabel("Email")).toHaveValue("ada@example.com")
  await page.goto(`${site.origin}/sign-in/check`)
  await page.getByRole("link", { name: "Use a different email" }).click()
  await expect(page.getByLabel("Email")).toHaveValue("ada@example.com")
})
