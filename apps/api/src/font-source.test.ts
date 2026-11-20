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

it("serves a static named face under its own typeface with independent italic", async () => {
  const network: typeof fetch = async (input) => {
    if (String(input).endsWith("METADATA.pb"))
      return new Response(
        'name: "Lato"\nlicense: "OFL"\nfonts {\n style: "normal"\n weight: 300\n filename: "Lato-Light.ttf"\n}\nfonts {\n style: "italic"\n weight: 300\n filename: "Lato-LightItalic.ttf"\n}\nfonts {\n style: "normal"\n weight: 400\n filename: "Lato-Regular.ttf"\n}',
      )
    return new Response(new Uint8Array([0, 1, 0, 0]))
  }
  const source = new FontSource(new LocalOriginalStore(), network)
  const manifest = await source.family("Lato Light")
  expect(manifest).toMatchObject({
    ok: true,
    family: "Lato Light",
    faces: [
      { file: "Lato-Light.ttf", weight: "400", style: "normal" },
      { file: "Lato-LightItalic.ttf", weight: "400", style: "italic" },
    ],
  })
})

it("serves a variable family's named face pinned to its weight and refuses a weight the family lacks", async () => {
  const network: typeof fetch = async (input) => {
    if (String(input).endsWith("METADATA.pb"))
      return new Response(
        'name: "Inter"\nlicense: "OFL"\nfonts {\n style: "normal"\n weight: 400\n filename: "Inter[opsz,wght].ttf"\n}\nfonts {\n style: "italic"\n weight: 400\n filename: "Inter-Italic[opsz,wght].ttf"\n}\naxes {\n tag: "wght"\n min_value: 100.0\n max_value: 600.0\n}',
      )
    return new Response(new Uint8Array([0, 1, 0, 0]))
  }
  const source = new FontSource(new LocalOriginalStore(), network)
  expect(await source.family("Inter SemiBold")).toMatchObject({
    ok: true,
    family: "Inter SemiBold",
    faces: [
      { file: "Inter[opsz,wght].ttf", weight: "600", style: "normal" },
      { file: "Inter-Italic[opsz,wght].ttf", weight: "600", style: "italic" },
    ],
  })
  expect(await source.family("Inter Black")).toEqual({ ok: false, refusal: "unknown", family: "Inter Black" })
})
