import { textBarAt } from "../doom-text-window.mjs"

async function drive(kit) {
  await textBarAt(kit, { width: 1470, height: 923 }, { design: true })
}

export default { name: "text-toolbar-design", design: null, drive }
