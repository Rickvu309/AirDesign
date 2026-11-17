import { fixture, harness, migrationsOf, ok, pullAnswer, same } from "./land-harness.mjs"

const failedLoad = { status: 1, output: fixture("vitest-failed.log") }

const clean = harness()
same("a clean branch lands and follows to merged", await clean.run(), 0)
same(
  "the push uses a lease",
  clean.log.some((line) => line.startsWith("git push --force-with-lease")),
  true,
)
same(
  "the commit is stamped before the push",
  clean.log.indexOf("stamp") < clean.log.findIndex((line) => line.startsWith("git push")),
  true,
)
same(
  "a failed step stops nothing here: every step said one line",
  clean.said.filter((line) =>
    /^(branch|fetch|base|conflicts|migrations|markers|gate|push|pull request|queue|follow)/.test(line),
  ).length >= 10,
  true,
)

same("after merged, land names the sweep once", clean.said.filter((line) => line.startsWith("sweep ")).length, 1)
same("as its last line", clean.said.at(-1).includes("pnpm sweep"), true)

const conflicted = harness({ conflicts: "apps/web/src/thin-deck.tsx" })
same("a branch that conflicts with main stops before the check", await conflicted.run(), 1)
same("and runs no check", conflicted.log.includes("stamp"), false)
same(
  "and names the file and the rebase",
  conflicted.said.some(
    (line) => line.includes("apps/web/src/thin-deck.tsx") && line.includes("git rebase origin/main"),
  ),
  true,
)

const wrongBase = harness({
  pull: { number: 403, baseRefName: "agent-element-tools", url: "u", title: "Add land", body: "## Proof\n" },
})
wrongBase.context.gh = ((original) => (command, input) => {
  if (command[0] === "pr" && command[1] === "list" && wrongBase.edits.length > 0) {
    return ok(JSON.stringify([{ number: 403, baseRefName: "main", url: "u", title: "Add land", body: "## Proof\n" }]))
  }
  return original(command, input)
})(wrongBase.context.gh)
same("a pull request against another branch lands", await wrongBase.run(), 0)
same("land moves its base to main through the REST endpoint", wrongBase.edits, [
  { path: "repos/Rickvu309/AirDesign/pulls/403", fields: { base: "main" } },
])
same(
  "and says so",
  wrongBase.said.some(
    (line) => line.startsWith("base") && line.includes("agent-element-tools") && line.includes("main"),
  ),
  true,
)
same(
  "after the check, before the push",
  wrongBase.log.indexOf("stamp") < wrongBase.log.findIndex((line) => line.startsWith("gh api -X PATCH")) &&
    wrongBase.log.findIndex((line) => line.startsWith("gh api -X PATCH")) <
      wrongBase.log.findIndex((line) => line.startsWith("git push")),
  true,
)

const twice = harness({
  mainMigrations: migrationsOf("a", "b", "main-nine"),
  headMigrations: migrationsOf("a", "b", "branch-nine"),
})
same("two migrations with one number stop before the check", await twice.run(), 1)
same(
  "and name the next free number",
  twice.said.some((line) => line.includes("next free number, 4")),
  true,
)

const blob = (letter) => letter.repeat(40)
const stale = harness({
  staleDiff: [
    `:100644 100644 ${blob("b")} ${blob("a")} M\0apps/web/src/thin-deck.tsx\0`,
    `:100644 100644 ${blob("d")} ${blob("c")} M\0scripts/check.mjs\0`,
  ].join(""),
  staleLog: [
    `\u0001${blob("e")}\u0002Move the title\0\n`,
    `:100644 100644 ${blob("a")} ${blob("b")} M\0apps/web/src/thin-deck.tsx\0`,
    `:100644 100644 ${blob("c")} ${blob("d")} M\0scripts/check.mjs\0`,
  ].join(""),
})
same("a branch that puts back files main replaced stops before the check", await stale.run(), 1)
same("and runs no check", stale.log.includes("stamp"), false)
same(
  "and names the files and the restore",
  stale.said.some(
    (line) =>
      line.includes("eeeeeeee Move the title") &&
      line.includes("--worktree -- apps/web/src/thin-deck.tsx scripts/check.mjs"),
  ),
  true,
)

const marked = harness({ markerFiles: ["apps/web/src/thin-deck.tsx"] })
same("a committed conflict marker stops the push", await marked.run(), 1)
same(
  "and names the file",
  marked.said.some((line) => line.includes("apps/web/src/thin-deck.tsx")),
  true,
)
same(
  "and pushes nothing",
  marked.log.some((line) => line.startsWith("git push")),
  false,
)

const load = harness({ checkRuns: [failedLoad], alone: { status: 0, output: "" } })
same("a failed test that passes alone is load and lands", await load.run(), 0)
same("the file was rerun alone", load.log.includes("rerun apps/api/src/agent-commit-race.test.ts"), true)
same("and the commit is stamped by land", load.log.includes("stamp"), true)

const real = harness({
  checkRuns: [failedLoad],
  alone: { status: 1, output: " FAIL  api apps/api/src/agent-commit-race.test.ts > a > b\nAssertionError: boom\n" },
})
same("a failed test that fails alone too stops the push", await real.run(), 1)
same("and stamps nothing", real.log.includes("stamp"), false)
same(
  "and pushes nothing",
  real.log.some((line) => line.startsWith("git push")),
  false,
)
same(
  "and names the failing test",
  real.said.some((line) => line.includes("apps/api/src/agent-commit-race.test.ts")),
  true,
)

const queueText = "the merge strategy for main is set by the merge queue"
const unqueued = harness({
  merges: [{ status: 0, stdout: "", stderr: `${queueText}\n` }],
  reads: [pullAnswer()],
})
same("a pull request gh left unqueued is a loud failure", await unqueued.run(), 1)
same(
  "and quotes what gh said",
  unqueued.said.some((line) => line.includes(queueText)),
  true,
)

const dirty = harness({ dirty: " M scripts/land.mjs\n" })
same("uncommitted files stop the land", await dirty.run(), 1)

const checkOnly = harness({ args: ["--check"] })
same("--check stops after the stamp", await checkOnly.run(), 0)
same(
  "and pushes nothing",
  checkOnly.log.some((line) => line.startsWith("git push")),
  false,
)

const noPull = harness({ pull: null })
same("no pull request and no title stops before the check", await noPull.run(), 1)
same("and runs no check", noPull.log.includes("stamp"), false)
same(
  "and pushes nothing",
  noPull.log.some((line) => line.startsWith("git push")),
  false,
)
same(
  "and names the land command that opens one",
  noPull.said.at(-1).includes(`pnpm land --title "..." --body-file`),
  true,
)
same("--check needs no title", await harness({ pull: null, args: ["--check"] }).run(), 0)

const created = harness({ pull: null, args: ["--title", "Add land", "--body-file", "/tmp/body.md", "--no-follow"] })
created.context.gh = ((original) => (command) => {
  if (command[0] === "pr" && command[1] === "list" && created.log.some((line) => line.startsWith("gh pr create"))) {
    return ok(JSON.stringify([{ number: 394, baseRefName: "main", url: "u" }]))
  }
  return original(command)
})(created.context.gh)
same("a title and a body file open the pull request against main", await created.run(), 0)
same(
  "with --base main",
  created.log.some((line) => line.startsWith("gh pr create --base main")),
  true,
)

const longTitle = `Add pnpm land, which checks, pushes, queues and follows a pull request to merged`
const refusedTitle = harness({ pull: null, args: ["--title", longTitle, "--body-file", "/tmp/body.md"] })
same("a --title over the limit stops", await refusedTitle.run(), 1)
same("before the check", refusedTitle.log.includes("stamp"), false)
same(
  "and before the push",
  refusedTitle.log.some((line) => line.startsWith("git push")),
  false,
)
same(
  "it prints the length and the limit",
  refusedTitle.said
    .at(-1)
    .startsWith(`STOPPED at title: --title is ${[...longTitle].length} characters, limit 72: it is too long.`),
  true,
)

const oldTitle = harness({
  pull: { number: 412, baseRefName: "main", url: "u", title: "Add the deck list.", body: "" },
})
same("an open pull request whose title breaks the rule stops", await oldTitle.run(), 1)
same("before the check", oldTitle.log.includes("stamp"), false)
same(
  "it names the pull request and how to retitle it",
  oldTitle.said.at(-1).includes("the title of pull request 412 is 18 characters, limit 72: it ends with a full stop") &&
    oldTitle.said.at(-1).includes(`pnpm land --title "..."`),
  true,
)
const badRetitle = harness({ args: ["--title", longTitle] })
same("a --title over the limit stops an open pull request too", await badRetitle.run(), 1)
same("and edits nothing", badRetitle.edits, [])

const retitled = harness({
  pull: { number: 412, baseRefName: "main", url: "u", title: "Add the deck list.", body: "## Proof\n" },
  args: ["--title", "Add the deck list"],
})
same("--title retitles an open pull request whose title breaks the rule", await retitled.run(), 0)
same("through the REST endpoint, with only the title", retitled.edits, [
  { path: "repos/Rickvu309/AirDesign/pulls/412", fields: { title: "Add the deck list" } },
])
same(
  "and says no word about the bar check, since the body did not change",
  retitled.said.some((line) => line.includes("bar")),
  false,
)

const rebodied = harness({
  pull: { number: 412, baseRefName: "main", url: "u", title: "Add land", body: "## Proof\n\nOld.\n" },
  args: ["--body-file", "/tmp/body.md"],
})
same("--body-file rewrites an open pull request's body", await rebodied.run(), 0)
same("with the file's text", rebodied.edits, [
  { path: "repos/Rickvu309/AirDesign/pulls/412", fields: { body: "## What changes\n\nA.\n\n## Proof\n\nRan it.\n" } },
])
same(
  "and says once that a body edit starts the bar check again",
  rebodied.said.filter((line) => line.includes("bar")).length,
  1,
)

const unchanged = harness({
  pull: { number: 412, baseRefName: "main", url: "u", title: "Add land", body: "## Proof\n" },
  bodyText: "## Proof\n",
  args: ["--title", "Add land", "--body-file", "/tmp/body.md"],
})
same("a title and body the pull request already has land", await unchanged.run(), 0)
same("and edit nothing", unchanged.edits, [])

const checkedOnly = harness({ args: ["--title", "Add the deck list", "--check"] })
same("--check with a new title passes", await checkedOnly.run(), 0)
same("and edits nothing", checkedOnly.edits, [])

const proofless = harness({
  pull: null,
  bodyText: "## What changes\n\nA.\n",
  args: ["--title", "Add land", "--body-file", "/tmp/body.md", "--check"],
})
same("a body with no Proof heading only warns", await proofless.run(), 0)
same(
  "and says so in one line",
  proofless.said.filter((line) => line.startsWith("body       warning: the body has no ## Proof heading")).length,
  1,
)
same(
  "a body with a Proof heading says nothing",
  clean.said.some((line) => line.startsWith("body")),
  false,
)
const prProofless = harness({
  pull: { number: 412, baseRefName: "main", url: "u", title: "Add land", body: "A." },
  args: ["--check"],
})
await prProofless.run()
same(
  "an open pull request's body is read too",
  prProofless.said.some((line) => line.includes("no ## Proof heading")),
  true,
)
same(
  "and the body file is not",
  prProofless.log.some((line) => line.startsWith("read ")),
  false,
)
const unread = harness({ pull: null, bodyText: null, args: ["--title", "Add land", "--body-file", "/tmp/none.md"] })
same("a body file that cannot be read stops", await unread.run(), 1)
same("before the check", unread.log.includes("stamp"), false)

const watch = harness({ args: ["--watch"], reads: [pullAnswer({ merged: true })] })
same("--watch only follows", await watch.run(), 0)
same("and checks nothing", watch.log.includes("stamp"), false)

same("--watch names the sweep after merged too", watch.said.at(-1).includes("pnpm sweep"), true)

const status = harness({ args: ["--status"], reads: [pullAnswer({ armed: true })] })
same("--status changes nothing and exits 0", await status.run(), 0)
same(
  "it pushes, merges and stamps nothing",
  status.log.some((line) => /^git push|^gh pr merge|^stamp/.test(line)),
  false,
)
same(
  "it says where the pull request stands",
  status.said.some((line) => line.includes("auto-merge is armed")),
  true,
)

const ranNothing = (run) => run.log.length === 0

for (const flag of ["--help", "-h"]) {
  const help = harness({ args: [flag] })
  same(`${flag} exits 0`, await help.run(), 0)
  same(`${flag} touches neither git nor gh`, ranNothing(help), true)
  same(
    `${flag} prints the usage`,
    help.said.some((line) => line.startsWith("usage: pnpm land")),
    true,
  )
}

const typo = harness({ args: ["--tittle", "Add land"] })
same("a flag the script does not know exits 1", await typo.run(), 1)
same("and starts no land", ranNothing(typo), true)
same(
  "and names the flag and the usage",
  typo.said.some((line) => line.includes("--tittle")) && typo.said.some((line) => line.startsWith("usage: pnpm land")),
  true,
)

const stray = harness({ args: ["help"] })
same("a stray word exits 1", await stray.run(), 1)
same("and starts no land", ranNothing(stray), true)

const knownFlags = harness({
  args: ["--pr", "394", "--title", "Add land", "--body-file", "/tmp/body.md", "--no-follow", "--check"],
})
same("every flag the script knows is accepted", knownFlags.context.args.unknown, [])

const early = harness({
  pull: null,
  args: ["--title", "Add land", "--body-file", "/tmp/body.md", "--no-follow"],
  reads: [pullAnswer({ contexts: [] }), pullAnswer({ contexts: [] }), pullAnswer({ armed: true })],
})
early.context.gh = ((original) => (command) => {
  if (command[0] === "pr" && command[1] === "list" && early.log.some((line) => line.startsWith("gh pr create"))) {
    return ok(JSON.stringify([{ number: 394, baseRefName: "main", url: "u" }]))
  }
  return original(command)
})(early.context.gh)
early.context.read = ((original) => () => {
  early.log.push("read")
  return original()
})(early.context.read)
same("a push whose ci has not started waits, then arms", await early.run(), 0)
const mergeAt = early.log.findIndex((line) => line.startsWith("gh pr merge"))
same(
  "and merges only after a check is on the head",
  early.log.slice(0, mergeAt).filter((line) => line === "read").length,
  3,
)
same(
  "and says it waits",
  early.said.some((line) => line.startsWith("queue") && line.includes("waiting")),
  true,
)

const silent = harness({ reads: [pullAnswer({ contexts: [] })] })
same("a head that never gets a check stops the queue step", await silent.run(), 1)
same(
  "and merges nothing",
  silent.log.some((line) => line.startsWith("gh pr merge")),
  false,
)

const removedStatus = harness({
  args: ["--status"],
  reads: [
    pullAnswer({
      timeline: [
        { __typename: "PullRequestCommit" },
        { __typename: "RemovedFromMergeQueueEvent", reason: "invalid_merge_commit", createdAt: "2026-11-13T01:40:40Z" },
      ],
    }),
  ],
})
same("--status exits 0 for a removed head", await removedStatus.run(), 0)
same(
  "--status says why the queue removed it",
  removedStatus.said.some((line) => line.includes("the merge queue removed this head: invalid_merge_commit")),
  true,
)
