async function drive({ page, siteOrigin }) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(`${siteOrigin}/`)
  await page.locator("[data-editor-demo]").scrollIntoViewIfNeeded()
}

export default { name: "landing-product-reduced", design: null, drive }
