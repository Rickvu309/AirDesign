import { timeoutMs, type Tab } from "@airdesign/device"
import { elementId, limits, type Register } from "@airdesign/document"
import { fixture } from "./fixture.js"
import { capture, edit, type Attempt, type ElementName, type Reason, type Task } from "./score.js"

export type SuiteRow = {
  readonly task: Task
  readonly reference: Attempt
  readonly wrong: {
    readonly attempt: Attempt
    readonly reason: Reason
  }
}

const hidden: Tab = { presence: "hidden", elapsedMs: 0, version: 1, authority: 1 }
const timedOut: Tab = { presence: "visible", elapsedMs: timeoutMs, version: 1, authority: 1 }
const outdated: Tab = { presence: "visible", elapsedMs: 0, version: 1, authority: 2 }
const open: Tab = { presence: "visible", elapsedMs: 0, version: 1, authority: 1 }
const absent: Tab = { presence: "absent" }

function one(deck: string, element: ElementName, value: string, readAt: number): Attempt {
  return [edit(deck, [{ element, value, readAt }])]
}

function overLimit(register: Register): Register {
  return { ...register, slides: limits.slides + 1 }
}

function atLimit(register: Register): Register {
  return { ...register, slides: limits.slides }
}

function fullBytes(register: Register): Register {
  return { ...register, bytes: limits.bytes }
}

function tenBytesLeft(register: Register): Register {
  return { ...register, bytes: limits.bytes - 10 }
}

function fullElements(register: Register): Register {
  const missing = limits.elements - register.nodes.length
  const filler = Array.from({ length: missing }, (_, index) => elementId(`${String(index)}.99`))
  return { ...register, nodes: [...register.nodes, ...filler] }
}

const longNote = "n".repeat(4000)
const fits = "é".repeat(4000)
const tooLong = "é".repeat(4001)

export const landSourceTask: Task = {
  id: "land-source",
  prompt: "Set the title of deck deck to 21.",
  deck: () => fixture("deck", [{ element: "title" }]),
  want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["21"] } },
}

export const landSourceAttempt: Attempt = one("deck", "title", "21", 0)

export const staleEditTask: Task = {
  id: "stale-edit",
  prompt: "Set the title of deck deck to 22. Your copy of the deck is at revision 1, and the deck is at revision 2.",
  deck: () => ({ ...fixture("deck", [{ element: "title" }]), revision: 2 }),
  want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["22"] } },
}

export const staleEditAttempt: Attempt = [edit("deck", [{ element: "title", value: "22", readAt: 0 }], 1)]

export const captureAbsentTask: Task = {
  id: "capture-absent-proof",
  prompt: "Capture the title of deck deck. The tab is not open.",
  deck: () => fixture("deck", [{ element: "title" }]),
  tab: absent,
  want: { calls: 1, steps: [{ name: "capture_slide", outcome: "no-open-tab" }], elements: {} },
}

export const captureAbsentAttempt: Attempt = [capture("deck")]

export const suite: readonly SuiteRow[] = [
  {
    task: {
      id: "plain-words",
      prompt: "Set the title of deck brief to North star.",
      deck: () => fixture("brief", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["North star"] } },
    },
    reference: one("brief", "title", "North star", 0),
    wrong: { attempt: one("brief", "title", "South star", 0), reason: "landed" },
  },
  {
    task: {
      id: "emoji-text",
      prompt: "Set the title of deck hello to 東京 🌸.",
      deck: () => fixture("hello", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["東京 🌸"] } },
    },
    reference: one("hello", "title", "東京 🌸", 0),
    wrong: { attempt: one("hello", "title", "大阪", 0), reason: "landed" },
  },
  {
    task: {
      id: "spaced-text",
      prompt: "Set the title of deck margin to keep, with two spaces before it and two spaces after it.",
      deck: () => fixture("margin", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["  keep  "] } },
    },
    reference: one("margin", "title", "  keep  ", 0),
    wrong: { attempt: one("margin", "title", "keep", 0), reason: "landed" },
  },
  {
    task: {
      id: "lined-text",
      prompt: "Set the title of deck lines to one, two, and three, each on its own line.",
      deck: () => fixture("lines", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["one\ntwo\nthree"] } },
    },
    reference: one("lines", "title", "one\ntwo\nthree", 0),
    wrong: { attempt: one("lines", "title", "one two three", 0), reason: "landed" },
  },
  {
    task: {
      id: "quoted-text",
      prompt: 'Set the title of deck marks to "quoted", and include the quote marks.',
      deck: () => fixture("marks", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ['"quoted"'] } },
    },
    reference: one("marks", "title", '"quoted"', 0),
    wrong: { attempt: one("marks", "title", "quoted", 0), reason: "landed" },
  },
  {
    task: {
      id: "long-text",
      prompt: "Set the title of deck essay to a run of four thousand n characters.",
      deck: () => fixture("essay", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: [longNote] } },
    },
    reference: one("essay", "title", longNote, 0),
    wrong: { attempt: one("essay", "title", "short", 0), reason: "landed" },
  },
  {
    task: {
      id: "empty-text",
      prompt: "Set the title of deck blank to an empty string.",
      deck: () => fixture("blank", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: [""] } },
    },
    reference: one("blank", "title", "", 0),
    wrong: { attempt: one("blank", "title", "empty", 0), reason: "landed" },
  },
  {
    task: {
      id: "keep-body-note",
      prompt: "The body of deck keeper already says Kept by you. Set the title to Update.",
      deck: () => fixture("keeper", [{ element: "title" }, { element: "body", before: ["Kept by you."] }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["Update"] } },
    },
    reference: one("keeper", "title", "Update", 0),
    wrong: {
      attempt: [
        edit("keeper", [
          { element: "title", value: "Update", readAt: 0 },
          { element: "body", value: "Update", readAt: 1 },
        ]),
      ],
      reason: "touched",
    },
  },
  {
    task: {
      id: "both-plain",
      prompt: "In one edit, set the title of deck pair to Heading and the body to Detail.",
      deck: () => fixture("pair", [{ element: "title" }, { element: "body" }]),
      want: {
        calls: 1,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: ["Heading"], body: ["Detail"] },
      },
    },
    reference: [
      edit("pair", [
        { element: "title", value: "Heading", readAt: 0 },
        { element: "body", value: "Detail", readAt: 0 },
      ]),
    ],
    wrong: {
      attempt: [
        edit("pair", [
          { element: "title", value: "Detail", readAt: 0 },
          { element: "body", value: "Heading", readAt: 0 },
        ]),
      ],
      reason: "landed",
    },
  },
  {
    task: {
      id: "order-words",
      prompt: "On the title of deck steps, write First and then Second.",
      deck: () => fixture("steps", [{ element: "title" }]),
      want: {
        calls: 2,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: ["First", "Second"] },
      },
    },
    reference: [...one("steps", "title", "First", 0), ...one("steps", "title", "Second", 1)],
    wrong: {
      attempt: [...one("steps", "title", "Second", 0), ...one("steps", "title", "First", 1)],
      reason: "landed",
    },
  },
  {
    task: {
      id: "protect-title-words",
      prompt: "A teammate just typed Do not touch into the title of deck guarded. Set the title to Overwrite.",
      deck: () => fixture("guarded", [{ element: "title", during: ["Do not touch"] }, { element: "body" }]),
      want: {
        calls: 1,
        steps: [{ name: "edit_deck", outcome: "person-protected" }],
        elements: { title: ["Do not touch"] },
      },
    },
    reference: one("guarded", "title", "Overwrite", 1),
    wrong: { attempt: one("guarded", "body", "Overwrite", 0), reason: "tool" },
  },
  {
    task: {
      id: "capture-absent",
      prompt: "Capture the title of deck absent. The tab is not open.",
      deck: () => fixture("absent", [{ element: "title" }]),
      tab: absent,
      want: { calls: 1, steps: [{ name: "capture_slide", outcome: "no-open-tab" }], elements: {} },
    },
    reference: [capture("absent")],
    wrong: { attempt: one("absent", "title", "Captured", 0), reason: "tool" },
  },
  {
    task: {
      id: "capture-hidden",
      prompt: "Capture the title of deck hidden. The tab is hidden.",
      deck: () => fixture("hidden", [{ element: "title" }]),
      tab: hidden,
      want: { calls: 1, steps: [{ name: "capture_slide", outcome: "tab-hidden" }], elements: {} },
    },
    reference: [capture("hidden")],
    wrong: { attempt: one("hidden", "title", "Captured", 0), reason: "tool" },
  },
  {
    task: {
      id: "capture-timeout",
      prompt: "Capture the title of deck timeout. The tab did not answer in time.",
      deck: () => fixture("timeout", [{ element: "title" }]),
      tab: timedOut,
      want: { calls: 1, steps: [{ name: "capture_slide", outcome: "tab-timeout" }], elements: {} },
    },
    reference: [capture("timeout")],
    wrong: { attempt: one("timeout", "title", "Captured", 0), reason: "tool" },
  },
  {
    task: {
      id: "capture-outdated",
      prompt: "Capture the title of deck outdated. The tab is out of date.",
      deck: () => fixture("outdated", [{ element: "title" }]),
      tab: outdated,
      want: { calls: 1, steps: [{ name: "capture_slide", outcome: "tab-outdated" }], elements: {} },
    },
    reference: [capture("outdated")],
    wrong: { attempt: one("outdated", "title", "Captured", 0), reason: "tool" },
  },
  {
    task: {
      id: "ask-delete",
      prompt: "Delete slide 2 of deck slides.",
      deck: () => fixture("slides", [{ element: "title" }, { element: "note" }]),
      want: { calls: 0, steps: [], elements: {} },
    },
    reference: [],
    wrong: { attempt: one("slides", "title", "", 0), reason: "calls" },
  },
  {
    task: {
      id: "ask-export",
      prompt: "Export deck report as a PowerPoint file.",
      deck: () => fixture("report", [{ element: "title" }, { element: "body" }, { element: "note" }]),
      want: { calls: 0, steps: [], elements: {} },
    },
    reference: [],
    wrong: { attempt: one("report", "title", "report.pptx", 0), reason: "calls" },
  },
  {
    task: {
      id: "ask-read",
      prompt: "What does the title of deck review say?",
      deck: () => fixture("review", [{ element: "title", before: ["Quarterly review"] }]),
      want: { calls: 1, steps: [], elements: {} },
    },
    reference: [],
    wrong: { attempt: one("review", "title", "Quarterly review", 1), reason: "touched" },
  },
  {
    task: {
      id: "ask-colour",
      prompt: "Make the title of deck palette blue.",
      deck: () => fixture("palette", [{ element: "title" }, { element: "body" }]),
      want: { calls: 0, steps: [], elements: {} },
    },
    reference: [],
    wrong: { attempt: one("palette", "title", "blue", 0), reason: "calls" },
  },
  {
    task: {
      id: "limit-slides",
      prompt: "Set the title of deck full to More. The deck has 51 slides, one over the 50 slide limit.",
      deck: () => fixture("full", [{ element: "title" }], overLimit),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "limit" }], elements: { title: [] } },
    },
    reference: one("full", "title", "More", 0),
    wrong: { attempt: one("other", "title", "More", 0), reason: "tool" },
  },
  {
    task: {
      id: "limit-bytes",
      prompt: "Set the title of deck heavy to More. This deck is already at the byte limit.",
      deck: () => fixture("heavy", [{ element: "title" }], fullBytes),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "limit" }], elements: { title: [] } },
    },
    reference: one("heavy", "title", "More", 0),
    wrong: { attempt: one("other", "title", "More", 0), reason: "tool" },
  },
  {
    task: {
      id: "foreign-notes",
      prompt: "Set the title of deck notes to Hello. This session is on deck archive.",
      deck: () => fixture("archive", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "deck" }], elements: { title: [] } },
    },
    reference: one("notes", "title", "Hello", 0),
    wrong: { attempt: one("archive", "title", "Hello", 0), reason: "tool" },
  },
  {
    task: staleEditTask,
    reference: staleEditAttempt,
    wrong: { attempt: [edit("deck", [{ element: "title", value: "21", readAt: 0 }], 1)], reason: "landed" },
  },
  {
    task: {
      id: "protect-batch-drop",
      prompt: "A teammate is typing in the title of deck split. Set the title to Agenda and the body to Notes.",
      deck: () => fixture("split", [{ element: "title", during: ["Mine"] }, { element: "body" }]),
      want: {
        calls: 2,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: ["Mine"], body: ["Notes"] },
      },
    },
    reference: [
      edit("split", [
        { element: "title", value: "Agenda", readAt: 1 },
        { element: "body", value: "Notes", readAt: 0 },
      ]),
      ...one("split", "body", "Notes", 0),
    ],
    wrong: {
      attempt: [
        edit("split", [
          { element: "title", value: "Agenda", readAt: 1 },
          { element: "body", value: "Notes", readAt: 0 },
        ]),
      ],
      reason: "tool",
    },
  },
  {
    task: {
      id: "three-over-two-slides",
      prompt:
        "In one edit, set the title and body on slide 258 of deck spread to Heading and Detail, and the note on slide 259 to Remember.",
      deck: () => fixture("spread", [{ element: "title" }, { element: "body" }, { element: "note" }]),
      want: {
        calls: 1,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: ["Heading"], body: ["Detail"], note: ["Remember"] },
      },
    },
    reference: [
      edit("spread", [
        { element: "title", value: "Heading", readAt: 0 },
        { element: "body", value: "Detail", readAt: 0 },
        { element: "note", value: "Remember", readAt: 0 },
      ]),
    ],
    wrong: {
      attempt: [
        edit("spread", [
          { element: "title", value: "Heading", readAt: 0 },
          { element: "body", value: "Detail", readAt: 0 },
        ]),
      ],
      reason: "landed",
    },
  },
  {
    task: {
      id: "person-after-agent-row",
      prompt:
        "Earlier you set the title of deck typed-over to First, and a teammate has typed over it since. Set the title to Second.",
      deck: () =>
        fixture("typed-over", [{ element: "title", agent: ["First"], during: ["Teammate"] }, { element: "body" }]),
      want: {
        calls: 1,
        steps: [{ name: "edit_deck", outcome: "person-protected" }],
        elements: { title: ["First", "Teammate"] },
      },
    },
    reference: one("typed-over", "title", "Second", 2),
    wrong: { attempt: one("typed-over", "body", "Second", 0), reason: "tool" },
  },
  {
    task: {
      id: "person-on-other-element",
      prompt: "A teammate is typing in the body of deck beside. Set the title to Agenda.",
      deck: () => fixture("beside", [{ element: "title" }, { element: "body", during: ["Teammate"] }]),
      want: {
        calls: 1,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: ["Agenda"], body: ["Teammate"] },
      },
    },
    reference: one("beside", "title", "Agenda", 0),
    wrong: {
      attempt: [
        edit("beside", [
          { element: "title", value: "Agenda", readAt: 0 },
          { element: "body", value: "Agenda", readAt: 1 },
        ]),
      ],
      reason: "tool",
    },
  },
  {
    task: {
      id: "stale-read-resend",
      prompt: "The title of deck ledger has been edited twice by hand before this run. Set the title to Final.",
      deck: () => fixture("ledger", [{ element: "title", before: ["Draft", "Review"] }]),
      want: {
        calls: 2,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: ["Draft", "Review", "Final"] },
      },
    },
    reference: [...one("ledger", "title", "Final", 0), ...one("ledger", "title", "Final", 2)],
    wrong: { attempt: one("ledger", "title", "Final", 0), reason: "tool" },
  },
  {
    task: {
      id: "versions-per-element",
      prompt:
        "The title of deck levels already says Old title. Set the title to New title and the body to New body in one edit.",
      deck: () => fixture("levels", [{ element: "title", before: ["Old title"] }, { element: "body" }]),
      want: {
        calls: 1,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: ["Old title", "New title"], body: ["New body"] },
      },
    },
    reference: [
      edit("levels", [
        { element: "title", value: "New title", readAt: 1 },
        { element: "body", value: "New body", readAt: 0 },
      ]),
    ],
    wrong: {
      attempt: [
        edit("levels", [
          { element: "title", value: "New title", readAt: 0 },
          { element: "body", value: "New body", readAt: 0 },
        ]),
      ],
      reason: "tool",
    },
  },
  {
    task: {
      id: "value-over-8000-bytes",
      prompt:
        "Set the title of deck bulk to the letter é 4001 times. If the deck says that is too long, use 4000 é instead.",
      deck: () => fixture("bulk", [{ element: "title" }]),
      want: {
        calls: 2,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: [fits] },
      },
    },
    reference: [...one("bulk", "title", tooLong, 0), ...one("bulk", "title", fits, 0)],
    wrong: { attempt: one("bulk", "title", tooLong, 0), reason: "tool" },
  },
  {
    task: {
      id: "name-the-element",
      prompt: "Set the title of deck legacy to Hello. The title is element 258.7, not a.",
      deck: () => fixture("legacy", [{ element: "title" }, { element: "body" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["Hello"] } },
    },
    reference: one("legacy", "title", "Hello", 0),
    wrong: { attempt: one("legacy", "body", "Hello", 0), reason: "touched" },
  },
  {
    task: {
      id: "floor-on-change",
      prompt:
        "The title of deck floored already says Draft. Set it to Hello, and keep Draft as the text it started from.",
      deck: () => fixture("floored", [{ element: "title", before: ["Draft"] }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["Draft", "Hello"] } },
    },
    reference: [edit("floored", [{ element: "title", value: "Hello", readAt: 1, floor: "Draft" }])],
    wrong: { attempt: one("floored", "title", "Draft", 1), reason: "landed" },
  },
  {
    task: {
      id: "element-not-in-deck",
      prompt: "Set the footer of deck bare to Thanks. The deck has no footer yet.",
      deck: () => fixture("bare", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { footer: ["Thanks"] } },
    },
    reference: one("bare", "footer", "Thanks", 0),
    wrong: { attempt: one("bare", "title", "Thanks", 0), reason: "touched" },
  },
  {
    task: {
      id: "same-element-twice",
      prompt: "In one edit, write First and then Second on the title of deck twice.",
      deck: () => fixture("twice", [{ element: "title" }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["First", "Second"] } },
    },
    reference: [
      edit("twice", [
        { element: "title", value: "First", readAt: 0 },
        { element: "title", value: "Second", readAt: 0 },
      ]),
    ],
    wrong: {
      attempt: [
        edit("twice", [
          { element: "title", value: "Second", readAt: 0 },
          { element: "title", value: "First", readAt: 0 },
        ]),
      ],
      reason: "landed",
    },
  },
  {
    task: {
      id: "limit-slides-at",
      prompt: "Set the title of deck edge to More. The deck has 50 slides, exactly the limit.",
      deck: () => fixture("edge", [{ element: "title" }], atLimit),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["More"] } },
    },
    reference: one("edge", "title", "More", 0),
    wrong: { attempt: one("edge", "title", "Less", 0), reason: "landed" },
  },
  {
    task: {
      id: "bytes-run-out",
      prompt:
        "Set the title of deck tight to Short, then the body to Longer note. The deck has room for ten more bytes.",
      deck: () => fixture("tight", [{ element: "title" }, { element: "body" }], tenBytesLeft),
      want: {
        calls: 2,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: ["Short"], body: [] },
      },
    },
    reference: [...one("tight", "title", "Short", 0), ...one("tight", "body", "Longer note", 0)],
    wrong: {
      attempt: [
        edit("tight", [
          { element: "title", value: "Short", readAt: 0 },
          { element: "body", value: "Longer note", readAt: 0 },
        ]),
      ],
      reason: "tool",
    },
  },
  {
    task: {
      id: "elements-run-out",
      prompt: "Set the footer of deck crowded to Thanks. The deck already holds 5000 elements.",
      deck: () => fixture("crowded", [{ element: "title" }], fullElements),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "limit" }], elements: { footer: [] } },
    },
    reference: one("crowded", "footer", "Thanks", 0),
    wrong: { attempt: one("crowded", "title", "Thanks", 0), reason: "tool" },
  },
  {
    task: {
      id: "capture-open",
      prompt: "Set the title of deck shots to Cover, then capture it. The tab is open and up to date.",
      deck: () => fixture("shots", [{ element: "title" }]),
      tab: open,
      want: {
        calls: 2,
        steps: [
          { name: "edit_deck", outcome: "ok" },
          { name: "capture_slide", outcome: "device" },
        ],
        elements: { title: ["Cover"] },
      },
    },
    reference: [...one("shots", "title", "Cover", 0), capture("shots")],
    wrong: { attempt: one("shots", "title", "Cover", 0), reason: "tool" },
  },
  {
    task: {
      id: "two-calls-one-read",
      prompt:
        "The body of deck reread already says Start. Add First and then Second to the body, reading it only once.",
      deck: () => fixture("reread", [{ element: "body", before: ["Start"] }]),
      want: {
        calls: 2,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { body: ["Start", "First", "Second"] },
      },
    },
    reference: [...one("reread", "body", "First", 1), ...one("reread", "body", "Second", 1)],
    wrong: { attempt: [...one("reread", "body", "First", 1), ...one("reread", "body", "Second", 5)], reason: "landed" },
  },
  {
    task: {
      id: "undone-run",
      prompt: "Your last run on the title of deck undone was undone. Set the title to Again.",
      deck: () => fixture("undone", [{ element: "title", agent: ["Gone"], undone: true }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["Again"] } },
    },
    reference: one("undone", "title", "Again", 0),
    wrong: { attempt: one("undone", "body", "Again", 0), reason: "touched" },
  },
]
