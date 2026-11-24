import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { deadCode, deadCopy, report } from "./dead-code.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const repo = fs.mkdtempSync(path.join(os.tmpdir(), "dead-code-"))
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
  fs.writeFileSync(path.join(repo, file), text)
}

write(
  "apps/web/src/main.tsx",
  `import { used } from "@airdesign/shapes"\nimport { marks } from "@airdesign/shapes/marks"\nimport { words } from "./copy/words.ts"\nused()\nmarks()\nwords.dotted\n`,
)
write(
  "packages/shapes/src/index.ts",
  `export { used, unused } from "./used.ts"\nexport { onlyTested } from "./only-tested.ts"\n`,
)
write("packages/shapes/src/used.ts", `export const used = () => 1\nexport const unused = () => 2\n`)
write("packages/shapes/src/only-tested.ts", `export const onlyTested = () => 3\n`)
write(
  "packages/shapes/src/only-tested.test.ts",
  `import { onlyTested } from "./only-tested.ts"\nexport const checked = () => onlyTested()\n`,
)
write("packages/shapes/src/testing/art.ts", `export const art = () => 8\n`)
write("packages/shapes/src/art-use.test.ts", `import { art } from "./testing/art.ts"\nart()\n`)
write("packages/shapes/src/board/testing/more-art.ts", `export const moreArt = () => 9\n`)
write("packages/shapes/src/more-art-use.test.ts", `import { moreArt } from "./board/testing/more-art.ts"\nmoreArt()\n`)
write("packages/shapes/src/lazy.ts", `export const lazy = () => 4\n`)
write("packages/shapes/src/lazy.test.ts", `const { lazy } = await import("./lazy.ts")\nlazy()\n`)
write("scripts/runner.mjs", `import { checked } from "../packages/shapes/src/only-tested.test.ts"\nchecked()\n`)
write("apps/api/src/server.ts", `import { migrate } from "./platform/migrate.ts"\nmigrate()\n`)
write("apps/api/src/platform/migrate.ts", `export const migrate = () => new URL("./migrations/", import.meta.url)\n`)
write("apps/api/src/platform/migrations/0001-start.ts", `export const up = "create table decks ()"\n`)
write(
  "apps/web/src/copy/words.ts",
  `export const requiredWords = "Required"\nexport const words = { dotted: "Open", planted: "Unused" }\n`,
)
write(
  ".agents/skills/look/bin/copy.mjs",
  `import { createRequire } from "node:module"\nexport const { words } = createRequire(import.meta.url)("../../../../apps/web/src/copy/words.ts")\n`,
)
write("apps/web/src/shown.ts", `export const shown = () => 5\n`)
write(".agents/skills/look/states/open.mjs", `import { shown } from "../../../../apps/web/src/shown.ts"\nshown()\n`)
write("packages/shapes/src/marks.ts", `export const marks = () => 10\n`)
write(
  "packages/shapes/package.json",
  `{ "name": "@airdesign/shapes", "exports": { ".": { "import": "./dist/index.js" }, "./marks": { "import": "./dist/marks.js" } } }\n`,
)
write("packages/shapes/src/export.ts", `export const exported = () => 6\nexport const unread = () => 7\n`)
write(
  "scripts/export-check.mjs",
  `import { packageBuild } from "./package-build.mjs"\nconst { exported } = await packageBuild(root, "@airdesign/shapes", "export.js")\nexported()\n`,
)
write("packages/shapes/src/connector.ts", `export const routed = () => 8\n`)
write("packages/shapes/src/shared.ts", `export const shared = () => 9\n`)
write(
  "packages/shapes/src/index.ts",
  `export { used, unused } from "./used.ts"\nexport { onlyTested } from "./only-tested.ts"\nexport { routed } from "./connector.ts"\nexport { shared } from "./shared.ts"\n`,
)
write(
  "scripts/planted.mjs",
  `const routed = (route, describe) => route\nrouted("text replaced")\nconst row = { routed: true }\n`,
)
write("scripts/use-shapes.mjs", `export const run = (shapes) => shapes.shared()\n`)
write(
  "scripts/load-shapes.mjs",
  `import { packageBuild } from "./package-build.mjs"\nconst shapes = await packageBuild(root, "@airdesign/shapes")\nshapes.used()\n`,
)
write("apps/web/src/copy/words.test.ts", `import { words } from "./words.ts"\nwords.planted\n`)
write("apps/site/src/sign-in-copy.ts", `export const siteCopy = { send: "Send", unused: "Unused" }\n`)
write(
  "apps/site/src/sign-in.astro",
  `---\nimport { siteCopy as words } from "./sign-in-copy"\n---\n<p>{words.send}</p>\n`,
)
execFileSync("git", ["init", "-q"], { cwd: repo })

try {
  const dead = deadCode(repo)
  same("a copy key read only by a test is unused", deadCopy(repo), [
    { file: "apps/site/src/sign-in-copy.ts", key: "siteCopy.unused", line: 1 },
    { file: "apps/web/src/copy/words.ts", key: "words.planted", line: 2 },
  ])

  write(
    "apps/web/src/copy/words.ts",
    `export const words = { dotted: "Dotted", jsOnly: "JS only", nested: { bracketed: "Bracketed" }, whole: { one: "One", two: "Two" }, unused: "Unused" }`,
  )
  write(
    ".agents/skills/look/states/copy.mjs",
    `import { words as labels } from "../bin/copy.mjs"\nlabels.jsOnly\nlabels["nested"]?.["bracketed"]\nObject.values(labels.whole)\nlabels["removed"]\n`,
  )
  same("JavaScript reads through a copy loader are checked in both directions", deadCopy(repo), [
    { file: "apps/site/src/sign-in-copy.ts", key: "siteCopy.unused", line: 1 },
    { file: "apps/web/src/copy/words.ts", key: "words.unused", line: 1 },
    { file: ".agents/skills/look/states/copy.mjs", key: "words.removed", line: 5, missing: true },
  ])

  same(
    "a file only tests use is dead, even when a test loads it by path or a script imports that test",
    dead.deadFiles.map((each) => [each.file, each.tests]),
    [
      ["packages/shapes/src/connector.ts", []],
      ["packages/shapes/src/lazy.ts", ["packages/shapes/src/lazy.test.ts"]],
      ["packages/shapes/src/only-tested.ts", ["packages/shapes/src/only-tested.test.ts"]],
    ],
  )
  same(
    "a helper in a testing folder is test support, not a dead product file",
    dead.deadFiles.some((each) => each.file.includes("/testing/")),
    false,
  )
  same(
    "a declaration no root reaches is dead inside a live file",
    dead.deadUnits.map((each) => [each.file, each.names, each.line]),
    [
      ["packages/shapes/src/export.ts", ["unread"], 2],
      ["packages/shapes/src/used.ts", ["unused"], 2],
    ],
  )
  same(
    "a migration its runner loads by folder is alive",
    dead.chainTo("apps/api/src/platform/migrations/0001-start.ts", "up"),
    [
      "apps/api/src/server.ts:line 2",
      "apps/api/src/platform/migrate.ts:migrate",
      "apps/api/src/platform/migrations/0001-start.ts:up",
    ],
  )
  same(
    "a skill that requires a copy file by path keeps it alive",
    dead.chainTo("apps/web/src/copy/words.ts", "requiredWords"),
    [".agents/skills/look/bin/copy.mjs:line 2", "apps/web/src/copy/words.ts:requiredWords"],
  )
  same("a skill's look state is a root", dead.chainTo("apps/web/src/shown.ts", "shown"), [
    ".agents/skills/look/states/open.mjs:line 2",
    "apps/web/src/shown.ts:shown",
  ])
  same(
    "a script that loads a package's build by name keeps each name it reads alive",
    [
      dead.chainTo("packages/shapes/src/export.ts", "exported"),
      dead.chainTo("packages/shapes/src/export.ts", "unread"),
    ],
    [["packages/shapes/src/export.ts:exported"], []],
  )
  same(
    "a routed local in another script does not keep an export of a package that script never loads",
    dead.chainTo("packages/shapes/src/connector.ts", "routed"),
    [],
  )
  same(
    "a subpath named in package.json exports is a real import",
    dead.chainTo("packages/shapes/src/marks.ts", "marks"),
    ["apps/web/src/main.tsx:line 5", "packages/shapes/src/marks.ts:marks"],
  )
  same(
    "a property read in another script keeps an export of a package some script loads",
    dead.chainTo("packages/shapes/src/shared.ts", "shared"),
    ["packages/shapes/src/shared.ts:shared"],
  )
  same(
    "that export's file is dead",
    dead.deadFiles.some((each) => each.file === "packages/shapes/src/connector.ts"),
    true,
  )
  same("a dead declaration has no chain", dead.chainTo("packages/shapes/src/only-tested.ts", "onlyTested"), [])
  same(
    "a name the file does not declare has no answer",
    dead.chainTo("packages/shapes/src/used.ts", "missing"),
    undefined,
  )
  same("the report ends with the counts", report(dead).split("\n").at(-1), "3 dead files, 2 dead declarations")
} finally {
  fs.rmSync(repo, { recursive: true, force: true })
}
