import { landNodes, node, openDoomDeck, readDoom, spot, words } from "./doom-deck.mjs"

const sentence =
  "Commercial parts flown on small missions passed screening at a lower cost than parts built to the full standard, and the review found the same failure rates across the three lots it tested. "

async function clearSlide(kit, opened) {
  const { fold } = await readDoom(kit, opened)
  const placed = Object.values(fold.nodes).filter((each) => each.parent?.id === opened.slide)
  const writes = placed.map((each) => ({ node: each.id, prop: "parent", value: null }))
  const edit = { once: `look-clear-${String(Date.now())}`, author: { kind: "person", id: "other-tab" }, writes }
  const landed = await kit.post(kit.doomRoutes.edit, { deck: opened.deck, edit }, opened.cookie)
  if (landed.json.ok !== true) throw new Error(`clearing the slide was refused: ${JSON.stringify(landed.json)}`)
}

export async function largeTextBox(kit) {
  const opened = await openDoomDeck(kit)
  await clearSlide(kit, opened)
  await landNodes(kit, opened, [
    {
      id: "w:1",
      props: { name: "Findings", box: spot(160, 140, 1600, 800), text: words(sentence.repeat(5).trim()) },
    },
  ])
  return node(opened.page, "w:1")
}

export async function committed(kit, act) {
  const answered = kit.page.waitForResponse((response) => new URL(response.url()).pathname === kit.doomRoutes.edit.path)
  await act()
  await answered
  await kit.page.waitForTimeout(1500)
}
