export const colorCopy = {
  theme: "Theme colors",
  deck: "In this deck",
  custom: "Custom",
  customColor: "Custom color",
  area: "Saturation and brightness",
  hue: "Hue",
  hex: "Hex",
  pick: "Pick a color from the screen",
  lighter: (name: string, percent: number) => `${name}, lighter ${String(percent)}%`,
  darker: (name: string, percent: number) => `${name}, darker ${String(percent)}%`,
  hexName: (hex: string) => `#${hex}`,
  areaValue: (saturation: number, brightness: number) =>
    `Saturation ${String(saturation)}%, brightness ${String(brightness)}%`,
  none: "None",
} as const
