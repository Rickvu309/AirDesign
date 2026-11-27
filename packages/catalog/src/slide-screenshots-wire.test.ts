import { limits } from "@airdesign/doom"
import { expect, it } from "vitest"
import { screenshotBytes } from "./index.js"
import { readSlideScreenshots } from "./slide-screenshots-wire.js"

const key = "a".repeat(64)
const other = "b".repeat(64)
const data = "/9j/4AAQSkZJRgABAQ=="
const screenshots = {
  keys: [
    { slide: "s:256", key },
    { slide: "s:257", key: other },
  ],
  images: [{ slide: "s:256", key, type: "image/jpeg", data }],
}

it("reads the slide keys and the screenshots a tab reports", () => {
  expect(readSlideScreenshots(screenshots)).toEqual(screenshots)
  expect(readSlideScreenshots({ ...screenshots, images: [] })).toEqual({ ...screenshots, images: [] })
})

it("refuses screenshots it cannot trust", () => {
  const image = screenshots.images[0]
  for (const bad of [
    { keys: screenshots.keys },
    {
      ...screenshots,
      keys: [
        { slide: "s:256", key },
        { slide: "s:256", key: other },
      ],
    },
    { ...screenshots, keys: [{ slide: "s:256", key: "short" }] },
    { ...screenshots, keys: [{ slide: "not a slide", key }] },
    { ...screenshots, images: [{ ...image, key: other }] },
    { ...screenshots, images: [{ ...image, slide: "s:999" }] },
    { ...screenshots, images: [{ ...image, type: "image/png" }] },
    { ...screenshots, images: [{ ...image, data: "not base64!" }] },
    { ...screenshots, images: [{ ...image, data: "A".repeat(screenshotBytes + 4) }] },
    { ...screenshots, images: [image, image] },
    {
      ...screenshots,
      keys: Array.from({ length: limits.slides + 1 }, (_, at) => ({ slide: `s:${String(300 + at)}`, key })),
    },
    { ...screenshots, extra: true },
  ])
    expect(readSlideScreenshots(bad)).toBeUndefined()
})
