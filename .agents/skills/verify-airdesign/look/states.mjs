import { readdirSync } from "node:fs"
import { availableParallelism } from "node:os"
import { walk } from "./walk.mjs"

const folder = new URL("./states/", import.meta.url)

async function readStates() {
  const files = readdirSync(folder)
    .filter((file) => file.endsWith(".mjs"))
    .sort()
  return Promise.all(files.map(async (file) => (await import(new URL(file, folder).href)).default))
}

export const states = await readStates()

export function find(name) {
  const state = states.find((each) => each.name === name)
  if (state === undefined)
    throw new Error(`no state named ${name}; one of ${states.map((each) => each.name).join(", ")}`)
  return state
}

export function matching(pattern = "*") {
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return states.filter((state) => new RegExp(`^${source}$`).test(state.name))
}

export async function reach(state, kit) {
  if (state.drive) return state.drive(kit)
  await walk(state.journey, kit, [state.at], async () => undefined)
}

export function units(selected) {
  const grouped = new Map()
  const single = []
  for (const state of selected) {
    if (state.drive) single.push({ states: [state], aira: state.aira === true })
    else {
      const unit = grouped.get(state.journey) ?? { journey: state.journey, states: [], aira: false }
      unit.states.push(state)
      unit.aira ||= state.aira === true
      grouped.set(state.journey, unit)
    }
  }
  return [...grouped.values(), ...single]
}

export function shardStates(selected, { current, total }) {
  const loads = Array.from({ length: total }, () => 0)
  const chosen = new Set()
  for (const unit of units(selected).toSorted((a, b) => Number(b.aira) - Number(a.aira))) {
    const lightest = loads.indexOf(Math.min(...loads))
    loads[lightest] += unit.states.length
    if (lightest === current - 1) for (const state of unit.states) chosen.add(state)
  }
  return selected.filter((state) => chosen.has(state))
}

export async function visit(unit, kit, reached) {
  if (unit.journey === undefined) {
    await unit.states[0].drive(kit)
    await reached(unit.states[0], kit)
    return
  }
  await walk(
    unit.journey,
    kit,
    unit.states.map((state) => state.at),
    (label) =>
      reached(
        unit.states.find((state) => state.at === label),
        kit,
      ),
  )
}

export function sweepLanes(cores) {
  return Math.min(8, Math.max(3, Math.floor(cores / 4)))
}

export async function sweep(selected, open, reached, lanes = sweepLanes(availableParallelism())) {
  const waiting = units(selected)
  const failures = []
  const work = async (lane) => {
    for (;;) {
      const at = waiting.findIndex((unit) => lane === 0 || !unit.aira)
      if (at === -1) return
      const [unit] = waiting.splice(at, 1)
      const { kit, close } = await open(unit)
      const done = new Set()
      try {
        await visit(unit, kit, async (state, at) => {
          done.add(state.name)
          await reached(state, at)
        })
      } catch (error) {
        const message = String(error?.message ?? error).split("\n")[0]
        for (const state of unit.states.filter((each) => !done.has(each.name)))
          failures.push({ state: state.name, error: message })
      } finally {
        await close()
      }
    }
  }
  await Promise.all(Array.from({ length: lanes }, (_, lane) => work(lane)))
  return failures
}
