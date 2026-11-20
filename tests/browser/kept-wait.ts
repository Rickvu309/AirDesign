export const keptWaitApproval = "a person approves this kept wait, and its count in oxlintrc.json"

export type KeptWait = {
  readonly why: string
  readonly until: string
  readonly approval: typeof keptWaitApproval
}

export function keptWait<Wait>(wait: Wait, kept: KeptWait): Wait {
  if (kept.why === "") throw new Error("a kept wait says why")
  return wait
}
