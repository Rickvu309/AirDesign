import fs from "node:fs"
import { areaMap, areasOf } from "./areas.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const cases = [
  ["apps/web/src/thin-deck.tsx", ["editor"]],
  ["apps/web/src/editor/editor-shell.tsx", ["editor"]],
  ["apps/web/src/export/export-dialog.tsx", ["editor"]],
  ["packages/render/src/canvas.tsx", ["editor"]],
  ["apps/web/src/aira/aira-panel.tsx", ["aira"]],
  ["apps/web/src/copy/aira-copy.ts", ["aira"]],
  ["apps/web/src/credits/limit-panel.tsx", ["aira"]],
  ["apps/web/src/settings/usage-page.tsx", ["aira"]],
  ["apps/api/src/aira/aira-stream.ts", ["aira"]],
  ["apps/api/src/agent-turn.ts", ["aira"]],
  ["apps/api/src/turn.test.ts", ["aira"]],
  ["apps/api/src/mcp/mcp.ts", ["aira"]],
  ["packages/mcp/src/index.ts", ["aira"]],
  ["packages/usage/src/index.ts", ["aira"]],
  ["tests/browser/aira-panel.spec.ts", ["aira"]],
  ["apps/api/src/agent-commit-race.test.ts", ["aira"]],
  ["tests/browser/slide-paint.spec.ts", ["editor"]],
  ["tests/browser/site-mobile.spec.ts", []],
  ["apps/web/src/decks/home.tsx", ["deck-home"]],
  ["apps/api/src/doom/deck-list.ts", ["deck-home"]],
  ["tests/browser/home-search.spec.ts", ["deck-home"]],
  ["apps/site/src/access/sign-in-requests.ts", ["sign-in"]],
  ["apps/site/src/pages/sign-in.astro", ["sign-in"]],
  ["apps/api/src/sign-in.test.ts", ["sign-in"]],
  ["apps/api/src/oauth.test.ts", ["sign-in"]],
  ["apps/api/src/oauth/grants.ts", ["sign-in"]],
  ["apps/web/src/connect/approve-agent.tsx", ["sign-in"]],
  ["apps/web/src/settings/agents-page.tsx", ["sign-in"]],
  ["packages/oauth/src/index.ts", ["sign-in"]],
  ["packages/pptx/src/write.ts", ["pptx"]],
  ["scripts/pptx-check.mjs", ["pptx", "tooling"]],
  ["packages/document/src/index.ts", ["document"]],
  ["packages/engine/src/call.ts", ["document"]],
  ["packages/catalog/src/ops.ts", ["document"]],
  ["packages/live/src/sync.ts", ["document"]],
  ["apps/api/src/slide-undo.test.ts", ["document"]],
  ["apps/api/src/parallel-edits.test.ts", ["document"]],
  ["tests/journeys/journeys.spec.ts", ["verify"]],
  ["tests/spec-replay.test.ts", ["specs"]],
  [".agents/skills/verify-airdesign/look/states.mjs", ["verify"]],
  ["specs/slide-run/SlideRun.tla", ["specs"]],
  ["scripts/land.mjs", ["tooling"]],
  ["tooling/oxlint-plugin-airdesign/glossary.json", ["tooling"]],
  [".github/workflows/bar.yml", ["tooling"]],
  ["AGENTS.md", ["tooling"]],
  ["CHECKS.md", ["tooling"]],
  ["metrics.json", ["tooling"]],
  ["apps/site/src/landing/hero/hero.astro", []],
]
for (const [file, expected] of cases) same(`${file} has its areas`, areasOf([file]), expected)

same(
  "a pull request gets every area its files touch, once, in the map's order",
  areasOf(["scripts/land.mjs", "apps/web/src/aira/aira-panel.tsx", "apps/web/src/thin-deck.tsx", "scripts/bar.mjs"]),
  ["editor", "aira", "tooling"],
)
same("no files give no areas", areasOf([]), [])

const names = Object.keys(areaMap)
same("the map names the nine areas", names, [
  "editor",
  "aira",
  "deck-home",
  "sign-in",
  "pptx",
  "document",
  "verify",
  "specs",
  "tooling",
])
const glossary = fs.readFileSync(new URL("../docs/words/check-words.md", import.meta.url), "utf8")
for (const name of names) same(`check-words.md names the area ${name}`, glossary.includes(`\`${name}\``), true)

console.log("areas tests passed")
