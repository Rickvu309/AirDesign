import { componentLibrary } from "../component/library.js"
import { isRefusal, nodeId, orderKeyBetween, placeComponent } from "../index.js"
import { land } from "../component/testing/linked-instance-fixtures.js"
import { childrenOf, parentOf } from "../doom-walk.js"
import { doomFromTree, type TreeNode } from "../doom-tree.js"
import { textFromMarkdown } from "../markdown.js"
import { slideFindings } from "../slide-findings.js"
import { defaultTheme } from "../theme.js"
import { measure, spot } from "./doom-fixtures-art.js"

export const text = (chars: string, style: "title" | "display" | "body" = "body", width = 1600): TreeNode => ({
  type: "shape",
  props: {
    ...(style === "body" ? {} : { role: "title" }),
    text: textFromMarkdown(chars, style),
    box: spot(0, 0, width, 180),
  },
})

export const chart = (
  component: "column" | "pie" | "line" = "column",
  box = spot(0, 200, 600, 500),
  tokens: Record<string, string> = component === "column" ? { unitHeader: "$M" } : {},
) => ({ component, box, tokens })

export type Layer = TreeNode | ReturnType<typeof chart>

export function findings(slides: readonly (readonly Layer[])[], read: number | readonly number[] = slides.length) {
  const grown = doomFromTree({
    theme: defaultTheme,
    slides: slides.map((layers) => ({ children: layers.filter((layer) => "type" in layer) })),
  })
  let doom = grown.doom
  let serial = 0
  for (const [index, slide] of grown.slides.entries()) {
    let at = parentOf(childrenOf(doom, slide).at(-1))?.at ?? null
    for (const layer of slides[index] ?? []) {
      if ("type" in layer) continue
      const definition = componentLibrary.get(layer.component)
      if (definition === undefined) throw new Error("missing component definition")
      at = orderKeyBetween(at, null)
      const writes = placeComponent(doom, definition, {
        frame: nodeId(`chart:${++serial}`),
        parent: { id: slide, at },
        box: layer.box,
        data: definition.spec.sample?.data,
        tokens: layer.tokens,
        measure,
      })
      if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
      doom = land(doom, writes, true)
    }
  }
  const picked = typeof read === "number" ? grown.slides.slice(0, read) : read.map((index) => grown.slides[index]!)
  return slideFindings(doom, picked, { measure }).map((found) => ({
    ...found,
    slide: grown.slides.indexOf(found.slide),
  }))
}

export const codes = (slides: readonly (readonly Layer[])[], read?: number | readonly number[]) =>
  findings(slides, read).map((finding) => finding.code)
