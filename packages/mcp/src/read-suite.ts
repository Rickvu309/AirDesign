import { fixture } from "./fixture.js"
import { edit, readDeck } from "./score.js"
import type { SuiteRow } from "./suite.js"
import { elements } from "./score.js"

export const readSuite: readonly SuiteRow[] = [
  {
    task: {
      id: "read-untouched-then-edit",
      prompt:
        "Read untouched deck imported with airdesign_read_deck, then change its title from Draft to North star using the reported version.",
      deck: () =>
        fixture("imported", [], (register) => ({
          ...register,
          index: {
            total: 1,
            slides: [{ id: "258", position: 0 }],
            elements: [
              {
                node: elements.title,
                kind: "shape",
                value: "Draft",
                box: { x: 1, y: 2, cx: 3, cy: 4 },
                grouped: false,
              },
            ],
            pages: [{ once: "import", offset: 0, count: 1 }],
          },
        })),
      want: {
        calls: 2,
        steps: [
          { name: "read_deck", outcome: "ok" },
          { name: "edit_deck", outcome: "ok" },
        ],
        elements: { title: ["North star"] },
      },
    },
    reference: [readDeck("imported"), edit("imported", [{ element: "title", value: "North star", readAt: 0 }], 0)],
    wrong: {
      attempt: [readDeck("imported"), edit("imported", [{ element: "title", value: "North star", readAt: 1 }], 0)],
      reason: "tool",
    },
  },
  {
    task: {
      id: "read-then-edit",
      prompt:
        "Read deck noted with airdesign_read_deck, then set its title to North star. The title already says Draft. Send the version that read reports as readAt.",
      deck: () => fixture("noted", [{ element: "title", before: ["Draft"] }]),
      want: {
        calls: 2,
        steps: [
          { name: "read_deck", outcome: "ok" },
          { name: "edit_deck", outcome: "ok" },
        ],
        elements: { title: ["Draft", "North star"] },
      },
    },
    reference: [readDeck("noted"), edit("noted", [{ element: "title", value: "North star", readAt: 1 }], 0)],
    wrong: {
      attempt: [readDeck("noted"), edit("noted", [{ element: "title", value: "North star", readAt: 0 }], 0)],
      reason: "tool",
    },
  },
]
