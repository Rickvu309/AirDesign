import { slideStarts } from "@airdesign/doom"

export type ListedStart = (typeof slideStarts)[number]
export type LayoutChoice = { readonly part: ListedStart; readonly name: string }
