import element from "./design-element.mjs"

export default {
  ...element,
  name: "design-element-wide",
  async drive(kit) {
    await element.drive(kit)
    await kit.page.locator('[data-editor-panel] [role="separator"]').press("End")
  },
}
