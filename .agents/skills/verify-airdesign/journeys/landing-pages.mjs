import { expect } from "@playwright/test"

const desktop = { width: 1470, height: 923 }
const phone = { width: 390, height: 844 }
const landscape = { width: 844, height: 390 }
const narrow = { width: 320, height: 568 }

async function scrollTo(page, selector) {
  await page.evaluate((target) => {
    const section = document.querySelector(target)
    section.scrollIntoView({ behavior: "instant", block: "start" })
  }, selector)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
}

async function scrollToEnd(page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }))
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
}

async function top(kit, size, label) {
  await kit.page.setViewportSize(size)
  await kit.page.goto(`${kit.siteOrigin}/`)
  await expect(kit.page.getByRole("heading", { level: 1 })).toHaveText("Clarity is the edge.")
  await kit.capture(label)
}

export default async function drive(kit) {
  const { page, siteOrigin, capture, note } = kit
  await top(kit, desktop, "landing-hero")
  await top(kit, landscape, "landing-hero-landscape")
  await top(kit, narrow, "landing-hero-narrow")
  await top(kit, phone, "landing-hero-phone")
  await scrollTo(page, "#product")
  await capture("landing-product-phone")
  await scrollTo(page, "#agents")
  await capture("landing-agents-phone")
  await scrollTo(page, "#pricing")
  await capture("landing-pricing-phone")
  await scrollToEnd(page)
  await capture("landing-footer-phone")
  const reach = await page.evaluate(() => ({
    across: document.documentElement.scrollWidth,
    shown: document.documentElement.clientWidth,
  }))
  note(`the landing page at ${siteOrigin}/ is ${reach.across} px wide in a ${reach.shown} px phone`)
}
