import * as doom from "@airdesign/doom"

import { told, type ToolResult } from "./answer.js"

const nameLimit = 60

const shownName = (name: string): string =>
  name
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim()
    .slice(0, nameLimit)

type OtherRun = { readonly agent: string; readonly wrote: number; readonly slide?: doom.NodeId }

function sentence(each: OtherRun): string {
  const who = each.agent === "" ? "Another agent" : `The agent named ${JSON.stringify(each.agent)}`
  const where = each.slide === undefined ? "" : ` on slide ${each.slide}`
  return `${who} has a run open on this deck, last writing${where} at rev ${String(each.wrote)}.`
}

export function withOtherRuns(read: ToolResult, fold: doom.Doom, agent: string): ToolResult {
  if (!read.ok) return read
  const otherRuns: OtherRun[] = doom
    .liveRuns(fold)
    .filter((run) => run.agent !== agent)
    .map((run) => ({
      agent: shownName(run.name),
      wrote: run.wrote,
      ...(run.slide === undefined ? {} : { slide: run.slide }),
    }))
  if (otherRuns.length === 0) return read
  const note = [
    read.answer.note,
    ...otherRuns.map(sentence),
    "Read again before you change a layer it may be changing.",
  ]
  return told(true, { ...read.answer, note: note.join(" "), otherRuns })
}
