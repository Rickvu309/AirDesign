import { slidesDeck } from "./fit-deck.ts"

const columns = 5
const rows = 4
const card = { cx: 2_000_000, cy: 1_150_000, across: 2_250_000, down: 1_330_000, left: 500_000, top: 1_350_000 }
const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]
const inks = ["dk1", "lt1", "dk1", "lt1", "dk1", "lt1"]
const words =
  "Revenue grew in every region while costs held flat and the new plan keeps margins above target through the year".split(
    " ",
  )
const firstCard = 3

export const busySlides = 4
export const busyCards = columns * rows

export const cardId = (row: number, column: number): number => firstCard + row * columns + column

export const busyKey = (shape: number): string => `ppt/slides/slide1.xml#${shape}`

export const cardBox = (row: number, column: number) => ({
  x: card.left + column * card.across,
  y: card.top + row * card.down,
  cx: card.cx,
  cy: card.cy,
})

function sentence(seed: number): string {
  return Array.from({ length: 6 + (seed % 9) }, (_, at) => words[(seed * 7 + at) % words.length]).join(" ")
}

function fitOf(seed: number): string {
  if (seed % 4 === 3) return "<a:spAutoFit/>"
  return seed % 2 === 0 ? "<a:normAutofit/>" : '<a:normAutofit fontScale="92500" lnSpcReduction="10000"/>'
}

function cardXml(row: number, column: number): string {
  const id = cardId(row, column)
  const seed = row * columns + column
  const { x, y } = cardBox(row, column)
  const fill = accents[seed % accents.length] ?? "accent1"
  const ink = inks[seed % inks.length] ?? "dk1"
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Card ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${card.cx}" cy="${card.cy}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="${fill}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr">${fitOf(seed)}</a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1800" b="1"><a:solidFill><a:schemeClr val="${ink}"/></a:solidFill></a:rPr><a:t>Card ${String(seed + 1)}</a:t></a:r></a:p><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1400"><a:solidFill><a:schemeClr val="${ink}"/></a:solidFill></a:rPr><a:t>${sentence(seed)}</a:t></a:r></a:p></p:txBody></p:sp>`
}

const title =
  '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 2"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="500000" y="250000"/><a:ext cx="11000000" cy="950000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="b"><a:normAutofit fontScale="55000" lnSpcReduction="20000"/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="4000" b="1"/><a:t>Every region grew this year, and the plan keeps margins above target through the next four quarters</a:t></a:r></a:p></p:txBody></p:sp>'

function connectorXml(id: number, from: number, to: number): string {
  const start = { x: card.left + card.cx / 2, y: card.top + card.cy }
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Connector ${id}"/><p:cNvCxnSpPr><a:stCxn id="${from}" idx="2"/><a:endCxn id="${to}" idx="0"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${start.x}" y="${start.y}"/><a:ext cx="0" cy="${card.down - card.cy}"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="19050"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`
}

export const connectorId = firstCard + busyCards

function busyTree(): string {
  const cards = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => cardXml(row, column)).join(""),
  ).join("")
  return `${title}${cards}${connectorXml(connectorId, cardId(0, 0), cardId(1, 0))}`
}

export function busyDeck(): Promise<Buffer> {
  return slidesDeck(Array.from({ length: busySlides }, busyTree))
}
