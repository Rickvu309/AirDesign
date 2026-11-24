import { expect, it, vi } from "vitest"
import { FontLoader } from "./font-load.js"

it("keeps print and capture waiting while a slide's face is being installed", async () => {
  let finish = () => {}
  const installing = new Promise<void>((done) => {
    finish = done
  })
  const source: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        ok: true,
        family: "Montserrat",
        faces: [{ url: "/fonts/file?montserrat", style: "normal", weight: "400" }],
      }),
    )
  const loader = new FontLoader(document, source, async () => installing)
  const load = loader.load("Montserrat")
  let ready = false
  vi.useFakeTimers()
  const wait = loader.wait(["Montserrat"]).then(() => {
    ready = true
  })
  try {
    await vi.advanceTimersByTimeAsync(1_500)
    expect(ready).toBe(false)
    finish()
    await wait
    expect(ready).toBe(true)
    expect(await load).toBeNull()
  } finally {
    finish()
    vi.useRealTimers()
  }
})

it("is busy while a face loads and tells its watchers when it starts and settles", async () => {
  let finish = () => {}
  const installing = new Promise<void>((done) => {
    finish = done
  })
  const source: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        ok: true,
        family: "Montserrat",
        faces: [{ url: "/fonts/file?montserrat", style: "normal", weight: "400" }],
      }),
    )
  const loader = new FontLoader(document, source, async () => installing)
  const told: boolean[] = []
  const stop = loader.subscribe(() => told.push(loader.busy()))
  expect(loader.busy()).toBe(false)
  const load = loader.load("Montserrat")
  expect(loader.busy()).toBe(true)
  loader.load("montserrat")
  finish()
  await load
  expect(loader.busy()).toBe(false)
  expect(told).toEqual([true, false])
  stop()
  await loader.load("Lato")
  expect(told).toEqual([true, false])
})

it.each(["failed", "timed out"])("refuses output when the font load has %s", async (outcome) => {
  vi.useFakeTimers()
  try {
    const network: typeof fetch = () =>
      outcome === "failed" ? Promise.resolve(new Response(null, { status: 503 })) : new Promise(() => {})
    const loader = new FontLoader(document, network)
    const wait = loader.wait(["Montserrat"])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await wait).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})
