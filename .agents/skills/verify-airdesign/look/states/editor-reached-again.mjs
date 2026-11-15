import { editor } from "../editor-screen.mjs"
import { decks, kept, unreachedEdit } from "../unreached.mjs"

const outage = 2000

async function drive(kit) {
  await unreachedEdit(kit)
  await kit.page.waitForTimeout(outage)
  await kit.page.unroute(decks)
  await kept(kit.page)
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => undefined)
}

export default { name: "editor-reached-again", design: editor, drive }
