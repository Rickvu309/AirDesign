import { fixtureKey, manifest, shelf, verifyFace } from "./fixture-faces.mjs"

let downloads = 0
for (const face of Object.values(manifest)) {
  const key = fixtureKey(face.source)
  if (!key) continue
  const cached = await shelf.read(key)
  if (cached !== undefined) {
    verifyFace(face, cached)
    continue
  }
  const response = await fetch(face.source, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Font fixture ${face.source}: HTTP ${response.status}`)
  const bytes = verifyFace(face, Buffer.from(await response.arrayBuffer()))
  await shelf.write(key, bytes)
  downloads++
}
console.log(`Font layout shelf ready: ${downloads} font downloads during setup`)
