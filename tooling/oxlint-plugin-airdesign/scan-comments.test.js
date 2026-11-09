import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { lintSource } from "./harness.js"
import { collectHits, scanSource } from "./scan-comments.js"

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
assertHit(
  "file-level disable in a vue file",
  scanSource("panel.vue", "<script>\n/* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n</script>\n"),
  2,
  suppression,
)
assertHit(
  "file-level disable in a svelte file",
  scanSource(
    "panel.svelte",
    "<script>\n/* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n</script>\n",
  ),
  2,
  suppression,
)
assertHit(
  "astro expression comment",
  scanSource("expr.astro", "---\nconst saved = 1\n---\n{/* hidden */}\n"),
  4,
  comment,
)
assertClean(
  "expression comment inside a string",
  scanSource("expr.astro", '---\nconst saved = "{/* hidden */}"\n---\n'),
)
assertHit(
  "astro style attribute comment",
  scanSource("attr.astro", '<div style="color: black /* hidden */"></div>\n'),
  1,
  comment,
)
assertHit(
  "style attribute after another attribute",
  scanSource("attr.astro", '<div class="x" style="color: black /* hidden */"></div>\n'),
  1,
  comment,
)
assertClean(
  "javascript style string is not a style attribute",
  scanSource("attr.astro", 'const style = "/* hidden */"\n'),
)
assertHit(
  "tsx style attribute comment",
  scanSource("attr.tsx", 'export const node = <div style="color: black /* hidden */" />\n'),
  1,
  comment,
)
assertClean(
  "tsx style string is not a style attribute",
  scanSource("attr.tsx", 'const style = "/* hidden */"\nexport const node = <div />\n'),
)
assertHit("vue html comment", scanSource("panel.vue", "<template>\n<!-- hidden -->\n</template>\n"), 2, comment)
assertHit("vue expression comment", scanSource("panel.vue", "<template>\n{/* hidden */}\n</template>\n"), 2, comment)
assertHit(
  "svelte style block comment",
  scanSource("panel.svelte", "<style>\n.a { color: black /* hidden */ }\n</style>\n"),
  2,
  comment,
)
assertHit(
  "css comment after an unclosed quote",
  scanSource("note.css", 'body { content: "\n/* hidden */ }\n'),
  2,
  comment,
)

assertHit(
  "disable after a regex quote on the same line",
  scanSource("re.ts", 'const re = /"/g /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n'),
  1,
  suppression,
)
assertHit(
  "vue disable after a regex quote",
  scanSource(
    "panel.vue",
    '<script>\nconst re = /"/g /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n</script>\n',
  ),
  2,
  suppression,
)
assertHit("astro expression comment with space", scanSource("spaced.astro", "{ /* hidden */ }\n"), 1, comment)
assertHit(
  "style attribute after a regex quote",
  scanSource("regex-attr.astro", '---\nconst re = /"/g\n---\n<div style="color: black /* hidden */"></div>\n'),
  4,
  comment,
)
assertHit(
  "style attribute on the same line as a regex quote",
  scanSource("regex-attr-line.astro", 'const re = /"/g <div style="color: black /* hidden */"></div>\n'),
  1,
  comment,
)
assertHit(
  "regex after if",
  scanSource("if.ts", 'if (true) /"/ /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n'),
  1,
  suppression,
)
assertHit(
  "regex after default",
  scanSource("default.ts", 'export default /"/ /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n'),
  1,
  suppression,
)
assertHit(
  "regex after a block",
  scanSource("block.ts", 'if (true) {}\n/"/ /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n'),
  2,
  suppression,
)
assertHit(
  "regex after a function with a pattern",
  scanSource("pattern.ts", 'function foo({ a }) {}\n/"/ /* oxlint-disable airdesign/no-comments */\n'),
  2,
  suppression,
)
assertHit(
  "regex after a case block",
  scanSource("case.ts", 'switch (0) {\ncase 1: {}\n/"/ /* oxlint-disable airdesign/no-comments */\n}\n'),
  3,
  suppression,
)
assertHit(
  "vue regex after if",
  scanSource(
    "if.vue",
    '<script>\nif (true) /"/ /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n</script>\n',
  ),
  2,
  suppression,
)
assertHit(
  "astro frontmatter regex after if",
  scanSource(
    "if.astro",
    '---\nif (true) /"/ /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n---\n',
  ),
  2,
  suppression,
)
assertHit(
  "svelte regex after if",
  scanSource(
    "if.svelte",
    '<script>\nif (true) /"/ /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n</script>\n',
  ),
  2,
  suppression,
)
assertHit(
  "svelte module regex after if",
  scanSource("if.svelte.ts", 'if (true) /"/ /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n'),
  1,
  suppression,
)
assertHit(
  "division after a call",
  scanSource("call.ts", "foo() / 2 /* oxlint-disable airdesign/no-comments */\n"),
  1,
  suppression,
)
assertHit(
  "division after an object",
  scanSource("object.ts", "const x = { a: 1 } / 2 /* oxlint-disable airdesign/no-comments */\n"),
  1,
  suppression,
)
assertHit(
  "division after a function expression",
  scanSource("fn.ts", "const fn = function () {} / 2 /* oxlint-disable airdesign/no-comments */\n"),
  1,
  suppression,
)
assertHit(
  "division after an async function expression",
  scanSource("fn.ts", "const fn = async function () {} / 2 /* oxlint-disable airdesign/no-comments */\n"),
  1,
  suppression,
)
assertHit(
  "division after a class expression",
  scanSource("fn.ts", "const A = class {} / 2 /* oxlint-disable airdesign/no-comments */\n"),
  1,
  suppression,
)
assertHit(
  "regex disable in a function expression",
  scanSource("fn.ts", 'const fn = function () {\n  /"/ /* oxlint-disable airdesign/no-comments */\n  return 1\n}\n'),
  2,
  suppression,
)
assertHit(
  "regex disable in an async function expression",
  scanSource(
    "fn.ts",
    'const fn = async function () {\n  /"/ /* oxlint-disable airdesign/no-comments */\n  return 1\n}\n',
  ),
  2,
  suppression,
)
assertHit(
  "regex disable in a generator function expression",
  scanSource("fn.ts", 'const fn = function* () {\n  /"/ /* oxlint-disable airdesign/no-comments */\n  return 1\n}\n'),
  2,
  suppression,
)
assertHit(
  "regex disable in a default async function",
  scanSource(
    "fn.ts",
    'export default async function () {\n  /"/ /* oxlint-disable airdesign/no-comments */\n  return 1\n}\n',
  ),
  2,
  suppression,
)
assertHit(
  "regex after a default async function",
  scanSource(
    "fn.ts",
    'export default async function () {}\n/"/ /* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n',
  ),
  2,
  suppression,
)
assertHit(
  "regex disable in an immediate function",
  scanSource("fn.ts", '(function () {\n  /"/ /* oxlint-disable airdesign/no-comments */\n  return 1\n})()\n'),
  2,
  suppression,
)
assertHit(
  "regex disable in a nested function block",
  scanSource(
    "fn.ts",
    'const fn = function () {\n  {\n    /"/ /* oxlint-disable airdesign/no-comments */\n    return 1\n  }\n}\n',
  ),
  3,
  suppression,
)
assertHit(
  "regex disable in a callback function",
  scanSource(
    "fn.ts",
    'items.map(function (item) {\n  /"/ /* oxlint-disable airdesign/no-comments */\n  return item\n})\n',
  ),
  2,
  suppression,
)
assertHit(
  "regex disable in a jsx attribute",
  scanSource(
    "node.tsx",
    'export const node = <div x={/"/ /* oxlint-disable airdesign/no-comments */} />\nexport const saved = 1\n',
  ),
  1,
  suppression,
)
assertHit(
  "regex disable in a generic jsx attribute",
  scanSource(
    "node.tsx",
    'export const node = <Box<string> x={/"/ /* oxlint-disable airdesign/no-comments */} />\nexport const saved = 1\n',
  ),
  1,
  suppression,
)
assertClean(
  "directive inside a function expression string",
  scanSource("fn.ts", 'const fn = function () {\n  return "/* oxlint-disable airdesign/no-comments */"\n}\n'),
)
assertHit(
  "regex disable after break",
  scanSource(
    "break.ts",
    'for (;;) {\n  break\n  /"/ /* oxlint-disable airdesign/no-comments */\n  const saved = 1\n}\n',
  ),
  3,
  suppression,
)
assertHit(
  "regex disable after a break label",
  scanSource(
    "break.ts",
    'label: for (;;) {\n  break label\n  /"/ /* oxlint-disable airdesign/no-comments */\n  const saved = 1\n}\n',
  ),
  3,
  suppression,
)
assertHit(
  "regex disable after continue",
  scanSource(
    "break.ts",
    'for (;;) {\n  continue\n  /"/ /* oxlint-disable airdesign/no-comments */\n  const saved = 1\n}\n',
  ),
  3,
  suppression,
)
assertHit(
  "regex disable after debugger",
  scanSource("debug.ts", 'debugger\n/"/ /* oxlint-disable airdesign/no-comments */\nconst saved = 1\n'),
  2,
  suppression,
)
assertHit(
  "regex disable after import",
  scanSource("import.ts", 'import "node:fs"\n/"/ /* oxlint-disable airdesign/no-comments */\nconst saved = 1\n'),
  2,
  suppression,
)
assertHit(
  "regex disable after a named import",
  scanSource(
    "import.ts",
    'import fs from "node:fs"\n/"/ /* oxlint-disable airdesign/no-comments */\nconst saved = 1\n',
  ),
  2,
  suppression,
)
assertHit(
  "regex disable after for await",
  scanSource(
    "for.ts",
    'async function read() {\n  for await (const item of items) /"/ /* oxlint-disable airdesign/no-comments */\n  const saved = 1\n}\n',
  ),
  2,
  suppression,
)
assertHit(
  "regex disable after an interface",
  scanSource(
    "types.ts",
    'interface Foo { a: number }\n/"/ /* oxlint-disable airdesign/no-comments */\nconst saved = 1\n',
  ),
  2,
  suppression,
)
assertHit(
  "regex disable after a type",
  scanSource("types.ts", 'type Foo = number\n/"/ /* oxlint-disable airdesign/no-comments */\nconst saved = 1\n'),
  2,
  suppression,
)
assertHit(
  "regex disable after an enum",
  scanSource("types.ts", 'enum Foo { A }\n/"/ /* oxlint-disable airdesign/no-comments */\nconst saved = 1\n'),
  2,
  suppression,
)
assertHit(
  "regex disable after an exported interface",
  scanSource(
    "types.ts",
    'export interface Foo { a: number }\n/"/ /* oxlint-disable airdesign/no-comments */\nconst saved = 1\n',
  ),
  2,
  suppression,
)
assertHit(
  "regex disable after a namespace",
  scanSource(
    "types.ts",
    'namespace Foo { export const a = 1 }\n/"/ /* oxlint-disable airdesign/no-comments */\nconst saved = 1\n',
  ),
  2,
  suppression,
)
assertClean(
  "division after a string is not a regex",
  scanSource("div.ts", 'const saved = "hi"\n/"/ /* oxlint-disable airdesign/no-comments */\n'),
)
assertClean(
  "division after a dynamic import is not a regex",
  scanSource("import.ts", 'const saved = import("node:fs")\n/"/ /* oxlint-disable airdesign/no-comments */\n'),
)
assertClean(
  "style text in an astro expression string",
  scanSource("page.astro", "<p>{'<a style=\"/* hidden */\"></a>'}</p>\n"),
)
assertClean(
  "style text in an astro expression template",
  scanSource("page.astro", '<p>{`<a style="/* hidden */"></a>`}</p>\n'),
)
assertClean(
  "style text in a svelte expression string",
  scanSource("panel.svelte", "<p>{'<a style=\"/* hidden */\"></a>'}</p>\n"),
)
assertClean(
  "style text in a vue mustache string",
  scanSource("panel.vue", "<template><p>{{ '<a style=\"/* hidden */\"></a>' }}</p></template>\n"),
)
assertClean(
  "style text in a nested template",
  scanSource("node.tsx", 'export const saved = `${`<div style="/* hidden */" />`}`\n'),
)
assertHit(
  "division after postfix",
  scanSource("post.ts", "a++ / 2 /* oxlint-disable airdesign/no-comments */\n"),
  1,
  suppression,
)
assertHit(
  "regex after spread",
  scanSource("spread.ts", 'const items = [.../"/ /* oxlint-disable airdesign/no-comments */]\n'),
  1,
  suppression,
)
assertHit(
  "astro text quote before an expression comment",
  scanSource("quote-expr.astro", '" { /* hidden */ }\n'),
  1,
  comment,
)
assertHit("astro text quote before an html comment", scanSource("quote-html.astro", '" <!-- hidden -->\n'), 1, comment)
assertHit(
  "astro text quote before a style attribute",
  scanSource("quote-style.astro", "\" <div style='color: black /* hidden */'></div>\n"),
  1,
  comment,
)
assertHit(
  "disable after a script string that mentions the close tag",
  scanSource(
    "close.vue",
    '<script>\nconst saved = "</script>"\n/* oxlint-disable airdesign/no-comments */\n</script>\n',
  ),
  3,
  suppression,
)
assertClean(
  "disable text inside a script string",
  scanSource(
    "close.vue",
    '<script>\nconst saved = "</script> /* oxlint-disable airdesign/no-comments */"\n</script>\n',
  ),
)
assertClean("html comment text in frontmatter", scanSource("page.astro", '---\nconst saved = "<!-- hidden -->"\n---\n'))
assertHit(
  "regex disable in a method",
  scanSource(
    "method.ts",
    'const saved = {\n  m() {\n    /"/ /* oxlint-disable airdesign/no-comments */\n    return 1\n  },\n}\n',
  ),
  3,
  suppression,
)
assertHit(
  "regex disable in a class method",
  scanSource(
    "class.ts",
    'class A {\n  m() {\n    /"/ /* oxlint-disable airdesign/no-comments */\n    return 1\n  }\n}\n',
  ),
  3,
  suppression,
)
assertHit(
  "regex disable in a static block",
  scanSource(
    "static.ts",
    'class A {\n  static {\n    /"/ /* oxlint-disable airdesign/no-comments */\n    const saved = 1\n  }\n}\n',
  ),
  3,
  suppression,
)
assertHit(
  "regex disable in a jsx expression",
  scanSource("node.tsx", 'export const node = <div>{/"/ /* oxlint-disable airdesign/no-comments */}</div>\n'),
  1,
  suppression,
)
assertHit("astro expression comment after code", scanSource("expr.astro", "{1 /* hidden */}\n"), 1, comment)
assertHit(
  "svelte expression comment after code",
  scanSource("panel.svelte", "<div>{1 /* hidden */}</div>\n"),
  1,
  comment,
)
assertClean("astro template literal is not an html comment", scanSource("expr.astro", "{`<!-- hidden -->`}\n"))
assertClean(
  "style tag inside a script string",
  scanSource("panel.vue", '<script>\nconst saved = "<style> /* hidden */ </style>"\n</script>\n'),
)

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-scan-"))
try {
  const hidden = path.join(fixtureRoot, "tooling", ".fixture-run")
  fs.mkdirSync(hidden, { recursive: true })
  fs.writeFileSync(
    path.join(hidden, "sneak.ts"),
    "/* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n",
  )
  assertHit("file-level disable under .fixture-run", collectHits(fixtureRoot, ["tooling"]), 1, suppression)
  const generated = path.join(fixtureRoot, "scripts", ".astro")
  fs.mkdirSync(generated, { recursive: true })
  fs.writeFileSync(
    path.join(generated, "sneak.ts"),
    "/* oxlint-disable airdesign/no-comments */\nexport const saved = 1\n",
  )
  assertHit("file-level disable under .astro", collectHits(fixtureRoot, ["scripts"]), 1, suppression)
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
}

assertClean("quoted yaml color", scanSource("color.yaml", 'color: "#222222"\n'))
assertClean("quoted yaml url hash", scanSource("url.yml", 'url: "https://example.com/a#b"\n'))

console.log("scan-comments tests passed")
