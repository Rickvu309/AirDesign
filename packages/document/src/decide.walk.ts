import { type Command, type NodeRegister, type Register } from "./decide.js"

export function copyNode(node: NodeRegister): NodeRegister {
  return {
    route: node.route,
    floor: node.floor,
    landed: node.landed.map((row) => ({ actor: row.actor, value: row.value, visible: row.visible })),
    phase: node.phase,
    runId: node.runId,
    readAt: node.readAt,
    guarded: node.guarded,
    claimed: node.claimed,
    stoppedAt: node.stoppedAt,
    slides: node.slides,
    bytes: node.bytes,
  }
}

export function copyRegister(register: Register): Register {
  return {
    ...copyNode(register),
    nodes: [...register.nodes],
    readNodes: register.readNodes === null ? null : [...register.readNodes],
    b: register.b === null ? null : copyNode(register.b),
  }
}

export function freezeNode(node: NodeRegister): NodeRegister {
  const copy = copyNode(node)
  for (const row of copy.landed) {
    Object.freeze(row)
  }
  Object.freeze(copy.landed)
  return Object.freeze(copy)
}

export function freezeRegister(register: Register): Register {
  const node = freezeNode(register)
  const frozen: Register = {
    ...node,
    nodes: [...register.nodes],
    readNodes: register.readNodes === null ? null : [...register.readNodes],
    b: register.b === null ? null : freezeNode(register.b),
  }
  Object.freeze(frozen.nodes)
  if (frozen.readNodes !== null) {
    Object.freeze(frozen.readNodes)
  }
  return Object.freeze(frozen)
}

export function walkRegisters(input: {
  readonly start: Register
  readonly identity: (register: Register) => string
  readonly commands: (register: Register) => readonly Command[]
  readonly keep: (register: Register) => boolean
  readonly cap: (dequeued: number, register: Register) => void
  readonly step: (register: Register, command: Command) => Register | null
}): void {
  const queue: Register[] = [input.start]
  const visited = new Set<string>([input.identity(input.start)])
  let dequeued = 0
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) {
      throw new Error("empty queue")
    }
    dequeued += 1
    input.cap(dequeued, current)
    for (const command of input.commands(current)) {
      const next = input.step(current, command)
      if (next === null || !input.keep(next)) {
        continue
      }
      const successor = freezeRegister(next)
      const id = input.identity(successor)
      if (visited.has(id)) {
        continue
      }
      visited.add(id)
      queue.push(successor)
    }
  }
}
