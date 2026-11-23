import { describe, expect, it } from "vitest"
import { iconParts } from "@airdesign/pptx"
import { iconMarkup } from "@/testing/icon-markup"
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

function rectangleEmf(): Uint8Array {
  const words = (values: readonly number[]) => new Uint8Array(Int32Array.from(values).buffer)
  const header = words([1, 88, 0, 0, 99, 49, 0, 0, 999, 499, 0x464d4520, 0x10000, 0, 3, 0, 0, 0, 0, 100, 50, 10, 5])
  const records = [words([43, 24, 10, 10, 60, 40]), words([14, 20, 0, 16, 20])]
  const bytes = new Uint8Array(header.length + records.reduce((sum, record) => sum + record.length, 0))
  let at = 0
  for (const piece of [header, ...records]) {
    bytes.set(piece, at)
    at += piece.length
  }
  return bytes
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
  ])("makes no address for %s whose bytes it cannot read", (_, contentType) => {
    const { made, sources } = urls()
    expect(sources.src(image({ part: "ppt/media/image3.emf", contentType }))).toBeNull()
    expect(made).toEqual([])
  })

  it("draws an EMF the browser cannot show as an SVG picture and keeps the file's bytes", async () => {
    const made: Blob[] = []
    const emf = rectangleEmf()
    const parts = new Map([["ppt/media/image9.emf", emf]])
    const sources = pictureSources(parts, {
      create: (blob) => {
        made.push(blob)
        return `blob:${made.length}`
      },
      revoke: () => undefined,
    })
    const url = sources.src(image({ part: "ppt/media/image9.emf", contentType: "image/x-emf" }))
    expect(url).toBe("blob:1")
    expect(made[0]?.type).toBe("image/svg+xml")
    expect(await made[0]?.text()).toContain('d="M10 10L60 10L60 40L10 40Z"')
    expect(parts.get("ppt/media/image9.emf")).toBe(emf)
    expect([...emf]).toEqual([...rectangleEmf()])
  })

  it("gives an icon's SVG a data address, which the browser paints in the frame it swaps in, and revokes no address for it", () => {
    const { made, revoked } = urls()
    const rocket = iconMarkup([["path", { d: "M4.5 16.5c-1.5 1.26-2 5-2 5" }]])
    const sources = pictureSources(new Map([[iconParts("rocket").svg, new TextEncoder().encode(rocket)]]), {
      create: (blob) => {
        made.push(blob.type)
        return "blob:icon"
      },
      revoke: (url) => {
        revoked.push(url)
      },
    })
    const url = sources.src(image({ part: iconParts("rocket").svg, contentType: "image/svg+xml" }))
    expect(url).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(rocket)}`)
    expect(made).toEqual([])
    sources.release()
    expect(revoked).toEqual([])
  })

  it("paints an icon at a weight or color the device has not drawn yet from the same icon drawn otherwise, so it never blinks", () => {
    const rocket = iconMarkup([["path", { d: "M4.5 16.5c-1.5 1.26-2 5-2 5" }]])
    const sources = pictureSources(new Map([[iconParts("rocket").svg, new TextEncoder().encode(rocket)]]))
    const thin = iconParts("rocket", 150).svg
    const lighter = iconMarkup([["path", { d: "M4.5 16.5c-1.5 1.26-2 5-2 5" }]], 150)
    expect(sources.src(image({ part: thin, contentType: "image/svg+xml" }))).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(lighter)}`,
    )
    expect(sources.src(image({ part: iconParts("star", 150).svg, contentType: "image/svg+xml" }))).toBeNull()
    const blue = { hex: "4472C4", scheme: "accent1" } as const
    const tinted = iconMarkup([["path", { d: "M4.5 16.5c-1.5 1.26-2 5-2 5" }]], 250, blue.hex)
    expect(sources.src(image({ part: iconParts("rocket", 250, blue).svg, contentType: "image/svg+xml" }))).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`,
    )
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
