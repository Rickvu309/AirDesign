import { lintSource } from "./harness.js"
import { scanSource } from "./scan-comments.js"

const rule = { "airdesign/no-comments": "error" }
const suppression =
  "Remove this suppression. eslint-disable and oxlint-disable are comments, and comments are not allowed."
const comment = "Remove this comment."

const assertHit = (name, hits, line, message) => {
  const match = hits.find((hit) => hit.includes(`:${line}: `) && hit.endsWith(message))
  if (!match) throw new Error(`${name}\n${hits.join("\n")}`)
}

const assertClean = (name, hits) => {
  if (hits.length !== 0) throw new Error(`${name}\n${hits.join("\n")}`)
}

const fileDisable = "/* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n"
const fileHits = scanSource("oxlint-file.ts", fileDisable)
assertHit("file-level oxlint-disable", fileHits, 1, suppression)

const linted = lintSource("oxlint-file.ts", fileDisable, rule)
if (linted.status !== 0) {
  throw new Error(`file-level oxlint-disable should pass oxlint and still fail the scanner\n${linted.output}`)
}
if (fileHits.length === 0) {
  throw new Error("a passing oxlint status let the file-level disable through the scanner")
}

const lineDisable = "// oxlint-disable-next-line airdesign/no-comments\nexport const saved = 1\n"
assertHit("oxlint-disable-next-line", scanSource("line.ts", lineDisable), 1, suppression)

const splitDisable = "/*\noxlint-disable airdesign/no-comments\n*/\nexport const saved = 1\n"
assertHit("split block oxlint-disable", scanSource("split.ts", splitDisable), 2, suppression)

const quoted = 'export const saved = "/* oxlint-disable airdesign/no-comments */"\n'
assertClean("directive inside a string", scanSource("quoted.ts", quoted))

const templated = "export const saved = `/* oxlint-disable airdesign/no-comments */`\n"
assertClean("directive inside a template", scanSource("templated.ts", templated))

assertHit("css block comment", scanSource("note.css", "body { color: black /* hidden */ }\n"), 1, comment)
assertHit("yaml hash comment", scanSource("note.yaml", "name: deck # hidden\n"), 1, comment)
assertHit(
  "astro html comment",
  scanSource("page.astro", "---\nconst saved = 1\n---\n<!-- hidden -->\n<p>{saved}</p>\n"),
  4,
  comment,
)
assertHit(
  "astro style comment",
  scanSource("styled.astro", "<style>\n.a { color: black /* hidden */ }\n</style>\n"),
  2,
  comment,
)
assertClean(
  "astro style quoted comment text",
  scanSource("styled-quoted.astro", '<style>\n.a { content: "/* hidden */" }\n</style>\n'),
)
assertHit(
  "astro style comment after a quoted close tag",
  scanSource("styled-bypass.astro", '<style>\n.a { content: "</style>" }\n/* hidden */\n</style>\n'),
  3,
  comment,
)
assertHit(
  "astro style comment after a close tag inside a comment",
  scanSource("styled-comment-close.astro", "<style>\n/* </style> */\n.a { /* hidden */ }\n</style>\n"),
  3,
  comment,
)
assertHit(
  "second astro style block after a quoted close tag",
  scanSource("styled-second.astro", '<style>\n.a { content: "</style>" }\n</style>\n<style>\n/* hidden */\n</style>\n'),
  5,
  comment,
)
assertHit(
  "file-level disable in a cts file",
  scanSource("module.cts", "/* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n"),
  1,
  suppression,
)

assertClean("quoted yaml color", scanSource("color.yaml", 'color: "#222222"\n'))
assertClean("quoted yaml url hash", scanSource("url.yml", 'url: "https://example.com/a#b"\n'))

console.log("scan-comments tests passed")
