import { expect, it } from "vitest"
import { neededFaces, usedFaces } from "./painted-picture"

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

it("embeds every served family in a painted run's fallback stack", async () => {
  const module = "jsdom"
  const { JSDOM } = (await import(module)) as { JSDOM: new () => { window: Window } }
  const { document } = new JSDOM().window
  const root = document.createElement("div")
  root.style.fontFamily = '"Narrow", "Geist", sans-serif'
  root.style.fontWeight = "400"
  root.style.fontStyle = "normal"
  root.textContent = "Doanh thu quý 3"
  document.body.append(root)
  const used = usedFaces(root, new Set(["Narrow", "Geist"]))
  expect([...used.looks]).toEqual(["Narrow|400|normal", "Geist|400|normal"])
})
