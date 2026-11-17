import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { imageLink, publish } from "../.agents/skills/verify-airdesign/bin/publish.mjs"
import { readCorpus } from "./pptx-corpus.mjs"

const self = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(self), "..")
const usage = "node scripts/fidelity-refs.mjs pack <folder> | fetch"
const manifestFile = path.join(root, "scripts/pptx-fixtures/fidelity-refs.json")
const corpusFolder = path.join(root, "scripts/pptx-fixtures/corpus")
const release = "fidelity-refs"
const about = {
  title: "Fidelity references",
  notes:
    "Decks and the PDFs PowerPoint made of them, from NASA's Technical Reports Server. paint-fidelity scores our painted slides against them. Not a product release.",
}
const emuPerPixel = 9525
const thumbnailPart = "docProps/thumbnail.jpeg"

export const refsCache = path.join(os.homedir(), ".cache/airdesign/fidelity-refs")

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const madeByPowerPoint = (text) => /PowerPoint/.test(text)

export const pairRefusal = ({ name, slides, hidden, pages, creator, producer }) => {
  if (!madeByPowerPoint(`${creator} ${producer}`))
    return `${name}: its pdf was made by ${creator} / ${producer}, not PowerPoint`
  if (hidden > 0)
    return `${name} hides ${hidden} slide${hidden === 1 ? "" : "s"}, so its pages and slides do not line up`
  if (pages !== slides) return `${name} has ${slides} slides and its pdf ${pages} pages`
  return undefined
}

export const thumbnailRefusal = ({ name, application, thumbnail }) => {
  if (!thumbnail) return `${name} has no ${thumbnailPart}`
  if (!madeByPowerPoint(application)) return `${name} was saved by ${application}, not PowerPoint`
  return undefined
}

export const pdfFacts = (text) => {
  const field = (name) => text.match(new RegExp(`^${name}:\\s*(.*)$`, "m"))?.[1].trim() ?? ""
  return { creator: field("Creator"), producer: field("Producer"), pages: Number(field("Pages")) }
}

export const slidePixels = (presentation) => {
  const size = presentation.match(/<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/)
  if (size === null) throw new Error("presentation.xml has no slide size")
  return { width: Math.round(Number(size[1]) / emuPerPixel), height: Math.round(Number(size[2]) / emuPerPixel) }
}

export const jpegSize = (bytes) => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined
  let at = 2
  while (at + 8 < bytes.length) {
    if (bytes[at] !== 0xff) return undefined
    const marker = bytes[at + 1]
    const length = (bytes[at + 2] << 8) | bytes[at + 3]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return { width: (bytes[at + 7] << 8) | bytes[at + 8], height: (bytes[at + 5] << 8) | bytes[at + 6] }
    at += 2 + length
  }
  return undefined
}

export const staleThumbnails = (manifest, corpus) =>
  manifest.thumbnails.flatMap((entry) => {
    const listed = corpus.find((deck) => deck.name === entry.deck)
    if (listed === undefined)
      return [`${entry.deck} is not in corpus.json. Run node scripts/fidelity-refs.mjs pack again`]
    if (listed.sha256 !== entry.deckSha256)
      return [
        `${entry.deck}: corpus.json says ${listed.sha256} and fidelity-refs.json ${entry.deckSha256}. Run node scripts/fidelity-refs.mjs pack again`,
      ]
    return []
  })

export const fetchedFile = (entry, got) =>
  got === entry.sha256
    ? undefined
    : `${entry.asset} arrived with sha256 ${got} and fidelity-refs.json says ${entry.sha256}`

const loadPptx = async () => {
  const entry = path.join(root, "packages/pptx/dist/index.js")
  if (!fs.existsSync(entry)) throw new Error("packages/pptx is not built. Run pnpm build, then run this again.")
  return import(pathToFileURL(entry).href)
}

const text = (parts, name) => new TextDecoder().decode(parts.get(name) ?? new Uint8Array())

export const deckParts = async (file) => (await loadPptx()).readParts(new Uint8Array(fs.readFileSync(file)))

export const deckFacts = (parts) => {
  const slides = [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  return {
    slides: (text(parts, "ppt/presentation.xml").match(/<p:sldId\b/g) ?? []).length,
    hidden: slides.filter((name) => /<p:sld\b[^>]*\bshow="0"/.test(text(parts, name))).length,
    size: slidePixels(text(parts, "ppt/presentation.xml")),
    application: text(parts, "docProps/app.xml").match(/<Application>([^<]*)<\/Application>/)?.[1] ?? "",
    thumbnail: parts.get(thumbnailPart),
  }
}

export const thumbnailOf = (parts) => parts.get(thumbnailPart)

const run = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1 << 24 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || stdout || `${command} failed`).trim()))
      else resolve(stdout)
    })
  })

export const readManifest = () => JSON.parse(fs.readFileSync(manifestFile, "utf8"))

const packedDeck = async (folder, source) => {
  const pptxFile = path.join(folder, source.name)
  const pdfFile = pptxFile.replace(/\.pptx$/, ".pdf")
  const facts = deckFacts(await deckParts(pptxFile))
  const pdf = pdfFacts(await run("pdfinfo", [pdfFile]))
  const refusal = pairRefusal({ name: source.name, ...facts, ...pdf })
  return {
    refusal,
    files: [pptxFile, pdfFile],
    deck: {
      name: source.name,
      citation: source.citation,
      rights: source.rights,
      slides: facts.slides,
      width: facts.size.width,
      height: facts.size.height,
      creator: pdf.creator,
      producer: pdf.producer,
      pptx: { source: source.pptx, sha256: sha256(fs.readFileSync(pptxFile)) },
      pdf: { source: source.pdf, sha256: sha256(fs.readFileSync(pdfFile)), pages: pdf.pages },
    },
  }
}

const packedThumbnails = async () => {
  const kept = []
  const left = []
  for (const listed of readCorpus(root)) {
    const facts = deckFacts(await deckParts(path.join(corpusFolder, listed.name)))
    const refusal = thumbnailRefusal({
      name: listed.name,
      application: facts.application,
      thumbnail: facts.thumbnail !== undefined,
    })
    if (refusal !== undefined) left.push(refusal)
    else
      kept.push({
        deck: listed.name,
        deckSha256: listed.sha256,
        application: facts.application,
        sha256: sha256(facts.thumbnail),
        ...jpegSize(facts.thumbnail),
      })
  }
  return { kept, left }
}

const pack = async (folder) => {
  const sources = JSON.parse(fs.readFileSync(path.join(folder, "sources.json"), "utf8"))
  const packed = await Promise.all(sources.map((source) => packedDeck(folder, source)))
  const refused = packed.flatMap((entry) => (entry.refusal === undefined ? [] : [entry.refusal]))
  if (refused.length > 0) throw new Error(`fidelity-refs refused:\n${refused.join("\n")}`)
  const published = publish({
    files: packed.flatMap((entry) => entry.files),
    prefix: "fidelity",
    release,
    kinds: [".pptx", ".pdf"],
    about,
  })
  const placed = (file) => published.placed[path.basename(file)]
  const thumbnails = await packedThumbnails()
  const manifest = {
    release,
    repository: published.repository,
    decks: packed.map((entry) => ({
      ...entry.deck,
      pptx: { ...entry.deck.pptx, asset: placed(entry.files[0]) },
      pdf: { ...entry.deck.pdf, asset: placed(entry.files[1]) },
    })),
    thumbnails: thumbnails.kept,
  }
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  for (const line of thumbnails.left) console.log(`fidelity-refs left out a thumbnail: ${line}`)
  console.log(
    `fidelity-refs wrote ${path.relative(root, manifestFile)}: ${manifest.decks.length} decks, ${manifest.thumbnails.length} thumbnails`,
  )
}

const fetchedAsset = async (manifest, entry) => {
  const file = path.join(refsCache, entry.asset)
  if (fs.existsSync(file) && sha256(fs.readFileSync(file)) === entry.sha256) return file
  const answer = await fetch(imageLink(manifest.repository, entry.asset, manifest.release))
  if (!answer.ok) throw new Error(`${entry.asset} did not download: ${answer.status}`)
  const bytes = new Uint8Array(await answer.arrayBuffer())
  const refusal = fetchedFile(entry, sha256(bytes))
  if (refusal !== undefined) throw new Error(refusal)
  fs.mkdirSync(refsCache, { recursive: true })
  fs.writeFileSync(`${file}.${process.pid}`, bytes)
  fs.renameSync(`${file}.${process.pid}`, file)
  return file
}

export const fetchRefs = async () => {
  const manifest = readManifest()
  const stale = staleThumbnails(manifest, readCorpus(root))
  if (stale.length > 0) throw new Error(`fidelity-refs.json is stale:\n${stale.join("\n")}`)
  const decks = []
  for (const deck of manifest.decks)
    decks.push({
      ...deck,
      pptxFile: await fetchedAsset(manifest, deck.pptx),
      pdfFile: await fetchedAsset(manifest, deck.pdf),
    })
  return { decks, thumbnails: manifest.thumbnails }
}

const main = async () => {
  const [command, folder] = process.argv.slice(2)
  if (command === "pack" && folder !== undefined) return pack(path.resolve(folder))
  if (command === "fetch") {
    const { decks } = await fetchRefs()
    for (const deck of decks) console.log(`fidelity-refs ${deck.name}: ${deck.pptxFile} ${deck.pdfFile}`)
    return undefined
  }
  throw new Error(`Usage: ${usage}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
