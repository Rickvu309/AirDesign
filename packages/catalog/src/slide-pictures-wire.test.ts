import { limits } from "@airdesign/doom"
import { expect, it } from "vitest"
import { pictureBytes } from "./index.js"
import { readSlidePictures } from "./slide-pictures-wire.js"

const key = "a".repeat(64)
const other = "b".repeat(64)
const data = "/9j/4AAQSkZJRgABAQ=="
const pictures = {
  keys: [
    { slide: "s:256", key },
    { slide: "s:257", key: other },
  ],
  images: [{ slide: "s:256", key, type: "image/jpeg", data }],
}

it("reads the slide keys and the pictures a tab reports", () => {
  expect(readSlidePictures(pictures)).toEqual(pictures)
  expect(readSlidePictures({ ...pictures, images: [] })).toEqual({ ...pictures, images: [] })
})

it("refuses pictures it cannot trust", () => {
  const image = pictures.images[0]
  for (const bad of [
    { keys: pictures.keys },
    {
      ...pictures,
      keys: [
        { slide: "s:256", key },
        { slide: "s:256", key: other },
      ],
    },
    { ...pictures, keys: [{ slide: "s:256", key: "short" }] },
    { ...pictures, keys: [{ slide: "not a slide", key }] },
    { ...pictures, images: [{ ...image, key: other }] },
    { ...pictures, images: [{ ...image, slide: "s:999" }] },
    { ...pictures, images: [{ ...image, type: "image/png" }] },
    { ...pictures, images: [{ ...image, data: "not base64!" }] },
    { ...pictures, images: [{ ...image, data: "A".repeat(pictureBytes + 4) }] },
    { ...pictures, images: [image, image] },
    {
      ...pictures,
      keys: Array.from({ length: limits.slides + 1 }, (_, at) => ({ slide: `s:${String(300 + at)}`, key })),
    },
    { ...pictures, extra: true },
  ])
    expect(readSlidePictures(bad)).toBeUndefined()
})
