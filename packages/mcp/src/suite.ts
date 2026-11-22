import { scene } from "@airdesign/document"

import { blank, blankDeck, evalDeck, named, person, slides } from "./eval-deck.js"
import { onceIds } from "./once-ids.js"
import { swatch } from "./suite-art.js"
import { type Attempt, type Reason, type Step, type Task, edit, read, stop } from "./score.js"

export type SuiteRow = {
  readonly task: Task
  readonly reference: Attempt
  readonly wrong: { readonly attempt: Attempt; readonly reason: Reason }
}

const aim = `${slides.opening}.title`
const baseRev = Number(evalDeck().rev)

const lines = (end: scene.Scene) => scene.readForAgent(end, "all")
const has = (end: scene.Scene, fragment: string) => lines(end).includes(fragment)
const lineOf = (end: scene.Scene, id: string) =>
  lines(end)
    .split("\n")
    .find((line) => line.trimStart().startsWith(`${id} `)) ?? ""
const textOf = (end: scene.Scene, id: string): string | undefined => {
  const words = (end.nodes.get(id as never) as { text?: scene.Text } | undefined)?.text
  return words === undefined ? undefined : scene.textToMarkdown(words)
}
const slideIds = (end: scene.Scene) => scene.slidesOf(end).map((slide) => slide.id as string)
const childrenOf = (end: scene.Scene, id: string) => (end.children.get(id as never) ?? []) as readonly string[]

const ok: Step = { name: "edit_deck", outcome: "ok" }
const refused = (outcome: string): Step => ({ name: "edit_deck", outcome })
const unchanged = (end: scene.Scene) => end.rev === evalDeck().rev

function row(
  id: string,
  prompt: string,
  want: {
    readonly touches?: readonly string[]
    readonly landed?: Task["want"]["landed"]
    readonly steps?: readonly Step[]
    readonly calls?: number
    readonly deck?: () => scene.Scene
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

const one = (change: Record<string, unknown>): Attempt => [edit([change], baseRev)]
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

const pattern = (id: string, prompt: string, make: Record<string, unknown>, shown: string, name: string): SuiteRow =>
  placed(id, prompt, make, [`name="${name}"`, shown])

const bigRun = "n".repeat(7_000)
const tooBig = "n".repeat(9_000)
const slideCount = 3

function typedByAPerson(): scene.Scene {
  const start = evalDeck()
  const landed = scene.applyEdit(start, {
    once: "typed",
    author: person,
    writes: [
      {
        node: named.title,
        prop: "text",
        value: scene.textFromMarkdown("Typed by a person", "title"),
        base: start.revs.get(named.title)!.get("text")!,
      },
    ],
    rev: scene.rev(start.rev + 1),
  })
  if (scene.isRefusal(landed)) throw new Error("typed")
  return landed
}

const heldRun = "held"

function runningWith(then: readonly scene.Write[], by: scene.Author = person): scene.Scene {
  const start = evalDeck()
  const began = scene.applyEdit(start, {
    once: "begin",
    author: { kind: "agent", id: "eval", run: heldRun },
    writes: [],
    phase: "start",
    rev: scene.rev(start.rev + 1),
  })
  if (scene.isRefusal(began)) throw new Error("begin")
  if (then.length === 0) return began
  const next = scene.applyEdit(began, { once: "then", author: by, writes: then, rev: scene.rev(began.rev + 1) })
  if (scene.isRefusal(next)) throw new Error("then")
  return next
}

const noteTouched = () => runningWith([{ node: named.note, prop: "name", value: "Mine" }])

function stoppedRun(): scene.Scene {
  const began = runningWith([])
  const stopped = scene.applyEdit(began, {
    once: "end",
    author: { kind: "agent", id: "eval", run: heldRun },
    writes: [],
    phase: "stop",
    rev: scene.rev(began.rev + 1),
  })
  if (scene.isRefusal(stopped)) throw new Error("end")
  return stopped
}

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
  placed(
    "add-chart",
    "Add a bar chart of Plan against Actual for Q1 and Q2 to the roadmap slide.",
    {
      kind: "chart",
      chart: {
        kind: "bar",
        categories: ["Q1", "Q2"],
        series: [
          { name: "Plan", values: [3, 4] },
          { name: "Actual", values: [3.5, 4.5] },
        ],
      },
    },
    "chart=",
  ),
  placed(
    "add-picture",
    "Add the picture with asset logo-1 to the roadmap slide.",
    { kind: "picture", fill: { image: "logo-1" } },
    "fill=image:logo-1",
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

  pattern(
    "kpi-pattern",
    "Show Revenue at $4M as a KPI on the roadmap slide.",
    { kind: "kpi", items: [{ title: "Revenue", value: "$4M" }] },
    "$4M",
    "KPI",
  ),
  pattern(
    "cards-pattern",
    "Show a Grow card with one point on the roadmap slide.",
    { kind: "cards", items: [{ title: "Grow", points: ["Enter two markets"] }] },
    "Enter two markets",
    "Cards",
  ),
  pattern(
    "compare-pattern",
    "Compare Build and Buy on the roadmap slide.",
    {
      kind: "compare",
      items: [
        { title: "Build", points: ["Slow"] },
        { title: "Buy", points: ["Fast"] },
      ],
    },
    "Fast",
    "Compare",
  ),
  pattern(
    "matrix-pattern",
    "Show a matrix of Quick wins and Big bets on the roadmap slide.",
    { kind: "matrix", items: [{ title: "Quick wins" }, { title: "Big bets" }], axes: ["Effort", "Impact"] },
    "Big bets",
    "Matrix",
  ),
  pattern(
    "timeline-pattern",
    "Show a timeline of Q1 Beta and Q2 Launch on the roadmap slide.",
    {
      kind: "timeline",
      items: [
        { value: "Q1", title: "Beta" },
        { value: "Q2", title: "Launch" },
      ],
    },
    "Launch",
    "Timeline",
  ),
  pattern(
    "flow-pattern",
    "Show a flow of Plan then Build on the roadmap slide.",
    { kind: "flow", items: [{ title: "Plan" }, { title: "Build" }] },
    "Build",
    "Flow",
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
    "base-ahead",
    "Set the title of the opening slide to North star. The deck is at revision 1, and your copy says revision 9.",
    { steps: [refused("base")], landed: unchanged },
    [edit([{ op: "set", target: aim, text: "North star" }], 9)],
    setTitle("North star"),
    "tool",
  ),
  row(
    "unknown-deck",
    "Set the title of the deck that has the id missing to North star.",
    { steps: [refused("deck")], landed: unchanged },
    [edit([{ op: "set", target: aim, text: "North star" }], baseRev, undefined, "missing")],
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
    "empty-changes",
    "Send an edit with no changes.",
    { steps: [refused("batch")], landed: unchanged },
    [edit([], baseRev)],
    setTitle("North star"),
    "tool",
  ),
  row(
    "read-first",
    "Read the deck, then set the note to Plan was $3.9M.",
    {
      calls: 2,
      steps: [{ name: "read_deck", outcome: "ok" }, ok],
      touches: [named.note],
      landed: (end) => textOf(end, named.note) === "Plan was $3.9M",
    },
    [read(), edit([{ op: "set", target: named.note, text: "Plan was $3.9M" }], baseRev)],
    [edit([{ op: "set", target: named.note, text: "Plan was $3.9M" }], baseRev)],
    "tool",
  ),
  row(
    "retry-after-stale",
    "Set the title of the opening slide to Agent. A person retyped it after your read at revision 1, and the deck is at revision 2.",
    {
      deck: typedByAPerson,
      calls: 3,
      steps: [refused("stale"), { name: "read_deck", outcome: "ok" }, ok],
      touches: [named.title],
      landed: (end) => textOf(end, named.title) === "Agent",
    },
    [
      edit([{ op: "set", target: aim, text: "Agent" }], baseRev),
      read(),
      edit([{ op: "set", target: aim, text: "Agent" }], baseRev + 1),
    ],
    [edit([{ op: "set", target: aim, text: "Agent" }], baseRev + 1)],
    "tool",
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
    [edit([{ op: "set", target: named.note, name: "Agent" }], baseRev + 2, heldRun)],
    [edit([{ op: "set", target: named.note, name: "Agent" }], baseRev + 2)],
    "tool",
  ),
  row(
    "stopped-run",
    "Add the words Late to the roadmap slide in the run that has stopped.",
    { deck: stoppedRun, steps: [refused("run-fenced")] },
    [edit([{ op: "add", kind: "text", slide: slides.roadmap, text: "Late" }], baseRev + 2, heldRun)],
    [edit([{ op: "add", kind: "text", slide: slides.roadmap, text: "Late" }], baseRev + 2)],
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
    { steps: [refused("batch")], landed: unchanged },
    [
      edit(
        Array.from({ length: 101 }, () => ({ op: "delete", nodes: [named.note] })),
        baseRev,
      ),
    ],
    one({ op: "delete", nodes: [named.note] }),
    "tool",
  ),
  {
    task: {
      id: "board-brief",
      prompt:
        "Build a five-slide board deck: a title, a KPI summary with a decision card, a bar chart of plan against actual, three priorities with icons, and a roadmap as a grid of words.",
      deck: blankDeck,
      want: {
        calls: 8,
        steps: [{ name: "read_deck", outcome: "ok" }, ok, ok, { name: "stop_run", outcome: "ok" }],
        touches: [blank.title],
        landed: (end) => {
          const made = slideIds(end)
          return (
            made.length === 5 &&
            has(end, 'name="KPI"') &&
            has(end, 'name="Decision"') &&
            has(end, "chart=") &&
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
    edit(
      Array.from({ length: 4 }, () => ({ op: "slide", add: {} })),
      baseRev,
    ),
    edit(
      [
        { op: "set", target: `${one}`, text: "Q3 board update" },
        title(two, "Results at a glance"),
        {
          op: "add",
          kind: "kpi",
          slide: two,
          items: [
            { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
            { title: "Margin", value: "31%" },
          ],
        },
        {
          op: "add",
          kind: "cards",
          slide: two,
          name: "Decision",
          items: [{ title: "Decision requested", points: ["Approve the budget"] }],
        },
        title(three, "Revenue ran ahead of plan"),
        ...(withChart
          ? [
              {
                op: "add",
                kind: "chart",
                slide: three,
                chart: {
                  kind: "bar",
                  categories: ["Q1", "Q2"],
                  series: [
                    { name: "Plan", values: [3.1, 3.4] },
                    { name: "Actual", values: [3.3, 3.7] },
                  ],
                },
              },
            ]
          : []),
        title(four, "Three priorities"),
        {
          op: "add",
          kind: "cards",
          slide: four,
          items: [
            { title: "Grow", icon: "trending-up", points: ["Enter two markets"] },
            { title: "Protect", icon: "shield", points: ["Raise retention"] },
            { title: "Build", icon: "hammer", points: ["Ship the platform"] },
          ],
        },
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
      baseRev + 1,
      boardIds.run,
    ),
    stop(boardIds.run),
  ]
}
