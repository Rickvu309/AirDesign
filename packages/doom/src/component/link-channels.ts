import { list, object } from "../read-kit.js"
import { type Charge, type Value, id, numeric } from "./values.js"

const readCard = object({ id, row: numeric, x: numeric, y: numeric, w: numeric, h: numeric }, { name: () => undefined })
const readLink = object({ from: id, to: id, id })
type Card = ReturnType<typeof readCard>
type Link = ReturnType<typeof readLink>
type Channel = { axis: "x" | "y"; at: number }
type Site = "t" | "b" | "l" | "r"
type Port = { site: Site; along: number; x: number; y: number }
type Route = { start: Port; end: Port; channels: Channel[] }
type Segment = { axis: "x" | "y"; at: number; min: number; max: number }

const clearance = 12
const epsilon = 1e-6

function segments({ start, end, channels }: Route): Segment[] {
  let point = { x: start.x, y: start.y }
  const result: Segment[] = []
  const step = ({ axis, at }: Channel) => {
    const other = axis === "x" ? "y" : "x"
    const from = point[axis]
    if (Math.abs(from - at) > epsilon)
      result.push({ axis, at: point[other], min: Math.min(from, at), max: Math.max(from, at) })
    point = { ...point, [axis]: at }
  }
  for (const channel of channels) step(channel)
  const last = channels.at(-1)?.axis
  if (last === "x") step({ axis: "y", at: end.y })
  if (last === "y") step({ axis: "x", at: end.x })
  if (last !== "y") step({ axis: "x", at: end.x })
  if (last !== "x") step({ axis: "y", at: end.y })
  return result
}

function encroaches(segment: Segment, card: Card): boolean {
  const { axis, at, min, max } = segment
  const crossStart = axis === "x" ? card.y : card.x
  const crossEnd = crossStart + (axis === "x" ? card.h : card.w)
  const start = card[axis]
  const end = start + (axis === "x" ? card.w : card.h)
  return (
    at > crossStart - clearance + epsilon &&
    at < crossEnd + clearance - epsilon &&
    max > start - clearance + epsilon &&
    min < end + clearance - epsilon
  )
}

function near(a: Segment, b: Segment): boolean {
  return (
    a.axis === b.axis &&
    Math.abs(a.at - b.at) < clearance - epsilon &&
    Math.min(a.max, b.max) - Math.max(a.min, b.min) > epsilon
  )
}

function tracks(min: number, max: number): number[] {
  if (min > max) return []
  const center = (min + max) / 2
  const result = [center]
  for (let offset = clearance; center - offset >= min && result.length < 17; offset += clearance)
    result.push(center - offset, center + offset)
  if (result.length === 1 && max - min >= clearance) return [min, max, center]
  return result
}

function ports(card: Card, site: Site, single: boolean): Port[] {
  const vertical = site === "t" || site === "b"
  const width = vertical ? card.w : card.h
  const preferred = vertical && !single ? (site === "t" ? -6 : 6) : 0
  const positions = [width / 2 + preferred]
  for (
    let step = clearance;
    step + Math.abs(preferred) <= width / 2 - clearance && positions.length < 25;
    step += clearance
  )
    positions.push(width / 2 + preferred - step, width / 2 + preferred + step)
  return positions.map((offset) => ({
    site,
    along: width === 0 ? 0.5 : Math.max(0, Math.min(1, offset / width)),
    x: vertical ? card.x + Math.max(0, Math.min(width, offset)) : card.x + (site === "r" ? card.w : 0),
    y: vertical ? card.y + (site === "b" ? card.h : 0) : card.y + offset,
  }))
}

const related = (a: Link, b: Link) => a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to

export function linkChannels(
  rawCards: Value | undefined,
  rawLinks: Value | undefined,
  bounds: Value | undefined,
  charge: Charge,
): Value {
  const cards = list(
    readCard,
    100,
  )(rawCards).map((card) => ({
    ...card,
    x: Math.round(card.x),
    y: Math.round(card.y),
    w: Math.round(card.x + card.w) - Math.round(card.x),
    h: Math.round(card.y + card.h) - Math.round(card.y),
  }))
  const links = list(readLink, 100)(rawLinks)
  if (links.length === 0) return []
  const { left, right, bottom } = object({ left: numeric, right: numeric, bottom: numeric })(bounds)
  const byId = new Map(cards.map((card) => [card.id, card]))
  const verticalDegree = new Map<string, number>()
  for (const { from, to } of links) {
    charge()
    if (byId.get(from)?.row === byId.get(to)?.row) continue
    verticalDegree.set(from, (verticalDegree.get(from) ?? 0) + 1)
    verticalDegree.set(to, (verticalDegree.get(to) ?? 0) + 1)
  }
  const cardPorts = (card: Card, site: Site) => ports(card, site, verticalDegree.get(card.id) === 1)
  const rows = [...new Map(cards.map((card) => [card.row, card])).values()].sort((a, b) => a.row - b.row)
  const gutters = [
    ...tracks(left, Math.min(right, ...cards.map((card) => card.x)) - clearance).reverse(),
    ...tracks(Math.max(left, ...cards.map((card) => card.x + card.w)) + clearance, right),
  ].sort((a, b) => b - a)
  const lanes = (card: Card, site: "t" | "b") => {
    const index = rows.findIndex((row) => row.row === card.row)
    const previous = rows[index - 1]
    const next = rows[index + 1]
    return site === "t"
      ? tracks(previous ? previous.y + previous.h + clearance : 0, card.y - clearance)
      : tracks(card.y + card.h + clearance, next ? next.y - clearance : bottom)
  }
  const occupied: { link: Link; route: Route; segments: Segment[] }[] = []
  const result: Value[] = []
  for (const link of links) {
    charge(cards.length + occupied.length)
    const a = byId.get(link.from)
    const b = byId.get(link.to)
    if (a === undefined || b === undefined) {
      result.push(null)
      continue
    }
    const peers = occupied.filter((other) => related(link, other.link))
    const obstacles = cards.filter((card) => card !== a && card !== b)
    const otherSegments = occupied.filter((other) => !related(link, other.link)).flatMap((other) => other.segments)
    const sameRow = a.row === b.row
    const down = a.row < b.row
    const across = a.x <= b.x
    const facing: [Site, Site] = sameRow ? (across ? ["r", "l"] : ["l", "r"]) : down ? ["b", "t"] : ["t", "b"]
    let best: Route | undefined
    let fallback: Route | undefined
    let leastConflicts = Infinity
    let remaining = 4000
    const tryRoute = (route: Route): boolean => {
      if (remaining-- <= 0) return false
      charge()
      const path = segments(route)
      let conflicts = 0
      for (const segment of path) {
        if (obstacles.some((card) => encroaches(segment, card))) conflicts += 100
        for (const other of otherSegments) if (near(segment, other)) conflicts++
      }
      if (conflicts < leastConflicts) {
        leastConflicts = conflicts
        fallback = route
      }
      if (conflicts !== 0) return false
      best = route
      return true
    }
    const startPorts = (card: Card, site: Site) => {
      const reused = peers.flatMap(({ link: peer, route }) => [
        ...(peer.from === card.id && route.start.site === site ? [route.start] : []),
        ...(peer.to === card.id && route.end.site === site ? [route.end] : []),
      ])
      return [...new Map([...reused, ...cardPorts(card, site)].map((port) => [port.along, port])).values()]
    }
    if (sameRow && a !== b) {
      const start = cardPorts(a, facing[0])[0]!
      const end = cardPorts(b, facing[1])[0]!
      tryRoute({ start, end, channels: [] })
    }
    const sides: readonly (readonly ["t" | "b", "t" | "b"])[] = sameRow
      ? [
          ["t", "t"],
          ["b", "b"],
        ]
      : down
        ? [
            ["b", "t"],
            ["b", "b"],
            ["t", "t"],
          ]
        : [
            ["t", "b"],
            ["b", "b"],
            ["t", "t"],
          ]
    for (const [from, to] of sides) {
      if (best !== undefined || remaining <= 0) break
      const starts = startPorts(a, from)
      const ends = startPorts(b, to)
      const fromLanes = lanes(a, from)
      const toLanes = lanes(b, to)
      const common = fromLanes.filter((y) => toLanes.includes(y))
      const channelSets: Channel[][] = common.map((at) => [{ axis: "y", at }])
      for (const x of gutters)
        for (const y of fromLanes)
          for (const endY of toLanes)
            if (y !== endY)
              channelSets.push([
                { axis: "y", at: y },
                { axis: "x", at: x },
                { axis: "y", at: endY },
              ])
      search: for (let rank = 0; rank < starts.length + ends.length - 1; rank++) {
        for (const channels of channelSets) {
          for (let i = 0; i <= rank; i++) {
            const start = starts[i]
            const end = ends[rank - i]
            if (start === undefined || end === undefined || (a === b && start.along === end.along && from === to))
              continue
            if (tryRoute({ start, end, channels }) || remaining <= 0) break search
          }
        }
      }
    }
    const route: Route = best ??
      fallback ?? {
        start: cardPorts(a, facing[0])[0]!,
        end: cardPorts(b, facing[1])[0]!,
        channels: [],
      }
    occupied.push({ link, route, segments: segments(route) })
    result.push({
      start: { site: route.start.site, along: route.start.along },
      end: { site: route.end.site, along: route.end.along },
      channels: route.channels,
    })
  }
  return result
}
