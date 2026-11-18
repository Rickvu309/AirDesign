const latoFaces = ["Thin", "ExtraLight", "Light", "Medium", "SemiBold", "ExtraBold", "Black"] as const
const faces = latoFaces.map((name) => ({
  family: "Lato",
  typeface: `Lato ${name}`,
  name,
  file: `Lato-${name}.ttf`,
  italic: `Lato-${name}Italic.ttf`,
}))

export function portableFace(typeface: string) {
  return faces.find((face) => face.typeface.toLowerCase() === typeface.toLowerCase())
}

export function portableFaces(family: string) {
  const base = portableFace(family)?.family ?? family
  return faces.filter((face) => face.family.toLowerCase() === base.toLowerCase())
}
