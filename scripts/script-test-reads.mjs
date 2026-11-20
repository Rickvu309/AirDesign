import fs from "node:fs"
import path from "node:path"

const piece = String.raw`[\w@.-]+(?:\/[\w@.-]+)*\/?`
const quote = "[\"'`]"
const single = new RegExp(`${quote}((?:\\.{1,2}\\/)*${piece})${quote}`, "g")
const joined = new RegExp(`(?:${quote}${piece}${quote}\\s*,\\s*)+${quote}${piece}${quote}`, "g")
const scriptTest = /^scripts\/[^/]+\.test\.mjs$/
const importedScript = /^scripts\/[^/]+\.mjs$/
const testOrSpec = /\.(test|spec)\.[a-z]+$/
const withExtension = /\.[a-z]+$/i
const insidePackage = /^(apps|packages)\//

const folders = (files) => {
  const found = new Set()
  for (const file of files)
    for (let folder = path.posix.dirname(file); folder !== "."; folder = path.posix.dirname(folder)) found.add(folder)
  return found
}

const relative = /^\.{1,2}\//

const placesOf = (name, from) => {
  const normal = path.posix.normalize(name)
  return relative.test(name)
    ? [normal, path.posix.normalize(path.posix.join(path.posix.dirname(from), name))]
    : [normal]
}

const linksFor = (name, from, tracked, inFolder) =>
  placesOf(name, from).flatMap((place) => {
    if (testOrSpec.test(place) || (relative.test(name) && importedScript.test(place))) return []
    if (tracked.has(place)) return [place]
    const folder = place.replace(/\/$/, "")
    if (inFolder.has(folder) && folder.includes("/") && !insidePackage.test(folder)) return [`${folder}/`]
    return withExtension.test(place) && !relative.test(name) ? [place] : []
  })

const readsAFile =
  /\b(?:readFileSync|readFile|readdirSync|readdir|statSync|lstatSync|existsSync|globSync|createReadStream|read|readText|readJson|readRule|import|join|resolve|URL|pathToFileURL|fileURLToPath)\s*\(/
const linesBefore = 3

const namesIn = (text) => {
  const lines = text.split("\n")
  const offsets = lines.reduce((starts, line) => [...starts, starts.at(-1) + line.length + 1], [0])
  const lineOf = (at) => offsets.findLastIndex((start) => start <= at)
  const usedInARead = (at) => {
    const name = /(?:const|let|var)\s+(\w+)\s*=\s*$/.exec(text.slice(Math.max(0, at - 80), at))?.[1]
    return (
      name !== undefined &&
      lines.some(
        (line, number) => number !== lineOf(at) && readsAFile.test(line) && new RegExp(`\\b${name}\\b`).test(line),
      )
    )
  }
  const nearARead = (at) =>
    readsAFile.test(lines.slice(Math.max(0, lineOf(at) - linesBefore), lineOf(at) + 1).join("\n")) || usedInARead(at)
  const names = [...text.matchAll(single)].filter((match) => nearARead(match.index)).map((match) => match[1])
  for (const run of text.matchAll(joined)) {
    if (!nearARead(run.index)) continue
    const parts = [...run[0].matchAll(single)].map((match) => match[1])
    for (let start = 0; start < parts.length - 1; start++) names.push(parts.slice(start).join("/"))
  }
  return names
}

export const scriptTestReads = (root, files) => {
  const tracked = new Set(files)
  const inFolder = folders(files)
  return Object.fromEntries(
    files
      .filter((file) => scriptTest.test(file))
      .map((test) => {
        const names = namesIn(fs.readFileSync(path.join(root, test), "utf8"))
        const links = names.flatMap((name) => linksFor(name, test, tracked, inFolder)).filter((link) => link !== test)
        return [test, [...new Set(links)].sort()]
      }),
  )
}

export const readersOf = (reads, file) =>
  Object.entries(reads)
    .filter(([, links]) => links.some((link) => link === file || (link.endsWith("/") && file.startsWith(link))))
    .map(([test]) => test)
    .sort()
