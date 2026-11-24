import { regularWeight, type ServedFace } from "./named-face.js"

export function weightRange(face: ServedFace): readonly [number, number] {
  const [low = regularWeight, high = low] = face.weight.split(" ").map(Number)
  return [low, high]
}

export function pickServedFace<T extends ServedFace>(
  faces: readonly T[],
  weight: number,
  italic: boolean,
): T | undefined {
  const styled = faces.filter((face) => face.style === (italic ? "italic" : "normal"))
  const pool = styled.length > 0 ? styled : faces
  const distance = (face: ServedFace) => {
    const [low, high] = weightRange(face)
    return weight < low ? low - weight : weight > high ? weight - high : 0
  }
  return [...pool].sort((one, two) => distance(one) - distance(two))[0]
}
