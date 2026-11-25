import { integer, reject } from "../read-kit.js"
import {
  type Charge,
  type Value,
  type ValueRecord,
  type Values,
  isList,
  numeric,
  record,
  string,
  token,
  valueList,
} from "./values.js"

export function partition(values: Values, size: number, charge: Charge): Values {
  charge(values.length)
  const groups: Values[] = []
  for (let i = 0; i < values.length; i += size) groups.push(values.slice(i, i + size))
  return groups
}

export function runs(values: Values, charge: Charge): Values {
  charge(values.length)
  const groups: Value[][] = []
  let run: Value[] = []
  for (const value of values) {
    if (value !== null) run.push(value)
    else if (run.length > 0) {
      groups.push(run)
      run = []
    }
  }
  if (run.length > 0) groups.push(run)
  return groups
}

export function flatten(groups: Values, charge: Charge): Values {
  const result: Value[] = []
  for (const source of groups) {
    const inner = valueList(source)
    charge(1 + inner.length)
    for (const value of inner) result.push(value)
  }
  return result
}

export function groupBy(values: Values, key: string, charge: Charge): Values {
  const groups = new Map<string, { first: Value; items: Value[] }>()
  for (const value of values) {
    if (value === null || typeof value !== "object" || isList(value) || !Object.hasOwn(value, key))
      return reject("shape", "Each group item must have the requested field.")
    const entry = value[key]
    const groupKey = JSON.stringify(entry === null ? null : token(entry))
    charge(1 + groupKey.length)
    const group = groups.get(groupKey)
    if (group !== undefined) group.items.push(value)
    else groups.set(groupKey, { first: value, items: [value] })
  }
  return Array.from(groups.values())
}

export function sample(values: Values, count: number, charge: Charge): Values {
  const size = Math.min(values.length, count)
  charge(size)
  return Array.from({ length: size }, (_, i) => values[Math.round((i * (values.length - 1)) / Math.max(1, size - 1))]!)
}

export const positiveInteger = integer(1, 100)

export function splitRanked(values: Values, field: string, count: number, charge: Charge): Values {
  const ranked = values.map((value) => {
    charge()
    const row = record(value)
    return { value, score: numeric(Object.hasOwn(row, field) ? row[field] : undefined) }
  })
  ranked.sort((a, b) => {
    charge()
    return b.score - a.score
  })
  return [ranked.slice(0, count).map(({ value }) => value), ranked.slice(count).map(({ value }) => value)]
}

export function indexBy(values: Values, field: string, charge: Charge): ValueRecord {
  return Object.fromEntries(
    values.map((value) => {
      const row = record(value)
      const key = string(Object.hasOwn(row, field) ? row[field] : undefined)
      charge(1 + key.length)
      return [key, value]
    }),
  )
}
