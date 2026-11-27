import * as doom from "@airdesign/doom"
import type { Tree } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"
import { undoStaysNote } from "@airdesign/catalog"
import { airaKeptLayerName } from "./aira-copy"
import { testTheme } from "@airdesign/doom/testing"

const stays = "“Title” stays where it is, because the place it came from has changed."
const runA: doom.Author = { kind: "agent", id: "aira", run: "a" }
const runB: doom.Author = { kind: "agent", id: "claude", run: "b" }
const person: doom.Author = { kind: "person", id: "quan" }

type World = { readonly doom: doom.Doom; readonly log: readonly doom.RunEdit[] }

function open(tree: Tree): { readonly world: World } & Pick<doom.Grown, "ids" | "slides"> {
  const grown = doom.doomFromTree(tree)
  return { world: { doom: grown.doom, log: [] }, ids: grown.ids, slides: grown.slides }
}

function by(world: World, author: doom.Author, writes: readonly doom.Write[], phase?: "start" | "stop"): World {
  const edit: doom.Landed = {
    once: `once-${String(world.log.length)}`,
    author,
    writes,
    ...(phase === undefined ? {} : { phase }),
    rev: doom.rev(world.doom.rev + 1),
  }
  const after = doom.applyEdit(world.doom, edit)
  if (doom.isRefusal(after)) throw new Error(`refused ${JSON.stringify(after)}`)
  return { doom: after, log: [...world.log, { ...edit, replaced: doom.replacedBy(world.doom, edit) }] }
}

const move = (node: doom.NodeId, parent: doom.NodeId): doom.Write => ({
  node,
  prop: "parent",
  value: { id: parent, at: doom.orderKeyBetween(null, null) },
})

const drop = (node: doom.NodeId): doom.Write => ({ node, prop: "parent", value: null })

function heldBy(world: World, id: doom.NodeId): doom.NodeId | null {
  const parent = (world.doom.nodes.get(id) as { parent?: { readonly id: doom.NodeId } | null } | undefined)?.parent
  return parent === null || parent === undefined ? null : parent.id
}

function undoneOf(world: World, run: string): doom.Undone {
  return doom.invertRun(
    world.doom,
    world.log.filter((edit) => edit.author.run === run),
  )
}

function said(world: World, run: string): string {
  return undoStaysNote("Aira", {
    kept: [],
    waiting: [],
    left: undoneOf(world, run).left.map((id) =>
      airaKeptLayerName((world.doom.nodes.get(id) as { readonly name?: string } | undefined)?.name ?? ""),
    ),
  })
}

const theme = testTheme

describe("the note when Undo leaves a layer", () => {
  it("says the same thing when the frame it came from was deleted", () => {
    const opened = open({
      theme,
      slides: [{ children: [{ type: "frame", name: "Card", children: [{ type: "shape", name: "Title" }] }] }],
    })
    const title = opened.ids.Title!
    const card = opened.ids.Card!
    const slide = opened.slides[0]!
    let world = by(opened.world, runA, [move(title, slide)], "start")
    world = by(world, person, [drop(card)])
    expect(heldBy(world, card)).toBeNull()
    expect(heldBy(world, title)).toBe(slide)
    expect(undoneOf(world, "a").left).toEqual([title])
    expect(said(world, "a")).toBe(stays)
  })

  it("says the same thing when the frame it came from now sits inside it", () => {
    const opened = open({
      theme,
      slides: [{ children: [{ type: "frame", name: "Home", children: [{ type: "frame", name: "Title" }] }] }],
    })
    const title = opened.ids.Title!
    const home = opened.ids.Home!
    const slide = opened.slides[0]!
    let world = by(opened.world, runA, [move(title, slide)], "start")
    world = by(world, person, [move(home, title)])
    expect(heldBy(world, home)).toBe(title)
    expect(heldBy(world, title)).toBe(slide)
    expect(undoneOf(world, "a").left).toEqual([title])
    expect(said(world, "a")).toBe(stays)
  })

  it("says the same thing when two restores would trade places", () => {
    const opened = open({
      theme,
      slides: [{ children: [{ type: "frame", name: "Bee", children: [{ type: "frame", name: "Aye" }] }] }],
    })
    const aye = opened.ids.Aye!
    const bee = opened.ids.Bee!
    const slide = opened.slides[0]!
    let world = by(opened.world, runA, [move(aye, slide)], "start")
    world = by(world, runB, [move(bee, aye)], "start")
    world = by(world, runA, [move(bee, slide)])
    expect(heldBy(world, aye)).toBe(slide)
    expect(heldBy(world, bee)).toBe(slide)
    const undone = undoneOf(world, "a")
    expect(undone.left).toEqual([bee, aye])
    expect(undone.waiting).toEqual([])
    expect(said(world, "a")).toBe(
      "“Bee” and “Aye” stay where they are, because the places they came from have changed.",
    )
  })

  it("says the same thing when the place it came from is a slide that was deleted", () => {
    const opened = open({
      theme,
      slides: [
        { name: "One", children: [{ type: "shape", name: "Title" }] },
        { name: "Two", children: [] },
      ],
    })
    const title = opened.ids.Title!
    const one = opened.ids.One!
    const two = opened.slides[1]!
    let world = by(opened.world, runA, [move(title, two)], "start")
    world = by(world, person, [drop(one)])
    expect(heldBy(world, one)).toBeNull()
    expect(heldBy(world, title)).toBe(two)
    expect(undoneOf(world, "a").left).toEqual([title])
    expect(said(world, "a")).toBe(stays)
  })
})
