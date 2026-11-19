const allowEscapes = "--allow-escape-sequences"
const readInterval = 5000

const sleepFor = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)

const jobsEndpoint = (repository, run) =>
  run.attempt === undefined
    ? `repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`
    : `repos/${repository}/actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=100`

const reasonOf = ({ status, stderr }) =>
  status === 0
    ? "empty response"
    : (/\bHTTP \d{3}\b/.exec(stderr)?.[0] ?? (stderr.trim().split("\n")[0] || `gh exited ${status}`))

const askLog = (gh, endpoint) => {
  const answer = gh(["api", endpoint, allowEscapes])
  return answer.status !== 0 && answer.stderr.includes(`unknown flag: ${allowEscapes}`) ? gh(["api", endpoint]) : answer
}

export const readJobLog = ({ repository, job, gh, reads = 1, sleep = sleepFor }) => {
  const endpoint = `repos/${repository}/actions/jobs/${job.id}/logs`
  for (let read = 1; ; read += 1) {
    const answer = askLog(gh, endpoint)
    if (answer.status === 0 && answer.stdout.trim() !== "") return { log: answer.stdout }
    const reason = reasonOf(answer)
    if (read >= reads || (answer.status !== 0 && reason !== "HTTP 404")) {
      return {
        warning: `Could not read the log for job ${job.id} after ${read} ${read === 1 ? "read" : "reads"} (${reason}).`,
      }
    }
    sleep(readInterval)
  }
}

export const failedJobLogs = ({ repository, run, gh, reads, sleep }) => {
  const listed = gh([
    "api",
    jobsEndpoint(repository, run),
    "--jq",
    '[.jobs[] | select(.conclusion == "failure" and .name != "ci") | {id, name}]',
  ])
  if (listed.status !== 0)
    return { jobs: [], logs: [], warnings: [`Could not list the jobs of run ${run.id} (${reasonOf(listed)}).`] }
  const listedJobs = JSON.parse(listed.stdout || "[]")
  const answers = listedJobs.map((job) => readJobLog({ repository, job, gh, reads, sleep }))
  return {
    jobs: listedJobs.map((job, index) => ({ ...job, log: answers[index].log ?? "" })),
    logs: answers.flatMap(({ log }) => (log === undefined ? [] : [log])),
    warnings: answers.flatMap(({ warning }) => (warning === undefined ? [] : [warning])),
  }
}
