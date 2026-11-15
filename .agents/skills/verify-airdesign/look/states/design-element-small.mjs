import { designElementAt } from "../element-window.mjs"

async function drive(kit) {
  await designElementAt(kit, { width: 1280, height: 720 })
}

export default { name: "design-element-small", design: null, drive }
