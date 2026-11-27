type Change = Readonly<Record<string, unknown>>

const call = (verb: string, fields: Readonly<Record<string, unknown>>) =>
  `${verb}(${JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)))})`

export function scriptOf(changes: readonly unknown[]): string {
  return changes.map(lineOf).join("\n")
}

export function scriptOfEach(changes: readonly unknown[]): string {
  return `[${changes.map(lineOf).join(",\n")}]`
}

function lineOf(each: unknown): string {
  const { op, ...fields } = each as Change
  return call(String(op), fields)
}

type Answered = { readonly ok: boolean; readonly fields: Readonly<Record<string, unknown>> }

export async function readOf<Result extends Answered>(
  call: (name: string, args: unknown) => Promise<Result>,
  deck: string,
  fields: Readonly<Record<string, unknown>> = {},
): Promise<{ readonly ok: boolean; readonly fields: Record<string, any> }> {
  const got = await call("execute", { deck, script: `get(${JSON.stringify(fields)})` })
  return got.ok ? { ok: true, fields: got.fields.result as Record<string, any> } : got
}
