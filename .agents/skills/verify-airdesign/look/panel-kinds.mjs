import { expect } from "@playwright/test"
import { designing, dropPicture, panelTop, selectMany } from "./doom-design.mjs"

const kinds = {
  text: { seeds: ["text"], ids: ["w:1"] },
  shape: { seeds: ["shape"], ids: ["w:2"] },
  picture: { seeds: [], picture: true },
  connector: { seeds: ["shape", "line"], ids: ["w:4"] },
  pair: { seeds: ["shape", "ellipse"], ids: ["w:2", "w:3"] },
  frame: { seeds: ["frame"], ids: ["w:7"] },
  slide: { seeds: ["shape"], ids: [] },
}

export const panelKinds = Object.keys(kinds)

export async function reachPanel(kit, kind) {
  const { seeds, ids = [], picture = false } = kinds[kind]
  const { page } = kit
  await designing(kit, ...seeds)
  if (picture) {
    const id = await dropPicture(kit)
    await selectMany(page, [id])
  } else if (ids.length > 0) await selectMany(page, ids)
  await expect(page.locator(kind === "slide" ? "[data-design-panel]" : "[data-design-element]")).toBeVisible()
  await panelTop(page)
}

export function panelState(kind) {
  return { name: `panel-${kind}`, design: null, drive: (kit) => reachPanel(kit, kind) }
}
