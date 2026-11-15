import { textToolbarAt } from "../element-window.mjs"

async function drive(kit) {
  await textToolbarAt(kit, { width: 1470, height: 923 })
}

export default { name: "text-toolbar", design: null, drive }
