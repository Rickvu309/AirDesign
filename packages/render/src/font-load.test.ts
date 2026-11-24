import { expect, it } from "vitest"
import { FontLoader } from "./font-load.js"

it("waits for the requested face and shares one load across case variants", async () => {
  let finish = () => {}
  const installed = new Promise<void>((resolve) => {
    finish = resolve
  })
  const requests: string[] = []
  const network: typeof fetch = async (url) => {
    requests.push(String(url))
    return new Response(
      JSON.stringify({
        ok: true,
        family: "Montserrat",
        faces: [{ url: "/fonts/file?montserrat", style: "normal", weight: "100 900" }],
      }),
    )
  }
  const loader = new FontLoader(document, network, async () => installed)
  let heard = 0
  loader.subscribe(() => {
    heard += 1
  })
  const loaded = loader.load("Montserrat")
  expect(loader.load("montserrat")).toBe(loaded)
  expect(loader.ready("Montserrat")).toBe(false)
  expect(loader.faces("Montserrat")).toBeUndefined()
  finish()
  expect(await loaded).toBeNull()
  expect(loader.ready("Montserrat")).toBe(true)
  expect([heard, loader.settledCount()]).toEqual([2, 1])
  expect(loader.faces("montserrat")).toEqual([{ style: "normal", weight: "100 900" }])
  expect(requests).toEqual(["/fonts/family?family=Montserrat"])
})

it("permits fallback for unknown names and retries unavailable loads", async () => {
  for (const status of [404, 503]) {
    const loader = new FontLoader(document, async () => new Response(null, { status }))
    expect(await loader.load("Missing")).toEqual({
      family: "Missing",
      refusal: status === 404 ? "unknown" : "unavailable",
    })
    expect(loader.ready("Missing")).toBe(status === 404)
  }
})

it("refuses a manifest that sends the browser off origin", async () => {
  const loader = new FontLoader(
    document,
    async () =>
      new Response(
        JSON.stringify({
          ok: true,
          family: "Montserrat",
          faces: [{ url: "https://fonts.gstatic.com/font.ttf", style: "normal", weight: "400" }],
        }),
      ),
  )
  expect(await loader.load("Montserrat")).toEqual({ family: "Montserrat", refusal: "unavailable" })
})

it("knows a family's faces once its manifest arrives, before its files install", async () => {
  let finish = () => {}
  const installed = new Promise<void>((resolve) => {
    finish = resolve
  })
  let asked = () => {}
  const installing = new Promise<void>((resolve) => {
    asked = resolve
  })
  const network: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        ok: true,
        family: "Montserrat",
        faces: [{ url: "/fonts/file?montserrat", style: "normal", weight: "100 900" }],
      }),
    )
  const loader = new FontLoader(document, network, async () => {
    asked()
    return installed
  })
  const loaded = loader.load("Montserrat")
  await installing
  expect(loader.faces("Montserrat")).toEqual([{ style: "normal", weight: "100 900" }])
  expect(loader.ready("Montserrat")).toBe(false)
  expect(loader.servedFamily("montserrat")).toBeUndefined()
  finish()
  await loaded
  expect(loader.servedFamily("montserrat")).toBe("Montserrat")
})

it("can recover a face in the same document after its file failed to load", async () => {
  let available = false
  const loader = new FontLoader(
    document,
    async () =>
      Response.json({
        ok: true,
        family: "Geist",
        faces: [{ url: "/fonts/file?geist", style: "normal", weight: "400" }],
      }),
    async () => {
      if (!available) throw new Error("file unavailable")
    },
  )
  expect(await loader.load("Geist")).toMatchObject({ refusal: "unavailable" })
  expect(loader.ready("Geist")).toBe(false)
  available = true
  expect(await loader.load("Geist")).toBeNull()
  expect(loader.ready("Geist")).toBe(true)
})
