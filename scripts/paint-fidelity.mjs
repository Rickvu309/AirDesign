export const paintSize = { width: 64, height: 36 }
export const matchBar = 10
export const slidesPerDeck = 12
export const worstShown = 5

const channels = 3

const span = (index, from, to) => {
  const start = Math.floor((index * from) / to)
  return [start, Math.max(start + 1, Math.floor(((index + 1) * from) / to))]
}

export const scaleDown = (image, size = paintSize) => {
  const small = new Uint8Array(size.width * size.height * channels)
  for (let y = 0; y < size.height; y += 1) {
    const [top, bottom] = span(y, image.height, size.height)
    for (let x = 0; x < size.width; x += 1) {
      const [left, right] = span(x, image.width, size.width)
      const sums = [0, 0, 0]
      for (let row = top; row < bottom; row += 1) {
        for (let column = left; column < right; column += 1) {
          const at = (row * image.width + column) * 4
          sums[0] += image.data[at]
          sums[1] += image.data[at + 1]
          sums[2] += image.data[at + 2]
        }
      }
      const count = (bottom - top) * (right - left)
      const out = (y * size.width + x) * channels
      sums.forEach((sum, channel) => {
        small[out + channel] = Math.round(sum / count)
      })
    }
  }
  return small
}

export const colorDifference = (left, right) => {
  if (left.length !== right.length || left.length === 0) throw new Error("the images are not one size")
  let total = 0
  for (let at = 0; at < left.length; at += 1) total += Math.abs(left[at] - right[at])
  return total / left.length
}

export const compareSmall = (left, right, bar = matchBar) => {
  const difference = colorDifference(left, right)
  return { difference, match: difference < bar }
}

export const compareSlides = (left, right, bar = matchBar) => compareSmall(scaleDown(left), scaleDown(right), bar)

export const chosenSlides = (count, cap = slidesPerDeck) => {
  const size = Math.min(count, cap)
  return Array.from({ length: size }, (_, step) => Math.floor((step * count) / size) + 1)
}

export const fidelityLines = ({
  rows,
  skipped,
  decks,
  goal,
  now = Number.POSITIVE_INFINITY,
  cap = slidesPerDeck,
  bar = matchBar,
  worst = worstShown,
}) => {
  const matching = rows.filter((row) => row.match).length
  const measured = new Set(rows.map((row) => row.deck)).size
  const ranked = [...rows].sort((left, right) => right.difference - left.difference).slice(0, worst)
  return [
    `metric paint-fidelity  now ${matching}  goal ${goal}  ${rows.length} slides compared, at most ${cap} per deck, ${measured} of ${decks} decks, bar ${bar} of 255`,
    ...ranked.map(
      (row) => `paint-fidelity worst ${row.deck} slide ${row.slide} difference ${row.difference.toFixed(1)}`,
    ),
    ...skipped.map((row) => `paint-fidelity skipped ${row.deck}: ${row.reason}`),
    ...(matching > now ? [`paint-fidelity record ${matching}. Record now ${matching} in metrics.json.`] : []),
  ]
}

export const fidelityFailure = ({ rows, skipped, outcome, now }) => {
  if (outcome === "failed")
    return "paint-fidelity crashed before it finished, so its count is not the corpus. Read the lines above for why."
  if (rows.length === 0)
    return "paint-fidelity judged 0 decks, so its count says nothing. Read the lines above for why."
  if (outcome === "stopped")
    return "paint-fidelity stopped at its limit, so its count is not the corpus. Read the lines above for why."
  if (skipped.length > 0)
    return `paint-fidelity skipped ${skipped.map((row) => row.deck).join(", ")}, so its count is not the corpus. Read the lines above for why.`
  const matching = rows.filter((row) => row.match).length
  if (matching < now)
    return `paint-fidelity is ${matching} and metrics.json says ${now}. A change painted a slide further from its reference render; find it in the worst lines above.`
  return undefined
}

export const reported = async ({ work, limit, say }) => {
  let timer
  const stopped = Symbol("stopped")
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(stopped), limit)
  })
  try {
    if ((await Promise.race([work(), deadline])) === stopped) {
      say(`paint-fidelity stopped at its limit of ${limit / 1000} seconds. The count covers what finished.`)
      return "stopped"
    }
    return "finished"
  } catch (error) {
    say(`paint-fidelity not finished: ${error instanceof Error ? error.message : String(error)}`)
    return "failed"
  } finally {
    clearTimeout(timer)
  }
}
