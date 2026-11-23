import type { NodeId, Rev } from "./ids.js"
import { rev } from "./ids.js"
import type { NodeType, Props, WriteKey, accepts } from "./props.js"

export type NodeOf<T extends NodeType> = { readonly id: NodeId; readonly rev: Rev } & Pick<Props, "type"> &
  Partial<Pick<Props, (typeof accepts)[T][number]>>
export type Node = { [T in NodeType]: NodeOf<T> & { readonly type: T } }[NodeType]

export type Write = {
  readonly node: NodeId
  readonly prop: WriteKey
  readonly value: unknown
  readonly base?: Rev
}
export type Author = { readonly kind: "person" | "agent"; readonly id: string; readonly run?: string }
export type Edit = {
  readonly once: string
  readonly author: Author
  readonly writes: readonly Write[]
  readonly phase?: "start" | "stop"
}
export type Landed = Edit & { readonly rev: Rev }

export type Run = { readonly phase: "running" | "stopped"; readonly guarded: ReadonlySet<NodeId> }

export type Doom = {
  readonly nodes: ReadonlyMap<NodeId, Node>
  readonly revs: ReadonlyMap<NodeId, ReadonlyMap<WriteKey, Rev>>
  readonly children: ReadonlyMap<NodeId, readonly NodeId[]>
  readonly rev: Rev
  readonly onces: ReadonlyMap<string, Rev>
  readonly runs: ReadonlyMap<string, Run>
}

export const emptyDoom: Doom = {
  nodes: new Map(),
  revs: new Map(),
  children: new Map(),
  rev: rev(0),
  onces: new Map(),
  runs: new Map(),
}
