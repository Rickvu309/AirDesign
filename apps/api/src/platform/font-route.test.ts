import type { IncomingMessage, ServerResponse } from "node:http"
import { expect, it } from "vitest"
import { fontMiddleware, fontRouteList } from "./font-route.js"
import { FontSource } from "./font-source.js"
import { LocalOriginalStore } from "./local-original-store.js"

const upstream: typeof fetch = async (input) => {
  const url = String(input)
  if (url.endsWith("METADATA.pb"))
    return new Response(
      `name: "Montserrat"\nlicense: "OFL"\nfonts {\n style: "normal"\n weight: 400\n filename: "Montserrat-Regular.ttf"\n}`,
    )
  if (url.endsWith("OFL.txt")) return new Response("SIL OPEN FONT LICENSE Version 1.1")
  return new Response(new Uint8Array([0, 1, 0, 0, 3]))
}

const visit = (serve: ReturnType<typeof fontMiddleware>, url: string) =>
  new Promise<number | "next">((resolve) => {
    let status = 0
    const res = {
      writeHead: (code: number) => {
        status = code
      },
      end: () => resolve(status),
    }
    serve({ method: "GET", url } as IncomingMessage, res as unknown as ServerResponse, () => resolve("next"))
  })

it("answers from the fonts it was given and asks only the network it was given", async () => {
  const store = new LocalOriginalStore()
  expect(await new FontSource(store, upstream).family("Montserrat")).toMatchObject({ ok: true })
  const asked: string[] = []
  const offline: typeof fetch = async (input) => {
    asked.push(String(input))
    throw new Error("offline")
  }
  const serve = fontMiddleware(new FontSource(store, offline))

  expect(await visit(serve, "/fonts/family?family=Montserrat")).toBe(200)
  expect(await visit(serve, "/fonts/family?family=Lora")).toBe(503)
  expect(await visit(serve, "/decks")).toBe("next")
  expect(asked).toHaveLength(1)
  expect(asked[0]).toMatch(/\/lora\/METADATA\.pb$/)
})

it("the API's font route answers from the fonts its options give and asks no other network", async () => {
  const store = new LocalOriginalStore()
  expect(await new FontSource(store, upstream).family("Montserrat")).toMatchObject({ ok: true })
  const offline: typeof fetch = async () => {
    throw new Error("offline")
  }
  const [family] = fontRouteList
  let status = 0
  await family?.serve({
    options: { fonts: new FontSource(store, offline) },
    query: new URLSearchParams({ family: "Montserrat" }),
    res: {
      writeHead: (code: number) => {
        status = code
      },
      end: () => undefined,
    } as unknown as ServerResponse,
  })
  expect(status).toBe(200)
})
