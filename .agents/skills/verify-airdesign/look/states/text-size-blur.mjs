import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+a")
  await text.pressSequentially("Hello world")
  await text.press("ControlOrMeta+a")
  const size = kit.page.getByRole("textbox", { name: "Font size" })
  await size.fill("24.5")
  await kit.capture("size-typed")
  await size.press("Tab")
  await kit.capture("size-tab")
  const focused = await kit.page.locator(":focus").evaluate((node) => ({
    role: node.getAttribute("role") ?? node.tagName,
    name: node.getAttribute("aria-label"),
    text: node.textContent,
  }))
  kit.note(`After Tab: ${JSON.stringify(focused)}`)
}

export default { name: "text-size-blur", design: "/screens/s43-08-editor-tools-text-format", drive }
