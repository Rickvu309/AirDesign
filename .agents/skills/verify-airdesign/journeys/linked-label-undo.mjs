import { randomUUID } from "node:crypto"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { openDoomDeck, node } from "../look/doom-deck.mjs"

import { connectOutsideAgent } from "./aira-panel.mjs"

export default async function drive(kit) {
  const { expect, doomRoutes, post, capture, note } = kit
  const doom = await packageBuild(kit.repo, "@airdesign/doom")
  const { page, cookie, deck, slide } = await openDoomDeck(kit)
  const read = async () => {
    const { json } = await post(doomRoutes.open, { deck }, cookie)
    const fold = doom.readFold(json.fold)
    if (!fold) throw Error("Unreadable fold")
    return fold
  }
  const send = async (writes) => {
    const fold = await read()
    if (doom.isRefusal(writes)) throw Error(JSON.stringify(writes))
    const { json } = await post(
      doomRoutes.edit,
      {
        deck,
        edit: { once: randomUUID(), author: { kind: "person", id: "other-device" }, readBase: fold.rev, writes },
      },
      cookie,
    )
    if (!json.ok) throw Error("send refused " + JSON.stringify(json))
    return json
  }
  const frame = doom.nodeId("journey:1")
  const measure = doom.measureWith({})
  const initial = [
    { id: "a", label: "Alpha", value: 18 },
    { id: "b", label: "Beta", value: 27 },
    { id: "c", label: "Gamma", value: 33 },
  ]
  const inst = (fold) => doom.propOf(fold.nodes.get(frame), "instance")
  const bar = (fold, id) => inst(fold).parts.find(({ key }) => key[0] === "bar" && key[1] === id)?.node
  const suppressed = async () => inst(await read()).suppressed.map(({ key }) => key.join("/"))
  const f0 = await read()
  const placed = doom.placeComponent(f0, {
    frame,
    parent: { id: slide, at: doom.orderKeyBetween(null, null) },
    box: { x: 240, y: 180, w: 1440, h: 720, rotation: 0, flipH: false, flipV: false },
    data: { rows: initial },
    measure,
  })
  await send([...doom.childrenOf(f0, slide).map(({ id }) => ({ node: id, prop: "parent", value: null })), ...placed])
  const erase = async (tab, id) => {
    const box = await node(tab, id).boundingBox()
    if (!box) throw Error("Missing bar " + id)
    await tab.keyboard.down("ControlOrMeta")
    await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await tab.keyboard.up("ControlOrMeta")
    await expect(tab.locator(`[data-selection-outline="${id}"]`)).toBeAttached()
    await tab.keyboard.press("Delete")
    await expect(node(tab, id)).toHaveCount(0)
  }
  const settle = async () => {
    await expect(page.locator('[data-save-status="saved"]')).toBeAttached({ timeout: 20000 })
  }
  const call = await connectOutsideAgent(kit, cookie, "Linked chart verifier")
  const ids = inst(await read()).parts
  const beta = ids.find(({ key }) => key[0] === "bar" && key[1] === "b").node
  const alpha = ids.find(({ key }) => key[0] === "category" && key[1] === "a").node
  await expect(node(page, beta)).toBeAttached()
  await erase(page, beta)
  await expect.poll(suppressed).toEqual(["bar/b"])
  await settle()
  const styled = await call("edit_deck", {
    deck,
    base: (await read()).rev,
    changes: [{ op: "set", target: alpha, textStyle: "body" }],
  })
  expect(styled.ok).toBe(true)
  await expect(page.locator("[data-agent-at-work]")).toBeAttached()
  await capture("restyled-alpha-beta-deleted")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(node(page, beta)).toBeAttached()
  await expect.poll(suppressed).toEqual([])
  await settle()
  await capture("restored-beta")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(node(page, beta)).toHaveCount(0)
  await expect.poll(suppressed).toEqual(["bar/b"])
  await settle()
  const updated = doom.regenerateComponent(
    await read(),
    frame,
    {
      data: { rows: [...initial, { id: "d", label: "Delta", value: 22 }] },
    },
    measure,
  )
  expect(doom.isRefusal(updated)).toBe(false)
  await send(updated.writes)
  await expect(node(page, bar(await read(), "d"))).toBeAttached()
  expect(doom.propOf((await read()).nodes.get(alpha), "text").style).toBe("body")
  await capture("rebuilt-with-alpha-style")
  note(
    "Undo restored Beta after the agent restyled Alpha. Redo deleted Beta again, and the next data update kept Alpha’s style.",
  )
}
