import fs from "node:fs/promises"
import path from "node:path"
import twins from "../packages/fonts/src/twins.json" with { type: "json" }
import { deckParts } from "./fidelity-refs.mjs"

const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")

export async function referenceSource({ origin, files, folder }) {
  const { fontRoutes } = await import("../packages/fonts/dist/index.js")
  const names = new Set()
  for (const file of files)
    for (const [name, bytes] of await deckParts(file)) {
      if (!name.endsWith(".xml")) continue
      for (const match of new TextDecoder().decode(bytes).matchAll(/\btypeface="([^"]+)"/g))
        if (!match[1].startsWith("+")) names.add(match[1].replaceAll("&amp;", "&"))
    }
  await fs.mkdir(folder, { recursive: true })
  let index = 0
  const missing = []
  for (const family of names) {
    const response = await fetch(new URL(`${fontRoutes.family.path}?family=${encodeURIComponent(family)}`, origin))
    if (response.status === 404) {
      missing.push(family)
      continue
    }
    if (!response.ok) throw new Error(`font source ${family}: ${response.status}`)
    const manifest = await response.json()
    for (const face of [...manifest.faces, { url: manifest.notice, file: "LICENSE.txt" }]) {
      const response = await fetch(new URL(face.url, origin))
      if (!response.ok) throw new Error(`font source ${family}: ${response.status}`)
      await fs.writeFile(
        path.join(folder, `${index++}-${path.basename(face.file)}`),
        Buffer.from(await response.arrayBuffer()),
      )
    }
  }
  const base = process.env.FONTCONFIG_FILE ?? "/etc/fonts/fonts.conf"
  const aliases = twins
    .map(
      ({ family, prefer }) =>
        `<alias binding="same"><family>${xml(family)}</family><prefer><family>${xml(prefer)}</family></prefer></alias>`,
    )
    .join("")
  const file = path.join(folder, "source.conf")
  await fs.writeFile(
    file,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${xml(folder)}</dir><include>${xml(base)}</include>${aliases}</fontconfig>`,
  )
  process.env.FONTCONFIG_FILE = file
  return { families: names.size, missing }
}
