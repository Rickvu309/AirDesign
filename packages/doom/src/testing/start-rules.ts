import type { StartRules } from "../start-rules.js"

export const starts: StartRules = {
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
    text: [
      {
        op: "add",
        kind: "text",
        textStyle: "body",
        text: ["First point", "Second point", "Third point"].map((point) => `- ${point}`).join("\n"),
      },
    ],
    grid: [
      {
        op: "add",
        kind: "frame",
        rows: [
          ["", "Column one", "Column two", "Column three"],
          ...["Row one", "Row two", "Row three"].map((row) => [row, "Text", "Text", "Text"]),
        ],
      },
    ],
  },
}
