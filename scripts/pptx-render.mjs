import { execFile } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const renderCacheFolder = path.join(os.homedir(), ".cache", "airdesign", "pptx-renders")
export const againSuffix = " again"

export const renderSettings = {
  soffice: [
    "-env:UserInstallation=file://{profile}",
    "--headless",
    "--norestore",
    "--convert-to",
    "pdf",
    "--outdir",
    "{out}",
    "{deck}",
  ],
  pdftoppm: ["-png", "-r", "150", "{pdf}", "{page}"],
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const fill = (args, places) => args.map((arg) => arg.replace(/\{(\w+)\}/g, (_, name) => places[name]))

export const renderCode = () => sha256(fs.readFileSync(fileURLToPath(import.meta.url)))

export const renderPages = async (file, { soffice, pdftoppm, run, settings = renderSettings }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-page-"))
  try {
    const out = path.join(dir, "out")
    fs.mkdirSync(out)
    await run(soffice, fill(settings.soffice, { profile: path.join(dir, "profile"), out, deck: file }))
    const pdf = fs.readdirSync(out).find((name) => name.endsWith(".pdf"))
    if (pdf === undefined) throw new Error(file)
    await run(pdftoppm, fill(settings.pdftoppm, { pdf: path.join(out, pdf), page: path.join(dir, "page") }))
    return fs
      .readdirSync(dir)
      .filter((name) => /^page-\d+\.png$/.test(name))
      .sort((left, right) => Number(/\d+/.exec(left)?.[0]) - Number(/\d+/.exec(right)?.[0]))
      .map((name) => sha256(fs.readFileSync(path.join(dir, name))))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export const toolVersion = (output) =>
  output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /(LibreOffice|version)\s+\d+\.\d+/i.test(line)) ?? null

const commandOutput = (command, args) =>
  new Promise((resolve) => {
    execFile(command, args, { timeout: 60_000, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) =>
      resolve({ ok: error === null, stdout: stdout ?? "", stderr: stderr ?? "" }),
    )
  })

const fileStamp = (file) => {
  try {
    const stat = fs.statSync(file)
    return `${stat.size}|${stat.mtimeMs}`
  } catch {
    return "unread"
  }
}

export const fontFingerprint = (listing, stamp = fileStamp) => {
  const lines = listing
    .split("\n")
    .filter((line) => line.includes("|"))
    .map((line) => `${line}|${stamp(line.split("|")[0])}`)
    .sort()
  return lines.length === 0 ? null : sha256(lines.join("\n"))
}

const localeName = /^(LANG|LANGUAGE|LC_[A-Z_]+|SAL_\w+|FONTCONFIG_\w+)$/

export const renderLocale = (env) =>
  Object.fromEntries(
    Object.keys(env)
      .filter((name) => localeName.test(name))
      .sort()
      .map((name) => [name, env[name]]),
  )

export const readMachine = async ({ soffice, pdftoppm, env }) => {
  const [office, poppler, fonts] = await Promise.all([
    commandOutput(soffice, ["--version"]),
    commandOutput(pdftoppm, ["-v"]),
    commandOutput("fc-list", ["--format", "%{file}|%{family}|%{style}\\n"]),
  ])
  return {
    soffice: toolVersion(`${office.stdout}\n${office.stderr}`),
    pdftoppm: toolVersion(`${poppler.stdout}\n${poppler.stderr}`),
    fonts: fonts.ok ? fontFingerprint(fonts.stdout) : null,
    locale: renderLocale(env),
  }
}

export const renderKey = ({ deck, machine, settings, code }) =>
  sha256(
    JSON.stringify({
      deck: sha256(deck),
      soffice: machine.soffice,
      pdftoppm: machine.pdftoppm,
      fonts: machine.fonts,
      locale: machine.locale,
      settings,
      code,
    }),
  )

export const gitBlobId = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")

export const committedBlobs = (listing) =>
  new Map(
    listing
      .split("\n")
      .filter((line) => line.includes("\t"))
      .map((line) => {
        const [meta, file] = line.split("\t")
        return [path.basename(file), meta.split(" ")[2]]
      }),
  )

export const renderName = (render) => (render.endsWith(againSuffix) ? render.slice(0, -againSuffix.length) : render)

export const renderUse = ({ render, bytes, committed }) => {
  if (render.endsWith(againSuffix)) return "fresh"
  return committed.get(renderName(render)) === gitBlobId(bytes) ? "cached" : "fresh"
}

const pageHash = /^[0-9a-f]{64}$/

const parsedEntry = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

export const readRender = (folder, key) => {
  const entry = parsedEntry(path.join(folder, `${key}.json`))
  const hashes = entry?.key === key ? entry.hashes : undefined
  const valid =
    Array.isArray(hashes) &&
    hashes.length > 0 &&
    hashes.every((hash) => typeof hash === "string" && pageHash.test(hash))
  return valid ? hashes : null
}

export const writeRender = (folder, key, hashes) => {
  fs.mkdirSync(folder, { recursive: true })
  const temporary = path.join(folder, `${key}.${process.pid}.${randomBytes(6).toString("hex")}.json`)
  fs.writeFileSync(temporary, JSON.stringify({ key, hashes }))
  fs.renameSync(temporary, path.join(folder, `${key}.json`))
}

export const renderCache = ({ folder, machine, settings, code, render }) => {
  const tally = { hits: 0, misses: 0, uncached: 0, seconds: 0 }
  const missing = [
    machine.soffice === null ? "LibreOffice version" : null,
    machine.pdftoppm === null ? "pdftoppm version" : null,
    machine.fonts === null ? "font list" : null,
  ].filter(Boolean)
  const timed = async (file) => {
    const started = performance.now()
    try {
      return await render(file)
    } finally {
      tally.seconds += (performance.now() - started) / 1000
    }
  }
  const pages = async ({ file, bytes, use }) => {
    if (missing.length > 0 || use !== "cached") {
      tally.uncached += 1
      return timed(file)
    }
    const key = renderKey({ deck: bytes, machine, settings, code })
    const stored = readRender(folder, key)
    if (stored !== null) {
      tally.hits += 1
      return stored
    }
    tally.misses += 1
    const hashes = await timed(file)
    if (hashes.length > 0) writeRender(folder, key, hashes)
    return hashes
  }
  const line = () => {
    const state =
      missing.length > 0
        ? `render cache off, no ${missing.join(" or ")}`
        : `render cache ${tally.hits} hits, ${tally.misses} misses`
    return `${state}, ${tally.uncached} uncached, rendering ${tally.seconds.toFixed(1)} seconds`
  }
  return { pages, line, tally }
}
