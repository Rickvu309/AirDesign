import type { ComponentProps } from "react"
import type { EditorToolbar } from "@/editor/editor-toolbar"

export type ToolbarTools = ComponentProps<typeof EditorToolbar>

function after<A extends readonly unknown[]>(first: () => void, insert: (...args: A) => void) {
  return (...args: A) => {
    first()
    insert(...args)
  }
}

export function insertsFirst(tools: ToolbarTools, first: () => void): ToolbarTools {
  const { onText, onPicture, onShape, onIcon } = tools
  return {
    ...tools,
    ...(onText === undefined ? {} : { onText: after(first, onText) }),
    ...(onPicture === undefined ? {} : { onPicture: after(first, onPicture) }),
    ...(onShape === undefined ? {} : { onShape: after(first, onShape) }),
    ...(onIcon === undefined ? {} : { onIcon: after(first, onIcon) }),
  }
}
