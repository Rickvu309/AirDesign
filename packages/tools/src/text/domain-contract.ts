import {z} from "zod"
import type {ParagraphMarker} from "../../../deck/src/text/body.ts"
import {retainedNumberSchemes} from "../../../deck/src/text/number-marker.ts"

const start = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).nullable()
const punctuation = z.enum(["period", "right-parenthesis", "parentheses"])
const presentation = {color: z.string().regex(/^#[a-f0-9]{6}$/i).optional(), size: z.strictObject({kind: z.enum(["multiple", "points"]), value: z.number().positive()}).optional()}
export const paragraphMarkerSchema = z.union([
  z.strictObject({kind: z.literal("none")}),
  z.strictObject({kind: z.literal("bullet"), character: z.string().refine(value => Array.from(value).length === 1 && !/[\r\n]/.test(value)), font: z.string().min(1).optional(), ...presentation}),
  z.strictObject({kind: z.literal("number"), format: z.literal("decimal"), punctuation: z.union([punctuation, z.literal("plain")]).optional(), start, ...presentation}),
  z.strictObject({kind: z.literal("number"), format: z.enum(["alphaLower", "alphaUpper", "romanLower", "romanUpper"]), punctuation: punctuation.optional(), start, ...presentation}),
  z.strictObject({kind: z.literal("source-number"), scheme: z.enum(retainedNumberSchemes), start: z.number().int().min(1).max(32767).nullable(), ...presentation}),
]) satisfies z.ZodType<ParagraphMarker>

export const textDomainContract = z.strictObject({kind: z.literal("paragraph-marker"), value: paragraphMarkerSchema})
export type TextDomainContract = z.infer<typeof textDomainContract>
