import { decide, type Command, type ElementId, type Register, type Value } from "@airdesign/document"

export type PaintAhead = {
  readonly on: (register: Register) => Register
  readonly hold: (commands: readonly Command[]) => () => void
  readonly paint: (commands: readonly Command[]) => () => void
}

type AheadCanvas = {
  readonly shown: () => Register | null
  readonly keep: (register: Register) => void
  readonly show: (register: Register, nodes: readonly ElementId[]) => void
}

function decided(register: Register, command: Command): Register {
  const decision = decide(register, command)
  return decision.decision === "apply" ? decision.register : register
}

function applied(register: Register, command: Command): Register {
  const node = command.command === "person" ? command.node : undefined
  const opened =
    node === undefined || register.nodes.includes(node)
      ? register
      : decided(register, { command: "add", node, floor: "", route: register.route })
  return decided(opened, command)
}

function played(register: Register, edits: readonly (readonly Command[])[]): Register {
  return edits.reduce((shown, commands) => commands.reduce(applied, shown), register)
}

export function paintingAhead(canvas: AheadCanvas): PaintAhead {
  let ahead: readonly (readonly Command[])[] = []
  function hold(commands: readonly Command[]): () => void {
    ahead = [...ahead, commands]
    const shown = canvas.shown()
    if (shown !== null) canvas.keep(played(shown, [commands]))
    return () => {
      ahead = ahead.filter((each) => each !== commands)
    }
  }
  return {
    on: (register) => played(register, ahead),
    hold,
    paint(commands) {
      const written = hold(commands)
      const shown = canvas.shown()
      const nodes = commands.flatMap((command) =>
        command.command === "person" && command.node !== undefined ? [command.node] : [],
      )
      if (shown !== null) canvas.show(shown, nodes)
      return written
    },
  }
}

export function personCommands(register: Register, node: ElementId, floor: string, edit: Value): readonly Command[] {
  return [
    { command: "add", node, floor, route: register.route },
    { command: "person", ...edit, node },
  ]
}
