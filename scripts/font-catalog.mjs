import fs from "node:fs/promises"

const revision = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(revision ?? "")) throw new Error("Pass a google/fonts commit")
const json = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  return response.json()
}
const tree = await json(`https://api.github.com/repos/google/fonts/git/trees/${revision}?recursive=1`)
if (tree.truncated) throw new Error("Truncated font tree")
const metadata = await json("https://fonts.google.com/metadata/fonts")
const paths = new Set(tree.tree.map((entry) => entry.path))
const folders = new Map(
  tree.tree.flatMap(({ path }) => {
    const match = /^(ofl|apache|ufl)\/([^/]+)\/METADATA.pb$/.exec(path)
    return match ? [[match[2], `${match[1]}/${match[2]}`]] : []
  }),
)
const families = metadata.familyMetadataList.flatMap((entry) => {
  if (!entry.isOpenSource) return []
  const folder = folders.get(entry.family.toLowerCase().replace(/[^a-z0-9]/g, ""))
  if (!folder) return []
  const license = folder.startsWith("ofl/") ? "OFL" : folder.startsWith("apache/") ? "APACHE2" : "UFL"
  const notice = license === "OFL" ? "OFL.txt" : license === "APACHE2" ? "LICENSE.txt" : "UFL.txt"
  if (!paths.has(`${folder}/${notice}`)) {
    if (entry.family === "Tinos")
      return [{ family: entry.family, category: entry.category, folder, license, notice: "Tinos-LICENSE.txt" }]
    return []
  }
  return [{ family: entry.family, category: entry.category, folder, license, notice }]
})
families.sort((a, b) => a.family.localeCompare(b.family, "en"))
await fs.writeFile(
  new URL("../packages/fonts/src/catalog.json", import.meta.url),
  JSON.stringify({ revision, families }, null, 2) + "\n",
)
console.log(`${families.length} redistributable families at ${revision}`)
