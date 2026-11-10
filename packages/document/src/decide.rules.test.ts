import { describe, expect, it } from "vitest"
import {
  currentValue,
  decide,
  history,
  openRegister,
  version,
  type Command,
  type Decision,
  type NodeRegister,
  type Phase,
  type Register,
  type Refusal,
} from "./decide.js"

type ReadAt = "below" | "equal" | "above"
type Effect = "person" | "start" | "stop" | "undo" | "agent"

type PersonRule = {
  readonly command: "person"
  readonly phase: Phase
  readonly guarded: boolean
  readonly agentLanded: boolean
  readonly outcome: "apply" | "refuse"
  readonly effect?: "person"
  readonly guardedNext?: boolean
  readonly code?: Refusal
}

type RunRule = {
  readonly command: "start" | "stop" | "undo"
  readonly phase: Phase
  readonly runMatch: boolean
  readonly outcome: "apply" | "refuse"
  readonly effect?: "start" | "stop" | "undo"
  readonly guardedNext?: boolean
  readonly code?: Refusal
}

type AgentRule = {
  readonly command: "agent"
  readonly phase: Phase
  readonly runMatch: boolean
  readonly readAt: ReadAt
  readonly guarded: boolean
  readonly agentLanded: boolean
  readonly outcome: "apply" | "refuse"
  readonly effect?: "agent"
  readonly code?: Refusal
}

type Found = {
  readonly outcome: "apply" | "refuse"
  readonly effect?: Effect
  readonly guardedNext?: boolean
  readonly code?: Refusal
}

const personRules: readonly PersonRule[] = [
  {
    command: "person",
    phase: "idle",
    guarded: false,
    agentLanded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    phase: "idle",
    guarded: false,
    agentLanded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    phase: "idle",
    guarded: true,
    agentLanded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    phase: "idle",
    guarded: true,
    agentLanded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    phase: "running",
    guarded: false,
    agentLanded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    phase: "running",
    guarded: false,
    agentLanded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    phase: "running",
    guarded: true,
    agentLanded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    phase: "running",
    guarded: true,
    agentLanded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    phase: "stopped",
    guarded: false,
    agentLanded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    phase: "stopped",
    guarded: false,
    agentLanded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    phase: "stopped",
    guarded: true,
    agentLanded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    phase: "stopped",
    guarded: true,
    agentLanded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    phase: "undone",
    guarded: false,
    agentLanded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    phase: "undone",
    guarded: false,
    agentLanded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    phase: "undone",
    guarded: true,
    agentLanded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    phase: "undone",
    guarded: true,
    agentLanded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
]

const startRules: readonly RunRule[] = [
  {
    command: "start",
    phase: "idle",
    runMatch: false,
    outcome: "apply",
    effect: "start",
    guardedNext: false,
  },
  {
    command: "start",
    phase: "idle",
    runMatch: true,
    outcome: "apply",
    effect: "start",
    guardedNext: false,
  },
  {
    command: "start",
    phase: "running",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "start",
    phase: "running",
    runMatch: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "start",
    phase: "stopped",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "start",
    phase: "stopped",
    runMatch: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "start",
    phase: "undone",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "start",
    phase: "undone",
    runMatch: true,
    outcome: "refuse",
    code: "run-fenced",
  },
]

const stopRules: readonly RunRule[] = [
  {
    command: "stop",
    phase: "idle",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "stop",
    phase: "idle",
    runMatch: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "stop",
    phase: "running",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "stop",
    phase: "running",
    runMatch: true,
    outcome: "apply",
    effect: "stop",
  },
  {
    command: "stop",
    phase: "stopped",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "stop",
    phase: "stopped",
    runMatch: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "stop",
    phase: "undone",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "stop",
    phase: "undone",
    runMatch: true,
    outcome: "refuse",
    code: "run-fenced",
  },
]

const undoRules: readonly RunRule[] = [
  {
    command: "undo",
    phase: "idle",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "undo",
    phase: "idle",
    runMatch: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "undo",
    phase: "running",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "undo",
    phase: "running",
    runMatch: true,
    outcome: "apply",
    effect: "undo",
  },
  {
    command: "undo",
    phase: "stopped",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "undo",
    phase: "stopped",
    runMatch: true,
    outcome: "apply",
    effect: "undo",
  },
  {
    command: "undo",
    phase: "undone",
    runMatch: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "undo",
    phase: "undone",
    runMatch: true,
    outcome: "refuse",
    code: "run-fenced",
  },
]

const agentRules: readonly AgentRule[] = [
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "below",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "below",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "below",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "below",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "equal",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "equal",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "equal",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "equal",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "above",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "above",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "above",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: false,
    readAt: "above",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "below",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "below",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "below",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "below",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "equal",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "equal",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "equal",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "equal",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "above",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "above",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "above",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "idle",
    runMatch: true,
    readAt: "above",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "below",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "below",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "below",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "below",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "equal",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "equal",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "equal",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "equal",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "above",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "above",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "above",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: false,
    readAt: "above",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "below",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "stale",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "below",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "stale",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "below",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "stale",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "below",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "stale",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "equal",
    guarded: false,
    agentLanded: false,
    outcome: "apply",
    effect: "agent",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "equal",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "equal",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "person-protected",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "equal",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "person-protected",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "above",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "stale",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "above",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "stale",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "above",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "stale",
  },
  {
    command: "agent",
    phase: "running",
    runMatch: true,
    readAt: "above",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "stale",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "below",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "below",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "below",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "below",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "equal",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "equal",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "equal",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "equal",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "above",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "above",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "above",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: false,
    readAt: "above",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "below",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "below",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "below",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "below",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "equal",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "equal",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "equal",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "equal",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "above",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "above",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "above",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "stopped",
    runMatch: true,
    readAt: "above",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "below",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "below",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "below",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "below",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "equal",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "equal",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "equal",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "equal",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "above",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "above",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "above",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: false,
    readAt: "above",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "below",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "below",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "below",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "below",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "equal",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "equal",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "equal",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "equal",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "above",
    guarded: false,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "above",
    guarded: false,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "above",
    guarded: true,
    agentLanded: false,
    outcome: "refuse",
    code: "run-fenced",
  },
  {
    command: "agent",
    phase: "undone",
    runMatch: true,
    readAt: "above",
    guarded: true,
    agentLanded: true,
    outcome: "refuse",
    code: "run-fenced",
  },
]

const rules = new Map<string, Found>()

function add(key: string, rule: Found): void {
  if (rules.has(key)) {
    throw new Error(`duplicate row ${key}`)
  }
  rules.set(key, rule)
}

function personKey(command: "person", phase: Phase, guarded: boolean, agentLanded: boolean): string {
  return JSON.stringify({ command, phase, guarded, agentLanded })
}

function runKey(command: "start" | "stop" | "undo", phase: Phase, runMatch: boolean): string {
  return JSON.stringify({ command, phase, runMatch })
}

function agentKey(
  command: "agent",
  phase: Phase,
  runMatch: boolean,
  readAt: ReadAt,
  guarded: boolean,
  agentLanded: boolean,
): string {
  return JSON.stringify({ command, phase, runMatch, readAt, guarded, agentLanded })
}

for (const row of personRules) {
  add(personKey(row.command, row.phase, row.guarded, row.agentLanded), row)
}
for (const row of startRules) {
  add(runKey(row.command, row.phase, row.runMatch), row)
}
for (const row of stopRules) {
  add(runKey(row.command, row.phase, row.runMatch), row)
}
for (const row of undoRules) {
  add(runKey(row.command, row.phase, row.runMatch), row)
}
for (const row of agentRules) {
  add(agentKey(row.command, row.phase, row.runMatch, row.readAt, row.guarded, row.agentLanded), row)
}

function copyNode(node: NodeRegister): NodeRegister {
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

function copyRegister(register: Register): Register {
  return {
    ...copyNode(register),
    nodes: [...register.nodes],
    readNodes: register.readNodes === null ? null : [...register.readNodes],
    b: register.b === null ? null : copyNode(register.b),
  }
}

function freezeNode(node: NodeRegister): void {
  for (const row of node.landed) {
    Object.freeze(row)
  }
  Object.freeze(node.landed)
}

function freezeRegister(register: Register): Register {
  const copy = copyRegister(register)
  freezeNode(copy)
  Object.freeze(copy.nodes)
  if (copy.readNodes !== null) {
    Object.freeze(copy.readNodes)
  }
  if (copy.b !== null) {
    freezeNode(copy.b)
    Object.freeze(copy.b)
  }
  return Object.freeze(copy)
}

function registerIdentity(register: Register): string {
  return JSON.stringify({
    phase: register.phase,
    runId: register.runId,
    readAt: register.readAt,
    guarded: register.guarded,
    claimed: register.claimed,
    stoppedAt: register.stoppedAt,
    landed: register.landed,
  })
}

function agentHasLanded(register: Register): boolean {
  return register.landed.some((row) => row.actor === "agent")
}

function visiblePersonRows(register: Register): number {
  let count = 0
  for (const row of register.landed) {
    if (row.actor === "person" && row.visible) {
      count += 1
    }
  }
  return count
}

function readAtBand(readAt: number, current: number): ReadAt {
  if (readAt < current) {
    return "below"
  }
  if (readAt > current) {
    return "above"
  }
  return "equal"
}

function commandKey(register: Register, command: Command): string {
  if (command.command === "person") {
    return personKey(command.command, register.phase, register.guarded, agentHasLanded(register))
  }
  if (command.command === "agent") {
    return agentKey(
      command.command,
      register.phase,
      register.runId === command.runId,
      readAtBand(command.readAt, version(register)),
      register.guarded,
      agentHasLanded(register),
    )
  }
  if (command.command === "start" || command.command === "stop" || command.command === "undo") {
    return runKey(command.command, register.phase, register.runId === command.runId)
  }
  throw new Error("missing command")
}

function commands(register: Register): readonly Command[] {
  const current = version(register)
  const below = current === 0 ? -1 : current - 1
  const list: Command[] = []
  for (const runId of ["r", "s"] as const) {
    list.push({ command: "start", runId })
  }
  for (const runId of ["r", "s"] as const) {
    list.push({ command: "stop", runId })
  }
  for (const runId of ["r", "s"] as const) {
    list.push({ command: "undo", runId })
  }
  list.push({ command: "person", value: "p" })
  for (const runId of ["r", "s"] as const) {
    list.push({ command: "agent", runId, readAt: below, value: "a" })
    list.push({ command: "agent", runId, readAt: current, value: "a" })
    list.push({ command: "agent", runId, readAt: current + 1, value: "a" })
  }
  return list
}

function personRegister(register: Register, guardedNext: boolean): Register {
  return {
    ...register,
    landed: [...register.landed, { actor: "person", value: "p", visible: true }],
    guarded: guardedNext,
  }
}

function startRegister(register: Register, runId: string): Register {
  return {
    ...register,
    phase: "running",
    runId,
    guarded: false,
  }
}

function stopRegister(register: Register): Register {
  return {
    ...register,
    phase: "stopped",
  }
}

function undoRegister(register: Register): Register {
  return {
    ...register,
    phase: "undone",
    landed: register.landed.map((row) =>
      row.actor === "agent" ? { actor: "agent", value: row.value, visible: false } : row,
    ),
  }
}

function agentRegister(register: Register): Register {
  return {
    ...register,
    landed: [...register.landed, { actor: "agent", value: "a", visible: true }],
  }
}

function predicted(register: Register, command: Command, effect: Effect, guardedNext: boolean | undefined): Register {
  if (effect === "person") {
    if (guardedNext === undefined) {
      throw new Error("missing guardedNext")
    }
    return personRegister(register, guardedNext)
  }
  if (effect === "start") {
    if (command.command !== "start") {
      throw new Error("start effect")
    }
    return startRegister(register, command.runId)
  }
  if (effect === "stop") {
    return stopRegister(register)
  }
  if (effect === "undo") {
    return undoRegister(register)
  }
  return agentRegister(register)
}

function sameRegister(actual: Register, expected: Register, key: string): void {
  expect(version(actual), key).toBe(version(expected))
  expect(currentValue(actual), key).toBe(currentValue(expected))
  expect(history(actual), key).toEqual(history(expected))
  expect(actual.guarded, key).toBe(expected.guarded)
  expect(actual.phase, key).toBe(expected.phase)
  expect(actual.route, key).toBe(expected.route)
  expect(actual.runId, key).toBe(expected.runId)
}

function enqueue(register: Register, queue: Register[], visited: Set<string>): void {
  if (visiblePersonRows(register) > 2) {
    return
  }
  const successor = freezeRegister(register)
  const id = registerIdentity(successor)
  if (visited.has(id)) {
    return
  }
  visited.add(id)
  queue.push(successor)
}

function finish(
  register: Register,
  command: Command,
  decision: Decision,
  rule: Found,
  key: string,
  queue: Register[],
  visited: Set<string>,
): void {
  if (rule.outcome === "refuse") {
    if (rule.code === undefined) {
      throw new Error(`missing code ${key}`)
    }
    expect(decision, key).toEqual({ decision: "refuse", code: rule.code })
    return
  }
  if (rule.effect === undefined) {
    throw new Error(`missing effect ${key}`)
  }
  const expected = predicted(register, command, rule.effect, rule.guardedNext)
  expect(decision.decision, key).toBe("apply")
  if (decision.decision !== "apply") {
    throw new Error(`expected apply ${key}`)
  }
  sameRegister(decision.register, expected, key)
  expect(decision.route, key).toBe(expected.route)
  enqueue(decision.register, queue, visited)
}

function checkCommand(
  register: Register,
  command: Command,
  queue: Register[],
  visited: Set<string>,
  seenKeys: Set<string>,
): void {
  const key = commandKey(register, command)
  seenKeys.add(key)
  const before = copyRegister(register)
  const decision = decide(register, command)
  expect(register, key).toEqual(before)
  const rule = rules.get(key)
  if (rule === undefined) {
    throw new Error(`missing row ${key}`)
  }
  finish(register, command, decision, rule, key, queue, visited)
}

const situations: readonly (readonly [string, Readonly<Record<string, string | boolean>>])[] = [
  [
    "Agent, running, run match, readAt equal, guarded false, agent row landed",
    {
      command: "agent",
      phase: "running",
      runMatch: true,
      readAt: "equal",
      guarded: false,
      agentLanded: true,
    },
  ],
  ["Agent, stopped, run match, readAt below", { command: "agent", phase: "stopped", runMatch: true, readAt: "below" }],
  [
    "Person, running, guarded false, agent row landed",
    { command: "person", phase: "running", guarded: false, agentLanded: true },
  ],
  ["Undo, stopped, run match", { command: "undo", phase: "stopped", runMatch: true }],
  ["Undo, undone, run match", { command: "undo", phase: "undone", runMatch: true }],
  [
    "Agent, running, run match, readAt below, guarded false, no agent row",
    {
      command: "agent",
      phase: "running",
      runMatch: true,
      readAt: "below",
      guarded: false,
      agentLanded: false,
    },
  ],
  [
    "Agent, running, run match, readAt equal, guarded true, no agent row",
    {
      command: "agent",
      phase: "running",
      runMatch: true,
      readAt: "equal",
      guarded: true,
      agentLanded: false,
    },
  ],
  [
    "Agent, running, run match, readAt below, guarded true, no agent row",
    {
      command: "agent",
      phase: "running",
      runMatch: true,
      readAt: "below",
      guarded: true,
      agentLanded: false,
    },
  ],
]

function visitedSituation(seenKeys: ReadonlySet<string>, part: Readonly<Record<string, string | boolean>>): boolean {
  for (const raw of seenKeys) {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      continue
    }
    const key = parsed as Record<string, unknown>
    let matched = true
    for (const [field, expected] of Object.entries(part)) {
      if (key[field] !== expected) {
        matched = false
      }
    }
    if (matched) {
      return true
    }
  }
  return false
}

function requireVisits(seenKeys: ReadonlySet<string>): void {
  for (const [name, part] of situations) {
    if (!visitedSituation(seenKeys, part)) {
      throw new Error(`not visited: ${name}`)
    }
  }
}

function walk(): void {
  const opened = freezeRegister(openRegister("floor", "slide"))
  const queue: Register[] = [opened]
  const visited = new Set<string>([registerIdentity(opened)])
  const seenKeys = new Set<string>()
  let dequeued = 0
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) {
      throw new Error("empty queue")
    }
    dequeued += 1
    if (version(current) > 4 || dequeued > 400) {
      throw new Error("state cap hit")
    }
    for (const command of commands(current)) {
      checkCommand(current, command, queue, visited, seenKeys)
    }
  }
  requireVisits(seenKeys)
}

describe("decide", () => {
  it("checks every reachable register", () => {
    walk()
  })

  it("keeps a person string unchanged", () => {
    const value = '  {"a":1}  \n\u0000café'
    const register = freezeRegister(openRegister("floor", "slide"))
    const before = copyRegister(register)
    const decision = decide(register, { command: "person", value })
    expect(register).toEqual(before)
    expect(decision.decision).toBe("apply")
    if (decision.decision !== "apply") {
      throw new Error("refused")
    }
    expect(currentValue(decision.register)).toBe(value)
  })
})
