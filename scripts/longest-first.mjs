export const longestFirst = (specs, durationOf) => {
  const longest = new Map()
  for (const spec of specs) {
    const name = spec.project.name
    longest.set(name, Math.max(longest.get(name) ?? 0, durationOf(spec) ?? 0))
  }
  const rank = (left, right) =>
    left.project.config.sequence.groupOrder - right.project.config.sequence.groupOrder ||
    longest.get(right.project.name) - longest.get(left.project.name) ||
    (left.project.name < right.project.name ? -1 : left.project.name > right.project.name ? 1 : 0)
  return specs.toSorted(rank)
}
