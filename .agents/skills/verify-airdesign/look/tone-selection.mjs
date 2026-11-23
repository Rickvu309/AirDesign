import { designing, selectMany } from "./doom-design.mjs"

export async function selectToneText(kit) {
  await designing(kit, "text", "note")
  await selectMany(kit.page, ["w:1", "w:6"])
}
