import { designElementAt } from "../element-window.mjs"

async function drive(kit) {
  await designElementAt(kit, { width: 1470, height: 923 })
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
}

export default { name: "text-toolbar-design", design: null, drive }
