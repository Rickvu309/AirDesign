import { expect } from "@playwright/test"

const phone = { width: 390, height: 844 }
const desktop = { width: 1470, height: 923 }

async function askForEmail(page, siteOrigin, address) {
  await page.goto(`${siteOrigin}/sign-in`)
  await page.getByLabel("Email").fill(address)
  await page.getByRole("button", { name: "Continue with email" }).click()
  await expect(page).toHaveURL(`${siteOrigin}/sign-in/check`)
}

async function sitePages(kit, size, address) {
  const narrow = size.width < 500
  const { page, siteOrigin, capture } = kit
  await page.setViewportSize(size)
  await page.goto(`${siteOrigin}/sign-in`)
  await expect(page.getByRole("heading", { name: "Sign in or create an account" })).toBeVisible()
  await capture(narrow ? "sign-in-empty-phone" : "sign-in-empty")
  await page.getByLabel("Email").fill("a@b")
  await page.getByRole("button", { name: "Continue with email" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "That email address doesn't look right" })).toBeVisible()
  await capture(narrow ? "sign-in-bad-email-phone" : "sign-in-bad-email")
  await askForEmail(page, siteOrigin, address)
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
  await capture(narrow ? "check-email-phone" : "check-email")
  const code = page.getByLabel("Or enter the 6-digit code")
  await code.pressSequentially("000000")
  await expect(page.getByRole("alert").filter({ hasText: "That code didn't work" })).toBeVisible()
  await expect(code).toHaveValue("")
  await capture(narrow ? "code-wrong-phone" : "code-wrong")
}

export default async function drive(kit) {
  const { page, origin, siteOrigin, useSite, mailParts, capture, note } = kit
  const address = `look${Date.now().toString(36)}@example.com`
  await useSite()
  await sitePages(kit, desktop, address)
  await sitePages(kit, phone, address)
  await page.setViewportSize(desktop)

  await askForEmail(page, siteOrigin, address)
  const first = await mailParts(address)
  await page.getByLabel("Or enter the 6-digit code").fill(`${first.code.slice(0, 3)} ${first.code.slice(3)}`)
  await expect(page).toHaveURL(`${origin}/`)
  await expect(page.getByRole("button", { name: "New deck" })).toBeVisible()
  await capture("signed-in-by-code")
  note(`${address} typed the emailed code with a space in it on ${siteOrigin} and landed on ${origin}/ signed in`)

  await page.goto(`${origin}/settings/account`)
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(`${siteOrigin}/sign-in?next=%2Fsettings%2Faccount`)
  await expect(page.getByRole("heading", { name: "Sign in or create an account" })).toBeVisible()
  await capture("signed-out")
  await page.setViewportSize(phone)
  await capture("signed-out-phone")
  await page.setViewportSize(desktop)

  await askForEmail(page, siteOrigin, address)
  const second = await mailParts(address)
  expect(second.code).not.toBe(first.code)
  await page.goto(second.link)
  await expect(page).toHaveURL(`${origin}/`)
  await expect(page.getByRole("button", { name: "New deck" })).toBeVisible()
  await capture("signed-in-by-link")
  note(`the emailed link signed ${address} in at ${origin}/`)

  await page.context().clearCookies()
  await page.goto(second.link)
  await expect(page).toHaveURL(`${siteOrigin}/sign-in/expired`)
  await expect(page.getByRole("heading", { name: "This link no longer works" })).toBeVisible()
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "26px")
  await expect(page.locator("body > div")).toHaveCSS("background-color", "rgb(245, 245, 242)")
  await capture("link-expired")
  await page.setViewportSize(phone)
  await capture("link-expired-phone")
  note("a link used twice sends the browser to the site's expired page")
}
