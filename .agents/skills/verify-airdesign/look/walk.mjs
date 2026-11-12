import { existsSync } from "node:fs"
import path from "node:path"

const journeys = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../journeys")

export async function walk(journey, kit, labels, reached) {
  const stop = Symbol(journey)
  const seen = new Set()
  const theirs = kit.journeys && path.join(kit.journeys, `${journey}.mjs`)
  const file = theirs && existsSync(theirs) ? theirs : path.join(journeys, `${journey}.mjs`)
  const { default: drive } = await import(file)
  try {
    await drive({
      ...kit,
      capture: async (label) => {
        if (labels.includes(label) && !seen.has(label)) {
          seen.add(label)
          await reached(label)
        }
        if (labels.every((each) => seen.has(each))) throw stop
        return path.join(kit.out, label)
      },
    })
  } catch (error) {
    if (error !== stop) throw error
  }
  const missed = labels.filter((label) => !seen.has(label))
  if (missed.length > 0) throw new Error(`journey ${journey} never reached ${missed.join(", ")}`)
}
