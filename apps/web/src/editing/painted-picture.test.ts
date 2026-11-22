import { expect, it } from "vitest"
import { neededFaces } from "./painted-picture"

const face = (family: string, weight: string, style: string, url: string) => ({ family, weight, style, url })

it("inlines only the faces the painted words use, once each, including a quoted family with one weight that shares the file", () => {
  const faces = [
    face("Inter", "100 900", "normal", "/inter"),
    face("Inter", "100 900", "normal", "/inter"),
    face("Inter", "100 900", "italic", "/inter-italic"),
    face('"Inter SemiBold"', "600", "normal", "/inter"),
    face('"Inter SemiBold"', "600", "italic", "/inter-italic"),
    face("Lora", "400", "normal", "/lora"),
  ]
  const used = {
    families: new Set(["Inter", "Inter SemiBold"]),
    looks: new Set(["Inter|400|normal", "Inter SemiBold|400|normal"]),
  }
  expect(neededFaces(faces, used).map(({ family, url }) => `${family} ${url}`)).toEqual([
    "Inter /inter",
    '"Inter SemiBold" /inter',
    '"Inter SemiBold" /inter-italic',
  ])
})
