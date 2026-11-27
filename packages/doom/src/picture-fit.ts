import type { Natural } from "./intent-draft.js"

export type Room = { readonly w: number; readonly h: number }

export function pictureFit(natural: Natural, room: Room): Room {
  const width = Math.max(1, natural.width)
  const height = Math.max(1, natural.height)
  const scale = Math.min(1, room.w / width, room.h / height)
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }
}
