import { expect, it } from "vitest"
import { FontSource } from "./font-source.js"
import { LocalOriginalStore } from "./local-original-store.js"

it("fetches each licensed family once, stores it and serves it after a restart", async () => {
  const store = new LocalOriginalStore()
  const fetched: string[] = []
  const network: typeof fetch = async (input) => {
    const url = String(input)
    fetched.push(url)
    if (url.endsWith("METADATA.pb"))
      return new Response(
        `name: "Montserrat"\nlicense: "OFL"\nfonts {\n style: "normal"\n weight: 400\n filename: "Montserrat-Regular.ttf"\n}`,
      )
    if (url.endsWith("OFL.txt")) return new Response("SIL OPEN FONT LICENSE Version 1.1")
    return new Response(new Uint8Array([0, 1, 0, 0, 3]))
  }
  const source = new FontSource(store, network)
  const [first, second] = await Promise.all([source.family("Montserrat"), source.family("montserrat")])
  expect(first).toEqual(second)
  expect(first).toMatchObject({ ok: true, family: "Montserrat", license: "OFL" })
  expect(fetched).toHaveLength(3)
  const restarted = new FontSource(store, network)
  expect(await restarted.family("Montserrat")).toEqual(first)
  expect(fetched).toHaveLength(3)
  expect(await restarted.family("Montserat")).toEqual({ ok: false, refusal: "unknown", family: "Montserat" })
  expect(await restarted.file("Montserrat", "../../private")).toBeUndefined()
  expect(fetched).toHaveLength(3)
})
