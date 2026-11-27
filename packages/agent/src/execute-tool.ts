import { readCreateDeck, readExecute, readNamedDeck } from "@airdesign/catalog"
import type { Theme } from "@airdesign/doom"
import { themePresetById, themePresets } from "@airdesign/skills"

import { answered, doomRefused, hostRefused, refused, told, unadmitted, type Answer } from "./answer.js"
import { resultChars, scriptLimits, shotsPerCall } from "./budget.js"
import { readAnswer } from "./deck-read.js"
import type { DeckHost } from "./deck-host.js"
import { OpRefused, newPlan, opNote, runOperation, verbs, type Plan, type Verb } from "./execute-ops.js"
import { landEdit, landedBefore, type Agent, type Landed } from "./land-edit.js"
import { findingsNote, listed } from "./layout-findings-answer.js"
import { onceIds } from "./once-ids.js"
import { withOtherRuns } from "./other-runs.js"
import { scriptPool, type OpAnswer, type ScriptEnd } from "./script-pool.js"

const scripts = scriptPool([...verbs, "createDeck"])

async function answerOp(plan: Plan, verb: string, fields: unknown): Promise<OpAnswer> {
  try {
    if (verb === "createDeck") {
      plan.ops += 1
      throw new OpRefused(refused("field", { note: "Omit the deck id when calling createDeck." }).fields)
    }
    return { ok: true, value: await runOperation(plan, verb as Verb, fields) }
  } catch (thrown) {
    if (!(thrown instanceof OpRefused)) throw thrown
    plan.refused = { op: plan.ops, answer: thrown.answer }
    return { ok: false, message: thrown.message }
  }
}

function at(line: number | undefined): string {
  return line === undefined ? "" : ` at line ${String(line)}`
}

function stopped(plan: Pick<Plan, "ops" | "refused">, end: Extract<ScriptEnd, { ok: false }>): Answer {
  if (end.stop === "busy")
    return told(false, {
      ok: false,
      refusal: "busy",
      note: "Your account's script queue is busy. Wait for an execute call to finish, then try again.",
    })
  const logs = end.logs.length === 0 ? {} : { logs: end.logs }
  const line = end.line === undefined ? {} : { line: end.line }
  const reached = plan.ops === 0 ? "" : `, after ${String(plan.ops)} operations`
  if (end.stop === "time")
    return told(false, {
      ok: false,
      refusal: "script",
      note: `Nothing landed. The script ran past ${String(scriptLimits.ms / 1000)} seconds${reached} and was stopped. Look for a loop that never ends.`,
      ...logs,
    })
  if (end.stop === "crash")
    return told(false, {
      ok: false,
      refusal: "script",
      note: `Nothing landed. The script stopped the sandbox${reached}, most likely by using more than ${String(scriptLimits.memory / 1024 / 1024)} MB.`,
      ...logs,
    })
  const refusal = plan.refused
  if (refusal !== undefined && end.message === String(refusal.answer.note)) {
    const note = String(refusal.answer.note).replace(/^(Operation \d+ \([a-z]+\))/, `$1${at(end.line)}`)
    return told(false, { ...refusal.answer, ...line, note: `Nothing landed. ${note}`, ...logs })
  }
  return told(false, {
    ok: false,
    refusal: "script",
    ...line,
    note: `Nothing landed. The script threw ${end.name ?? "Error"}: ${end.message ?? ""}${at(end.line)}.`,
    ...logs,
  })
}

function landRefused(plan: Plan, result: Answer): Answer {
  const change = typeof result.fields.at === "number" ? plan.changeOps[result.fields.at] : undefined
  const { at: _at, change: _change, note: _note, ...rest } = result.fields
  if (change === undefined) return told(false, { ...rest, note: `Nothing landed. ${String(result.fields.note)}` })
  const note = `Operation ${String(change.op)} (${change.verb}): ${opNote(plan, change.verb, result.fields)}`
  return told(false, { ...rest, op: change.op, verb: change.verb, note: `Nothing landed. ${note}` })
}

async function pictures(plan: Plan, host: DeckHost) {
  const images: string[] = []
  const shown: string[] = []
  const notes: string[] = []
  if (plan.shots.length === 0) return { images, shown, notes }
  const now = await host.open(plan.opened.deck)
  if (!now.ok || host.pictures === undefined)
    return { images, shown, notes: ["No pictures: the deck could not be painted."] }
  const wanted = plan.shots.slice(0, shotsPerCall)
  const shots = await host.pictures(now.deck, now.fold, wanted)
  if (shots === "unwatched")
    return {
      images,
      shown,
      notes: [
        "No pictures: pictures come from an AirDesign tab with this deck open, and none is open. Use get for measured boxes and problems, or ask the person to open the deck.",
      ],
    }
  const waiting: string[] = []
  for (const slide of wanted) {
    const shot = shots.get(slide)
    if (typeof shot === "string") {
      images.push(shot)
      shown.push(slide)
    } else if (shot === undefined) waiting.push(slide)
    else notes.push(`A font could not load for ${slide}, so it has no picture.`)
  }
  if (waiting.length > 0)
    notes.push(
      `No picture of ${waiting.join(", ")} yet: the open AirDesign tab did not paint it in time. Use get for measured boxes and problems.`,
    )
  if (plan.shots.length > wanted.length)
    notes.push(`Pictures of the first ${String(shotsPerCall)} slides asked for only. Ask for the rest in another call.`)
  return { images, shown, notes }
}

function resultOf(end: Extract<ScriptEnd, { ok: true }>): { readonly result?: unknown; readonly cut?: string } {
  if (end.result === undefined) return {}
  const text = JSON.stringify(end.result) ?? ""
  if (text.length <= resultChars) return { result: end.result }
  return {
    result: `${text.slice(0, resultChars)}…`,
    cut: `The result was cut at ${resultChars.toLocaleString("en")} characters: return less, or read in parts.`,
  }
}

function leadOf(landed: Landed | undefined, rev: number): string {
  if (landed === undefined) return `Nothing changed: the script only read the deck, which stays at rev ${String(rev)}.`
  if (landed.unchanged === true)
    return `Nothing changed: the deck already holds every value the script set, so it stays at rev ${String(rev)}.`
  return `Landed at rev ${String(rev)} as one undo step.`
}

async function createFromScript(script: string, once: string, host: DeckHost): Promise<Answer> {
  let creation: { readonly name: string; readonly theme: Theme | undefined } | undefined
  let failure: Answer | undefined
  let ops = 0
  const operation = async (verb: string, fields: unknown): Promise<OpAnswer> => {
    ops += 1
    if (verb !== "createDeck") {
      failure = refused("field", { note: "Send a deck id to read or edit a deck." })
    } else if (creation !== undefined) {
      failure = refused("field", { note: "Call createDeck once per script." })
    } else {
      const parsed = readCreateDeck(fields === undefined ? {} : fields)
      if (!parsed.ok) {
        const { ok: _ok, refusal, ...detail } = parsed
        failure = refused(refusal, detail)
      } else {
        const preset = themePresetById(parsed.theme)
        if (parsed.theme === undefined || preset !== undefined) {
          creation = { name: parsed.name, theme: preset?.theme }
          return { ok: true, value: undefined }
        }
        failure = refused("field", { field: "theme", fault: "form", form: themePresets.map(({ id }) => id).join(", ") })
      }
    }
    return { ok: false, message: String(failure.fields.note) }
  }
  const end = await scripts.run({ account: host.account, script, operation })
  if (!end.ok) {
    const failed = failure === undefined ? {} : { refused: { op: ops, answer: failure.fields } }
    return stopped({ ops, ...failed }, end)
  }
  if (failure !== undefined) return failure
  if (creation === undefined) return refused("field", { note: "Use createDeck({ name, theme }) or send a deck id." })
  const refusal = await unadmitted(host, "deck")
  if (refusal !== undefined) return refusal
  const made = await host.create(creation.name, creation.theme, once)
  if (!made.ok) return hostRefused(made)
  const result = readAnswer(made, {})
  return told(result.ok, {
    ...result.fields,
    ...resultOf(end),
    ...(end.logs.length === 0 ? {} : { logs: end.logs }),
  })
}

export async function executeTool(
  raw: unknown,
  agent: Agent,
  once: string,
  host: DeckHost,
  pendingFonts: ReadonlySet<string>,
): Promise<Answer> {
  const named = readNamedDeck(raw)
  if (!named.ok && named.refusal === "deck") return refused("deck")
  const opened = named.ok ? await host.open(named.deck) : undefined
  if (opened?.ok === false) return hostRefused(opened)
  const input = readExecute(raw)
  if (!input.ok) {
    const { ok: _ok, refusal, ...detail } = input
    return refused(refusal, detail)
  }
  if (opened === undefined) {
    if (input.runId !== undefined) return refused("field", { note: "Send a deck id with runId." })
    return createFromScript(input.script, once, host)
  }
  const again = await landedBefore(opened, once, host)
  if (again !== undefined)
    return answered(`This call landed before, at rev ${String(again.rev)}.`, {
      ok: true,
      deck: opened.deck,
      rev: again.rev,
      runId: input.runId ?? onceIds(once).run,
      made: again.roots.map((each) => ({ ids: [each.id] })),
      problems: listed(again.findings.findings),
    })
  const lastRead = await host.agentReads.last(opened.deck, agent.id).catch(() => null)
  if (lastRead === null) return refused("store")
  const plan = newPlan(opened, host, once, agent, input.runId, pendingFonts)
  const end = await scripts.run({
    account: host.account,
    script: input.script,
    operation: (verb, fields) => answerOp(plan, verb, fields),
  })
  if (!end.ok) return stopped(plan, end)
  const compiled = plan.changes.length === 0 ? undefined : plan.session.finish()
  if (compiled !== undefined && "refused" in compiled)
    return landRefused(plan, doomRefused(compiled, { rev: opened.rev }))
  if (lastRead === undefined || (compiled === undefined && plan.read)) {
    try {
      await host.agentReads.remember(opened.deck, agent.id, opened.fold.rev)
    } catch {
      return refused("store")
    }
  }
  const sent = compiled === undefined ? undefined : await landEdit(opened, compiled, host, lastRead ?? opened.fold.rev)
  if (sent !== undefined && !("landed" in sent)) return landRefused(plan, sent)
  const landed = sent
  const shots = await pictures(plan, host)
  const rev = landed?.rev ?? opened.rev
  const runId = landed === undefined || landed.unchanged === true ? input.runId : plan.run
  const kept = resultOf(end)
  const note = [
    leadOf(landed, rev),
    ...(landed === undefined ? [] : findingsNote(landed.findings)),
    ...(runId === undefined
      ? []
      : [`Send runId ${runId} with your next call, and to airdesign_stop_run when you are done.`]),
    ...shots.notes,
    ...(kept.cut === undefined ? [] : [kept.cut]),
  ].join(" ")
  const result = withOtherRuns(
    answered(note, {
      ok: true,
      deck: opened.deck,
      rev,
      ...(runId === undefined ? {} : { runId }),
      ...(plan.names.size === 0 ? {} : { names: Object.fromEntries(plan.names) }),
      made: plan.made,
      problems: landed === undefined ? [] : listed(landed.findings.findings),
      ...(landed?.unchanged === true ? { unchanged: true } : {}),
      ...(landed === undefined || landed.bakedLayouts.length === 0 ? {} : { bakedLayouts: landed.bakedLayouts }),
      ...(kept.result === undefined ? {} : { result: kept.result }),
      ...(end.logs.length === 0 ? {} : { logs: end.logs }),
      ...(shots.shown.length === 0 ? {} : { pictures: shots.shown }),
    }),
    opened.fold,
    agent.id,
  )
  return { ...result, pictures: shots.images }
}
