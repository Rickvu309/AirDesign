import { packageBuild } from "../../../../scripts/package-build.mjs"

const author = { kind: "agent", id: "aira", run: "bench-run" }

async function readOpen(kit, deck, cookie) {
  const doom = await packageBuild(kit.repo, "@airdesign/doom")
  const opened = await kit.post(kit.doomRoutes.open, { deck }, cookie)
  return doom.readFold(opened.json.fold)
}

async function land(kit, deck, cookie, changes, once, counter, phase) {
  const doom = await packageBuild(kit.repo, "@airdesign/doom")
  const fold = await readOpen(kit, deck, cookie)
  const mint = () => doom.nodeId(`g:${(counter.value += 1)}`)
  const compiled = doom.compileAgentEdit(fold, changes, {
    author,
    once,
    mint,
    ...(phase === undefined ? {} : { phase }),
  })
  if ("refused" in compiled) throw new Error(`bench deck refused ${JSON.stringify(compiled)}`)
  const landed = await kit.post(kit.doomRoutes.edit, { deck, edit: compiled.edit }, cookie)
  if (landed.json.ok !== true) throw new Error(`bench deck not landed ${JSON.stringify(landed.json)}`)
  return compiled.added.map((each) => each.id)
}

export async function boardDeck(kit, cookie, slideCount, deck) {
  const doom = await packageBuild(kit.repo, "@airdesign/doom")
  const counter = { value: 0 }
  const first = doom.slidesOf(await readOpen(kit, deck, cookie))[0].id
  const added = await land(
    kit,
    deck,
    cookie,
    Array.from({ length: slideCount - 1 }, () => ({ op: "slide", add: {} })),
    "bench-slides",
    counter,
    "start",
  )
  const slides = [first, ...added]
  for (let at = 0; at < slides.length; at += 5) {
    const changes = doom.boardDeckChanges(slides.slice(at, at + 5)).flat()
    await land(kit, deck, cookie, changes, `bench-board-${at}`, counter)
  }
  return slides
}

export async function openBoardDeck(kit, slideCount) {
  const { cookie } = await kit.signIn()
  await kit.page.goto("/s")
  await kit.page.locator("[data-doom-ready]").waitFor()
  const deck = new URL(kit.page.url()).pathname.slice("/s/".length)
  const slides = await boardDeck(kit, cookie, slideCount, deck)
  return { deck, cookie, slides }
}

export async function ready(page, deck) {
  await page.locator(`[data-doom-ready="${deck}"]`).waitFor()
}
