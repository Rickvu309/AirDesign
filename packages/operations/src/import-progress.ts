import {z} from "zod"

const count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const importSlideProgressSchema=z.object({kind:z.literal("import-slides"),completed:count,total:count}).strict().refine(value=>value.completed<=value.total)
export const runningProgressSchema=z.union([z.object({kind:z.literal("unavailable")}).strict(),importSlideProgressSchema])
export type ImportSlideProgress=z.infer<typeof importSlideProgressSchema>
export type RunningProgress=z.infer<typeof runningProgressSchema>
export const importProgressPrefix="AIRDESIGN_IMPORT_PROGRESS "
