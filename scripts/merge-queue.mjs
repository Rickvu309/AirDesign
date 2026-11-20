const pullQuery = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){state merged baseRefName headRefOid mergeable mergeStateStatus isInMergeQueue mergeQueueEntry{position state} timelineItems(last:30,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT,HEAD_REF_FORCE_PUSHED_EVENT,PULL_REQUEST_COMMIT]){nodes{__typename ... on RemovedFromMergeQueueEvent{createdAt reason}}} autoMergeRequest{enabledAt mergeMethod} commits(last:1){nodes{commit{statusCheckRollup{state contexts(first:100){nodes{__typename ... on CheckRun{databaseId name conclusion status isRequired(pullRequestNumber:$number) checkSuite{workflowRun{databaseId workflow{databaseId}}}} ... on StatusContext{context state isRequired(pullRequestNumber:$number)}}}}}}}} mergeQueue(branch:"main"){entries(first:50){nodes{position pullRequest{number}}}} ref(qualifiedName:"refs/heads/main"){refUpdateRule{requiredStatusCheckContexts} rules(first:50){nodes{type repositoryRuleset{enforcement}}}}}}`

export const pullArgs = (repository, number) => {
  const [owner, name] = repository.split("/")
  return [
    "api",
    "graphql",
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${name}`,
    "-F",
    `number=${number}`,
    "-f",
    `query=${pullQuery}`,
  ]
}

const passedConclusions = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"])

const nameOf = (context) => (context.__typename === "CheckRun" ? context.name : context.context)

const newestPerName = (contexts) => {
  const newest = new Map()
  for (const context of contexts) {
    const name = nameOf(context)
    const held = newest.get(name)
    if (held === undefined || (context.databaseId ?? 0) >= (held.databaseId ?? 0)) newest.set(name, context)
  }
  return newest
}

const stateOf = (context) => {
  const run = context.__typename === "CheckRun"
  if (run ? context.status !== "COMPLETED" : ["PENDING", "EXPECTED"].includes(context.state)) return "running"
  return (run ? passedConclusions.has(context.conclusion) : context.state === "SUCCESS") ? "passed" : "failed"
}

const runOf = (context) => context.checkSuite?.workflowRun?.databaseId
const workflowOf = (context) => context.checkSuite?.workflowRun?.workflow?.databaseId

const replacedByNewerRun = (context, newest) =>
  runOf(context) !== undefined &&
  [...newest.values()].some(
    (other) =>
      stateOf(other) === "running" && workflowOf(other) === workflowOf(context) && runOf(other) > runOf(context),
  )

const split = (names, states) => ({
  passed: names.filter((name) => states.get(name) === "passed"),
  failed: names.filter((name) => states.get(name) === "failed"),
  running: names.filter((name) => states.get(name) === "running"),
})

const sortChecks = (contexts, requiredNames = []) => {
  const newest = newestPerName(contexts)
  const states = new Map()
  for (const [name, context] of newest) {
    const state = stateOf(context)
    states.set(name, state === "failed" && replacedByNewerRun(context, newest) ? "running" : state)
  }
  const required = new Set(requiredNames)
  for (const [name, context] of newest) if (context.isRequired === true) required.add(name)
  for (const name of required) if (!states.has(name)) states.set(name, "running")
  const names = [...states.keys()].sort()
  const runs = new Map()
  for (const context of newest.values())
    if (runOf(context) !== undefined) runs.set(runOf(context), { id: runOf(context), workflow: workflowOf(context) })
  return {
    runs: [...runs.values()],
    checks: split(
      names.filter((name) => newest.has(name)),
      states,
    ),
    required: split(
      names.filter((name) => required.has(name)),
      states,
    ),
    advisory: split(
      names.filter((name) => !required.has(name)),
      states,
    ),
  }
}

const latestRemoval = (items) => {
  const lastPush = items.findLastIndex((item) => item.__typename !== "RemovedFromMergeQueueEvent")
  const lastRemoval = items.findLastIndex((item) => item.__typename === "RemovedFromMergeQueueEvent")
  return lastRemoval > lastPush && items[lastRemoval].reason !== "merged"
    ? { reason: items[lastRemoval].reason, at: items[lastRemoval].createdAt }
    : undefined
}

const queueRuleActive = (ref) =>
  (ref?.rules?.nodes ?? []).some(
    (rule) => rule.type === "MERGE_QUEUE" && (rule.repositoryRuleset?.enforcement ?? "ACTIVE") === "ACTIVE",
  )

export const parsePull = (text) => {
  const { pullRequest, mergeQueue, ref } = JSON.parse(text).data.repository
  const rollup = pullRequest.commits.nodes[0]?.commit.statusCheckRollup
  return {
    state: pullRequest.state,
    merged: pullRequest.merged,
    base: pullRequest.baseRefName,
    head: pullRequest.headRefOid,
    mergeable: pullRequest.mergeable,
    mergeState: pullRequest.mergeStateStatus,
    queued: pullRequest.mergeQueueEntry !== null,
    position: pullRequest.mergeQueueEntry?.position,
    armed: pullRequest.autoMergeRequest !== null,
    ...sortChecks(rollup?.contexts.nodes ?? [], ref?.refUpdateRule?.requiredStatusCheckContexts ?? []),
    removal: latestRemoval(pullRequest.timelineItems.nodes),
    queue: (mergeQueue?.entries.nodes ?? []).map((entry) => entry.pullRequest.number),
    hasQueue: mergeQueue !== null && mergeQueue !== undefined && queueRuleActive(ref),
  }
}

export const queueLine = (pull) => {
  if (!pull.hasQueue && !pull.queued)
    return pull.armed
      ? "main has no merge queue, and auto-merge is armed, so GitHub would merge it without the recheck; land switches it off"
      : "main has no merge queue; land merges the head itself once ci passes and the recheck passes"
  if (pull.queued) return `in the merge queue at position ${pull.position}`
  if (pull.armed) return "auto-merge is armed, and the queue takes it when checks pass"
  return "not in the merge queue and auto-merge is not armed"
}

export const removalLine = (pull) =>
  pull.removal === undefined
    ? undefined
    : `the merge queue removed this head: ${pull.removal.reason} (${pull.removal.at})`

export const readPull = ({ read, repository, number }) => parsePull(read(pullArgs(repository, number)))

const checkCount = ({ checks }) => checks.passed.length + checks.running.length + checks.failed.length

export const awaitChecks = async ({
  read,
  repository,
  number,
  sleep,
  now,
  say,
  intervalMs = 10000,
  limitMs = 180000,
}) => {
  const started = now()
  for (;;) {
    const state = readPull({ read, repository, number })
    if (state.merged || state.queued || state.armed || checkCount(state) > 0) return { ok: true, state }
    if (now() - started >= limitMs) {
      const seconds = Math.round(limitMs / 1000)
      const consequence = state.hasQueue
        ? "Queueing now would enter the merge queue with no check run."
        : "Land would have no ci run to follow."
      return {
        ok: false,
        state,
        message: `no check has started on the head of pull request ${number} after ${seconds} seconds. ${consequence} Look at: gh pr checks ${number}, then run pnpm land --watch`,
      }
    }
    say(
      state.hasQueue
        ? "waiting for a ci check to start on the head, so land arms auto-merge on a head with a check and the merge queue takes it once ci passes"
        : "waiting for a ci check to start on the head. main has no merge queue, so land arms no auto-merge: once ci passes it rechecks this head against the newest main and merges it itself",
    )
    await sleep(intervalMs)
  }
}

const strategies = [["--auto", "--rebase"], ["--auto"]]

export const enqueue = ({ merge, read, repository, number }) => {
  const said = []
  for (const strategy of strategies) {
    const args = ["pr", "merge", String(number), ...strategy]
    const result = merge(args)
    said.push(
      `gh ${args.join(" ")} said: ${`${result.stdout}${result.stderr}`.trim() || `nothing (exit ${result.status})`}`,
    )
    const state = readPull({ read, repository, number })
    if (state.queued || state.armed) return { ok: true, state, said }
    if (state.merged) return { ok: true, state, said }
  }
  const state = readPull({ read, repository, number })
  return {
    ok: false,
    state,
    said,
    message: `pull request ${number} is not queued and auto-merge is not armed, whatever gh printed. ${said.join(" ")}`,
  }
}
