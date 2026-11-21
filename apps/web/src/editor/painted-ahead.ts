import { decide, type Command, type ElementId, type Register, type Value } from "@airdesign/document"

export type PaintAhead = {
  readonly on: (register: Register) => Register
  readonly hold: (commands: readonly Command[]) => () => void
  readonly paint: (commands: readonly Command[]) => () => void
  readonly holding: () => boolean
  readonly stored: () => Promise<void>
  readonly watch: (listener: () => void) => () => void
}

type Ahead = { readonly commands: readonly Command[]; readonly written: Promise<void> }

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
  let ahead: readonly Ahead[] = []
  const listeners = new Set<() => void>()
  function changed(next: readonly Ahead[]) {
    if (next.length === ahead.length) return
    ahead = next
    for (const listener of [...listeners]) listener()
  }
  function hold(commands: readonly Command[]): () => void {
    let write = () => undefined as void
    const entry: Ahead = { commands, written: new Promise((done) => (write = done)) }
    changed([...ahead, entry])
    const shown = canvas.shown()
    if (shown !== null) canvas.keep(played(shown, [commands]))
    return () => {
      changed(ahead.filter((each) => each !== entry))
      write()
    }
  }
  return {
    on: (register) =>
      played(
        register,
        ahead.map((entry) => entry.commands),
      ),
    hold,
    holding: () => ahead.length > 0,
    stored: () => Promise.all(ahead.map((entry) => entry.written)).then(() => undefined),
    watch(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
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
