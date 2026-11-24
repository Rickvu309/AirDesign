import { expect } from "@playwright/test"
import { packageBuild } from "../../../../../scripts/package-build.mjs"
import { node, openDoomDeck, readDoom } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"

const author = { kind: "agent", id: "aira", run: "look-run" }
const placed = ["g:1", "g:2", "g:3"]

async function drive(kit) {
  const doom = await packageBuild(kit.repo, "@airdesign/doom")
  const opened = await openDoomDeck(kit)
  for (const [at, id] of placed.entries()) {
    const fold = doom.readFold((await readDoom(kit, opened)).fold)
    const edit = doom.compileAgentEdit(fold, [{ op: "add", kind: "shape", slide: opened.slide }], {
      author,
      once: `look-shape-${id}`,
      mint: () => doom.nodeId(id),
      ...(at === 0 ? { phase: "start" } : {}),
    })
    if ("refused" in edit) throw new Error(`shape ${id} was refused: ${JSON.stringify(edit)}`)
    const landed = await kit.post(kit.doomRoutes.edit, { deck: opened.deck, edit: edit.edit }, opened.cookie)
    if (landed.json.ok !== true) throw new Error(JSON.stringify(landed.json))
  }
  const fold = (await readDoom(kit, opened)).fold
  const subtitle = Object.values(fold.nodes).find((each) => each.role === "subtitle")
  if (subtitle === undefined) throw new Error("the cover has no subtitle")
  await expect(node(kit.page, subtitle.id)).toBeVisible()
  const above = await node(kit.page, subtitle.id).boundingBox()
  for (const id of placed) {
    await expect(node(kit.page, id)).toBeVisible()
    const box = await node(kit.page, id).boundingBox()
    expect(box.y, `${id} paints under the subtitle`).toBeGreaterThan(above.y + above.height)
  }
}

export default { name: "agent-shapes-placed", design: editor, drive }
