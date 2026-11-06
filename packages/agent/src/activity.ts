import {z} from "zod"
export const usageLimitSchema=z.object({kind:z.literal("out-of-usage"),usage:z.object({hit:z.string(),paid:z.number(),week:z.object({resetsAt:z.number()})})})
export type UsageLimit=z.infer<typeof usageLimitSchema>
export class UsageLimitError extends Error {
  readonly limit:UsageLimit
  constructor(limit:UsageLimit){super("out-of-usage");this.limit=limit}
}
export type ActivityContent={kind:"tool";name:string;scope?:string}|{kind:"message";text:string}|{kind:"limit";limit:UsageLimit}
export type RunActivity=ActivityContent & {id:number}
export type AgentRun={id:string;owner:string;deck:string;request:string;selection:string[];kind:"working"|"complete"|"failed"|"stopped"|"undone"|"limited";events:RunActivity[];completed:string[]}
