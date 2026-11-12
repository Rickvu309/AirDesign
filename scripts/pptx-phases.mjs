export const phaseClock = ({ now = () => performance.now() } = {}) => {
  const origin = now()
  const rows = []
  const begin = (name) => {
    const started = now()
    return () => {
      rows.push({ name, from: (started - origin) / 1000, to: (now() - origin) / 1000 })
    }
  }
  const time = async (name, work) => {
    const end = begin(name)
    try {
      return await work()
    } finally {
      end()
    }
  }
  const lines = () =>
    [...rows]
      .sort((left, right) => left.from - right.from)
      .map(
        (row) =>
          `phase ${row.name.padEnd(12)} ${row.from.toFixed(1).padStart(6)} to ${row.to.toFixed(1).padStart(6)} seconds`,
      )
  return { begin, time, lines }
}
