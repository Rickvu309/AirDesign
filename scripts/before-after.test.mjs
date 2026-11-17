import { beforeAfterLine, beforeAfterNeed, hasBeforeAfter, noVisibleChange, seen } from "./before-after.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const repository = "Rickvu309/AirDesign"
const sha = "a".repeat(40)
const image = `![Annotated before and after](https://github.com/${repository}/releases/download/proof/pr-12-annotated-1-abcdef1234.png)`

for (const file of [
  "apps/web/src/aira-panel.tsx",
  "apps/web/src/index.css",
  "apps/web/src/copy/product-copy.ts",
  "apps/site/src/landing/hero.astro",
  "packages/render/src/passage.tsx",
  "packages/render/src/slide-paint.ts",
  "packages/theme/src/tokens.css",
])
  same(`${file} is something a person sees`, seen(file), true)

for (const file of [
  "apps/web/src/aira-steps.test.ts",
  "apps/web/src/aira-steps.ts",
  "apps/web/src/live-sync.ts",
  "packages/render/src/slide-canvas-move.test.ts",
  "tests/browser/aira-panel.spec.ts",
  "apps/api/src/server.ts",
  "packages/document/src/index.ts",
  "packages/theme/package.json",
  "apps/site/src/site/session.ts",
])
  same(`${file} is not something a person sees`, seen(file), false)

same(
  "a body with the section and a proof image passes",
  hasBeforeAfter(`## Why\n\nx\n\n## Before / after\n\n${image}\n`, repository),
  true,
)
same("the heading is matched without regard to case", hasBeforeAfter(`### before/after\n${image}`, repository), true)
same("a body with no section fails", hasBeforeAfter(`## Why\n\n${image}\n`, repository), false)
same(
  "a section whose image is a local path fails",
  hasBeforeAfter("## Before / after\n\n![x](/home/me/tmp/01-empty.png)\n", repository),
  false,
)
same(
  "a proof image under a later section does not count",
  hasBeforeAfter(`## Before / after\n\nnone yet\n\n## Tests\n\n${image}\n`, repository),
  false,
)
same(
  "an image from another repository does not count",
  hasBeforeAfter(`## Before / after\n\n${image.replace(repository, "someone/else")}\n`, repository),
  false,
)
same(
  "a branch link does not count",
  hasBeforeAfter(
    `## Before / after\n\n![x](https://github.com/${repository}/blob/${sha}/pr-12/shot.png?raw=true)\n`,
    repository,
  ),
  false,
)
same(
  "a deeper heading inside the section keeps it open",
  hasBeforeAfter(`## Before / after\n\n### Agent panel\n\n${image}\n`, repository),
  true,
)

const files = ["apps/web/src/aira-panel.tsx", "scripts/bar.mjs"]
same(
  "a seen change with no section needs one",
  beforeAfterNeed({ changedFiles: files, body: "", repository }).needed,
  true,
)
same(
  "a seen change with the section does not",
  beforeAfterNeed({ changedFiles: files, body: `## Before / after\n${image}`, repository }).needed,
  false,
)
same(
  "a change nobody sees never needs one",
  beforeAfterNeed({ changedFiles: ["scripts/bar.mjs"], body: null, repository }),
  { shown: [], needed: false },
)
same("no line when nothing is seen", beforeAfterLine({ shown: [], needed: false }), undefined)
same(
  "the line names the first files and counts the rest",
  beforeAfterLine({ shown: ["a.tsx", "b.tsx", "c.tsx", "d.tsx"], needed: true }).includes(
    "(a.tsx, b.tsx, c.tsx and 1 more)",
  ),
  true,
)

for (const release of ["proof-2", "proof-13"])
  same(
    `an image from the rolled-over ${release} release passes`,
    hasBeforeAfter(`## Before / after\n\n${image.replace("/proof/", `/${release}/`)}\n`, repository),
    true,
  )
for (const release of ["proof-x", "proofs", "proof-"])
  same(
    `an image from another release does not pass: ${release}`,
    hasBeforeAfter(`## Before / after\n\n${image.replace("/proof/", `/${release}/`)}\n`, repository),
    false,
  )

const unseen = "## Before / after\n\nNo visible change: moves code between files; the editor paints the same.\n"
same(
  "a no-visible-change line is read from the section",
  noVisibleChange(unseen),
  "moves code between files; the editor paints the same.",
)
same("and counts as the section", beforeAfterNeed({ changedFiles: files, body: unseen, repository }).needed, false)
same(
  "and bar prints the reason, so the owner can audit the claim",
  beforeAfterLine(beforeAfterNeed({ changedFiles: files, body: unseen, repository })),
  "Before / after: no visible change, says the body: moves code between files; the editor paints the same.",
)
same(
  "the line that asks for one names the no-visible-change way out",
  beforeAfterLine({ shown: ["a.tsx"], needed: true }).includes("No visible change: <why>"),
  true,
)

console.log("before-after tests passed")
