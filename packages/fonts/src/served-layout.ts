import { fallbackFont, servedFontName } from "./family.js"
import type { FontLayoutEngine, LayoutFace, LayoutParagraph } from "./layout-contract.js"
import { boldWeight, regularWeight } from "./named-face.js"
import { scriptFonts } from "./script-fonts.js"

export type LayoutRequest = { readonly family: string; readonly weight: number; readonly italic: boolean }

type Input = Parameters<FontLayoutEngine["flow"]>[0]
type Paragraph = Omit<Input, "paragraph" | "missingFace"> & {
  readonly text: string
  readonly runs: readonly (Pick<LayoutParagraph["runs"][number], "range" | "size" | "tracking" | "figures"> & {
    readonly font: string
    readonly bold: boolean
    readonly italic: boolean
  })[]
}

export const missingFaceRequest: LayoutRequest = { family: fallbackFont, weight: regularWeight, italic: false }

export function servedLayout(
  engine: FontLayoutEngine,
  { text, runs, width, emergency, twoLines }: Paragraph,
  locale: string,
  get: (request: LayoutRequest) => LayoutFace | null | undefined,
): (NonNullable<ReturnType<FontLayoutEngine["flow"]>> & { readonly pending?: true }) | undefined {
  let waiting = false
  const faceFor = (request: LayoutRequest) => {
    const face = get(request)
    if (face === undefined) waiting = true
    return face ?? undefined
  }
  const missingFace = faceFor(missingFaceRequest)
  const shaped = runs.flatMap((run): LayoutParagraph["runs"][number][] => {
    const primary = servedFontName(run.font) ?? fallbackFont
    const look = { weight: run.bold ? boldWeight : regularWeight, italic: run.italic }
    const preferred = faceFor({ family: primary, ...look })
    const fallback = primary === fallbackFont ? undefined : faceFor({ family: fallbackFont, ...look })
    const first = preferred ?? fallback ?? missingFace
    if (first === undefined) return []
    return [
      {
        ...run,
        faces: preferred !== undefined && fallback !== undefined ? [first, fallback] : [first],
        stack: preferred === undefined ? `${primary}|${String(look.weight)}|${String(look.italic)}` : primary,
        *fallback(cluster, presentation) {
          const script = scriptFonts(cluster, locale)
          const names =
            presentation === "color"
              ? ["Noto Color Emoji"]
              : presentation === "text"
                ? ["Noto Sans Symbols 2", ...script]
                : script
          for (const family of names) {
            if (family === primary) continue
            const face = get({ family, ...look })
            if (face === undefined) {
              waiting = true
              yield "loading"
              break
            }
            if (face !== null) yield face
          }
        },
      },
    ]
  })
  if (missingFace === undefined) return undefined
  const result = engine.flow({
    paragraph: { text, locale, direction: "auto", runs: shaped, sourceOffsetByTextOffset: [] },
    width,
    emergency,
    twoLines,
    missingFace,
  })
  return result === undefined || !waiting ? result : { ...result, pending: true }
}
