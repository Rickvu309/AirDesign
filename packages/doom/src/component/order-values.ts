import { type Charge, type Values, name, numeric, record, string, valueList } from "./values.js"

export function sortBy([source, ...fields]: Values, charge: Charge): Values {
  const rows = valueList(source)
  const keys = fields.map(name)
  charge(rows.length * keys.length * (1 + Math.ceil(Math.log2(Math.max(1, rows.length)))))
  return rows
    .map((value) => ({ value, scores: keys.map((key) => numeric(record(value)[key])) }))
    .sort((a, b) => {
      for (const [index, score] of a.scores.entries()) {
        const difference = score - (b.scores[index] ?? 0)
        if (difference !== 0) return difference
      }
      return 0
    })
    .map(({ value }) => value)
}

export function startsWithIgnoreCase([value, prefix]: Values, charge: Charge): boolean {
  const chars = string(value)
  const start = string(prefix)
  charge(chars.length + start.length)
  return chars.toLowerCase().startsWith(start.toLowerCase())
}
