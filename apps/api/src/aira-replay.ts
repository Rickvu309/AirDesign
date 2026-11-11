import { readFileSync } from "node:fs"

import type { ModelCall, ModelOpen, Transport } from "./aira.js"

export type Script = { readonly name: string; readonly request?: string; readonly holdAfter?: number }

export type Recorded = { readonly call: ModelCall; readonly key: string }

type Failure = {
  readonly status: number
  readonly body: { readonly request_id?: string; readonly error: { readonly type: string; readonly message: string } }
}

export function fixtureText(name: string): string {
  return readFileSync(new URL(`./aira-streams/${name}`, import.meta.url), "utf8")
}

export function streamEvents(name: string): unknown[] {
  return fixtureText(name)
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => line !== undefined)
    .map((line) => JSON.parse(line.slice("data: ".length)) as unknown)
}

export function failureOf(name: string): Failure {
  return JSON.parse(fixtureText(name)) as Failure
}

export class Replay {
  readonly calls: Recorded[] = []
  private script: Script = { name: "turn.sse" }
  private reach: (() => void) | undefined
  private opened: Promise<void> = Promise.resolve()
  private open: () => void = () => undefined

  play(script: Script): void {
    this.script = script
  }

  hold(): Promise<void> {
    this.opened = new Promise((resolve) => {
      this.open = resolve
    })
    return new Promise((resolve) => {
      this.reach = resolve
    })
  }

  release(): void {
    this.open()
  }

  readonly transport: Transport = async (call, key) => {
    this.calls.push({ call, key })
    const script = this.script
    if (script.name.endsWith(".json")) {
      const failure = failureOf(script.name)
      const open: ModelOpen = {
        ok: false,
        request: failure.body.request_id ?? null,
        status: failure.status,
        type: failure.body.error.type,
        message: failure.body.error.message,
      }
      return open
    }
    const events = streamEvents(script.name)
    const reach = this.reach
    const opened = this.opened
    this.reach = undefined
    async function* replay(): AsyncIterable<unknown> {
      for (const [index, event] of events.entries()) {
        if (index === script.holdAfter) {
          reach?.()
          await opened
        }
        yield event
      }
    }
    return { ok: true, request: script.request ?? "req_fixture_turn", events: replay() }
  }
}
