import { titleChosen } from "./design-element.mjs"

async function drive(kit) {
  await kit.page.setViewportSize({ width: 1280, height: 720 })
  await titleChosen(kit)
}

export default { name: "design-element-small", design: null, drive }
