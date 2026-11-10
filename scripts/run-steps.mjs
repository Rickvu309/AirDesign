export async function runSteps(steps) {
  const names = Object.keys(steps)
  for (const [index, name] of names.entries()) {
    for (const before of steps[name].after ?? []) {
      if (!names.slice(0, index).includes(before))
        throw new Error(`${name} waits on ${before}, which is not listed before it`)
    }
  }
  const outcomes = new Map()
  for (const name of names) {
    const after = steps[name].after ?? []
    const start = async () => {
      const before = await Promise.all(after.map((other) => outcomes.get(other)))
      if (before.some((outcome) => !outcome.ok)) return { ok: false, skipped: true }
      try {
        const values = Object.fromEntries(after.map((other, index) => [other, before[index].value]))
        return { ok: true, value: await steps[name].run(values) }
      } catch (error) {
        return { ok: false, skipped: false, error }
      }
    }
    outcomes.set(name, start())
  }
  const settled = await Promise.all(names.map((name) => outcomes.get(name)))
  const failures = names.flatMap((name, index) =>
    settled[index].ok || settled[index].skipped ? [] : [{ name, error: settled[index].error }],
  )
  if (failures.length > 0) {
    const lines = failures.map(
      ({ name, error }) => `${name}: ${error instanceof Error ? error.message : String(error)}`,
    )
    throw new AggregateError(
      failures.map(({ error }) => error),
      `${failures.length} of ${names.length} steps failed\n${lines.join("\n")}`,
    )
  }
  return Object.fromEntries(names.map((name, index) => [name, settled[index].value]))
}
