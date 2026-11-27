import * as doom from "@airdesign/doom"
import { textToMarkdown } from "@airdesign/doom/testing"

import { blank, blankDeck, evalDeck, named, slides } from "./eval-deck.js"
import { onceIds } from "../once-ids.js"
import { swatch } from "./suite-art.js"
import { heldRun, noteTouched, runningWith, stoppedRun } from "./suite-changed-decks.js"
import { type Attempt, type Reason, type Step, type Task, edit, read, run, stop } from "./score.js"

export type SuiteRow = {
  readonly task: Task
  readonly reference: Attempt
  readonly wrong: { readonly attempt: Attempt; readonly reason: Reason }
}

const aim = `${slides.opening}.title`
const logoAsset = "1".repeat(64)
const bars = [
  { name: "Q1 plan", value: 3, fill: "accent2" },
  { name: "Q1 actual", value: 3.5, fill: "accent1" },
  { name: "Q2 plan", value: 4, fill: "accent2" },
  { name: "Q2 actual", value: 4.5, fill: "accent1" },
]

const chart = (slide: string) =>
  bars.map(({ name, value, fill }, index) => ({
    op: "add",
    kind: "shape",
    slide,
    name,
    fill,
    box: { x: 300, y: 260 + 124 * index, w: 260 * value, h: 88 },
  }))
const hasChart = (end: doom.Doom) => bars.every(({ name }) => has(end, `name="${name}"`))

const lines = (end: doom.Doom) => doom.readForAgent(end, "all")
const has = (end: doom.Doom, fragment: string) => lines(end).includes(fragment)
const lineOf = (end: doom.Doom, id: string) =>
  lines(end)
    .split("\n")
    .find((line) => line.trimStart().startsWith(`${id} `)) ?? ""
const textOf = (end: doom.Doom, id: string): string | undefined => {
  const words = (end.nodes.get(id as never) as { text?: doom.Text } | undefined)?.text
  return words === undefined ? undefined : textToMarkdown(words)
}
const slideIds = (end: doom.Doom) => doom.slidesOf(end).map((slide) => slide.id as string)
const childrenOf = (end: doom.Doom, id: string) => (end.children.get(id as never) ?? []) as readonly string[]

const ok: Step = { name: "execute", outcome: "ok" }
const refused = (outcome: string): Step => ({ name: "execute", outcome })
const unchanged = (end: doom.Doom) => end.rev === evalDeck().rev

function row(
  id: string,
  prompt: string,
  want: {
    readonly touches?: readonly string[]
    readonly landed?: Task["want"]["landed"]
    readonly steps?: readonly Step[]
    readonly calls?: number
    readonly deck?: () => doom.Doom
  },
  reference: Attempt,
  wrong: Attempt,
  reason: Reason,
): SuiteRow {
  return {
    task: {
      id,
      prompt,
      deck: want.deck ?? evalDeck,
      want: {
        calls: want.calls ?? 1,
        steps: want.steps ?? [ok],
        touches: want.touches ?? [],
        landed: want.landed ?? (() => true),
      },
    },
    reference,
    wrong: { attempt: wrong, reason },
  }
}

const one = (change: Record<string, unknown>): Attempt => [edit([change])]
const setTitle = (text: string) => one({ op: "set", target: aim, text })
const setOn = (target: string, look: Record<string, unknown>) => one({ op: "set", target, ...look })
const addTo = (slide: string, look: Record<string, unknown>) => one({ op: "add", slide, ...look })

function words(id: string, task: string, text: string, other: string, markdown = text): SuiteRow {
  return row(
    id,
    task,
    { touches: [named.title], landed: (end) => textOf(end, named.title) === markdown },
    setTitle(text),
    setTitle(other),
    "landed",
  )
}

function look(
  id: string,
  prompt: string,
  target: string,
  right: Record<string, unknown>,
  wrong: Record<string, unknown>,
  shown: string,
) {
  return row(
    id,
    prompt,
    { touches: [target], landed: (end) => lineOf(end, target).includes(shown) },
    setOn(target, right),
    setOn(target, wrong),
    "landed",
  )
}

function placed(
  id: string,
  prompt: string,
  make: Record<string, unknown>,
  shown: string | readonly string[],
): SuiteRow {
  const fragments = typeof shown === "string" ? [shown] : shown
  return row(
    id,
    prompt,
    {
      landed: (end) =>
        fragments.every((fragment) => has(end, fragment)) && childrenOf(end, slides.roadmap).length === 2,
    },
    addTo(slides.roadmap, make),
    addTo(slides.numbers, make),
    "landed",
  )
}

const bigRun = "n".repeat(7_000)
const tooBig = "n".repeat(9_000)
const slideCount = 3

const boardOnce = "call2"
const boardIds = onceIds(boardOnce)
const boardSlides = () => [blank.title, ...[1, 2, 3, 4].map((at) => `${boardIds.client}:${String(at)}`)]

export const suite: readonly SuiteRow[] = [
  words("plain-words", "Set the title of the opening slide to North star.", "North star", "South star"),
  words("emoji-text", "Set the title of the opening slide to 東京 🌸.", "東京 🌸", "大阪"),
  words(
    "lined-text",
    "Set the title of the opening slide to one, two and three, each in its own paragraph.",
    "one\n\ntwo\n\nthree",
    "one two three",
  ),
  words(
    "bullet-text",
    "Set the title of the opening slide to a bulleted list of Grow and Protect.",
    "- Grow\n- Protect",
    "Grow, Protect",
  ),
  words(
    "styled-text",
    "Set the title of the opening slide to Revenue grew fast, with Revenue in bold and fast in italic.",
    "**Revenue** grew *fast*",
    "Revenue grew fast",
  ),
  words(
    "quoted-text",
    'Set the title of the opening slide to "quoted", and include the quote marks.',
    '"quoted"',
    "quoted",
  ),
  words("long-text", "Set the title of the opening slide to a run of seven thousand n characters.", bigRun, "n"),
  row(
    "delete-every-slide",
    "Delete every slide in the deck.",
    { steps: [refused("last-slide")], landed: unchanged },
    [edit(Object.values(slides).map((slide) => ({ op: "slide", delete: slide })))],
    one({ op: "slide", delete: slides.roadmap }),
    "tool",
  ),
  row(
    "over-long-text",
    "Set the title of the opening slide to a run of nine thousand n characters.",
    { steps: [refused("limit")], landed: unchanged },
    setTitle(tooBig),
    setTitle("n"),
    "tool",
  ),

  look(
    "theme-fill",
    "Fill the card on the numbers slide with the theme's second accent colour.",
    named.card,
    { fill: "accent2" },
    { fill: "accent3" },
    "fill=accent2",
  ),
  look(
    "hex-fill",
    `Fill the card on the numbers slide with ${swatch.asked}.`,
    named.card,
    { fill: swatch.asked },
    { fill: swatch.other },
    `fill=${swatch.asked}`,
  ),
  look(
    "text-colour",
    "Colour the revenue label with the first accent colour.",
    named.label,
    { color: "accent1" },
    { color: "accent4" },
    "color=accent1",
  ),
  look(
    "text-style",
    "Make the revenue label a heading.",
    named.label,
    { textStyle: "heading" },
    { textStyle: "caption" },
    "style=heading",
  ),
  look("effect-style", "Lift the card.", named.card, { effect: "lifted" }, { effect: "soft" }, "effect=lifted"),
  look(
    "card-outline",
    "Round the card by 24 pixels and outline it in the first accent colour, 3 pixels wide.",
    named.card,
    { radius: 24, stroke: "accent1", strokeWidth: 3 },
    { radius: 8, stroke: "accent1", strokeWidth: 3 },
    "stroke=accent1 strokeWidth=3 radius=24",
  ),
  look("centre-text", "Centre the note.", named.note, { align: "center" }, { align: "right" }, "align=center"),
  look("rename-card", "Name the card Fact.", named.card, { name: "Fact" }, { name: "Figure" }, 'name="Fact"'),

  placed("add-text", "Add the words Hello to the roadmap slide.", { kind: "text", text: "Hello" }, 'text="Hello"'),
  placed(
    "add-shape",
    "Add an accent-coloured box with the words Go to the roadmap slide.",
    { kind: "shape", text: "Go", fill: "accent1", box: { x: 100, y: 300, w: 400, h: 200 } },
    "fill=accent1",
  ),
  placed(
    "add-arrow",
    "Add an arrow to the roadmap slide.",
    { kind: "line", arrow: true, box: { x: 100, y: 300, w: 400, h: 0 } },
    "arrow",
  ),
  placed(
    "add-row-frame",
    "Add a frame that lays its children out in a row, 24 pixels apart, to the roadmap slide.",
    { kind: "frame", layout: "row", gap: 24 },
    "layout=row gap=24",
  ),
  placed("add-icon", "Add a rocket icon to the roadmap slide.", { kind: "icon", icon: "rocket" }, "icon=rocket"),
  row(
    "add-chart",
    "Add a bar chart of Plan against Actual for Q1 and Q2 to the roadmap slide.",
    { landed: hasChart },
    [edit(chart(slides.roadmap))],
    addTo(slides.roadmap, { kind: "shape", name: "Q1 plan" }),
    "landed",
  ),
  placed(
    "add-picture",
    `Add the picture with asset ${logoAsset} to the roadmap slide.`,
    { kind: "picture", fill: { image: logoAsset } },
    `fill=image:${logoAsset}`,
  ),
  placed(
    "add-word-grid",
    "Add a two by two grid of words to the roadmap slide.",
    {
      kind: "frame",
      rows: [
        ["", "Q1"],
        ["Product", "Beta"],
      ],
    },
    "layout=grid",
  ),

  placed(
    "result-label",
    "Add a shape showing Revenue at $4M on the roadmap slide.",
    { kind: "shape", text: "Revenue $4M", fill: "accent2" },
    ['text="Revenue $4M"', "fill=accent2"],
  ),
  placed(
    "grow-card",
    "Add a rounded Grow card with one point on the roadmap slide.",
    { kind: "shape", text: "Grow\n- Enter two markets", radius: 20 },
    ["radius=20", "Enter two markets"],
  ),
  placed(
    "compare-options",
    "Compare Build (Slow) and Buy (Fast) in a word grid on the roadmap slide.",
    {
      kind: "frame",
      rows: [
        ["Build", "Buy"],
        ["Slow", "Fast"],
      ],
    },
    ["layout=grid", 'text="**Build**"', 'text="**Buy**"', 'text="**Slow**"', 'text="Fast"'],
  ),
  placed(
    "effort-impact",
    "Add a labelled Quick wins quadrant on the roadmap slide.",
    { kind: "shape", text: "Quick wins", name: "Low effort, high impact", box: { x: 160, y: 320, w: 800, h: 300 } },
    ['name="Low effort, high impact"', 'text="Quick wins"', "@160,320 800x300"],
  ),
  placed(
    "milestone-list",
    "List the Q1 Beta and Q2 Launch milestones on the roadmap slide.",
    { kind: "text", text: "- Q1 Beta\n- Q2 Launch" },
    ['text="- Q1 Beta\\n- Q2 Launch"'],
  ),
  placed(
    "step-arrow",
    "Draw an arrow pointing right on the roadmap slide.",
    { kind: "line", box: { x: 400, y: 310, w: 200, h: 0 }, arrow: true },
    ["line @400,310 200x0 stroke=text2 strokeWidth=3 arrow"],
  ),

  row(
    "move-into-card",
    "Move the note into the card.",
    { touches: [named.note], landed: (end) => childrenOf(end, named.card).includes(named.note) },
    one({ op: "move", node: named.note, into: named.card }),
    one({ op: "move", node: named.note }),
    "landed",
  ),
  row(
    "delete-note",
    "Delete the note.",
    { touches: [named.note], landed: (end) => !childrenOf(end, slides.numbers).includes(named.note) },
    one({ op: "delete", nodes: [named.note] }),
    one({ op: "delete", nodes: [named.card] }),
    "touched",
  ),
  row(
    "lock-card",
    "Lock the card on the numbers slide so it cannot be moved on the canvas.",
    {
      touches: [named.card],
      landed: (end) =>
        end.nodes.get(named.card) !== undefined && (end.nodes.get(named.card) as { locked?: boolean }).locked === true,
    },
    setOn(named.card, { locked: true }),
    setOn(named.card, { hidden: true }),
    "touched",
  ),
  row(
    "add-slide",
    "Add a slide at the end.",
    { landed: (end) => slideIds(end).length === slideCount + 1 },
    one({ op: "slide", add: {} }),
    one({ op: "slide", delete: slides.roadmap }),
    "touched",
  ),
  row(
    "move-slide",
    "Move the roadmap slide to the front.",
    { touches: [slides.roadmap], landed: (end) => slideIds(end)[0] === slides.roadmap },
    one({ op: "slide", move: { slide: slides.roadmap, after: null } }),
    one({ op: "slide", move: { slide: slides.numbers, after: null } }),
    "touched",
  ),

  row(
    "loop-lands-once",
    "Add three slides titled One, Two and Three in one call.",
    {
      landed: (end) =>
        ["One", "Two", "Three"].every((word) => has(end, `text="${word}"`)) && slideIds(end).length === slideCount + 3,
    },
    [
      run(
        'for (const word of ["One", "Two", "Three"]) { const s = insert({ kind: "slide" }); insert({ parent: s, kind: "text", textStyle: "title", text: word }) }',
      ),
    ],
    ["One", "Two", "Three"].map((word) =>
      run(
        `const s = insert({ kind: "slide" }); insert({ parent: s, kind: "text", textStyle: "title", text: "${word}" })`,
      ),
    ),
    "calls",
  ),
  row(
    "unknown-deck",
    "Set the title of the deck that has the id missing to North star.",
    { steps: [refused("deck")], landed: unchanged },
    [edit([{ op: "set", target: aim, text: "North star" }], undefined, "missing")],
    setTitle("North star"),
    "tool",
  ),
  row(
    "unknown-layer",
    "Set the words of the layer z:9 to North star.",
    { steps: [refused("dead")], landed: unchanged },
    one({ op: "set", target: "z:9", text: "North star" }),
    setTitle("North star"),
    "tool",
  ),
  row(
    "no-text-on-a-line",
    "Add a line to the roadmap slide that says Go.",
    { steps: [refused("field")], landed: unchanged },
    addTo(slides.roadmap, { kind: "line", text: "Go" }),
    addTo(slides.roadmap, { kind: "line" }),
    "tool",
  ),
  row(
    "throw-lands-nothing",
    "Add a slide, then stop the script with an error, so nothing lands.",
    { steps: [refused("script")], landed: unchanged },
    [run('insert({ kind: "slide" }); throw new Error("stop")')],
    [run('insert({ kind: "slide" })')],
    "tool",
  ),
  row(
    "read-first",
    "Read the deck, then set the note to Plan was $3.9M.",
    {
      calls: 2,
      steps: [{ name: "execute", outcome: "ok" }, ok],
      touches: [named.note],
      landed: (end) => textOf(end, named.note) === "Plan was $3.9M",
    },
    [read(), edit([{ op: "set", target: named.note, text: "Plan was $3.9M" }])],
    [edit([{ op: "set", target: named.note, text: "Plan was $3.9M" }])],
    "tool",
  ),
  row(
    "measured-caption",
    "Put a caption that says Source: plan 24 px below the opening slide's title, reading the title's box first.",
    {
      landed: (end) => {
        const caption = [...end.nodes.values()].find((node) => textOf(end, node.id) === "Source: plan")
        const title = doom.propOf(end.nodes.get(named.title as never), "box")
        const box = caption === undefined ? undefined : doom.propOf(caption, "box")
        return title !== undefined && box?.y === title.y + title.h + 24
      },
    },
    [
      run(
        `const t = get({ target: "${named.title}" }).box; insert({ parent: "${slides.opening}", kind: "text", textStyle: "caption", text: "Source: plan", box: { x: t.x, y: t.y + t.h + 24, w: t.w, h: 40 } })`,
      ),
    ],
    [
      run(
        `insert({ parent: "${slides.opening}", kind: "text", textStyle: "caption", text: "Source: plan", box: { x: 160, y: 900, w: 1600, h: 40 } })`,
      ),
    ],
    "landed",
  ),
  row(
    "closed-by-a-person",
    "Set the name of the note to Agent in your run. A person renamed the note while the run was open.",
    {
      deck: noteTouched,
      steps: [refused("person-protected")],
      touches: [named.note],
      landed: (end) => lineOf(end, named.note).includes('name="Mine"'),
    },
    [edit([{ op: "set", target: named.note, name: "Agent" }], heldRun)],
    [edit([{ op: "set", target: named.note, name: "Agent" }])],
    "tool",
  ),
  row(
    "stopped-run",
    "Add the words Late to the roadmap slide in the run that has stopped.",
    { deck: stoppedRun, steps: [refused("run-fenced")] },
    [edit([{ op: "add", kind: "text", slide: slides.roadmap, text: "Late" }], heldRun)],
    [edit([{ op: "add", kind: "text", slide: slides.roadmap, text: "Late" }])],
    "tool",
  ),
  row(
    "stop-twice",
    "Stop the run that is open, then stop it again.",
    {
      deck: () => runningWith([]),
      calls: 2,
      steps: [
        { name: "stop_run", outcome: "ok" },
        { name: "stop_run", outcome: "ok" },
      ],
      landed: (end) => end.runs.get(heldRun)?.phase === "stopped",
    },
    [stop(heldRun), stop(heldRun)],
    [stop("other"), stop(heldRun)],
    "tool",
  ),
  row(
    "batch-limit",
    "Send a hundred and one changes in one call.",
    { steps: [refused("limit")], landed: unchanged },
    [edit(Array.from({ length: 101 }, (_, at) => ({ op: "set", target: named.note, name: `Note ${String(at)}` })))],
    one({ op: "set", target: named.note, name: "Note" }),
    "tool",
  ),
  {
    task: {
      id: "board-brief",
      prompt:
        "Build a five-slide board deck: a title, a results summary with a decision card, a bar chart of plan against actual, three priorities with icons, and a roadmap as a grid of words.",
      deck: blankDeck,
      want: {
        calls: 8,
        steps: [{ name: "execute", outcome: "ok" }, ok, ok, { name: "stop_run", outcome: "ok" }],
        touches: [blank.title],
        landed: (end) => {
          const made = slideIds(end)
          return (
            made.length === 5 &&
            has(end, 'name="Results"') &&
            has(end, 'name="Decision"') &&
            hasChart(end) &&
            lines(end)
              .split("\n")
              .filter((line) => line.includes("icon=")).length === 3 &&
            has(end, "layout=grid")
          )
        },
      },
    },
    reference: boardAttempt(true),
    wrong: { attempt: boardAttempt(false), reason: "landed" },
  },
]

function boardAttempt(withChart: boolean): Attempt {
  const [one, two, three, four, five] = boardSlides() as [string, string, string, string, string]
  const title = (slide: string, text: string) => ({
    op: "add",
    kind: "text",
    slide,
    text,
    textStyle: "title",
    box: { x: 80, y: 60, w: 1760, h: 90 },
  })
  return [
    read(),
    edit(Array.from({ length: 4 }, () => ({ op: "slide", add: {} }))),
    edit(
      [
        { op: "set", target: `${one}`, text: "Q3 board update" },
        title(two, "Results at a glance"),
        { op: "add", kind: "text", slide: two, name: "Results", text: "Revenue $4.2M · Margin 31%" },
        { op: "add", kind: "shape", slide: two, name: "Decision", text: "Approve the budget" },
        title(three, "Revenue ran ahead of plan"),
        ...(withChart ? chart(three) : []),
        title(four, "Three priorities"),
        ...["trending-up", "shield", "hammer"].map((icon) => ({ op: "add", kind: "icon", slide: four, icon })),
        title(five, "Roadmap"),
        {
          op: "add",
          kind: "frame",
          slide: five,
          rows: [
            ["", "Q1", "Q2"],
            ["Product", "Beta", "Launch"],
          ],
        },
      ],
      boardIds.run,
    ),
    stop(boardIds.run),
  ]
}
