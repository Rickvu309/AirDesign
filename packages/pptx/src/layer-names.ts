import {
  elementId,
  hasSlideNumber,
  readTextValue,
  shapeOf,
  slideBirths,
  type ElementId,
  type Geometry,
  type Register,
} from "@airdesign/document"

const shapeWords: Readonly<Partial<Record<Geometry, string>>> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  straightConnector1: "Arrow",
  bentConnector3: "Elbow Connector",
  diamond: "Diamond",
  triangle: "Triangle",
  star5: "Star",
  plus: "Plus",
  leftArrow: "Left Arrow",
  rightArrow: "Right Arrow",
  wedgeRectCallout: "Speech Bubble",
}

export const newTextName = "Text"

export function newShapeName(geometry: Geometry, id: string): string {
  return `${shapeWords[geometry] ?? "Shape"} ${id}`
}

const numbered = /^(.*\S) \d+$/

export function copyName(name: string, id: string): string {
  const base = numbered.exec(name)?.[1]
  return base === undefined ? name : `${base} ${id}`
}

export function textLayerName(value: string): string {
  const paragraphs = readTextValue(value)?.map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
  const lines = paragraphs ?? value.split("\n")
  const first = lines.map((line) => line.replace(/\s+/g, " ").trim()).find((line) => line !== "")
  return first ?? newTextName
}

export function textNamedLayers(register: Register): ReadonlySet<ElementId> {
  const named = new Set<ElementId>()
  for (const command of register.order) {
    if (command.slide === "element-add") {
      const { element } = command
      const plain = command.geometry === undefined && command.media === undefined && command.pasted === undefined
      if (plain && element.kind === "shape" && element.value !== null && !hasSlideNumber(element.value))
        named.add(element.node)
    }
    if (command.slide === "element-clone") {
      if (named.has(command.source)) named.add(command.element.node)
      for (const layer of command.layers ?? []) if (named.has(layer.source)) named.add(layer.element.node)
    }
    for (const birth of slideBirths(command)) {
      if (birth.slide !== "clone") continue
      for (const element of birth.floor ?? [])
        if (named.has(elementId(`${birth.source}.${shapeOf(element.node).shape}`))) named.add(element.node)
    }
  }
  return named
}
