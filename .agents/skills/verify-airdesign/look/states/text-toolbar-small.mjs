import { textBarAt } from "../doom-text-window.mjs"

async function drive(kit) {
  await textBarAt(kit, { width: 1280, height: 720 })
}

export default { name: "text-toolbar-small", design: null, drive }
