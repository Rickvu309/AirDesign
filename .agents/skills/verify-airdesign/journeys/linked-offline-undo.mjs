import { randomUUID } from "node:crypto"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { node, openDoomDeck } from "../look/doom-deck.mjs"

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
    const author = { kind: "person", id: "other-device" }
    const fold = await read()
    if (doom.isRefusal(writes)) throw Error(JSON.stringify(writes))
    const { json } = await post(
      doomRoutes.edit,
      { deck, edit: { once: randomUUID(), author, readBase: fold.rev, writes } },
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
  const suppressed = async () =>
    inst(await read())
      .suppressed.map(({ key }) => key.join("/"))
      .sort()
  const f0 = await read()
  const placed = doom.placeComponent(f0, {
    frame,
    parent: { id: slide, at: doom.orderKeyBetween(null, null) },
    box: { x: 240, y: 180, w: 1440, h: 720, rotation: 0, flipH: false, flipV: false },
    data: { rows: initial },
    measure,
  })
  if (doom.isRefusal(placed)) throw Error(JSON.stringify(placed))
  await send([...doom.childrenOf(f0, slide).map(({ id }) => ({ node: id, prop: "parent", value: null })), ...placed])
  const seeded = await read()
  const [a, b] = ["a", "b"].map((id) => bar(seeded, id))
  await expect(node(page, a)).toBeAttached()
  const editRoute = (url) => url.pathname === doomRoutes.edit.path
  const sinceRoute = (url) => url.pathname === doomRoutes.since.path
  const fail = (route) => route.abort("internetdisconnected")
  const offline = async (on) => {
    if (on) {
      await page.route(editRoute, fail)
      await page.route(sinceRoute, fail)
    } else {
      await page.unroute(editRoute, fail)
      await page.unroute(sinceRoute, fail)
      await page.evaluate(() => dispatchEvent(new Event("online")))
    }
  }
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
  await erase(page, b)
  await expect.poll(suppressed).toEqual(["bar/b"])
  await settle()
  await offline(true)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(node(page, b)).toBeAttached()
  await expect(page.locator('[data-save-status="offline"], [data-save-status="unreached"]')).toBeAttached()
  await capture("offline-undo")
  await page.reload()
  await expect(node(page, b)).toBeAttached()
  await capture("offline-reload")
  await send([{ node: a, prop: "parent", value: null }])
  await offline(false)
  await settle()
  await capture("reconnected")
  expect(await suppressed()).toEqual(["bar/a"])
  await expect(node(page, b)).toBeAttached()
  await expect(node(page, a)).toHaveCount(0)
  await expect(page.locator("[data-notice], [data-sonner-toast]")).toHaveCount(0)
  note("Beta stayed restored after reload and reconnect, and the other device’s Alpha deletion stayed saved.")
}
