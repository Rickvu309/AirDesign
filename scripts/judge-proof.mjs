import { NoPlace, benignKinds, breakKinds } from "./planted-kinds.mjs"

export { benignKinds, breakKinds } from "./planted-kinds.mjs"

const letters = "abcdefghijklmnopqrstuvwxyz"

export const seededRandom = (seed) => {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
  const below = (count) => Math.floor(next() * count)
  const between = (low, high) => low + below(high - low)
  const pick = (list) => list[below(list.length)]
  const shuffled = (list) => {
    const order = [...list]
    for (let last = order.length - 1; last > 0; last -= 1) {
      const other = below(last + 1)
      const kept = order[last]
      order[last] = order[other]
      order[other] = kept
    }
    return order
  }
  const word = () => Array.from({ length: between(5, 11) }, () => letters[below(letters.length)]).join("")
  return { next, below, between, pick, shuffled, word }
}

const wholeSeed = (seed) => Number.isInteger(seed) && seed >= 0 && seed <= 4294967295

export const seedFrom = ({ chosen, commit }) => {
  if (chosen === undefined || chosen === "") return Number.parseInt(commit.slice(0, 8), 16)
  const seed = Number(chosen)
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error(`JUDGE_SEED must be a whole number from 0 to 4294967295, and it is ${chosen}.`)
  }
  return seed
}

export const sampleSeed = (seed, kind, sample) => {
  let hash = 2166136261
  for (const char of `${seed} ${kind} ${sample}`) {
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0
  }
  return hash
}

export const replay = (seed) => `seed ${seed}, replay with JUDGE_SEED=${seed} pnpm check:pptx`

const knownRow = (row) =>
  wholeSeed(row?.seed) && typeof row.kind === "string" && typeof row.deck === "string" && typeof row.what === "string"

export const readSeedList = (text) => {
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed.seeds) || parsed.seeds.length === 0 || parsed.seeds.some((seed) => !wholeSeed(seed))) {
    throw new Error("The seed list needs at least one whole-number seed.")
  }
  if (!Array.isArray(parsed.known) || parsed.known.some((row) => !knownRow(row))) {
    throw new Error("The seed list needs known failures with a seed, kind, deck and what.")
  }
  return { seeds: parsed.seeds, known: parsed.known }
}

export const seedsFor = ({ chosen, list, draw, commit }) => {
  if (chosen === "random") {
    const seed = draw() >>> 0
    return [{ seed, known: [], chosen: true, fresh: false, announce: `random ${replay(seed)}` }]
  }
  if (chosen !== undefined && chosen !== "") {
    const seed = seedFrom({ chosen, commit })
    return [
      {
        seed,
        known: list.known.filter((row) => row.seed === seed),
        chosen: true,
        fresh: false,
        announce: replay(seed),
      },
    ]
  }
  const fresh = seedFrom({ chosen, commit })
  return [
    ...list.seeds.map((seed) => ({ seed, known: list.known, chosen: false, fresh: false, announce: replay(seed) })),
    { seed: fresh, known: [], chosen: true, fresh: true, announce: `fresh ${replay(fresh)}` },
  ]
}

const judgeFile =
  /^scripts\/(judge\.mjs|judge-proof\.mjs|planted-kinds\.mjs|pptx-check\.mjs|pptx-fixtures\/judge-[^/]*\.json)$/

const judgeSource =
  /^(packages\/pptx\/src\/(child-order|owned-parts|shape-id|validator-error)\.ts|scripts\/pptx-judge\/[^/]+)$/

export const changesJudgeSource = (files) => files.some((file) => judgeSource.test(file))

export const changedSinceArgs = (base) => ["diff", "--no-renames", "--name-only", base, "HEAD"]

export const changesJudge = (files) => files.some((file) => judgeFile.test(file))

const knownCommit = (value) => typeof value === "string" && /^[0-9a-f]{40}$/.test(value) && !/^0+$/.test(value)

export const eventBase = (text) => {
  try {
    const event = JSON.parse(text)
    return [event?.pull_request?.base?.sha, event?.merge_group?.base_sha, event?.before].find(knownCommit)
  } catch {
    return undefined
  }
}

export const freshMissFails = ({ eventText, mergeBase, changedSince }) => {
  const base = eventText === undefined ? mergeBase() : eventBase(eventText)
  if (base === undefined) return true
  const changed = changedSince(base)
  return changed === undefined || changesJudge(changed) || changesJudgeSource(changed)
}

export const settleRun = ({ run, lines, freshFails }) =>
  !run.fresh || freshFails
    ? { failed: lines.length, lines }
    : {
        failed: 0,
        lines: lines.map((line) => `This pull request changes no judge file, so this does not fail it: ${line}`),
      }

export const untouchedDeck = "untouched deck"

const plantOne = ({ pptx, order, seed, kind, mutate, sample }) => {
  for (let turn = 0; turn < order.length; turn += 1) {
    const deck = order[(sample + turn) % order.length]
    try {
      return { deck: deck.name, ...mutate(pptx, deck.parts, seededRandom(sampleSeed(seed, kind, sample))) }
    } catch (error) {
      if (!(error instanceof NoPlace)) throw error
    }
  }
  throw new Error(`No deck has a place for ${kind}.`)
}

export const plantSamples = ({ pptx, decks, seed, samples }) => {
  const planted = []
  for (const [benign, kinds] of [
    [false, breakKinds],
    [true, benignKinds],
  ]) {
    for (const [kind, mutate] of Object.entries(kinds)) {
      const order = seededRandom(sampleSeed(seed, kind, "decks")).shuffled(decks)
      for (let sample = 0; sample < samples; sample += 1) {
        planted.push({ kind, benign, sample, ...plantOne({ pptx, order, seed, kind, mutate, sample }) })
      }
    }
  }
  decks.forEach((deck, sample) => {
    planted.push({ kind: untouchedDeck, benign: true, sample, deck: deck.name, parts: deck.parts, what: "rewritten" })
  })
  return planted
}

export const kindVerdicts = (judged) => {
  const verdicts = {}
  for (const sample of judged) {
    if (sample.benign) continue
    verdicts[sample.kind] = sample.accepted || verdicts[sample.kind] === "missed" ? "missed" : "caught"
  }
  return verdicts
}

export const caughtCount = (recorded) => ({
  now: Object.values(recorded).filter((verdict) => verdict === "caught").length,
  goal: Object.keys(recorded).length,
})

const sampleLine = (sample) => `${sample.deck}, ${sample.what}`

const samePlace = (sample, row) => row.kind === sample.kind && row.deck === sample.deck && row.what === sample.what

export const proofFailures = ({ recorded, judged, seed, known = [], chosen = false }) => {
  const lines = []
  const measured = kindVerdicts(judged)
  const again = replay(seed)
  const listed = known.filter((row) => row.seed === seed)
  const missedNote = chosen ? `Fix the cause, then add the seed to the list. ${again}` : again
  for (const [kind, verdict] of Object.entries(measured)) {
    const record = recorded[kind]
    if (record !== "caught" && record !== "missed") {
      lines.push(`${kind} is ${verdict} and judge-proof.json does not record it. Record ${verdict} there. ${again}`)
      continue
    }
    if (record === "caught" && verdict === "missed") {
      for (const sample of judged.filter((each) => each.kind === kind && each.accepted)) {
        if (listed.some((row) => samePlace(sample, row))) continue
        lines.push(`The judge missed ${kind}, recorded caught: ${sampleLine(sample)}. ${missedNote}`)
      }
    }
    if (record === "missed" && verdict === "caught") {
      lines.push(
        `The judge now catches ${kind} and judge-proof.json says missed. Record caught there and in metrics.json. ${again}`,
      )
    }
  }
  for (const kind of Object.keys(recorded)) {
    if (!(kind in measured)) lines.push(`${kind} is in judge-proof.json and no mutator plants it.`)
  }
  for (const sample of judged) {
    if (!sample.benign || sample.accepted) continue
    lines.push(
      `The judge rejected ${sample.kind}, an edit that leaves the file valid: ${sampleLine(sample)}: ${sample.reason}. ${again}`,
    )
  }
  for (const row of listed) {
    if (judged.some((sample) => sample.accepted && samePlace(sample, row))) continue
    lines.push(
      `The judge caught ${row.kind}, and the seed list still names this miss: ${sampleLine(row)}. Delete that entry. ${again}`,
    )
  }
  return lines
}

export const proofTable = (judged) => {
  const kinds = [...new Set(judged.map((sample) => sample.kind))]
  const width = Math.max(...kinds.map((kind) => kind.length))
  const measured = kindVerdicts(judged)
  return kinds.map((kind) => {
    const samples = judged.filter((sample) => sample.kind === kind)
    const benign = samples[0].benign
    const agreed = samples.filter((sample) => sample.accepted === benign).length
    const verdict = benign ? (agreed === samples.length ? "accepted" : "rejected") : measured[kind]
    const counted = benign ? "accepted" : "caught"
    return `judge ${benign ? "valid" : "break"}  ${kind.padEnd(width)}  ${verdict.padEnd(8)}  ${agreed} of ${samples.length} samples ${counted}`
  })
}
