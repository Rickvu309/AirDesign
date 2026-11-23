export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

type About = { readonly slide: string; readonly node: string }

export type Finding = About &
  (
    | {
        readonly code: "overflow"
        readonly level: "fault"
        readonly needed: number
        readonly room: number
        readonly fix: { readonly size: number | null; readonly height: number }
      }
    | {
        readonly code: "off-slide"
        readonly level: "fault" | "note"
        readonly past: number
        readonly fix: { readonly x: number; readonly y: number } | null
      }
    | {
        readonly code: "overlap"
        readonly level: "fault"
        readonly other: string
        readonly by: "text" | "cover"
        readonly area: Rect
        readonly fix: { readonly node: string; readonly dx: number; readonly dy: number }
      }
    | {
        readonly code: "small-text"
        readonly level: "fault"
        readonly size: number
        readonly fix: { readonly size: number }
      }
    | {
        readonly code: "low-contrast"
        readonly level: "fault"
        readonly ratio: number
        readonly needs: number
        readonly text: string
        readonly behind: string
        readonly fix: { readonly color: string }
      }
    | {
        readonly code: "misaligned"
        readonly level: "fault"
        readonly other: string
        readonly edge: "left" | "right" | "top" | "bottom"
        readonly by: number
        readonly fix: { readonly x: number } | { readonly y: number }
      }
    | {
        readonly code: "off-scale"
        readonly level: "note"
        readonly size: number
        readonly style: string
        readonly fix: { readonly size: number }
      }
    | {
        readonly code: "empty-placeholder"
        readonly level: "note"
        readonly placeholder: string
        readonly fix: "delete"
      }
  )
