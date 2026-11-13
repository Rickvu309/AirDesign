import { describe, expect, it } from "vitest"
import { pictureLayer, pictureSources, type PictureImage } from "./picture-fill"

const whole = { left: 0, top: 0, right: 0, bottom: 0 }

function image(overrides: Partial<PictureImage> = {}): PictureImage {
  return { part: "ppt/media/image1.png", contentType: "image/png", crop: whole, tile: false, ...overrides }
}

function urls() {
  const made: string[] = []
  const revoked: string[] = []
  const parts = new Map([
    ["ppt/media/image1.png", new Uint8Array([1])],
    ["ppt/media/image2.jpeg", new Uint8Array([2])],
    ["ppt/media/image3.emf", new Uint8Array([3])],
  ])
  const sources = pictureSources(parts, {
    create: (blob) => {
      const url = `blob:${made.length}:${blob.type}`
      made.push(url)
      return url
    },
    revoke: (url) => {
      revoked.push(url)
    },
  })
  return { made, revoked, sources, parts }
}

describe("pictureSources", () => {
  it("makes one address per picture part however often a slide asks for it", () => {
    const { made, sources } = urls()
    const first = sources.src(image())
    expect(sources.src(image())).toBe(first)
    expect(sources.src(image({ part: "ppt/media/image2.jpeg", contentType: "image/jpeg" }))).toBe("blob:1:image/jpeg")
    expect(made).toEqual(["blob:0:image/png", "blob:1:image/jpeg"])
  })

  it.each([
    ["an EMF", "image/x-emf"],
    ["a WMF", "image/x-wmf"],
    ["a TIFF", "image/tiff"],
    ["an unknown type", null],
  ])("makes no address for %s, which the browser cannot draw", (_, contentType) => {
    const { made, sources } = urls()
    expect(sources.src(image({ part: "ppt/media/image3.emf", contentType }))).toBeNull()
    expect(made).toEqual([])
  })

  it("makes no address for a part the deck does not hold", () => {
    const { made, sources } = urls()
    expect(sources.src(image({ part: "ppt/media/gone.png" }))).toBeNull()
    expect(made).toEqual([])
  })

  it("releases every address it made, once, when the deck closes", () => {
    const { made, revoked, sources } = urls()
    sources.src(image())
    sources.src(image({ part: "ppt/media/image2.jpeg", contentType: "image/jpeg" }))
    sources.release()
    sources.release()
    expect(revoked).toEqual(made)
  })

  it("hands an unchanged picture's address to the next paint and releases only the rest", () => {
    const { revoked, sources, parts } = urls()
    const kept = sources.src(image())
    const changed = sources.src(image({ part: "ppt/media/image2.jpeg", contentType: "image/jpeg" }))
    const carried = sources.carried(new Map(parts).set("ppt/media/image2.jpeg", new Uint8Array([9])))
    sources.release()
    expect(revoked).toEqual([changed])
    expect(carried.src(image())).toBe(kept)
    expect(carried.src(image({ part: "ppt/media/image2.jpeg", contentType: "image/jpeg" }))).toBe("blob:2:image/jpeg")
    carried.release()
    expect(revoked).toEqual([changed, kept, "blob:2:image/jpeg"])
  })
})

describe("pictureLayer", () => {
  it("stretches a whole picture over its box", () => {
    expect(pictureLayer(image(), "blob:a")).toBe('url("blob:a") 0% 0% / 100% 100% no-repeat')
  })

  it("shows only the part a crop keeps", () => {
    expect(pictureLayer(image({ crop: { left: 0.5, top: 0.25, right: 0, bottom: 0.25 } }), "blob:a")).toBe(
      'url("blob:a") 100% 50% / 200% 200% no-repeat',
    )
  })

  it("repeats a tiled picture at its own size", () => {
    expect(pictureLayer(image({ tile: true }), "blob:a")).toBe('url("blob:a") 0% 0% / auto repeat')
  })

  it("draws nothing when a crop keeps none of the picture", () => {
    expect(pictureLayer(image({ crop: { left: 0.6, top: 0, right: 0.4, bottom: 0 } }), "blob:a")).toBeNull()
  })
})
