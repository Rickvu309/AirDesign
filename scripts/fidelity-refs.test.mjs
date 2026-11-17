import {
  fetchedFile,
  jpegSize,
  pairRefusal,
  pdfFacts,
  slidePixels,
  staleThumbnails,
  thumbnailRefusal,
} from "./fidelity-refs.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`fail ${name}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`)
    process.exit(1)
  }
}

const pair = {
  name: "nasa-ppap-tutorial.pptx",
  slides: 15,
  hidden: 0,
  pages: 15,
  creator: "Acrobat PDFMaker 20 for PowerPoint",
  producer: "Adobe PDF Library 20.5.3",
}
same("a PowerPoint pdf with a page per slide is kept", pairRefusal(pair), undefined)
same(
  "a pdf missing one slide is refused with the deck named",
  pairRefusal({ ...pair, pages: 14 }),
  "nasa-ppap-tutorial.pptx has 15 slides and its pdf 14 pages",
)
same(
  "a pdf no PowerPoint made is refused",
  pairRefusal({ ...pair, creator: "Writer", producer: "LibreOffice 24.2" }),
  "nasa-ppap-tutorial.pptx: its pdf was made by Writer / LibreOffice 24.2, not PowerPoint",
)
same(
  "a deck with a hidden slide is refused, since the pdf leaves it out",
  pairRefusal({ ...pair, hidden: 1 }),
  "nasa-ppap-tutorial.pptx hides 1 slide, so its pages and slides do not line up",
)

same(
  "pdfinfo's lines give the creator, producer and pages",
  pdfFacts(
    "Creator:         Microsoft® PowerPoint® 2016\nProducer:        Microsoft® PowerPoint® 2016\nPages:           30\n",
  ),
  { creator: "Microsoft® PowerPoint® 2016", producer: "Microsoft® PowerPoint® 2016", pages: 30 },
)
same("a pdf without a creator gives empty names", pdfFacts("Pages: 3\n"), { creator: "", producer: "", pages: 3 })

same(
  "a 16:9 slide is 1280 by 720 pixels",
  slidePixels('<p:presentation><p:sldSz cx="12192000" cy="6858000"/></p:presentation>'),
  { width: 1280, height: 720 },
)
same("a 10 inch slide is 960 by 540 pixels", slidePixels('<p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>'), {
  width: 960,
  height: 540,
})

const frame = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x90, 0x01, 0x00,
])
same("a jpeg's frame header gives its size", jpegSize(frame), { width: 256, height: 144 })
same("bytes that are no jpeg give no size", jpegSize(Uint8Array.from([0x89, 0x50])), undefined)

const office = { name: "a.pptx", application: "Microsoft Office PowerPoint", thumbnail: true }
same("a thumbnail PowerPoint wrote is kept", thumbnailRefusal(office), undefined)
same(
  "a Mac PowerPoint thumbnail is kept",
  thumbnailRefusal({ ...office, application: "Microsoft Macintosh PowerPoint" }),
  undefined,
)
same(
  "a deck with no thumbnail is left out",
  thumbnailRefusal({ ...office, thumbnail: false }),
  "a.pptx has no docProps/thumbnail.jpeg",
)
same(
  "a thumbnail another program wrote is left out",
  thumbnailRefusal({ ...office, application: "LibreOffice/24.2" }),
  "a.pptx was saved by LibreOffice/24.2, not PowerPoint",
)

const manifest = {
  thumbnails: [
    { deck: "a.pptx", deckSha256: "aaa", sha256: "t1", width: 256, height: 144 },
    { deck: "b.pptx", deckSha256: "bbb", sha256: "t2", width: 256, height: 144 },
  ],
}
same(
  "a manifest whose deck sha256 differs from corpus.json marks that deck stale",
  staleThumbnails(manifest, [
    { name: "a.pptx", sha256: "aaa" },
    { name: "b.pptx", sha256: "ccc" },
  ]),
  ["b.pptx: corpus.json says ccc and fidelity-refs.json bbb. Run node scripts/fidelity-refs.mjs pack again"],
)
same("a deck gone from corpus.json is stale", staleThumbnails(manifest, [{ name: "a.pptx", sha256: "aaa" }]), [
  "b.pptx is not in corpus.json. Run node scripts/fidelity-refs.mjs pack again",
])

same(
  "a download whose sha256 differs from the manifest is refused",
  fetchedFile({ asset: "x.pdf", sha256: "abc" }, "def"),
  "x.pdf arrived with sha256 def and fidelity-refs.json says abc",
)
same("a download with the manifest's sha256 is kept", fetchedFile({ asset: "x.pdf", sha256: "abc" }, "abc"), undefined)

console.log("fidelity-refs tests passed")
