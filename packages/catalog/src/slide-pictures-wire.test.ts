import { limits } from "@airdesign/document"
import { expect, it } from "vitest"
import { deckRoutes, pictureBytes, readFindingsReport } from "./index.js"

const key = "a".repeat(64)
const other = "b".repeat(64)
const data = "/9j/4AAQSkZJRgABAQ=="
const report = { deck: "deck", revision: 4, findings: [] }
const pictures = {
  keys: [
    { slide: "256", key },
    { slide: "257", key: other },
  ],
  images: [{ slide: "256", key, type: "image/jpeg", data }],
}

it("reads the slide keys and the pictures a tab adds to its findings report", () => {
  expect(readFindingsReport({ ...report, pictures })).toEqual({ ok: true, ...report, pictures })
  expect(readFindingsReport({ ...report, pictures: { ...pictures, images: [] } })).toEqual({
    ok: true,
    ...report,
    pictures: { ...pictures, images: [] },
  })
  expect(readFindingsReport(report)).toEqual({ ok: true, ...report })
  expect(deckRoutes.findings.result({ ok: true, deck: "deck", missing: ["257"] })).toEqual({
    ok: true,
    deck: "deck",
    missing: ["257"],
  })
})

it("refuses pictures it cannot trust", () => {
  const image = pictures.images[0]
  for (const bad of [
    { keys: pictures.keys },
    {
      ...pictures,
      keys: [
        { slide: "256", key },
        { slide: "256", key: other },
      ],
    },
    { ...pictures, keys: [{ slide: "256", key: "short" }] },
    { ...pictures, keys: [{ slide: "not a slide", key }] },
    { ...pictures, images: [{ ...image, key: other }] },
    { ...pictures, images: [{ ...image, slide: "999" }] },
    { ...pictures, images: [{ ...image, type: "image/png" }] },
    { ...pictures, images: [{ ...image, data: "not base64!" }] },
    { ...pictures, images: [{ ...image, data: "A".repeat(pictureBytes + 4) }] },
    { ...pictures, images: [image, image] },
    { ...pictures, keys: Array.from({ length: limits.slides + 1 }, (_, at) => ({ slide: String(300 + at), key })) },
    { ...pictures, extra: true },
  ])
    expect(readFindingsReport({ ...report, pictures: bad })).toEqual({ ok: false, refusal: "field" })
})
