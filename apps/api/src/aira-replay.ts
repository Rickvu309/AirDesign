import { readFileSync } from "node:fs"

import type { ModelCall, ModelOpen, Transport } from "./aira.js"

export type Script = {
  readonly name: string
  readonly request?: string
  readonly holdAfter?: number
  readonly fill?: Readonly<Record<string, string>>
}

export type Recorded = { readonly call: ModelCall; readonly key: string }

type Failure = {
  readonly status: number
  readonly body: { readonly request_id?: string; readonly error: { readonly type: string; readonly message: string } }
}

const fixtures = new URL("./aira-streams/", import.meta.url)

export function fixtureText(name: string, folder: URL = fixtures): string {
  return readFileSync(new URL(name, folder), "utf8")
}

function eventsOf(text: string): unknown[] {
  return text
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => line !== undefined)
    .map((line) => JSON.parse(line.slice("data: ".length)) as unknown)
}

export function streamEvents(name: string): unknown[] {
  return eventsOf(fixtureText(name))
}

export function failureOf(name: string, folder: URL = fixtures): Failure {
  return JSON.parse(fixtureText(name, folder)) as Failure
}

function filled(text: string, fill: Readonly<Record<string, string>>): string {
  return Object.entries(fill).reduce((result, [token, value]) => result.replaceAll(`@${token}@`, value), text)
}

export class Replay {
  readonly calls: Recorded[] = []
  private scripts: readonly Script[] = [{ name: "turn.sse" }]
  private reach: (() => void) | undefined
  private opened: Promise<void> = Promise.resolve()
  private open: () => void = () => undefined
  private readonly folder: URL

  constructor(folder: URL = fixtures) {
    this.folder = folder
  }

  play(...scripts: readonly [Script, ...Script[]]): void {
    this.scripts = scripts
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
    const [script = { name: "turn.sse" }, ...rest] = this.scripts
    if (rest.length > 0) this.scripts = rest
    if (script.name.endsWith(".json")) {
      const failure = failureOf(script.name, this.folder)
      const open: ModelOpen = {
        ok: false,
        request: failure.body.request_id ?? null,
        status: failure.status,
        type: failure.body.error.type,
        message: failure.body.error.message,
      }
      return open
    }
    const events = eventsOf(filled(fixtureText(script.name, this.folder), script.fill ?? {}))
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
