import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { morphPairs } from "./morph-pairs"
import { testTheme } from "@airdesign/doom/testing"

const box = { box: { x: 0, y: 0, w: 10, h: 10, rotation: 0, flipH: false, flipV: false } }

it("pairs layers that share a name, in order, and skips a layer with no name", () => {
  const grown = doom.doomFromTree({
    theme: testTheme,
    slides: [
      {
        children: [
          { type: "shape", name: "Title", props: box },
          { type: "shape", props: box },
          { type: "shape", name: "Item", props: box },
          { type: "shape", name: "Item", props: box },
        ],
      },
      {
        children: [
          { type: "shape", name: "Item", props: box },
          { type: "shape", name: "Title", props: box },
          { type: "shape", name: "Item", props: box },
          { type: "shape", name: "Only here", props: box },
        ],
      },
    ],
  })
  const [from, to] = grown.slides
  const left = doom.childrenOf(grown.doom, from!)
  const right = doom.childrenOf(grown.doom, to!)
  expect(morphPairs(grown.doom, from, to)).toEqual([
    [left[0]!.id, right[1]!.id],
    [left[2]!.id, right[0]!.id],
    [left[3]!.id, right[2]!.id],
  ])
})
