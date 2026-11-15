import { textToolbarAt } from "../element-window.mjs"

async function drive(kit) {
  await textToolbarAt(kit, { width: 1920, height: 1080 })
}

export default { name: "text-toolbar-large", design: null, drive }
