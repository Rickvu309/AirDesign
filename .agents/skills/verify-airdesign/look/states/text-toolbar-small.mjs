import { textToolbarAt } from "../element-window.mjs"

async function drive(kit) {
  await textToolbarAt(kit, { width: 1280, height: 720 })
}

export default { name: "text-toolbar-small", design: null, drive }
