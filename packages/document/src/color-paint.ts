import type { Color } from "./color.js"

export type Rgb = readonly [number, number, number]

export type PaintStep = { readonly op: string; readonly val?: number | null }

export type Painted = { readonly hex: string; readonly alpha: number }

const clamp = (value: number): number => Math.max(0, Math.min(1, value))
const wrap = (value: number): number => ((value % 1) + 1) % 1

export const hexRgb = (hex: string | null): Rgb | null =>
  hex !== null && /^[\da-f]{6}$/i.test(hex)
    ? [
        Number.parseInt(hex.slice(0, 2), 16) / 255,
        Number.parseInt(hex.slice(2, 4), 16) / 255,
        Number.parseInt(hex.slice(4), 16) / 255,
      ]
    : null

export const hslRgb = ([hue, saturation, lightness]: Rgb): Rgb => {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const sector = wrap(hue) * 6
  const other = chroma * (1 - Math.abs((sector % 2) - 1))
  const offset = lightness - chroma / 2
  const channels: Rgb =
    sector < 1
      ? [chroma, other, 0]
      : sector < 2
        ? [other, chroma, 0]
        : sector < 3
          ? [0, chroma, other]
          : sector < 4
            ? [0, other, chroma]
            : sector < 5
              ? [other, 0, chroma]
              : [chroma, 0, other]
  return channels.map((value) => value + offset) as unknown as Rgb
}

const rgbHsl = ([red, green, blue]: Rgb): Rgb => {
  const high = Math.max(red, green, blue)
  const low = Math.min(red, green, blue)
  const delta = high - low
  const lightness = (high + low) / 2
  if (delta === 0) return [0, 0, lightness]
  const hue =
    high === red ? (green - blue) / delta : high === green ? (blue - red) / delta + 2 : (red - green) / delta + 4
  return [wrap(hue / 6), delta / (1 - Math.abs(2 * lightness - 1)), lightness]
}

export const gamma = (value: number): number =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
export const invGamma = (value: number): number => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)

const lightExponent = 2.3
const inLinearLight = (channel: number, change: (light: number) => number): number =>
  Math.floor(clamp(change(channel ** lightExponent)) ** (1 / lightExponent) * 255 + 1e-9) / 255

export const presetColors: ReadonlyMap<string, string> = new Map(
  `aliceBlue:F0F8FF antiqueWhite:FAEBD7 aqua:00FFFF aquamarine:7FFFD4 azure:F0FFFF beige:F5F5DC bisque:FFE4C4 black:000000 blanchedAlmond:FFEBCD blue:0000FF blueViolet:8A2BE2 brown:A52A2A burlyWood:DEB887 cadetBlue:5F9EA0 chartreuse:7FFF00 chocolate:D2691E coral:FF7F50 cornflowerBlue:6495ED cornsilk:FFF8DC crimson:DC143C cyan:00FFFF dkBlue:00008B dkCyan:008B8B dkGoldenrod:B8860B dkGray:A9A9A9 dkGreen:006400 dkKhaki:BDB76B dkMagenta:8B008B dkOliveGreen:556B2F dkOrange:FF8C00 dkOrchid:9932CC dkRed:8B0000 dkSalmon:E9967A dkSeaGreen:8FBC8F dkSlateBlue:483D8B dkSlateGray:2F4F4F dkTurquoise:00CED1 dkViolet:9400D3 deepPink:FF1493 deepSkyBlue:00BFFF dimGray:696969 dodgerBlue:1E90FF firebrick:B22222 floralWhite:FFFAF0 forestGreen:228B22 fuchsia:FF00FF gainsboro:DCDCDC ghostWhite:F8F8FF gold:FFD700 goldenrod:DAA520 gray:808080 green:008000 greenYellow:ADFF2F honeydew:F0FFF0 hotPink:FF69B4 indianRed:CD5C5C indigo:4B0082 ivory:FFFFF0 khaki:F0E68C lavender:E6E6FA lavenderBlush:FFF0F5 lawnGreen:7CFC00 lemonChiffon:FFFACD ltBlue:ADD8E6 ltCoral:F08080 ltCyan:E0FFFF ltGoldenrodYellow:FAFAD2 ltGray:D3D3D3 ltGreen:90EE90 ltPink:FFB6C1 ltSalmon:FFA07A ltSeaGreen:20B2AA ltSkyBlue:87CEFA ltSlateGray:778899 ltSteelBlue:B0C4DE ltYellow:FFFFE0 lime:00FF00 limeGreen:32CD32 linen:FAF0E6 magenta:FF00FF maroon:800000 medAquamarine:66CDAA medBlue:0000CD medOrchid:BA55D3 medPurple:9370DB medSeaGreen:3CB371 medSlateBlue:7B68EE medSpringGreen:00FA9A medTurquoise:48D1CC medVioletRed:C71585 midnightBlue:191970 mintCream:F5FFFA mistyRose:FFE4E1 moccasin:FFE4B5 navajoWhite:FFDEAD navy:000080 oldLace:FDF5E6 olive:808000 oliveDrab:6B8E23 orange:FFA500 orangeRed:FF4500 orchid:DA70D6 paleGoldenrod:EEE8AA paleGreen:98FB98 paleTurquoise:AFEEEE paleVioletRed:DB7093 papayaWhip:FFEFD5 peachPuff:FFDAB9 peru:CD853F pink:FFC0CB plum:DDA0DD powderBlue:B0E0E6 purple:800080 red:FF0000 rosyBrown:BC8F8F royalBlue:4169E1 saddleBrown:8B4513 salmon:FA8072 sandyBrown:F4A460 seaGreen:2E8B57 seaShell:FFF5EE sienna:A0522D silver:C0C0C0 skyBlue:87CEEB slateBlue:6A5ACD slateGray:708090 snow:FFFAFA springGreen:00FF7F steelBlue:4682B4 tan:D2B48C teal:008080 thistle:D8BFD8 tomato:FF6347 turquoise:40E0D0 violet:EE82EE wheat:F5DEB3 white:FFFFFF whiteSmoke:F5F5F5 yellow:FFFF00 yellowGreen:9ACD32`
    .split(" ")
    .map((entry) => entry.split(":") as [string, string]),
)

const valued = new Set([
  "lumMod",
  "lumOff",
  "satMod",
  "satOff",
  "hueMod",
  "hueOff",
  "tint",
  "shade",
  "alpha",
  "alphaMod",
  "alphaOff",
])

export function paintSteps(start: Rgb, from: number, steps: readonly PaintStep[]): { rgb: Rgb; alpha: number } | null {
  let rgb = start
  let alpha = from
  for (const step of steps) {
    const name = step.op
    const value = step.val ?? null
    const amount = (value ?? 0) / 100000
    if (valued.has(name) && value === null) return null
    if (
      name === "lumMod" ||
      name === "lumOff" ||
      name === "satMod" ||
      name === "satOff" ||
      name === "hueMod" ||
      name === "hueOff" ||
      name === "comp"
    ) {
      let [hue, saturation, lightness] = rgbHsl(rgb)
      if (name === "lumMod") lightness = clamp(lightness * amount)
      if (name === "lumOff") lightness = clamp(lightness + amount)
      if (name === "satMod") saturation = clamp(saturation * amount)
      if (name === "satOff") saturation = clamp(saturation + amount)
      if (name === "hueMod") hue = wrap(hue * amount)
      if (name === "hueOff") hue = wrap(hue + (value ?? 0) / 21600000)
      if (name === "comp") hue = wrap(hue + 0.5)
      rgb = hslRgb([hue, saturation, lightness])
    } else if (name === "alpha") alpha = clamp(amount)
    else if (name === "alphaMod") alpha = clamp(alpha * amount)
    else if (name === "alphaOff") alpha = clamp(alpha + amount)
    else if (name === "tint")
      rgb = rgb.map((channel) => inLinearLight(channel, (light) => 1 - (1 - light) * amount)) as unknown as Rgb
    else if (name === "shade")
      rgb = rgb.map((channel) => inLinearLight(channel, (light) => light * amount)) as unknown as Rgb
    else if (name === "inv") rgb = rgb.map((channel) => 1 - channel) as unknown as Rgb
    else if (name === "gray") {
      const gray = rgb[0] * 0.22 + rgb[1] * 0.72 + rgb[2] * 0.06
      rgb = [gray, gray, gray]
    } else if (name === "gamma") rgb = rgb.map(gamma) as unknown as Rgb
    else if (name === "invGamma") rgb = rgb.map(invGamma) as unknown as Rgb
  }
  return { rgb, alpha }
}

export function rgbHex(rgb: Rgb): string {
  return rgb
    .map((channel) =>
      Math.round(clamp(channel) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()
}

const usualSlots: Readonly<Record<string, string>> = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" }

export function colorPaint(color: Color, slot: (scheme: string) => string | null): Painted | null {
  const base =
    "rgb" in color
      ? color.rgb
      : "system" in color
        ? color.last
        : "preset" in color
          ? (presetColors.get(color.preset) ?? null)
          : (slot(color.scheme) ?? slot(usualSlots[color.scheme] ?? color.scheme))
  const start = hexRgb(base)
  const painted = start === null ? null : paintSteps(start, 1, color.transforms ?? [])
  return painted === null ? null : { hex: rgbHex(painted.rgb), alpha: painted.alpha }
}
