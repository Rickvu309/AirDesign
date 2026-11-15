import { designElementAt } from "../element-window.mjs"

async function drive(kit) {
  await designElementAt(kit, { width: 1920, height: 1080 })
}

export default { name: "design-element-large", design: null, drive }
