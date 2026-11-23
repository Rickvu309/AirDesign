import { type Geometry } from "@airdesign/document"

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
