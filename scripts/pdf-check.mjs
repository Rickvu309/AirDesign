import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { PNG } from "pngjs"
import { differences, measure, parityFaults } from "../tests/browser/path-parity-score.ts"
import { pathParityCanvas, pathParityPdf, sampleDeckLines, sampleDeckPdf } from "./pdf-sample.mjs"

const poppler = (name, args) => execFileSync(name, args, { encoding: "latin1" })

export function infoOf(text) {
  const pages = Number(/^Pages:\s+(\d+)/m.exec(text)?.[1])
  const size = /^Page size:\s+([\d.]+) x ([\d.]+) pts/m.exec(text)
  return { pages, width: Number(size?.[1]), height: Number(size?.[2]) }
}

export function fontsOf(text) {
  return text
    .split("\n")
    .slice(2)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const columns = line.trim().split(/\s+/)
      return { name: columns[0], embedded: columns.at(-5) === "yes", unicode: columns.at(-3) === "yes" }
    })
}

export function inkReach(ppm) {
  const header = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(ppm.subarray(0, 64).toString("latin1"))
  if (header === null) throw new Error("pdftoppm did not write a P6 picture")
  const width = Number(header[1])
  const height = Number(header[2])
  const body = ppm.subarray(header[0].length)
  const row = Math.floor(height / 2)
  let reach = 0
  for (let x = 0; x < width; x += 1) {
    const at = (row * width + x) * 3
    if ((body[at] ?? 255) + (body[at + 1] ?? 255) + (body[at + 2] ?? 255) < 600) reach = x + 1
  }
  return reach / width
}

export function pdfFaults({ info, fonts, text, lines, reach }) {
  const faults = []
  if (info.pages !== lines.pages) faults.push(`${String(info.pages)} pages, expected ${String(lines.pages)}`)
  if (Math.abs(info.width / info.height - 16 / 9) > 0.001)
    faults.push(`page is ${String(info.width)} x ${String(info.height)} pt, not 16:9`)
  if (fonts.length === 0) faults.push("no fonts in the file, so its text is not text")
  for (const font of fonts) {
    if (!font.embedded) faults.push(`font ${font.name} is not embedded`)
    if (!font.unicode) faults.push(`font ${font.name} has no Unicode map, so its text cannot be copied`)
  }
  const flat = text.replace(/\s+/g, " ")
  for (const line of lines.lines) {
    if (line !== "" && !flat.includes(line.replace(/\s+/g, " ")))
      faults.push(`text "${line}" cannot be read from the file`)
  }
  if (reach < 0.99) faults.push(`slide 1 paints ${String(Math.round(reach * 100))}% of the page width`)
  return faults
}

export function pathParityPdfFaults(canvasFile, pdfFile, scratch) {
  const canvas = PNG.sync.read(fs.readFileSync(canvasFile))
  const raster = path.join(scratch, "path-parity")
  poppler("pdftoppm", [
    "-scale-to-x",
    String(canvas.width),
    "-scale-to-y",
    String(canvas.height),
    "-png",
    "-singlefile",
    pdfFile,
    raster,
  ])
  const printed = PNG.sync.read(fs.readFileSync(`${raster}.png`))
  const wanted = measure(canvas)
  return parityFaults("PDF", measure(printed), wanted, differences(printed, canvas))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.argv.includes("--no-export")) {
    for (const stale of [sampleDeckPdf, sampleDeckLines, pathParityPdf, pathParityCanvas])
      fs.rmSync(stale, { force: true })
    execFileSync(
      "pnpm",
      [
        "test:browser",
        "tests/browser/export-pdf.spec.ts",
        "tests/browser/path-parity.spec.ts",
        "--grep",
        "@pdf",
        "--workers=1",
      ],
      { stdio: "inherit" },
    )
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-check-"))
  poppler("pdftoppm", ["-r", "24", "-f", "1", "-l", "1", "-singlefile", sampleDeckPdf, path.join(scratch, "first")])
  const faults = pdfFaults({
    info: infoOf(poppler("pdfinfo", [sampleDeckPdf])),
    fonts: fontsOf(poppler("pdffonts", [sampleDeckPdf])),
    text: poppler("pdftotext", [sampleDeckPdf, "-"]),
    lines: JSON.parse(fs.readFileSync(sampleDeckLines, "utf8")),
    reach: inkReach(fs.readFileSync(path.join(scratch, "first.ppm"))),
  })
  faults.push(...pathParityPdfFaults(pathParityCanvas, pathParityPdf, scratch))
  fs.rmSync(scratch, { recursive: true, force: true })
  if (faults.length > 0) {
    console.error(["The PDF export is wrong:", ...faults.map((fault) => `- ${fault}`)].join("\n"))
    process.exit(1)
  }
  console.log(
    "The sample deck's PDF has every slide on a 16:9 page, embedded fonts and readable text, and the wedges, rings, polylines and dashes of the path scene paint as they do on the canvas.",
  )
}
