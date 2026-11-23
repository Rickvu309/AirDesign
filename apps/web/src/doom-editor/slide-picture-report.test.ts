import type { SlidePictures } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { reportSlidePictures, slideKey, unresolvedAssets } from "./slide-picture-report"
import { grow, paint, spot } from "@/testing/doom-fixtures"

const asset = "a".repeat(64)

function twoSlides() {
  const grown = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [{ children: [] }, { children: [] }],
  })
  return { view: grown.doom, slides: grown.slides }
}

function recorder(missing: (index: number) => readonly doom.NodeId[]) {
  const sent: { keys: string[]; images: SlidePictures<doom.NodeId>["images"] }[] = []
  return {
    sent,
    send: async (pictures: SlidePictures<doom.NodeId>) => {
      sent.push({ keys: pictures.keys.map((each) => each.slide), images: pictures.images })
      return missing(sent.length - 1)
    },
  }
}

describe("the key of a slide", () => {
  it("is the hex sha-256 of the text that says how the slide looks, so the server computes the same", async () => {
    const { view, slides } = twoSlides()
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(doom.slideKeyText(view, slides[0]!)))
    const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    expect(await slideKey(view, slides[0]!)).toBe(expected)
    expect(expected).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("reporting the pictures of a deck's slides", () => {
  it("sends every slide's key first, then one painted picture for each slide the server still wants", async () => {
    const { view, slides } = twoSlides()
    const server = recorder((index) => (index === 0 ? slides : index === 1 ? [slides[1]!] : []))
    const painted: string[] = []
    await reportSlidePictures({
      view,
      send: server.send,
      capture: async (slide) => {
        painted.push(slide)
        return `data-${slide}`
      },
      ready: () => true,
      current: () => true,
    })
    expect(server.sent.map((each) => each.keys)).toEqual([slides, slides, slides])
    expect(painted).toEqual(slides)
    expect(server.sent[1]!.images).toEqual([
      { slide: slides[0], key: await slideKey(view, slides[0]!), type: "image/jpeg", data: `data-${slides[0]}` },
    ])
    expect(server.sent[2]!.images[0]).toMatchObject({ slide: slides[1] })
  })

  it("paints nothing for a slide whose picture bytes are not on this device yet, and moves on", async () => {
    const { view, slides } = twoSlides()
    const server = recorder((index) => (index === 0 ? slides : []))
    const painted: string[] = []
    await reportSlidePictures({
      view,
      send: server.send,
      capture: async (slide) => {
        painted.push(slide)
        return "data"
      },
      ready: (slide) => slide !== slides[0],
      current: () => true,
    })
    expect(painted).toEqual([slides[1]])
  })

  it("drops a picture painted after the deck moved on from the revision it is reporting", async () => {
    const { view, slides } = twoSlides()
    const server = recorder(() => slides)
    let alive = true
    await reportSlidePictures({
      view,
      send: server.send,
      capture: async () => {
        alive = false
        return "data"
      },
      ready: () => true,
      current: () => alive,
    })
    expect(server.sent).toHaveLength(1)
  })

  it("stops when the server cannot be reached, and says so", async () => {
    const { view } = twoSlides()
    const painted: string[] = []
    const reached = await reportSlidePictures({
      view,
      send: async () => null,
      capture: async (slide) => {
        painted.push(slide)
        return "data"
      },
      ready: () => true,
      current: () => true,
    })
    expect(painted).toEqual([])
    expect(reached).toBe(false)
  })

  it("says it reached the server when it ran to the end", async () => {
    const { view } = twoSlides()
    expect(
      await reportSlidePictures({
        view,
        send: async () => [],
        capture: async () => null,
        ready: () => true,
        current: () => true,
      }),
    ).toBe(true)
  })

  it("sends no picture for a slide that could not be painted", async () => {
    const { view, slides } = twoSlides()
    const server = recorder((index) => (index === 0 ? [slides[0]!] : []))
    await reportSlidePictures({
      view,
      send: server.send,
      capture: async () => null,
      ready: () => true,
      current: () => true,
    })
    expect(server.sent).toHaveLength(1)
  })
})

describe("the pictures a slide waits for", () => {
  it("names each stored picture the slide uses that this device does not hold", () => {
    const { view, slides } = grow([
      {
        type: "shape",
        name: "picture",
        props: { box: spot(0, 0, 100, 100), fills: [{ kind: "image", asset, fit: "fill" }] },
      },
      { type: "shape", name: "plain", props: { box: spot(0, 0, 100, 100), fills: paint } },
    ])
    expect(unresolvedAssets(view, slides[0]!, () => undefined)).toEqual([asset])
    expect(unresolvedAssets(view, slides[0]!, () => "blob:1")).toEqual([])
  })
})
