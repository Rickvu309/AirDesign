import {z} from "zod"
const paragraphCommandRequest = z.discriminatedUnion("version", [
  z.object({version: z.literal(2), command: z.unknown(), preparation: z.string().optional()}).strict(),
  z.object({version: z.literal(3), command: z.unknown()}).strict()
])
export type ParagraphCommandRequest = z.infer<typeof paragraphCommandRequest>
export function parseParagraphCommandRequest(value: unknown): ParagraphCommandRequest {
  const parsed = paragraphCommandRequest.safeParse(value)
  if (!parsed.success) throw new Error("invalid-command")
  return parsed.data
}
