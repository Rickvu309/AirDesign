import { titleChosen } from "./design-element.mjs"

async function drive(kit) {
  await kit.page.setViewportSize({ width: 1920, height: 1080 })
  await titleChosen(kit)
}

export default { name: "design-element-large", design: null, drive }
