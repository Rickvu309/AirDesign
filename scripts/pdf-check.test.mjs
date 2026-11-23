import { fontsOf, infoOf, inkReach, pdfFaults } from "./pdf-check.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const info = infoOf("Title:           Annual strategy review\nPages:           7\nPage size:       960 x 540 pts\n")
const fonts = fontsOf(
  [
    "name                                 type              encoding         emb sub uni object ID",
    "------------------------------------ ----------------- ---------------- --- --- --- ---------",
    "AAAAAA+Inter-Regular                 Type 3            Custom           yes yes yes     10  0",
    "BAAAAA+Inter-Bold                    CID TrueType      Identity-H       yes yes yes     11  0",
  ].join("\n"),
)
const lines = { pages: 7, lines: ["Annual strategy review 2026", "Revenue grew 12% while gross margin"] }
const text = "Annual strategy review 2026\n\nRevenue grew 12% while gross\nmargin held at 31%"

function picture(width, height, painted) {
  const head = Buffer.from(`P6\n${String(width)} ${String(height)}\n255\n`, "latin1")
  const body = Buffer.alloc(width * height * 3, 255)
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < painted; x += 1) body.fill(20, (y * width + x) * 3, (y * width + x) * 3 + 3)
  return Buffer.concat([head, body])
}

same("reads pdfinfo as poppler prints it", info, { pages: 7, width: 960, height: 540 })
same("reads pdffonts as poppler prints it", fonts, [
  { name: "AAAAAA+Inter-Regular", embedded: true, unicode: true },
  { name: "BAAAAA+Inter-Bold", embedded: true, unicode: true },
])

same(
  "passes a file with every page, a 16:9 page, embedded fonts, readable text and a full-width slide",
  pdfFaults({ info, fonts, text, lines, reach: inkReach(picture(320, 180, 320)) }),
  [],
)

same(
  "names each way the file can be wrong",
  pdfFaults({
    info: { pages: 6, width: 960, height: 720 },
    fonts: [{ name: "Inter", embedded: false, unicode: false }],
    text: "Annual strategy review 2026",
    lines,
    reach: inkReach(picture(320, 180, 245)),
  }),
  [
    "6 pages, expected 7",
    "page is 960 x 720 pt, not 16:9",
    "font Inter is not embedded",
    "font Inter has no Unicode map, so its text cannot be copied",
    'text "Revenue grew 12% while gross margin" cannot be read from the file',
    "slide 1 paints 77% of the page width",
  ],
)

same("names a file with no fonts", pdfFaults({ info, fonts: [], text, lines, reach: 1 }), [
  "no fonts in the file, so its text is not text",
])
