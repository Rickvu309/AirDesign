import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"
import {
  chosenSlides,
  colorDifference,
  compareSlides,
  compareSmall,
  fidelityFailure,
  fidelityLines,
  matchBar,
  paintSize,
  reported,
  scaleDown,
} from "./paint-fidelity.mjs"

const same = (name, actual, expected) => {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  if (left !== right) {
    console.error(`fail ${name}: got ${left}, wanted ${right}`)
    process.exit(1)
  }
}

const filled = (width, height, paint) => {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set([...paint(x, y), 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

const white = [255, 255, 255]
const black = [0, 0, 0]
const blank = filled(640, 360, () => white)

same(
  "a two by one image averages to one pixel",
  [
    ...scaleDown(
      filled(2, 1, (x) => (x === 0 ? [0, 100, 200] : [100, 200, 250])),
      { width: 1, height: 1 },
    ),
  ],
  [50, 150, 225],
)
same(
  "an image smaller than the size repeats its pixels",
  [
    ...scaleDown(
      filled(1, 1, () => [9, 8, 7]),
      { width: 2, height: 1 },
    ),
  ],
  [9, 8, 7, 9, 8, 7],
)
same("a scaled image has the fixed size", scaleDown(blank).length, paintSize.width * paintSize.height * 3)
same("the difference is the mean over every channel", colorDifference([0, 0, 10, 20], [10, 10, 10, 20]), 5)
same("a slide compared with itself matches", compareSlides(blank, blank), { difference: 0, match: true })
same("a difference at the bar does not match", compareSmall([0], [matchBar]).match, false)
same("a difference under the bar matches", compareSmall([0], [matchBar - 1]).match, true)

const lettering = (offset) => filled(640, 360, (x, y) => (y % 20 < 2 && (x + offset) % 4 === 0 ? black : white))
same("the same lettering drawn a pixel apart matches", compareSlides(lettering(0), lettering(1)).match, true)
same(
  "a dark slide against a white paint does not match",
  compareSlides(
    filled(640, 360, () => black),
    blank,
  ).match,
  false,
)
same(
  "a half colored slide against a white paint does not match",
  compareSlides(
    filled(640, 360, (x) => (x < 320 ? [40, 60, 120] : white)),
    blank,
  ).match,
  false,
)

const fixture = (name) =>
  PNG.sync.read(
    fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "paint-fidelity-fixtures", name)),
  )
const render = fixture("render.png")
const stacked = fixture("stacked-paint.png")
const moved = (image, by) => {
  const data = new Uint8Array(image.data.length).fill(255)
  for (let y = by; y < image.height; y += 1) {
    const from = (y - by) * image.width * 4
    data.set(image.data.subarray(from, from + (image.width - by) * 4), (y * image.width + by) * 4)
  }
  return { width: image.width, height: image.height, data }
}

same("a real render compared with itself matches", compareSlides(render, render), { difference: 0, match: true })
same("a real render against the stacked paint does not match", compareSlides(render, stacked).match, false)
same(
  "a real render moved by half a percent matches",
  compareSlides(render, moved(render, Math.round(render.width * 0.005))).match,
  true,
)
same(
  "a real render against a blank white slide does not match",
  compareSlides(
    render,
    filled(render.width, render.height, () => white),
  ).match,
  false,
)

same("a short deck compares every slide", chosenSlides(3, 12), [1, 2, 3])
same("a long deck spreads the cap across it", chosenSlides(24, 4), [1, 7, 13, 19])
same("an empty deck compares nothing", chosenSlides(0, 12), [])

same(
  "the lines give the count, the cap and the worst slides",
  fidelityLines({
    rows: [
      { deck: "a.pptx", slide: 1, difference: 2, match: true },
      { deck: "a.pptx", slide: 2, difference: 40, match: false },
      { deck: "b.pptx", slide: 1, difference: 90.25, match: false },
    ],
    skipped: [{ deck: "c.pptx", reason: "no painted slide on the page" }],
    decks: 3,
    goal: 190,
    cap: 12,
    bar: 10,
    worst: 2,
  }),
  [
    "metric paint-fidelity  now 1  goal 190  3 slides compared, at most 12 per deck, 2 of 3 decks, bar 10 of 255",
    "paint-fidelity worst b.pptx slide 1 difference 90.3",
    "paint-fidelity worst a.pptx slide 2 difference 40.0",
    "paint-fidelity skipped c.pptx: no painted slide on the page",
  ],
)
same(
  "no measured slide still prints the metric",
  fidelityLines({ rows: [], skipped: [], decks: 18, goal: 190, cap: 12, bar: 10 }),
  ["metric paint-fidelity  now 0  goal 190  0 slides compared, at most 12 per deck, 0 of 18 decks, bar 10 of 255"],
)

const row = { deck: "a.pptx", slide: 1, difference: 2, match: true }
const judged = { rows: [row], skipped: [], outcome: "finished", now: 1 }
same(
  "no measured deck fails the run",
  fidelityFailure({ ...judged, rows: [], now: 0 }),
  "paint-fidelity judged 0 decks, so its count says nothing. Read the lines above for why.",
)
same(
  "a run that crashed fails, even with some slides compared",
  fidelityFailure({ ...judged, outcome: "failed" }),
  "paint-fidelity crashed before it finished, so its count is not the corpus. Read the lines above for why.",
)
same("a finished run that compared slides passes", fidelityFailure(judged), undefined)
same(
  "a run stopped at its limit fails",
  fidelityFailure({ ...judged, outcome: "stopped" }),
  "paint-fidelity stopped at its limit, so its count is not the corpus. Read the lines above for why.",
)
same(
  "a skipped deck fails the run and is named",
  fidelityFailure({ ...judged, skipped: [{ deck: "c.pptx", reason: "no painted slide on the page" }] }),
  "paint-fidelity skipped c.pptx, so its count is not the corpus. Read the lines above for why.",
)
same(
  "a count below the recorded one fails and names both numbers",
  fidelityFailure({ ...judged, rows: [row, { ...row, slide: 2, match: false }], now: 2 }),
  "paint-fidelity is 1 and metrics.json says 2. A change painted a slide further from its reference render; find it in the worst lines above.",
)
same("a count above the recorded one passes", fidelityFailure({ ...judged, now: 0 }), undefined)
same(
  "a count above the recorded one prints the record",
  fidelityLines({ rows: [row], skipped: [], decks: 1, goal: 190, now: 0, cap: 12, bar: 10, worst: 0 }),
  [
    "metric paint-fidelity  now 1  goal 190  1 slides compared, at most 12 per deck, 1 of 1 decks, bar 10 of 255",
    "paint-fidelity record 1. Record now 1 in metrics.json.",
  ],
)
same(
  "the recorded count prints no record",
  fidelityLines({ rows: [row], skipped: [], decks: 1, goal: 190, now: 1, cap: 12, bar: 10, worst: 0 }).length,
  1,
)

const said = []
const say = (line) => said.push(line)
same(
  "a crash is told",
  await reported({
    limit: 1000,
    say,
    work: async () => {
      throw new Error("no browser")
    },
  }),
  "failed",
)
same("a crash is printed and does not throw", said, ["paint-fidelity not finished: no browser"])
said.length = 0
same("a timeout is told", await reported({ limit: 10, say, work: () => new Promise(() => undefined) }), "stopped")
same("a timeout is printed and does not throw", said, [
  "paint-fidelity stopped at its limit of 0.01 seconds. The count covers what finished.",
])
said.length = 0
same("a finished run is told", await reported({ limit: 1000, say, work: async () => "done" }), "finished")
same("a finished run prints nothing extra", said, [])

console.log("paint-fidelity tests passed")
