export async function setPanelMode(page, mode) {
  const toggle = page.locator("[data-design-mode]")
  const pressed = mode === "design" ? "true" : "false"
  if ((await toggle.getAttribute("aria-pressed")) !== pressed) await toggle.click()
  await page.waitForFunction(
    (pressed) => document.querySelector("[data-design-mode]")?.getAttribute("aria-pressed") === pressed,
    pressed,
  )
}
