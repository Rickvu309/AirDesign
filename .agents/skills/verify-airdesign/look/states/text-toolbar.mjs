import { textBarAt } from "../doom-text-window.mjs"

async function drive(kit) {
  await textBarAt(kit, { width: 1470, height: 923 })
}

export default { name: "text-toolbar", design: null, drive }
