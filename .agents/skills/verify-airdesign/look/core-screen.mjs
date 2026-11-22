export function coreScreen(name, path) {
  return {
    name,
    design: null,
    async drive(kit) {
      await kit.page.goto(path)
      await kit.page.locator("[data-scene-slide]").waitFor()
      await kit.page.locator("[data-fonts-pending]").first().waitFor({ state: "detached" })
    },
  }
}
