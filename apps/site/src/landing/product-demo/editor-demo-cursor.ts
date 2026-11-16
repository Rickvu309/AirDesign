interface CursorStop {
  ms: number
  x: number
  y: number
}

interface CursorEasings {
  micro: string
  travel: string
}

const cursorTip = 4
const plusButton = { x: 975.5, y: 753 }
const promptField = { x: 1040, y: 690 }
const typingRestSpot = { x: 1172, y: 626 }
const sendButton = { x: 1219, y: 753 }
const cursorStops: CursorStop[] = [
  { ms: 0, x: 600, y: 500 },
  { ms: 300, x: 600, y: 500 },
  { ms: 1150, ...plusButton },
  { ms: 1900, ...plusButton },
  { ms: 2180, ...promptField },
  { ms: 2700, ...promptField },
  { ms: 2950, ...typingRestSpot },
  { ms: 5650, ...typingRestSpot },
  { ms: 5900, ...sendButton },
  { ms: 6420, ...sendButton },
  { ms: 6950, x: 1120, y: 560 },
]
const cursorPressesMs = [1320, 2360, 6080]
const cursorPressDownMs = 80
const cursorPressUpMs = 260
const cursorPressScale = 0.9
const cursorOpacityPoints = [
  { ms: 0, opacity: 0 },
  { ms: 200, opacity: 1 },
  { ms: 7000, opacity: 1 },
  { ms: 7200, opacity: 0 },
]

export function cursorKeyframes(
  loopMs: number,
  easings: CursorEasings,
): { move: Keyframe[]; opacity: Keyframe[]; press: Keyframe[] } {
  const offsetAt = (ms: number) => ms / loopMs
  const lastStop = cursorStops[cursorStops.length - 1]
  const move = [...cursorStops, { ...lastStop, ms: loopMs }].map(({ ms, x, y }) => ({
    transform: `translate(${x - cursorTip}px, ${y - cursorTip}px)`,
    offset: offsetAt(ms),
    easing: easings.travel,
  }))
  const opacity = [...cursorOpacityPoints, { ms: loopMs, opacity: 0 }].map(({ ms, opacity }) => ({
    opacity,
    offset: offsetAt(ms),
    easing: "linear",
  }))
  const pressFrames = cursorPressesMs.flatMap((pressMs): Keyframe[] => [
    { transform: "scale(1)", offset: offsetAt(pressMs), easing: easings.micro },
    { transform: `scale(${cursorPressScale})`, offset: offsetAt(pressMs + cursorPressDownMs), easing: easings.micro },
    { transform: "scale(1)", offset: offsetAt(pressMs + cursorPressDownMs + cursorPressUpMs) },
  ])
  const press = [{ transform: "scale(1)", offset: 0 }, ...pressFrames, { transform: "scale(1)", offset: 1 }]
  return { move, opacity, press }
}
