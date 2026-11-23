import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  builtFolders,
  citesPaths,
  codeFaults,
  coverFaults,
  glossaryFaults,
  markdownFaults,
  pathListFaults,
  repoIndex,
} from "./cited-paths.mjs"
import { drifted } from "./spec-sync.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tracked = execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean)
const index = repoIndex(tracked)
const read = (file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : null)

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const cited = (faults) => faults.map((fault) => /`([^`]+)`/.exec(fault)?.[1])

same(
  "replaying scripts/unit-shards.rule.md before ddc433a68 names the deleted deck-paint test",
  cited(
    markdownFaults(
      "scripts/unit-shards.rule.md",
      "the whole run's number is the sum of the shards; only the shard that runs `apps/web/src/deck-paint.test.ts` prints `slides-repainted`. `unit-shards.test.mjs` holds the split",
      index,
    ),
  ),
  ["apps/web/src/deck-paint.test.ts"],
)

same(
  "replaying apps/web/src/editor/use-deck-open.rule.md before this check names the three tests the old editor's removal deleted",
  cited(
    markdownFaults(
      "apps/web/src/editor/use-deck-open.rule.md",
      "`use-deck-open.test.tsx` marks the deck opened only after its index is sent. `packages/render/src/filmstrip.test.ts`, `font-wait.test.ts` and `use-grid-viewport.test.tsx` hold the deck unsettled. `tests/browser/deck-ready-font.spec.ts` paints a deck's text while its font is held",
      index,
    ),
  ),
  ["use-deck-open.test.tsx", "use-grid-viewport.test.tsx", "tests/browser/deck-ready-font.spec.ts"],
)

same(
  "replaying the Aira panel feature doc before 4aeae03dc names the deleted Aira panel spec",
  cited(
    markdownFaults(
      ".agents/skills/verify-airdesign/features/aira-panel.md",
      "- The 402 limit and `Stop` during the model's reply are proven in `tests/browser/aira-panel.spec.ts`, which fills the ledger and holds the scripted stream.",
      index,
    ),
  ),
  ["tests/browser/aira-panel.spec.ts"],
)

same(
  "replaying scripts/metrics.mjs before this check names the drag spec the old editor's removal deleted",
  cited(codeFaults("scripts/metrics.mjs", '  "drag-frame": "tests/browser/drag-feel.spec.ts",', index)),
  ["tests/browser/drag-feel.spec.ts"],
)

same(
  "replaying the glossary before ddc433a68 names the moved adjust-tone file",
  glossaryFaults(
    {
      allowed: [
        {
          file: "apps/web/src/editor/adjust-tone.tsx",
          text: 'className="grid aspect-square touch-none"',
          reason: "the Tailwind class lays out the colour dial",
        },
      ],
    },
    read,
  ).length,
  1,
)

same(
  "an allowed glossary line its file no longer holds is named",
  glossaryFaults({ allowed: [{ file: "package.json", text: '"name": "slides"', reason: "a sample" }] }, read).length,
  1,
)

same(
  "replaying pptx-paths.txt before 730385c96 names the deleted export helper",
  pathListFaults(
    ".github/actions/ci-changes/pptx-paths.txt",
    "scripts/pptx-check.mjs\nscripts/blank-export.mjs\n",
    index,
  ),
  [
    ".github/actions/ci-changes/pptx-paths.txt:2: scripts/blank-export.mjs names no file or folder in the repo. Point it at the file that holds this now, or drop the words that name it.",
  ],
)

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "cited-paths-"))
try {
  fs.mkdirSync(path.join(folder, "specs", "turn"), { recursive: true })
  fs.writeFileSync(
    path.join(folder, "specs", "turn", "covers.json"),
    JSON.stringify({
      check: "checks-server.md#turn",
      covers: [{ file: "packages/mcp/src/turn.ts", names: ["liveTurn"], digest: "d7dddbc880f0", blob: "cf44ccb4" }],
    }),
  )
  fs.mkdirSync(path.join(folder, "packages", "mcp", "src"), { recursive: true })
  fs.writeFileSync(path.join(folder, "packages", "mcp", "src", "edit-tool.ts"), "export const editDeckTool = 1\n")
  fs.mkdirSync(path.join(folder, "specs", "agents"), { recursive: true })
  fs.writeFileSync(
    path.join(folder, "specs", "agents", "covers.json"),
    JSON.stringify({
      check: "checks-server.md#agents",
      covers: [
        { file: "packages/mcp/src/edit-tool.ts", names: ["editDeck"], digest: "6b1698ca9ae1", blob: "eeecbcba" },
      ],
    }),
  )
  same(
    "replaying the turn and agents covers before 47ece2d72 and 9b95e2a96 names the deleted file and the deleted function",
    coverFaults(drifted(folder)),
    [
      "specs/agents/covers.json: editDeck is not declared in packages/mcp/src/edit-tool.ts. Point the cover at the declaration that holds it now, or drop the name.",
      "specs/turn/covers.json: packages/mcp/src/turn.ts is gone. Point the cover at the file that holds liveTurn now, or drop it.",
    ],
  )
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

same(
  "a path from the repo root, a path from the citing file's folder, a name beside it and a name one file has resolve",
  markdownFaults(
    ".agents/skills/verify-airdesign/features/aira-turn.md",
    "`apps/web/src/doom-editor/doom-editor.tsx`, `../bin/verify-airdesign.mjs`, `deck-names.md` and `filmstrip.test.ts`",
    index,
  ),
  [],
)

same(
  "replaying scripts/design-shards.rule.md, which named the look states test from the skill's folder, needs the path from the root: an end of some path no longer passes",
  cited(markdownFaults("scripts/design-shards.rule.md", "`look/states.test.mjs` holds the split", index)),
  ["look/states.test.mjs"],
)

same(
  "after PR 1409 moved airdesign-mark-art.ts into components/ui, its bare name names two files and passes only with its folder",
  markdownFaults("apps/web/src/decks/airdesign-mark.rule.md", "`airdesign-mark-art.ts` holds the mark's paths", index),
  [
    "apps/web/src/decks/airdesign-mark.rule.md:1: `airdesign-mark-art.ts` names 2 files and none beside this one. Write it with its folder from the repo root.",
  ],
)

same(
  "a moved file named by its old path from the root fails, as apps/web/src/editor/shape-grid.tsx did after PR 1409",
  cited(markdownFaults("AGENTS.md", "`apps/web/src/editor/shape-grid.tsx` draws the presets", index)),
  ["apps/web/src/editor/shape-grid.tsx"],
)

same(
  "a command in package.json, a workflow, a shell script or a code string names a script that must exist",
  [
    ...codeFaults("package.json", '    "rules": "node scripts/gone-rules.mjs",', index),
    ...codeFaults(".github/workflows/ci.yml", "        run: node scripts/gone-ci.mjs --part=source", index),
    ...codeFaults("scripts/pptx-tools.sh", 'exec node scripts/gone-tools.mjs "$@"', index),
    ...codeFaults("scripts/land.mjs", 'const hint = "Run node scripts/gone-hint.mjs first"', index),
  ].map((fault) => /`([^`]+)`/.exec(fault)?.[1]),
  ["scripts/gone-rules.mjs", "scripts/gone-ci.mjs", "scripts/gone-tools.mjs", "scripts/gone-hint.mjs"],
)

same(
  "run outputs, globs, placeholders, routes, package names, extensions and fenced code are not citations",
  markdownFaults(
    "AGENTS.md",
    "`proof.md`, `deck-state.json`, `packages/*/dist`, `specs/<topic>/covers.json`, `/screens/<id>-<name>`, `@airdesign/doom`, `.ts`, `https://example.com/a.ts`\n```\nnode scripts/gone.mjs\n```",
    index,
  ),
  [],
)

same(
  "a relative link to a deleted page is named",
  cited(markdownFaults(".agents/skills/verify-airdesign/SKILL.md", "See [agent bench](agent-bench.md).", index)),
  ["agent-bench.md"],
)

same(
  "a fault names the file, the line and the fix",
  markdownFaults("CHECKS.md", "one\n`scripts/gone.mjs` holds it", index),
  [
    "CHECKS.md:2: `scripts/gone.mjs` names no file or folder from the repo root or from this file's folder. Write the path from the repo root, or point it at the file that holds this now.",
  ],
)

same(
  "a path into a folder git ignores, such as a build, is not a citation",
  markdownFaults(
    ".agents/skills/verify-airdesign/SKILL.md",
    "serve `apps/web/dist` and load `packages/doom/dist/index.js`",
    repoIndex(tracked, builtFolders("node_modules/\ndist/\n*.tsbuildinfo\n")),
  ),
  [],
)

same(
  "replaying scripts/areas.json at 95d815a94, which deleted apps/web/src/pricing/ and kept it in the aira area, names the folder and a prefix no file starts with",
  cited(
    codeFaults(
      "scripts/areas.json",
      '      "apps/web/src/pricing/",\n      "apps/web/src/gone-usage-",\n      "apps/web/src/credits/",\n      "apps/web/src/copy/usage-",',
      repoIndex(tracked.filter((file) => !file.startsWith("apps/web/src/pricing/"))),
    ),
  ),
  ["apps/web/src/pricing/", "apps/web/src/gone-usage-"],
)

same(
  "urls, globs, placeholders, builds, words with a slash and prefixes some file starts with are not faults in code",
  codeFaults(
    "scripts/land.mjs",
    'const a = ["https://studio.airdesign.app/mcp", "packages/*/src/", "apps/${name}/", "specs/<topic>/", "apps/web/dist/", "node_modules/.bin/", "and/or", "apps/web/src/doom-", "scripts/"]',
    repoIndex(tracked, builtFolders("node_modules/\ndist/\n")),
  ),
  [],
)

same(
  "deleting packages/render/src/store.test.ts leaves the timing records pnpm timings writes untouched, and cited-paths reads past them as data",
  [
    "tests/unit-seconds.json",
    "tests/browser/spec-seconds.json",
    "tests/journeys/journey-seconds.json",
    "scripts/areas.json",
  ].filter(citesPaths),
  ["scripts/areas.json"],
)

same(
  "a hand-written config that names a deleted test still fails",
  cited(codeFaults("scripts/areas.json", '{ "render": ["packages/render/src/gone-store.test.ts"] }', index)),
  ["packages/render/src/gone-store.test.ts"],
)
