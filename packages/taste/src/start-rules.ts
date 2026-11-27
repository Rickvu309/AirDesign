import type { StartRules } from "@airdesign/doom"

export const startRules: StartRules = {
  deckName: "Blank deck",
  title: { name: "Title", chars: "Untitled" },
  subtitle: { name: "Subtitle", chars: "Subtitle" },
  marginShare: 1 / 12,
  gapShare: 1 / 60,
  middleShare: 1 / 2,
  titleHighShare: 11 / 125,
  subtitleHighShare: 1 / 8,
  titleTopShare: 2 / 27,
  titleOnlyHighShare: 1 / 9,
  content: {
    text: [{ op: "insert", kind: "text", textStyle: "body", text: "- First point\n- Second point\n- Third point" }],
    grid: [
      {
        op: "insert",
        kind: "frame",
        rows: [
          ["", "Column one", "Column two", "Column three"],
          ["Row one", "Text", "Text", "Text"],
          ["Row two", "Text", "Text", "Text"],
          ["Row three", "Text", "Text", "Text"],
        ],
      },
    ],
  },
}
