import { setTimeout } from "node:timers/promises"

export const drillBranch = ({ sha, id, attempt }) => `red-main/drill-${sha}-${id}-${attempt}`

const workflows = [
  { name: "ci", event: "pull_request" },
  { name: "bar", event: "pull_request_target" },
]

const startedRun = ({ repository, io, pull, workflow }) => {
  const listed = io.gh([
    "run",
    "list",
    "--repo",
    repository,
    "--workflow",
    `${workflow.name}.yml`,
    "--branch",
    pull.branch,
    "--commit",
    pull.head,
    "--event",
    workflow.event,
    "--json",
    "headSha,status,url",
  ])
  if (listed.status !== 0) throw new Error(`could not list ${workflow.name} runs: ${listed.stderr.trim()}`)
  return JSON.parse(listed.stdout).find(
    (run) => run.headSha === pull.head && ["in_progress", "completed"].includes(run.status),
  )
}

export const removeDrillBranch = ({ io, branch, head, say }) => {
  const remote = io.remote ?? "origin"
  const ref = `refs/heads/${branch}`
  const removed = io.git(["push", remote, `--force-with-lease=${ref}:${head}`, "--delete", branch])
  if (removed.status === 0 || io.git(["ls-remote", "--exit-code", remote, ref]).status === 2) return true
  say(`could not delete ${branch}: ${removed.stderr.trim()}`)
  return false
}

export const finishDrill = async ({ repository, io, pull, close, say }) => {
  say(`opened drill pull request ${pull.url} on ${pull.branch}`)
  const started = new Map()
  let fault
  try {
    for (let poll = 0; poll < 30 && started.size < workflows.length; poll += 1) {
      if (poll > 0) await (io.sleep ?? setTimeout)(10000)
      for (const workflow of workflows.filter(({ name }) => !started.has(name))) {
        const run = startedRun({ repository, io, pull, workflow })
        if (run !== undefined) started.set(workflow.name, run.url)
      }
    }
    if (started.size < workflows.length)
      fault = `Timed out waiting for ${workflows
        .filter(({ name }) => !started.has(name))
        .map(({ name }) => name)
        .join(" and ")} to start.`
  } catch (error) {
    fault = error.message
  }
  const runs = [...started].map(([name, url]) => `${name} started at ${url}`).join("\n\n")
  const comment = [fault, runs, "The red-main drill closes this pull request."].filter(Boolean).join("\n\n")
  const closed = close(comment)
  if (closed.status !== 0) say(`could not close ${pull.url}: ${closed.stderr.trim()}`)
  const deleted = removeDrillBranch({ io, ...pull, say })
  const outcome = `Red-main drill ${pull.url}. ${closed.status === 0 ? "Closed the pull request." : "Closing the pull request failed."} ${deleted ? `Deleted branch ${pull.branch}.` : "Deleting the branch failed."}\n\n${[fault, runs].filter(Boolean).join("\n\n")}`
  say(outcome.trim())
  const recorded = io.redMain(`${outcome.trim()}`, true)
  return { failed: fault !== undefined || closed.status !== 0 || !deleted || recorded.status !== 0 }
}

const issueTitle = (fake) => {
  const call = fake.calls.find((each) => each.args[0] === "issue" && each.args[1] === "create")
  return call?.args[call.args.indexOf("--title") + 1]
}

const check = (name, actual, expected) => {
  const passed = JSON.stringify(actual) === JSON.stringify(expected)
  if (!passed) console.error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  return { name, passed }
}

export const runDrillCases = async (redMainBot) => {
  const { history, io, logs, mainUpTo, mainWith, ok, recorder, repository } = await import("./red-main-replay.mjs")
  const remember = (sha, commit) => {
    history.commits[sha] = commit
  }
  const green = "0d318ba4b305e9f74291cbbd98c0811ccc347735"
  const added = "ec82581b004ee250af756c938d00ce55822a3500"
  const after = "475bfffe19687933e81c90c9dd2b6d214281f955"
  const file = "apps/web/src/left-out-replay.test.ts"
  const name =
    "replays every state of the left-out spec through the tab's writer: each writable edit written, the rest left out and named"
  remember(green, { title: "Use the deck's named type scale only when the deck has one", files: [] })
  remember(added, {
    title: "Open a deck with an edit the tab cannot write, leave that edit out and say so",
    files: [file],
  })
  remember(after, { title: "Let an agent create a blank deck it can read and edit at once", files: [] })
  const redRun = { id: 44959805557, sha: added, status: "completed", conclusion: "failure" }
  const greenRun = { id: 44959700000, sha: green, status: "completed", conclusion: "success" }
  const passedRun = { id: 44960059334, sha: after, status: "completed", conclusion: "success" }
  logs[redRun.id] = [
    {
      name: "check (source 2/2)",
      log: [` FAIL   unit  ${file} > ${name}`, "Error: Test timed out in 5000ms.", "failed: unit-tests"].join("\n"),
    },
  ]
  const window = { commits: [green, added, after], runs: [greenRun, redRun, passedRun] }
  const addedBot = recorder([
    [
      /^git cat-file -e 0d318ba4b305e9f74291cbbd98c0811ccc347735:apps\/web\/src\/left-out-replay\.test\.ts/,
      () => ({ status: 128, stdout: "", stderr: "" }),
    ],
    [/^git log --no-renames --diff-filter=A/, () => ok(`${added}\n`)],
    ...mainWith(window, [greenRun, redRun]),
    [/^owner pr list/, () => ok("[]")],
  ])
  await redMainBot({
    repository,
    event: { id: redRun.id, event: "push", branch: "main", sha: added, conclusion: "failure" },
    io: io({ ...addedBot, rerun: () => ({ result: "unclear", at: green, why: "absent" }) }),
  })
  const revertBody = addedBot.calls.find((call) => call.who === "owner" && call.args[1] === "create")?.input ?? ""
  const addedCase = check(
    "a new failing test file is that commit's own",
    [revertBody.includes("does not exist at the last green commit"), revertBody.includes(added.slice(0, 9))],
    [true, true],
  )

  const unclearBot = recorder([
    ...mainWith(window, [greenRun, redRun, passedRun]),
    [/^gh issue create/, () => ok("https://github.com/Rickvu309/AirDesign/issues/1600\n")],
  ])
  await redMainBot({
    repository,
    event: { id: passedRun.id, event: "push", branch: "main", sha: after, conclusion: "success" },
    io: io({
      ...unclearBot,
      rerun: () => ({ result: "unclear", at: green, why: "it ended with status 1 and named no failure of this test" }),
    }),
  })
  const unclearCase = check(
    "an unclear rerun is filed once the next push passes",
    issueTitle(unclearBot),
    `Race: ${file} › ${name}`,
  )

  const november = history.windows.at(-1)
  const skillsHead = november.commits[3]
  const revertHead = "80fbc1fe119bc1aa64e416db75790df1220c6fa5"
  const designBot = recorder([
    [
      /^gh pr list --repo \S+ --head/,
      () => ok(JSON.stringify([{ number: 1211, headRefOid: revertHead, isCrossRepository: false }])),
    ],
    ...mainUpTo(november, skillsHead),
    [/\/pulls\/1211\/files/, () => ok(history.commits[skillsHead].files.join("\n"))],
    [/^gh issue create/, () => ok("https://github.com/Rickvu309/AirDesign/issues/1500\n")],
  ])
  await redMainBot({
    repository,
    event: {
      id: 44888380660,
      event: "pull_request",
      branch: `red-main/revert-${skillsHead}`,
      sha: revertHead,
      conclusion: "failure",
    },
    io: io(designBot),
  })
  const designCase = check(
    "a design-state the revert cannot reach is recorded by its state",
    issueTitle(designBot),
    "Race: design-states › slide-added-title",
  )
  return [addedCase, unclearCase, designCase]
}
