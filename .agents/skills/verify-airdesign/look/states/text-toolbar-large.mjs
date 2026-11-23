import { textBarAt } from "../doom-text-window.mjs"

async function drive(kit) {
  await textBarAt(kit, { width: 1920, height: 1080 })
}

export default { name: "text-toolbar-large", design: null, drive }
