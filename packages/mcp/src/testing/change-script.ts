type Change = Readonly<Record<string, unknown>>

const call = (verb: string, fields: Readonly<Record<string, unknown>>) =>
  `${verb}(${JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)))})`

function slideLine(change: Change): string {
  const add = change.add as Change | undefined
  if (add !== undefined) return call("insert", { kind: "slide", ...add })
  const moved = change.move as Change | undefined
  if (moved !== undefined) {
    const { slide, slides, group, ...where } = moved
    const targets = slides ?? (slide === undefined ? [group] : [slide])
    return call("move", { targets, ...(slide === undefined && slides === undefined ? {} : { group }), ...where })
  }
  return call("remove", { target: change.delete })
}

export function scriptOf(changes: readonly unknown[]): string {
  return changes
    .map((each) => {
      const { op, ...fields } = each as Change
      switch (op) {
        case "add": {
          const { slide, into, ...look } = fields
          return call("insert", { parent: into ?? slide, ...look })
        }
        case "set":
          return call("update", fields)
        case "move": {
          const { node, nodes, into, ...where } = fields
          return call("move", { targets: nodes ?? [node], parent: into, ...where })
        }
        case "wrap": {
          const { nodes, ...look } = fields
          return call("group", { targets: nodes, ...look })
        }
        case "unwrap":
          return call("ungroup", { target: fields.node })
        case "delete":
          return call("remove", { targets: fields.nodes })
        case "duplicate":
          return call("copy", { targets: fields.nodes })
        case "deck":
          return call("variables", fields)
        case "slide":
          return slideLine(fields)
        default:
          return `throw new Error(${JSON.stringify(`no operation for ${String(op)}`)})`
      }
    })
    .join("\n")
}

type Answered = { readonly ok: boolean; readonly answer: Readonly<Record<string, unknown>> }

export async function readOf<Result extends Answered>(
  call: (name: string, args: unknown) => Promise<Result>,
  deck: string,
  fields: Readonly<Record<string, unknown>> = {},
): Promise<{ readonly ok: boolean; readonly answer: Record<string, any> }> {
  const got = await call("execute", { deck, script: `get(${JSON.stringify(fields)})` })
  return got.ok ? { ok: true, answer: got.answer.result as Record<string, any> } : got
}
